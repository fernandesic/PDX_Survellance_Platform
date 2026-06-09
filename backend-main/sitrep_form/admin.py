"""
SITREP Form — Django Admin Registration
"""
from django.contrib import admin
from .models import SitrepLink, SitrepReport, SitrepFieldEdit


@admin.register(SitrepLink)
class SitrepLinkAdmin(admin.ModelAdmin):
    list_display = ('sitrep_number', 'token', 'is_active', 'is_expired', 'created_at', 'expires_at')
    list_filter = ('is_active',)
    search_fields = ('sitrep_number', 'token')
    readonly_fields = ('token', 'created_at')

    def is_expired(self, obj):
        return obj.is_expired
    is_expired.boolean = True


@admin.register(SitrepReport)
class SitrepReportAdmin(admin.ModelAdmin):
    list_display = ('sitrep_number', 'selected_country', 'reporting_period', 'created_on', 'updated_on')
    search_fields = ('sitrep_number', 'selected_country')
    list_filter = ('selected_country',)
    readonly_fields = ('created_on', 'updated_on')


@admin.register(SitrepFieldEdit)
class SitrepFieldEditAdmin(admin.ModelAdmin):
    list_display = ('report', 'field_name', 'edited_by', 'edited_at')
    list_filter = ('field_name', 'edited_by')
    search_fields = ('field_name', 'edited_by')
    readonly_fields = ('edited_at',)
