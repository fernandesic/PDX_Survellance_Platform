"""
Agent run endpoints — read-only views for AgentRun + AgentStep data.

Endpoints:
    GET /sentinel/agent/runs/?signal_id=<id>   → list runs for a signal
    GET /sentinel/agent/runs/<run_id>/          → one run with all steps
    GET /sentinel/agent/activity/?since=<iso>   → steps newer than timestamp (poll-friendly)
    GET /sentinel/agent/stats/                  → ai_stats() shape for the Stats tab
"""

from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AgentRun, AgentStep, Signal


# ── Serializers ────────────────────────────────────────────────────────────

class AgentStepSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentStep
        fields = [
            'id', 'step_number', 'kind', 'agent_name',
            'input_summary', 'output_summary', 'reasoning',
            'citations', 'latency_ms', 'tokens_used', 'model_name',
            'created_at',
        ]


class AgentRunListSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentRun
        fields = [
            'run_id', 'signal_id', 'status',
            'started_at', 'finished_at',
            'confidence', 'corroboration_count',
            'provider', 'model_name',
        ]


class AgentRunDetailSerializer(serializers.ModelSerializer):
    steps = AgentStepSerializer(many=True, read_only=True)

    class Meta:
        model = AgentRun
        fields = [
            'run_id', 'signal_id', 'status',
            'started_at', 'finished_at',
            'confidence', 'corroboration_count',
            'provider', 'model_name', 'error_message',
            'steps',
        ]


# ── Views ──────────────────────────────────────────────────────────────────

class AgentRunListView(APIView):
    """
    GET /sentinel/agent/runs/?signal_id=<id>
    Returns the most recent 20 runs for the given signal, newest first.
    Without signal_id returns the 20 most recent runs across all signals.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        signal_id = request.query_params.get('signal_id')
        country = request.query_params.get('country')
        # prefetch steps because the History tab derives classification from
        # the run's steps; without prefetch we'd N+1 across up to 20 runs.
        qs = AgentRun.objects.prefetch_related('steps').order_by('-started_at')
        if signal_id:
            try:
                signal_id = int(signal_id)
            except (TypeError, ValueError):
                return Response(
                    {'detail': 'signal_id must be an integer.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            qs = qs.filter(signal_id=signal_id)
        if country:
            # Map-driven scoping: only runs whose Signal is in this ISO3.
            # Uppercased so inbound 'nga' still matches 'NGA' rows.
            qs = qs.filter(signal__location_country_iso=country.upper())
        runs = qs[:20]
        return Response(AgentRunDetailSerializer(runs, many=True).data)


class AgentRunDetailView(APIView):
    """
    GET /sentinel/agent/runs/<run_id>/
    Returns one run with all its steps.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, run_id):
        try:
            run = AgentRun.objects.prefetch_related('steps').get(run_id=run_id)
        except AgentRun.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(AgentRunDetailSerializer(run).data)


class AgentActivityView(APIView):
    """
    GET /sentinel/agent/activity/?since=<iso_timestamp>
    Returns AgentStep rows created after `since`, newest first, limit 50.
    If `since` is omitted, returns the last 50 steps.
    Polling-friendly: no SSE. Frontend polls every 5s.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        since_str = request.query_params.get('since')
        country = request.query_params.get('country')
        qs = AgentStep.objects.select_related('run').order_by('-created_at')

        if since_str:
            try:
                from datetime import datetime
                since = datetime.fromisoformat(since_str.replace('Z', '+00:00'))
                qs = qs.filter(created_at__gt=since)
            except (ValueError, TypeError):
                return Response(
                    {'detail': 'since must be an ISO 8601 timestamp.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if country:
            # Map-driven scoping. Joins through AgentRun → Signal.
            qs = qs.filter(run__signal__location_country_iso=country.upper())

        steps = qs[:50]
        data = []
        for step in steps:
            d = AgentStepSerializer(step).data
            d['run_id'] = str(step.run_id)
            d['signal_id'] = step.run.signal_id
            data.append(d)
        return Response(data)


class AgentStatsView(APIView):
    """
    GET /sentinel/agent/stats/
    Returns aggregate stats for the Stats tab. Matches AgentStats TS interface.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.db.models import Count
        from sentinel.agent_classifier import _AGENT_CONFIG

        total_classified = Signal.objects.filter(
            ai_classification__isnull=False
        ).count()
        total_unclassified = Signal.objects.filter(
            ai_classification__isnull=True
        ).count()

        by_classification = dict(
            Signal.objects.filter(ai_classification__isnull=False)
            .values_list('ai_classification')
            .annotate(n=Count('id'))
            .values_list('ai_classification', 'n')
        )
        by_severity = dict(
            Signal.objects.filter(ai_severity__isnull=False)
            .values_list('ai_severity')
            .annotate(n=Count('id'))
            .values_list('ai_severity', 'n')
        )

        last_run = AgentRun.objects.order_by('-started_at').first()
        last_run_at = last_run.started_at.isoformat() if last_run else None

        # Health: based on most recent run status
        if last_run is None:
            agent_health = 'down'
        elif last_run.status == 'failed':
            agent_health = 'degraded'
        else:
            agent_health = 'healthy'

        return Response({
            'total_classified': total_classified,
            'total_unclassified': total_unclassified,
            'by_classification': by_classification,
            'by_severity': by_severity,
            'last_run_at': last_run_at,
            'agent_health': agent_health,
            'model_name': _AGENT_CONFIG.model or '',
            'provider': _AGENT_CONFIG.provider or '',
        })
