"""
SITREP Form — Django Models

Three models:
  1. SitrepLink   — Time-limited token link for form access
  2. SitrepReport — The SITREP form data (all 6 sections)
  3. SitrepFieldEdit — Audit trail for every field change
"""
import uuid
from datetime import timedelta

from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()


class SitrepLink(models.Model):
    """A time-limited link token for accessing the SITREP form."""
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    sitrep_number = models.TextField(help_text='SITREP serial number (e.g. No. 001)')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"SitrepLink {self.token} - {self.sitrep_number}"

    @property
    def is_expired(self):
        return timezone.now() > self.expires_at

    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(hours=24)
        super().save(*args, **kwargs)


class SitrepReport(models.Model):
    """
    One SITREP report per sitrep_number.
    Contains all 6 sections of the form.
    """
    link = models.ForeignKey(
        SitrepLink, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='reports',
    )
    sitrep_number = models.TextField(unique=True)

    # ── Section 0: Document Control ──────────────────────────────
    reporting_period = models.TextField(blank=True, default='')
    date_of_issue = models.TextField(blank=True, default='')
    data_cutoff = models.TextField(blank=True, default='')
    classification = models.TextField(
        blank=True,
        default='WHO / FOR OFFICIAL USE — INTERNAL COORDINATION',
    )
    geographic_scope = models.TextField(
        blank=True,
        default='WHO African Region — 47 Member States',
    )
    triggering_event = models.TextField(blank=True, default='')
    prepared_by = models.TextField(blank=True, default='')
    cleared_by = models.TextField(blank=True, default='')
    next_issue = models.TextField(blank=True, default='')

    # ── Section 1: Statistics ────────────────────────────────────
    population_in_screening = models.TextField(blank=True, default='0')
    high_risk_poe = models.TextField(blank=True, default='0')
    referred = models.TextField(blank=True, default='0')
    isolated = models.TextField(blank=True, default='0')
    suspected = models.TextField(blank=True, default='0')

    # ── Section 2: Readiness Capacities ──────────────────────────
    # Placeholder section — no data fields, just visual placeholders

    # ── Section 3: Temporary Recommendations ─────────────────────
    selected_country = models.TextField(blank=True, default='')
    checklist_responses = models.JSONField(
        default=dict, blank=True,
        help_text='Map of checklist item key → "YES" / "NO" / null',
    )

    # ── Section 4: Action Points ─────────────────────────────────
    action_points = models.JSONField(
        default=list, blank=True,
        help_text='Array of {action: str, pillar: str}',
    )

    # ── Section 5: Planned Actions & Deployments ─────────────────
    planned_actions = models.TextField(blank=True, default='')

    # ── Section 5b: Weekly Highlights ────────────────────────────
    # List of {id: str, image_data: str (base64 data URL), caption: str,
    #          date: str, is_highlight: bool}. Exactly one item should have
    # is_highlight=True at a time (the UI enforces this).
    weekly_highlights = models.JSONField(default=list, blank=True)

    # ── Section 6: Key Challenges ────────────────────────────────
    key_challenges = models.TextField(blank=True, default='')

    # ── Meta ─────────────────────────────────────────────────────
    created_on = models.DateTimeField(auto_now_add=True)
    updated_on = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_on']

    def __str__(self):
        return f"SITREP Report - {self.sitrep_number}"

    # All editable field names — used for validation in UpdateFieldView
    EDITABLE_FIELDS = [
        # Section 0: Document Control
        'reporting_period', 'date_of_issue', 'data_cutoff',
        'classification', 'geographic_scope', 'triggering_event',
        'prepared_by', 'cleared_by', 'next_issue',
        # Section 1: Statistics
        'population_in_screening', 'high_risk_poe',
        'referred', 'isolated', 'suspected',
        # Section 3: Recommendations
        'selected_country', 'checklist_responses',
        # Section 4: Action Points
        'action_points',
        # Section 5 & 6: Text fields
        'planned_actions', 'key_challenges',
        # Section 5b: Weekly Highlights (the list, not individual images)
        'weekly_highlights',
    ]


class SitrepFieldEdit(models.Model):
    """Audit trail for every field edit in a SITREP report."""
    report = models.ForeignKey(
        SitrepReport, on_delete=models.CASCADE, related_name='edits',
    )
    field_name = models.TextField()
    old_value = models.TextField(blank=True, default='')
    new_value = models.TextField(blank=True, default='')
    edited_by = models.CharField(max_length=255, blank=True, default='Anonymous')
    edited_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-edited_at']

    def __str__(self):
        return f"{self.field_name} by {self.edited_by} @ {self.edited_at}"
