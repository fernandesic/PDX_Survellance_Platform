"""
Predictions App - Composite Outbreak Risk Models
Combines STAR Tracker, Climate Risk, Sentinel Signals, e-SPAR, and Readiness data
into a unified composite risk score per country-disease combination.

Also hosts the Scenario / ScenarioRun models that back the wbepi_engine
counterfactual scenario simulator (see predictions/scenarios/wbepi_engine/).
"""

from django.conf import settings
from django.db import models


class PredictionModel(models.Model):
    """Tracks each data source / model contributing to the composite score."""
    
    MODEL_TYPES = [
        ('STAR', 'STAR Seasonal Risk'),
        ('CLIMATE', 'Climate-AI Disease Risk'),
        ('SENTINEL', 'Sentinel Signal Intelligence'),
        ('ESPAR', 'e-SPAR Capacity (Inverse)'),
        ('READINESS', 'Readiness Preparedness (Inverse)'),
        ('COMPOSITE', 'Composite Ensemble'),
    ]
    
    name = models.CharField(max_length=100, unique=True)
    model_type = models.CharField(max_length=20, choices=MODEL_TYPES)
    description = models.TextField(blank=True)
    weight = models.FloatField(default=0.2, help_text="Weight in composite score (0-1)")
    accuracy_score = models.FloatField(null=True, blank=True, help_text="Model accuracy 0-100")
    last_run = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-weight']
    
    def __str__(self):
        return f"{self.name} ({self.model_type}) - weight: {self.weight}"


class OutbreakPrediction(models.Model):
    """Composite outbreak risk prediction per country-disease combo."""
    
    RISK_LEVELS = [
        ('LOW', 'Low'),
        ('MEDIUM', 'Medium'),
        ('HIGH', 'High'),
        ('CRITICAL', 'Critical'),
    ]
    
    DISEASES = [
        ('cholera', 'Cholera'),
        ('mpox', 'Mpox'),
        ('malaria', 'Malaria'),
        ('meningitis', 'Meningitis'),
        ('ebola', 'Ebola'),
        ('marburg', 'Marburg'),
        ('lassa_fever', 'Lassa Fever'),
        ('rift_valley_fever', 'Rift Valley Fever'),
        ('measles', 'Measles'),
        ('yellow_fever', 'Yellow Fever'),
    ]
    
    # Country identification
    country_iso = models.CharField(max_length=3, db_index=True)
    country_name = models.CharField(max_length=100)
    
    # Disease
    disease_name = models.CharField(max_length=50, db_index=True)
    
    # Composite risk
    composite_risk_score = models.FloatField(help_text="Weighted composite 0-100")
    risk_level = models.CharField(max_length=10, choices=RISK_LEVELS)
    
    # Component scores (real data from each source)
    star_score = models.FloatField(default=0, help_text="STAR Tracker hazard risk 0-100")
    climate_score = models.FloatField(default=0, help_text="Climate disease risk 0-100")
    sentinel_score = models.FloatField(default=0, help_text="Sentinel signal density 0-100")
    espar_score = models.FloatField(default=0, help_text="e-SPAR vulnerability (inverse) 0-100")
    readiness_score = models.FloatField(default=0, help_text="Readiness gap (inverse) 0-100")
    
    # Predictions (30/60/90 day horizons)
    predicted_cases_30d = models.IntegerField(default=0)
    predicted_cases_60d = models.IntegerField(default=0)
    predicted_cases_90d = models.IntegerField(default=0)
    
    # Confidence
    confidence = models.FloatField(default=50, help_text="Prediction confidence 0-100")
    confidence_lower = models.FloatField(default=0, help_text="Lower prediction interval")
    confidence_upper = models.FloatField(default=0, help_text="Upper prediction interval")
    
    # Forecast time-series (90 days, mocked from STAR seasonality)
    forecast_data = models.JSONField(
        default=list, blank=True,
        help_text="Array of {date, predicted, lower, upper} for 90 days"
    )
    
    # Contributing factors
    climate_drivers = models.JSONField(default=list, blank=True)
    
    # Source model
    source_model = models.ForeignKey(
        PredictionModel, on_delete=models.SET_NULL, 
        null=True, blank=True, related_name='predictions'
    )
    
    # Timestamps
    prediction_date = models.DateTimeField(auto_now_add=True)
    valid_until = models.DateTimeField(null=True, blank=True)
    
    # Data provenance
    data_sources_used = models.JSONField(
        default=list, blank=True,
        help_text="List of source names that had data for this prediction"
    )

    # ── Multi-tenancy (Phase 2.3) ────────────────────────────────
    # Populated from country_iso field (direct ISO3 → Tenant).
    tenant = models.ForeignKey(
        'account.Tenant',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='outbreak_predictions',
        help_text='Country tenant for RLS (populated from country_iso).',
    )

    class Meta:
        ordering = ['-composite_risk_score']
        indexes = [
            models.Index(fields=['country_iso', 'disease_name']),
            models.Index(fields=['-composite_risk_score']),
            models.Index(fields=['risk_level']),
        ]
        # One prediction per country-disease combo (latest overwrites)
        unique_together = ('country_iso', 'disease_name')
    
    def __str__(self):
        return f"{self.country_name} - {self.disease_name}: {self.risk_level} ({self.composite_risk_score:.0f})"
    
    @staticmethod
    def score_to_risk_level(score):
        """Convert numeric score to risk level."""
        if score >= 75:
            return 'CRITICAL'
        elif score >= 50:
            return 'HIGH'
        elif score >= 25:
            return 'MEDIUM'
        return 'LOW'


