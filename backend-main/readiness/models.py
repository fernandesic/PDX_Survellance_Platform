from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

class BaseReadiness(models.Model):
    key_on_table = models.TextField(unique=True)
    question_id=models.IntegerField(default=0, null=True, blank=True)
    question_key=models.TextField(null=True, blank=True)
    language=models.TextField(null=True, blank=True)
    category=models.TextField(null=True, blank=True)
    category_code=models.TextField(null=True, blank=True)
    affects_score=models.IntegerField(default=0, null=True, blank=True)
    category_score=models.IntegerField(default=0, null=True, blank=True)
    category_weight=models.DecimalField(decimal_places=10, default=0, max_digits=20, null=True, blank=True)
    question_score=models.DecimalField(decimal_places=10, default=0, max_digits=20, null=True, blank=True)
    question_category_weight=models.DecimalField(decimal_places=10, default=0, max_digits=20, null=True, blank=True)
    category_language=models.TextField(null=True, blank=True)
    question_language=models.TextField(null=True, blank=True)
    national_yn_value=models.TextField(null=True, blank=True)
    national_yn=models.TextField(null=True, blank=True)
    comments=models.TextField(blank=True, null=True)
    file_name=models.TextField(null=True, blank=True)
    country=models.TextField(null=True, blank=True)
    admin_level=models.TextField(null=True, blank=True)
    admin_level_name=models.TextField(null=True, blank=True)
    file_language=models.TextField(null=True, blank=True)
    table=models.TextField(null=True, blank=True)
    row_no=models.IntegerField(default=0, null=True, blank=True)
    question=models.TextField(null=True, blank=True)
    extra_data = models.JSONField(null=True, blank=True, default=dict)
    h_times_m = models.DecimalField(decimal_places=10, default=0, max_digits=20, null=True, blank=True)
    category_weight_sum_country = models.DecimalField(decimal_places=10, default=0, max_digits=20, null=True, blank=True)
    weighted_sum_country = models.DecimalField(decimal_places=10, default=0, max_digits=20, null=True, blank=True)
    category_percent_country = models.DecimalField(decimal_places=10, default=0, max_digits=20, null=True, blank=True)
    category_percent_country_pct = models.DecimalField(decimal_places=10, default=0, max_digits=20, null=True, blank=True)
    
    @property
    def weighted_score(self):
        try:
            return float(self.question_score or 0) * float(self.question_category_weight or 0)
        except (ValueError, TypeError):
            return 0

    # ── Multi-tenancy (Phase 2.4) ────────────────────────────────
    # Populated from `country` field (country name → Tenant).
    # Country names in readiness data use inconsistent casing
    # (UPPERCASE, Title Case) — data migration normalizes this.
    # All 15 disease subclasses inherit this FK automatically.
    tenant = models.ForeignKey(
        'account.Tenant',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='%(class)s_readiness',  # e.g. cholera_readiness, mpox_readiness
        help_text='Country tenant for RLS (populated from country name).',
    )

    class Meta:
        abstract = True
        
class ArboVirus(BaseReadiness):
    pass

class Cholera(BaseReadiness):
    data_period=models.TextField(null=True, blank=True)
    data_period_id=models.TextField(null=True, blank=True)
    
class CholeraSubNational(BaseReadiness):
    data_period=models.TextField(null=True, blank=True)
    data_period_id=models.TextField(null=True, blank=True)
    district=models.CharField(max_length=255, null=True, blank=True)
    category_weight_sum_geo = models.DecimalField(decimal_places=10, default=0, max_digits=20, null=True, blank=True)
    weighted_sum_geo = models.DecimalField(decimal_places=10, default=0, max_digits=20, null=True, blank=True)
    category_percent_geo = models.DecimalField(decimal_places=10, default=0, max_digits=20, null=True, blank=True)
    category_percent_geo_pct = models.DecimalField(decimal_places=10, default=0, max_digits=20, null=True, blank=True)

class Cyclone(BaseReadiness):
    data_period=models.TextField(null=True, blank=True)
    data_period_id=models.TextField(null=True, blank=True)

class FVD(BaseReadiness):
    data_period=models.TextField(null=True, blank=True)
    data_period_id=models.TextField(null=True, blank=True)
    
