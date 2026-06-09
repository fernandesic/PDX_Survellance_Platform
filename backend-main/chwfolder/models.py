from django.db import models


# ─── Core hierarchy: Country → Region → District ───

class Country(models.Model):
    """
    Top-level entity. One row per country with aggregated totals.
    Keeps the same class name 'Country' for backward compat with
    account/serializers.py, chat_views.py, etc.
    """
    country = models.CharField(max_length=100, unique=True)
    iso_code = models.CharField(max_length=3, blank=True, default='')
    tenant = models.ForeignKey(
        'account.Tenant', on_delete=models.PROTECT,
        related_name='+', db_index=True,
        help_text='Country tenant. Matched from iso_code or country name.',
    )
    population_2024 = models.BigIntegerField(default=0)
    total_chws = models.IntegerField(default=0)
    active_chws = models.IntegerField(default=0)
    inactive_chws = models.IntegerField(default=0)
    volunteer_chws = models.IntegerField(default=0)
    paid_chws = models.IntegerField(default=0)
    active_percentage = models.FloatField(default=0.0)
    data_flag = models.CharField(max_length=100, blank=True, default='')
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    chws_per_10000 = models.FloatField(default=0.0)
    total_regions = models.IntegerField(default=0)
    total_districts = models.IntegerField(default=0)
    total_facilities = models.IntegerField(default=0)
    data_year = models.IntegerField(default=2026)
    data_date = models.CharField(max_length=50, blank=True, default='')
    data_source = models.CharField(max_length=500, blank=True, default='')
    last_updated = models.DateField(auto_now=True)

    # ── Multi-tenancy (Phase 2.5) ────────────────────────────────
    # Populated from `iso_code` field (ISO3 → Tenant).
    tenant = models.ForeignKey(
        'account.Tenant',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='chw_countries',
        help_text='Country tenant for RLS (populated from iso_code).',
    )

    class Meta:
        verbose_name_plural = 'Countries'
        ordering = ['country']

    def __str__(self):
        return self.country

    def recalculate_totals(self):
        """Recompute aggregated fields from related regions/districts."""
        regions = self.region_set.all()
        self.total_regions = regions.count()
        self.total_districts = District.objects.filter(region__country=self).count()
        self.total_chws = sum(r.total_chws for r in regions)
        self.active_chws = sum(r.active_chws for r in regions)
        self.inactive_chws = sum(r.inactive_chws for r in regions)
        self.volunteer_chws = sum(r.volunteer_chws for r in regions)
        self.paid_chws = sum(r.paid_chws for r in regions)
        
        if self.total_chws > 0:
            self.active_percentage = round((self.active_chws / self.total_chws) * 100, 2)
        else:
            self.active_percentage = 0.0
            
        self.total_facilities = sum(r.total_facilities for r in regions)
        if self.population_2024 and self.population_2024 > 0:
            self.chws_per_10000 = round(
                (self.total_chws / self.population_2024) * 10000, 2
            )
        self.save()


