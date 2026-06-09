from django.db import models

class IhmrefCategory(models.Model):
    CATEGORY_LABELS= (
        ("simulation_exercise", "Simulation Exercises"),
        ("after_action_review", "After Action Reviews"),
        ("intra_action_review", "Intra Action Reviews"),
        ("early_action_review", "Early Action Reviews"),
        ("naphs", "NAPHS"),
        ("nbws", "NBWS"),
        ("jee", "JEE"),
        ("risk_profiling", "Risk Profiling"),
    )
    category = models.CharField(max_length=50, choices=CATEGORY_LABELS)
    
    def __str__(self):
        return f"{self.category}"

class IhmrefData(models.Model):
    category = models.ForeignKey(IhmrefCategory, on_delete=models.CASCADE, related_name="ihmref_category")
    year = models.CharField(max_length=20)
    afro = models.IntegerField(default=0)
    global_t = models.IntegerField(default=0)
    contribution = models.DecimalField(decimal_places=2, max_digits=10)
    no_of_african_countries = models.IntegerField(default=0)
    african_countries_involved = models.TextField(blank=True, null=True)
    
    def __str__(self):
        return f"{self.category} - {self.year}"
    
class IhmrefDataSummary(models.Model):
    category = models.ForeignKey(IhmrefCategory, on_delete=models.CASCADE)
    afro = models.IntegerField(default=0)
    global_t = models.IntegerField(default=0)
    contribution = models.DecimalField(decimal_places=2, max_digits=10)
    
    def __str__(self):
        return f"{self.category} - {self.afro} - {self.global_t} - {self.contribution}"

class IhmrefCountry(models.Model):
    country = models.TextField()
    full_name =models.TextField(null=True, blank=True)
    state= models.TextField(null=True, blank=True)
    tenant = models.ForeignKey(
        'account.Tenant',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='ihmref_countries',
        help_text='Country tenant. Populated from normalized country name; non-African -> AFR.',
    )

    class Meta:
        unique_together = ("country", "state")

class CountryIncident(models.Model):
    country=models.ForeignKey(IhmrefCountry, on_delete=models.CASCADE)
    ihmref_data=models.ForeignKey(IhmrefData, on_delete=models.CASCADE)
    incident = models.TextField()
    start_date=models.DateField(null=True, blank=True)
    end_date=models.DateField(null=True, blank=True)

    # ── Multi-tenancy (Phase 2.5 / Step 9) ────────────────────────
    # Denormalized from country.tenant for direct RLS enforcement.
    tenant = models.ForeignKey(
        'account.Tenant',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='ihmref_incidents',
        help_text='Denormalized from country.tenant for direct RLS.',
    )

