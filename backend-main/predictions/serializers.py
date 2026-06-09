from rest_framework import serializers
from .models import OutbreakPrediction, PredictionModel, Scenario, ScenarioRun


class PredictionModelSerializer(serializers.ModelSerializer):
    class Meta:
        model = PredictionModel
        fields = [
            'id', 'name', 'model_type', 'description', 'weight',
            'accuracy_score', 'last_run', 'is_active',
        ]


class OutbreakPredictionListSerializer(serializers.ModelSerializer):
    """Compact serializer for list views (excludes forecast_data for performance)."""
    source_model_name = serializers.CharField(source='source_model.name', read_only=True, default=None)
    
    class Meta:
        model = OutbreakPrediction
        fields = [
            'id', 'country_iso', 'country_name', 'disease_name',
            'composite_risk_score', 'risk_level',
            'star_score', 'climate_score', 'sentinel_score',
            'espar_score', 'readiness_score',
            'predicted_cases_30d', 'predicted_cases_60d', 'predicted_cases_90d',
            'confidence', 'confidence_lower', 'confidence_upper',
            'climate_drivers', 'data_sources_used',
            'source_model_name', 'prediction_date', 'valid_until',
        ]


class OutbreakPredictionDetailSerializer(serializers.ModelSerializer):
    """Full serializer including forecast_data for detail/chart views."""
    source_model = PredictionModelSerializer(read_only=True)

    class Meta:
        model = OutbreakPrediction
        fields = [
            'id', 'country_iso', 'country_name', 'disease_name',
            'composite_risk_score', 'risk_level',
            'star_score', 'climate_score', 'sentinel_score',
            'espar_score', 'readiness_score',
            'predicted_cases_30d', 'predicted_cases_60d', 'predicted_cases_90d',
            'confidence', 'confidence_lower', 'confidence_upper',
            'forecast_data', 'climate_drivers',
            'source_model', 'prediction_date', 'valid_until',
            'data_sources_used',
        ]


# ─── wbepi Scenario serializers ─────────────────────────────────────


class ScenarioSerializer(serializers.ModelSerializer):
    """Read/write serializer for a saved SEIRDV scenario configuration."""

    created_by_email = serializers.CharField(
        source='created_by.email', read_only=True, default=None,
    )

    class Meta:
        model = Scenario
        fields = [
            'id', 'name', 'description', 'pathogen', 'country_iso',
            'parameters', 'created_by_email',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_by_email', 'created_at', 'updated_at']


class ScenarioRunListSerializer(serializers.ModelSerializer):
    """Compact serializer for list views (omits the heavy output_blob)."""

    scenario_name = serializers.CharField(
        source='scenario.name', read_only=True, default=None,
    )
    duration_seconds = serializers.FloatField(read_only=True)

    class Meta:
        model = ScenarioRun
        fields = [
            'id', 'scenario', 'scenario_name', 'status', 'seed',
            'n_sims', 'time_steps',
            'started_at', 'completed_at', 'duration_seconds',
            'created_at', 'error_message',
        ]
        read_only_fields = fields


class ScenarioRunDetailSerializer(serializers.ModelSerializer):
    """Full serializer including parameters_snapshot, summary, and output_blob."""

    scenario_name = serializers.CharField(
        source='scenario.name', read_only=True, default=None,
    )
    duration_seconds = serializers.FloatField(read_only=True)

    class Meta:
        model = ScenarioRun
        fields = [
            'id', 'scenario', 'scenario_name', 'status', 'seed',
            'parameters_snapshot', 'n_sims', 'time_steps',
            'summary_stats', 'output_blob',
            'started_at', 'completed_at', 'duration_seconds',
            'created_at', 'error_message',
        ]
        read_only_fields = fields


class ScenarioRunRequestSerializer(serializers.Serializer):
    """Inbound payload for triggering an ad-hoc or scenario-bound run.

    Used by the POST /scenarios/{id}/run/ and POST /scenario-runs/adhoc/
    endpoints. Validates seed/parameters at the API boundary; deeper
    validation happens inside the engine itself.
    """

    seed = serializers.IntegerField(required=False, allow_null=True)
    # Override params on a saved scenario (optional). For ad-hoc runs, this
    # is the full parameters dict.
    parameters = serializers.JSONField(required=False)


class ScenarioFitRequestSerializer(serializers.Serializer):
    """Inbound payload for triggering a parameter fit from observed cases."""

    pathogen_id = serializers.CharField(max_length=40, required=True)
    observed_cumulative_cases = serializers.ListField(
        child=serializers.FloatField(), required=True, min_length=4
    )
    time_grid = serializers.ListField(
        child=serializers.FloatField(), required=True, min_length=4
    )
    initial_S = serializers.FloatField(required=True)
    initial_I = serializers.FloatField(required=False, default=1.0)
    n_bootstrap = serializers.IntegerField(required=False, default=200, min_value=0, max_value=1000)

