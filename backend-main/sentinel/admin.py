from django.contrib import admin
from .models import (
    AgentRun,
    AgentStep,
    DiseaseKeyword,
    Signal,
    SourceCredibility,
)


@admin.register(SourceCredibility)
class SourceCredibilityAdmin(admin.ModelAdmin):
    list_display = ['source_name', 'source_type', 'tier', 'credibility_score', 'total_signals', 'validated_signals']
    list_filter = ['tier', 'source_type']
    search_fields = ['source_name']
    ordering = ['-credibility_score']


@admin.register(DiseaseKeyword)
class DiseaseKeywordAdmin(admin.ModelAdmin):
    list_display = ['disease_name', 'category', 'default_priority']
    list_filter = ['category', 'default_priority']
    search_fields = ['disease_name', 'keywords_en', 'keywords_fr', 'keywords_sw', 'keywords_ha']
    ordering = ['disease_name']


@admin.register(Signal)
class SignalAdmin(admin.ModelAdmin):
    list_display = ['id', 'priority', 'status', 'disease_name', 'location_country', 'source_name', 'created_at']
    list_filter = ['priority', 'status', 'disease_category', 'location_country_iso', 'source_tier']
    search_fields = ['disease_name', 'location_country', 'original_text', 'translated_text']
    ordering = ['-created_at']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Classification', {
            'fields': ('signal_type', 'disease_name', 'disease_category', 'priority', 'status', 'confidence_score')
        }),
        ('Location', {
            'fields': ('location_country', 'location_country_iso', 'location_admin1', 'location_admin2', 'location_lat', 'location_lng')
        }),
        ('Content', {
            'fields': ('original_text', 'original_language', 'translated_text', 'lingua_fidelity_score')
        }),
        ('Source', {
            'fields': ('source_name', 'source_url', 'source_tier', 'source_type', 'ingestion_source')
        }),
        ('Epidemiology', {
            'fields': ('reported_cases', 'reported_deaths', 'cross_border_risk')
        }),
        ('Analyst', {
            'fields': ('analyst_notes', 'triaged_by', 'triaged_at', 'validated_by', 'validated_at')
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at', 'raw_payload'),
            'classes': ('collapse',)
        }),
    )


class AgentStepInline(admin.TabularInline):
    model = AgentStep
    extra = 0
    fields = ['step_number', 'kind', 'agent_name', 'output_summary', 'latency_ms', 'created_at']
    readonly_fields = ['created_at']
    ordering = ['step_number']


@admin.register(AgentRun)
class AgentRunAdmin(admin.ModelAdmin):
    list_display = ['run_id', 'signal', 'status', 'confidence', 'corroboration_count', 'provider', 'model_name', 'started_at']
    list_filter = ['status', 'provider']
    search_fields = ['run_id', 'signal__disease_name', 'signal__location_country']
    readonly_fields = ['run_id', 'started_at']
    ordering = ['-started_at']
    inlines = [AgentStepInline]


@admin.register(AgentStep)
class AgentStepAdmin(admin.ModelAdmin):
    list_display = ['id', 'run', 'step_number', 'kind', 'agent_name', 'latency_ms', 'created_at']
    list_filter = ['kind']
    search_fields = ['run__run_id', 'agent_name', 'output_summary']
    readonly_fields = ['created_at']
    ordering = ['-created_at']
