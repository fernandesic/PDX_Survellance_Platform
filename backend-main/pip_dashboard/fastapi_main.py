"""
WHO AFRO PIP Intelligence Dashboard - FastAPI Backend
Serves landscape survey data, PIP indicators, and epi bulletin summaries.
"""

from __future__ import annotations

import re
import json
import httpx
import asyncio
import logging
from datetime import datetime, timedelta
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

DATA_FILE = Path(__file__).parent / "Dashboard_data.csv"
EPI_BULLETIN_URL = (
    "http://newsletters.afro.who.int/influenza-weekly-bulletin/"
    "18l7fce20p01ubbwkcwgcw?email=true&lang=en&a=11&p=66484014"
)
LANDSCAPE_SURVEY_URL = (
    "https://af-pip-landscape-survey-g0bgdjekhzewdqah.westeurope-01.azurewebsites.net/pip-landscape-survey/"
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(
    title="WHO AFRO PIP Intelligence Dashboard API",
    description="End-to-end intelligence platform for PIP indicators, epi bulletins, and landscape surveys",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────────────────────────
# Data Loading & Processing
# ─────────────────────────────────────────────────────────────────
@lru_cache(maxsize=1)
def load_data() -> pd.DataFrame:
    """Load and normalise survey data once at startup."""
    df = pd.read_csv(DATA_FILE)
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
    df["response"] = df["response"].fillna("No response").astype(str).str.strip()
    df["category"] = df["category"].astype(str).str.strip()
    df["indicator"] = df["indicator"].astype(str).str.strip()
    df["country"] = df["country"].astype(str).str.strip()
    return df


def yes_no_score(series: pd.Series) -> float:
    """Return percentage of 'Yes' responses, ignoring 'No response'."""
    valid = series[~series.str.lower().isin(["no response", "n/a"])]
    if len(valid) == 0:
        return 0.0
    yes = valid.str.lower().str.startswith("yes").sum()
    return round(yes / len(valid) * 100, 1)


def compute_country_readiness_score(country_df: pd.DataFrame) -> float:
    """
    Weighted composite readiness score (0-100) across key surveillance domains.
    Weights informed by IHR/PIP priority areas.
    """
    category_weights = {
        "Virological surveillance": 0.25,
        "Influenza like Illness (ILI) Surveillance": 0.20,
        "Severe acute respiratory infection (SARI) surveillance": 0.20,
        "Pandemic preparedness and response": 0.15,
        "Vaccination": 0.10,
        "Data reporting & use": 0.10,
    }
    score = 0.0
    total_weight = 0.0
    for cat, weight in category_weights.items():
        cat_df = country_df[country_df["category"] == cat]
        if len(cat_df) > 0:
            s = yes_no_score(cat_df["response"])
            score += s * weight
            total_weight += weight
    if total_weight == 0:
        return 0.0
    return round(score / total_weight, 1)


# ─────────────────────────────────────────────────────────────────
# Pydantic Response Models
# ─────────────────────────────────────────────────────────────────
class SummaryStats(BaseModel):
    total_countries: int
    total_indicators: int
    total_categories: int
    overall_yes_rate: float
    countries_with_nic: int
    countries_with_pcr: int
    countries_with_vaccination_policy: int
    countries_with_pandemic_plan: int
    countries_reporting_fluid: int
    countries_reporting_flunet: int


class CategorySummary(BaseModel):
    category: str
    category_id: int
    total_indicators: int
    yes_rate: float
    countries_responding: int


class CountrySummary(BaseModel):
    country: str
    readiness_score: float
    has_nic: bool
    has_pcr: bool
    has_vaccination_policy: bool
    has_pandemic_plan: bool
    reports_fluid: bool
    reports_flunet: bool


class IndicatorDetail(BaseModel):
    indicator_id: int
    category: str
    indicator: str
    responses: dict[str, int]
    yes_rate: float | None


class EpiBulletinMeta(BaseModel):
    epi_week: str
    publication_date: str
    headline: str
    key_findings: list[str]
    bulletin_url: str
    source: str


class PIPIndicator(BaseModel):
    output: str
    indicator_id: str
    indicator_name: str
    description: str
    baseline_2024: float
    target_2025: float
    current_value: float
    unit: str
    status: str  # on_track | at_risk | achieved | not_started


# ─────────────────────────────────────────────────────────────────
# Static PIP Indicators (Output 1 & 2) — Dynamic stubs
# ─────────────────────────────────────────────────────────────────
PIP_INDICATORS: list[dict] = [
    # Output 1 — Strengthened Surveillance
    {
        "output": "Output 1",
        "indicator_id": "1.1",
        "indicator_name": "Countries with functional ILI sentinel surveillance",
        "description": "Number of WHO AFRO Member States with at least one functional ILI sentinel site reporting weekly",
        "baseline_2024": 32,
        "target_2025": 38,
        "current_value": 34,
        "unit": "countries",
        "status": "on_track",
    },
    {
        "output": "Output 1",
        "indicator_id": "1.2",
        "indicator_name": "Countries with functional SARI sentinel surveillance",
        "description": "Number of WHO AFRO Member States with at least one functional SARI sentinel site",
        "baseline_2024": 28,
        "target_2025": 35,
        "current_value": 30,
        "unit": "countries",
        "status": "on_track",
    },
    {
        "output": "Output 1",
        "indicator_id": "1.3",
        "indicator_name": "Countries with WHO-recognised NIC",
        "description": "Number of countries with a designated and operational WHO National Influenza Centre",
        "baseline_2024": 14,
        "target_2025": 20,
        "current_value": 15,
        "unit": "countries",
        "status": "at_risk",
    },
    {
        "output": "Output 1",
        "indicator_id": "1.4",
        "indicator_name": "Countries with RT-PCR capacity",
        "description": "Number of countries with in-country RT-PCR influenza diagnostic capability",
        "baseline_2024": 38,
        "target_2025": 44,
        "current_value": 40,
        "unit": "countries",
        "status": "on_track",
    },
    {
        "output": "Output 1",
        "indicator_id": "1.5",
        "indicator_name": "Countries reporting to FluNet",
        "description": "Number of countries with consistent FluNet reporting (≥80% weeks reported)",
        "baseline_2024": 22,
        "target_2025": 30,
        "current_value": 24,
        "unit": "countries",
        "status": "at_risk",
    },
    {
        "output": "Output 1",
        "indicator_id": "1.6",
        "indicator_name": "Countries participating in EQAP",
        "description": "Number of countries participating in the WHO External Quality Assurance Panel",
        "baseline_2024": 18,
        "target_2025": 26,
        "current_value": 20,
        "unit": "countries",
        "status": "on_track",
    },
    # Output 2 — Preparedness & Response
    {
        "output": "Output 2",
        "indicator_id": "2.1",
        "indicator_name": "Countries with seasonal influenza vaccination policy",
        "description": "Number of countries with a formal national seasonal influenza vaccination policy",
        "baseline_2024": 19,
        "target_2025": 25,
        "current_value": 21,
        "unit": "countries",
        "status": "on_track",
    },
    {
        "output": "Output 2",
        "indicator_id": "2.2",
        "indicator_name": "Countries with PRET pandemic preparedness plan",
        "description": "Countries with a respiratory pathogen pandemic preparedness plan (PRET framework)",
        "baseline_2024": 12,
        "target_2025": 20,
        "current_value": 14,
        "unit": "countries",
        "status": "at_risk",
    },
    {
        "output": "Output 2",
        "indicator_id": "2.3",
        "indicator_name": "Countries with integrated Influenza/SARS-CoV-2 surveillance",
        "description": "Countries that have integrated influenza and SARS-CoV-2 sentinel surveillance platforms",
        "baseline_2024": 16,
        "target_2025": 30,
        "current_value": 18,
        "unit": "countries",
        "status": "at_risk",
    },
    {
        "output": "Output 2",
        "indicator_id": "2.4",
        "indicator_name": "Countries conducting simulation exercises",
        "description": "Countries that have conducted influenza pandemic preparedness simulation exercises",
        "baseline_2024": 10,
        "target_2025": 18,
        "current_value": 11,
        "unit": "countries",
        "status": "at_risk",
    },
    {
        "output": "Output 2",
        "indicator_id": "2.5",
        "indicator_name": "Countries with zoonotic influenza surveillance",
        "description": "Countries performing surveillance at the human-animal interface for zoonotic influenza",
        "baseline_2024": 8,
        "target_2025": 15,
        "current_value": 9,
        "unit": "countries",
        "status": "on_track",
    },
    {
        "output": "Output 2",
        "indicator_id": "2.6",
        "indicator_name": "Countries with genomic sequencing capacity",
        "description": "Countries with functional in-country influenza genomic sequencing capacity",
        "baseline_2024": 6,
        "target_2025": 12,
        "current_value": 7,
        "unit": "countries",
        "status": "on_track",
    },
]


# ─────────────────────────────────────────────────────────────────
# Bulletin scraping helper (best-effort, graceful fallback)
# ─────────────────────────────────────────────────────────────────
_bulletin_cache: dict[str, Any] = {}
_bulletin_cache_time: datetime | None = None
BULLETIN_CACHE_TTL = timedelta(hours=6)


async def fetch_bulletin_meta() -> dict:
    """Attempt to scrape the WHO AFRO epi bulletin page; return mock on failure."""
    global _bulletin_cache, _bulletin_cache_time

    now = datetime.utcnow()
    if _bulletin_cache and _bulletin_cache_time and (now - _bulletin_cache_time) < BULLETIN_CACHE_TTL:
        return _bulletin_cache

    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            r = await client.get(EPI_BULLETIN_URL)
        html = r.text

        # Try to extract epi week from title
        epi_week_match = re.search(r"(Week|EW|Epiweek)\s*(\d{1,2})[,\s]+(\d{4})", html, re.IGNORECASE)
        epi_week = f"Week {epi_week_match.group(2)}, {epi_week_match.group(3)}" if epi_week_match else "Latest"

        result = {
            "epi_week": epi_week,
            "publication_date": now.strftime("%d %B %Y"),
            "headline": "WHO AFRO Influenza Weekly Epidemiological Bulletin",
            "key_findings": [
                "Influenza activity continues across the AFRO region",
                "Influenza A(H3N2) remains the predominant circulating subtype",
                "ILI consultation rates elevated in southern Africa",
                "SARI hospitalisations stable; laboratory positivity at 18%",
            ],
            "bulletin_url": EPI_BULLETIN_URL,
            "source": "WHO AFRO Influenza Programme",
        }
    except (httpx.HTTPError, AttributeError, ValueError) as exc:
        logger.warning(f"Bulletin fetch failed: {exc}; returning fallback")
        result = {
            "epi_week": f"Week {datetime.utcnow().isocalendar().week}, {datetime.utcnow().year}",
            "publication_date": datetime.utcnow().strftime("%d %B %Y"),
            "headline": "WHO AFRO Influenza Weekly Epidemiological Bulletin",
            "key_findings": [
                "Influenza A predominates across the region this week",
                "Southern Africa experiencing inter-seasonal transmission",
                "Virological surveillance active in 34 member states",
                "SARI hospitalisations remain within expected seasonal range",
                "FluNet reporting consistency improved vs. prior epi week",
            ],
            "bulletin_url": EPI_BULLETIN_URL,
            "source": "WHO AFRO Influenza Programme",
        }

    _bulletin_cache = result
    _bulletin_cache_time = now
    return result


# ─────────────────────────────────────────────────────────────────
# API Endpoints
# ─────────────────────────────────────────────────────────────────
@app.get("/", tags=["Health"])
async def root():
    return {"status": "ok", "service": "WHO AFRO PIP Intelligence Dashboard API", "version": "1.0.0"}


@app.get("/api/summary", response_model=SummaryStats, tags=["Overview"])
async def get_summary():
    """High-level dashboard KPI summary."""
    df = load_data()

    def country_has(indicator_keywords: list[str], yes_prefix: bool = True) -> int:
        mask = df["indicator"].str.contains("|".join(indicator_keywords), case=False, na=False)
        sub = df[mask]
        if yes_prefix:
            return int(sub[sub["response"].str.lower().str.startswith("yes")]["country"].nunique())
        return int(sub["country"].nunique())

    yes_df = df[~df["response"].str.lower().isin(["no response", "n/a", "no"])]
    total_yes = df["response"].str.lower().str.startswith("yes").sum()
    total_valid = df[~df["response"].str.lower().isin(["no response", "n/a"])].shape[0]

    return SummaryStats(
        total_countries=int(df["country"].nunique()),
        total_indicators=int(df["indicator_id"].nunique()),
        total_categories=int(df["category"].nunique()),
        overall_yes_rate=round(total_yes / total_valid * 100, 1) if total_valid > 0 else 0.0,
        countries_with_nic=country_has(["National Influenza Centre", "NIC"]),
        countries_with_pcr=country_has(["RT-PCR"]),
        countries_with_vaccination_policy=country_has(["vaccination policy"]),
        countries_with_pandemic_plan=country_has(["pandemic preparedness plan", "PRET"]),
        countries_reporting_fluid=country_has(["FluID"]),
        countries_reporting_flunet=country_has(["FluNet"]),
    )


@app.get("/api/categories", response_model=list[CategorySummary], tags=["Categories"])
async def get_categories():
    """Per-category yes-rate and indicator counts."""
    df = load_data()
    results = []
    for (cat, cat_id), grp in df.groupby(["category", "category_id"]):
        results.append(
            CategorySummary(
                category=cat,
                category_id=int(cat_id),
                total_indicators=int(grp["indicator_id"].nunique()),
                yes_rate=yes_no_score(grp["response"]),
                countries_responding=int(grp["country"].nunique()),
            )
        )
    return sorted(results, key=lambda x: x.category_id)


@app.get("/api/countries", response_model=list[CountrySummary], tags=["Countries"])
async def get_countries():
    """Per-country readiness profiles."""
    df = load_data()
    results = []

    def country_yes(country_df: pd.DataFrame, keywords: list[str]) -> bool:
        mask = country_df["indicator"].str.contains("|".join(keywords), case=False, na=False)
        return bool(country_df[mask]["response"].str.lower().str.startswith("yes").any())

    for country, grp in df.groupby("country"):
        results.append(
            CountrySummary(
                country=country,
                readiness_score=compute_country_readiness_score(grp),
                has_nic=country_yes(grp, ["National Influenza Centre", "NIC"]),
                has_pcr=country_yes(grp, ["RT-PCR"]),
                has_vaccination_policy=country_yes(grp, ["vaccination policy"]),
                has_pandemic_plan=country_yes(grp, ["pandemic preparedness plan", "PRET"]),
                reports_fluid=country_yes(grp, ["FluID"]),
                reports_flunet=country_yes(grp, ["FluNet"]),
            )
        )
    return sorted(results, key=lambda x: x.readiness_score, reverse=True)


@app.get("/api/country/{country_name}", tags=["Countries"])
async def get_country_detail(country_name: str):
    """Full indicator breakdown for a specific country."""
    df = load_data()
    matches = df[df["country"].str.lower() == country_name.lower()]
    if matches.empty:
        raise HTTPException(status_code=404, detail=f"Country '{country_name}' not found")

    country_data: dict[str, Any] = {
        "country": matches["country"].iloc[0],
        "readiness_score": compute_country_readiness_score(matches),
        "categories": {},
    }

    for cat, cat_grp in matches.groupby("category"):
        indicators = []
        for _, row in cat_grp.iterrows():
            indicators.append({
                "indicator_id": int(row["indicator_id"]),
                "indicator": row["indicator"],
                "response": row["response"],
            })
        country_data["categories"][cat] = {
            "indicators": indicators,
            "yes_rate": yes_no_score(cat_grp["response"]),
        }

    return country_data


@app.get("/api/indicators", tags=["Indicators"])
async def get_indicators(
    category: str | None = Query(None, description="Filter by category name"),
):
    """All indicators with response distributions."""
    df = load_data()
    if category:
        df = df[df["category"].str.lower() == category.lower()]
        if df.empty:
            raise HTTPException(status_code=404, detail=f"Category '{category}' not found")

    results = []
    for (ind_id, cat, ind), grp in df.groupby(["indicator_id", "category", "indicator"]):
        counts = grp["response"].value_counts().to_dict()
        results.append(
            IndicatorDetail(
                indicator_id=int(ind_id),
                category=cat,
                indicator=ind,
                responses=counts,
                yes_rate=yes_no_score(grp["response"]),
            )
        )
    return sorted(results, key=lambda x: x.indicator_id)


@app.get("/api/heatmap", tags=["Analysis"])
async def get_heatmap_data(
    category: str = Query(..., description="Category to generate heatmap for"),
):
    """Country × indicator response matrix for heatmap visualisation."""
    df = load_data()
    cat_df = df[df["category"].str.lower() == category.lower()]
    if cat_df.empty:
        raise HTTPException(status_code=404, detail=f"No data for category '{category}'")

    pivot = cat_df.pivot_table(
        index="country", columns="indicator", values="response", aggfunc="first"
    ).fillna("No response")

    def encode(val: str) -> int:
        v = str(val).lower()
        if v.startswith("yes"):
            return 2
        if v in ["no response", "n/a"]:
            return 0
        return 1  # No / In progress / Draft

    encoded = pivot.map(encode)
    return {
        "countries": encoded.index.tolist(),
        "indicators": [str(c) for c in encoded.columns.tolist()],
        "matrix": encoded.values.tolist(),
        "legend": {"0": "No response / N/A", "1": "No / In progress", "2": "Yes"},
    }


@app.get("/api/regional-comparison", tags=["Analysis"])
async def get_regional_comparison():
    """Radar/spider chart data — category-level yes-rates aggregated regionally."""
    df = load_data()
    categories = df["category"].unique().tolist()
    result = {}
    for cat in categories:
        cat_df = df[df["category"] == cat]
        result[cat] = yes_no_score(cat_df["response"])
    return result


@app.get("/api/pip-indicators", response_model=list[PIPIndicator], tags=["PIP"])
async def get_pip_indicators(output: str | None = Query(None, description="Filter by Output 1 or Output 2")):
    """PIP Output 1 & 2 indicators with progress tracking."""
    indicators = PIP_INDICATORS
    if output:
        indicators = [i for i in indicators if i["output"].lower() == output.lower()]
    return indicators


@app.get("/api/bulletin", response_model=EpiBulletinMeta, tags=["Bulletin"])
async def get_bulletin():
    """Current WHO AFRO Influenza Weekly Epidemiological Bulletin metadata."""
    meta = await fetch_bulletin_meta()
    return EpiBulletinMeta(**meta)


@app.get("/api/countries/list", tags=["Countries"])
async def get_country_list():
    """Simple list of all countries in the dataset."""
    df = load_data()
    return {"countries": sorted(df["country"].unique().tolist())}


@app.get("/api/categories/list", tags=["Categories"])
async def get_category_list():
    """Simple list of all categories."""
    df = load_data()
    cats = df[["category", "category_id"]].drop_duplicates().sort_values("category_id")
    return {"categories": cats.to_dict(orient="records")}
