from django.db import models

class StarData(models.Model):
    key_on_table = models.TextField(unique=True)
    n = models.TextField(null=True, blank=True)
    country = models.TextField(null=True, blank=True)
    level = models.TextField(null=True, blank=True)
    year = models.TextField(null=True, blank=True)
    start_date = models.TextField(null=True, blank=True)
    end_date = models.TextField(null=True, blank=True)
    subgroup_of_hazards = models.TextField(null=True, blank=True)
    main_type_of_hazard = models.TextField(null=True, blank=True)
    hazard = models.TextField(null=True, blank=True)
    health_consequences = models.TextField(null=True, blank=True)
    scale = models.TextField(null=True, blank=True)
    geographical_area = models.TextField(null=True, blank=True)
    exposure = models.TextField(null=True, blank=True)
    frequency = models.TextField(null=True, blank=True)
    seasonality = models.TextField(null=True, blank=True)
    jan = models.TextField(null=True, blank=True)
    feb = models.TextField(null=True, blank=True)
    mar = models.TextField(null=True, blank=True)
    apr = models.TextField(null=True, blank=True)
    may = models.TextField(null=True, blank=True)
    jun = models.TextField(null=True, blank=True)
    jul = models.TextField(null=True, blank=True)
    aug = models.TextField(null=True, blank=True)
    sep = models.TextField(null=True, blank=True)
    oct = models.TextField(null=True, blank=True)
    nov = models.TextField(null=True, blank=True)
    dec = models.TextField(null=True, blank=True)
    likelihood = models.TextField(null=True, blank=True)
    severity = models.TextField(null=True, blank=True)
    vulnerability = models.TextField(null=True, blank=True)
    vulnerability_details = models.TextField(null=True, blank=True)
    coping_capacity = models.TextField(null=True, blank=True)
    coping_capacity_details = models.TextField(null=True, blank=True)
    governance_and_resouces = models.TextField(null=True, blank=True)
    health_sector_capacity = models.TextField(null=True, blank=True)
    non_health_sector_capcity = models.TextField(null=True, blank=True)
    commuty_capacity = models.TextField(null=True, blank=True)
    resources = models.TextField(null=True, blank=True)
    impact = models.TextField(null=True, blank=True)
    confidence_level = models.TextField(null=True, blank=True)
    risk_level = models.TextField(null=True, blank=True)
    risk_level_number = models.TextField(null=True, blank=True)
    status = models.TextField(null=True, blank=True)

    # ── Multi-tenancy (Phase 2.3) ────────────────────────────────
    # Populated from `country` field (country name → Tenant).
    tenant = models.ForeignKey(
        'account.Tenant',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='star_data',
        help_text='Country tenant for RLS (populated from country name).',
    )


class StarCandlestick(models.Model):
    """Model for STAR Candlestick visualization data"""
    hazard = models.CharField(max_length=255)
    country = models.CharField(max_length=255)
    year = models.CharField(max_length=10)
    month_num = models.IntegerField()
    open_val = models.FloatField()
    high_val = models.FloatField()
    low_val = models.FloatField()
    close_val = models.FloatField()
    
    # Generated field for easy querying: YYYY-MM
    month_key = models.CharField(max_length=10, db_index=True)

    # ── Multi-tenancy (Phase 2.3) ────────────────────────────────
    # Populated from `country` field (country name → Tenant).
    tenant = models.ForeignKey(
        'account.Tenant',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='star_candlesticks',
        help_text='Country tenant for RLS (populated from country name).',
    )

    class Meta:
        indexes = [
            models.Index(fields=['hazard', 'country', 'year']),
            models.Index(fields=['month_key']),
        ]
        
    def __str__(self):
        return f"{self.country} - {self.hazard} - {self.month_key}"