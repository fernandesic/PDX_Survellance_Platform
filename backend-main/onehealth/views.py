"""
One Health — Django REST API Views
Serves data from the oh_* tables to the React frontend.
"""
import json
import logging
import math
import re
import time
import threading
from datetime import datetime

from django.conf import settings
from django.db import DatabaseError, connection
from django.http import HttpResponse, JsonResponse, StreamingHttpResponse
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.csrf import csrf_exempt
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny

logger = logging.getLogger(__name__)

# Failure modes we tolerate from advisory DB reads (snapshot panels, cache
# lookups, freshness probes). The endpoint must still respond if these fail.
_DB_ERRORS = (DatabaseError, AttributeError, ValueError, TypeError)


def _attach_cors(request, response):
    """Explicitly attach CORS headers to a response.

    django-cors-headers occasionally drops headers on streaming responses,
    so we mirror its logic here to guarantee the browser accepts SSE frames.
    """
    origin = request.META.get("HTTP_ORIGIN", "")
    allowed = set(getattr(settings, "CORS_ALLOWED_ORIGINS", []) or [])
    if origin and origin in allowed:
        response["Access-Control-Allow-Origin"] = origin
        response["Access-Control-Allow-Credentials"] = "true"
        response["Vary"] = "Origin"
    return response


def _authenticate_sse(request):
    """Authenticate an SSE request using the same JWT-cookie auth as DRF.

    Returns the user on success, None on failure. We bypass DRF here because
    DRF's content negotiation + renderer chain doesn't play well with
    StreamingHttpResponse and the text/event-stream Accept header.
    """
    from utils.authentication import CustomTokenAuthentication
    try:
        auth = CustomTokenAuthentication()
        result = auth.authenticate(request)
        if result is None:
            return None
        return result[0]  # (user, token)
    except (AuthenticationFailed, KeyError, AttributeError, ValueError) as e:
        logger.debug("SSE auth rejected: %s", e)
        return None


class OHBaseView(APIView):
    """Base view for One Health endpoints — authentication required."""
    permission_classes = [IsAuthenticated]


@method_decorator(csrf_exempt, name="dispatch")
class OHStreamBase(View):
    """Base for SSE endpoints — plain Django View, manual auth, manual CORS.

    Avoids DRF's content negotiation + renderer chain which fails with
    text/event-stream Accept header.
    """

    def dispatch(self, request, *args, **kwargs):
        user = _authenticate_sse(request)
        if user is None:
            resp = JsonResponse(
                {"status": "Error", "message": "Authentication required.", "data": {}},
                status=401,
            )
            return _attach_cors(request, resp)
        request.user = user
        return super().dispatch(request, *args, **kwargs)


def dictfetchall(cursor):
    """Return all rows from a cursor as a list of dicts."""
    columns = [col[0] for col in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]


class CountriesView(OHBaseView):
    """GET /api/v1/onehealth/countries — all 46 AFRO countries with risk data."""

    def get(self, request):
        with connection.cursor() as cur:
            cur.execute("""
                SELECT
                    c.iso3,
                    c.country_name   AS name,
                    c.who_subregion  AS sub,
                    c.population_m,
                    c.lat_centroid   AS lat,
                    c.lon_centroid   AS lon,
                    c.climate_zone,
                    c.fragility_index,
                    COALESCE(s.interface_risk_score, c.fragility_index) AS risk,
                    COALESCE(s.ihr_overall_score, s.ihr_overall_average_score, 51) AS spar,
                    COALESCE(s.displacement_index, 0)      AS displacement_index,
                    COALESCE(s.bushmeat_market_presence, FALSE) AS bushmeat,
                    v.aedes_aegypti_suitability,
                    v.anopheles_gambiae_suitability,
                    h.bat_species_count,
                    h.host_diversity_index,
                    h.zoonotic_host_richness_class
                FROM oh_countries c
                LEFT JOIN oh_spillover_risk_factors s ON c.iso3 = s.country_iso3
                LEFT JOIN oh_vector_ecology          v ON c.iso3 = v.country_iso3
                LEFT JOIN oh_host_ecology            h ON c.iso3 = h.country_iso3
                ORDER BY c.country_name
            """)
            rows = dictfetchall(cur)

        # Convert Decimal to float for JSON
        for r in rows:
            for k, v in r.items():
                if v is not None and hasattr(v, 'as_integer_ratio') and not isinstance(v, bool):
                    r[k] = float(v)

        return Response(rows)


class PathogensView(OHBaseView):
    """GET /api/v1/onehealth/pathogens — pathogen profiles for simulation."""

    def get(self, request):
        with connection.cursor() as cur:
            cur.execute("""
                SELECT disease, domain, r0_min, r0_max, cfr_pct,
                       spillover_score, ihr_notifiable, woah_listed,
                       pandemic_potential, natural_host, reservoir,
                       incubation_days_min, incubation_days_max
                FROM oh_pathogen_profiles
                ORDER BY spillover_score DESC NULLS LAST
            """)
            rows = dictfetchall(cur)

        for r in rows:
            for k, v in r.items():
                if v is not None and hasattr(v, 'as_integer_ratio') and not isinstance(v, bool):
                    r[k] = float(v)

        return Response(rows)


class SpilloverRiskView(OHBaseView):
    """GET /api/v1/onehealth/spillover — composite risk view for map layer."""

    def get(self, request):
        with connection.cursor() as cur:
            cur.execute("""
                SELECT * FROM oh_spillover_composite_index
            """)
            rows = dictfetchall(cur)

        for r in rows:
            for k, v in r.items():
                if v is not None and hasattr(v, 'as_integer_ratio') and not isinstance(v, bool):
                    r[k] = float(v)

        return Response(rows)


class VectorEcologyView(OHBaseView):
    """GET /api/v1/onehealth/vectors — vector suitability per country."""

    def get(self, request):
        with connection.cursor() as cur:
            cur.execute("""
                SELECT v.*, c.country_name, c.lat_centroid AS lat, c.lon_centroid AS lon
                FROM oh_vector_ecology v
                JOIN oh_countries c ON v.country_iso3 = c.iso3
                ORDER BY v.aedes_aegypti_suitability DESC
            """)
            rows = dictfetchall(cur)

        for r in rows:
            for k, v in r.items():
                if v is not None and hasattr(v, 'as_integer_ratio') and not isinstance(v, bool):
                    r[k] = float(v)

        return Response(rows)


