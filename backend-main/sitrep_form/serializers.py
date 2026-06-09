"""
SITREP Form — DRF Serializers
"""
import json
from rest_framework import serializers
from .models import SitrepReport


class SitrepReportSerializer(serializers.ModelSerializer):
    """Full serializer — used for form data retrieval and detail views."""

    class Meta:
        model = SitrepReport
        fields = [
            'id', 'sitrep_number',
            # Section 0
            'reporting_period', 'date_of_issue', 'data_cutoff',
            'classification', 'geographic_scope', 'triggering_event',
            'prepared_by', 'cleared_by', 'next_issue',
            # Section 1
            'population_in_screening', 'high_risk_poe',
            'referred', 'isolated', 'suspected',
            # Section 3
            'selected_country', 'checklist_responses',
            # Section 4
            'action_points',
            # Section 5
            'planned_actions',
            # Section 5b — Weekly Highlights
            'weekly_highlights',
            # Section 6
            'key_challenges',
            # Meta
            'created_on', 'updated_on',
        ]
        read_only_fields = ['id', 'created_on', 'updated_on']


class SitrepReportListSerializer(serializers.ModelSerializer):
    """Light serializer — used for the admin dashboard list view."""

    class Meta:
        model = SitrepReport
        fields = [
            'id', 'sitrep_number', 'reporting_period',
            'selected_country', 'created_on', 'updated_on',
        ]
        read_only_fields = ['id', 'created_on', 'updated_on']
