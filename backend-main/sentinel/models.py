"""
AFRO Sentinel Watchtower - Signal Intelligence Models
Ported from AFRO-SENTINEL Supabase schema for Django/PostgreSQL
"""

from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class DiseaseCategory(models.TextChoices):
    VHF = 'vhf', 'Viral Hemorrhagic Fever'
    RESPIRATORY = 'respiratory', 'Respiratory'
    ENTERIC = 'enteric', 'Enteric'
    VECTOR_BORNE = 'vector_borne', 'Vector Borne'
    ZOONOTIC = 'zoonotic', 'Zoonotic'
    VACCINE_PREVENTABLE = 'vaccine_preventable', 'Vaccine Preventable'
    ENVIRONMENTAL = 'environmental', 'Environmental'
    UNKNOWN = 'unknown', 'Unknown'


class SignalPriority(models.TextChoices):
    P1 = 'P1', 'Critical'
    P2 = 'P2', 'High'
    P3 = 'P3', 'Medium'
    P4 = 'P4', 'Low'


class SignalStatus(models.TextChoices):
    NEW = 'new', 'New'
    TRIAGED = 'triaged', 'Triaged'
    VALIDATED = 'validated', 'Validated'
    DISMISSED = 'dismissed', 'Dismissed'


class SourceTier(models.IntegerChoices):
    TIER_0 = 0, 'Ground Truth (Field)'
    TIER_1 = 1, 'Official (WHO, Ministry)'
    TIER_2 = 2, 'Verified Media'
    TIER_3 = 3, 'Unverified'


class SourceCredibility(models.Model):
    """Track source reliability for signal ingestion"""
    source_name = models.CharField(max_length=200, unique=True)
    source_url = models.URLField(null=True, blank=True)
    source_type = models.CharField(max_length=50)  # official, media, social, community
    tier = models.IntegerField(choices=SourceTier.choices, default=SourceTier.TIER_3)
    credibility_score = models.IntegerField(default=50)  # 0-100
    total_signals = models.IntegerField(default=0)
    validated_signals = models.IntegerField(default=0)
    false_positive_count = models.IntegerField(default=0)
    last_signal_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Source Credibilities"
        ordering = ['-credibility_score']

    def __str__(self):
        return f"{self.source_name} (Tier {self.tier})"


