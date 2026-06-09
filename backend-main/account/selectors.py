"""
Account — Selectors (Read-Only Queries)

Pure data retrieval functions for the account module.
No side effects, no HTTP concerns — just queries and data shaping.

Used by: account.views (Overview, NewsAPIView)
"""

import logging
from concurrent.futures import ThreadPoolExecutor, as_completed

from django.db import close_old_connections
from django.db.models import Sum, Avg, Count, Q, Max, Subquery, OuterRef
from django.db.models.functions import Trim, Lower
from django.core.cache import cache
from django.utils import timezone

from chwfolder.models import Country, Region, District
from espar.models import Espar, Indicator
from stardata.models import StarData
from account.serializers import ChartCountrySerializer
from utils.tenant_tasks import tenant_context

logger = logging.getLogger(__name__)


# ─── Overview (Main Dashboard) ────────────────────────────────────────────────


OVERVIEW_CACHE_KEY_PREFIX = 'overview_data_v1'
OVERVIEW_CACHE_TTL = 120  # 2 minutes


def get_overview_data(*, force_refresh: bool = False, tenant_id: str = '-1') -> dict:
    """
    Aggregate all dashboard data sources in parallel.

    Returns cached data unless force_refresh=True (triggered by Sync Now button).

    `tenant_id` is the RLS context applied inside each worker thread. Worker
    threads acquire fresh DB connections (via close_old_connections), and the
    `connection_created` signal initialises every fresh connection to '-1'
    (deny-all). Without re-applying the request's tenant inside the worker,
    every parallel query returns 0 rows. The cache is also keyed by tenant
    so Nigeria's view never serves Kenya's data (or vice versa).
    """
    cache_key = f"{OVERVIEW_CACHE_KEY_PREFIX}:t{tenant_id}"

    if not force_refresh:
        cached = cache.get(cache_key)
        if cached:
            return cached

    tasks = {
        'chart': lambda: {
            'total_chw_and_population_2024': ChartCountrySerializer(
                Country.objects.all(), many=True
            ).data,
        },
        'pdx': _get_pdx_info,
        'chw': _get_chw_info,
        'espar': _get_espar_info,
        'readiness': _get_readiness_info,
        'stardata': _get_stardata_info,
        'pami': _get_pami_info,
    }

    results = {}
    with ThreadPoolExecutor(max_workers=7) as executor:
        future_to_key = {
            executor.submit(_run_with_db_cleanup, fn, tenant_id): key
            for key, fn in tasks.items()
        }
        for future in as_completed(future_to_key):
            key = future_to_key[future]
            try:
                results[key] = future.result()
            except Exception as e:  # noqa: BLE001 — per-sub-fetcher: one bad source returns {} so the dashboard still renders
                logger.error(f"Overview: Error fetching {key}: {e}")
                results[key] = {}

    data = {
        'last_updated': timezone.now().isoformat(),
        'chart': results.get('chart', {}),
        'pdx': results.get('pdx', {}),
        'chw': results.get('chw', {}),
        'espar': results.get('espar', {}),
        'readiness': results.get('readiness', {}),
        'stardata': results.get('stardata', {}),
        'pami': results.get('pami', {}),
    }

    cache.set(cache_key, data, OVERVIEW_CACHE_TTL)
    return data


def _run_with_db_cleanup(fn, tenant_id: str = '-1'):
    """Wrapper that ensures proper DB connection handling per thread.

    Sets `app.current_tenant` on the worker's fresh connection so RLS
    policies see the request's tenant rather than the deny-all default.
    """
    close_old_connections()
    try:
        with tenant_context(tenant_id):
            return fn()
    finally:
        close_old_connections()


# ─── Individual data source queries ──────────────────────────────────────────


def _get_pdx_info() -> dict:
    """Return count of unique AFRO countries active across all trackers."""
    from utils.afro_countries import AFRO_COUNTRIES

    all_countries = set()

    all_countries.update(Country.objects.values_list('country', flat=True))
    all_countries.update(Espar.objects.values_list('states', flat=True))
    all_countries.update(StarData.objects.values_list('country', flat=True))

    from readiness.models import ArboVirus
    all_countries.update(ArboVirus.objects.values_list('country', flat=True))

    # Filter to only WHO AFRO member states (47 countries)
    afro_active = {c for c in all_countries if c and c in AFRO_COUNTRIES}

    return {
        "countries": len(AFRO_COUNTRIES),
        "source": "PDX Central Registry",
        "updated_at": timezone.now().isoformat(),
    }


