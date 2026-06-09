from django.contrib import admin

from .models import (
    PredictionSnapshot, OutcomeEvent, MatchVerdict, ScoreCard,
    VeracityIndex, ReviewTicket, CalibrationRecord, EbolaEvent, SourceAudit,
)


@admin.register(PredictionSnapshot)
class PredictionSnapshotAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'source_module', 'prediction_class', 'country_iso',
        'disease_name', 'is_counterfactual', 'payload_complete', 'captured_at',
    ]
    list_filter = ['source_module', 'prediction_class', 'is_counterfactual',
                   'payload_complete', 'disease_name']
    search_fields = ['country_iso', 'country_name', 'disease_name', 'payload_fingerprint']
    readonly_fields = ['payload_fingerprint', 'captured_at']
    ordering = ['-captured_at']


@admin.register(OutcomeEvent)
class OutcomeEventAdmin(admin.ModelAdmin):
    list_display = ['id', 'outcome_type', 'source_feed', 'country_iso',
                    'disease_name', 'occurred_at']
    list_filter = ['outcome_type', 'source_feed', 'disease_name']
    search_fields = ['country_iso', 'disease_name']
    ordering = ['-occurred_at']


@admin.register(MatchVerdict)
class MatchVerdictAdmin(admin.ModelAdmin):
    list_display = ['id', 'snapshot', 'verdict', 'lead_time_days', 'created_at']
    list_filter = ['verdict']
    ordering = ['-created_at']


@admin.register(ScoreCard)
class ScoreCardAdmin(admin.ModelAdmin):
    list_display = ['id', 'granularity', 'source_module', 'country_iso',
                    'disease_name', 'hit_rate', 'precision', 'veracity_contribution',
                    'computed_at']
    list_filter = ['granularity', 'source_module']
    ordering = ['-computed_at']


@admin.register(VeracityIndex)
class VeracityIndexAdmin(admin.ModelAdmin):
    list_display = ['id', 'level', 'source_module', 'index_value',
                    'trend_delta', 'computed_at']
    list_filter = ['level', 'source_module']
    ordering = ['-computed_at']


@admin.register(ReviewTicket)
class ReviewTicketAdmin(admin.ModelAdmin):
    list_display = ['id', 'status', 'reason', 'source_module', 'title', 'opened_at']
    list_filter = ['status', 'reason', 'source_module']
    search_fields = ['title', 'country_iso']
    ordering = ['-opened_at']


@admin.register(CalibrationRecord)
class CalibrationRecordAdmin(admin.ModelAdmin):
    list_display = ['id', 'source_module', 'disease_name', 'suggested_multiplier',
                    'observed_frequency', 'is_active', 'computed_at']
    list_filter = ['source_module', 'is_active']
    ordering = ['-computed_at']


@admin.register(EbolaEvent)
class EbolaEventAdmin(admin.ModelAdmin):
    list_display = ['id', 'event_kind', 'event_uid', 'country_iso',
                    'severity', 'occurred_at']
    list_filter = ['event_kind', 'country_iso']
    search_fields = ['event_uid', 'summary']
    ordering = ['-occurred_at']


@admin.register(SourceAudit)
class SourceAuditAdmin(admin.ModelAdmin):
    list_display = ['id', 'adaptor', 'status', 'staleness_hours', 'checked_at']
    list_filter = ['status', 'adaptor']
    ordering = ['-checked_at']