class ForecastData(models.Model):
    """
    Stores raw forecast/prediction CSV data in the database.
    Replaces direct file reads of:
      - DRC_Cholera_Master_Cleaned_Weather.csv (national + regional)
      - MOZ_National_Cumulative_Predictions.csv (national)
      - MOZ_District_Summary.csv (district summary / intervention plan)
    """

    DATA_TYPES = [
        ('national', 'National Forecast'),
        ('regional', 'Regional Forecast'),
        ('district_summary', 'District Summary'),
    ]

    # Country
    country_iso = models.CharField(max_length=3, db_index=True)
    country_name = models.CharField(max_length=100)
    disease = models.CharField(max_length=50, default='cholera')

    # Data classification
    data_type = models.CharField(max_length=20, choices=DATA_TYPES, db_index=True)

    # Time-series
    date = models.DateField(null=True, blank=True)

    # Geography (for regional / district data)
    province = models.CharField(max_length=200, null=True, blank=True, db_index=True)
    district = models.CharField(max_length=200, null=True, blank=True)

    # Epidemiological data
    cases = models.IntegerField(default=0)
    deaths = models.IntegerField(default=0)
    cumulative_cases = models.IntegerField(null=True, blank=True)
    cumulative_deaths = models.IntegerField(null=True, blank=True)

    # District summary fields (MOZ intervention plan)
    risk_level = models.CharField(max_length=20, null=True, blank=True)
    action_required = models.CharField(max_length=200, null=True, blank=True)

    # Weather data (from DRC Master CSV)
    temperature = models.FloatField(null=True, blank=True)
    rainfall = models.FloatField(null=True, blank=True)

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)

    # ── Multi-tenancy (Phase 2.3) ────────────────────────────────
    # Populated from country_iso field (direct ISO3 → Tenant).
    tenant = models.ForeignKey(
        'account.Tenant',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='forecast_data',
        help_text='Country tenant for RLS (populated from country_iso).',
    )

    class Meta:
        ordering = ['country_iso', 'date']
        indexes = [
            models.Index(fields=['country_iso', 'data_type', 'date']),
            models.Index(fields=['country_iso', 'province', 'date']),
        ]

    def __str__(self):
        return f"{self.country_iso} {self.data_type} {self.date or self.district}"


# ─── Counterfactual Scenario Engine (wbepi) ─────────────────────────
# Persistence layer for the SEIRDV counterfactual scenario simulator
# (predictions/scenarios/wbepi_engine/). A Scenario is a reusable
# parameter set; a ScenarioRun is one stochastic execution of it.


