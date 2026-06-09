"""
Outbreak Workspace — DRF Serializers
"""

from rest_framework import serializers

from .models import (
    Pathogen,
    Outbreak,
    OutbreakEvent,
    OutbreakHistoricalEpisode,
    NotificationRule,
    OutbreakNotification,
    OutbreakDecision,
    LlmInteraction,
)


class PathogenSerializer(serializers.ModelSerializer):
    class Meta:
        model = Pathogen
        fields = [
            'id', 'name', 'family', 'r0_min', 'r0_max',
            'cfr_min', 'cfr_max', 'incubation_days_min', 'incubation_days_max',
            'transmission_modes', 'vaccine_available', 'antiviral_available',
            'profile_json', 'monitor_widgets', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class OutbreakListSerializer(serializers.ModelSerializer):
    # Nest the full pathogen so list-consumers (e.g. the PHEIC popup) can
    # render strain-level vaccine info without an extra round-trip.
    pathogen = PathogenSerializer(read_only=True)
    pathogen_name = serializers.CharField(source='pathogen.name', read_only=True)
    event_count = serializers.SerializerMethodField()

    class Meta:
        model = Outbreak
        fields = [
            'id', 'pathogen', 'pathogen_name', 'iso3', 'regions',
            'declared_at', 'status', 'severity', 'lead_focal_point',
            'summary', 'neighbor_iso3s', 'event_count',
            'confirmed_cases', 'confirmed_deaths', 'confirmed_as_of',
            'confirmed_source',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_event_count(self, obj):
        return obj.events.count()


class OutbreakDetailSerializer(serializers.ModelSerializer):
    pathogen = PathogenSerializer(read_only=True)
    event_count = serializers.SerializerMethodField()
    latest_event_ts = serializers.SerializerMethodField()
    latest_tracker = serializers.SerializerMethodField()
    tracker_breakdown = serializers.SerializerMethodField()
    latest_lab = serializers.SerializerMethodField()

    class Meta:
        model = Outbreak
        fields = [
            'id', 'pathogen', 'iso3', 'regions', 'declared_at',
            'status', 'severity', 'lead_focal_point', 'summary',
            'neighbor_iso3s', 'event_count', 'latest_event_ts',
            'confirmed_cases', 'confirmed_deaths', 'confirmed_as_of',
            'confirmed_source',
            'latest_tracker', 'tracker_breakdown', 'latest_lab',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_event_count(self, obj):
        return obj.events.count()

    def get_latest_event_ts(self, obj):
        latest = obj.events.order_by('-ts').values_list('ts', flat=True).first()
        return latest.isoformat() if latest else None

    def get_latest_tracker(self, obj):
        from outbreak.services.case_data import latest_tracker_snapshot
        return latest_tracker_snapshot(obj)

    def get_tracker_breakdown(self, obj):
        from outbreak.services.case_data import tracker_breakdown
        return tracker_breakdown(obj)

    def get_latest_lab(self, obj):
        from outbreak.services.case_data import latest_lab_snapshot
        return latest_lab_snapshot(obj)


class OutbreakCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Outbreak
        fields = [
            'pathogen', 'iso3', 'regions', 'declared_at', 'status',
            'severity', 'lead_focal_point', 'summary', 'neighbor_iso3s',
            'confirmed_cases', 'confirmed_deaths', 'confirmed_as_of',
            'confirmed_source',
        ]


class OutbreakEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = OutbreakEvent
        fields = [
            'id', 'outbreak', 'ts', 'source', 'kind', 'geo',
            'payload_json', 'confidence', 'source_ref', 'created_at',
        ]
        read_only_fields = fields  # All fields are read-only — immutable


class OutbreakHistoricalEpisodeSerializer(serializers.ModelSerializer):
    pathogen_name = serializers.CharField(source='pathogen.name', read_only=True)

    class Meta:
        model = OutbreakHistoricalEpisode
        fields = [
            'id', 'pathogen', 'pathogen_name', 'country', 'country_iso3',
            'year_start', 'year_end', 'cases', 'deaths',
            'response_summary', 'lessons', 'source_urls',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class OutbreakNotificationSerializer(serializers.ModelSerializer):
    rule_name = serializers.SerializerMethodField()
    event_kind = serializers.CharField(source='event.kind', read_only=True)
    event_geo = serializers.CharField(source='event.geo', read_only=True)
    event_ts = serializers.DateTimeField(source='event.ts', read_only=True)

    class Meta:
        model = OutbreakNotification
        fields = [
            'id', 'outbreak', 'rule', 'rule_name', 'event',
            'event_kind', 'event_geo', 'event_ts',
            'state', 'channel', 'rendered_message', 'hold_until',
            'dispatched_at', 'error', 'created_at', 'updated_at',
        ]
        read_only_fields = fields

    def get_rule_name(self, obj):
        return str(obj.rule)


class OutbreakDecisionSerializer(serializers.ModelSerializer):
    class Meta:
        model = OutbreakDecision
        fields = [
            'id', 'outbreak', 'kind', 'title', 'body', 'author',
            'evidence_event_ids', 'citations', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class LlmInteractionSerializer(serializers.ModelSerializer):
    class Meta:
        model = LlmInteraction
        fields = [
            'id', 'outbreak', 'source', 'question', 'final_answer',
            'refusal_reason', 'canned_query', 'model', 'provider',
            'latency_ms', 'prompt_tokens', 'completion_tokens',
            'created_at',
        ]
        read_only_fields = fields


class NotificationRuleSerializer(serializers.ModelSerializer):
    pathogen_name = serializers.CharField(source='pathogen.name', read_only=True)

    class Meta:
        model = NotificationRule
        fields = [
            'id', 'pathogen', 'pathogen_name', 'region', 'severity_threshold',
            'event_kinds', 'role', 'channel', 'contact_ids', 'template_id',
            'auto_send_after_hold', 'hold_seconds', 'enabled',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
