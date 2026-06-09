from django.db import models
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.utils import timezone
from django.conf import settings
from django.core.validators import RegexValidator
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey
from uuid import uuid4
import datetime, secrets
from datetime import timedelta

phone_validator = RegexValidator(
    regex=r'^\+\d{6,15}$',
    message="Phone number must be entered in the format: +234xxxxxxxxxx. Up to 15 digits allowed."
)

def generate_token():
    return secrets.token_hex(32)  # 64-char string

def get_setting(name, default):
    return getattr(settings, 'CUSTOM_AUTH', {}).get(name, default)

class CustomAuthToken(models.Model):
    access_token = models.CharField(max_length=64, unique=True, default=generate_token)
    refresh_token = models.CharField(max_length=64, unique=True, default=generate_token)

    access_expires_at = models.DateTimeField()
    refresh_expires_at = models.DateTimeField()

    # Generic relation to the user-like object
    user_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    user_id = models.PositiveIntegerField()
    user = GenericForeignKey('user_type', 'user_id')

    # Session tracking fields for multi-device and multi-browser support
    device_info = models.CharField(max_length=255, blank=True, null=True, help_text="Browser/Device information")
    browser_session_id = models.CharField(max_length=64, blank=True, null=True, help_text="Unique browser session identifier")
    last_used = models.DateTimeField(auto_now=True, help_text="Last time this token was used")

    created = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['user_type', 'user_id']),
            models.Index(fields=['access_token']),
            models.Index(fields=['refresh_token']),
        ]
        ordering = ['-created']

    def has_access_expired(self):
        return timezone.now() >= self.access_expires_at

    def has_refresh_expired(self):
        return timezone.now() >= self.refresh_expires_at
    
    def rotate_access_token(self):
        self.access_token = generate_token()
        self.access_expires_at = timezone.now() + timedelta(
            minutes=get_setting('ACCESS_TOKEN_LIFESPAN_MINUTES', 15)
        )
        self.save()

    def refresh(self):
        self.access_token = generate_token()
        self.refresh_token = generate_token()
        self.access_expires_at = timezone.now() + timedelta(minutes=get_setting('ACCESS_TOKEN_LIFESPAN_MINUTES', 15))
        self.refresh_expires_at = timezone.now() + timedelta(days=get_setting('REFRESH_TOKEN_LIFESPAN_DAYS', 1))
        self.save()
        return self
    
    @classmethod
    def cleanup_expired_tokens(cls):
        """Delete all expired tokens to prevent database bloat"""
        now = timezone.now()
        expired_count = cls.objects.filter(refresh_expires_at__lt=now).delete()[0]
        return expired_count
    
    def __str__(self):
        return f"Token for user {self.user_id} - {self.device_info or 'Unknown device'}"


class Tenant(models.Model):
    """
    Represents a WHO AFRO member state or the continental AFRO HQ.
    This is the anchor for all Row-Level Security (RLS) policies.

    - 47 rows for AFRO member states (NGA, KEN, GHA, ...)
    - 1 row for AFRO continental (is_continental=True)
    - Super admins belong to the continental tenant and see everything
    - Country users belong to their country tenant and see only their data
    """
    name = models.CharField(max_length=100, unique=True, help_text='Country name, e.g. Nigeria')
    iso_code = models.CharField(max_length=3, unique=True, db_index=True, help_text='ISO 3166-1 alpha-3, e.g. NGA')
    is_continental = models.BooleanField(
        default=False,
        help_text='True only for the AFRO HQ continental tenant (super admin scope)',
    )
    is_active = models.BooleanField(default=True)
    who_region = models.CharField(max_length=50, blank=True, default='', help_text='WHO sub-region, e.g. West Africa')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'Tenant'
        verbose_name_plural = 'Tenants'

    def __str__(self):
        label = 'Continental' if self.is_continental else self.iso_code
        return f"{self.name} ({label})"


class Role(models.Model):
    ROLE_CHOICES = (
        ('super_admin', 'Super Admin'),
        ('admin', 'Admin'),
        ('user', 'User'),
        ('supplier', 'Supplier'),
        ('department', 'Department'),
    )
    name = models.CharField(max_length=50, choices=ROLE_CHOICES, unique=True)
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.get_name_display()

    class Meta:
        verbose_name = 'Role'
        verbose_name_plural = 'Roles'