class HostEcologyView(OHBaseView):
    """GET /api/v1/onehealth/hosts — host/reservoir ecology per country."""

    def get(self, request):
        with connection.cursor() as cur:
            cur.execute("""
                SELECT h.*, c.country_name, c.lat_centroid AS lat, c.lon_centroid AS lon
                FROM oh_host_ecology h
                JOIN oh_countries c ON h.country_iso3 = c.iso3
                ORDER BY h.host_diversity_index DESC
            """)
            rows = dictfetchall(cur)

        for r in rows:
            for k, v in r.items():
                if v is not None and hasattr(v, 'as_integer_ratio') and not isinstance(v, bool):
                    r[k] = float(v)

        return Response(rows)


class KPIsView(OHBaseView):
    """GET /api/v1/onehealth/kpis — top-line numbers for dashboard header."""

    def get(self, request):
        with connection.cursor() as cur:
            cur.execute("SELECT count(*) FROM oh_countries")
            total_countries = cur.fetchone()[0]

            cur.execute("""
                SELECT ROUND(AVG(COALESCE(ihr_overall_score, ihr_overall_average_score, 51))::numeric, 1)
                FROM oh_spillover_risk_factors
            """)
            spar_avg = float(cur.fetchone()[0] or 51)

            cur.execute("""
                SELECT ROUND(AVG(interface_risk_score)::numeric, 1)
                FROM oh_spillover_risk_factors
                WHERE interface_risk_score IS NOT NULL
            """)
            risk_avg = cur.fetchone()[0]
            risk_avg = float(risk_avg) if risk_avg else 0

            cur.execute("""
                SELECT count(*) FROM oh_spillover_risk_factors
                WHERE bushmeat_market_presence = TRUE
            """)
            bushmeat_countries = cur.fetchone()[0]

            cur.execute("SELECT count(*) FROM oh_pathogen_profiles")
            pathogen_count = cur.fetchone()[0]

            # Active alerts (Tier 3-4)
            cur.execute("""
                SELECT count(*) FROM oh_alerts
                WHERE alert_tier >= 3 AND status != 'closed'
            """)
            tier_high = cur.fetchone()[0]

            # Active outbreaks (distinct disease+country with open alerts)
            cur.execute("""
                SELECT count(DISTINCT disease_name || country_iso3)
                FROM oh_alerts WHERE status != 'closed'
            """)
            active_outbreaks = cur.fetchone()[0]

        return Response({
            "total_countries": total_countries,
            "afro_spar_avg": spar_avg,
            "spillover_risk_idx": risk_avg,
            "bushmeat_countries": bushmeat_countries,
            "pathogen_profiles": pathogen_count,
            "tier_high_alerts": tier_high,
            "active_outbreaks": active_outbreaks,
        })


# ═════════════════════════════════════════════════════════════════════════════
# TRIAD DASHBOARD ADDITIONS — Ported from triad_api FastAPI
# ═════════════════════════════════════════════════════════════════════════════

# ── Search index (in-memory, refreshed every 5 min) ────────────────────────
_SEARCH_INDEX: dict = {}
_SEARCH_INDEX_TS: float = 0.0
_SEARCH_INDEX_LOCK = threading.Lock()


def _tokenize(s: str) -> list:
    if not s:
        return []
    return [t for t in re.split(r"[\s\-_/]+", s.lower()) if t]


def _build_search_index():
    global _SEARCH_INDEX, _SEARCH_INDEX_TS
    idx = {"country": [], "disease": [], "alert": [], "agent": []}
    with connection.cursor() as cur:
        # Countries
        cur.execute("SELECT iso3, country_name, who_subregion FROM oh_countries")
        for r in dictfetchall(cur):
            idx["country"].append({
                "id": r["iso3"], "label": r["country_name"],
                "sub": r.get("who_subregion", ""),
                "tokens": _tokenize(f"{r['country_name']} {r['iso3']} {r.get('who_subregion', '')}"),
            })
        # Diseases
        cur.execute("""SELECT disease AS disease_name, domain AS disease_class,
                              r0_min, r0_max, cfr_pct, spillover_score
                       FROM oh_pathogen_profiles""")
        for r in dictfetchall(cur):
            idx["disease"].append({
                "id": r["disease_name"], "label": r["disease_name"],
                "sub": r.get("disease_class", ""),
                "score": r.get("spillover_score"),
                "r0": f"{r.get('r0_min', '?')}–{r.get('r0_max', '?')}",
                "cfr": r.get("cfr_pct"),
                "tokens": _tokenize(f"{r['disease_name']} {r.get('disease_class', '')}"),
            })
        # Alerts (top 100)
        cur.execute("""SELECT alert_id, country_iso3, disease_name, alert_tier, district
                       FROM oh_alerts WHERE alert_tier >= 1
                       ORDER BY alert_date DESC LIMIT 100""")
        for r in dictfetchall(cur):
            idx["alert"].append({
                "id": r["alert_id"],
                "label": f"{r.get('disease_name', '?')} — {r.get('country_iso3', '?')}",
                "sub": r.get("district") or f"Tier {r.get('alert_tier')}",
                "tier": r.get("alert_tier"),
                "tokens": _tokenize(f"{r.get('disease_name', '')} {r.get('country_iso3', '')} "
                                    f"{r.get('district', '')}"),
            })
    with _SEARCH_INDEX_LOCK:
        _SEARCH_INDEX = idx
        _SEARCH_INDEX_TS = time.time()


def _score(query_tokens, item):
    if not query_tokens:
        return 0.0
    s = 0.0
    item_tokens = item.get("tokens", [])
    item_str = " ".join(item_tokens)
    for q in query_tokens:
        if q in item_tokens:
            s += 4.0
        elif any(t.startswith(q) for t in item_tokens):
            s += 2.5
        elif q in item_str:
            s += 1.0
    if len(query_tokens) == 1 and item.get("id", "").lower() == query_tokens[0]:
        s += 6.0
    if item.get("tier", 0) and int(item.get("tier", 0)) >= 3:
        s += 0.5
    return s


class UnifiedSearchView(OHBaseView):
    """GET /api/v1/onehealth/search?q=&limit=&types= — fast unified search."""

    def get(self, request):
        q = request.query_params.get("q", "").strip()
        if not q:
            return Response({"results": [], "total": 0, "took_ms": 0})
        limit = min(int(request.query_params.get("limit", 8)), 30)
        types_str = request.query_params.get("types", None)
        wanted = set(types_str.split(",")) if types_str else {"country", "disease", "alert", "agent"}

        t0 = time.time()
        # Refresh index if stale or empty
        if not _SEARCH_INDEX or (time.time() - _SEARCH_INDEX_TS > 300):
            try:
                _build_search_index()
            except (DatabaseError, OSError, ValueError, AttributeError) as e:
                logger.warning("search index build failed: %s", e)
                return Response({"results": [], "error": str(e), "took_ms": 0})

        qt = _tokenize(q)
        results = []
        for etype in wanted:
            for item in _SEARCH_INDEX.get(etype, []):
                sc = _score(qt, item)
                if sc > 0:
                    results.append({
                        "type": etype, "id": item["id"], "label": item["label"],
                        "sub": item.get("sub", ""),
                        "extra": {k: v for k, v in item.items() if k in ("score", "r0", "cfr", "tier")},
                        "score": round(sc, 2),
                    })
        results.sort(key=lambda r: r["score"], reverse=True)
        results = results[:limit]
        return Response({
            "query": q, "results": results, "total": len(results),
            "took_ms": round((time.time() - t0) * 1000, 1),
        })


