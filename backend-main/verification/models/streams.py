"""
EBOLA PHEIC TRACK — append-only event log + per-adaptor freshness audit.

These live alongside the four-stage pipeline (capture/match/score/feedback)
but aren't part of it: EbolaEvent is the primary Ebola SSE event log used
for replay-based verification, and SourceAudit tracks adaptor freshness so
verdicts that depended on stale data can be downweighted.
(Change Brief §1, Proposal §7.2.)
"""

from django.db import models


class EbolaEvent(models.Model):
    """
    Append-only log of events from the Outbreak Workspace SSE stream
    (/outbreak/outbreaks/{id}/stream/). Persisted for replay-based
    verification and lead-time scoring (Change Brief §1, Proposal §7.2).

    ~123 events/day during the active PHEIC — this table is the primary
    Ebola event log. NEVER updated after insert.
    """

    EVENT_KINDS = [
        ('sentinel', 'Sentinel signal'),
        ('spillover', 'Spillover risk'),
        ('silence', 'District unusually quiet'),
        ('hcw', 'HCW infection'),
        ('burial', 'Unsafe burial'),
        ('idsr', 'IDSR/DHIS2'),
        ('animal', 'Animal surveillance'),
        ('mobility', 'Mobility'),
        ('other', 'Other'),
    ]

    outbreak_id = models.IntegerField(default=1, db_index=True, help_text='1 = current Ebola BDBV PHEIC.')
    # Stable id from the source event so replays are idempotent.
    event_uid = models.CharField(max_length=120, unique=True, db_index=True)
    event_kind = models.CharField(max_length=20, choices=EVENT_KINDS, db_index=True)

    country_iso = models.CharField(max_length=3, blank=True, default='', db_index=True)
    province = models.CharField(max_length=200, blank=True, default='')
    district = models.CharField(max_length=200, blank=True, default='')

    severity = models.CharField(max_length=20, blank=True, default='')
    summary = models.TextField(blank=True, default='')
    # "Cite or Die" assistant citations ([evt:N], [cap:KEY], [path:FIELD]) for
    # audit trail (Change Brief §1).
    citations = models.JSONField(default=list, blank=True)

    raw_event = models.JSONField(default=dict)
    occurred_at = models.DateTimeField(db_index=True)
    received_at = models.DateTimeField(auto_now_add=True, db_index=True)

    tenant = models.ForeignKey(
        'account.Tenant',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='ebola_events',
    )

    class Meta:
        app_label = 'verification'
        ordering = ['-occurred_at']
        indexes = [
            models.Index(fields=['outbreak_id', 'event_kind', '-occurred_at']),
            models.Index(fields=['country_iso', '-occurred_at']),
        ]

    def __str__(self):
        return f"EbolaEvent[{self.event_kind}] {self.event_uid} @ {self.occurred_at:%Y-%m-%d %H:%M}"


class SourceAudit(models.Model):
    """
    Per-adaptor freshness tracking from /outbreak/.../adaptor-health/
    (Change Brief §1). Stale adaptors (> 2× expected cadence) are flagged as
    coverage gaps that lower the ground-truth confidence of any verdict that
    depended on them. Known-dark adaptors (mobility, deforestation, climate,
    unsafe_burial) are recorded as known gaps, not failures.
    """

    ADAPTORS = [
        ('sentinel_signal', 'sentinel_signal'),
        ('spillover_risk', 'spillover_risk'),
        ('silence', 'silence'),
        ('hcw_infection', 'hcw_infection'),
        ('idsr_dhis2', 'idsr_dhis2'),
        ('animal_surveillance', 'animal_surveillance'),
        ('unsafe_burial', 'unsafe_burial'),
        ('wbepi_forecast', 'wbepi_forecast'),
        ('mobility', 'mobility'),
        ('deforestation', 'deforestation'),
        ('climate', 'climate'),
    ]

    STATUS_LIVE = 'LIVE'
    STATUS_STALE = 'STALE'
    STATUS_KNOWN_GAP = 'KNOWN_GAP'
    STATUS_MISSING = 'MISSING'
    STATUS_CHOICES = [
        (STATUS_LIVE, 'Live'),
        (STATUS_STALE, 'Stale (> 2× cadence)'),
        (STATUS_KNOWN_GAP, 'Known coverage gap'),
        (STATUS_MISSING, 'Missing / not configured'),
    ]

    adaptor = models.CharField(max_length=30, choices=ADAPTORS, db_index=True)
    outbreak_id = models.IntegerField(default=1, db_index=True)
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, db_index=True)

    expected_cadence_hours = models.FloatField(null=True, blank=True)
    last_seen_at = models.DateTimeField(null=True, blank=True)
    staleness_hours = models.FloatField(null=True, blank=True)

    note = models.CharField(max_length=255, blank=True, default='')
    checked_at = models.DateTimeField(auto_now_add=True, db_index=True)

    tenant = models.ForeignKey(
        'account.Tenant',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='source_audits',
    )

    class Meta:
        app_label = 'verification'
        ordering = ['-checked_at']
        indexes = [models.Index(fields=['adaptor', '-checked_at'])]

    def __str__(self):
        return f"SourceAudit[{self.adaptor}] {self.status} @ {self.checked_at:%Y-%m-%d %H:%M}"
