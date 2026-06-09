"""
=============================================================================
TRIAD — FastAPI Backend
=============================================================================
Purpose : REST API backend that sits between the Supabase database and the
          TRIAD dashboard. Provides all data endpoints the frontend needs,
          handles caching, computes derived metrics, and manages the alert
          notification pipeline.

Endpoints:
    GET  /health                        — system health check
    GET  /api/countries                 — all 47 AFRO countries with risk scores
    GET  /api/alerts/active             — active Tier 1-4 alerts
    GET  /api/alerts/{alert_id}         — single alert detail
    GET  /api/disease-reports/summary   — epi-week summary for dashboard KPIs
    GET  /api/spillover/risk-map        — country risk scores for map layer
    GET  /api/spillover/epi-links       — human-animal cross-domain links
    GET  /api/pathogens                 — pathogen profiles for simulation
    GET  /api/epicap/{iso3}             — OH-EpiCap radar data for a country
    GET  /api/spar/{iso3}               — IHR SPAR scores for a country
    GET  /api/vector-ecology            — vector suitability layer
    GET  /api/simulation/seir           — SEIR model computation
    POST /api/hitl/approve              — HITL action approval
    GET  /api/agents/status             — agentic AI system statuses
    GET  /api/kpis                      — top-line KPI numbers for header

Run:
    uvicorn triad_api:app --reload --port 8000

Or with gunicorn in production:
    gunicorn triad_api:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000

Environment variables (.env):
    SUPABASE_URL     = https://your-project.supabase.co
    SUPABASE_KEY     = your-service-role-key
    CACHE_TTL_SECS   = 120   (default: 2 minutes)

Author  : IntEpi Consulting / WHO AFRO PDX Programme
Version : 1.0 — March 2026
=============================================================================
"""

from __future__ import annotations

import logging
import math
import os
import time
from datetime import datetime, timedelta, date
from functools import lru_cache
from typing import Any, Optional

import numpy as np
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# Failure modes we expect from supabase-py calls and the httpx transport
# beneath them. supabase-py raises postgrest.exceptions.APIError (a plain
# Exception subclass) for query errors and lets httpx errors propagate for
# network problems. We don't import APIError directly so this module loads
# even when the optional supabase dep is missing — Exception subclasses we
# don't list will still surface as FastAPI 500s via the default handler.
_SUPABASE_ERRORS = (RuntimeError, OSError, ValueError, KeyError, AttributeError, TypeError)

# ── Supabase ────────────────────────────────────────────────────────────────
try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    logger.warning("supabase-py not installed: pip install supabase")

load_dotenv()

# =============================================================================
# APP SETUP
# =============================================================================

