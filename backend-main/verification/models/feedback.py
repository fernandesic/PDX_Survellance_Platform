"""
STAGE 4 — FEEDBACK

Closes the loop: auto-opens ReviewTicket on significant Misses /
False Alarms, and emits CalibrationRecord knobs PDX modules consume
to auto-adjust their own confidence outputs.
(Proposal §3 FEEDBACK, success criteria #2 and #3.)
"""

from django.conf import settings
from django.db import models
from django.utils import timezone

from ._vocab import SOURCE_MODULES
from .match import MatchVerdict


class ReviewTicket(models.Model):
    """
    Auto-opened when a prediction closes as a significant Miss or False Alarm
    (Proposal §3 FEEDBACK, success criterion #2: within 24h of window close).
    Routed to the owning module's reviewer.
    """

    STATUS_OPEN = 'OPEN'
    STATUS_ACK = 'ACKNOWLEDGED'
    STATUS_RESOLVED = 'RESOLVED'
    STATUS_WONTFIX = 'WONTFIX'
    STATUS_CHOICES = [
        (STATUS_OPEN, 'Open'),
        (STATUS_ACK, 'Acknowledged'),
        (STATUS_RESOLVED, 'Resolved'),
        (STATUS_WONTFIX, "Won't fix"),
    ]

    REASON_MISS = 'MISS'
    REASON_FALSE_ALARM = 'FALSE_ALARM'
    REASON_CALIBRATION = 'CALIBRATION_DRIFT'
    REASON_DATA_GAP = 'DATA_GAP'
    REASON_CHOICES = [
        (REASON_MISS, 'Significant miss'),
        (REASON_FALSE_ALARM, 'False alarm'),
        (REASON_CALIBRATION, 'Systematic calibration drift'),
        (REASON_DATA_GAP, 'Ground-truth data gap'),
    ]

    verdict = models.ForeignKey(
        MatchVerdict, on_delete=models.CASCADE, null=True, blank=True, related_name='tickets',
    )
    source_module = models.CharField(max_length=20, choices=SOURCE_MODULES, db_index=True)
    reason = models.CharField(max_length=20, choices=REASON_CHOICES, db_index=True)
    status = models.CharField(max_length=14, choices=STATUS_CHOICES, default=STATUS_OPEN, db_index=True)

    title = models.CharField(max_length=255)
    detail = models.TextField(blank=True, default='')

    country_iso = models.CharField(max_length=3, blank=True, default='', db_index=True)
    disease_name = models.CharField(max_length=50, blank=True, default='')

    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='verification_tickets',
    )
    resolution_note = models.TextField(blank=True, default='')

    opened_at = models.DateTimeField(auto_now_add=True, db_index=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    tenant = models.ForeignKey(
        'account.Tenant',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='review_tickets',
    )

    class Meta:
        app_label = 'verification'
        ordering = ['-opened_at']
        indexes = [
            models.Index(fields=['status', 'source_module']),
            models.Index(fields=['reason', '-opened_at']),
        ]

    def __str__(self):
        return f"[{self.status}] {self.source_module}: {self.title}"

    def close(self, status=STATUS_RESOLVED, note=''):
        self.status = status
        self.resolution_note = note
        self.closed_at = timezone.now()
        self.save(update_fields=['status', 'resolution_note', 'closed_at'])


class CalibrationRecord(models.Model):
    """
    The output of the Calibration API (Proposal §3 FEEDBACK, success
    criterion #3). PDX modules query the latest record for a
    (module × disease) slice to auto-adjust their confidence outputs based on
    verified accuracy history.

    e.g. if a module's stated 90% confidence predictions only verify 60% of
    the time, suggested_multiplier < 1 nudges its outputs back toward reality.
    """

    source_module = models.CharField(max_length=20, choices=SOURCE_MODULES, db_index=True)
    disease_name = models.CharField(max_length=50, blank=True, default='', db_index=True)
    country_iso = models.CharField(max_length=3, blank=True, default='', db_index=True)

    # Reliability summary the adjustment is derived from.
    stated_confidence_mean = models.FloatField(null=True, blank=True)
    observed_frequency = models.FloatField(null=True, blank=True)
    calibration_error = models.FloatField(
        null=True, blank=True, help_text='Mean |stated - observed| across bins (ECE).',
    )

    # The actionable knob the module consumes.
    suggested_multiplier = models.FloatField(
        default=1.0, help_text='Confidence scaling factor: <1 overconfident, >1 underconfident.',
    )
    suggested_offset = models.FloatField(default=0.0)
    is_active = models.BooleanField(default=True, db_index=True)
    n_samples = models.IntegerField(default=0)

    reliability = models.JSONField(default=list, blank=True)
    computed_at = models.DateTimeField(auto_now_add=True, db_index=True)

    tenant = models.ForeignKey(
        'account.Tenant',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='calibration_records',
    )

    class Meta:
        app_label = 'verification'
        ordering = ['-computed_at']
        indexes = [
            models.Index(fields=['source_module', 'disease_name', 'is_active']),
        ]

    def __str__(self):
        return f"Calibration[{self.source_module}/{self.disease_name or 'all'}] ×{self.suggested_multiplier:.2f}"
