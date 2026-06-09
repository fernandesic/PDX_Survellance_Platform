"""
Readiness Upload Views — Generic upload handler replacing 14 identical views.

Each disease-specific upload class now inherits from BaseUploadView and only
specifies model_class, key_prefix, and extra_fields—eliminating ~200 lines of
copy-pasted boilerplate.
"""
import re
import pandas as pd
from rest_framework.views import APIView
from rest_framework import status

from account.serializers import FileUploadSerializer
from utils.index import gen_unique_key, custom_response
from utils.tenant_resolver import resolve_tenant
from ..models import (
    ArboVirus, Cholera, CholeraSubNational, Cyclone, FVD, FVDPoE,
    LassaFever, LassaFeverDistrict, Marburg, Meningitis,
    MeningitiseElimination, Mpox, MpoxDistrict, NaturalDisaster,
    RiftValleyFever,
)


# ─── Helpers ────────────────────────────────────────────────────────────

def snake_case(name: str) -> str:
    """Convert CamelCase / PascalCase to snake_case, preserving acronyms."""
    if name == 'PoEName':
        return 'poe_name'
    name = re.sub(r'([a-z0-9])([A-Z])', r'\1_\2', name)
    name = re.sub(r'([A-Z]+)([A-Z][a-z])', r'\1_\2', name)
    return name.lower()


def extract_base_data(row, extra_fields=None):
    """Extract base data fields from a row."""
    fields = [
        'QuestionId', 'QuestionKey', 'Language', 'Category', 'CategoryCode',
        'AffectsScore', 'CategoryScore', 'CategoryWeight', 'QuestionScore',
        'QuestionCategoryWeight', 'CategoryLanguage', 'QuestionLanguage',
        'NationalYNValue', 'NationalYN', 'Comments', 'FileName', 'Country',
        'AdminLevel', 'AdminLevelName', 'FileLanguage', 'Table',
        'RowNo', 'Question',
    ]
    if extra_fields:
        fields.extend(extra_fields)
    return {snake_case(f): row.get(f, None) for f in fields}


def process_csv_upload(file, model_class, key_prefix, extra_fields=None):
    """Generic CSV → DB importer.  Returns (records_created, error_msg)."""
    try:
        df = pd.read_csv(file)
        df = df.where(pd.notna(df), None)

        records_created = 0
        for idx, row in df.iterrows():
            base_data = extract_base_data(row, extra_fields)
            unique_key = gen_unique_key(key_prefix, idx)
            base_data['tenant'] = resolve_tenant(name=base_data.get('country'))
            model_class.objects.update_or_create(
                key_on_table=unique_key,
                defaults=base_data,
            )
            records_created += 1

        return records_created, None
    except Exception as e:  # noqa: BLE001 — upload helper: any failure is reported via (count, error_message) tuple to the view
        return 0, str(e)


# ─── Base Upload View ───────────────────────────────────────────────────

class BaseUploadView(APIView):
    """
    Generic upload view.  Subclasses only need to set:
        model_class  — Django model
        key_prefix   — unique prefix for key_on_table
        extra_fields — list of additional CSV columns (default [])
    """
    model_class = None
    key_prefix = ''
    extra_fields = []

    def post(self, request, *args, **kwargs):
        serializer = FileUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        file = serializer.validated_data['file']

        records, error = process_csv_upload(
            file, self.model_class, self.key_prefix, self.extra_fields,
        )

        if error:
            return custom_response(
                "ERROR",
                message=f"Failed to import: {error}",
                data={},
                http_status=status.HTTP_400_BAD_REQUEST,
            )
        return custom_response(
            "OK",
            message=f"Data imported successfully. {records} records created.",
            data={"records_created": records},
            http_status=status.HTTP_200_OK,
        )


# ─── Concrete Upload Views (one-liners) ────────────────────────────────

class ArboVirusUploadView(BaseUploadView):
    model_class = ArboVirus
    key_prefix = 'arbovirus'


class CholeraUploadView(BaseUploadView):
    model_class = Cholera
    key_prefix = 'cholera'
    extra_fields = ['DataPeriod', 'DataPeriodId']


class CholeraSubNationalUploadView(BaseUploadView):
    model_class = CholeraSubNational
    key_prefix = 'cholerasubnational'
    extra_fields = ['DataPeriod', 'DataPeriodId', 'District']


class CycloneUploadView(BaseUploadView):
    model_class = Cyclone
    key_prefix = 'cyclone'
    extra_fields = ['DataPeriod', 'DataPeriodId']


class FVDUploadView(BaseUploadView):
    model_class = FVD
    key_prefix = 'fvd'
    extra_fields = ['DataPeriod', 'DataPeriodId']


class FVDPoEUploadView(BaseUploadView):
    model_class = FVDPoE
    key_prefix = 'fvdpoe'
    extra_fields = ['DataPeriod', 'DataPeriodId', 'District', 'PoEName']


class LassaFeverUploadView(BaseUploadView):
    model_class = LassaFever
    key_prefix = 'lassafever'
    extra_fields = ['DataPeriod', 'DataPeriodId']


class LassaFeverDistrictUploadView(BaseUploadView):
    model_class = LassaFeverDistrict
    key_prefix = 'lassafeverdistrict'
    extra_fields = ['DataPeriod', 'DataPeriodId', 'HasInternationalPOE', 'District']


class MarburgUploadView(BaseUploadView):
    model_class = Marburg
    key_prefix = 'marburg'
    extra_fields = ['DataPeriod', 'DataPeriodId']


class MeningitisUploadView(BaseUploadView):
    model_class = Meningitis
    key_prefix = 'meningitis'


class MeningitiseEliminationUploadView(BaseUploadView):
    model_class = MeningitiseElimination
    key_prefix = 'meningitiseelimination'
    extra_fields = ['DataPeriod', 'DataPeriodId']


class MpoxUploadView(BaseUploadView):
    model_class = Mpox
    key_prefix = 'mpox'
    extra_fields = ['DataPeriod', 'DataPeriodId']


class MpoxDistrictUploadView(BaseUploadView):
    model_class = MpoxDistrict
    key_prefix = 'mpoxdistrict'
    extra_fields = ['DataPeriod', 'DataPeriodId', 'District']


class NaturalDisasterUploadView(BaseUploadView):
    model_class = NaturalDisaster
    key_prefix = 'naturaldisaster'
    extra_fields = ['DataPeriod', 'DataPeriodId']


class RiftValleyFeverUploadView(BaseUploadView):
    model_class = RiftValleyFever
    key_prefix = 'riftvalleyfever'
    extra_fields = ['DataPeriod', 'DataPeriodId']
