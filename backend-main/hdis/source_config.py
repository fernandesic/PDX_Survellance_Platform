"""
HDIS Intelligence Source Configuration
Database-driven source management for the unified ingestion pipeline.
"""

from django.db import models
from hdis.pillar_classifier import SignalPillar


class SourceType(models.TextChoices):
    RSS = 'rss', 'RSS Feed'
    REST_API = 'rest_api', 'REST API'
    WEB_SCRAPE = 'web_scrape', 'Web Scraper'


class SourceConfig(models.Model):
    """
    Database-driven configuration for each intelligence source.
    One model, many sources — configured via admin, not code.
    """

    # Identity
    name = models.CharField(max_length=200, unique=True)
    slug = models.SlugField(max_length=100, unique=True)
    description = models.TextField(blank=True)

    # Connection
    source_type = models.CharField(max_length=20, choices=SourceType.choices)
    url = models.URLField(help_text="RSS feed URL, API endpoint, or target URL")
    auth_header = models.CharField(
        max_length=500, blank=True,
        help_text="Optional auth header value (e.g., 'Bearer xxx' or API key)"
    )
    extra_params = models.JSONField(
        default=dict, blank=True,
        help_text="Extra query params or config (JSON). E.g., ACLED filters."
    )

    # Classification
    default_pillar = models.CharField(
        max_length=20,
        choices=SignalPillar.CHOICES,
        default=SignalPillar.OUTBREAK,
        help_text="Default pillar if keyword classifier returns no match"
    )
    source_tier = models.IntegerField(
        default=3,
        choices=[(1, 'Tier 1 — Official'), (2, 'Tier 2 — Verified Media'), (3, 'Tier 3 — Unverified')],
        help_text="Trust tier for the trust engine"
    )

    # Filtering
    keyword_include = models.JSONField(
        default=list, blank=True,
        help_text="Only ingest items matching ANY of these keywords (empty = accept all)"
    )
    keyword_exclude = models.JSONField(
        default=list, blank=True,
        help_text="Reject items matching ANY of these keywords"
    )
    require_africa = models.BooleanField(
        default=True,
        help_text="Only ingest signals mentioning an African country"
    )

    # Scheduling
    is_active = models.BooleanField(default=True)
    poll_interval_minutes = models.IntegerField(
        default=30,
        help_text="How often to poll this source (minutes)"
    )
    last_polled_at = models.DateTimeField(null=True, blank=True)
    last_error = models.TextField(blank=True)

    # Stats
    total_ingested = models.IntegerField(default=0)
    total_rejected = models.IntegerField(default=0)
    total_duplicates = models.IntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'hdis_pro_sourceconfig'
        ordering = ['name']

    def __str__(self):
        status = "✅" if self.is_active else "⏸️"
        return f"{status} {self.name} ({self.get_source_type_display()})"
