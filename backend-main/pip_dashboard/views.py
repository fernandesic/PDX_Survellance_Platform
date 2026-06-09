import json
import logging
from datetime import datetime
from functools import lru_cache
from pathlib import Path

import pandas as pd
from django.http import JsonResponse
from django.views.decorators.http import require_GET

# Import non-FastAPI specific helpers and config from the copy we made
# To do it cleanly, I'll redefine the core logic here so it's fully native Django
DATA_FILE = Path(__file__).parent / "Dashboard_data.csv"
logger = logging.getLogger(__name__)

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
    """Weighted composite readiness score (0-100) across key surveillance domains."""
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


@require_GET
def get_summary(request):
    df = load_data()
    def country_has(indicator_keywords: list[str], yes_prefix: bool = True) -> int:
        mask = df["indicator"].str.contains("|".join(indicator_keywords), case=False, na=False)
        sub = df[mask]
        if yes_prefix:
            return int(sub[sub["response"].str.lower().str.startswith("yes")]["country"].nunique())
        return int(sub["country"].nunique())

    total_yes = df["response"].str.lower().str.startswith("yes").sum()
    total_valid = df[~df["response"].str.lower().isin(["no response", "n/a"])].shape[0]

    data = {
        "total_countries": int(df["country"].nunique()),
        "total_indicators": int(df["indicator_id"].nunique()),
        "total_categories": int(df["category"].nunique()),
        "overall_yes_rate": round(total_yes / total_valid * 100, 1) if total_valid > 0 else 0.0,
        "countries_with_nic": country_has(["National Influenza Centre", "NIC"]),
        "countries_with_pcr": country_has(["RT-PCR"]),
        "countries_with_vaccination_policy": country_has(["vaccination policy"]),
        "countries_with_pandemic_plan": country_has(["pandemic preparedness plan", "PRET"]),
        "countries_reporting_fluid": country_has(["FluID"]),
        "countries_reporting_flunet": country_has(["FluNet"]),
    }
    return JsonResponse(data)


@require_GET
def get_categories(request):
    df = load_data()
    results = []
    for (cat, cat_id), grp in df.groupby(["category", "category_id"]):
        results.append({
            "category": cat,
            "category_id": int(cat_id),
            "total_indicators": int(grp["indicator_id"].nunique()),
            "yes_rate": yes_no_score(grp["response"]),
            "countries_responding": int(grp["country"].nunique()),
        })
    return JsonResponse(sorted(results, key=lambda x: x["category_id"]), safe=False)


@require_GET
def get_countries(request):
    df = load_data()
    results = []
    def country_yes(country_df: pd.DataFrame, keywords: list[str]) -> bool:
        mask = country_df["indicator"].str.contains("|".join(keywords), case=False, na=False)
        return bool(country_df[mask]["response"].str.lower().str.startswith("yes").any())

    for country, grp in df.groupby("country"):
        results.append({
            "country": country,
            "readiness_score": compute_country_readiness_score(grp),
            "has_nic": country_yes(grp, ["National Influenza Centre", "NIC"]),
            "has_pcr": country_yes(grp, ["RT-PCR"]),
            "has_vaccination_policy": country_yes(grp, ["vaccination policy"]),
            "has_pandemic_plan": country_yes(grp, ["pandemic preparedness plan", "PRET"]),
            "reports_fluid": country_yes(grp, ["FluID"]),
            "reports_flunet": country_yes(grp, ["FluNet"]),
        })
    return JsonResponse(sorted(results, key=lambda x: x["readiness_score"], reverse=True), safe=False)