class UserManager(BaseUserManager):
    def create_user(self, email, password, **other_fields):
        email = self.normalize_email(email)
        if not other_fields.get("username"):
            other_fields["username"] = str(uuid4())[:30]  # generate unique username

        user = self.model(
            email=email,
            **other_fields
        )
        user.set_password(password)
        user.save()
        return user

    def create_superuser(self, email, password, **other_fields):
        user = self.create_user(
            email = self.normalize_email(email),
            password=password,
            **other_fields
        )
        user.email_verified = True
        user.is_admin = True
        user.is_active = True
        user.is_staff = True
        user.is_superuser = True
        user.save(using=self._db)
        return user
    

class User(AbstractUser):
    email = models.EmailField(blank=False, unique=True)
    full_name = models.CharField(blank=False, max_length=255)
    username = models.CharField(blank=True, null=True, max_length=255)
    date_of_birth = models.CharField(max_length=255, blank=False)
    phone_number = models.CharField(
        max_length=16,
        unique=True,
        null=True,
        validators=[phone_validator],
        help_text="Enter your Number in international format, e.g. +234XXXXXXXXXX",
        error_messages={
            'unique': 'This phone number is already registered',
            'required': 'We need your phone to onboard you.'
        }
    )
    country = models.CharField(max_length=255, blank=False)

    email_verified = models.BooleanField(default=False)
    has_accepted_terms = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False)

    otp_secret = models.CharField(max_length=32, blank=True, null=True)
    is_2fa_enabled = models.BooleanField(default=False)

    lock_count = models.PositiveIntegerField(default=0)
    lock_duration = models.DateTimeField(blank=True, null=True)
    last_email_change = models.DateTimeField(null=True, blank=True)

    # ── SSO fields ────────────────────────────────────────────────
    sso_provider = models.CharField(
        max_length=50, blank=True, null=True,
        help_text='SSO provider name, e.g. "microsoft"',
    )
    sso_uid = models.CharField(
        max_length=255, blank=True, null=True,
        help_text='SSO subject (sub) claim — unique ID from the Identity Provider',
    )
    sso_last_synced = models.DateTimeField(
        blank=True, null=True,
        help_text='Last time user profile was synced from the Identity Provider',
    )

    role = models.ForeignKey('Role', on_delete=models.SET_NULL, null=True, blank=True, related_name='users')
    tenant = models.ForeignKey(
        'Tenant',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='users',
        help_text='The country/tenant this user belongs to. Null = unassigned (legacy).',
    )
    
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []
    objects = UserManager()

    def __str__(self):
        return f'{self.email}'
    
    @property
    def is_super_admin(self) -> bool:
        """True if user is a super admin (continental tenant, role=super_admin, or Django is_superuser)."""
        if self.is_superuser:
            return True
        if self.role and self.role.name == 'super_admin':
            return True
        if self.tenant and self.tenant.is_continental:
            return True
        return False

    @property
    def tenant_id_for_rls(self) -> str:
        """
        Returns the tenant ID string for PostgreSQL RLS session variable.
        - '0' = super admin (see all rows)
        - '<id>' = country tenant (see only their rows)
        - '-1' = no tenant (see zero rows — fail-closed)
        """
        if self.is_super_admin:
            return '0'
        if self.tenant_id:
            return str(self.tenant_id)
        return '-1'

    def is_locked(self):
        now = timezone.now()
        if self.lock_duration:
            if self.lock_duration <= now:
                return False
            return True
        return False 
    
    
class LoginHistory(models.Model):
    ACTION_CHOICES = [
        ('login', 'Login'),
        ('logout', 'Logout'),
    ]

    STATUS_CHOICES = [
        ('success', 'Success'),
        ('failed', 'Failed'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    action = models.CharField(max_length=10, choices=ACTION_CHOICES)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES)
    ip_address = models.GenericIPAddressField()
    browser = models.CharField(max_length=255)
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        user_display = self.user.email if self.user else "Unknown User"
        return f"{user_display} - {self.action} - {self.status} @ {self.timestamp}"
    
    

class Alert(models.Model):
    STATUS_CHOICES = (
        ("active", "active"),
        ("acknowledged", "acknowledged"),
        ("resolved", "resolved")
    )
    SEVERITY_CHOICES = (
        ("critical", "CRITICAL"),
        ("high", "HIGH"),
        ("medium", "MEDIUM"),
        ("low", "LOW"),
    )
    CATEGORY_CHOICES = (
        ('disease_outbreak', "Disease Outbreak"),
        ('resource_shortage', "Resource Shortage"),
        ("natural_disaster", "Natural Disaster"),
        ("administrative", "Administrative"),
        ("capaticy_alert", "Capacity Alert")
    )
    title = models.CharField(max_length=255)
    description = models.TextField()
    category = models.CharField(max_length=255, choices=CATEGORY_CHOICES)
    status = models.CharField(max_length=50, choices=STATUS_CHOICES)
    severity = models.CharField(max_length=50, choices=SEVERITY_CHOICES)
    country = models.CharField(max_length=100)
    region = models.CharField(max_length=100)
    date = models.DateTimeField(auto_now_add=True)
    acknowledge_by = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    last_updated_date = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.title} - {self.status} - {self.severity}"


