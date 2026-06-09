"""
STAGE 2 — MATCH

The three-axis decision (disease? geography? time window?) for one
PredictionSnapshot, recording the verdict and the OutcomeEvent(s) that
decided it. (Proposal §3 MATCH.)
"""

from django.db import models

from .capture import OutcomeEvent, PredictionSnapshot


class MatchVerdict(models.Model):
    """
    The outcome of the three-axis match (disease? geography? time window?)
    for one PredictionSnapshot, with stored evidence for human audit.

    Verdicts: Confirmed Hit / Partial Hit / Miss / False Alarm / Pending.
    (Proposal §3 MATCH.) Counterfactual snapshots are never matched.
    """

    VERDICT_PENDING = 'PENDING'
    VERDICT_HIT = 'HIT'
    VERDICT_PARTIAL = 'PARTIAL'
    VERDICT_MISS = 'MISS'
    VERDICT_FALSE_ALARM = 'FALSE_ALARM'
    VERDICT_EXCLUDED = 'EXCLUDED'  # counterfactual / incomplete provenance
    VERDICT_CHOICES = [
        (VERDICT_PENDING, 'Pending — window still open'),
        (VERDICT_HIT, 'Confirmed Hit'),
        (VERDICT_PARTIAL, 'Partial Hit'),
        (VERDICT_MISS, 'Miss'),
        (VERDICT_FALSE_ALARM, 'False Alarm'),
        (VERDICT_EXCLUDED, 'Excluded from scoring'),
    ]

    snapshot = models.OneToOneField(
        PredictionSnapshot, on_delete=models.CASCADE, related_name='verdict',
    )
    verdict = models.CharField(
        max_length=12, choices=VERDICT_CHOICES, default=VERDICT_PENDING, db_index=True,
    )

    # Three-axis match results.
    disease_match = models.BooleanField(null=True, blank=True)
    geography_match = models.BooleanField(null=True, blank=True)
    time_match = models.BooleanField(null=True, blank=True)

    # The outcome(s) that decided the verdict (M2M — a hit may rest on several).
    matched_outcomes = models.ManyToManyField(
        OutcomeEvent, blank=True, related_name='verdicts',
    )

    # Lead time: signal date minus realised/declared date. Negative = PDX was
    # early (good). Central Ebola metric (Change Brief §3, Proposal §7.3).
    lead_time_days = models.FloatField(null=True, blank=True)

    # Per-verdict error contribution (filled where applicable; rolled up at SCORE).
    abs_error = models.FloatField(null=True, blank=True, help_text='|predicted - observed| for point classes.')
    brier_component = models.FloatField(null=True, blank=True, help_text='(p - outcome)^2 for probability classes.')
    wis_component = models.FloatField(null=True, blank=True, help_text='Weighted Interval Score for interval classes.')

    # Human-auditable trail.
    evidence_note = models.TextField(blank=True, default='')
    match_detail = models.JSONField(
        default=dict, blank=True,
        help_text='Structured trace: which axis passed/failed and why.',
    )

    matched_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    tenant = models.ForeignKey(
        'account.Tenant',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='match_verdicts',
    )

    class Meta:
        app_label = 'verification'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['verdict', '-created_at']),
        ]

    def __str__(self):
        return f"Verdict[{self.verdict}] for {self.snapshot_id}"

    @property
    def is_positive_prediction(self) -> bool:
        """A prediction that asserted something would happen (for FA/precision)."""
        return self.snapshot.prediction_class in {
            'imminent_class', 'alert_cluster', 'spillover_probability', 'risk_level',
        }
