"""
KoboToolbox Admin — Operational Visibility

All PII fields (chw_name, whatsapp_number, whatsapp_transcript)
are visible ONLY here in Django Admin with appropriate permissions.
"""

from django.contrib import admin

from kobo.models import KoboSubmission


@admin.register(KoboSubmission)
class KoboSubmissionAdmin(admin.ModelAdmin):
    list_display = [
        'kobo_id',
        'chw_clinic',
        'event_type',
        'severity',
        'case_count',
        'submitted_at',
        'anomaly_flag',
        'has_signal',
    ]
    list_filter = [
        'severity',
        'anomaly_flag',
        'adm0_name',
        'created_at',
    ]
    search_fields = [
        'chw_name',
        'chw_clinic',
        'description',
        'kobo_uuid',
    ]
    ordering = ['-submitted_at']
    readonly_fields = [
        'kobo_id',
        'kobo_uuid',
        'created_at',
        'updated_at',
        'raw_payload',
    ]
    date_hierarchy = 'submitted_at'

    fieldsets = (
        ('Kobo Identifiers', {
            'fields': (
                'kobo_id', 'kobo_uuid', 'xform_id_string', 'form_version',
            ),
        }),
        ('CHW Identity (PII — restricted)', {
            'fields': ('chw_name', 'chw_clinic'),
            'classes': ('collapse',),
            'description': '⚠️ PII — visible to admin users only. '
                           'Never exposed via API.',
        }),
        ('Report Content', {
            'fields': (
                'description', 'event_type', 'event_other',
                'case_count', 'age_group', 'severity',
            ),
        }),
        ('Location — GPS', {
            'fields': ('gps_location', 'text_location'),
        }),
        ('Location — Geocoded', {
            'fields': (
                'adm0_pcode', 'adm0_name',
                'adm1_pcode', 'adm1_name',
                'adm2_pcode', 'adm2_name',
                'geocoded_latitude', 'geocoded_longitude',
                'geocoding_confidence',
            ),
            'classes': ('collapse',),
        }),
        ('Media', {
            'fields': ('photo_evidence', 'comments_text', 'comments_audio'),
            'classes': ('collapse',),
        }),
        ('WhatsApp Integration (PII — restricted)', {
            'fields': ('whatsapp_number', 'whatsapp_transcript'),
            'classes': ('collapse',),
            'description': '⚠️ PII — visible to admin users only. '
                           'Never exposed via API.',
        }),
        ('Signal Link', {
            'fields': ('signal',),
        }),
        ('Metadata', {
            'fields': (
                'submitted_at', 'submitted_by', 'submission_status',
                'anomaly_flag', 'created_at', 'updated_at',
            ),
        }),
        ('Raw Payload', {
            'fields': ('raw_payload',),
            'classes': ('collapse',),
        }),
    )

    @admin.display(boolean=True, description='Signal')
    def has_signal(self, obj: KoboSubmission) -> bool:
        return obj.signal_id is not None
