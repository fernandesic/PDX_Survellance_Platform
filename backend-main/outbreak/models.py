"""
Outbreak Workspace — Core Models

Per arc.md: OutbreakEvent is append-only, immutable, never deleted.
PII discipline enforced at model layer via clean() validators.
"""

import logging

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone

logger = logging.getLogger(__name__)


# ─── Enums ──────────────────────────────────────────────────────────


class OutbreakStatus(models.TextChoices):
    SUSPECTED = 'suspected', 'Suspected'
    CONFIRMED = 'confirmed', 'Confirmed'
    CONTAINED = 'contained', 'Contained'
    CLOSED = 'closed', 'Closed'


class EventKind(models.TextChoices):
    """
    Every OutbreakEvent has exactly one kind.
    Adaptors declare which kinds they emit in `kinds_emitted`.
    """
    SIGNAL = 'signal', 'Signal'
    CASE = 'case', 'Case'
    CONTACT = 'contact', 'Contact'
    LAB = 'lab', 'Lab Result'
    INTERVENTION = 'intervention', 'Intervention'
    RESOURCE = 'resource', 'Resource'
    MOBILITY = 'mobility', 'Mobility'
    FORECAST = 'forecast', 'Forecast'
    DECISION = 'decision', 'Decision'
    NOTIFICATION = 'notification', 'Notification'
    RUMOR = 'rumor', 'Rumor'
    BURIAL = 'burial', 'Unsafe Burial'
    HCW_INFECTION = 'hcw_infection', 'HCW Infection'
    SILENCE_ANOMALY = 'silence_anomaly', 'Silence Anomaly'
    RING_VAX = 'ring_vax', 'Ring Vaccination'


class OutbreakSeverity(models.TextChoices):
    LOW = 'low', 'Low'
    MODERATE = 'moderate', 'Moderate'
    HIGH = 'high', 'High'
    CRITICAL = 'critical', 'Critical'


# ─── Pathogen ───────────────────────────────────────────────────────


