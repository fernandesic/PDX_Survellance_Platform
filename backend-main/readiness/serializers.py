from rest_framework import serializers
from .models import (
    ArboVirus, Cholera, CholeraSubNational, Cyclone, FVD, FVDPoE,
    LassaFever, LassaFeverDistrict, Marburg, Meningitis,
    MeningitiseElimination, Mpox, MpoxDistrict, NaturalDisaster,
    RiftValleyFever,
    PreparednessReport, ReportTeam, ReportMember,
    WeeklyReport, WeeklyReportLink,
)

# ── Shared base field list for all readiness disease models ──
_BASE_READINESS_FIELDS = [
    'id', 'key_on_table', 'question_id', 'question_key',
    'language', 'category', 'category_code',
    'affects_score', 'category_score', 'category_weight',
    'question_score', 'question_category_weight',
    'category_language', 'question_language',
    'national_yn_value', 'national_yn', 'comments',
    'file_name', 'country', 'admin_level', 'admin_level_name',
    'file_language', 'table', 'row_no', 'question', 'extra_data',
    'h_times_m', 'category_weight_sum_country',
    'weighted_sum_country', 'category_percent_country',
    'category_percent_country_pct',
]

_PERIOD_FIELDS = ['data_period', 'data_period_id']

_GEO_FIELDS = [
    'district', 'category_weight_sum_geo', 'weighted_sum_geo',
    'category_percent_geo', 'category_percent_geo_pct',
]


class ArbovirusSerializer(serializers.ModelSerializer):
    class Meta:
        model = ArboVirus
        fields = _BASE_READINESS_FIELDS

class CholeraSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cholera
        fields = _BASE_READINESS_FIELDS + _PERIOD_FIELDS

class CholeraSubNationalSerializer(serializers.ModelSerializer):
    class Meta:
        model = CholeraSubNational
        fields = _BASE_READINESS_FIELDS + _PERIOD_FIELDS + _GEO_FIELDS

class CycloneSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cyclone
        fields = _BASE_READINESS_FIELDS + _PERIOD_FIELDS

class FVDSerializer(serializers.ModelSerializer):
    class Meta:
        model = FVD
        fields = _BASE_READINESS_FIELDS + _PERIOD_FIELDS

class FVDPoESerializer(serializers.ModelSerializer):
    class Meta:
        model = FVDPoE
        fields = _BASE_READINESS_FIELDS + _PERIOD_FIELDS + ['poe_name'] + _GEO_FIELDS

class LassaFeverSerializer(serializers.ModelSerializer):
    class Meta:
        model = LassaFever
        fields = _BASE_READINESS_FIELDS + _PERIOD_FIELDS

class LassaFeverDistrictSerializer(serializers.ModelSerializer):
    class Meta:
        model = LassaFeverDistrict
        fields = _BASE_READINESS_FIELDS + _PERIOD_FIELDS + ['has_international_poe'] + _GEO_FIELDS

class MarburgSerializer(serializers.ModelSerializer):
    class Meta:
        model = Marburg
        fields = _BASE_READINESS_FIELDS + _PERIOD_FIELDS

class MeningitisSerializer(serializers.ModelSerializer):
    class Meta:
        model = Meningitis
        fields = _BASE_READINESS_FIELDS

class MeningitisEliminationSerializer(serializers.ModelSerializer):
    class Meta:
        model = MeningitiseElimination
        fields = _BASE_READINESS_FIELDS + _PERIOD_FIELDS

class MpoxSerializer(serializers.ModelSerializer):
    class Meta:
        model = Mpox
        fields = _BASE_READINESS_FIELDS + _PERIOD_FIELDS

class MpoxDistrictSerializer(serializers.ModelSerializer):
    class Meta:
        model = MpoxDistrict
        fields = _BASE_READINESS_FIELDS + _PERIOD_FIELDS + _GEO_FIELDS

class NaturalDisasterSerializer(serializers.ModelSerializer):
    class Meta:
        model = NaturalDisaster
        fields = _BASE_READINESS_FIELDS + _PERIOD_FIELDS

class RiftValleySerializer(serializers.ModelSerializer):
    class Meta:
        model = RiftValleyFever
        fields = _BASE_READINESS_FIELDS + _PERIOD_FIELDS


# ── Legacy report serializers ──

class PreparednessReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = PreparednessReport
        fields = [
            'id', 'member', 'team', 'week_range',
            'featured_achievement', 'readiness', 'naphs',
            'community_protection', 'workforce_training',
            'pandemic_influenza', 'vaccines_research',
            'key_figures', 'health_security_governance',
            'health_security_financing', 'threats_risks_management',
            'diseases_under_elimination', 'innovative_projects',
            'created_on',
        ]


class ReportTeamSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReportTeam
        fields = ['id', 'supervisor', 'name', 'code', 'is_active', 'created_on']


class ReportMemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReportMember
        fields = ['id', 'team', 'name', 'email', 'is_active', 'created_on']


class TeamLookupSerializer(serializers.Serializer):
    team_code = serializers.CharField(max_length=50)
    email = serializers.EmailField()


# ── New Weekly Report System ──

class WeeklyReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = WeeklyReport
        fields = [
            'id', 'link', 'week_range',
            'featured_achievement', 'key_figures',
            'featured_achievement_image', 'key_figures_image',
            'health_security_governance', 'health_security_financing',
            'threats_risks_management', 'ihrme', 'ipc',
            'readiness', 'naphs', 'community_protection',
            'workforce_training', 'pandemic_influenza', 'vaccines_research',
            'diseases_under_elimination', 'one_health', 'innovative_projects',
            'hedrm', 'created_on', 'updated_on',
        ]


class WeeklyReportListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views — excludes heavy base64 image fields."""
    class Meta:
        model = WeeklyReport
        exclude = ['featured_achievement_image', 'key_figures_image']


class WeeklyReportLinkSerializer(serializers.ModelSerializer):
    is_expired = serializers.BooleanField(read_only=True)

    class Meta:
        model = WeeklyReportLink
        fields = ['id', 'token', 'week_range', 'created_at', 'expires_at', 'is_active', 'is_expired']