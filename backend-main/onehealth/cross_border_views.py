"""
Cross-border Importation — Django REST Views
---------------------------------------------
Ported from Isaias's FastAPI router (onehealth_cross_border_api.py) to Django
REST Framework so it integrates with the existing PDX OneHealth backend.

Endpoints:
    GET  /api/v1/onehealth/cross-border/corridor-presets
    GET  /api/v1/onehealth/cross-border/corridor-presets/<name>
    POST /api/v1/onehealth/cross-border/importation
    POST /api/v1/onehealth/cross-border/importation/sensitivity

Author: Isaias Fernandes Co (model) · PDX integration
"""

from datetime import datetime

from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .views import OHBaseView

from .spillover_hazard import (
    CountryConfig,
    HazardParams,
    run_all_countries,
    sensitivity_travel_while_infectious,
    get_corridor,
    CORRIDOR_PRESETS,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _to_country_configs(items: list) -> list:
    """Convert raw dicts (from request body) into CountryConfig dataclasses."""
    return [
        CountryConfig(
            name=c.get("name", ""),
            iso3=c.get("iso3", ""),
            daily_crossings=float(c.get("daily_crossings", 0)),
            catchment_share=float(c.get("catchment_share", 0)),
            border_open=float(c.get("border_open", 1.0)),
            direct_border=bool(c.get("direct_border", True)),
            ghs_index=float(c["ghs_index"]) if c.get("ghs_index") is not None else None,
            readiness_composite=float(c["readiness_composite"]) if c.get("readiness_composite") is not None else None,
            note=c.get("note", ""),
        )
        for c in items
    ]


def _country_output_to_dict(r) -> dict:
    """Serialize a CountryOutput dataclass to a JSON-safe dict."""
    return {
        "name": r.name,
        "iso3": r.iso3,
        "expected_imports": r.expected_imports,
        "p_any_import": r.p_any_import,
        "tier": r.tier,
        "expected_imports_w4": r.expected_imports_w4,
        "expected_imports_w8": r.expected_imports_w8,
        "expected_imports_w12": r.expected_imports_w12,
        "p_any_w4": r.p_any_w4,
        "p_any_w8": r.p_any_w8,
        "p_any_w12": r.p_any_w12,
        "daily_lambda": r.daily_lambda,
        "cumulative_lambda": r.cumulative_lambda,
    }


def _country_config_to_dict(c: CountryConfig) -> dict:
    """Serialize a CountryConfig dataclass for the corridor preset response."""
    return {
        "name": c.name,
        "iso3": c.iso3,
        "daily_crossings": c.daily_crossings,
        "catchment_share": c.catchment_share,
        "border_open": c.border_open,
        "direct_border": c.direct_border,
        "ghs_index": c.ghs_index,
        "readiness_composite": c.readiness_composite,
        "note": c.note,
    }


# ---------------------------------------------------------------------------
# Views
# ---------------------------------------------------------------------------


class CorridorPresetsListView(OHBaseView):
    """GET /api/v1/onehealth/cross-border/corridor-presets

    Returns the sorted list of available corridor preset names.
    """

    def get(self, request):
        return Response(sorted(CORRIDOR_PRESETS.keys()))


class CorridorPresetDetailView(OHBaseView):
    """GET /api/v1/onehealth/cross-border/corridor-presets/<name>

    Returns a corridor preset's country configurations.
    """

    def get(self, request, name):
        try:
            countries = get_corridor(name)
        except ValueError as e:
            return Response({"error": str(e)}, status=404)

        return Response({
            "name": name,
            "countries": [_country_config_to_dict(c) for c in countries],
        })


class CrossBorderImportationView(OHBaseView):
    """POST /api/v1/onehealth/cross-border/importation

    Run the cross-border importation hazard model.

    Request body:
    {
        "active_I_series": [float],          # daily active-I values
        "source_catchment_population": int,   # default 250000
        "travel_while_infectious": float,     # default 0.15
        "detection_at_poe": float,            # default 0.20
        "horizon_days": int,                  # default 84
        "countries": [{name, iso3, daily_crossings, catchment_share, ...}],
        "scenario_id": str | null             # optional wbepi link
    }
    """

    def post(self, request):
        data = request.data or {}

        # Extract and validate active-I series
        active_I = data.get("active_I_series")
        if not active_I or not isinstance(active_I, list):
            return Response(
                {"error": "active_I_series is required and must be a non-empty array."},
                status=422,
            )

        # Validate non-negative values
        if any(x < 0 for x in active_I):
            return Response(
                {"error": "active_I_series must contain non-negative values."},
                status=422,
            )

        # Global hazard params with defaults
        horizon_days = int(data.get("horizon_days", 84))
        if len(active_I) < horizon_days:
            return Response(
                {"error": (f"active_I_series length {len(active_I)} is shorter "
                           f"than horizon_days {horizon_days}")},
                status=422,
            )

        countries_input = data.get("countries")
        if not countries_input or not isinstance(countries_input, list):
            return Response(
                {"error": "countries is required and must be a non-empty array."},
                status=422,
            )

        # Build model inputs
        try:
            countries = _to_country_configs(countries_input)
        except (KeyError, ValueError, TypeError) as e:
            return Response(
                {"error": f"Invalid country configuration: {e}"},
                status=422,
            )

        params = HazardParams(
            travel_while_infectious=float(data.get("travel_while_infectious", 0.15)),
            detection_at_poe=float(data.get("detection_at_poe", 0.20)),
            source_catchment_population=int(data.get("source_catchment_population", 250_000)),
            horizon_days=horizon_days,
        )

        # Run the model
        try:
            results = run_all_countries(countries, active_I, params)
        except ValueError as e:
            return Response({"error": str(e)}, status=422)

        # Build response
        now = datetime.utcnow()
        run_id = f"xbordr-{now.strftime('%Y%m%dT%H%M%S')}"

        return Response({
            "run_id": run_id,
            "run_timestamp": now.isoformat() + "Z",
            "scenario_id": data.get("scenario_id"),
            "horizon_days": horizon_days,
            "countries": [_country_output_to_dict(r) for r in results],
            "inputs_echo": {
                "travel_while_infectious": params.travel_while_infectious,
                "detection_at_poe": params.detection_at_poe,
                "source_catchment_population": params.source_catchment_population,
            },
        })


class CrossBorderSensitivityView(OHBaseView):
    """POST /api/v1/onehealth/cross-border/importation/sensitivity

    Sweep travel-while-infectious across plausible values and return
    per-country expected imports at horizon for each value.

    Request body:
    {
        "active_I_series": [float],
        "source_catchment_population": int,
        "detection_at_poe": float,
        "horizon_days": int,
        "countries": [{...}],
        "twi_values": [float]     # e.g. [0.05, 0.10, 0.15, 0.25, 0.40]
    }
    """

    def post(self, request):
        data = request.data or {}

        active_I = data.get("active_I_series")
        if not active_I or not isinstance(active_I, list):
            return Response(
                {"error": "active_I_series is required."},
                status=422,
            )

        horizon_days = int(data.get("horizon_days", 84))
        if len(active_I) < horizon_days:
            return Response(
                {"error": (f"active_I_series length {len(active_I)} is shorter "
                           f"than horizon_days {horizon_days}")},
                status=422,
            )

        countries_input = data.get("countries")
        if not countries_input or not isinstance(countries_input, list):
            return Response(
                {"error": "countries is required."},
                status=422,
            )

        try:
            countries = _to_country_configs(countries_input)
        except (KeyError, ValueError, TypeError) as e:
            return Response(
                {"error": f"Invalid country configuration: {e}"},
                status=422,
            )

        twi_values = data.get("twi_values", [0.05, 0.10, 0.15, 0.25, 0.40])

        params = HazardParams(
            travel_while_infectious=0.15,  # ignored; sweep overrides
            detection_at_poe=float(data.get("detection_at_poe", 0.20)),
            source_catchment_population=int(data.get("source_catchment_population", 250_000)),
            horizon_days=horizon_days,
        )

        sweep = sensitivity_travel_while_infectious(
            countries, active_I, params,
            twi_values=twi_values,
        )

        # Stringify float keys for JSON compatibility
        serialised = {
            country_name: {str(twi): v for twi, v in inner.items()}
            for country_name, inner in sweep.items()
        }

        return Response({
            "twi_values": list(twi_values),
            "by_country": serialised,
        })


# ---------------------------------------------------------------------------
# PoE Risk Summary — Auto-detecting importation risk
# ---------------------------------------------------------------------------

# ISO3 → corridor preset name mapping.
# Used to match an active outbreak to a pre-tuned corridor configuration.
_ISO3_REGION_TO_PRESET = {
    # DRC corridors — matched by regions overlap
    "COD": {
        "ituri": {"Ituri", "ituri", "Djugu", "Mahagi", "Mambasa", "Aru", "Irumu"},
        "north-kivu-goma": {"North Kivu", "Nord-Kivu", "north-kivu", "Goma", "Beni", "Butembo"},
        "equateur": {"Equateur", "equateur", "Mbandaka", "Bikoro"},
    },
}

# Default crossing parameters for neighbour countries when no preset is matched.
# These are conservative estimates based on IOM DTM flow monitoring averages.
_DEFAULT_NEIGHBOR_PARAMS = {
    "daily_crossings": 500,
    "catchment_share": 0.15,
    "border_open": 1.0,
}


def _match_corridor_preset(iso3: str, regions: list) -> str | None:
    """Try to match an outbreak's iso3 + regions to a known corridor preset."""
    if not iso3:
        return None
    presets = _ISO3_REGION_TO_PRESET.get(iso3.upper())
    if not presets:
        return None
    region_set = {str(r).strip() for r in regions if r} if regions else set()
    for preset_name, keywords in presets.items():
        if region_set & keywords:
            return preset_name
    # If no region match, return the first preset for this country as fallback
    return next(iter(presets))


def _build_active_I_series(outbreak, horizon: int = 84) -> list:
    """Build a daily active-infectious series for the importation model.

    Strategy:
    1. Try OutbreakEvents with kind='case', grouped by day → SIR decay.
    2. Fallback: use Outbreak.confirmed_cases with a synthetic epi curve shape.
    """
    from outbreak.models import OutbreakEvent
    from django.db.models import Count
    from django.db.models.functions import TruncDate

    # Try event-based series
    events = (
        OutbreakEvent.objects
        .filter(outbreak=outbreak, kind='case')
        .annotate(day=TruncDate('ts'))
        .values('day')
        .annotate(daily_new=Count('id'))
        .order_by('day')
    )

    if events.exists():
        # Build daily new case counts
        daily_new = [e['daily_new'] for e in events]

        # Estimate active infectious from daily new cases using simple decay
        # Active-I on day t ≈ sum of new cases from last 10 days (infectious period)
        infectious_period = 10
        active_I = []
        for t in range(len(daily_new)):
            window_start = max(0, t - infectious_period + 1)
            active_I.append(float(sum(daily_new[window_start:t + 1])))

        # Extend to horizon if shorter
        if len(active_I) < horizon:
            last_val = active_I[-1] if active_I else 1.0
            # Simple plateau assumption for the remaining days
            active_I.extend([last_val] * (horizon - len(active_I)))
        return active_I[:horizon]

    # Fallback: synthetic curve from confirmed_cases
    confirmed = outbreak.confirmed_cases or 5
    seed_I = max(1.0, confirmed * 0.3)  # ~30% of confirmed are actively infectious
    growth = 1.025  # ~2.5% daily growth (conservative)
    active_I = [seed_I * (growth ** t) for t in range(horizon)]
    # Cap at realistic ceiling
    cap = max(confirmed * 2, 50)
    active_I = [min(v, cap) for v in active_I]
    return active_I


def _build_neighbor_configs(iso3_list: list) -> list:
    """Build CountryConfig objects for a list of neighbor ISO3 codes.

    Uses a simple lookup to provide sensible default parameters.
    """
    # Try to get country names from the DB
    from django.db import DatabaseError, connection

    # Sanitize: iso3 codes must be exactly 3 alphabetic characters
    iso3_list = [
        str(c).upper()[:3] for c in iso3_list
        if c and isinstance(c, str) and c.isalpha() and len(c) == 3
    ]

    iso3_to_name = {}
    if iso3_list:
        placeholders = ', '.join(['%s'] * len(iso3_list))
        try:
            with connection.cursor() as cur:
                cur.execute(
                    f"SELECT iso3, country_name FROM oh_countries WHERE iso3 IN ({placeholders})",
                    iso3_list,
                )
                for row in cur.fetchall():
                    iso3_to_name[row[0]] = row[1]
        except (DatabaseError, AttributeError, IndexError):
            # Table may not exist on this deployment; fall back to ISO3 as name
            pass

    configs = []
    for iso3 in iso3_list:
        name = iso3_to_name.get(iso3, iso3)
        configs.append(CountryConfig(
            name=name,
            iso3=iso3,
            daily_crossings=_DEFAULT_NEIGHBOR_PARAMS["daily_crossings"],
            catchment_share=_DEFAULT_NEIGHBOR_PARAMS["catchment_share"],
            border_open=_DEFAULT_NEIGHBOR_PARAMS["border_open"],
            direct_border=True,
        ))
    return configs


class PoERiskSummaryView(OHBaseView):
    """GET /api/v1/onehealth/poe-risk-summary

    Auto-detects active outbreaks and runs the importation model for each,
    returning structured risk data per neighbor country.

    No hardcoded diseases, countries, or corridors — everything is auto-detected
    from the Outbreak table and matched to corridor presets when available.
    """

    def get(self, request):
        import logging
        _logger = logging.getLogger('onehealth.cross_border_views')

        # Lazy imports to avoid circular dependencies
        from outbreak.models import Outbreak

        # Auto-detect active outbreaks
        active_outbreaks = (
            Outbreak.objects
            .filter(status__in=['confirmed', 'suspected'])
            .select_related('pathogen')
            .order_by('-declared_at')
        )

        if not active_outbreaks.exists():
            return Response({
                "active_outbreaks": [],
                "updated_at": datetime.utcnow().isoformat() + "Z",
            })

        results = []
        for outbreak in active_outbreaks:
            try:
                neighbor_iso3s = outbreak.neighbor_iso3s or []
                regions = outbreak.regions or []
                iso3 = outbreak.iso3

                # Step 1: Try to match a corridor preset
                preset_name = _match_corridor_preset(iso3, regions)
                if preset_name:
                    try:
                        countries = get_corridor(preset_name)
                        _logger.info(
                            "[PIRE] Matched preset '%s' for %s (%s)",
                            preset_name, outbreak.pathogen.name, iso3,
                        )
                    except ValueError:
                        countries = None
                else:
                    countries = None

                # Step 2: Fallback to neighbor_iso3s with default params
                if not countries and neighbor_iso3s:
                    countries = _build_neighbor_configs(neighbor_iso3s)
                    _logger.info(
                        "[PIRE] Built neighbor configs from iso3 list for %s: %s",
                        iso3, neighbor_iso3s,
                    )

                # Step 3: If still nothing, skip this outbreak
                if not countries:
                    _logger.warning(
                        "[PIRE] No corridor data for outbreak %s (%s). "
                        "Set neighbor_iso3s in Django admin.",
                        outbreak.id, iso3,
                    )
                    continue

                # Build active-I series
                active_I = _build_active_I_series(outbreak, horizon=84)
                if not active_I or all(v <= 0 for v in active_I):
                    _logger.warning(
                        "[PIRE] Empty or zero active-I series for outbreak %s. Skipping.",
                        outbreak.id,
                    )
                    continue

                # Run the model
                params = HazardParams(
                    travel_while_infectious=0.15,
                    detection_at_poe=0.20,
                    source_catchment_population=250_000,
                    horizon_days=84,
                )
                model_results = run_all_countries(countries, active_I, params)

                # Serialize
                neighbors = []
                for r in model_results:
                    neighbors.append({
                        **_country_output_to_dict(r),
                        # Flatten for frontend convenience
                        "p_any_w4_pct": round(r.p_any_w4 * 100, 1),
                        "p_any_w8_pct": round(r.p_any_w8 * 100, 1),
                        "p_any_w12_pct": round(r.p_any_w12 * 100, 1),
                    })

                # Sort by risk (highest first)
                neighbors.sort(key=lambda n: n["p_any_import"], reverse=True)

                results.append({
                    "outbreak_id": outbreak.id,
                    "pathogen": outbreak.pathogen.name,
                    "source_country": iso3,
                    "source_iso3": iso3,
                    "confirmed_cases": outbreak.confirmed_cases or 0,
                    "confirmed_deaths": outbreak.confirmed_deaths or 0,
                    "declared_at": outbreak.declared_at.isoformat() if outbreak.declared_at else None,
                    "severity": outbreak.severity,
                    "regions": regions,
                    "preset_used": preset_name,
                    "neighbors": neighbors,
                })

            except Exception as e:  # noqa: BLE001 — per-outbreak loop: one bad outbreak must not abort the rest
                _logger.exception(
                    "[PIRE] Error processing outbreak %s: %s", outbreak.id, e,
                )
                continue

        return Response({
            "active_outbreaks": results,
            "updated_at": datetime.utcnow().isoformat() + "Z",
        })