class FVDPoE(BaseReadiness):
    data_period=models.TextField(null=True, blank=True)
    data_period_id=models.TextField(null=True, blank=True)
    district=models.TextField(null=True, blank=True)
    poe_name=models.TextField(null=True, blank=True)
    category_weight_sum_geo = models.DecimalField(decimal_places=10, default=0, max_digits=20, null=True, blank=True)
    weighted_sum_geo = models.DecimalField(decimal_places=10, default=0, max_digits=20, null=True, blank=True)
    category_percent_geo = models.DecimalField(decimal_places=10, default=0, max_digits=20, null=True, blank=True)
    category_percent_geo_pct = models.DecimalField(decimal_places=10, default=0, max_digits=20, null=True, blank=True)
    
class LassaFever(BaseReadiness):
    data_period=models.TextField(null=True, blank=True)
    data_period_id=models.TextField(null=True, blank=True)
    
class LassaFeverDistrict(BaseReadiness):
    has_international_poe=models.IntegerField(default=0, null=True, blank=True)
    data_period=models.TextField(null=True, blank=True)
    data_period_id=models.TextField(null=True, blank=True)
    district=models.CharField(max_length=255, null=True, blank=True)
    category_weight_sum_geo = models.DecimalField(decimal_places=10, default=0, max_digits=20, null=True, blank=True)
    weighted_sum_geo = models.DecimalField(decimal_places=10, default=0, max_digits=20, null=True, blank=True)
    category_percent_geo = models.DecimalField(decimal_places=10, default=0, max_digits=20, null=True, blank=True)
    category_percent_geo_pct = models.DecimalField(decimal_places=10, default=0, max_digits=20, null=True, blank=True)
    
class Marburg(BaseReadiness):
    data_period=models.TextField(null=True, blank=True)
    data_period_id=models.TextField(null=True, blank=True)
    
class Meningitis(BaseReadiness):
    pass

class MeningitiseElimination(BaseReadiness):
    data_period=models.TextField(null=True, blank=True)
    data_period_id=models.TextField(null=True, blank=True)

class Mpox(BaseReadiness):
    data_period=models.TextField(null=True, blank=True)
    data_period_id=models.TextField(null=True, blank=True)

class MpoxDistrict(BaseReadiness):
    data_period=models.TextField(null=True, blank=True)
    data_period_id=models.TextField(null=True, blank=True)
    district=models.CharField(max_length=255, null=True, blank=True)
    category_weight_sum_geo = models.DecimalField(decimal_places=10, default=0, max_digits=20, null=True, blank=True)
    weighted_sum_geo = models.DecimalField(decimal_places=10, default=0, max_digits=20, null=True, blank=True)
    category_percent_geo = models.DecimalField(decimal_places=10, default=0, max_digits=20, null=True, blank=True)
    category_percent_geo_pct = models.DecimalField(decimal_places=10, default=0, max_digits=20, null=True, blank=True)
    
class NaturalDisaster(BaseReadiness):
    data_period=models.TextField(null=True, blank=True)
    data_period_id=models.TextField(null=True, blank=True)
    
class RiftValleyFever(BaseReadiness):
    data_period=models.TextField(null=True, blank=True)
    data_period_id=models.TextField(null=True, blank=True)


import uuid
from datetime import timedelta
from django.utils import timezone


class WeeklyReportLink(models.Model):
    """A time-limited link token for accessing the weekly report form."""
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    week_range = models.TextField()
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Link {self.token} - {self.week_range}"

    @property
    def is_expired(self):
        return timezone.now() > self.expires_at

    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(hours=24)
        super().save(*args, **kwargs)


