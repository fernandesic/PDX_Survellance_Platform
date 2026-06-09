from django.contrib import admin

from .models import SupplierReviewer


@admin.register(SupplierReviewer)
class SupplierReviewerAdmin(admin.ModelAdmin):
    list_display = ('section', 'ordinal', 'email', 'is_active', 'tenant', 'updated_at')
    list_filter = ('section', 'is_active', 'tenant')
    search_fields = ('email',)
    ordering = ('section', 'ordinal')
    list_editable = ('email', 'is_active')
    fieldsets = (
        (None, {
            'fields': ('section', 'ordinal', 'email', 'is_active'),
            'description': (
                'Edit a supplier-form reviewer. Changes take effect within ~60s '
                '(reviewer cache TTL) — no server restart required.'
            ),
        }),
        ('Scope', {
            'fields': ('tenant',),
            'description': (
                'Leave Tenant blank for the global default bench (current behaviour). '
                'Set a tenant to override the bench for that country only.'
            ),
        }),
    )