class SearchReindexView(OHBaseView):
    """POST /api/v1/onehealth/search/reindex — manual rebuild."""

    def post(self, request):
        _build_search_index()
        counts = {k: len(v) for k, v in _SEARCH_INDEX.items()}
        return Response({"ok": True, "indexed": counts,
                         "ts": datetime.utcnow().isoformat() + "Z"})


# ── Alert Explainer helpers ─────────────────────────────────────────────────

def _narrate_alert(alert, report, human, animal, pathogen, country):
    tier = alert.get("alert_tier", 1)
    disease = alert.get("disease_name", "Unknown disease")
    iso3 = alert.get("country_iso3", "")
    cname = (country or {}).get("country_name", iso3)
    n_human = sum(int(h.get("case_count", 0) or 0) for h in human) if human else 0
    n_animal = sum(int(a.get("animals_sick", 0) or 0) for a in animal) if animal else 0
    deaths = sum(1 for h in (human or []) if (h.get("outcome") or "").lower() == "died")

    lines = []
    severity = {1: "Routine signal", 2: "Watch-level alert",
                3: "Outbreak alert", 4: "Severe IHR-notifiable event"}.get(tier, "Alert")
    lines.append(f"{severity}: {disease} in {cname}.")
    if n_human or n_animal:
        bits = []
        if n_human:
            bits.append(f"{n_human} human case(s)")
        if deaths:
            bits.append(f"{deaths} death(s)")
        if n_animal:
            bits.append(f"{n_animal} animal(s) affected")
        lines.append("Current burden — " + ", ".join(bits) + ".")
    if pathogen:
        r0 = f"{pathogen.get('r0_min', '?')}–{pathogen.get('r0_max', '?')}"
        cfr = pathogen.get("cfr_pct")
        sp = pathogen.get("spillover_score")
        lines.append(f"{disease} has R₀ {r0}"
                     f"{f', CFR {cfr}%' if cfr else ''}"
                     f"{f', spillover-risk score {sp}/100' if sp else ''}.")
    if alert.get("ihr_notifiable"):
        lines.append("IHR Annex 2 notifiable — WHO IHR focal point should be informed within 24h.")
    if alert.get("woah_listed"):
        lines.append("WOAH-listed disease — animal-side notification required to WAHIS.")
    return " ".join(lines)


def _what_to_watch(alert, pathogen):
    out = []
    tier = alert.get("alert_tier", 1)
    if tier >= 3:
        out.append("Verify case definition and laboratory confirmation status")
        out.append("Confirm contact tracing has been initiated")
    if pathogen:
        if (pathogen.get("spillover_score") or 0) >= 70:
            out.append("Cross-check WOAH WAHIS for concurrent animal events")
        if pathogen.get("vector_borne"):
            out.append("Pull NASA POWER / NDVI for vector suitability in affected districts")
    if alert.get("ihr_notifiable"):
        out.append("Assess against IHR Annex 2 decision instrument (4 criteria)")
    out.append("Check for cross-border movement and neighbouring-country signals")
    return out