class WeeklyReport(models.Model):
    """One shared report per week, filled collaboratively by all departments."""
    link = models.ForeignKey(WeeklyReportLink, on_delete=models.SET_NULL,
                             null=True, blank=True, related_name='reports')
    week_range = models.TextField(unique=True)

    # ── Top Section (supervisor pre-fills) ──
    featured_achievement = models.TextField(blank=True, default='')
    key_figures = models.TextField(blank=True, default='')

    # ── Image attachments (stored as base64 data URLs in DB) ──
    featured_achievement_image = models.TextField(blank=True, default='')
    key_figures_image = models.TextField(blank=True, default='')

    # ── HEP at Glance (departments fill) ──
    health_security_governance = models.TextField(blank=True, default='')
    health_security_financing = models.TextField(blank=True, default='')
    threats_risks_management = models.TextField(blank=True, default='')
    ihrme = models.TextField(blank=True, default='')
    ipc = models.TextField(blank=True, default='')
    readiness = models.TextField(blank=True, default='')
    naphs = models.TextField(blank=True, default='')
    community_protection = models.TextField(blank=True, default='')
    workforce_training = models.TextField(blank=True, default='')
    pandemic_influenza = models.TextField(blank=True, default='')
    vaccines_research = models.TextField(blank=True, default='')
    diseases_under_elimination = models.TextField(blank=True, default='')
    one_health = models.TextField(blank=True, default='')
    innovative_projects = models.TextField(blank=True, default='')
    hedrm = models.TextField(blank=True, default='')
    osl = models.TextField(blank=True, default='')

    created_on = models.DateTimeField(auto_now_add=True)
    updated_on = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Weekly Report - {self.week_range}"

    # All editable field names for validation
    EDITABLE_FIELDS = [
        'featured_achievement', 'key_figures',
        'health_security_governance', 'health_security_financing',
        'threats_risks_management', 'ihrme', 'ipc',
        'readiness', 'naphs', 'community_protection',
        'workforce_training', 'pandemic_influenza', 'vaccines_research',
        'diseases_under_elimination', 'one_health', 'innovative_projects',
        'hedrm', 'osl',
    ]


class ReportFieldEdit(models.Model):
    """Audit trail for every field edit."""
    report = models.ForeignKey(WeeklyReport, on_delete=models.CASCADE, related_name='edits')
    field_name = models.TextField()
    old_value = models.TextField(blank=True, default='')
    new_value = models.TextField(blank=True, default='')
    edited_by = models.CharField(max_length=255, blank=True, default='Anonymous')
    edited_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-edited_at']

    def __str__(self):
        return f"{self.field_name} by {self.edited_by} @ {self.edited_at}"


# ═══════════════════════════════════════════════════════
# Legacy models below — kept for migration compatibility
# ═══════════════════════════════════════════════════════

class ReportTeam(models.Model):
    """A team headed by a supervisor. Seeded manually."""
    supervisor = models.ForeignKey(User, on_delete=models.CASCADE, related_name='report_teams')
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, unique=True)
    is_active = models.BooleanField(default=True)
    created_on = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.code})"


class ReportMember(models.Model):
    """A worker in a team. Seeded manually."""
    team = models.ForeignKey(ReportTeam, on_delete=models.CASCADE, related_name='members')
    name = models.CharField(max_length=255)
    email = models.EmailField()
    is_active = models.BooleanField(default=True)
    created_on = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('team', 'email')

    def __str__(self):
        return f"{self.name} ({self.email})"


class PreparednessReport(models.Model):
    member = models.ForeignKey(ReportMember, on_delete=models.CASCADE,
                               related_name='reports', null=True, blank=True)
    team = models.ForeignKey(ReportTeam, on_delete=models.CASCADE,
                             related_name='reports', null=True, blank=True)
    week_range = models.TextField()
    featured_achievement = models.TextField(blank=True, null=True)
    
    readiness = models.TextField(blank=True, null=True)
    naphs = models.TextField(blank=True, null=True)
    community_protection = models.TextField(blank=True, null=True)
    workforce_training = models.TextField(blank=True, null=True)
    pandemic_influenza = models.TextField(blank=True, null=True)
    vaccines_research = models.TextField(blank=True, null=True)
    
    key_figures = models.JSONField(default=dict, blank=True)
    health_security_governance = models.JSONField(default=dict, blank=True)
    health_security_financing = models.JSONField(default=dict, blank=True)
    threats_risks_management = models.JSONField(default=dict, blank=True)
    diseases_under_elimination = models.JSONField(default=dict, blank=True)
    innovative_projects = models.JSONField(default=dict, blank=True)
    
    created_on = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Preparedness Report - {self.week_range} ({self.created_on.strftime('%Y-%m-%d')})"