class Region(models.Model):
    """
    Second level: region/province/state/zone within a country.
    """
    country = models.ForeignKey(Country, on_delete=models.CASCADE)
    tenant = models.ForeignKey(
        'account.Tenant', on_delete=models.PROTECT,
        null=True, blank=True,
        related_name='+', db_index=True,
        help_text='Denormalized from parent Country.tenant.',
    )
    region_name = models.CharField(max_length=200)
    admin_level = models.CharField(
        max_length=50, default='region',
        help_text='region, province, state, zone, island, département'
    )
    total_chws = models.IntegerField(default=0)
    active_chws = models.IntegerField(default=0)
    inactive_chws = models.IntegerField(default=0)
    volunteer_chws = models.IntegerField(default=0)
    paid_chws = models.IntegerField(default=0)
    active_percentage = models.FloatField(default=0.0)
    data_flag = models.CharField(max_length=100, blank=True, default='')
    total_population = models.BigIntegerField(default=0)
    total_facilities = models.IntegerField(default=0)
    district_count = models.IntegerField(default=0)
    region_number = models.IntegerField(default=0)
    province = models.CharField(max_length=150, null=True, blank=True)

    # ── Multi-tenancy (Phase 2.5) ────────────────────────────────
    # Denormalized from parent Country.tenant for direct RLS.
    tenant = models.ForeignKey(
        'account.Tenant',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='chw_regions',
        help_text='Denormalized from parent Country.tenant for RLS.',
    )

    class Meta:
        ordering = ['country', 'region_name']
        unique_together = ['country', 'region_name']

    def __str__(self):
        return f"{self.region_name} ({self.country})"

    def recalculate_totals(self):
        """Recompute from child districts."""
        districts = self.district_set.all()
        self.district_count = districts.count()
        self.total_chws = sum(d.total_chws for d in districts)
        self.active_chws = sum(d.active_chws for d in districts)
        self.inactive_chws = sum(d.inactive_chws for d in districts)
        self.volunteer_chws = sum(d.volunteer_chws for d in districts)
        self.paid_chws = sum(d.paid_chws for d in districts)
        
        if self.total_chws > 0:
            self.active_percentage = round((self.active_chws / self.total_chws) * 100, 2)
        else:
            self.active_percentage = 0.0
            
        self.total_population = sum(d.population for d in districts)
        fac_count = Facility.objects.filter(
            district__region=self
        ).aggregate(total=models.Sum('count'))['total'] or 0
        self.total_facilities = fac_count
        self.save()


class District(models.Model):
    """
    Third level: district/council/commune/payam/boma.
    """
    region = models.ForeignKey(Region, on_delete=models.CASCADE)
    country = models.ForeignKey(Country, on_delete=models.CASCADE)
    tenant = models.ForeignKey(
        'account.Tenant', on_delete=models.PROTECT,
        null=True, blank=True,
        related_name='+', db_index=True,
        help_text='Denormalized from parent Country.tenant.',
    )
    district_name = models.CharField(max_length=200)
    admin_level = models.CharField(
        max_length=50, default='district',
        help_text='district, council, commune, payam, boma, préfecture'
    )
    total_chws = models.IntegerField(default=0)
    active_chws = models.IntegerField(default=0)
    inactive_chws = models.IntegerField(default=0)
    volunteer_chws = models.IntegerField(default=0)
    paid_chws = models.IntegerField(default=0)
    active_percentage = models.FloatField(default=0.0)
    data_flag = models.CharField(max_length=100, blank=True, default='')
    chw_count = models.IntegerField(default=0)  # backward compat alias
    population = models.BigIntegerField(default=0)
    population_est = models.BigIntegerField(default=0)  # backward compat alias
    households = models.IntegerField(default=0)
    chws_per_10k = models.FloatField(default=0.0)

    # ── Multi-tenancy (Phase 2.5) ────────────────────────────────
    # Denormalized from parent Country.tenant for direct RLS.
    tenant = models.ForeignKey(
        'account.Tenant',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='chw_districts',
        help_text='Denormalized from parent Country.tenant for RLS.',
    )

    class Meta:
        ordering = ['country', 'region', 'district_name']

    def __str__(self):
        return f"{self.district_name} ({self.region.region_name})"

    def save(self, *args, **kwargs):
        # Keep backward compat fields synced
        self.chw_count = self.total_chws
        self.population_est = self.population
        
        if self.total_chws > 0:
            self.active_percentage = round((self.active_chws / self.total_chws) * 100, 2)
        else:
            self.active_percentage = 0.0
            
        if self.population and self.population > 0:
            self.chws_per_10k = round(
                (self.total_chws / self.population) * 10000, 2
            )
        super().save(*args, **kwargs)


# ─── CHW Worker Type breakdown ───

