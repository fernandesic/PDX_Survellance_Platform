"""
HDIS Intelligence - DRF Serializers
Enriches sentinel Signal data with trust scores for the HDIS-PRO frontend.
"""

from rest_framework import serializers
from sentinel.models import Signal
from sentinel.serializers import SignalListSerializer
from hdis.models import Alert, Briefing, TrustScore


# ─── Trust-Enriched Signal Serializer ─────────────────────────────────

class TrustScoreSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrustScore
        fields = [
            'score', 'trust_level',
            'source_tier_weight', 'corroboration_count',
            'disease_match_confidence', 'recency_factor',
            'computed_at',
        ]


class IntelRecordSerializer(serializers.ModelSerializer):
    """
    Signal serializer enriched with HDIS trust data.
    Maps sentinel fields → HDIS frontend field names.
    """
    trust = TrustScoreSerializer(read_only=True)
    risk_level = serializers.SerializerMethodField()
    headline = serializers.CharField(source='original_text')
    country_tags = serializers.SerializerMethodField()
    event_type = serializers.SerializerMethodField()
    signal_strength = serializers.SerializerMethodField()
    pillar_label = serializers.SerializerMethodField()
    status = serializers.CharField()
    source_display = serializers.SerializerMethodField()

    class Meta:
        model = Signal
        fields = [
            'id', 'headline', 'risk_level', 'event_type',
            'country_tags', 'signal_strength', 'status',
            'disease_name', 'disease_category',
            'pillar', 'secondary_pillars', 'pillar_label',
            'location_country', 'location_country_iso',
            'location_lat', 'location_lng',
            'original_language',
            'priority', 'confidence_score',
            'reported_cases', 'reported_deaths',
            'source_display',
            'cross_border_risk',
            'analyst_notes',
            'ingestion_source',
            'source_timestamp', 'source_url',
            'created_at', 'updated_at',
            'trust',
        ]

    def get_risk_level(self, obj):
        """Map sentinel P1–P4 → HDIS critical/high/medium/low."""
        mapping = {'P1': 'critical', 'P2': 'high', 'P3': 'medium', 'P4': 'low'}
        return mapping.get(obj.priority, 'low')

    def get_country_tags(self, obj):
        """Return ISO3 code as a list (matches HDIS frontend expectation)."""
        if obj.location_country_iso:
            return [obj.location_country_iso]
        return []

    def get_event_type(self, obj):
        """Map sentinel signal_type + disease_category → HDIS event type."""
        if obj.signal_type == 'disease' and obj.disease_category:
            return 'outbreak'
        return obj.signal_type or 'unknown'

    def get_signal_strength(self, obj):
        """Compute signal strength 1-5 from trust data if available."""
        try:
            trust = obj.trust
            count = trust.corroboration_count
            return min(5, max(1, count + 1))
        except TrustScore.DoesNotExist:
            return 1

    def get_source_display(self, obj):
        return {
            'name': obj.source_name,
            'tier': obj.source_tier,
            'url': obj.source_url,
            'type': obj.source_type,
        }

    def get_pillar_label(self, obj):
        """Human-readable pillar name."""
        labels = {
            'outbreak': 'Disease Outbreak',
            'policy': 'Health Policy',
            'funding': 'Health Funding',
            'vaccine': 'Vaccine Access',
            'conflict': 'Conflict & Health',
            'climate': 'Climate & Health',
            'agreement': 'Health Agreements',
            'workforce': 'Health Workforce',
            'uhc': 'Universal Health Coverage',
        }
        return labels.get(getattr(obj, 'pillar', 'outbreak'), 'Disease Outbreak')


class IntelRecordDetailSerializer(IntelRecordSerializer):
    """Extended serializer for record detail view."""
    impact_assessment = serializers.SerializerMethodField()
    recommended_posture = serializers.SerializerMethodField()
    topics = serializers.SerializerMethodField()
    actors = serializers.SerializerMethodField()
    stance = serializers.SerializerMethodField()
    scs_tier = serializers.IntegerField(source='source_tier')

    class Meta(IntelRecordSerializer.Meta):
        fields = IntelRecordSerializer.Meta.fields + [
            'impact_assessment', 'recommended_posture',
            'topics', 'actors', 'stance', 'scs_tier',
            'source_url', 'translated_text',
            'affected_population',
            'triaged_at', 'validated_at',
        ]

    def get_impact_assessment(self, obj):
        """Generate impact text from available signal data."""
        parts = []
        if obj.reported_cases:
            parts.append(f"{obj.reported_cases} reported cases")
        if obj.reported_deaths:
            parts.append(f"{obj.reported_deaths} reported deaths")
        if obj.cross_border_risk:
            parts.append("Cross-border risk flagged")
        if obj.affected_population:
            parts.append(f"Affected: {obj.affected_population}")
        return ". ".join(parts) if parts else "No impact data available."

    def get_recommended_posture(self, obj):
        """Generate posture recommendation from signal data."""
        if obj.priority == 'P1':
            return "Immediate attention required. Activate rapid response protocols."
        elif obj.priority == 'P2':
            return "Heightened vigilance. Monitor closely for escalation."
        elif obj.priority == 'P3':
            return "Standard monitoring. Review in next briefing cycle."
        return "Routine monitoring."

    def get_topics(self, obj):
        """Derive topics from disease category."""
        topics = []
        if obj.disease_category:
            topics.append(obj.disease_category)
        if obj.disease_name:
            topics.append('surveillance')
        if obj.cross_border_risk:
            topics.append('border_health')
        return topics

    def get_actors(self, obj):
        return []

    def get_stance(self, obj):
        return 'neutral'


# ─── Alert Serializer ─────────────────────────────────────────────────

class AlertSerializer(serializers.ModelSerializer):
    record_id = serializers.IntegerField(source='signal_id', read_only=True)
    country = serializers.CharField(source='signal.location_country', read_only=True)
    country_iso = serializers.CharField(source='signal.location_country_iso', read_only=True)

    class Meta:
        model = Alert
        fields = [
            'id', 'record_id', 'risk_level', 'trigger_reason',
            'confidence_score', 'signal_strength', 'multi_source_validated',
            'acknowledged_by', 'acknowledged_at',
            'country', 'country_iso',
            'created_at',
        ]


# ─── Briefing Serializer ─────────────────────────────────────────────

class BriefingSerializer(serializers.ModelSerializer):
    scope_display = serializers.CharField(source='get_scope_display', read_only=True)

    class Meta:
        model = Briefing
        fields = [
            'id', 'briefing_type', 'scope', 'scope_display',
            'country_iso', 'content', 'status',
            'confidence_level', 'signal_count', 'source_count',
            'generation_time_ms', 'llm_model',
            'pipeline_data',
            'country_filter', 'generated_by',
            'period_start', 'period_end', 'generated_at',
        ]


# ─── Dashboard Stats ─────────────────────────────────────────────────

class DashboardStatsSerializer(serializers.Serializer):
    total_records = serializers.IntegerField()
    critical_alerts = serializers.IntegerField()
    countries_monitored = serializers.IntegerField()
    active_sources = serializers.IntegerField()
    by_priority = serializers.DictField()
    by_trust_level = serializers.DictField()
    by_country = serializers.ListField()
    by_pillar = serializers.DictField(required=False)