def _get_chw_info() -> dict:
    from utils.afro_countries import AFRO_COUNTRIES

    top_regions = (
        Region.objects
        .select_related('country')
        .annotate(avg_chws_per_10k=Avg('district__chws_per_10k'))
        .filter(avg_chws_per_10k__gt=0)
        .order_by('-avg_chws_per_10k')[:10]
    )

    country_stats = Country.objects.aggregate(
        total_chws=Sum('total_chws'),
        total_population=Sum('population_2024'),
    )

    total_chws = country_stats['total_chws'] or 0
    total_population = country_stats['total_population'] or 1
    weighted_chw_per_10k = round((total_chws / total_population) * 10000, 2)

    countries = list(Country.objects.values_list("country", flat=True))

    latest_update = Country.objects.aggregate(Max('last_updated'))['last_updated__max']
    updated_at = latest_update.isoformat() if latest_update else timezone.now().isoformat()

    return {
        "total_chw": total_chws,
        "total_chw_per_10k": weighted_chw_per_10k,
        "countries": [c for c in countries if c in AFRO_COUNTRIES],
        "districts": District.objects.count(),
        "regions": Region.objects.count(),
        "top_region": [
            {
                "region": f"{region.region_name}, {region.country.country}",
                "percentage": round(region.avg_chws_per_10k, 2),
            }
            for region in top_regions
        ],
        "source": "National CHW Registries",
        "updated_at": updated_at,
        "top_countries": [
            {"country": country.country, "rate": round(country.chws_per_10000 or 0, 2)}
            for country in Country.objects.order_by('-chws_per_10000')[:5]
        ],
    }


def _get_espar_info() -> dict:
    from utils.afro_countries import AFRO_COUNTRIES_LOWER

    afro_espar = (
        Espar.objects
        .select_related('sheet')
        .annotate(states_lower=Lower('states'))
        .filter(states_lower__in=AFRO_COUNTRIES_LOWER)
    )

    afro_countries = list(afro_espar.values_list("states", flat=True).distinct())

    years_data = list(
        afro_espar
        .values('sheet__name')
        .annotate(count=Count('states', distinct=True))
        .order_by('-sheet__name')
    )

    all_years = [item['sheet__name'] for item in years_data]

    latest_per_country = (
        afro_espar
        .filter(states=OuterRef('states'))
        .order_by('-sheet__name')
        .values('total_average')[:1]
    )

    country_latest = (
        afro_espar
        .values('states')
        .annotate(latest_score=Subquery(latest_per_country))
        .distinct()
    )

    country_scores = {}
    for row in country_latest:
        if row['latest_score'] is not None:
            country_scores[row['states']] = row['latest_score']

    # Countries per year with their scores
    years_with_countries = []
    for year_data in years_data:
        year = year_data['sheet__name']
        year_espars = afro_espar.filter(sheet__name=year)
        countries_in_year = list(
            year_espars.values_list('states', flat=True).distinct()
        )
        year_country_scores = {}
        for row in year_espars.values('states', 'total_average'):
            if row['total_average'] is not None:
                year_country_scores[row['states']] = row['total_average']

        years_with_countries.append({
            'year': year,
            'count': len(countries_in_year),
            'countries': countries_in_year,
            'country_scores': year_country_scores,
        })

    avg_score = _compute_espar_avg(afro_espar)

    return {
        "total_capacities": 15,
        'countries': afro_countries,
        "years": all_years,
        "years_data": years_with_countries,
        "country_scores": country_scores,
        "avg_score": avg_score,
        "source": "WHO e-SPAR Self-Assessment",
        "updated_at": timezone.now().isoformat(),
    }


def _compute_espar_avg(afro_espar) -> float:
    """Compute real regional average e-SPAR score from indicator scaled_score values."""
    latest_year_espar = afro_espar.order_by('-sheet__name')
    if not latest_year_espar.exists():
        return 0

    latest_year = latest_year_espar.first().sheet.name
    latest_entries = afro_espar.filter(sheet__name=latest_year).prefetch_related('indicators')

    country_scores = []
    for entry in latest_entries:
        indicators = list(entry.indicators.all())
        if indicators:
            country_avg = sum(ind.scaled_score() for ind in indicators) / len(indicators)
            country_scores.append(country_avg)

    if not country_scores:
        return 0

    return round(sum(country_scores) / len(country_scores), 2)