class WorkerType(models.Model):
    """
    Flexible model for CHW type breakdowns.
    Some countries have 1 type, others have 10+.
    Can be linked at district, region, or country level.
    """
    country = models.ForeignKey(Country, on_delete=models.CASCADE)
    region = models.ForeignKey(
        Region, on_delete=models.CASCADE, null=True, blank=True
    )
    district = models.ForeignKey(
        District, on_delete=models.CASCADE, null=True, blank=True
    )
    tenant = models.ForeignKey(
        'account.Tenant', on_delete=models.PROTECT,
        null=True, blank=True,
        related_name='+', db_index=True,
        help_text='Denormalized from parent Country.tenant.',
    )
    worker_type = models.CharField(max_length=100)
    count = models.IntegerField(default=0)

    # ── Multi-tenancy (Phase 2.5) ────────────────────────────────
    # Denormalized from parent Country.tenant for direct RLS.
    tenant = models.ForeignKey(
        'account.Tenant',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='chw_worker_types',
        help_text='Denormalized from parent Country.tenant for RLS.',
    )

    class Meta:
        ordering = ['country', 'worker_type']

    def __str__(self):
        loc = self.district or self.region or self.country
        return f"{self.worker_type}: {self.count} ({loc})"


# ─── Facility data ───

class Facility(models.Model):
    """
    Health facility data. Can be:
    - Aggregated: count of facilities per type per district/region
    - Individual: single facility with geocoordinates (from HealthFacility.xlsx)
    """
    country = models.ForeignKey(Country, on_delete=models.CASCADE)
    region = models.ForeignKey(
        Region, on_delete=models.CASCADE, null=True, blank=True
    )
    district = models.ForeignKey(
        District, on_delete=models.CASCADE, null=True, blank=True
    )
    tenant = models.ForeignKey(
        'account.Tenant', on_delete=models.PROTECT,
        null=True, blank=True,
        related_name='+', db_index=True,
        help_text='Denormalized from parent Country.tenant.',
    )
    facility_type = models.CharField(max_length=100, default='Unknown')
    count = models.IntegerField(default=1)
    # Individual facility fields (nullable for aggregated records)
    facility_name = models.CharField(max_length=300, blank=True, default='')
    facility_code = models.CharField(max_length=50, blank=True, default='')
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    ownership = models.CharField(max_length=100, blank=True, default='')

    # ── Multi-tenancy (Phase 2.5) ────────────────────────────────
    # Denormalized from parent Country.tenant for direct RLS.
    tenant = models.ForeignKey(
        'account.Tenant',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='chw_facilities',
        help_text='Denormalized from parent Country.tenant for RLS.',
    )

    class Meta:
        verbose_name_plural = 'Facilities'
        ordering = ['country', 'facility_type']

    def __str__(self):
        if self.facility_name:
            return f"{self.facility_name} ({self.facility_type})"
        loc = self.district or self.region or self.country
        return f"{self.facility_type} x{self.count} ({loc})"


# ─── Data upload tracking ───

class DataUpload(models.Model):
    """Track file imports for audit trail."""
    file_name = models.CharField(max_length=500)
    country = models.ForeignKey(
        Country, on_delete=models.SET_NULL, null=True, blank=True
    )
    tenant = models.ForeignKey(
        'account.Tenant', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='+', db_index=True,
        help_text='Denormalized from Country.tenant; nullable because audit trail may outlive country.',
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)
    rows_imported = models.IntegerField(default=0)
    status = models.CharField(
        max_length=20, default='pending',
        choices=[
            ('pending', 'Pending'),
            ('success', 'Success'),
            ('partial', 'Partial'),
            ('failed', 'Failed'),
        ]
    )
    notes = models.TextField(blank=True, default='')

    # ── Multi-tenancy (Phase 2.5) ────────────────────────────────
    # Denormalized from parent Country.tenant for direct RLS.
    tenant = models.ForeignKey(
        'account.Tenant',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='chw_uploads',
        help_text='Denormalized from parent Country.tenant for RLS.',
    )

    class Meta:
        ordering = ['-uploaded_at']

    def __str__(self):
        return f"{self.file_name} ({self.status})"
