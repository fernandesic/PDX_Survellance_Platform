"""
STAGE 1 — CAPTURE

Immutable, fingerprinted records of:
  * PredictionSnapshot  — every prediction PDX issued at a point in time.
  * OutcomeEvent        — every real-world outcome we observe.

Both are append-only. The MATCH stage compares them.
"""

import hashlib
import json

from django.db import models

from ._vocab import PREDICTION_CLASSES, SOURCE_MODULES


class PredictionSnapshot(models.Model):
    """
    A frozen, immutable copy of one prediction PDX issued at a point in time.

    Per the Developer Change Brief §6 (CRITICAL): every payload MUST carry
    `model_version` and `computed_at`. Snapshots missing these are stored
    with payload_complete=False and flagged — never silently dropped — so the
    gap is visible in backtesting rather than corrupting accuracy figures.

    Counterfactual SEIRDV scenario runs are captured too, but with
    is_counterfactual=True so the MATCH/SCORE stages exclude them
    (Proposal §9, Change Brief §2).
    """

    # ── What was predicted ───────────────────────────────────────
    source_module = models.CharField(max_length=20, choices=SOURCE_MODULES, db_index=True)
    prediction_class = models.CharField(max_length=30, choices=PREDICTION_CLASSES, db_index=True)

    country_iso = models.CharField(max_length=3, db_index=True)
    country_name = models.CharField(max_length=100, blank=True, default='')
    disease_name = models.CharField(max_length=50, db_index=True, blank=True, default='')
    # Optional sub-geography for province/district-level classes (#6, #9).
    province = models.CharField(max_length=200, blank=True, default='')
    district = models.CharField(max_length=200, blank=True, default='')

    # ── The predicted value (polymorphic) ────────────────────────
    # Categorical predictions (risk_level, intervention_tier, imminent_class).
    predicted_label = models.CharField(max_length=50, blank=True, default='')
    # Point predictions (case_count, spillover_rank).
    predicted_value = models.FloatField(null=True, blank=True)
    # Probability forecasts (climate_confidence, spillover_probability) — for
    # Brier / reliability scoring. Stored 0-1.
    predicted_probability = models.FloatField(null=True, blank=True)
    # Interval forecasts (epi_curve_wis): {"q": {"0.025": .., "0.5": .., ...}}.
    predicted_interval = models.JSONField(default=dict, blank=True)
    # Ranked lists (spillover_rank, province_distribution): ordered structure.
    predicted_ranking = models.JSONField(default=list, blank=True)

    # ── Prediction window (the MATCH stage's time axis) ───────────
    horizon_days = models.IntegerField(null=True, blank=True, help_text='Forecast horizon, e.g. 30/60/90.')
    window_start = models.DateTimeField(db_index=True)
    window_end = models.DateTimeField(db_index=True, help_text='Prediction is judged once this passes.')

    # ── Provenance (Change Brief §6 CRITICAL) ────────────────────
    model_version = models.CharField(max_length=100, blank=True, default='')
    computed_at = models.DateTimeField(null=True, blank=True)
    payload_complete = models.BooleanField(
        default=True,
        help_text='False if model_version/computed_at were missing — excluded from honest backtests.',
    )

    # Counterfactual segregation (Change Brief §2, Proposal §9).
    is_counterfactual = models.BooleanField(
        default=False, db_index=True,
        help_text='True for SEIRDV scenario-run payloads. Excluded from forecast scoring.',
    )
    scenario_run_id = models.IntegerField(
        null=True, blank=True,
        help_text='predictions.ScenarioRun id if this is a counterfactual capture.',
    )

    # ── Immutability: raw payload + tamper-proof fingerprint ──────
    raw_payload = models.JSONField(default=dict, help_text='Verbatim source payload — never edited.')
    payload_fingerprint = models.CharField(
        max_length=64, db_index=True,
        help_text='SHA-256 of the canonicalised payload. Detects post-hoc tampering.',
    )
    source_endpoint = models.CharField(max_length=255, blank=True, default='')

    captured_at = models.DateTimeField(auto_now_add=True, db_index=True)

    # ── Multi-tenancy (RLS) ──────────────────────────────────────
    tenant = models.ForeignKey(
        'account.Tenant',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='prediction_snapshots',
        help_text='Country tenant for RLS (populated from country_iso).',
    )

    class Meta:
        app_label = 'verification'
        ordering = ['-captured_at']
        indexes = [
            models.Index(fields=['source_module', 'prediction_class']),
            models.Index(fields=['country_iso', 'disease_name']),
            models.Index(fields=['window_end', 'is_counterfactual']),
            models.Index(fields=['payload_fingerprint']),
        ]

    def __str__(self):
        cf = ' [COUNTERFACTUAL]' if self.is_counterfactual else ''
        return f"{self.source_module}/{self.prediction_class} {self.country_iso} {self.disease_name}{cf}"

    @staticmethod
    def compute_fingerprint(payload: dict) -> str:
        """SHA-256 over a canonical (sorted-key) JSON serialisation."""
        canonical = json.dumps(payload, sort_keys=True, separators=(',', ':'), default=str)
        return hashlib.sha256(canonical.encode('utf-8')).hexdigest()

    def save(self, *args, **kwargs):
        # Fingerprint on first write; provenance completeness check.
        if not self.payload_fingerprint and self.raw_payload:
            self.payload_fingerprint = self.compute_fingerprint(self.raw_payload)
        if not (self.model_version and self.computed_at):
            self.payload_complete = False
        super().save(*args, **kwargs)

    @property
    def is_scorable(self) -> bool:
        """Eligible for SCORE stage: real forecast, complete provenance."""
        return self.payload_complete and not self.is_counterfactual