@require_GET
def get_country_detail(request, country_name):
    df = load_data()
    matches = df[df["country"].str.lower() == country_name.lower()]
    if matches.empty:
        return JsonResponse({"detail": f"Country '{country_name}' not found"}, status=404)

    country_data = {
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
    return JsonResponse(country_data)


@require_GET
def get_indicators(request):
    df = load_data()
    category = request.GET.get("category")
    if category:
        df = df[df["category"].str.lower() == category.lower()]
        if df.empty:
            return JsonResponse({"detail": f"Category '{category}' not found"}, status=404)

    results = []
    for (ind_id, cat, ind), grp in df.groupby(["indicator_id", "category", "indicator"]):
        counts = grp["response"].value_counts().to_dict()
        results.append({
            "indicator_id": int(ind_id),
            "category": cat,
            "indicator": ind,
            "responses": counts,
            "yes_rate": yes_no_score(grp["response"]),
        })
    return JsonResponse(sorted(results, key=lambda x: x["indicator_id"]), safe=False)


@require_GET
def get_heatmap_data(request):
    df = load_data()
    category = request.GET.get("category")
    if not category:
        return JsonResponse({"detail": "Category parameter is required"}, status=400)
        
    cat_df = df[df["category"].str.lower() == category.lower()]
    if cat_df.empty:
        return JsonResponse({"detail": f"No data for category '{category}'"}, status=404)

    pivot = cat_df.pivot_table(
        index="country", columns="indicator", values="response", aggfunc="first"
    ).fillna("No response")

    def encode(val: str) -> int:
        v = str(val).lower()
        if v.startswith("yes"):
            return 2
        if v in ["no response", "n/a"]:
            return 0
        return 1

    encoded = pivot.map(encode)
    return JsonResponse({
        "countries": encoded.index.tolist(),
        "indicators": [str(c) for c in encoded.columns.tolist()],
        "matrix": encoded.values.tolist(),
        "legend": {"0": "No response / N/A", "1": "No / In progress", "2": "Yes"},
    })


@require_GET
def get_regional_comparison(request):
    df = load_data()
    categories = df["category"].unique().tolist()
    result = {}
    for cat in categories:
        cat_df = df[df["category"] == cat]
        result[cat] = yes_no_score(cat_df["response"])
    return JsonResponse(result)

PIP_INDICATORS = [
    {
        "output": "Output 1", "indicator_id": "1.1", "indicator_name": "Countries with functional ILI sentinel surveillance",
        "description": "Number of WHO AFRO Member States with at least one functional ILI sentinel site reporting weekly",
        "baseline_2024": 32, "target_2025": 38, "current_value": 34, "unit": "countries", "status": "on_track",
    },
    {
        "output": "Output 1", "indicator_id": "1.2", "indicator_name": "Countries with functional SARI sentinel surveillance",
        "description": "Number of WHO AFRO Member States with at least one functional SARI sentinel site",
        "baseline_2024": 28, "target_2025": 35, "current_value": 30, "unit": "countries", "status": "on_track",
    },
    {
        "output": "Output 1", "indicator_id": "1.3", "indicator_name": "Countries with WHO-recognised NIC",
        "description": "Number of countries with a designated and operational WHO National Influenza Centre",
        "baseline_2024": 14, "target_2025": 20, "current_value": 15, "unit": "countries", "status": "at_risk",
    },
    {
        "output": "Output 1", "indicator_id": "1.4", "indicator_name": "Countries with RT-PCR capacity",
        "description": "Number of countries with in-country RT-PCR influenza diagnostic capability",
        "baseline_2024": 38, "target_2025": 44, "current_value": 40, "unit": "countries", "status": "on_track",
    },
    {
        "output": "Output 1", "indicator_id": "1.5", "indicator_name": "Countries reporting to FluNet",
        "description": "Number of countries with consistent FluNet reporting (≥80% weeks reported)",
        "baseline_2024": 22, "target_2025": 30, "current_value": 24, "unit": "countries", "status": "at_risk",
    },
    {
        "output": "Output 1", "indicator_id": "1.6", "indicator_name": "Countries participating in EQAP",
        "description": "Number of countries participating in the WHO External Quality Assurance Panel",
        "baseline_2024": 18, "target_2025": 26, "current_value": 20, "unit": "countries", "status": "on_track",
    },
    {
        "output": "Output 2", "indicator_id": "2.1", "indicator_name": "Countries with seasonal influenza vaccination policy",
        "description": "Number of countries with a formal national seasonal influenza vaccination policy",
        "baseline_2024": 19, "target_2025": 25, "current_value": 21, "unit": "countries", "status": "on_track",
    },
    {
        "output": "Output 2", "indicator_id": "2.2", "indicator_name": "Countries with PRET pandemic preparedness plan",
        "description": "Countries with a respiratory pathogen pandemic preparedness plan (PRET framework)",
        "baseline_2024": 12, "target_2025": 20, "current_value": 14, "unit": "countries", "status": "at_risk",
    },
    {
        "output": "Output 2", "indicator_id": "2.3", "indicator_name": "Countries with integrated Influenza/SARS-CoV-2 surveillance",
        "description": "Countries that have integrated influenza and SARS-CoV-2 sentinel surveillance platforms",
        "baseline_2024": 16, "target_2025": 30, "current_value": 18, "unit": "countries", "status": "at_risk",
    },
    {
        "output": "Output 2", "indicator_id": "2.4", "indicator_name": "Countries conducting simulation exercises",
        "description": "Countries that have conducted influenza pandemic preparedness simulation exercises",
        "baseline_2024": 10, "target_2025": 18, "current_value": 11, "unit": "countries", "status": "at_risk",
    },
    {
        "output": "Output 2", "indicator_id": "2.5", "indicator_name": "Countries with zoonotic influenza surveillance",
        "description": "Countries performing surveillance at the human-animal interface for zoonotic influenza",
        "baseline_2024": 8, "target_2025": 15, "current_value": 9, "unit": "countries", "status": "on_track",
    },
    {
        "output": "Output 2", "indicator_id": "2.6", "indicator_name": "Countries with genomic sequencing capacity",
        "description": "Countries with functional in-country influenza genomic sequencing capacity",
        "baseline_2024": 6, "target_2025": 12, "current_value": 7, "unit": "countries", "status": "on_track",
    },
]

@require_GET
def get_pip_indicators(request):
    output = request.GET.get("output")
    indicators = PIP_INDICATORS
    if output:
        indicators = [i for i in indicators if i["output"].lower() == output.lower()]
    return JsonResponse(indicators, safe=False)


@require_GET
def get_bulletin(request):
    # Simulated response or scraped logic
    now = datetime.utcnow()
    result = {
        "epi_week": f"Week {now.isocalendar().week}, {now.year}",
        "publication_date": now.strftime("%d %B %Y"),
        "headline": "WHO AFRO Influenza Weekly Epidemiological Bulletin",
        "key_findings": [
            "Influenza A predominates across the region this week",
            "Southern Africa experiencing inter-seasonal transmission",
            "Virological surveillance active in 34 member states",
            "SARI hospitalisations remain within expected seasonal range",
            "FluNet reporting consistency improved vs. prior epi week",
        ],
        "bulletin_url": "http://newsletters.afro.who.int/influenza-weekly-bulletin/18l7fce20p01ubbwkcwgcw",
        "source": "WHO AFRO Influenza Programme",
    }
    return JsonResponse(result)