class AlertExplainView(OHBaseView):
    """GET /api/v1/onehealth/alerts/<alert_id>/explain — rich deep-dive."""

    def get(self, request, alert_id):
        with connection.cursor() as cur:
            cur.execute("SELECT * FROM oh_alerts WHERE alert_id = %s", [alert_id])
            rows = dictfetchall(cur)
        if not rows:
            return Response({"error": f"Alert {alert_id} not found"}, status=404)
        alert = rows[0]
        for k, v in alert.items():
            if v is not None and hasattr(v, 'as_integer_ratio') and not isinstance(v, bool):
                alert[k] = float(v)

        report_id = alert.get("report_id")
        iso3 = alert.get("country_iso3")
        disease = alert.get("disease_name")
        report = human = animal = pathogen = country = env = None

        with connection.cursor() as cur:
            if report_id:
                cur.execute("SELECT * FROM oh_disease_reports WHERE report_id = %s", [report_id])
                rr = dictfetchall(cur)
                report = rr[0] if rr else None
                cur.execute("SELECT * FROM oh_human_cases WHERE report_id = %s", [report_id])
                human = dictfetchall(cur)
                cur.execute("SELECT * FROM oh_animal_events WHERE report_id = %s", [report_id])
                animal = dictfetchall(cur)
            if disease:
                # Try exact match first, then case-insensitive substring match
                # (handles e.g. "Polio" vs "Poliomyelitis", "Marburg" vs
                # "Marburg viral disease" without forcing a perfect string).
                cur.execute("SELECT * FROM oh_pathogen_profiles WHERE disease = %s LIMIT 1", [disease])
                pr = dictfetchall(cur)
                if not pr:
                    cur.execute("""
                        SELECT * FROM oh_pathogen_profiles
                        WHERE LOWER(disease) LIKE %s
                           OR LOWER(%s) LIKE '%%' || LOWER(disease) || '%%'
                        ORDER BY length(disease) ASC
                        LIMIT 1
                    """, [f"%{disease.lower()}%", disease])
                    pr = dictfetchall(cur)
                pathogen = pr[0] if pr else None
            if iso3:
                cur.execute("SELECT * FROM oh_countries WHERE iso3 = %s", [iso3])
                cr = dictfetchall(cur)
                country = cr[0] if cr else None
                cur.execute("""SELECT * FROM oh_env_observations WHERE country_iso3 = %s
                               ORDER BY obs_date DESC LIMIT 4""", [iso3])
                env = dictfetchall(cur)

        # Convert Decimals
        for obj_list in [human or [], animal or [], env or []]:
            for r in obj_list:
                for k, v in r.items():
                    if v is not None and hasattr(v, 'as_integer_ratio') and not isinstance(v, bool):
                        r[k] = float(v)
        for obj in [report, pathogen, country]:
            if obj:
                for k, v in obj.items():
                    if v is not None and hasattr(v, 'as_integer_ratio') and not isinstance(v, bool):
                        obj[k] = float(v)

        # ── Country+disease aggregate (across all SIG- alerts) ──────────
        # When the single article behind this alert had no extractable
        # case/death numbers, surface what other recent articles for the
        # same disease+country said, so the panel isn't a mute "0/0/0".
        #
        # Three things this guards against:
        #   1. RLS on sentinel_signal — query inside super-admin tenant
        #      context so all rows are visible.
        #   2. Non-SIG alert_ids (legacy ALT-/RPT- formats) — the cast
        #      to INTEGER would error, so we filter those out in WHERE.
        #   3. Total query failure — wrap in try/except so a slow or
        #      broken aggregate never blocks the whole drawer.
        agg = {"alert_count": 0, "cases_sum": 0, "deaths_sum": 0,
               "first_seen": None, "last_seen": None}
        if disease and iso3:
            from utils.tenant_tasks import tenant_context
            try:
                with tenant_context('0'):
                    with connection.cursor() as cur:
                        cur.execute("""
                            SELECT
                                count(*) AS n_alerts,
                                COALESCE(SUM(s.reported_cases), 0)  AS cases_sum,
                                COALESCE(SUM(s.reported_deaths), 0) AS deaths_sum,
                                MIN(s.created_at) AS first_seen,
                                MAX(s.created_at) AS last_seen
                            FROM oh_alerts a
                            JOIN sentinel_signal s
                              ON a.alert_id ~ '^SIG-[0-9]+$'
                             AND s.id = SUBSTRING(a.alert_id FROM 5)::INTEGER
                            WHERE a.disease_name = %s
                              AND a.country_iso3 = %s
                              AND a.status != 'closed'
                        """, [disease, iso3])
                        row = cur.fetchone()
                        if row:
                            agg = {
                                "alert_count": int(row[0] or 0),
                                "cases_sum":   int(row[1] or 0),
                                "deaths_sum":  int(row[2] or 0),
                                "first_seen":  row[3].isoformat() if row[3] else None,
                                "last_seen":   row[4].isoformat() if row[4] else None,
                            }
            except _DB_ERRORS as e:
                # Aggregate failure must not break the drawer
                logger.warning(
                    "AlertExplainView aggregate failed for %s/%s: %s",
                    iso3, disease, e
                )

        # Per-alert summary (this single article)
        single_human = sum(int(h.get("case_count", 0) or 0) for h in (human or []))
        single_deaths = sum(1 for h in (human or []) if (h.get("outcome") or "").lower() == "died")
        single_animals = sum(int(a.get("animals_sick", 0) or 0) + int(a.get("animals_dead", 0) or 0)
                             for a in (animal or []))

        # Effective summary: prefer per-alert numbers; fall back to country
        # aggregate so the user sees something meaningful instead of all-zero.
        effective = {
            "human_cases_total": single_human or agg["cases_sum"],
            "deaths_total": single_deaths or agg["deaths_sum"],
            "animals_affected": single_animals,
            "tier": alert.get("alert_tier"),
            "from_aggregate": (single_human == 0 and agg["cases_sum"] > 0)
                              or (single_deaths == 0 and agg["deaths_sum"] > 0),
        }

        return Response({
            "alert": alert,
            "narrative": _narrate_alert(alert, report, human or [], animal or [], pathogen, country),
            "what_to_watch": _what_to_watch(alert, pathogen),
            "pathogen": pathogen,
            "country": country,
            "report": report,
            "human_cases": human or [],
            "animal_events": animal or [],
            "env_recent": env or [],
            "ihr_flags": {
                "ihr_notifiable": bool(alert.get("ihr_notifiable")),
                "woah_listed": bool(alert.get("woah_listed")),
            },
            "summary": effective,
            "country_aggregate": agg,
            "ts": datetime.utcnow().isoformat() + "Z",
        })


# ── SEIR Streaming helpers ──────────────────────────────────────────────────

def _seir_step(state, beta, sigma, gamma, vax_eff):
    """One-day SEIR Euler step.

    Standard model normalises β·S·I by N, otherwise transmission scales
    with absolute S (millions) and the outbreak crashes in a single day.
    """
    S, E, I, R = state["S"], state["E"], state["I"], state["R"]
    N = S + E + I + R
    if N <= 0:
        return {"S": S, "E": E, "I": I, "R": R}
    S_eff = S * vax_eff
    dS = -beta * S_eff * I / N
    dE = beta * S_eff * I / N - sigma * E
    dI = sigma * E - gamma * I
    dR = gamma * I
    return {
        "S": max(0.0, S + dS), "E": max(0.0, E + dE),
        "I": max(0.0, I + dI), "R": R + dR,
    }


def _seir_phase(day, peak_day, I, last_I, R, N):
    if day < 5:
        return "ignition"
    if I > last_I * 1.05 and day < peak_day:
        return "exponential growth"
    if abs(I - last_I) / max(1.0, I) < 0.03:
        return "plateau"
    if I < last_I * 0.97:
        return "decline"
    if R / N > 0.4:
        return "fade-out (population immunity)"
    return "active spread"


def _dominant_driver(params):
    contribs = {
        "Host–human interface": params.get("host_interface", 0.5),
        "Deforestation": params.get("deforestation", 0.5),
        "Livestock density": params.get("livestock_density", 0.5),
    }
    mitigators = {
        "Vaccination coverage": params.get("vaccination_coverage", 0.5),
        "Lab capacity": params.get("lab_capacity", 0.5),
    }
    top = max(contribs, key=contribs.get)
    bot = max(mitigators, key=mitigators.get)
    explain = (f"Transmission is being amplified most by {top.lower()} "
               f"({contribs[top]:.0%}); the strongest brake is {bot.lower()} "
               f"({mitigators[bot]:.0%}).")
    return top, explain


class SeirExplainView(OHBaseView):
    """POST /api/v1/onehealth/simulation/seir/explain — pre-run interpretation."""

    def post(self, request):
        p = request.data or {}
        r0 = float(p.get("r0", 1.85))
        gamma = float(p.get("gamma", 0.07))
        host_interface = float(p.get("host_interface", 0.72))
        deforestation = float(p.get("deforestation", 0.58))
        livestock_density = float(p.get("livestock_density", 0.81))
        vaccination_coverage = float(p.get("vaccination_coverage", 0.43))
        lab_capacity = float(p.get("lab_capacity", 0.51))

        r0_adj = r0 * (0.5 + host_interface * 0.5) \
                     * (0.6 + deforestation * 0.4) \
                     * (0.7 + livestock_density * 0.3)
        gamma_adj = gamma * (1 + lab_capacity * 0.3)
        Re = r0_adj * (1 - vaccination_coverage * 0.6)

        if Re < 1.0:
            verdict = ("Effective R below 1 — the model expects this outbreak to "
                       "fizzle out rather than grow. Containment levers are working.")
            regime = "containment"
        elif Re < 1.5:
            verdict = ("Effective R is slightly above 1 — slow growth expected, "
                       "with a long but low peak.")
            regime = "slow growth"
        elif Re < 2.5:
            verdict = ("Effective R in the 1.5–2.5 range — classical outbreak trajectory, "
                       "peak likely within 6–10 weeks if no further intervention.")
            regime = "outbreak"
        else:
            verdict = ("Effective R above 2.5 — explosive growth regime. Without "
                       "intervention this becomes population-level very quickly.")
            regime = "explosive"

        driver, driver_text = _dominant_driver(p)
        return Response({
            "r0_baseline": r0, "r0_adjusted": round(r0_adj, 3),
            "r_effective": round(Re, 3),
            "doubling_days": round(0.693 / max(0.001, (r0_adj - 1) * gamma_adj), 1)
                            if r0_adj > 1.01 else None,
            "regime": regime, "verdict": verdict,
            "dominant_driver": driver, "driver_text": driver_text,
        })