class Pathogen(models.Model):
    """
    Reference card for a pathogen. Seeded from
    onehealth/spillover_engine.py PATHOGEN_PROFILES.

    One row per pathogen, not per strain — strain differentiation
    is captured in profile_json.
    """
    name = models.CharField(
        max_length=200, unique=True,
        help_text='e.g. "Ebola Virus Disease"',
    )
    family = models.CharField(
        max_length=100, default='',
        help_text='e.g. "Filoviridae"',
    )
    r0_min = models.DecimalField(
        max_digits=4, decimal_places=2, default=0,
        validators=[MinValueValidator(0)],
        help_text='Lower bound of basic reproduction number',
    )
    r0_max = models.DecimalField(
        max_digits=4, decimal_places=2, default=0,
        validators=[MinValueValidator(0)],
        help_text='Upper bound of basic reproduction number',
    )
    cfr_min = models.DecimalField(
        max_digits=5, decimal_places=2, default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text='Case fatality rate lower bound (%)',
    )
    cfr_max = models.DecimalField(
        max_digits=5, decimal_places=2, default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text='Case fatality rate upper bound (%)',
    )
    incubation_days_min = models.PositiveIntegerField(
        default=0,
        help_text='Minimum incubation period in days',
    )
    incubation_days_max = models.PositiveIntegerField(
        default=0,
        help_text='Maximum incubation period in days',
    )
    transmission_modes = models.JSONField(
        default=list,
        help_text='List of transmission modes, e.g. ["contact", "droplet", "fomite"]',
    )
    vaccine_available = models.BooleanField(
        default=False,
        help_text='Whether an approved vaccine exists for this pathogen',
    )
    antiviral_available = models.BooleanField(
        default=False,
        help_text='Whether approved antivirals/therapeutics exist',
    )
    profile_json = models.JSONField(
        default=dict,
        help_text=(
            'Extended profile: strain variants, natural hosts, '
            'reservoir species, trigger conditions, spillover score, '
            'IHR/OIE status, etc.'
        ),
    )
    monitor_widgets = models.JSONField(
        default=list,
        help_text=(
            'List of widget keys the Now pane should render for this '
            'pathogen, e.g. ["capacity", "burial", "hcw", "spillover", '
            '"deforestation"]. Drives the Pathogen-driven dashboard (T-110).'
        ),
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name

    def clean(self):
        super().clean()
        errors = {}
        if self.r0_min and self.r0_max and self.r0_min > self.r0_max:
            errors['r0_max'] = 'r0_max must be greater than or equal to r0_min.'
        if self.cfr_min and self.cfr_max and self.cfr_min > self.cfr_max:
            errors['cfr_max'] = 'cfr_max must be greater than or equal to cfr_min.'
        if (
            self.incubation_days_min and self.incubation_days_max
            and self.incubation_days_min > self.incubation_days_max
        ):
            errors['incubation_days_max'] = (
                'incubation_days_max must be greater than or equal to incubation_days_min.'
            )
        if errors:
            raise ValidationError(errors)


# ─── Outbreak ───────────────────────────────────────────────────────


class Outbreak(models.Model):
    """
    The root object. One per active outbreak (pathogen × geography).
    """
    pathogen = models.ForeignKey(
        Pathogen, on_delete=models.PROTECT,
        related_name='outbreaks',
    )
    iso3 = models.CharField(
        max_length=3,
        help_text='ISO 3166-1 alpha-3 for the primary affected country',
    )
    regions = models.JSONField(
        default=list,
        help_text='List of affected admin-1/admin-2 region identifiers',
    )
    declared_at = models.DateTimeField(
        default=timezone.now,
        help_text='When the outbreak was declared or first detected',
    )
    status = models.CharField(
        max_length=20,
        choices=OutbreakStatus.choices,
        default=OutbreakStatus.SUSPECTED,
    )
    severity = models.CharField(
        max_length=20,
        choices=OutbreakSeverity.choices,
        default=OutbreakSeverity.MODERATE,
    )
    lead_focal_point = models.CharField(
        max_length=200, default='',
        help_text='Name or role of the lead focal point',
    )
    summary = models.TextField(
        default='',
        help_text='Brief narrative summary of the outbreak situation',
    )
    # Neighbor countries at risk — auto-populated or manually set
    neighbor_iso3s = models.JSONField(
        default=list,
        help_text='ISO3 codes of neighboring countries to monitor for spillover',
    )
    # ── Authoritative case/death counts ──
    # Source: Ministry of Health / WHO DON sitrep. Manually entered by the
    # focal point (or via a future MinistrySitrepAdaptor). These are what the
    # banner displays as headline numbers — NOT the summed signal payloads,
    # which double-count because news articles restate cumulative totals.
    confirmed_cases = models.PositiveIntegerField(
        null=True, blank=True,
        help_text='Authoritative confirmed + probable case count from Ministry/WHO sitrep.',
    )
    confirmed_deaths = models.PositiveIntegerField(
        null=True, blank=True,
        help_text='Authoritative death count from Ministry/WHO sitrep.',
    )
    confirmed_as_of = models.DateTimeField(
        null=True, blank=True,
        help_text='Date of the sitrep these numbers come from.',
    )
    confirmed_source = models.CharField(
        max_length=300, default='',
        help_text='Citation for the confirmed numbers, e.g. "WHO DON 2026-05-15" or sitrep URL.',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-declared_at']
        # Prevent duplicate active outbreaks for same pathogen+country
        constraints = [
            models.UniqueConstraint(
                fields=['pathogen', 'iso3'],
                condition=models.Q(status__in=['suspected', 'confirmed']),
                name='unique_active_outbreak_per_pathogen_country',
            ),
        ]

    def __str__(self):
        return f"{self.pathogen.name} — {self.iso3} ({self.get_status_display()})"

    def clean(self):
        super().clean()
        if (
            self.confirmed_cases is not None
            and self.confirmed_deaths is not None
            and self.confirmed_deaths > self.confirmed_cases
        ):
            raise ValidationError({
                'confirmed_deaths': 'Confirmed deaths cannot exceed confirmed cases.',
            })


# ─── OutbreakEvent — THE CENTERPIECE ────────────────────────────────


class OutbreakEvent(models.Model):
    """
    The fused immutable event stream.

    Append-only, never deleted, never updated.
    UI and LLM read from here. Adaptors write here via base class dedupe.

    payload_json schema varies by kind — documented per adaptor.
    """
    outbreak = models.ForeignKey(
        Outbreak, on_delete=models.PROTECT,
        related_name='events',
    )
    ts = models.DateTimeField(
        db_index=True,
        help_text='Timestamp of the event (source timestamp if available, else now)',
    )
    source = models.CharField(
        max_length=100,
        help_text='Adaptor name that produced this event',
    )
    kind = models.CharField(
        max_length=30,
        choices=EventKind.choices,
        help_text='Event type from the EventKind enum',
    )
    geo = models.CharField(
        max_length=100, default='',
        help_text='District/admin-level identifier (never GPS precision)',
    )
    payload_json = models.JSONField(
        default=dict,
        help_text='Event payload — schema varies by kind, documented per adaptor',
    )
    confidence = models.DecimalField(
        max_digits=3, decimal_places=2, default=1.00,
        help_text='Confidence score 0.00–1.00',
    )
    source_ref = models.CharField(
        max_length=500, default='',
        help_text='FK reference or URL back to origin row in source system',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-ts']
        indexes = [
            models.Index(fields=['outbreak', 'ts'], name='evt_outbreak_ts'),
            models.Index(fields=['outbreak', 'kind', 'ts'], name='evt_outbreak_kind_ts'),
            models.Index(fields=['outbreak', 'geo', 'ts'], name='evt_outbreak_geo_ts'),
        ]
        constraints = [
            # Dedupe: same source + source_ref = same event
            models.UniqueConstraint(
                fields=['source', 'source_ref'],
                name='unique_event_source_ref',
                condition=~models.Q(source_ref=''),
            ),
        ]

    def __str__(self):
        return f"[{self.kind}] {self.source} @ {self.ts:%Y-%m-%d %H:%M}"

    def save(self, *args, **kwargs):
        # Immutability enforcement: block updates on existing rows
        if self.pk and not kwargs.pop('_force_save', False):
            raise ValidationError(
                "OutbreakEvent rows are immutable. Write a correcting event instead."
            )
        super().save(*args, **kwargs)


# ─── OutbreakHistoricalEpisode ──────────────────────────────────────


class OutbreakHistoricalEpisode(models.Model):
    """
    Curated historical outbreak episodes for the Past pane.
    Manually entered from WHO DON archives — never LLM-generated.
    """
    pathogen = models.ForeignKey(
        Pathogen, on_delete=models.PROTECT,
        related_name='historical_episodes',
    )
    country = models.CharField(
        max_length=100,
        help_text='Country name',
    )
    country_iso3 = models.CharField(
        max_length=3, default='',
        help_text='ISO3 country code',
    )
    year_start = models.PositiveIntegerField(
        help_text='Year the episode started',
    )
    year_end = models.PositiveIntegerField(
        null=True, blank=True,
        help_text='Year the episode ended (null if same as start)',
    )
    cases = models.PositiveIntegerField(
        default=0,
        help_text='Total confirmed + probable cases',
    )
    deaths = models.PositiveIntegerField(
        default=0,
        help_text='Total deaths',
    )
    response_summary = models.TextField(
        default='',
        help_text='Brief summary of the response. Manually curated only.',
    )
    lessons = models.TextField(
        default='',
        help_text='Key lessons learned. Manually curated only.',
    )
    source_urls = models.JSONField(
        default=list,
        help_text='List of source URLs (WHO DON, published papers, etc.)',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-year_start']

    def __str__(self):
        end = f"–{self.year_end}" if self.year_end else ""
        return f"{self.pathogen.name} — {self.country} {self.year_start}{end}"

    def clean(self):
        super().clean()
        if self.cases < 0:
            raise ValidationError({'cases': 'Cases must be non-negative.'})
        if self.deaths < 0:
            raise ValidationError({'deaths': 'Deaths must be non-negative.'})
        if self.deaths > self.cases:
            # Catches both deaths>cases when cases>0 AND the deaths>0 / cases=0
            # case which was previously allowed through.
            raise ValidationError({'deaths': 'Deaths cannot exceed cases.'})


# ─── NotificationRule ───────────────────────────────────────────────


class NotificationRule(models.Model):
    """
    Routing rule for outbreak notifications.
    Evaluated against new OutbreakEvents by the rule engine.
    """
    class Channel(models.TextChoices):
        TELEGRAM = 'telegram', 'Telegram'
        EMAIL = 'email', 'Email'

    pathogen = models.ForeignKey(
        Pathogen, on_delete=models.CASCADE,
        related_name='notification_rules',
        null=True, blank=True,
        help_text='Filter by pathogen (null = all pathogens)',
    )
    region = models.CharField(
        max_length=100, default='',
        help_text='ISO3 or admin region to scope this rule (empty = global)',
    )
    severity_threshold = models.CharField(
        max_length=20,
        choices=OutbreakSeverity.choices,
        default=OutbreakSeverity.HIGH,
        help_text='Minimum event severity to trigger this rule',
    )
    event_kinds = models.JSONField(
        default=list,
        help_text='List of EventKind values to match (empty = all kinds)',
    )
    role = models.CharField(
        max_length=100, default='',
        help_text='Recipient role label (e.g. "regional_director", "focal_point")',
    )
    channel = models.CharField(
        max_length=20,
        choices=Channel.choices,
        default=Channel.TELEGRAM,
    )
    contact_ids = models.JSONField(
        default=list,
        help_text='List of Telegram chat IDs or email addresses',
    )
    template_id = models.CharField(
        max_length=100, default='',
        help_text='Notification template identifier',
    )
    auto_send_after_hold = models.BooleanField(
        default=False,
        help_text='If True, high-severity notifications auto-send after hold window expires',
    )
    hold_seconds = models.PositiveIntegerField(
        default=300,
        help_text='Hold-and-confirm window for high-severity dispatch (seconds)',
    )
    enabled = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        pathogen_str = self.pathogen.name if self.pathogen else "Any"
        return f"Rule: {pathogen_str} → {self.channel} ({self.role})"


# ─── OutbreakNotification ───────────────────────────────────────────


class OutbreakNotification(models.Model):
    """
    A pending/sent notification produced by the rule engine for a single
    matched event. Append-style audit trail — state moves forward only.
    """

    class State(models.TextChoices):
        PENDING = 'pending', 'Pending'
        PENDING_CONFIRM = 'pending_confirm', 'Pending Confirm'
        SENT = 'sent', 'Sent'
        ACKED = 'acked', 'Acknowledged'
        DISMISSED = 'dismissed', 'Dismissed'
        FAILED = 'failed', 'Failed'

    outbreak = models.ForeignKey(
        Outbreak, on_delete=models.CASCADE, related_name='notifications',
    )
    rule = models.ForeignKey(
        NotificationRule, on_delete=models.PROTECT, related_name='notifications',
    )
    event = models.ForeignKey(
        OutbreakEvent, on_delete=models.PROTECT, related_name='notifications',
    )
    state = models.CharField(
        max_length=20, choices=State.choices, default=State.PENDING,
    )
    channel = models.CharField(max_length=20, default='')
    rendered_message = models.TextField(default='')
    hold_until = models.DateTimeField(null=True, blank=True)
    dispatched_at = models.DateTimeField(null=True, blank=True)
    error = models.TextField(default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['outbreak', 'state', 'created_at']),
        ]

    def __str__(self):
        return f"Notification #{self.pk} {self.state} via {self.channel}"


# ─── OutbreakDecision ───────────────────────────────────────────────


class OutbreakDecision(models.Model):
    """
    Append-only decision log entry — never edited, never deleted.
    Each decision optionally points at the evidence events that backed it.
    """

    class Kind(models.TextChoices):
        DECISION = 'decision', 'Decision'
        SITREP = 'sitrep', 'Sitrep'
        NOTE = 'note', 'Note'

    outbreak = models.ForeignKey(
        Outbreak, on_delete=models.CASCADE, related_name='decisions',
    )
    kind = models.CharField(
        max_length=20, choices=Kind.choices, default=Kind.DECISION,
    )
    title = models.CharField(max_length=200, default='')
    body = models.TextField(default='')
    author = models.CharField(max_length=120, default='')
    evidence_event_ids = models.JSONField(default=list)
    citations = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['outbreak', 'kind', 'created_at']),
        ]

    def __str__(self):
        return f"{self.kind}: {self.title or self.body[:40]}"

    def save(self, *args, **kwargs):
        if self.pk and not kwargs.pop('_force_save', False):
            raise ValidationError(
                "OutbreakDecision rows are append-only and immutable."
            )
        super().save(*args, **kwargs)


# ─── LlmInteraction ─────────────────────────────────────────────────


class LlmInteraction(models.Model):
    """
    Immutable audit log of every LLM call made on behalf of the workspace.
    Used for safety review if a recommendation is acted on.
    """

    class Source(models.TextChoices):
        ASK = 'ask', 'Q&A'
        SITREP = 'sitrep', 'Sitrep'
        OTHER = 'other', 'Other'

    outbreak = models.ForeignKey(
        Outbreak, on_delete=models.CASCADE, related_name='llm_interactions',
        null=True, blank=True,
    )
    source = models.CharField(
        max_length=20, choices=Source.choices, default=Source.ASK,
    )
    question = models.TextField(default='')
    grounding_summary = models.TextField(default='')
    raw_response = models.TextField(default='')
    final_answer = models.TextField(default='')
    refusal_reason = models.CharField(max_length=120, default='')
    citations_matched = models.JSONField(default=dict)
    canned_query = models.CharField(max_length=80, default='')
    model = models.CharField(max_length=120, default='')
    provider = models.CharField(max_length=40, default='')
    latency_ms = models.PositiveIntegerField(default=0)
    prompt_tokens = models.PositiveIntegerField(default=0)
    completion_tokens = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['outbreak', 'created_at']),
            models.Index(fields=['source', 'created_at']),
        ]

    def __str__(self):
        verdict = 'OK' if self.final_answer else f'refused:{self.refusal_reason or "?"}'
        return f"LLM[{self.source}] {verdict} ({self.latency_ms}ms)"

    def save(self, *args, **kwargs):
        if self.pk and not kwargs.pop('_force_save', False):
            raise ValidationError("LlmInteraction rows are immutable.")
        super().save(*args, **kwargs)
