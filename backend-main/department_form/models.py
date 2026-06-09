from django.db import models
from django.utils import timezone
import uuid

class DepartmentForm(models.Model):
    STATUS_CHOICES = [
        ('SECTION_A_PENDING', 'CONTRACT COMPLIANCE Pending'),
        ('SECTION_B_PENDING', 'PROCUREMENT DIVISION ACTION Pending'),
        ('SECTION_C_PENDING', 'OPERATIONS OFFICER RECOMMENDATION Pending'),
        ('SECTION_D_PENDING', "HUB lead approval for Final payment"),
        ('COMPLETED', 'APPROVED & COMPLETED'),
    ]

    serial_no = models.CharField(max_length=20, unique=True)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='SECTION_A_PENDING')
    
    # Header Info
    invoice_no = models.CharField(max_length=100, blank=True)
    department_name = models.CharField(max_length=255, blank=True)
    po_number = models.CharField(max_length=100, blank=True)
    contract_date = models.DateField(null=True, blank=True)
    commodity_type = models.CharField(max_length=100, blank=True)
    report_date = models.DateField(null=True, blank=True)
    
    # New Fields
    contract_value_currency = models.CharField(max_length=10, choices=[('KES', 'KES'), ('USD', 'USD')], default='KES')
    contract_value_amount = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    designated_program = models.CharField(max_length=255, blank=True)

    # Reviewer Emails for sequential workflow
    initiator_email = models.EmailField(blank=True)
    section_1_email = models.EmailField(blank=True)
    section_2_email = models.EmailField(blank=True)
    section_3_email = models.EmailField(blank=True)
    supervisor_email = models.EmailField(blank=True)

    # Section 1 Data (JSON for flexibility or individual fields)
    section_1_data = models.JSONField(default=dict, blank=True)
    section_1_signature = models.TextField(blank=True) # Base64 signature
    
    # Section 2 Data
    section_2_data = models.JSONField(default=dict, blank=True)
    section_2_signature = models.TextField(blank=True)

    # Section 3 Data
    section_3_data = models.JSONField(default=dict, blank=True)
    section_3_signature = models.TextField(blank=True)

    # Supervisor Data
    supervisor_data = models.JSONField(default=dict, blank=True)
    supervisor_signature = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @classmethod
    def generate_serial(cls):
        now = timezone.now()
        year_prefix = now.strftime('%y')
        
        # Look for serials starting with the current year prefix (e.g., "26/")
        serials = cls.objects.filter(serial_no__startswith=f"{year_prefix}/").values_list('serial_no', flat=True)
        
        max_num = 0
        for s in serials:
            try:
                # Format is expected to be "YY/NNN"
                if '/' in s:
                    num_part = s.split('/')[1]
                    max_num = max(max_num, int(num_part))
            except (IndexError, ValueError):
                continue
        
        next_num = max_num + 1
        return f"{year_prefix}/{str(next_num).zfill(3)}"


    def __str__(self):
        return self.serial_no

class FormLink(models.Model):
    form = models.OneToOneField(DepartmentForm, on_delete=models.CASCADE, related_name='access_link')
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    target_email = models.EmailField()
    is_active = models.BooleanField(default=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Link for {self.form.serial_no}"


class DepartmentReviewer(models.Model):
    """
    Workflow reviewer assignments for the department-form pipeline.

    Replaces the previous DEPARTMENT_WORKFLOW_REVIEWER_A..D environment
    variables. One active reviewer per section (A=initiator, B=verifier,
    C=approver, D=supervisor). The optional `tenant` FK lets a country
    tenant override the global default; tenant=NULL is the global fallback.

    Edit via Django admin (no redeploy needed). Mirrors the supplier_form
    SupplierReviewer model — same idea, simpler shape (no `ordinal` because
    department has one reviewer per section by convention).
    """

    SECTION_CHOICES = [
        ('A', 'A — Initiator'),
        ('B', 'B — Verifier'),
        ('C', 'C — Approver'),
        ('D', 'D — Supervisor'),
    ]

    section = models.CharField(max_length=1, choices=SECTION_CHOICES, db_index=True)
    email = models.EmailField()
    is_active = models.BooleanField(default=True, db_index=True)
    tenant = models.ForeignKey(
        'account.Tenant',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='department_reviewers',
        help_text='Country tenant override; leave blank for the global reviewer.',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [('section', 'tenant')]
        indexes = [
            models.Index(fields=['section', 'is_active']),
        ]
        ordering = ['section']

    def __str__(self):
        flag = '' if self.is_active else ' [inactive]'
        scope = f' ({self.tenant.iso_code})' if self.tenant_id else ''
        return f"{self.section} → {self.email}{scope}{flag}"
