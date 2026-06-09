"""
KoboToolbox CHW Field Intelligence — Data Models

KoboSubmission stores the raw form data from every CHW Outbreak and
Anomaly Rapid Report submission. Each row is linked 1:1 to a
sentinel.Signal via the `signal` FK once ingested.

PII Discipline:
  - chw_name, whatsapp_number, whatsapp_transcript are stored (Option B)
    but NEVER serialized to any public API endpoint.
  - These fields are visible ONLY in Django Admin with appropriate permissions.
"""

import logging
from typing import Optional

from django.db import models

logger = logging.getLogger(__name__)


class KoboSubmission(models.Model):
    """
    Raw KoboToolbox CHW submission — one row per form submission.

    Dedup contract:
      - kobo_id is unique (the numeric _id from Kobo API)
      - kobo_uuid is unique (the _uuid from Kobo API)
      - Both webhook and poll use get_or_create on kobo_id
    """

    # ── Kobo identifiers (dedup keys) ───────────────────────────────
    kobo_id = models.IntegerField(
        unique=True, db_index=True,
        help_text='Kobo _id — unique numeric submission ID',
    )
    kobo_uuid = models.CharField(
        max_length=100, unique=True,
        help_text='Kobo _uuid — unique submission UUID',
    )
    xform_id_string = models.CharField(
        max_length=200, default='',
        help_text='Kobo _xform_id_string — asset UID this submission belongs to',
    )
    form_version = models.CharField(
        max_length=100, default='',
        help_text='Kobo __version__ — form version at time of submission',
    )

    # ── CHW identity (PII — admin-only) ─────────────────────────────
    chw_name = models.CharField(
        max_length=200, default='',
        help_text='Full name of the CHW (PII — admin-only)',
    )
    chw_clinic = models.CharField(
        max_length=300, default='',
        help_text='Clinic or hospital the CHW is affiliated with',
    )

    # ── Report content ──────────────────────────────────────────────
    description = models.TextField(
        default='',
        help_text='Free-text description of what the CHW observed',
    )
    event_type = models.CharField(
        max_length=500, default='',
        help_text='Space-separated values from health_event_type list',
    )
    event_other = models.CharField(
        max_length=300, default='',
        help_text='Free-text for "other" event type',
    )
    case_count = models.IntegerField(
        default=0,
        help_text='Estimated number of people affected (cast from string)',
    )
    age_group = models.CharField(
        max_length=50, default='',
        help_text='Age group most affected (from age_group list)',
    )
    severity = models.CharField(
        max_length=50, default='',
        help_text='Severity level (from severity list)',
    )

    # ── Location — GPS (operational, excluded from public API) ──────
    gps_location = models.CharField(
        max_length=200, default='',
        help_text='Raw GPS string "lat lon altitude accuracy" from device',
    )
    text_location = models.TextField(
        default='',
        help_text='Free-text community/village/region/country description',
    )

    # ── Location — Geocoded (server-generated from text_location) ───
    adm0_pcode = models.CharField(
        max_length=10, default='',
        help_text='Country P-code (ISO 3166-1 alpha-2)',
    )
    adm0_name = models.CharField(
        max_length=200, default='',
        help_text='Country name (geocoded)',
    )
    adm1_pcode = models.CharField(
        max_length=20, default='',
        help_text='Admin level 1 P-code (province/state)',
    )
    adm1_name = models.CharField(
        max_length=200, default='',
        help_text='Admin level 1 name',
    )
    adm2_pcode = models.CharField(
        max_length=20, default='',
        help_text='Admin level 2 P-code (territory/district)',
    )
    adm2_name = models.CharField(
        max_length=200, default='',
        help_text='Admin level 2 name',
    )
    geocoded_latitude = models.DecimalField(
        max_digits=10, decimal_places=7, null=True, blank=True,
        help_text='Geocoded latitude from text_location',
    )
    geocoded_longitude = models.DecimalField(
        max_digits=10, decimal_places=7, null=True, blank=True,
        help_text='Geocoded longitude from text_location',
    )
    geocoding_confidence = models.CharField(
        max_length=50, default='',
        help_text='Geocoding match confidence level',
    )

    # ── Media ───────────────────────────────────────────────────────
    photo_evidence = models.CharField(
        max_length=500, default='',
        help_text='Filename of uploaded photo',
    )
    comments_text = models.TextField(
        default='',
        help_text='Additional text comments from CHW',
    )
    comments_audio = models.CharField(
        max_length=500, default='',
        help_text='Filename of audio comment',
    )

    # ── WhatsApp integration (PII — admin-only) ─────────────────────
    whatsapp_number = models.CharField(
        max_length=50, default='',
        help_text='Sender WhatsApp number (PII — admin-only)',
    )
    whatsapp_transcript = models.TextField(
        default='',
        help_text='Full bot-CHW conversation transcript (PII — admin-only)',
    )

    # ── Signal link ─────────────────────────────────────────────────
    signal = models.OneToOneField(
        'sentinel.Signal',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='kobo_submission',
        help_text='The sentinel.Signal created from this submission',
    )

    # ── Metadata ────────────────────────────────────────────────────
    submitted_at = models.DateTimeField(
        null=True, blank=True,
        help_text='Kobo _submission_time — when the server received the submission',
    )
    submitted_by = models.CharField(
        max_length=200, default='',
        help_text='Kobo _submitted_by — username of submitter',
    )
    submission_status = models.CharField(
        max_length=100, default='',
        help_text='Kobo _status (e.g. submitted_via_web)',
    )
    anomaly_flag = models.BooleanField(
        default=False,
        help_text='Flagged for review when case_count > 1000',
    )
    raw_payload = models.JSONField(
        default=dict,
        help_text='Full raw JSON payload from KoboToolbox API',
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-submitted_at']
        verbose_name = 'Kobo Submission'
        verbose_name_plural = 'Kobo Submissions'
        indexes = [
            models.Index(fields=['event_type']),
            models.Index(fields=['severity']),
            models.Index(fields=['-submitted_at']),
        ]

    def __str__(self) -> str:
        return (
            f"Kobo #{self.kobo_id} — {self.event_type} "
            f"({self.severity}) @ {self.chw_clinic}"
        )

    def save(self, *args, **kwargs):
        # Flag anomalous case counts for human review
        if self.case_count > 1000:
            self.anomaly_flag = True
            logger.warning(
                "Kobo submission %d has case_count=%d (>1000), flagging for review",
                self.kobo_id, self.case_count,
            )
        super().save(*args, **kwargs)