class Scenario(models.Model):
    """User-defined SEIRDV scenario configuration.

    A Scenario captures the inputs to ``run_seirdv`` (parameters, initial
    state, intervention knobs, time horizon, n_sims). It is reusable —
    multiple ``ScenarioRun`` rows can be produced from one Scenario.

    Tenant-scoped via Row-Level Security (see migration 0006).
    """

    PATHOGEN_CHOICES = [
        ('cholera', 'Cholera'),
        ('mpox', 'Mpox'),
        ('measles', 'Measles'),
        ('meningitis', 'Meningitis'),
        ('ebola', 'Ebola'),
        ('marburg', 'Marburg'),
        ('lassa_fever', 'Lassa Fever'),
        ('rift_valley_fever', 'Rift Valley Fever'),
        ('yellow_fever', 'Yellow Fever'),
        ('other', 'Other / Custom'),
    ]

    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, default='')
    pathogen = models.CharField(max_length=40, choices=PATHOGEN_CHOICES, db_index=True)
    country_iso = models.CharField(max_length=3, db_index=True, blank=True, default='')

    # Single JSON blob holding every kwarg accepted by run_seirdv. Schema is
    # validated at the serializer / engine boundary, not at the DB layer.
    parameters = models.JSONField(
        default=dict,
        help_text='Inputs to run_seirdv: beta, sigma, gamma, mu, ini_S, ini_I, time, n_sims, ...',
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='scenarios',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    tenant = models.ForeignKey(
        'account.Tenant',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='wbepi_scenarios',
        help_text='Country tenant for RLS scoping.',
    )

    class Meta:
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['pathogen', 'country_iso']),
        ]

    def __str__(self):
        return f"{self.name} ({self.pathogen}/{self.country_iso or 'global'})"


class ScenarioRun(models.Model):
    """One stochastic execution of a Scenario.

    Captures a frozen snapshot of the parameters used (since the parent
    Scenario can be edited later), the RNG seed, run status, and a JSON
    summary plus optional inline output. Large outputs should be offloaded
    to object storage in a later phase; for Phase 2A the default n_sims and
    time horizons fit comfortably in JSONB.
    """

    STATUS_PENDING = 'PENDING'
    STATUS_RUNNING = 'RUNNING'
    STATUS_SUCCESS = 'SUCCESS'
    STATUS_FAILED = 'FAILED'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_RUNNING, 'Running'),
        (STATUS_SUCCESS, 'Success'),
        (STATUS_FAILED, 'Failed'),
    ]

    scenario = models.ForeignKey(
        Scenario,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='runs',
        help_text='Source scenario; null for ad-hoc runs not tied to a saved scenario.',
    )

    status = models.CharField(
        max_length=12, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True,
    )
    seed = models.BigIntegerField(null=True, blank=True)

    parameters_snapshot = models.JSONField(
        default=dict,
        help_text='Frozen copy of the run_seirdv kwargs used for this run.',
    )
    n_sims = models.IntegerField(default=1)
    time_steps = models.IntegerField(default=1)

    summary_stats = models.JSONField(
        default=dict, blank=True,
        help_text='Aggregated stats: per-pop median final attack rate, peak time, total deaths CI, ...',
    )
    output_blob = models.JSONField(
        null=True, blank=True,
        help_text='Long-format output rows (sim, step, S[1]..status[n]). Null if offloaded.',
    )

    error_message = models.TextField(blank=True, default='')

    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='scenario_runs',
    )

    tenant = models.ForeignKey(
        'account.Tenant',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='wbepi_scenario_runs',
        help_text='Country tenant for RLS scoping.',
    )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['scenario', '-created_at']),
            models.Index(fields=['status', '-created_at']),
        ]

    def __str__(self):
        sc = self.scenario.name if self.scenario_id else 'ad-hoc'
        return f"Run {self.pk} [{self.status}] of {sc}"

    @property
    def duration_seconds(self) -> float | None:
        if not (self.started_at and self.completed_at):
            return None
        return (self.completed_at - self.started_at).total_seconds()
