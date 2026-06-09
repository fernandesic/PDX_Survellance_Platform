from django.db import models

class PamiData(models.Model):
    country = models.CharField(max_length=100)
    tenant = models.ForeignKey(
        'account.Tenant', on_delete=models.PROTECT,
        related_name='+', db_index=True,
        help_text='Country tenant. Populated from normalized country name.',
    )
    province = models.CharField(max_length=255, null=True, blank=True)  # Admin 1
    district = models.CharField(max_length=255, null=True, blank=True)  # Admin 2
    priority_index = models.IntegerField(default=0)
    risk_level = models.CharField(max_length=100, null=True, blank=True)
    additional_data = models.JSONField(default=dict, null=True, blank=True)

    # ── Multi-tenancy (Phase 2.5) ────────────────────────────────
    # Populated from `country` field (country name → Tenant).
    tenant = models.ForeignKey(
        'account.Tenant',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='pami_data',
        help_text='Country tenant for RLS (populated from country name).',
    )

    def __str__(self):
        return f"{self.country} - {self.district or self.province}"