class SeirStreamView(OHStreamBase):
    """POST /api/v1/onehealth/simulation/seir/stream — SSE streaming SEIR."""

    def post(self, request):
        try:
            p = json.loads(request.body.decode("utf-8")) if request.body else {}
        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            logger.debug("simulation post: bad JSON body: %s", e)
            p = {}
        N = int(p.get("population", 5_000_000))
        I0 = int(p.get("initial_infected", 10))
        days = int(p.get("days", 90))
        r0 = float(p.get("r0", 1.85))
        gamma = float(p.get("gamma", 0.07))
        sigma = float(p.get("sigma", 0.14))
        cfr_pct = float(p.get("cfr_pct", 5))
        host_interface = float(p.get("host_interface", 0.72))
        deforestation = float(p.get("deforestation", 0.58))
        livestock = float(p.get("livestock_density", 0.81))
        vax = float(p.get("vaccination_coverage", 0.43))
        lab = float(p.get("lab_capacity", 0.51))

        r0_adj = r0 * (0.5 + host_interface * 0.5) * (0.6 + deforestation * 0.4) * (0.7 + livestock * 0.3)
        gamma_adj = gamma * (1 + lab * 0.3)
        beta = r0_adj * gamma_adj
        state = {"S": float(N - I0 * 4), "E": float(I0 * 3), "I": float(I0), "R": 0.0}
        driver, driver_text = _dominant_driver(p)

        # Pre-scan for peak
        peak_day, peak_I = 0, 0.0
        s2 = dict(state)
        for d in range(days + 1):
            vax_eff = 1.0 - (vax * 0.6 * min(1.0, d / 30.0))
            s2 = _seir_step(s2, beta, sigma, gamma_adj, vax_eff)
            if s2["I"] > peak_I:
                peak_I, peak_day = s2["I"], d

        def gen():
            # Start frame
            yield "data: " + json.dumps({
                "event": "start", "model": "SEIR with One Health risk-factor modulation",
                "r0_adjusted": round(r0_adj, 3), "beta": round(beta, 5),
                "gamma": round(gamma_adj, 4), "sigma": round(sigma, 4),
                "peak_day_predicted": peak_day, "dominant_driver": driver,
                "narration": f"Starting simulation. Adjusted R₀ = {r0_adj:.2f}, predicted peak around day {peak_day}. {driver_text}",
            }) + "\n\n"

            last_I = state["I"]
            cur = dict(state)
            cum_deaths = 0.0

            for day in range(days + 1):
                vax_eff = 1.0 - (vax * 0.6 * min(1.0, day / 30.0))
                cur = _seir_step(cur, beta, sigma, gamma_adj, vax_eff)
                phase = _seir_phase(day, peak_day, cur["I"], last_I, cur["R"], N)
                new_deaths = (gamma_adj * cur["I"]) * (cfr_pct / 100.0)
                cum_deaths += new_deaths

                note = None
                if day == 0:
                    note = f"Day 0 — {int(cur['I'])} infectious seed cases."
                elif day == max(1, peak_day // 4) and phase == "exponential growth":
                    note = f"Cases doubling roughly every {round(0.693 / max(0.001, (r0_adj - 1) * gamma_adj), 1)} days."
                elif day == peak_day:
                    note = f"Peak reached: ~{int(cur['I']):,} infectious."
                elif phase == "fade-out (population immunity)" and day % 7 == 0:
                    note = f"Population immunity at ~{cur['R']/N:.0%} driving decline."

                frame = {
                    "event": "step", "day": day,
                    "susceptible": round(cur["S"]), "exposed": round(cur["E"]),
                    "infected": round(cur["I"]), "recovered": round(cur["R"]),
                    "hospitalised": round(cur["I"] * 0.12),
                    "deaths_cum": round(cum_deaths),
                    "ci_upper": round(cur["I"] * 1.25),
                    "ci_lower": round(max(0.0, cur["I"] * 0.75)),
                    "phase": phase,
                }
                if note:
                    frame["narration"] = note
                yield "data: " + json.dumps(frame) + "\n\n"
                last_I = cur["I"]

            # Done frame
            p_epidemic = min(0.99, max(0.01, 1.0 - math.exp(-r0_adj * state["E"] / N)))
            yield "data: " + json.dumps({
                "event": "done", "peak_day": peak_day,
                "peak_infected": round(peak_I),
                "total_deaths": round(cum_deaths),
                "attack_rate": round(cur["R"] / N, 4),
                "p_epidemic_pct": round(p_epidemic * 100, 1),
                "r0_adjusted": round(r0_adj, 3),
                "narration": (f"Simulation complete. Peak day {peak_day} with ~{int(peak_I):,} "
                              f"infectious. Final attack rate {cur['R']/N:.1%}. "
                              f"Cumulative deaths ~{int(cum_deaths):,} at CFR {cfr_pct}%."),
            }) + "\n\n"

        resp = StreamingHttpResponse(gen(), content_type="text/event-stream",
                                     headers={"Cache-Control": "no-cache",
                                              "X-Accel-Buffering": "no"})
        return _attach_cors(request, resp)


class LiveStreamView(OHStreamBase):
    """GET /api/v1/onehealth/stream/live — SSE push of KPIs + alerts + agents every 5s."""

    def get(self, request):
        def _snapshot():
            snap = {"ts": datetime.utcnow().isoformat() + "Z"}
            with connection.cursor() as cur:
                # KPIs
                try:
                    cur.execute("SELECT count(*) FROM oh_alerts WHERE alert_tier >= 3 AND status != 'closed'")
                    snap["kpis"] = {"tier_high_alerts": cur.fetchone()[0]}
                    cur.execute("SELECT count(DISTINCT disease_name || country_iso3) FROM oh_alerts WHERE status != 'closed'")
                    snap["kpis"]["active_outbreaks"] = cur.fetchone()[0]
                except _DB_ERRORS as e:
                    logger.warning("snapshot kpis read failed: %s", e)
                    snap["kpis_error"] = str(e)
                # Top 20 alerts
                try:
                    cur.execute("""SELECT alert_id, country_iso3, disease_name, alert_tier,
                                          alert_date, district, ihr_notifiable, woah_listed
                                   FROM oh_alerts WHERE alert_tier >= 1
                                   ORDER BY alert_date DESC, alert_id DESC LIMIT 20""")
                    alerts = dictfetchall(cur)
                    for r in alerts:
                        for k, v in r.items():
                            if v is not None and hasattr(v, 'as_integer_ratio') and not isinstance(v, bool):
                                r[k] = float(v)
                    snap["alerts"] = alerts
                except _DB_ERRORS as e:
                    logger.warning("snapshot alerts read failed: %s", e)
                    snap["alerts_error"] = str(e)
            # Agents (read with its own helper so dict shape stays consistent)
            try:
                snap["agents"] = _fetch_agents()
            except _DB_ERRORS as e:
                logger.warning("snapshot agents read failed: %s", e)
                snap["agents_error"] = str(e)
            # HITL pending actions
            try:
                snap["hitl"] = _fetch_hitl_pending(10)
            except _DB_ERRORS as e:
                logger.warning("snapshot hitl read failed: %s", e)
                snap["hitl_error"] = str(e)
            return snap

        def gen():
            # Initial frame immediately
            try:
                yield "data: " + json.dumps(_snapshot()) + "\n\n"
            except (TypeError, ValueError) as e:
                logger.warning("SSE initial snapshot failed: %s", e)
                yield "data: " + json.dumps({"error": str(e)}) + "\n\n"
            # Then every 5s (capped at ~5 min to avoid zombie connections)
            for _ in range(60):
                time.sleep(5)
                try:
                    yield "data: " + json.dumps(_snapshot()) + "\n\n"
                except (TypeError, ValueError) as e:
                    logger.warning("SSE snapshot frame failed: %s", e)
                    yield "data: " + json.dumps({"error": str(e), "ts": datetime.utcnow().isoformat() + "Z"}) + "\n\n"

        resp = StreamingHttpResponse(gen(), content_type="text/event-stream",
                                     headers={"Cache-Control": "no-cache, no-transform",
                                              "X-Accel-Buffering": "no"})
        return _attach_cors(request, resp)


class CountryDetailView(OHBaseView):
    """GET /api/v1/onehealth/country/<iso3> — full detail for one country."""

    def get(self, request, iso3):
        iso3 = iso3.upper()
        with connection.cursor() as cur:
            cur.execute("SELECT * FROM oh_country_risk_profile WHERE iso3 = %s", [iso3])
            rows = dictfetchall(cur)

        if not rows:
            return Response({"error": f"Country {iso3} not found"}, status=404)

        row = rows[0]
        for k, v in row.items():
            if v is not None and hasattr(v, 'as_integer_ratio') and not isinstance(v, bool):
                row[k] = float(v)

        return Response(row)


class AlertsView(OHBaseView):
    """GET /api/v1/onehealth/alerts — active alerts with optional min_tier filter."""

    def get(self, request):
        min_tier = int(request.query_params.get("min_tier", 1))
        limit = int(request.query_params.get("limit", 50))

        with connection.cursor() as cur:
            cur.execute("""
                SELECT alert_id, report_id, country_iso3, district,
                       disease_name, alert_tier, alert_date, status,
                       ihr_notifiable, woah_listed, response_hours,
                       gps_lat, gps_lon
                FROM oh_alerts
                WHERE alert_tier >= %s
                ORDER BY alert_date DESC, alert_tier DESC
                LIMIT %s
            """, [min_tier, limit])
            rows = dictfetchall(cur)

        for r in rows:
            for k, v in r.items():
                if v is not None and hasattr(v, 'as_integer_ratio') and not isinstance(v, bool):
                    r[k] = float(v)

        return Response(rows)


def _seconds_to_label(seconds):
    """Format seconds-since-event as 'Xs ago' / 'Xm ago' / 'Xh ago' / 'Xd ago'."""
    if seconds is None:
        return "—"
    s = int(seconds)
    if s < 60:
        return f"{s}s ago"
    if s < 3600:
        return f"{s // 60}m ago"
    if s < 86400:
        return f"{s // 3600}h ago"
    return f"{s // 86400}d ago"


def _freshness_status(seconds):
    """Categorise freshness for UI colour coding."""
    if seconds is None:
        return "not_configured"
    if seconds < 600:
        return "fresh"            # <10 min — green
    if seconds < 21600:
        return "stale"            # <6 h   — amber
    return "disconnected"         # >6 h   — red


def _fetch_ingestion_status():
    """Return real ingestion-source status for the StatusBar panel.

    For each platform we map to the best-available real timestamp from
    existing tables. If no row matches, the status becomes 'not_configured'
    so the UI can render an honest 'not wired' state.

    Each source query is wrapped in transaction.atomic() (savepoint) so that
    a missing table (e.g. hdis_sourceconfig) doesn't poison the PostgreSQL
    transaction for subsequent queries.
    """
    from django.db import transaction

    out = []

    def _query_source(name, sql, params=None):
        """Run a single freshness query inside a savepoint."""
        try:
            with transaction.atomic():
                with connection.cursor() as cur:
                    cur.execute(sql, params or [])
                    row = cur.fetchone()
                    seconds = float(row[0]) if row and row[0] is not None else None
                    return {
                        "name": name,
                        "status": _freshness_status(seconds),
                        "label": _seconds_to_label(seconds),
                        "last_seen": row[1].isoformat() if row and row[1] else None,
                    }
        except _DB_ERRORS as e:
            logger.debug("freshness probe %s failed (treating as not configured): %s", name, e)
            return {"name": name, "status": "not_configured",
                    "label": "—", "last_seen": None, "error": str(e)}

    # ── DHIS2 — closest match: hdis_sourceconfig last_polled_at ─────
    out.append(_query_source("DHIS2", """
        SELECT EXTRACT(EPOCH FROM (NOW() - MAX(last_polled_at))),
               MAX(last_polled_at)
        FROM hdis_pro_sourceconfig
        WHERE last_polled_at IS NOT NULL
    """))

    # ── WAHIS — derive from oh_disease_reports source label ─────────
    out.append(_query_source("WAHIS", """
        SELECT EXTRACT(EPOCH FROM (NOW() - MAX(created_at))),
               MAX(created_at)
        FROM oh_disease_reports
        WHERE LOWER(report_source) LIKE %s
    """, ['%wahis%']))

    # ── NASA POWER — derive from oh_env_observations latest obs_date ─
    out.append(_query_source("NASA POWER", """
        SELECT EXTRACT(EPOCH FROM (NOW() - MAX(obs_date)::timestamptz)),
               MAX(obs_date)
        FROM oh_env_observations
    """))

    # ── WHO EWARN — map to sentinel_signal where ingestion_source matches WHO ─
    out.append(_query_source("WHO EWARN", """
        SELECT EXTRACT(EPOCH FROM (NOW() - MAX(created_at))),
               MAX(created_at)
        FROM sentinel_signal
        WHERE ingestion_source ILIKE %s
    """, ['%who%']))

    # ── GISAID — derive from sentinel_signal where ingestion_source matches ─
    out.append(_query_source("GISAID", """
        SELECT EXTRACT(EPOCH FROM (NOW() - MAX(created_at))),
               MAX(created_at)
        FROM sentinel_signal
        WHERE ingestion_source ILIKE %s
    """, ['%gisaid%']))

    return out


class IngestionStatusView(OHBaseView):
    """GET /api/v1/onehealth/ingestion-status — real freshness per source for the StatusBar."""

    def get(self, request):
        # sentinel_signal has RLS enabled — use super-admin context.
        from utils.tenant_tasks import tenant_context
        with tenant_context('0'):
            return Response(_fetch_ingestion_status())


def _fetch_hitl_pending(limit=10):
    """Read pending HITL actions ordered newest first."""
    with connection.cursor() as cur:
        cur.execute("""
            SELECT action_id, kind, title, description, severity,
                   requested_by, related_alert, status, created_at
            FROM oh_hitl_actions
            WHERE status = 'pending'
            ORDER BY created_at DESC
            LIMIT %s
        """, [limit])
        rows = dictfetchall(cur)
    for r in rows:
        if r.get("created_at") is not None:
            r["created_at"] = r["created_at"].isoformat()
    return rows


def _resolve_hitl_action(action_id, new_status, user_id=None):
    """Mark an action as approved/dismissed/acknowledged. Returns updated row or None."""
    with connection.cursor() as cur:
        cur.execute("""
            UPDATE oh_hitl_actions
            SET status = %s, resolved_at = NOW(), resolved_by = %s
            WHERE action_id = %s AND status = 'pending'
            RETURNING action_id, kind, status
        """, [new_status, user_id, action_id])
        row = cur.fetchone()
    if not row:
        return None
    return {"action_id": row[0], "kind": row[1], "status": row[2]}


class HITLPendingView(OHBaseView):
    """GET /api/v1/onehealth/hitl/pending — list current HITL pending actions."""

    def get(self, request):
        limit = int(request.query_params.get("limit", 10))
        return Response(_fetch_hitl_pending(limit))


class HITLApproveView(OHBaseView):
    """POST /api/v1/onehealth/hitl/<action_id>/approve — user approves the action."""

    def post(self, request, action_id):
        uid = getattr(request.user, "id", None)
        result = _resolve_hitl_action(action_id, "approved", uid)
        if not result:
            return Response({"error": "action not found or already resolved"}, status=404)
        return Response({"ok": True, **result})


class HITLDismissView(OHBaseView):
    """POST /api/v1/onehealth/hitl/<action_id>/dismiss — user dismisses the action."""

    def post(self, request, action_id):
        uid = getattr(request.user, "id", None)
        result = _resolve_hitl_action(action_id, "dismissed", uid)
        if not result:
            return Response({"error": "action not found or already resolved"}, status=404)
        return Response({"ok": True, **result})


class HITLAcknowledgeView(OHBaseView):
    """POST /api/v1/onehealth/hitl/<action_id>/acknowledge — user acknowledges an inform-kind item."""

    def post(self, request, action_id):
        uid = getattr(request.user, "id", None)
        result = _resolve_hitl_action(action_id, "acknowledged", uid)
        if not result:
            return Response({"error": "action not found or already resolved"}, status=404)
        return Response({"ok": True, **result})


def _fetch_agents():
    """Read all agents ordered by sort_order, normalised for the dashboard."""
    with connection.cursor() as cur:
        cur.execute("""
            SELECT agent_id, name, icon, status, status_label,
                   description, phase, sort_order, last_heartbeat, updated_at
            FROM oh_agents
            ORDER BY sort_order ASC, name ASC
        """)
        rows = dictfetchall(cur)
    for r in rows:
        for k in ("last_heartbeat", "updated_at"):
            if r.get(k) is not None:
                r[k] = r[k].isoformat()
    return rows


class AgentsView(OHBaseView):
    """GET /api/v1/onehealth/agents — list of dashboard AI agents.

    POST /api/v1/onehealth/agents — upsert one agent (heartbeat).
        Body: {agent_id, status, status_label, description?, phase?, ...}
    """

    def get(self, request):
        return Response(_fetch_agents())

    def post(self, request):
        data = request.data or {}
        agent_id = data.get("agent_id")
        if not agent_id:
            return Response({"error": "agent_id is required"}, status=400)

        fields = {
            "name": data.get("name"),
            "icon": data.get("icon"),
            "status": data.get("status"),
            "status_label": data.get("status_label"),
            "description": data.get("description"),
            "phase": data.get("phase"),
            "sort_order": data.get("sort_order"),
        }
        # Only update fields actually provided
        provided = {k: v for k, v in fields.items() if v is not None}
        if not provided:
            return Response({"error": "no fields to update"}, status=400)

        set_clause = ", ".join(f"{k} = %s" for k in provided) + ", last_heartbeat = NOW(), updated_at = NOW()"
        values = list(provided.values()) + [agent_id]

        with connection.cursor() as cur:
            cur.execute(f"""
                UPDATE oh_agents SET {set_clause} WHERE agent_id = %s
            """, values)
            if cur.rowcount == 0:
                # Insert if not present
                cur.execute("""
                    INSERT INTO oh_agents
                        (agent_id, name, icon, status, status_label, description, phase, sort_order)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """, [
                    agent_id,
                    provided.get("name", agent_id),
                    provided.get("icon", ""),
                    provided.get("status", "idle"),
                    provided.get("status_label", "IDLE"),
                    provided.get("description", ""),
                    provided.get("phase", ""),
                    provided.get("sort_order", 99),
                ])
        return Response({"ok": True, "agent_id": agent_id})


class EpiLinksView(OHBaseView):
    """GET /api/v1/onehealth/epilinks — epidemiological links between human/animal events."""

    def get(self, request):
        with connection.cursor() as cur:
            cur.execute("""
                SELECT l.link_id, l.country_iso3, l.link_type,
                       l.days_lag, l.distance_km,
                       c.country_name, c.lat_centroid AS lat, c.lon_centroid AS lon,
                       hr.disease_name AS human_disease,
                       ar.disease_name AS animal_disease
                FROM oh_epi_links l
                JOIN oh_countries c ON l.country_iso3 = c.iso3
                LEFT JOIN oh_disease_reports hr ON l.human_report_id = hr.report_id
                LEFT JOIN oh_disease_reports ar ON l.animal_report_id = ar.report_id
                ORDER BY l.created_date DESC
                LIMIT 100
            """)
            rows = dictfetchall(cur)

        for r in rows:
            for k, v in r.items():
                if v is not None and hasattr(v, 'as_integer_ratio') and not isinstance(v, bool):
                    r[k] = float(v)

        return Response(rows)


class DiseaseStatsView(OHBaseView):
    """GET /api/v1/onehealth/disease-stats — aggregated disease report stats."""

    def get(self, request):
        with connection.cursor() as cur:
            cur.execute("""
                SELECT disease_name, disease_domain,
                       count(*) AS total_reports,
                       SUM(case_count) AS total_cases,
                       MAX(alert_tier) AS max_tier,
                       count(DISTINCT country_iso3) AS countries_affected
                FROM oh_disease_reports
                GROUP BY disease_name, disease_domain
                ORDER BY total_cases DESC
            """)
            rows = dictfetchall(cur)

        for r in rows:
            for k, v in r.items():
                if v is not None and hasattr(v, 'as_integer_ratio') and not isinstance(v, bool):
                    r[k] = float(v)

        return Response(rows)


# ═════════════════════════════════════════════════════════════════════════════
# SPILLOVER EARLY WARNING + FORECAST HORIZON VIEWS
# ═════════════════════════════════════════════════════════════════════════════

def _has_real_signals(results: list) -> bool:
    """Return True if any result has actual outbreak data, not just static factors.

    When DB tables (oh_disease_reports, oh_animal_events, oh_alerts) are empty,
    the engine produces uniform scores from IHR capacity + pathogen baseline +
    seasonality alone.  Those uniform results are misleading — fall back to the
    curated MOCK_EARLY_WARNING data instead.
    """
    if not results:
        return False
    for r in results:
        if r.get("active_animal_events", 0) > 0:
            return True
        if r.get("human_contacts", 0) > 0:
            return True
        # Check intelligence signal in breakdown
        for sig in (r.get("signal_breakdown") or []):
            if sig.get("signal") == "intelligence_signal" and sig.get("sub_score", 0) > 0:
                return True
    return False


class SpilloverEarlyWarningView(OHBaseView):
    permission_classes = [AllowAny]
    """GET /api/v1/onehealth/spillover/early-warning — ranked risk assessments.

    Cascade: cache (instant) → live engine → mock fallback.
    """

    def get(self, request):
        min_stage = int(request.query_params.get('min_stage', 0))
        pathogen = request.query_params.get('pathogen', None)
        limit = int(request.query_params.get('limit', 50))

        # 1. Try pre-computed cache first (instant — single DB read)
        try:
            from .spillover_cache import get_cached_early_warning
            cached = get_cached_early_warning(
                min_stage=min_stage, pathogen=pathogen, limit=limit
            )
            if cached and _has_real_signals(cached):
                return Response(cached)
        except (DatabaseError, ImportError, AttributeError) as e:
            # Cache table may not exist yet, or the import isn't wired up — fall through
            logger.debug("early-warning cache unavailable, falling through: %s", e)

        # 2. Fall back to live engine (slower — multiple DB queries)
        try:
            from .spillover_engine import get_early_warning
            results = get_early_warning(
                min_stage=min_stage, pathogen=pathogen, limit=limit
            )
            if results and _has_real_signals(results):
                return Response(results)
        except (DatabaseError, ImportError, AttributeError, ValueError) as e:
            logger.warning("early-warning live engine failed, falling through to mock: %s", e)

        # 3. Fall back to curated mock data (diverse, realistic scores)
        from .spillover_engine import _mock_filter
        return Response(_mock_filter(min_stage, pathogen, limit))


class SpilloverCacheStatusView(OHBaseView):
    """GET /api/v1/onehealth/spillover/cache-status — cache health."""

    def get(self, request):
        from .spillover_cache import get_cache_status
        return Response(get_cache_status())


class SpilloverTimelineView(OHBaseView):
    """GET /api/v1/onehealth/spillover/timeline/<iso3> — cross-species event timeline."""

    def get(self, request, iso3):
        from .spillover_engine import get_timeline
        return Response(get_timeline(iso3))


class ForecastHorizonView(OHBaseView):
    """POST /api/v1/onehealth/forecast/horizon — 3-model ensemble forecast."""

    def post(self, request):
        from .forecast_engine import compute_ensemble_forecast
        params = request.data or {}
        return Response(compute_ensemble_forecast(params))


class LiveKPIsView(OHBaseView):
    """GET /api/v1/onehealth/kpis/live — engine-computed KPIs with live risk index."""

    def get(self, request):
        from .forecast_engine import LIVE_RISK_STORE
        store = LIVE_RISK_STORE.summary()

        with connection.cursor() as cur:
            # Tier 3-4 alerts
            cur.execute("SELECT count(*) FROM oh_alerts WHERE alert_tier >= 3 AND status != 'closed'")
            tier_high = cur.fetchone()[0]

            # Active outbreaks
            cur.execute("SELECT count(DISTINCT disease_name || country_iso3) FROM oh_alerts WHERE status != 'closed'")
            active_outbreaks = cur.fetchone()[0]

            # Countries reporting last 14 days
            cur.execute("""
                SELECT count(DISTINCT country_iso3) FROM oh_disease_reports
                WHERE report_date >= CURRENT_DATE - INTERVAL '14 days'
            """)
            countries_reporting = cur.fetchone()[0]

            # SPAR avg
            cur.execute("""
                SELECT ROUND(AVG(COALESCE(ihr_overall_score, ihr_overall_average_score, 51))::numeric, 1)
                FROM oh_spillover_risk_factors
            """)
            spar_avg = float(cur.fetchone()[0] or 51)

        return Response({
            "tier_high_alerts": tier_high,
            "active_outbreaks": active_outbreaks,
            "countries_reporting": countries_reporting,
            "afro_spar_avg": spar_avg,
            "spillover_risk_idx": store["regional_index_0_10"],
            "imminent_events": store["imminent_events"],
            "warning_events": store["warning_events"],
            "score_last_computed": store["last_computed"],
            "score_is_stale": store["is_stale"],
        })

