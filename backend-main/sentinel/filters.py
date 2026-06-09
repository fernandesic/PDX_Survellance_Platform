import django_filters

from .models import Signal


class SignalFilter(django_filters.FilterSet):
    # `disease_name` is free-text on the model; expose it with icontains so
    # frontend filters can send human-readable names like "Cholera" or
    # "Yellow Fever" without having to know the model's disease_category taxonomy.
    disease_name = django_filters.CharFilter(
        field_name="disease_name", lookup_expr="icontains"
    )

    # Date window filters used by the alerts-v2 page chips (24h / 3d / 7d / 30d).
    # Frontend sends ISO date strings (YYYY-MM-DD) via `date_from` / `date_to`.
    # Filtering on `created_at` (ingestion time) — that's what "last 24 hours"
    # means in the UI: signals seen by the system in that window. source_timestamp
    # is the publication time on the upstream feed, often missing or stale.
    date_from = django_filters.DateFilter(field_name="created_at", lookup_expr="gte")
    date_to = django_filters.DateFilter(field_name="created_at", lookup_expr="lte")

    class Meta:
        model = Signal
        fields = [
            "priority",
            "status",
            "location_country_iso",
            "disease_category",
            "source_tier",
            "disease_name",
            "cross_border_risk",
        ]
