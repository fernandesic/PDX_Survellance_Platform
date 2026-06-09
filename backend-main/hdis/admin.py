"""
HDIS Intelligence - Django Admin Configuration
"""

from django.contrib import admin
from hdis.models import Alert, Briefing, TrustScore
from hdis.source_config import SourceConfig


@admin.register(TrustScore)
class TrustScoreAdmin(admin.ModelAdmin):
    list_display = ['signal', 'score', 'trust_level', 'corroboration_count', 'computed_at']
    list_filter = ['trust_level']
    search_fields = ['signal__original_text', 'signal__disease_name']
    readonly_fields = ['score', 'trust_level', 'source_tier_weight',
                       'corroboration_count', 'disease_match_confidence',
                       'recency_factor', 'computed_at']


@admin.register(Alert)
class AlertAdmin(admin.ModelAdmin):
    list_display = ['trigger_reason_short', 'risk_level', 'confidence_score',
                    'multi_source_validated', 'acknowledged_by', 'created_at']
    list_filter = ['risk_level', 'multi_source_validated']
    search_fields = ['trigger_reason', 'signal__original_text']
    readonly_fields = ['created_at']
    raw_id_fields = ['signal', 'acknowledged_by']

    def trigger_reason_short(self, obj):
        return obj.trigger_reason[:80] + '...' if len(obj.trigger_reason) > 80 else obj.trigger_reason
    trigger_reason_short.short_description = 'Trigger Reason'


@admin.register(Briefing)
class BriefingAdmin(admin.ModelAdmin):
    list_display = ['briefing_type', 'status', 'generated_by', 'generated_at']
    list_filter = ['status', 'briefing_type']
    readonly_fields = ['generated_at']
    raw_id_fields = ['published_by']


@admin.register(SourceConfig)
class SourceConfigAdmin(admin.ModelAdmin):
    list_display = [
        'name', 'source_type', 'default_pillar', 'source_tier',
        'is_active', 'total_ingested', 'last_polled_at',
    ]
    list_filter = ['source_type', 'default_pillar', 'is_active', 'source_tier']
    search_fields = ['name', 'slug', 'url']
    prepopulated_fields = {'slug': ('name',)}
    readonly_fields = ['total_ingested', 'total_rejected', 'total_duplicates', 'last_polled_at', 'last_error']
    fieldsets = (
        ('Identity', {
            'fields': ('name', 'slug', 'description'),
        }),
        ('Connection', {
            'fields': ('source_type', 'url', 'auth_header', 'extra_params'),
        }),
        ('Classification', {
            'fields': ('default_pillar', 'source_tier'),
        }),
        ('Filtering', {
            'fields': ('keyword_include', 'keyword_exclude', 'require_africa'),
        }),
        ('Schedule', {
            'fields': ('is_active', 'poll_interval_minutes'),
        }),
        ('Stats (read-only)', {
            'fields': ('total_ingested', 'total_rejected', 'total_duplicates', 'last_polled_at', 'last_error'),
            'classes': ('collapse',),
        }),
    )
