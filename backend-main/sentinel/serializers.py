"""
AFRO Sentinel Watchtower - DRF Serializers
"""

from rest_framework import serializers
from .models import Signal, DiseaseKeyword, SourceCredibility


class SourceCredibilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = SourceCredibility
        fields = [
            'id', 'source_name', 'source_url', 'source_type',
            'tier', 'credibility_score', 'total_signals',
            'validated_signals', 'false_positive_count',
            'last_signal_at', 'notes', 'created_at', 'updated_at',
        ]


class DiseaseKeywordSerializer(serializers.ModelSerializer):
    class Meta:
        model = DiseaseKeyword
        fields = [
            'id', 'disease_name', 'category', 'default_priority',
            'keywords_en', 'keywords_fr', 'keywords_pt', 'keywords_ar',
            'keywords_sw', 'keywords_ha', 'keywords_yo', 'keywords_am',
            'symptoms_cluster', 'endemic_regions',
            'case_fatality_rate', 'incubation_days_min', 'incubation_days_max',
            'transmission_routes', 'created_at', 'updated_at',
        ]


class SignalListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views"""
    source_display = serializers.SerializerMethodField()
    
    class Meta:
        model = Signal
        fields = [
            'id', 'signal_type', 'disease_name', 'disease_category',
            'location_country', 'location_country_iso',
            'location_admin1', 'location_admin2', 'location_locality',
            'location_lat', 'location_lng',
            'original_text', 'original_language', 'original_script', 'translated_text',
            'translation_confidence', 'lingua_fidelity_score',
            'priority', 'confidence_score', 'status',
            'source_name', 'source_tier', 'source_display', 'source_timestamp',
            'reported_cases', 'reported_deaths', 'affected_population',
            'cross_border_risk', 'seasonal_pattern_match',
            'analyst_notes', 'triaged_at', 'validated_at',
            'ingestion_source',
            'ai_classification', 'ai_severity', 'ai_notification_scope',
            'ai_reasoning', 'ai_classified_at',
            'created_at', 'updated_at'
        ]
    
    def get_source_display(self, obj):
        return {
            'name': obj.source_name,
            'tier': obj.source_tier,
            'url': obj.source_url,
            'type': obj.source_type
        }


class SignalDetailSerializer(serializers.ModelSerializer):
    """Full serializer for detail views"""
    source = SourceCredibilitySerializer(read_only=True)
    triaged_by_name = serializers.SerializerMethodField()
    validated_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = Signal
        fields = [
            'id', 'signal_type', 'disease_name', 'disease_category',
            'pillar', 'secondary_pillars',
            'location_country', 'location_country_iso',
            'location_admin1', 'location_admin2', 'location_locality',
            'location_lat', 'location_lng',
            'original_text', 'original_language', 'original_script',
            'translated_text', 'translation_confidence', 'lingua_fidelity_score',
            'source', 'source_tier', 'source_name', 'source_url',
            'source_type', 'source_timestamp',
            'priority', 'confidence_score', 'status',
            'reported_cases', 'reported_deaths', 'affected_population',
            'cross_border_risk', 'seasonal_pattern_match',
            'analyst_notes', 'triaged_by', 'triaged_by_name',
            'triaged_at', 'validated_by', 'validated_by_name', 'validated_at',
            'ingestion_source', 'duplicate_hash', 'raw_payload',
            'ai_classification', 'ai_severity', 'ai_notification_scope',
            'ai_reasoning', 'ai_classified_at',
            'created_at', 'updated_at',
        ]
    
    def get_triaged_by_name(self, obj):
        return obj.triaged_by.email if obj.triaged_by else None
    
    def get_validated_by_name(self, obj):
        return obj.validated_by.email if obj.validated_by else None


class SignalCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating signals from ingestion"""
    class Meta:
        model = Signal
        fields = [
            'signal_type', 'disease_name', 'disease_category',
            'location_country', 'location_country_iso', 'location_admin1', 'location_admin2',
            'location_lat', 'location_lng',
            'original_text', 'original_language', 'translated_text',
            'priority', 'confidence_score', 'status',
            'source_name', 'source_url', 'source_tier', 'source_type', 'source_timestamp',
            'reported_cases', 'reported_deaths',
            'ingestion_source', 'raw_payload'
        ]


class SignalTriageSerializer(serializers.Serializer):
    """Serializer for triage action"""
    priority = serializers.ChoiceField(choices=['P1', 'P2', 'P3', 'P4'])
    confidence_score = serializers.IntegerField(min_value=0, max_value=100)
    analyst_notes = serializers.CharField(required=False, allow_blank=True)


class SignalStatsSerializer(serializers.Serializer):
    """Serializer for signal statistics"""
    total = serializers.IntegerField()
    by_priority = serializers.DictField()
    by_status = serializers.DictField()
    by_country = serializers.ListField(required=False)