class DiseaseKeyword(models.Model):
    """Multilingual disease keywords for detection - Lingua Fidelity"""
    disease_name = models.TextField(unique=True)
    category = models.CharField(max_length=50, choices=DiseaseCategory.choices, default=DiseaseCategory.UNKNOWN)
    default_priority = models.CharField(max_length=2, choices=SignalPriority.choices, default=SignalPriority.P3)
    
    # Multilingual keywords (stored as JSON arrays)
    keywords_en = models.JSONField(default=list, blank=True)  # English
    keywords_fr = models.JSONField(default=list, blank=True)  # French
    keywords_pt = models.JSONField(default=list, blank=True)  # Portuguese
    keywords_ar = models.JSONField(default=list, blank=True)  # Arabic
    keywords_sw = models.JSONField(default=list, blank=True)  # Swahili
    keywords_ha = models.JSONField(default=list, blank=True)  # Hausa
    keywords_yo = models.JSONField(default=list, blank=True)  # Yoruba
    keywords_am = models.JSONField(default=list, blank=True)  # Amharic
    
    # Epidemiological metadata
    symptoms_cluster = models.JSONField(default=list, blank=True)
    endemic_regions = models.JSONField(default=list, blank=True)
    case_fatality_rate = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    incubation_days_min = models.IntegerField(null=True, blank=True)
    incubation_days_max = models.IntegerField(null=True, blank=True)
    transmission_routes = models.JSONField(default=list, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['disease_name']

    def __str__(self):
        return f"{self.disease_name} ({self.category})"
    
    def get_all_keywords(self):
        """Return all keywords across all languages"""
        all_kw = []
        for lang in ['en', 'fr', 'pt', 'ar', 'sw', 'ha', 'yo', 'am']:
            all_kw.extend(getattr(self, f'keywords_{lang}', []))
        return all_kw


class Signal(models.Model):
    """Core disease/hazard signal from various intelligence sources"""
    
    # Signal classification
    signal_type = models.TextField(default='disease')  # disease, hazard, rumor
    disease_name = models.TextField(null=True, blank=True)
    disease_category = models.CharField(
        max_length=50, 
        choices=DiseaseCategory.choices, 
        null=True, 
        blank=True
    )
    
    # HDIS Pillar classification (Health Diplomacy)
    pillar = models.CharField(
        max_length=20,
        default='outbreak',
        db_index=True,
        help_text='Primary health diplomacy pillar'
    )
    secondary_pillars = models.JSONField(
        default=list, blank=True,
        help_text='Additional pillars for cross-pillar signals'
    )
    
    # Location data
    location_country = models.TextField()
    location_country_iso = models.TextField(null=True, blank=True, db_index=True)
    location_admin1 = models.TextField(null=True, blank=True)  # Region/State
    location_admin2 = models.TextField(null=True, blank=True)  # District
    location_locality = models.TextField(null=True, blank=True)
    location_lat = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    location_lng = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    
    # Original content (NEVER modified - Lingua Fidelity principle)
    original_text = models.TextField()
    original_language = models.CharField(max_length=10, null=True, blank=True)
    original_script = models.CharField(max_length=20, null=True, blank=True)  # latin, arabic, ge_ez
    
    # Translated content
    translated_text = models.TextField(null=True, blank=True)
    translation_confidence = models.IntegerField(null=True, blank=True)  # 0-100
    lingua_fidelity_score = models.IntegerField(null=True, blank=True)  # 0-100
    
    # Source information
    source = models.ForeignKey(
        SourceCredibility, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='signals'
    )
    source_tier = models.IntegerField(choices=SourceTier.choices, default=SourceTier.TIER_3)
    source_name = models.CharField(max_length=200)
    source_url = models.URLField(null=True, blank=True)
    source_type = models.CharField(max_length=50, null=True, blank=True)  # official, media, social
    source_timestamp = models.DateTimeField(null=True, blank=True)  # When published
    
    # Triage data
    priority = models.CharField(max_length=2, choices=SignalPriority.choices, default=SignalPriority.P4)
    confidence_score = models.IntegerField(default=50)  # 0-100
    status = models.CharField(max_length=20, choices=SignalStatus.choices, default=SignalStatus.NEW)
    
    # Affected population
    reported_cases = models.IntegerField(null=True, blank=True)
    reported_deaths = models.IntegerField(null=True, blank=True)
    affected_population = models.TextField(null=True, blank=True)
    
    # Validation
    cross_border_risk = models.BooleanField(default=False)
    seasonal_pattern_match = models.BooleanField(default=False)
    
    # Analyst notes
    analyst_notes = models.TextField(null=True, blank=True)
    triaged_by = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='triaged_signals'
    )
    triaged_at = models.DateTimeField(null=True, blank=True)
    validated_by = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='validated_signals'
    )
    validated_at = models.DateTimeField(null=True, blank=True)
    
    # Metadata
    ingestion_source = models.CharField(max_length=50, null=True, blank=True)  # gdelt, nasa, promed
    duplicate_hash = models.CharField(max_length=64, null=True, blank=True, db_index=True)  # For deduplication
    raw_payload = models.JSONField(null=True, blank=True)

    # AI Agent Classification (populated by background classifier)
    ai_classification = models.CharField(
        max_length=30, null=True, blank=True, db_index=True,
        help_text='AI verdict: area_alert, continent_alert, no_alert, uncertain'
    )
    ai_severity = models.CharField(
        max_length=20, null=True, blank=True,
        help_text='AI severity: low, moderate, high, critical'
    )
    ai_notification_scope = models.CharField(
        max_length=20, null=True, blank=True,
        help_text='Notification scope: local, continental, worldwide'
    )
    ai_reasoning = models.TextField(
        null=True, blank=True,
        help_text='LLM explanation for classification and severity'
    )
    ai_classified_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # ── Multi-tenancy (Phase 2.1) ────────────────────────────────
    # Links each signal to a country tenant for RLS-based row isolation.
    # Populated from location_country_iso via data migration.
    # NOT NULL — every signal must belong to a tenant (fallback: AFR continental).
    tenant = models.ForeignKey(
        'account.Tenant',
        on_delete=models.PROTECT,
        related_name='signals',
        help_text='Country tenant for RLS isolation (populated from location_country_iso)',
    )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['location_country']),
            models.Index(fields=['priority']),
            models.Index(fields=['status']),
            models.Index(fields=['disease_name']),
            models.Index(fields=['-created_at']),
        ]

    def __str__(self):
        return f"[{self.priority}] {self.disease_name or 'Unknown'} - {self.location_country}"


from .models_agent import *  # noqa: E402, F401
