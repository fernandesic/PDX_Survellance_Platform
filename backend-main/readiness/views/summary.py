"""
Readiness Summary Views — Generic summary handler replacing 14 identical views.

Each disease-specific summary class inherits from BaseSummaryView and only
specifies serializer_class, queryset, and filterset_class.
"""
from rest_framework import status, generics
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from utils.permissions import IsNotSupplierRole
from django.db.models import F
from django.db.models.functions import Lower
from django_filters.rest_framework import DjangoFilterBackend

from utils.pagination import LargeResultsSetPagination
from utils.filters import (
    ArbovirusFilter, CholeraFilter, CholeraSubNationalFilter, CycloneFilter,
    FvDFilter, FvDPoEFilter, LassaFeverFilter, LassaFeverDistrictFilter,
    MarburgFilter, MeningitisFilter, MeningitiseEliminationFilter,
    MpoxFilter, MpoxDistrictFilter, NaturalDisasterFilter, RiftValleyFilter,
)
from utils.afro_countries import AFRO_COUNTRIES_LOWER, AFRO_COUNTRIES
from ..models import (
    ArboVirus, Cholera, CholeraSubNational, Cyclone, FVD, FVDPoE,
    LassaFever, LassaFeverDistrict, Marburg, Meningitis,
    MeningitiseElimination, Mpox, MpoxDistrict, NaturalDisaster,
    RiftValleyFever,
)
from ..serializers import (
    ArbovirusSerializer, CholeraSerializer, CholeraSubNationalSerializer,
    CycloneSerializer, FVDSerializer, FVDPoESerializer,
    LassaFeverSerializer, LassaFeverDistrictSerializer, MarburgSerializer,
    MeningitisSerializer, MeningitisEliminationSerializer,
    MpoxSerializer, MpoxDistrictSerializer,
    NaturalDisasterSerializer, RiftValleySerializer,
)


# ─── Base Summary View ──────────────────────────────────────────────────

class BaseSummaryView(generics.ListAPIView):
    """
    Generic summary view with completion stats.
    Subclasses set: serializer_class, queryset, filterset_class.
    Override `get_countries()` for non-standard country lists.
    """
    permission_classes = [IsAuthenticated, IsNotSupplierRole]
    pagination_class = LargeResultsSetPagination
    filter_backends = [DjangoFilterBackend]

    def get_countries(self):
        """Override this to return a custom countries list."""
        return AFRO_COUNTRIES

    def get(self, request, *args, **kwargs):
        filtered_qs = self.filter_queryset(self.get_queryset())
        response = super().get(request, *args, **kwargs)

        total_questions = filtered_qs.count()
        answered_questions = filtered_qs.filter(question_score__gt=0).count()
        try:
            completion_pct = (answered_questions / total_questions) * 100
        except (ZeroDivisionError, Exception):
            completion_pct = 0

        return Response(
            {
                "countries": self.get_countries(),
                "total_questions": total_questions,
                "answered_questions": answered_questions,
                "completion_pct": completion_pct,
                **response.data,
            },
            status=status.HTTP_200_OK,
        )


# ─── Concrete Summary Views (3-liners) ─────────────────────────────────

class ArboVirusSummaryView(BaseSummaryView):
    serializer_class = ArbovirusSerializer
    queryset = ArboVirus.objects.all().annotate(country_lower=Lower(F('country')))
    filterset_class = ArbovirusFilter


class CholeraSummaryView(BaseSummaryView):
    serializer_class = CholeraSerializer
    queryset = Cholera.objects.all().annotate(country_lower=Lower(F('country')))
    filterset_class = CholeraFilter


class CholeraSubNationalSummaryView(BaseSummaryView):
    serializer_class = CholeraSubNationalSerializer
    queryset = CholeraSubNational.objects.all().annotate(country_lower=Lower(F('country')))
    filterset_class = CholeraSubNationalFilter


class CycloneSummaryView(BaseSummaryView):
    serializer_class = CycloneSerializer
    queryset = Cyclone.objects.all().annotate(country_lower=Lower(F('country')))
    filterset_class = CycloneFilter


class FVDSummaryView(BaseSummaryView):
    serializer_class = FVDSerializer
    queryset = FVD.objects.all().annotate(country_lower=Lower(F('country')))
    filterset_class = FvDFilter


class FVDPoESummaryView(BaseSummaryView):
    serializer_class = FVDPoESerializer
    queryset = FVDPoE.objects.all().annotate(country_lower=Lower(F('country')))
    filterset_class = FvDPoEFilter

    def get_countries(self):
        return [
            c for c in self.queryset.values_list("country_lower", flat=True).distinct()
            if c.lower() in AFRO_COUNTRIES_LOWER
        ]


class LassaFeverSummaryView(BaseSummaryView):
    serializer_class = LassaFeverSerializer
    queryset = LassaFever.objects.all().annotate(country_lower=Lower(F('country')))
    filterset_class = LassaFeverFilter


class LassaFeverDistrictSummaryView(BaseSummaryView):
    serializer_class = LassaFeverDistrictSerializer
    queryset = LassaFeverDistrict.objects.all().annotate(country_lower=Lower(F('country')))
    filterset_class = LassaFeverDistrictFilter


class MarburgSummaryView(BaseSummaryView):
    serializer_class = MarburgSerializer
    queryset = Marburg.objects.all().annotate(country_lower=Lower(F('country')))
    filterset_class = MarburgFilter


class MeningitisSummaryView(BaseSummaryView):
    serializer_class = MeningitisSerializer
    queryset = Meningitis.objects.all().annotate(country_lower=Lower(F('country')))
    filterset_class = MeningitisFilter


class MeningitiseEliminationSummaryView(BaseSummaryView):
    serializer_class = MeningitisEliminationSerializer
    queryset = MeningitiseElimination.objects.all().annotate(country_lower=Lower(F('country')))
    filterset_class = MeningitiseEliminationFilter


class MpoxSummaryView(BaseSummaryView):
    serializer_class = MpoxSerializer
    queryset = Mpox.objects.all().annotate(country_lower=Lower(F('country')))
    filterset_class = MpoxFilter


class MpoxDistrictSummaryView(BaseSummaryView):
    serializer_class = MpoxDistrictSerializer
    queryset = MpoxDistrict.objects.all().annotate(country_lower=Lower(F('country')))
    filterset_class = MpoxDistrictFilter


class NaturalDisasterSummaryView(BaseSummaryView):
    serializer_class = NaturalDisasterSerializer
    queryset = NaturalDisaster.objects.all().annotate(country_lower=Lower(F('country')))
    filterset_class = NaturalDisasterFilter


class RiftValleyFeverSummaryView(BaseSummaryView):
    serializer_class = RiftValleySerializer
    queryset = RiftValleyFever.objects.all().annotate(country_lower=Lower(F('country')))
    filterset_class = RiftValleyFilter
