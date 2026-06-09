from django.contrib import admin
from .models import User, CustomAuthToken, LoginHistory, Alert, AuditLog

class UserAdmin(admin.ModelAdmin):
    list_display = ('email', 'full_name', 'email_verified', 'is_staff', 'sso_provider')

admin.site.register(User, UserAdmin)
admin.site.register(CustomAuthToken)

admin.site.register(LoginHistory)
admin.site.register(Alert)


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    """
    Read-only admin for audit trail.
    Audit logs are immutable — no editing or deleting allowed.
    """
    list_display = ('timestamp', 'user_email', 'action', 'outcome', 'http_method', 'endpoint', 'ip_address')
    list_filter = ('action', 'outcome', 'http_method', 'timestamp')
    search_fields = ('user_email', 'endpoint', 'detail', 'ip_address', 'resource_type', 'resource_id')
    readonly_fields = [f.name for f in AuditLog._meta.get_fields() if hasattr(f, 'name')]
    date_hierarchy = 'timestamp'
    ordering = ('-timestamp',)
    list_per_page = 50

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False