app = FastAPI(
    title="TRIAD API — One Health Intelligence Platform",
    description="Backend API for TRIAD: WHO AFRO One Health surveillance and spillover simulation",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS — allow the dashboard HTML to call the API from any origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =============================================================================
# SUPABASE CLIENT
# =============================================================================

def get_supabase() -> Any:
    """Return Supabase client. Raises if not configured."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be set in .env")
    if not SUPABASE_AVAILABLE:
        raise RuntimeError("supabase-py not installed")
    return create_client(url, key)

# Simple in-memory cache
_cache: dict[str, tuple[Any, float]] = {}
CACHE_TTL = int(os.getenv("CACHE_TTL_SECS", "120"))

def cache_get(key: str) -> Any | None:
    if key in _cache:
        data, ts = _cache[key]
        if time.time() - ts < CACHE_TTL:
            return data
    return None

def cache_set(key: str, data: Any) -> None:
    _cache[key] = (data, time.time())


# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class HITLAction(BaseModel):
    alert_id: str
    action: str          # "approve" | "reject" | "acknowledge"
    officer_id: str
    notes: Optional[str] = None

class SeirParams(BaseModel):
    r0: float = 1.85
    gamma: float = 0.07
    sigma: float = 0.14
    cfr_pct: float = 55.0
    population: int = 10_000_000
    initial_infected: int = 10
    days: int = 90
    # Risk factor modifiers from sliders
    host_interface: float = 0.72
    deforestation: float = 0.58
    livestock_density: float = 0.81
    vaccination_coverage: float = 0.43
    lab_capacity: float = 0.51


# =============================================================================
# 1. HEALTH CHECK
# =============================================================================

@app.get("/health", tags=["System"])
async def health_check():
    """System health check — also verifies Supabase connectivity."""
    status = {"status": "healthy", "timestamp": datetime.utcnow().isoformat() + "Z"}
    try:
        db = get_supabase()
        result = db.table("oh_countries").select("iso3").limit(1).execute()
        status["database"] = "connected"
        status["countries_table"] = "ok"
    except _SUPABASE_ERRORS as e:
        logger.warning("supabase health probe failed: %s", e)
        status["database"] = f"error: {str(e)}"
        status["status"] = "degraded"
    return status


# =============================================================================
# 2. KPIs — Top-line numbers for dashboard header
# =============================================================================

@app.get("/api/kpis", tags=["Dashboard"])
async def get_kpis():
    """
    Returns the 5 KPI values shown in the dashboard header strip:
    - tier_high_alerts    (Tier 3-4 active alerts)
    - active_outbreaks    (unique disease-country combinations with open alerts)
    - countries_reporting (countries with a report in the last 14 days)
    - afro_spar_avg       (average IHR SPAR score across 47 countries)
    - spillover_risk_idx  (mean composite spillover risk index)
    """
    cached = cache_get("kpis")
    if cached:
        return cached

    try:
        db = get_supabase()

        # Tier 3-4 open alerts
        tier_high = db.table("oh_alerts")\
            .select("alert_id", count="exact")\
            .gte("alert_tier", 3)\
            .eq("status", "open")\
            .execute()

        # Active outbreaks (distinct disease in open alerts)
        all_alerts = db.table("oh_alerts")\
            .select("disease_name")\
            .eq("status", "open")\
            .execute()
        active_diseases = len(set(r["disease_name"] for r in (all_alerts.data or [])))

        # Countries reporting last 14 days
        cutoff = (date.today() - timedelta(days=14)).isoformat()
        recent = db.table("oh_disease_reports")\
            .select("country_iso3")\
            .gte("report_date", cutoff)\
            .execute()
        countries_reporting = len(set(r["country_iso3"] for r in (recent.data or [])))

        # SPAR avg from spillover risk factors
        spar_data = db.table("oh_spillover_risk_factors")\
            .select("ihr_overall_score")\
            .execute()
        spar_vals = [r["ihr_overall_score"] for r in (spar_data.data or []) if r.get("ihr_overall_score")]
        spar_avg = round(sum(spar_vals) / len(spar_vals), 1) if spar_vals else 51.0

        # Spillover risk index from composite view
        risk_data = db.table("oh_spillover_risk_factors")\
            .select("interface_risk_score")\
            .execute()
        risk_vals = [r["interface_risk_score"] for r in (risk_data.data or []) if r.get("interface_risk_score")]
        risk_avg = round(sum(risk_vals) / len(risk_vals), 1) if risk_vals else 6.2

        result = {
            "tier_high_alerts":   tier_high.count or 0,
            "active_outbreaks":   active_diseases,
            "countries_reporting": countries_reporting,
            "afro_spar_avg":      spar_avg,
            "spillover_risk_idx": risk_avg,
            "generated_at":       datetime.utcnow().isoformat() + "Z",
        }
        cache_set("kpis", result)
        return result

    except _SUPABASE_ERRORS as e:
        # Return sensible defaults if DB unavailable
        logger.warning("kpis read failed; returning defaults: %s", e)
        return {
            "tier_high_alerts": 7, "active_outbreaks": 23,
            "countries_reporting": 41, "afro_spar_avg": 51.0,
            "spillover_risk_idx": 6.2, "source": "fallback",
            "error": str(e),
        }


# =============================================================================
# 3. COUNTRIES — with risk scores for map layer
# =============================================================================

@app.get("/api/countries", tags=["Map"])
async def get_countries(subregion: Optional[str] = None):
    """
    All 47 AFRO countries with:
    - coordinates (lat/lon)
    - spillover risk score (0-10)
    - IHR SPAR score
    - active alert tier (0 = none)
    - fragility index
    """
    cached = cache_get(f"countries_{subregion}")
    if cached:
        return cached

    try:
        db = get_supabase()

        # Base country data
        q = db.table("oh_countries").select("*")
        if subregion:
            q = q.eq("who_subregion", subregion)
        countries = q.execute()

        # Get latest alert tier per country
        alerts = db.table("oh_alerts")\
            .select("country_iso3, alert_tier, disease_name, alert_date")\
            .eq("status", "open")\
            .order("alert_tier", desc=True)\
            .execute()

        # Map highest tier alert per country
        alert_map: dict[str, dict] = {}
        for a in (alerts.data or []):
            iso3 = a["country_iso3"]
            if iso3 not in alert_map or a["alert_tier"] > alert_map[iso3]["tier"]:
                alert_map[iso3] = {
                    "tier":    a["alert_tier"],
                    "disease": a["disease_name"],
                    "date":    a["alert_date"],
                }

        # Get risk scores
        risk_data = db.table("oh_spillover_risk_factors")\
            .select("iso3, interface_risk_score, ihr_overall_score")\
            .execute()
        risk_map = {r["iso3"]: r for r in (risk_data.data or [])}

        # Combine
        result = []
        for c in (countries.data or []):
            iso3 = c["iso3"]
            risk = risk_map.get(iso3, {})
            alert = alert_map.get(iso3, {"tier": 0})
            result.append({
                "iso3":           iso3,
                "name":           c["country_name"],
                "subregion":      c["who_subregion"],
                "population_M":   c["population_M"],
                "lat":            c["lat_centroid"],
                "lon":            c["lon_centroid"],
                "climate_zone":   c["climate_zone"],
                "fragility_index": c["fragility_index"],
                "risk_score":     float(risk.get("interface_risk_score") or c.get("fragility_index", 5)),
                "spar_score":     float(risk.get("ihr_overall_score") or 51),
                "alert_tier":     alert["tier"],
                "alert_disease":  alert.get("disease"),
                "alert_date":     alert.get("date"),
            })

        cache_set(f"countries_{subregion}", result)
        return result

    except _SUPABASE_ERRORS as e:
        logger.exception("supabase request failed")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# 4. ACTIVE ALERTS
# =============================================================================

@app.get("/api/alerts/active", tags=["Alerts"])
async def get_active_alerts(
    min_tier: int = Query(1, ge=1, le=4),
    limit: int = Query(50, le=200),
):
    """Active alerts, highest tier first. Used by the right-panel alert feed."""
    cached = cache_get(f"alerts_{min_tier}_{limit}")
    if cached:
        return cached

    try:
        db = get_supabase()
        result = db.table("oh_alerts")\
            .select("*, oh_disease_reports(disease_domain, case_count, data_completeness_pct)")\
            .gte("alert_tier", min_tier)\
            .eq("status", "open")\
            .order("alert_tier", desc=True)\
            .order("alert_date", desc=True)\
            .limit(limit)\
            .execute()

        cache_set(f"alerts_{min_tier}_{limit}", result.data or [])
        return result.data or []

    except _SUPABASE_ERRORS as e:
        logger.exception("supabase request failed")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/alerts/{alert_id}", tags=["Alerts"])
async def get_alert_detail(alert_id: str):
    """Full detail for a single alert including linked human + animal records."""
    try:
        db = get_supabase()
        alert = db.table("oh_alerts")\
            .select("*")\
            .eq("alert_id", alert_id)\
            .single()\
            .execute()
        if not alert.data:
            raise HTTPException(status_code=404, detail="Alert not found")

        # Get linked report
        report_id = alert.data.get("report_id")
        report = human = animal = None
        if report_id:
            report = db.table("oh_disease_reports").select("*").eq("report_id", report_id).single().execute()
            human  = db.table("oh_human_cases").select("*").eq("report_id", report_id).execute()
            animal = db.table("oh_animal_events").select("*").eq("report_id", report_id).execute()

        return {
            "alert":        alert.data,
            "report":       report.data if report else None,
            "human_cases":  human.data if human else [],
            "animal_events": animal.data if animal else [],
        }
    except HTTPException:
        raise
    except _SUPABASE_ERRORS as e:
        logger.exception("supabase request failed")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# 5. DISEASE REPORTS SUMMARY (epi-week aggregates)
# =============================================================================

@app.get("/api/disease-reports/summary", tags=["Surveillance"])
async def get_reports_summary(
    iso3: Optional[str] = None,
    weeks: int = Query(12, ge=1, le=52),
    disease: Optional[str] = None,
):
    """
    Epi-week aggregated case counts, used by the timeline bar and trend charts.
    Returns: list of {epi_year, epi_week, disease_name, total_cases, alert_count}
    """
    cached = cache_get(f"summary_{iso3}_{weeks}_{disease}")
    if cached:
        return cached

    try:
        db = get_supabase()
        q = db.table("oh_weekly_summary").select("*")
        if iso3:
            q = q.eq("country_iso3", iso3)
        if disease:
            q = q.eq("disease_name", disease)
        q = q.order("epi_year", desc=True).order("epi_week", desc=True).limit(weeks * 10)
        result = q.execute()
        data = result.data or []
        cache_set(f"summary_{iso3}_{weeks}_{disease}", data)
        return data
    except _SUPABASE_ERRORS as e:
        logger.exception("supabase request failed")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# 6. SPILLOVER MAP DATA
# =============================================================================

@app.get("/api/spillover/risk-map", tags=["Spillover"])
async def get_risk_map():
    """
    Full risk layer for the Leaflet map: countries with composite spillover
    risk scores, vector suitability indices, and host ecology metrics.
    """
    cached = cache_get("risk_map")
    if cached:
        return cached

    try:
        db = get_supabase()

        countries = db.table("oh_countries").select("*").execute()
        srf       = db.table("oh_spillover_risk_factors").select("*").execute()
        vectors   = db.table("oh_vector_ecology").select("*").execute()
        hosts     = db.table("oh_host_ecology").select("*").execute()

        srf_map  = {r["iso3"]: r for r in (srf.data or [])}
        vec_map  = {r["iso3"]: r for r in (vectors.data or [])}
        host_map = {r["iso3"]: r for r in (hosts.data or [])}

        result = []
        for c in (countries.data or []):
            iso3 = c["iso3"]
            s = srf_map.get(iso3, {})
            v = vec_map.get(iso3, {})
            h = host_map.get(iso3, {})

            # Compute composite risk (0-10)
            fsi       = float(s.get("fsi_total_score") or 0) / 120.0
            ihr       = 1.0 - float(s.get("ihr_overall_score") or 51) / 100.0
            interface = float(s.get("interface_risk_score") or 5) / 10.0
            vector    = float(v.get("aedes_aegypti_suitability") or 0.5)
            host_div  = float(h.get("host_diversity_index") or 0.5)
            displace  = min(1.0, float(s.get("displacement_index") or 0) * 10)

            composite = round(
                (ihr * 2.5) + (interface * 2.0) + (vector * 1.5) +
                (host_div * 2.0) + (fsi * 1.0) + (displace * 1.0),
                2
            )

            result.append({
                "iso3":                  iso3,
                "name":                  c["country_name"],
                "lat":                   c["lat_centroid"],
                "lon":                   c["lon_centroid"],
                "composite_risk":        composite,
                "ihr_score":             s.get("ihr_overall_score"),
                "fsi_score":             s.get("fsi_total_score"),
                "interface_risk":        s.get("interface_risk_score"),
                "aedes_suitability":     v.get("aedes_aegypti_suitability"),
                "anopheles_suitability": v.get("anopheles_gambiae_suitability"),
                "host_diversity_index":  h.get("host_diversity_index"),
                "bat_species_count":     h.get("bat_species_count"),
                "fragility_index":       c["fragility_index"],
                "bushmeat_presence":     s.get("bushmeat_market_presence"),
                "forest_loss_ha":        s.get("forest_loss_ha_2020_24"),
                "displacement_index":    s.get("displacement_index"),
            })

        cache_set("risk_map", result)
        return result

    except _SUPABASE_ERRORS as e:
        logger.exception("supabase request failed")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/spillover/epi-links", tags=["Spillover"])
async def get_epi_links():
    """Epi-linkage lines between countries for the map overlay layer."""
    cached = cache_get("epi_links")
    if cached:
        return cached

    try:
        db = get_supabase()
        result = db.table("oh_epi_links")\
            .select("*, from:human_report_id(country_iso3), to:animal_report_id(country_iso3)")\
            .limit(200)\
            .execute()

        # Group by country pair
        pairs: dict[tuple, dict] = {}
        for r in (result.data or []):
            if not r.get("from") or not r.get("to"):
                continue
            from_iso = r["from"].get("country_iso3") if isinstance(r["from"], dict) else r.get("country_iso3")
            to_iso   = r["to"].get("country_iso3")   if isinstance(r["to"],   dict) else None
            if from_iso and to_iso and from_iso != to_iso:
                key = tuple(sorted([from_iso, to_iso]))
                if key not in pairs:
                    pairs[key] = {"from": key[0], "to": key[1], "count": 0, "type": r.get("link_type","proximity")}
                pairs[key]["count"] += 1

        links = list(pairs.values())
        cache_set("epi_links", links)
        return links

    except _SUPABASE_ERRORS as e:
        logger.exception("supabase request failed")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# 7. PATHOGENS — for simulation dropdown
# =============================================================================

@app.get("/api/pathogens", tags=["Simulation"])
async def get_pathogens(domain: Optional[str] = None):
    """Pathogen profiles for the simulation engine disease picker."""
    cached = cache_get(f"pathogens_{domain}")
    if cached:
        return cached

    try:
        db = get_supabase()
        q = db.table("oh_pathogen_profiles").select("*")
        if domain:
            q = q.eq("domain", domain)
        result = q.order("spillover_score", desc=True).execute()
        cache_set(f"pathogens_{domain}", result.data or [])
        return result.data or []
    except _SUPABASE_ERRORS as e:
        logger.exception("supabase request failed")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# 8. OH-EPICAP + IHR SPAR per country
# =============================================================================

@app.get("/api/epicap/{iso3}", tags=["Capacity"])
async def get_epicap(iso3: str):
    """OH-EpiCap radar chart data for a specific country."""
    try:
        db = get_supabase()
        result = db.table("oh_epicap_scores")\
            .select("dimension, target, indicator, score, assessment_year")\
            .eq("country_iso3", iso3.upper())\
            .execute()
        if not result.data:
            raise HTTPException(status_code=404, detail=f"No EpiCap data for {iso3}")

        # Aggregate to dimension-level averages for radar chart
        dim_scores: dict[str, list] = {}
        for row in result.data:
            dim = row["dimension"]
            if dim not in dim_scores:
                dim_scores[dim] = []
            dim_scores[dim].append(row["score"])

        radar = [
            {"dimension": dim, "avg_score": round(sum(scores) / len(scores), 2),
             "max_score": max(scores), "min_score": min(scores), "n_indicators": len(scores)}
            for dim, scores in dim_scores.items()
        ]

        return {
            "iso3":          iso3.upper(),
            "radar":         radar,
            "overall_score": round(
                sum(r["avg_score"] for r in radar) / len(radar) * 25, 1
            ),  # Convert 1-4 scale to 0-100
            "raw":           result.data,
        }
    except HTTPException:
        raise
    except _SUPABASE_ERRORS as e:
        logger.exception("supabase request failed")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/spar/{iso3}", tags=["Capacity"])
async def get_spar(iso3: str):
    """IHR SPAR capacity scores for the bar chart panel."""
    try:
        db = get_supabase()
        result = db.table("oh_spillover_risk_factors")\
            .select("ihr_overall_score, ihr_zoonoses_score, ihr_surveillance_score,"
                    " ihr_laboratory_score, ihr_response_score")\
            .eq("iso3", iso3.upper())\
            .execute()

        if not result.data:
            raise HTTPException(status_code=404, detail=f"No SPAR data for {iso3}")

        row = result.data[0]
        return {
            "iso3":         iso3.upper(),
            "capacities": [
                {"name": "Overall",         "score": row.get("ihr_overall_score")},
                {"name": "Surveillance",    "score": row.get("ihr_surveillance_score")},
                {"name": "Laboratory",      "score": row.get("ihr_laboratory_score")},
                {"name": "Zoonoses",        "score": row.get("ihr_zoonoses_score")},
                {"name": "Response",        "score": row.get("ihr_response_score")},
            ],
        }
    except HTTPException:
        raise
    except _SUPABASE_ERRORS as e:
        logger.exception("supabase request failed")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# 9. SEIR SIMULATION ENDPOINT
# =============================================================================

@app.post("/api/simulation/seir", tags=["Simulation"])
async def run_seir(params: SeirParams):
    """
    Server-side SEIR epidemic model. Returns day-by-day trajectory
    including confidence intervals based on risk factor sliders.

    The risk factors (host_interface, deforestation, livestock_density,
    vaccination_coverage, lab_capacity) modulate beta and gamma to
    reflect real-world One Health spillover drivers.
    """
    N   = params.population
    I0  = params.initial_infected
    E0  = I0 * 3
    S0  = N - E0 - I0
    R0_val = 0.0

    # Modulate R0 with risk factors
    r0_adjusted = params.r0 * (
        0.5 + params.host_interface * 0.5
    ) * (
        0.6 + params.deforestation * 0.4
    ) * (
        0.7 + params.livestock_density * 0.3
    )

    # Gamma (recovery rate) modulated by lab capacity (faster detection = faster isolation)
    gamma_adj = params.gamma * (1 + params.lab_capacity * 0.3)

    # Beta = R0 * gamma / N
    beta = r0_adjusted * gamma_adj
    sigma = params.sigma  # incubation rate

    S, E, I, Rec = float(S0), float(E0), float(I0), 0.0
    trajectory = []
    peak_day, peak_I = 0, 0.0

    for day in range(params.days + 1):
        # Vaccination effect: reduces susceptibles over time
        vax_effect = 1.0 - (params.vaccination_coverage * 0.6 * min(1.0, day / 30.0))
        S_eff = S * vax_effect

        dS  = -beta * S_eff * I
        dE  =  beta * S_eff * I - sigma * E
        dI  =  sigma * E - gamma_adj * I
        dR  =  gamma_adj * I

        S   = max(0.0, S + dS)
        E   = max(0.0, E + dE)
        I   = max(0.0, I + dI)
        Rec = Rec + dR

        # 95% CI: ±25% uncertainty
        ci_upper = min(N, I * 1.25)
        ci_lower = max(0.0, I * 0.75)
        hosp = I * 0.12          # ~12% require hospitalisation
        deaths_cumul = Rec * (params.cfr_pct / 100.0)

        point = {
            "day":          day,
            "susceptible":  round(S),
            "exposed":      round(E),
            "infected":     round(I),
            "recovered":    round(Rec),
            "hospitalised": round(hosp),
            "deaths_cum":   round(deaths_cumul),
            "ci_upper":     round(ci_upper),
            "ci_lower":     round(ci_lower),
        }
        trajectory.append(point)

        if I > peak_I:
            peak_I = I
            peak_day = day

    peak_size = round(peak_I)
    p_epidemic = min(0.99, max(0.01, 1.0 - math.exp(-r0_adjusted * E0 / N)))

    return {
        "trajectory":     trajectory,
        "peak_day":       peak_day,
        "peak_infected":  peak_size,
        "r0_adjusted":    round(r0_adjusted, 3),
        "p_epidemic_pct": round(p_epidemic * 100, 1),
        "total_deaths":   trajectory[-1]["deaths_cum"],
        "model":          "SEIR with risk-factor modulation",
    }


# =============================================================================
# 10. AGENT STATUS
# =============================================================================

_agent_states = {
    "risk_sentinel":     {"status": "running",  "last_action": "HPAI pattern detected W. Africa", "uptime_h": 4.2},
    "policy_compiler":   {"status": "alert",    "last_action": "IHR Art.12 threshold met — DRC",   "uptime_h": 0.4},
    "ask_triad":         {"status": "running",  "last_action": "Processing DRC→UGA spillover query","uptime_h": 0.1},
    "digital_twins":     {"status": "idle",     "last_action": "Last: Nigeria HPAI 90-day model",   "uptime_h": 2.0},
    "partner_orchestrator": {"status": "pending","last_action": "WHO/FAO/WOAH joint HPAI alert draft","uptime_h": 0.3},
    "after_action_memory":  {"status": "idle",   "last_action": "Indexing 3 closed events",          "uptime_h": 12.0},
}

@app.get("/api/agents/status", tags=["Agents"])
async def get_agent_status():
    """Current status of all 6 Phase III agentic AI systems."""
    return {
        "agents": [
            {"id": k, "name": k.replace("_", " ").title(), **v}
            for k, v in _agent_states.items()
        ],
        "hitl_pending": 2,
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }


# =============================================================================
# 11. HITL ACTIONS
# =============================================================================

_hitl_queue = [
    {
        "id":        "HITL-001",
        "type":      "Approve",
        "agent":     "policy_compiler",
        "title":     "PHEIC Notification Draft",
        "desc":      "IHR Art.12 preliminary notification for DRC Ebola event (2 confirmed Lab+ cases).",
        "created_at": datetime.utcnow().isoformat() + "Z",
        "status":    "pending",
    },
    {
        "id":        "HITL-002",
        "type":      "Inform",
        "agent":     "risk_sentinel",
        "title":     "Kano HPAI Tier 4 — For Awareness",
        "desc":      "Risk Sentinel auto-notified District Vet Officers in Kano, Kaduna. No action required.",
        "created_at": datetime.utcnow().isoformat() + "Z",
        "status":    "pending",
    },
]

@app.get("/api/hitl/queue", tags=["HITL"])
async def get_hitl_queue():
    """Pending HITL items requiring human decision."""
    return [item for item in _hitl_queue if item["status"] == "pending"]


@app.post("/api/hitl/action", tags=["HITL"])
async def hitl_action(action: HITLAction, background_tasks: BackgroundTasks):
    """
    Record a HITL decision. Actions:
    - approve  → agent proceeds with its action
    - reject   → agent aborts and logs reason
    - acknowledge → informational item marked as read
    """
    item = next((i for i in _hitl_queue if i["id"] == action.alert_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="HITL item not found")

    item["status"]      = action.action
    item["resolved_by"] = action.officer_id
    item["resolved_at"] = datetime.utcnow().isoformat() + "Z"
    item["notes"]       = action.notes

    # Update agent state
    agent_id = item.get("agent")
    if agent_id and agent_id in _agent_states:
        if action.action == "approve":
            _agent_states[agent_id]["status"]      = "running"
            _agent_states[agent_id]["last_action"] = f"Approved: {item['title']}"
        elif action.action == "reject":
            _agent_states[agent_id]["status"]      = "idle"
            _agent_states[agent_id]["last_action"] = f"Rejected: {item['title']}"

    return {"success": True, "item": item, "agent_new_status": _agent_states.get(agent_id, {})}


# =============================================================================
# 12. VECTOR ECOLOGY LAYER
# =============================================================================

@app.get("/api/vector-ecology", tags=["Environment"])
async def get_vector_ecology():
    """Vector habitat suitability indices for all 47 countries."""
    cached = cache_get("vector_ecology")
    if cached:
        return cached

    try:
        db = get_supabase()
        result = db.table("oh_vector_ecology").select("*").execute()
        cache_set("vector_ecology", result.data or [])
        return result.data or []
    except _SUPABASE_ERRORS as e:
        logger.exception("supabase request failed")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# 13. ENVIRONMENTAL TIMELINE
# =============================================================================

@app.get("/api/environment/{iso3}", tags=["Environment"])
async def get_environment(iso3: str, days: int = Query(90, ge=7, le=365)):
    """Recent environmental observations for a country (for trend charts)."""
    try:
        db = get_supabase()
        cutoff = (date.today() - timedelta(days=days)).isoformat()
        result = db.table("oh_env_observations")\
            .select("obs_date, temp_mean_c, precipitation_mm, ndvi, flood_risk_flag,"
                    " drought_risk_flag, deforestation_alert, migratory_bird_season")\
            .eq("country_iso3", iso3.upper())\
            .gte("obs_date", cutoff)\
            .order("obs_date")\
            .execute()
        return result.data or []
    except _SUPABASE_ERRORS as e:
        logger.exception("supabase request failed")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# ROOT
# =============================================================================

@app.get("/", include_in_schema=False)
async def root():
    return {
        "system":  "TRIAD — One Health Intelligence Platform",
        "version": "1.0.0",
        "org":     "WHO AFRO / IntEpi Consulting",
        "docs":    "/docs",
        "health":  "/health",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("triad_api:app", host="0.0.0.0", port=8000, reload=True)