class OutcomeEvent(models.Model):
    """
    A real-world outcome collected in parallel with predictions: an observed
    outbreak, a WHO DON declaration, a verified Live-Feed signal, an Ebola
    epi-curve data point, an HDIS briefing, a confirmed DHIS2 reporting gap.

    These are the ground truth the MATCH stage compares predictions against.
    Like snapshots, they are immutable and fingerprinted (Proposal §3, CAPTURE).
    """

    OUTCOME_TYPES = [
        ('outbreak_confirmed', 'Outbreak confirmed'),
        ('who_don', 'WHO Disease Outbreak News declaration'),
        ('pheic_declared', 'PHEIC declaration'),
        ('case_observation', 'Observed case/death count'),
        ('cross_border_import', 'Cross-border importation event'),
        ('hcw_infection', 'HCW infection confirmed'),
        ('unsafe_burial', 'Unsafe burial confirmed'),
        ('dhis2_gap', 'Confirmed DHIS2 reporting gap'),
        ('intervention_action', 'Intervention recorded (HDIS/Decision Log)'),
        ('first_human_case', 'First human case (spillover realised)'),
        ('live_feed_signal', 'Verified Live-Feed signal'),
    ]

    SOURCE_FEEDS = [
        ('live_feed', 'PDX Live Feed / alerts-v2'),
        ('outbreak_epicurve', 'Outbreak Workspace epi-curve'),
        ('outbreak_events', 'Outbreak Workspace event stream'),
        ('hdis', 'HDIS alerts & briefings'),
        ('who_don', 'WHO DON (external)'),
        ('decision_log', 'Outbreak Ops decision log'),
        ('dhis2', 'AFRO DHIS2 submission log'),
        ('manual', 'Manual / epidemiologist entry'),
    ]

    outcome_type = models.CharField(max_length=30, choices=OUTCOME_TYPES, db_index=True)
    source_feed = models.CharField(max_length=30, choices=SOURCE_FEEDS, db_index=True)

    country_iso = models.CharField(max_length=3, db_index=True)
    country_name = models.CharField(max_length=100, blank=True, default='')
    disease_name = models.CharField(max_length=50, db_index=True, blank=True, default='')
    province = models.CharField(max_length=200, blank=True, default='')
    district = models.CharField(max_length=200, blank=True, default='')

    # Observed values.
    observed_label = models.CharField(max_length=50, blank=True, default='')
    observed_value = models.FloatField(null=True, blank=True)
    observed_cases = models.IntegerField(null=True, blank=True)
    observed_deaths = models.IntegerField(null=True, blank=True)

    # When the real-world event actually occurred (the time axis for matching).
    occurred_at = models.DateTimeField(db_index=True)
    # ISO week alignment for epi-curve / climate windows.
    iso_week = models.CharField(max_length=8, blank=True, default='')

    # Evidence so a human can audit any verdict (Proposal §3 MATCH).
    evidence_url = models.URLField(blank=True, default='')
    evidence_snapshot_url = models.URLField(
        blank=True, default='',
        help_text='Wayback Machine / local archive of the evidence at observation time.',
    )
    raw_payload = models.JSONField(default=dict)
    payload_fingerprint = models.CharField(max_length=64, db_index=True, blank=True, default='')

    collected_at = models.DateTimeField(auto_now_add=True, db_index=True)

    tenant = models.ForeignKey(
        'account.Tenant',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='outcome_events',
        help_text='Country tenant for RLS (populated from country_iso).',
    )

    class Meta:
        app_label = 'verification'
        ordering = ['-occurred_at']
        indexes = [
            models.Index(fields=['outcome_type', 'country_iso']),
            models.Index(fields=['country_iso', 'disease_name', 'occurred_at']),
            models.Index(fields=['occurred_at']),
        ]

    def __str__(self):
        return f"{self.outcome_type} {self.country_iso} {self.disease_name} @ {self.occurred_at:%Y-%m-%d}"

    def save(self, *args, **kwargs):
        if not self.payload_fingerprint and self.raw_payload:
            self.payload_fingerprint = PredictionSnapshot.compute_fingerprint(self.raw_payload)
        super().save(*args, **kwargs)
