from rest_framework import serializers

from .models import (
    PredictionSnapshot, OutcomeEvent, MatchVerdict, ScoreCard,
    VeracityIndex, ReviewTicket, CalibrationRecord, EbolaEvent, SourceAudit,
)


# ─── CAPTURE ────────────────────────────────────────────────────────

class PredictionSnapshotListSerializer(serializers.ModelSerializer):
    """Compact serializer for list views (omits raw_payload for performance)."""

    class Meta:
        model = PredictionSnapshot
        fields = [
            'id', 'source_module', 'prediction_class',
            'country_iso', 'country_name', 'disease_name', 'province',
            'predicted_label', 'predicted_value', 'predicted_probability',
            'horizon_days', 'window_start', 'window_end',
            'model_version', 'computed_at', 'payload_complete',
            'is_counterfactual', 'captured_at',
        ]


class PredictionSnapshotDetailSerializer(serializers.ModelSerializer):
    """Full serializer including raw_payload and fingerprint for audit."""
    is_scorable = serializers.BooleanField(read_only=True)

    class Meta:
        model = PredictionSnapshot
        fields = [
            'id', 'source_module', 'prediction_class',
            'country_iso', 'country_name', 'disease_name', 'province', 'district',
            'predicted_label', 'predicted_value', 'predicted_probability',
            'predicted_interval', 'predicted_ranking',
            'horizon_days', 'window_start', 'window_end',
            'model_version', 'computed_at', 'payload_complete',
            'is_counterfactual', 'scenario_run_id', 'is_scorable',
            'raw_payload', 'payload_fingerprint', 'source_endpoint', 'captured_at',
        ]


class OutcomeEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = OutcomeEvent
        fields = [
            'id', 'outcome_type', 'source_feed',
            'country_iso', 'country_name', 'disease_name', 'province', 'district',
            'observed_label', 'observed_value', 'observed_cases', 'observed_deaths',
            'occurred_at', 'iso_week', 'evidence_url', 'evidence_snapshot_url',
            'collected_at',
        ]


# ─── MATCH ──────────────────────────────────────────────────────────

class MatchVerdictListSerializer(serializers.ModelSerializer):
    source_module = serializers.CharField(source='snapshot.source_module', read_only=True)
    prediction_class = serializers.CharField(source='snapshot.prediction_class', read_only=True)
    country_iso = serializers.CharField(source='snapshot.country_iso', read_only=True)
    disease_name = serializers.CharField(source='snapshot.disease_name', read_only=True)

    class Meta:
        model = MatchVerdict
        fields = [
            'id', 'snapshot', 'verdict',
            'source_module', 'prediction_class', 'country_iso', 'disease_name',
            'lead_time_days', 'created_at', 'matched_at',
        ]


class MatchVerdictDetailSerializer(serializers.ModelSerializer):
    snapshot = PredictionSnapshotListSerializer(read_only=True)
    matched_outcomes = OutcomeEventSerializer(many=True, read_only=True)

    class Meta:
        model = MatchVerdict
        fields = [
            'id', 'snapshot', 'verdict',
            'disease_match', 'geography_match', 'time_match',
            'matched_outcomes', 'lead_time_days',
            'abs_error', 'brier_component', 'wis_component',
            'evidence_note', 'match_detail', 'created_at', 'matched_at',
        ]


# ─── SCORE ──────────────────────────────────────────────────────────

class ScoreCardSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScoreCard
        fields = [
            'id', 'granularity', 'source_module', 'country_iso', 'disease_name',
            'period_start', 'period_end',
            'n_total', 'n_hit', 'n_partial', 'n_miss', 'n_false_alarm',
            'n_pending', 'n_excluded',
            'hit_rate', 'precision', 'recall', 'f1_score', 'false_alarm_rate',
            'brier_score', 'wis_mean', 'cohen_kappa', 'mean_lead_time_days',
            'reliability', 'veracity_contribution', 'computed_at',
        ]


class VeracityIndexSerializer(serializers.ModelSerializer):
    class Meta:
        model = VeracityIndex
        fields = [
            'id', 'level', 'source_module', 'index_value',
            'n_predictions_scored', 'components', 'trend_delta', 'computed_at',
        ]


# ─── FEEDBACK ───────────────────────────────────────────────────────

class ReviewTicketSerializer(serializers.ModelSerializer):
    assigned_to_email = serializers.CharField(
        source='assigned_to.email', read_only=True, default=None,
    )

    class Meta:
        model = ReviewTicket
        fields = [
            'id', 'verdict', 'source_module', 'reason', 'status',
            'title', 'detail', 'country_iso', 'disease_name',
            'assigned_to', 'assigned_to_email', 'resolution_note',
            'opened_at', 'closed_at',
        ]
        read_only_fields = ['id', 'verdict', 'source_module', 'reason',
                            'title', 'detail', 'country_iso', 'disease_name',
                            'opened_at', 'assigned_to_email']


class CalibrationRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = CalibrationRecord
        fields = [
            'id', 'source_module', 'disease_name', 'country_iso',
            'stated_confidence_mean', 'observed_frequency', 'calibration_error',
            'suggested_multiplier', 'suggested_offset', 'is_active',
            'n_samples', 'reliability', 'computed_at',
        ]


# ─── EBOLA TRACK ────────────────────────────────────────────────────

class EbolaEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = EbolaEvent
        fields = [
            'id', 'outbreak_id', 'event_uid', 'event_kind',
            'country_iso', 'province', 'district',
            'severity', 'summary', 'citations',
            'occurred_at', 'received_at',
        ]


class SourceAuditSerializer(serializers.ModelSerializer):
    class Meta:
        model = SourceAudit
        fields = [
            'id', 'adaptor', 'outbreak_id', 'status',
            'expected_cadence_hours', 'last_seen_at', 'staleness_hours',
            'note', 'checked_at',
        ]