def _get_readiness_info() -> dict:
    from django.db.models.functions import Lower
    from utils.afro_countries import AFRO_COUNTRIES_LOWER
    from readiness.models import (
        ArboVirus, Cholera, CholeraSubNational, Cyclone, FVD, FVDPoE,
        LassaFever, LassaFeverDistrict, Marburg, Meningitis,
        MeningitiseElimination, Mpox, MpoxDistrict, NaturalDisaster, RiftValleyFever,
    )

    def get_result(queryset):
        total_questions = queryset.count()
        answered_questions = queryset.filter(question_score__gt=0).count()
        completion_pct = (answered_questions / total_questions) * 100 if total_questions > 0 else 0
        return {
            'total': total_questions,
            'answered': answered_questions,
            'completion_pct': completion_pct,
        }

    hazard_summary = {
        'arbovirus': get_result(ArboVirus.objects.all()),
        'cholera': get_result(Cholera.objects.all()),
        'cholera_subnational': get_result(CholeraSubNational.objects.all()),
        'cyclone': get_result(Cyclone.objects.all()),
        'fvd': get_result(FVD.objects.all()),
        'fvd_poe': get_result(FVDPoE.objects.all()),
        'lassa_fever': get_result(LassaFever.objects.all()),
        'lassa_fever_district': get_result(LassaFeverDistrict.objects.all()),
        'marburg': get_result(Marburg.objects.all()),
        'meningitis': get_result(Meningitis.objects.all()),
        'meningitise_elimination': get_result(MeningitiseElimination.objects.all()),
        'mpox': get_result(Mpox.objects.all()),
        'mpox_district': get_result(MpoxDistrict.objects.all()),
        'natural_disaster': get_result(NaturalDisaster.objects.all()),
        'rift_valley_fever': get_result(RiftValleyFever.objects.all()),
    }

    total_all = sum(h['total'] for h in hazard_summary.values())
    answered_all = sum(h['answered'] for h in hazard_summary.values())
    overall_completion = round((answered_all / total_all) * 100, 1) if total_all > 0 else 0

    fully_completed = []
    needs_attention = []

    for hazard, data in hazard_summary.items():
        pct = data['completion_pct']
        if pct >= 90:
            fully_completed.append({'name': hazard, 'pct': round(pct, 1)})
        elif pct < 50:
            needs_attention.append({'name': hazard, 'pct': round(pct, 1)})

    # Per-country completion across all hazard models
    all_models = [
        ArboVirus, Cholera, CholeraSubNational, Cyclone, FVD, FVDPoE,
        LassaFever, LassaFeverDistrict, Marburg, Meningitis,
        MeningitiseElimination, Mpox, MpoxDistrict, NaturalDisaster, RiftValleyFever,
    ]

    country_data = {}
    for model in all_models:
        country_stats = model.objects.annotate(
            country_lower=Lower('country'),
        ).filter(
            country_lower__in=AFRO_COUNTRIES_LOWER,
        ).values('country').annotate(
            total=Count('id'),
            answered=Count('id', filter=Q(question_score__gt=0)),
        )

        for stat in country_stats:
            country = stat['country']
            if country:
                if country not in country_data:
                    country_data[country] = {'total': 0, 'answered': 0}
                country_data[country]['total'] += stat['total']
                country_data[country]['answered'] += stat['answered']

    country_completion = {}
    for country, data in country_data.items():
        if data['total'] > 0:
            country_completion[country] = round((data['answered'] / data['total']) * 100, 1)

    return {
        "total_hazards": 15,
        "summary": hazard_summary,
        "country_completion": country_completion,
        "overall_completion": overall_completion,
        "fully_completed": fully_completed,
        "needs_attention": needs_attention,
        "source": "Readiness Survey Reports",
        "updated_at": timezone.now().isoformat(),
    }


