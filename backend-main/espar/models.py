# models.py
from django.db import models
from statistics import mean

class Sheet(models.Model):
    name = models.CharField(max_length=100)
    
class Espar(models.Model):
    sheet = models.ForeignKey(Sheet, on_delete=models.CASCADE, related_name="rows")
    key_on_table = models.CharField(max_length=100, unique=True)
    data_received = models.CharField(max_length=10)
    region = models.CharField(max_length=20)
    states = models.CharField(max_length=100)
    iso_code = models.CharField(max_length=10)
    total_average = models.IntegerField(default=0, null=True, blank=True)

    # ── Multi-tenancy (Phase 2.5) ────────────────────────────────
    # Populated from `iso_code` field (ISO3 → Tenant).
    # eSPAR has 196 global ISO codes — non-AFRO codes → AFR continental.
    tenant = models.ForeignKey(
        'account.Tenant',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='espar_data',
        help_text='Country tenant for RLS (populated from iso_code).',
    )
    
    def __str__(self):
        return f"{self.sheet.name} - {self.region} - {self.states}"
    
    def weak_indicators(self):
        return [i for i in self.indicators.all() if i.scaled_score() <= 2]

    def strong_indicators(self):
        return [i for i in self.indicators.all() if i.scaled_score() >= 4]

    class Meta:
        unique_together = ('sheet', 'key_on_table')

class Indicator(models.Model):
    espar = models.ForeignKey(Espar, on_delete=models.CASCADE, related_name="indicators")
    code = models.CharField(max_length=10)  # e.g. C.1.1
    value = models.IntegerField(default=0, null=True, blank=True)  # score like 20/40/60/80/100

    # ── Multi-tenancy (Phase 2.5 / Step 9) ────────────────────────
    # Denormalized from espar.tenant for direct RLS enforcement.
    # RLS policies can't efficiently join through indicator → espar → tenant.
    tenant = models.ForeignKey(
        'account.Tenant',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='espar_indicators',
        help_text='Denormalized from espar.tenant for direct RLS.',
    )
    
    def __str__(self):
        return f"{self.espar.sheet.name} - {self.code} - {self.value}"
    
    def scaled_score(self):
        if self.value is None:
            return 0
        return int(self.value / 20)
    

    class Meta:
        unique_together = ('espar', 'code')