class AuditLog(models.Model):
    """
    Immutable audit trail for sensitive operations.

    Records WHO did WHAT to WHICH resource, from WHERE, and WHEN.
    Entries are append-only — never update or delete audit rows.
    """

    class Action(models.TextChoices):
        LOGIN_SUCCESS = 'login_success', 'Login Success'
        LOGIN_FAILED = 'login_failed', 'Login Failed'
        LOGOUT = 'logout', 'Logout'
        TOKEN_REFRESH = 'token_refresh', 'Token Refresh'
        DATA_UPLOAD = 'data_upload', 'Data Upload'
        DATA_DELETE = 'data_delete', 'Data Delete'
        DATA_EXPORT = 'data_export', 'Data Export'
        FORM_GENERATE = 'form_generate', 'Form Generate'
        FORM_SUBMIT = 'form_submit', 'Form Submit'
        FORM_DELETE = 'form_delete', 'Form Delete'
        REPORT_CREATE = 'report_create', 'Report Create'
        REPORT_UPDATE = 'report_update', 'Report Update'
        REPORT_DELETE = 'report_delete', 'Report Delete'
        LINK_GENERATE = 'link_generate', 'Link Generate'
        LINK_REACTIVATE = 'link_reactivate', 'Link Reactivate'
        ALERT_ACKNOWLEDGE = 'alert_acknowledge', 'Alert Acknowledge'
        ALERT_RESOLVE = 'alert_resolve', 'Alert Resolve'
        ADMIN_ACTION = 'admin_action', 'Admin Action'

    class Outcome(models.TextChoices):
        SUCCESS = 'success', 'Success'
        FAILURE = 'failure', 'Failure'
        DENIED = 'denied', 'Denied'

    # WHO
    user = models.ForeignKey(
        User, on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='audit_logs',
        help_text='User who performed the action (null for anonymous/failed logins)',
    )
    user_email = models.TextField(blank=True, default='',
        help_text='Snapshot of user email at audit time (survives user deletion)',
    )

    # WHAT
    action = models.TextField(choices=Action.choices, db_index=True)
    outcome = models.TextField(choices=Outcome.choices, default=Outcome.SUCCESS)
    detail = models.TextField(
        blank=True, default='',
        help_text='Human-readable description of what happened',
    )

    # WHICH (the resource acted upon)
    resource_type = models.TextField(blank=True, default='',
        help_text='Model/entity type, e.g. "StarData", "WeeklyReport"',
    )
    resource_id = models.TextField(blank=True, default='',
        help_text='Primary key or identifier of the resource',
    )

    # WHERE (request metadata)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True, default='')
    endpoint = models.TextField(blank=True, default='')
    http_method = models.TextField(blank=True, default='')

    # WHEN
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    # ── Multi-tenancy (Phase 2.1) ────────────────────────────────
    # Links audit entries to a tenant for RLS scoping.
    # Stays nullable FOREVER — anonymous events (failed logins, system actions)
    # have no user to derive a tenant from. See Mistake 4 in mistakes.md.
    # Under RLS: null-tenant rows visible to super admin only.
    tenant = models.ForeignKey(
        'Tenant',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='audit_logs_tenant',
        help_text='Tenant for RLS scoping. Null = anonymous/system event (super-admin visible only).',
    )

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['user', 'action']),
            models.Index(fields=['action', 'timestamp']),
            models.Index(fields=['endpoint']),
        ]
        verbose_name = 'Audit Log'
        verbose_name_plural = 'Audit Logs'

    def __str__(self):
        who = self.user_email or 'anonymous'
        return f"[{self.timestamp:%Y-%m-%d %H:%M}] {who} → {self.get_action_display()} ({self.outcome})"