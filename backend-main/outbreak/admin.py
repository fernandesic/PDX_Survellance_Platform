"""
Outbreak Workspace — Admin Configuration

Per arc.md: OutbreakEvent admin is read-only (no Add button, no edit form).
"""

from django.contrib import admin

from .models import (
    Pathogen,
    Outbreak,
    OutbreakEvent,
    OutbreakHistoricalEpisode,
    NotificationRule,
    OutbreakNotification,
    OutbreakDecision,
    LlmInteraction,
)


@admin.register(Pathogen)
class PathogenAdmin(admin.ModelAdmin):
    list_display = ['name', 'family', 'r0_min', 'r0_max', 'cfr_min', 'cfr_max',
                    'vaccine_available', 'antiviral_available']
    list_filter = ['vaccine_available', 'antiviral_available', 'family']
    search_fields = ['name', 'family']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(Outbreak)
class OutbreakAdmin(admin.ModelAdmin):
    list_display = [
        '__str__', 'iso3', 'status', 'severity',
        'confirmed_cases', 'confirmed_deaths', 'confirmed_as_of',
        'declared_at', 'lead_focal_point',
    ]
    list_filter = ['status', 'severity', 'iso3']
    search_fields = ['pathogen__name', 'iso3', 'summary']
    readonly_fields = ['created_at', 'updated_at']
    raw_id_fields = ['pathogen']
    fieldsets = (
        (None, {
            'fields': (
                'pathogen', 'iso3', 'regions', 'neighbor_iso3s',
                'declared_at', 'status', 'severity',
                'lead_focal_point', 'summary',
            ),
        }),
        ('Confirmed counts (authoritative — banner uses these)', {
            'fields': (
                'confirmed_cases', 'confirmed_deaths',
                'confirmed_as_of', 'confirmed_source',
            ),
            'description': (
                'Enter these from the latest Ministry / WHO DON sitrep. '
                'The workspace banner displays these as the headline numbers. '
                'Leave blank if no authoritative count is available yet — '
                'the banner will show "pending entry" rather than guess from '
                'aggregated news signals.'
            ),
        }),
        ('Audit', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )


@admin.register(OutbreakEvent)
class OutbreakEventAdmin(admin.ModelAdmin):
    """
    Read-only. OutbreakEvent is immutable — no Add, no Edit.
    """
    list_display = ['id', 'outbreak', 'kind', 'source', 'geo', 'confidence',
                    'ts', 'created_at']
    list_filter = ['kind', 'source', 'outbreak']
    search_fields = ['source_ref', 'geo']
    readonly_fields = [
        'id', 'outbreak', 'ts', 'source', 'kind', 'geo',
        'payload_json', 'confidence', 'source_ref', 'created_at',
    ]
    ordering = ['-ts']

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(OutbreakHistoricalEpisode)
class OutbreakHistoricalEpisodeAdmin(admin.ModelAdmin):
    list_display = ['__str__', 'country', 'year_start', 'year_end',
                    'cases', 'deaths']
    list_filter = ['pathogen', 'country']
    search_fields = ['country', 'response_summary', 'lessons']
    readonly_fields = ['created_at', 'updated_at']
    raw_id_fields = ['pathogen']
    fieldsets = [
        (None, {
            'fields': ['pathogen', 'country', 'country_iso3',
                       'year_start', 'year_end', 'cases', 'deaths'],
        }),
        ('Response & Lessons (manually curated only — no LLM-generated content)', {
            'fields': ['response_summary', 'lessons'],
        }),
        ('Sources', {
            'fields': ['source_urls'],
            'description': 'Every episode must cite at least one source URL.',
        }),
        ('Timestamps', {
            'fields': ['created_at', 'updated_at'],
        }),
    ]


@admin.register(NotificationRule)
class NotificationRuleAdmin(admin.ModelAdmin):
    list_display = ['__str__', 'channel', 'severity_threshold', 'enabled',
                    'hold_seconds', 'auto_send_after_hold']
    list_filter = ['channel', 'enabled', 'severity_threshold']
    search_fields = ['role', 'region']
    readonly_fields = ['created_at', 'updated_at']
    raw_id_fields = ['pathogen']


@admin.register(OutbreakNotification)
class OutbreakNotificationAdmin(admin.ModelAdmin):
    list_display = ['__str__', 'outbreak', 'state', 'channel',
                    'dispatched_at', 'created_at']
    list_filter = ['state', 'channel']
    search_fields = ['rendered_message', 'error']
    readonly_fields = [
        'outbreak', 'rule', 'event', 'rendered_message', 'channel',
        'hold_until', 'dispatched_at', 'error', 'created_at', 'updated_at',
    ]


@admin.register(OutbreakDecision)
class OutbreakDecisionAdmin(admin.ModelAdmin):
    """Append-only — admin is read-only except for adding new entries."""
    list_display = ['id', 'outbreak', 'kind', 'title', 'author', 'created_at']
    list_filter = ['kind']
    search_fields = ['title', 'body', 'author']
    readonly_fields = [
        'outbreak', 'kind', 'title', 'body', 'author',
        'evidence_event_ids', 'citations', 'created_at',
    ]

    def has_change_permission(self, request, obj=None):
        return obj is None  # form usable for create only

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(LlmInteraction)
class LlmInteractionAdmin(admin.ModelAdmin):
    """Audit trail — read-only."""
    list_display = ['id', 'outbreak', 'source', 'canned_query',
                    'refusal_reason', 'latency_ms', 'created_at']
    list_filter = ['source', 'provider']
    search_fields = ['question', 'final_answer', 'refusal_reason']
    readonly_fields = [
        'outbreak', 'source', 'question', 'grounding_summary',
        'raw_response', 'final_answer', 'refusal_reason',
        'citations_matched', 'canned_query', 'model', 'provider',
        'latency_ms', 'prompt_tokens', 'completion_tokens', 'created_at',
    ]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
