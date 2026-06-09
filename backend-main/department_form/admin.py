from django.contrib import admin

from .models import DepartmentReviewer


@admin.register(DepartmentReviewer)
class DepartmentReviewerAdmin(admin.ModelAdmin):
    list_display = ('section', 'email', 'is_active', 'tenant', 'updated_at')
    list_filter = ('section', 'is_active', 'tenant')
    search_fields = ('email',)
    ordering = ('section',)
    list_editable = ('email', 'is_active')
    fieldsets = (
        (None, {
            'fields': ('section', 'email', 'is_active'),
            'description': (
                'Edit a department-form reviewer. Changes take effect within ~60s '
                '(reviewer cache TTL) — no server restart required.'
            ),
        }),
        ('Scope', {
            'fields': ('tenant',),
            'description': (
                'Leave Tenant blank for the global default (current behaviour). '
                'Set a tenant to override the reviewer for that country only.'
            ),
        }),
    )