def _get_stardata_info() -> dict:
    qs = StarData.objects.annotate(
        cleaned_country=Trim('country'),
        cleaned_hazard=Trim('hazard'),
        cleaned_status=Trim('status'),
        cleaned_level=Trim('level'),
        cleaned_year=Trim('year'),
        cleaned_severity=Trim('severity'),
    )

    return {
        "countries": 35,
        "hazards": qs.values_list('cleaned_hazard', flat=True).distinct().count(),
        "hazard_types": 5,
        "active": qs.filter(cleaned_status='1').count(),
        'levels': list(qs.values_list('cleaned_level', flat=True).distinct()[:5]),
        'years': list(qs.values_list('cleaned_year', flat=True).distinct()),
        'available_hazards': [],
        'available_hazard_types': [],
        'hazard_type_monthly_risk': [],
        'chart_by_country': [],
        'risk_distribution': {
            'very_high': qs.filter(cleaned_severity__in=['Very High', 'Très élevé']).count(),
            'high': qs.filter(cleaned_severity__in=['High', 'Élevé']).count(),
            'moderate': qs.filter(cleaned_severity__in=['Moderate', 'Modéré']).count(),
            'low': qs.filter(cleaned_severity__in=['Low', 'Faible']).count(),
            'very_low': qs.filter(cleaned_severity__in=['Very Low', 'Très faible']).count(),
        },
        'ticker_alerts': [],
        "source": "STAR Monitoring Framework",
        "updated_at": timezone.now().isoformat(),
    }


def _get_pami_info() -> dict:
    """Return PAMI summary. No backend model exists — returns static country mapping."""
    pami_countries = [
        'Nigeria', 'Tanzania', 'Uganda', 'Malawi',
        'Mozambique', 'Zimbabwe', 'Kenya', 'South Africa',
    ]
    return {
        'countries': len(pami_countries),
        'active_countries': pami_countries,
        'total_incidents': len(pami_countries),
        "source": "PAMI Incident Alerts",
        "updated_at": timezone.now().isoformat(),
    }


# ─── News Ticker ─────────────────────────────────────────────────────────────


def get_news_data() -> dict:
    """
    Aggregate news/summaries for the dashboard ticker.
    Returns CHW, STAR, and e-SPAR highlight data.
    """
    from utils.afro_countries import AFRO_COUNTRIES_LOWER

    # CHW highlights
    chw_countries = Country.objects.annotate(
        country_lower=Lower('country'),
    ).filter(country_lower__in=AFRO_COUNTRIES_LOWER)

    chw_summary = []
    for country in chw_countries[:10]:
        total_chws = country.total_chws or 0
        per_10k = country.chws_per_10000 or 0
        chw_summary.append({
            "key": country.country,
            "value_1": f"{total_chws:,} CHWs",
            "value_2": f"{per_10k:.1f}/10k",
        })

    # STAR high-risk alerts
    star_qs = StarData.objects.annotate(
        cleaned_country=Trim('country'),
        cleaned_hazard=Trim('hazard'),
        cleaned_severity=Trim('severity'),
    ).filter(
        cleaned_country__in=AFRO_COUNTRIES_LOWER + [c.title() for c in AFRO_COUNTRIES_LOWER]
    )

    high_risk = star_qs.filter(
        cleaned_severity__in=['High', 'Very High', 'Très élevé', 'Élevé'],
    ).values('cleaned_country', 'cleaned_hazard', 'cleaned_severity')[:10]

    star_summary = []
    for item in high_risk:
        star_summary.append({
            "key": item['cleaned_country'],
            "value_1": item['cleaned_hazard'],
            "value_2": item['cleaned_severity'],
        })

    # e-SPAR capacity highlights
    espar_data = (
        Espar.objects
        .select_related('sheet')
        .prefetch_related('indicators')
        .filter(states__in=[c.title() for c in AFRO_COUNTRIES_LOWER])[:10]
    )

    espar_summary = []
    for espar in espar_data:
        indicators = list(espar.indicators.all()[:5])
        if indicators:
            avg_score = sum(ind.scaled_score() for ind in indicators) / len(indicators)
            espar_summary.append({
                "key": espar.states,
                "value_1": f"Capacity: {avg_score:.1f}/5",
                "value_2": espar.sheet.name if espar.sheet else "",
            })

    return {
        "chw": chw_summary,
        "stardata": star_summary,
        "espar": espar_summary,
    }
