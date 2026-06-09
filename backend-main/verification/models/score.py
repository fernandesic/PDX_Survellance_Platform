"""
STAGE 3 — SCORE

Aggregated accuracy metrics (ScoreCard) and the single 0-100 figure
AFRO leadership can cite (VeracityIndex). (Proposal §3 SCORE, §8.)
"""

from django.db import models

from ._vocab import SOURCE_MODULES


class ScoreCard(models.Model):
    """
    Aggregated accuracy metrics over a verdict population sliced by
    (module × country × disease × period). Recomputed by the scorer.

    Carries the full metric suite from Proposal §3 SCORE: Hit Rate,
    Precision, Recall, F1, False-Alarm Rate, Brier, WIS, mean lead time,
    plus a 0-100 module-level veracity contribution.
    """

    GRANULARITY = [
        ('global', 'PDX-wide'),
        ('module', 'Per module'),
        ('country', 'Per country'),
        ('disease', 'Per disease'),
        ('module_country', 'Module × country'),
        ('module_disease', 'Module × disease'),
    ]

    granularity = models.CharField(max_length=20, choices=GRANULARITY, db_index=True)
    source_module = models.CharField(max_length=20, choices=SOURCE_MODULES, blank=True, default='', db_index=True)
    country_iso = models.CharField(max_length=3, blank=True, default='', db_index=True)
    disease_name = models.CharField(max_length=50, blank=True, default='', db_index=True)

    period_start = models.DateTimeField()
    period_end = models.DateTimeField()

    # Counts.
    n_total = models.IntegerField(default=0)
    n_hit = models.IntegerField(default=0)
    n_partial = models.IntegerField(default=0)
    n_miss = models.IntegerField(default=0)
    n_false_alarm = models.IntegerField(default=0)
    n_pending = models.IntegerField(default=0)
    n_excluded = models.IntegerField(default=0)

    # Metrics (null where the slice has no applicable predictions).
    hit_rate = models.FloatField(null=True, blank=True)
    precision = models.FloatField(null=True, blank=True)
    recall = models.FloatField(null=True, blank=True)
    f1_score = models.FloatField(null=True, blank=True)
    false_alarm_rate = models.FloatField(null=True, blank=True)
    brier_score = models.FloatField(null=True, blank=True)
    wis_mean = models.FloatField(null=True, blank=True)
    cohen_kappa = models.FloatField(null=True, blank=True, help_text='Weighted κ for intervention tier (#7).')
    mean_lead_time_days = models.FloatField(null=True, blank=True)
    reliability = models.JSONField(
        default=list, blank=True,
        help_text='Reliability diagram bins: [{prob_bin, predicted, observed, n}].',
    )

    # 0-100 contribution to the Veracity Index for this slice.
    veracity_contribution = models.FloatField(null=True, blank=True)

    computed_at = models.DateTimeField(auto_now_add=True, db_index=True)

    tenant = models.ForeignKey(
        'account.Tenant',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='score_cards',
    )

    class Meta:
        app_label = 'verification'
        ordering = ['-computed_at']
        indexes = [
            models.Index(fields=['granularity', 'source_module']),
            models.Index(fields=['country_iso', 'disease_name']),
            models.Index(fields=['-computed_at']),
        ]

    def __str__(self):
        slice_ = self.source_module or self.country_iso or self.disease_name or 'global'
        return f"ScoreCard[{self.granularity}:{slice_}] HR={self.hit_rate}"


class VeracityIndex(models.Model):
    """
    The single 0-100 figure AFRO leadership can cite (Proposal §8, success
    criterion #4). One row per module per computation, plus a PDX-wide row.
    """

    LEVEL_MODULE = 'module'
    LEVEL_PLATFORM = 'platform'
    LEVEL_CHOICES = [(LEVEL_MODULE, 'Module'), (LEVEL_PLATFORM, 'PDX platform-wide')]

    level = models.CharField(max_length=12, choices=LEVEL_CHOICES, db_index=True)
    source_module = models.CharField(max_length=20, choices=SOURCE_MODULES, blank=True, default='')

    index_value = models.FloatField(help_text='0-100 composite veracity.')
    n_predictions_scored = models.IntegerField(default=0)
    components = models.JSONField(
        default=dict, blank=True,
        help_text='Breakdown: {hit_rate, precision, brier_skill, wis_skill, lead_time_bonus}.',
    )
    trend_delta = models.FloatField(
        null=True, blank=True,
        help_text='Change vs previous computation — is PDX improving over time?',
    )

    computed_at = models.DateTimeField(auto_now_add=True, db_index=True)

    tenant = models.ForeignKey(
        'account.Tenant',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='veracity_indices',
    )

    class Meta:
        app_label = 'verification'
        ordering = ['-computed_at']
        verbose_name_plural = 'Veracity indices'
        indexes = [models.Index(fields=['level', 'source_module', '-computed_at'])]

    def __str__(self):
        scope = self.source_module if self.level == self.LEVEL_MODULE else 'PDX'
        return f"VeracityIndex[{scope}] = {self.index_value:.1f}"
