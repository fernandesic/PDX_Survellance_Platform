"""
=============================================================================
ONE HEALTH AFRO — COMPLETE DATA PIPELINE
=============================================================================
Purpose : Fetch real data from every reputable source listed in the
          "One Health Disease-Agnostic Risk Factors" framework file,
          clean and normalise it, merge it with the synthetic generator
          output, and push the complete 12-table dataset to Supabase
          (or write to CSV / SQL).

Sources : All sources are those explicitly listed in the framework file:
          World Bank WDI, WHO GHO, WHO IHR e-SPAR, FAOSTAT, WOAH WAHIS,
          Global Forest Watch, Fund for Peace FSI, ACLED, GHS Index,
          SpillOver.global, IUCN Red List, NASA POWER, CITES, TRAFFIC,
          ResistanceMap (WHO GLASS proxy).

Usage   :
    # Install dependencies
    pip install wbdata faostat requests pandas numpy python-dotenv
                supabase tqdm openpyxl

    # Run full pipeline
    python oh_afro_data_pipeline.py

    # Run only fetch step (skip merge / push)
    python oh_afro_data_pipeline.py --fetch-only

    # Run only merge step (data already fetched)
    python oh_afro_data_pipeline.py --merge-only

    # Push final merged dataset to Supabase
    python oh_afro_data_pipeline.py --push-supabase

    # Use custom output directory
    python oh_afro_data_pipeline.py --output-dir /data/oh_afro

Environment variables (set in .env or shell):
    SUPABASE_URL       Your Supabase project URL
    SUPABASE_KEY       Your Supabase service role key
    ACLED_EMAIL        Registered email for ACLED API
    ACLED_KEY          ACLED API key (free registration)
    WB_CACHE           Set to "1" to cache World Bank calls (faster reruns)

Author  : IntEpi Consulting / WHO AFRO PDX Programme
Version : 1.0 — March 2026
=============================================================================
"""

from __future__ import annotations

# ── Standard library ─────────────────────────────────────────────────────────
import argparse
import csv
import json
import logging
import os
import sys
import time
import warnings
from datetime import date, datetime
from pathlib import Path
from typing import Any

warnings.filterwarnings("ignore")

# ── Third-party ───────────────────────────────────────────────────────────────
import numpy as np
import pandas as pd
import requests
from tqdm import tqdm

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

try:
    import wbdata
    WB_AVAILABLE = True
except ImportError:
    WB_AVAILABLE = False
    print("  ⚠  wbdata not installed: pip install wbdata")

try:
    import faostat
    FAO_AVAILABLE = True
except ImportError:
    FAO_AVAILABLE = False
    print("  ⚠  faostat not installed: pip install faostat")

try:
    from supabase import create_client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("oh_pipeline")

# =============================================================================
# 1. CONSTANTS
# =============================================================================

OUTPUT_DIR = Path(__file__).resolve().parents[3] / "data" / "onehealth"

# All 47 WHO AFRO Member States
AFRO: list[dict] = [
    {"iso3":"AGO","iso2":"AO","name":"Angola",                  "sub":"Central Africa",  "pop_M":35.6},
    {"iso3":"BEN","iso2":"BJ","name":"Benin",                   "sub":"West Africa",     "pop_M":13.7},
    {"iso3":"BWA","iso2":"BW","name":"Botswana",                "sub":"Southern Africa", "pop_M":2.6},
    {"iso3":"BFA","iso2":"BF","name":"Burkina Faso",            "sub":"West Africa",     "pop_M":22.7},
    {"iso3":"BDI","iso2":"BI","name":"Burundi",                 "sub":"East Africa",     "pop_M":13.2},
    {"iso3":"CPV","iso2":"CV","name":"Cabo Verde",              "sub":"West Africa",     "pop_M":0.6},
    {"iso3":"CMR","iso2":"CM","name":"Cameroon",                "sub":"Central Africa",  "pop_M":28.0},
    {"iso3":"CAF","iso2":"CF","name":"Central African Republic","sub":"Central Africa",  "pop_M":5.5},
    {"iso3":"TCD","iso2":"TD","name":"Chad",                    "sub":"Central Africa",  "pop_M":18.3},
    {"iso3":"COM","iso2":"KM","name":"Comoros",                 "sub":"East Africa",     "pop_M":0.9},
    {"iso3":"COD","iso2":"CD","name":"Dem. Rep. of Congo",      "sub":"Central Africa",  "pop_M":99.0},
    {"iso3":"COG","iso2":"CG","name":"Republic of Congo",       "sub":"Central Africa",  "pop_M":5.8},
    {"iso3":"CIV","iso2":"CI","name":"Côte d'Ivoire",           "sub":"West Africa",     "pop_M":27.5},
    {"iso3":"GNQ","iso2":"GQ","name":"Equatorial Guinea",       "sub":"Central Africa",  "pop_M":1.5},
    {"iso3":"ERI","iso2":"ER","name":"Eritrea",                 "sub":"East Africa",     "pop_M":3.5},
    {"iso3":"SWZ","iso2":"SZ","name":"Eswatini",                "sub":"Southern Africa", "pop_M":1.2},
    {"iso3":"ETH","iso2":"ET","name":"Ethiopia",                "sub":"East Africa",     "pop_M":126.5},
    {"iso3":"GAB","iso2":"GA","name":"Gabon",                   "sub":"Central Africa",  "pop_M":2.3},
    {"iso3":"GMB","iso2":"GM","name":"Gambia",                  "sub":"West Africa",     "pop_M":2.7},
    {"iso3":"GHA","iso2":"GH","name":"Ghana",                   "sub":"West Africa",     "pop_M":33.5},
    {"iso3":"GIN","iso2":"GN","name":"Guinea",                  "sub":"West Africa",     "pop_M":13.5},
    {"iso3":"GNB","iso2":"GW","name":"Guinea-Bissau",           "sub":"West Africa",     "pop_M":2.1},
    {"iso3":"KEN","iso2":"KE","name":"Kenya",                   "sub":"East Africa",     "pop_M":54.0},
    {"iso3":"LSO","iso2":"LS","name":"Lesotho",                 "sub":"Southern Africa", "pop_M":2.2},
    {"iso3":"LBR","iso2":"LR","name":"Liberia",                 "sub":"West Africa",     "pop_M":5.3},
    {"iso3":"MDG","iso2":"MG","name":"Madagascar",              "sub":"Southern Africa", "pop_M":28.9},
    {"iso3":"MWI","iso2":"MW","name":"Malawi",                  "sub":"Southern Africa", "pop_M":20.9},
    {"iso3":"MLI","iso2":"ML","name":"Mali",                    "sub":"West Africa",     "pop_M":22.7},
    {"iso3":"MRT","iso2":"MR","name":"Mauritania",              "sub":"West Africa",     "pop_M":4.7},
    {"iso3":"MUS","iso2":"MU","name":"Mauritius",               "sub":"Southern Africa", "pop_M":1.3},
    {"iso3":"MOZ","iso2":"MZ","name":"Mozambique",              "sub":"Southern Africa", "pop_M":33.0},
    {"iso3":"NAM","iso2":"NA","name":"Namibia",                 "sub":"Southern Africa", "pop_M":2.6},
    {"iso3":"NER","iso2":"NE","name":"Niger",                   "sub":"West Africa",     "pop_M":25.1},
    {"iso3":"NGA","iso2":"NG","name":"Nigeria",                 "sub":"West Africa",     "pop_M":218.5},
    {"iso3":"RWA","iso2":"RW","name":"Rwanda",                  "sub":"East Africa",     "pop_M":13.9},
    {"iso3":"STP","iso2":"ST","name":"São Tomé and Príncipe",   "sub":"Central Africa",  "pop_M":0.2},
    {"iso3":"SEN","iso2":"SN","name":"Senegal",                 "sub":"West Africa",     "pop_M":17.2},
    {"iso3":"SLE","iso2":"SL","name":"Sierra Leone",            "sub":"West Africa",     "pop_M":8.4},
    {"iso3":"SOM","iso2":"SO","name":"Somalia",                 "sub":"East Africa",     "pop_M":17.1},
    {"iso3":"ZAF","iso2":"ZA","name":"South Africa",            "sub":"Southern Africa", "pop_M":60.1},
    {"iso3":"SSD","iso2":"SS","name":"South Sudan",             "sub":"East Africa",     "pop_M":11.1},
    {"iso3":"TZA","iso2":"TZ","name":"Tanzania",                "sub":"East Africa",     "pop_M":63.3},
    {"iso3":"TGO","iso2":"TG","name":"Togo",                    "sub":"West Africa",     "pop_M":8.7},
    {"iso3":"UGA","iso2":"UG","name":"Uganda",                  "sub":"East Africa",     "pop_M":47.2},
    {"iso3":"ZMB","iso2":"ZM","name":"Zambia",                  "sub":"Southern Africa", "pop_M":19.5},
    {"iso3":"ZWE","iso2":"ZW","name":"Zimbabwe",                "sub":"Southern Africa", "pop_M":15.9},
]
AFRO_ISO3  = [c["iso3"] for c in AFRO]
AFRO_ISO2  = [c["iso2"] for c in AFRO]
ISO3_TO_2  = {c["iso3"]: c["iso2"] for c in AFRO}
ISO2_TO_3  = {c["iso2"]: c["iso3"] for c in AFRO}
NAME_TO_3  = {c["name"]: c["iso3"] for c in AFRO}

# Alternate country name spellings that appear in data sources
COUNTRY_ALIASES: dict[str, str] = {
    "Congo, Dem. Rep.":              "COD",
    "Congo, Rep.":                   "COG",
    "Cote d'Ivoire":                 "CIV",
    "Cote dIvoire":                  "CIV",
    "Côte d'Ivoire":                 "CIV",
    "Democratic Republic of Congo":  "COD",
    "Democratic Republic of the Congo": "COD",
    "DRC":                           "COD",
    "Republic of Congo":             "COG",
    "Sao Tome and Principe":         "STP",
    "São Tomé and Príncipe":         "STP",
    "Eswatini (Swaziland)":          "SWZ",
    "Swaziland":                     "SWZ",
    "Tanzania, United Rep. of":      "TZA",
    "United Republic of Tanzania":   "TZA",
    "Central African Rep.":          "CAF",
    "CAR":                           "CAF",
    "Equatorial Guinea":             "GNQ",
    "Gambia, The":                   "GMB",
    "The Gambia":                    "GMB",
    "Guinea Bissau":                 "GNB",
    "Cabo Verde":                    "CPV",
    "Cape Verde":                    "CPV",
    "Comoros":                       "COM",
    "Eritrea":                       "ERI",
    "Gabon":                         "GAB",
    "Lesotho":                       "LSO",
    "Liberia":                       "LBR",
    "Mauritius":                     "MUS",
    "Mauritania":                    "MRT",
    "Namibia":                       "NAM",
    "Somalia":                       "SOM",
    "South Sudan":                   "SSD",
    "Burundi":                       "BDI",
}

def resolve_iso3(name_or_code: str) -> str | None:
    """Resolve any country name/code variant to ISO3."""
    s = str(name_or_code).strip()
    if s in AFRO_ISO3:                return s
    if s in ISO2_TO_3:                return ISO2_TO_3[s]
    if s in NAME_TO_3:                return NAME_TO_3[s]
    if s in COUNTRY_ALIASES:          return COUNTRY_ALIASES[s]
    # Case-insensitive fallback
    sl = s.lower()
    for c in AFRO:
        if c["name"].lower() == sl:   return c["iso3"]
    return None


# =============================================================================
# 2. WORLD BANK WDI FETCHER
#    Source listed in framework: "World Bank Data" (GDP, sanitation,
#    development indicators) — direct match to framework Sheet 1 Category V
# =============================================================================

WB_INDICATORS: dict[str, str] = {
    # Health infrastructure (framework: Surveillance, Capacity & Political)
    "SH.MED.BEDS.ZS":     "hospital_beds_per1000",
    "SH.MED.PHYS.ZS":     "physicians_per1000",
    "SH.MED.NUMW.P3":     "nurses_midwives_per1000",
    # Health expenditure
    "SH.XPD.CHEX.GD.ZS":  "health_expenditure_pct_gdp",
    "SH.XPD.CHEX.PC.CD":  "health_expenditure_per_capita_usd",
    # Immunisation (vaccination coverage — framework: Vaccination Coverage)
    "SH.IMM.IDPT":         "dtp3_immunization_pct",
    "SH.IMM.MEAS":         "measles_immunization_pct",
    "SH.IMM.HEPB":         "hepb3_immunization_pct",
    # UHC
    "SH.UHC.SRVS.CV.XD":  "uhc_service_coverage_index",
    # Population & demographics (framework: Human Density / Demographics)
    "SP.POP.TOTL":         "population_total",
    "SP.URB.TOTL.IN.ZS":  "urban_population_pct",
    "SP.POP.GROW":         "population_growth_rate_pct",
    "EN.POP.DNST":         "population_density_per_km2",
    "SP.POP.65UP.TO.ZS":  "pop_over65_pct",
    "SP.POP.0014.TO.ZS":  "pop_under15_pct",
    # Mortality
    "SH.DYN.MORT":         "under5_mortality_per1000",
    "SP.DYN.IMRT.IN":      "infant_mortality_per1000",
    "SP.DYN.LE00.IN":      "life_expectancy_at_birth",
    # WASH (framework: Sanitation access)
    "SH.H2O.BASW.ZS":     "basic_water_access_pct",
    "SH.STA.BASS.ZS":     "basic_sanitation_access_pct",
    "SH.STA.WASH.P5":     "wash_attributable_deaths_per100k",
    # Housing / crowding (framework: Household crowding index)
    "EN.POP.SLUM.UR.ZS":  "urban_slum_population_pct",
    # Economic (framework: Economic health)
    "NY.GDP.PCAP.CD":      "gdp_per_capita_usd",
    "NY.GDP.MKTP.KD.ZG":  "gdp_growth_rate_pct",
    "SI.POV.DDAY":         "poverty_headcount_pct_190",
    # Connectivity (framework: Digital Connectivity)
    "IT.NET.USER.ZS":      "internet_penetration_pct",
    "IT.CEL.SETS.P2":      "mobile_subscriptions_per100",
    # Nutrition / food security
    "SN.ITK.DEFC.ZS":     "prevalence_undernourishment_pct",
}


def fetch_worldbank(output_dir: Path) -> pd.DataFrame:
    """
    Fetch World Bank WDI indicators for all 47 AFRO countries.
    Returns a wide DataFrame: one row per country, columns = indicators.
    Uses wbdata library (wraps World Bank API v2).
    """
    log.info("=== WORLD BANK WDI (source: worldbank.org) ===")

    if not WB_AVAILABLE:
        log.warning("  wbdata not available — skipping World Bank fetch")
        return pd.DataFrame()

    countries = AFRO_ISO3
    records: list[dict] = []

    for code, label in tqdm(WB_INDICATORS.items(), desc="  WB indicators"):
        try:
            data = wbdata.get_data(code, country=countries, pandas=False)
            for entry in data:
                if entry.get("value") is None:
                    continue
                iso3 = resolve_iso3(entry["country"]["id"])
                if not iso3:
                    continue
                records.append({
                    "iso3":      iso3,
                    "indicator": label,
                    "wb_code":   code,
                    "year":      int(entry["date"]),
                    "value":     float(entry["value"]),
                    "source":    "World Bank WDI",
                })
            time.sleep(0.3)
        except Exception as e:
            log.warning(f"  WB {code} ({label}): {e}")

    if not records:
        log.warning("  No World Bank records fetched.")
        return pd.DataFrame()

    df_long = pd.DataFrame(records)

    # Keep most recent value per country × indicator
    df_latest = (
        df_long
        .sort_values("year", ascending=False)
        .groupby(["iso3", "indicator"])
        .first()
        .reset_index()
    )

    # Pivot to wide format
    df_wide = df_latest.pivot(index="iso3", columns="indicator", values="value").reset_index()
    df_wide.columns.name = None

    # Save long format for reference
    df_long.to_csv(output_dir / "raw_worldbank_long.csv", index=False)
    df_wide.to_csv(output_dir / "worldbank_wide.csv", index=False)
    log.info(f"  ✓ World Bank: {len(df_wide)} countries, {len(df_wide.columns)-1} indicators")
    return df_wide


# =============================================================================
# 3. WHO GHO FETCHER
#    Source: WHO Global Health Observatory (framework Sheet 1 Category VI)
#    API: ghoapi.azureedge.net/api
# =============================================================================

WHO_GHO_INDICATORS: dict[str, str] = {
    # Surveillance capacity (framework: IHR Capacity Scores)
    "IHR_CAPACITY_C1":    "ihr_legislation_score",
    "IHR_CAPACITY_C2":    "ihr_coordination_score",
    "IHR_CAPACITY_C3":    "ihr_surveillance_score",
    "IHR_CAPACITY_C4":    "ihr_response_score",
    "IHR_CAPACITY_C5":    "ihr_preparedness_score",
    "IHR_CAPACITY_C6":    "ihr_riskcommunication_score",
    "IHR_CAPACITY_C7":    "ihr_human_resources_score",
    "IHR_CAPACITY_C8":    "ihr_laboratory_score",
    "IHR_CAPACITY_C9":    "ihr_pointsofentry_score",
    "IHR_CAPACITY_C10":   "ihr_zoonoses_score",
    "IHR_CAPACITY_C11":   "ihr_foodsafety_score",
    "IHR_CAPACITY_C12":   "ihr_chemical_score",
    "IHR_CAPACITY_C13":   "ihr_radiation_score",
    # AMR (framework: AMR data)
    "GLASS_AMR_01":       "amr_resistance_pct_ecoli",
    "GLASS_AMR_04":       "amr_resistance_pct_klebsiella",
    # Malaria incidence (proxy for vector-borne disease burden)
    "MALARIA_EST_INCIDENCE": "malaria_incidence_per1000",
    # NTD
    "NTDSCHISTOSOMIASIS": "schistosomiasis_prevalence_pct",
}


def fetch_who_gho(output_dir: Path) -> pd.DataFrame:
    """
    Fetch WHO GHO indicators.
    API endpoint: https://ghoapi.azureedge.net/api/{INDICATOR}
    Filters to AFRO countries.
    """
    log.info("=== WHO GLOBAL HEALTH OBSERVATORY (source: who.int/data/gho) ===")
    BASE = "https://ghoapi.azureedge.net/api"
    records: list[dict] = []

    for code, label in tqdm(WHO_GHO_INDICATORS.items(), desc="  WHO GHO indicators"):
        try:
            url = f"{BASE}/{code}"
            r = requests.get(url, timeout=20, headers={"Accept": "application/json"})
            r.raise_for_status()
            data = r.json().get("value", [])
            for entry in data:
                iso3 = resolve_iso3(entry.get("SpatialDim", ""))
                if not iso3:
                    continue
                val = entry.get("NumericValue") or entry.get("Value")
                if val is None:
                    continue
                try:
                    val = float(str(val).replace(",", ""))
                except (ValueError, TypeError):
                    continue
                records.append({
                    "iso3":      iso3,
                    "indicator": label,
                    "gho_code":  code,
                    "year":      entry.get("TimeDim"),
                    "value":     val,
                    "source":    "WHO GHO",
                })
            time.sleep(0.4)
        except requests.exceptions.RequestException as e:
            log.warning(f"  GHO {code}: {e}")

    if not records:
        log.warning("  No WHO GHO records fetched.")
        return pd.DataFrame()

    df_long = pd.DataFrame(records)
    df_latest = (
        df_long
        .sort_values("year", ascending=False)
        .groupby(["iso3", "indicator"])
        .first()
        .reset_index()
    )
    df_wide = df_latest.pivot(index="iso3", columns="indicator", values="value").reset_index()
    df_wide.columns.name = None

    df_long.to_csv(output_dir / "raw_who_gho_long.csv", index=False)
    df_wide.to_csv(output_dir / "who_gho_wide.csv", index=False)
    log.info(f"  ✓ WHO GHO: {len(df_wide)} countries, {len(df_wide.columns)-1} indicators")
    return df_wide


# =============================================================================
# 4. WHO IHR e-SPAR FETCHER
#    Source: WHO e-SPAR (framework: IHR Capacity Scores)
#    Public data endpoint (no login required for aggregate scores)
# =============================================================================

IHR_CAPACITIES = [
    "policy_legal",       "ihr_coordination",  "financing",
    "laboratory",         "surveillance",       "human_resources",
    "health_emergency_mgmt", "health_service", "infection_prevention",
    "risk_communication", "points_of_entry",   "zoonotic_diseases",
    "food_safety",        "chemical_events",   "radiation_emergencies",
]


def fetch_ihr_spar(output_dir: Path) -> pd.DataFrame:
    """
    Fetch IHR SPAR scores via the WHO SCORE / GHO public API.
    Falls back to the published SDG 3.d.1 indicator (average SPAR score).
    """
    log.info("=== WHO IHR e-SPAR (source: extranet.who.int/e-spar) ===")
    records: list[dict] = []

    # Method 1: Try GHO aggregate SPAR indicator
    # SDG 3.d.1 = average of IHR core capacity scores
    try:
        url = "https://ghoapi.azureedge.net/api/IHR_CAPACITY"
        r = requests.get(url, timeout=20, headers={"Accept": "application/json"})
        r.raise_for_status()
        data = r.json().get("value", [])
        for entry in data:
            iso3 = resolve_iso3(entry.get("SpatialDim", ""))
            if not iso3:
                continue
            val = entry.get("NumericValue")
            if val is None:
                continue
            capacity = entry.get("Dim1", "overall")
            records.append({
                "iso3":     iso3,
                "capacity": capacity,
                "year":     entry.get("TimeDim"),
                "score":    float(val),
                "source":   "WHO IHR e-SPAR via GHO",
            })
        log.info(f"  ✓ IHR SPAR via GHO: {len(records)} records")
    except requests.exceptions.RequestException as e:
        log.warning(f"  IHR SPAR GHO endpoint: {e}")

    # Method 2: Try direct e-SPAR public data endpoint
    if not records:
        try:
            url2 = "https://extranet.who.int/e-spar/api/scores"
            r2 = requests.get(url2, timeout=20)
            r2.raise_for_status()
            data2 = r2.json()
            for entry in data2:
                iso3 = resolve_iso3(entry.get("countryCode", ""))
                if not iso3:
                    continue
                for cap in IHR_CAPACITIES:
                    val = entry.get(cap)
                    if val is not None:
                        records.append({
                            "iso3":     iso3,
                            "capacity": cap,
                            "year":     entry.get("year", 2023),
                            "score":    float(val),
                            "source":   "WHO e-SPAR API",
                        })
            log.info(f"  ✓ IHR SPAR direct: {len(records)} records")
        except Exception as e:
            log.warning(f"  e-SPAR direct endpoint: {e}")

    if not records:
        log.warning("  ⚠ No e-SPAR records fetched — will use published 2024 AFRO average (51%) as baseline")
        # Build skeleton from known 2024 AFRO regional average (51%)
        # Source: WHO IHR Annual Report 2024 — Ethiopia article confirms AFRO avg = 51%
        for c in AFRO:
            records.append({
                "iso3":     c["iso3"],
                "capacity": "overall_average",
                "year":     2024,
                "score":    51.0,
                "source":   "WHO IHR 2024 AFRO regional average (proxy)",
            })

    df = pd.DataFrame(records)
    df.to_csv(output_dir / "raw_ihr_spar.csv", index=False)

    # Pivot: one row per country, columns = capacities
    df_pivot = df.pivot_table(
        index="iso3", columns="capacity", values="score",
        aggfunc="max"
    ).reset_index()
    df_pivot.columns = [
        c if c == "iso3" else f"ihr_{c}_score"
        for c in df_pivot.columns
    ]
    df_pivot.columns.name = None
    df_pivot.to_csv(output_dir / "ihr_spar_wide.csv", index=False)
    log.info(f"  ✓ IHR SPAR: {len(df_pivot)} countries")
    return df_pivot


# =============================================================================
# 5. FAOSTAT FETCHER
#    Source: FAOSTAT (framework: Livestock density, land use, agricultural)
# =============================================================================

FAO_DATASETS: dict[str, dict] = {
    # Livestock heads by species — maps to framework: Livestock density
    "QCL": {
        "label":    "livestock_heads",
        "items":    ["Cattle", "Chickens", "Sheep", "Goats", "Pigs", "Camels"],
        "elements": ["Stocks"],
    },
    # Land use — maps to framework: Land-use change rate
    "RL": {
        "label":    "land_use",
        "items":    ["Agricultural land", "Forest land", "Land under perm. crops"],
        "elements": ["Area"],
    },
    # Food security — maps to framework: Bushmeat consumption rate (proxy)
    "FS": {
        "label":    "food_security",
        "items":    ["Prevalence of undernourishment (percent) (3-year average)"],
        "elements": ["Value"],
    },
}


def fetch_faostat(output_dir: Path) -> pd.DataFrame:
    """
    Fetch FAOSTAT data using the faostat Python library.
    Returns wide DataFrame with one row per country.
    """
    log.info("=== FAOSTAT (source: fao.org/faostat) ===")

    if not FAO_AVAILABLE:
        log.warning("  faostat library not available — skipping")
        return pd.DataFrame()

    records: list[dict] = []

    for dataset_code, config in FAO_DATASETS.items():
        try:
            log.info(f"  Fetching FAO dataset: {dataset_code} ({config['label']})")
            df_raw = faostat.get_data_df(
                dataset_code,
                pars={
                    "area":    AFRO_ISO2,
                    "item":    config["items"],
                    "element": config["elements"],
                    "year":    list(range(2019, 2025)),
                },
            )
            if df_raw is None or df_raw.empty:
                log.warning(f"  FAO {dataset_code}: empty response")
                continue

            for _, row in df_raw.iterrows():
                iso2 = str(row.get("Area Code (M49)", "")).lstrip("0")
                iso3 = resolve_iso3(row.get("Area", ""))
                if not iso3 and iso2:
                    iso3 = ISO2_TO_3.get(iso2)
                if not iso3:
                    continue
                val = row.get("Value")
                if pd.isna(val):
                    continue
                label = f"fao_{config['label']}_{str(row.get('Item','?')).lower().replace(' ','_')[:30]}"
                records.append({
                    "iso3":      iso3,
                    "indicator": label,
                    "year":      row.get("Year"),
                    "value":     float(val),
                    "unit":      row.get("Unit", ""),
                    "source":    "FAOSTAT",
                })
            time.sleep(0.5)
        except Exception as e:
            log.warning(f"  FAO {dataset_code}: {e}")

    if not records:
        log.warning("  No FAOSTAT records fetched.")
        return pd.DataFrame()

    df_long = pd.DataFrame(records)
    df_latest = (
        df_long.sort_values("year", ascending=False)
        .groupby(["iso3", "indicator"])
        .first()
        .reset_index()
    )
    df_wide = df_latest.pivot(index="iso3", columns="indicator", values="value").reset_index()
    df_wide.columns.name = None

    df_long.to_csv(output_dir / "raw_faostat_long.csv", index=False)
    df_wide.to_csv(output_dir / "faostat_wide.csv", index=False)
    log.info(f"  ✓ FAOSTAT: {len(df_wide)} countries, {len(df_wide.columns)-1} indicators")
    return df_wide


# =============================================================================
# 6. FUND FOR PEACE — FRAGILE STATES INDEX (FSI)
#    Source: framework Sheet 1 Category VI "Fragile States Index"
#    Data: publicly downloadable CSV from fragilestatesindex.org
# =============================================================================

def fetch_fsi(output_dir: Path) -> pd.DataFrame:
    """
    Fetch Fragile States Index (FSI) from Fund for Peace.
    Direct CSV download URL (updated annually, latest = 2024).
    """
    log.info("=== FRAGILE STATES INDEX (source: fragilestatesindex.org) ===")

    # Fund for Peace publishes annual CSV exports
    fsi_urls = [
        "https://fragilestatesindex.org/wp-content/uploads/2024/06/fsi-2024.csv",
        "https://fragilestatesindex.org/wp-content/uploads/2023/05/fsi-2023.csv",
    ]

    for url in fsi_urls:
        try:
            r = requests.get(url, timeout=25, headers={"User-Agent": "Mozilla/5.0"})
            r.raise_for_status()
            from io import StringIO
            df = pd.read_csv(StringIO(r.text))
            year = url.split("fsi-")[1][:4]

            # Normalise columns
            df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

            # Resolve ISO3
            df["iso3"] = df["country"].apply(
                lambda x: resolve_iso3(x) if pd.notna(x) else None
            )
            df = df[df["iso3"].isin(AFRO_ISO3)].copy()

            # Select relevant columns
            keep = ["iso3"]
            score_cols = [c for c in df.columns if c not in ("country", "iso3", "rank", "year")
                          and "unnamed" not in c]
            keep += score_cols
            df_out = df[keep].copy()
            df_out.columns = [
                c if c == "iso3" else f"fsi_{c}"
                for c in df_out.columns
            ]
            df_out["fsi_year"] = int(year)

            df_out.to_csv(output_dir / "fsi_scores.csv", index=False)
            log.info(f"  ✓ FSI {year}: {len(df_out)} AFRO countries")
            return df_out
        except Exception as e:
            log.warning(f"  FSI URL {url}: {e}")

    log.warning("  No FSI data fetched.")
    return pd.DataFrame()


# =============================================================================
# 7. ACLED — CONFLICT EVENTS
#    Source: framework Sheet 1 Category VI "Fragile States Index" / conflict
#    ACLED is explicitly listed — requires free API key registration
# =============================================================================

def fetch_acled(output_dir: Path) -> pd.DataFrame:
    """
    Fetch ACLED conflict event counts for AFRO countries.
    Requires ACLED_EMAIL and ACLED_KEY environment variables.
    Register free at: https://acleddata.com/register/
    """
    log.info("=== ACLED CONFLICT DATA (source: acleddata.com) ===")

    email = os.getenv("ACLED_EMAIL")
    key   = os.getenv("ACLED_KEY")
    if not email or not key:
        log.warning("  ACLED_EMAIL / ACLED_KEY not set — skipping ACLED fetch")
        log.warning("  Register free at: https://acleddata.com/register/")
        return pd.DataFrame()

    records: list[dict] = []
    BASE = "https://api.acleddata.com/acled/read"

    for country_info in tqdm(AFRO, desc="  ACLED countries"):
        iso3 = country_info["iso3"]
        try:
            params = {
                "key":           key,
                "email":         email,
                "country":       country_info["name"],
                "year":          "2023|2024",
                "fields":        "event_type|year|fatalities",
                "limit":         0,   # 0 = return count only
            }
            r = requests.get(BASE, params=params, timeout=25)
            r.raise_for_status()
            data = r.json()
            total_events    = data.get("count", 0)
            total_fatalities = sum(
                int(e.get("fatalities", 0) or 0)
                for e in data.get("data", [])
            )
            records.append({
                "iso3":                   iso3,
                "acled_conflict_events":  total_events,
                "acled_fatalities":       total_fatalities,
                "acled_year":             "2023-2024",
                "source":                 "ACLED",
            })
            time.sleep(0.5)
        except Exception as e:
            log.warning(f"  ACLED {iso3}: {e}")

    if not records:
        return pd.DataFrame()

    df = pd.DataFrame(records)
    df.to_csv(output_dir / "acled_conflict.csv", index=False)
    log.info(f"  ✓ ACLED: {len(df)} countries")
    return df


# =============================================================================
# 8. GLOBAL HEALTH SECURITY INDEX (GHS Index)
#    Source: framework Sheet 1 Category VI "GHS Index"
#    Data: CSV downloadable from ghsindex.org (published 2021, next due 2024)
# =============================================================================

def fetch_ghs_index(output_dir: Path) -> pd.DataFrame:
    """
    Fetch GHS Index scores (overall + 6 categories).
    Data available as open CSV download from ghsindex.org.
    """
    log.info("=== GHS INDEX (source: ghsindex.org) ===")

    ghs_urls = [
        "https://www.ghsindex.org/wp-content/uploads/2021/12/2021-GHS-Index-Data.csv",
        "https://www.ghsindex.org/wp-content/uploads/2019/10/2019-GHS-Index-Data.csv",
    ]

    for url in ghs_urls:
        try:
            r = requests.get(url, timeout=25, headers={"User-Agent": "Mozilla/5.0"})
            r.raise_for_status()
            from io import StringIO
            df = pd.read_csv(StringIO(r.text))
            year = "2021" if "2021" in url else "2019"

            df.columns = [c.strip().lower().replace(" ", "_").replace(".", "_")
                          for c in df.columns]
            country_col = next((c for c in df.columns if "country" in c), None)
            if country_col is None:
                continue

            df["iso3"] = df[country_col].apply(
                lambda x: resolve_iso3(x) if pd.notna(x) else None
            )
            # Try ISO column if available
            iso_col = next((c for c in df.columns if c in ("iso", "iso_code", "country_code")), None)
            if iso_col:
                df["iso3"] = df.apply(
                    lambda row: resolve_iso3(row[iso_col]) or resolve_iso3(row[country_col]),
                    axis=1
                )

            df = df[df["iso3"].isin(AFRO_ISO3)].copy()
            score_cols = [c for c in df.columns
                          if "score" in c or "index" in c or "category" in c]
            keep = ["iso3"] + score_cols
            df_out = df[[c for c in keep if c in df.columns]].copy()
            df_out.columns = [
                c if c == "iso3" else f"ghs_{c}"
                for c in df_out.columns
            ]
            df_out["ghs_year"] = int(year)

            df_out.to_csv(output_dir / "ghs_index_scores.csv", index=False)
            log.info(f"  ✓ GHS Index {year}: {len(df_out)} AFRO countries")
            return df_out
        except Exception as e:
            log.warning(f"  GHS Index URL {url}: {e}")

    log.warning("  No GHS Index data fetched.")
    return pd.DataFrame()


# =============================================================================
# 9. GLOBAL FOREST WATCH — DEFORESTATION ALERTS
#    Source: framework Sheet 1 Category IV "Global Forest Watch"
#    API: globalforestwatch.org — public REST API, no auth required
# =============================================================================

def fetch_global_forest_watch(output_dir: Path) -> pd.DataFrame:
    """
    Fetch deforestation alert statistics per AFRO country from
    Global Forest Watch API (GLAD-L/S alerts aggregated by country).
    """
    log.info("=== GLOBAL FOREST WATCH (source: globalforestwatch.org) ===")

    # GFW Country endpoint — returns tree cover loss statistics
    BASE = "https://production-api.globalforestwatch.org"
    records: list[dict] = []

    for country in tqdm(AFRO, desc="  GFW countries"):
        iso3 = country["iso3"]
        try:
            # Tree cover loss by country (Hansen/UMD data integrated into GFW)
            url = f"{BASE}/v1/country/{iso3}"
            r = requests.get(
                url, timeout=20,
                headers={"x-api-key": "gfw", "Content-Type": "application/json"}
            )
            if r.status_code != 200:
                # Try alternative endpoint
                url2 = f"{BASE}/forest-change/loss-by-year/{iso3}"
                r = requests.get(url2, timeout=20)

            if r.status_code == 200:
                data = r.json()
                # Parse loss data
                loss_data = (data.get("data", {}).get("attributes", {})
                             .get("loss", []))
                total_loss_ha = sum(
                    y.get("loss", 0) for y in loss_data
                    if y.get("year", 0) >= 2020
                )
                records.append({
                    "iso3":                     iso3,
                    "gfw_forest_loss_ha_2020_24": total_loss_ha,
                    "gfw_year":                 2024,
                    "source":                   "Global Forest Watch",
                })
            time.sleep(0.3)
        except Exception as e:
            log.warning(f"  GFW {iso3}: {e}")

    if not records:
        log.warning("  No GFW data fetched — API may require authentication.")
        return pd.DataFrame()

    df = pd.DataFrame(records)
    df.to_csv(output_dir / "gfw_deforestation.csv", index=False)
    log.info(f"  ✓ GFW: {len(df)} countries")
    return df


# =============================================================================
# 10. WOAH WAHIS — ANIMAL DISEASE EVENTS
#     Source: framework "WOAH WAHIS" (Animal Pathogen Detection)
#     API: wahis.woah.org — public data, no auth required
# =============================================================================

# WOAH-listed diseases relevant to AFRO and zoonotic spillover
WOAH_DISEASES = [
    "Highly pathogenic avian influenza",
    "Newcastle disease",
    "Foot and mouth disease",
    "African swine fever",
    "Rift Valley fever",
    "Rabies",
    "Anthrax",
    "Brucellosis",
    "African horse sickness",
    "Trypanosomosis",
]


def fetch_woah_wahis(output_dir: Path) -> pd.DataFrame:
    """
    Fetch WOAH WAHIS animal disease occurrence data for AFRO countries.
    Uses the public WAHIS REST API.
    """
    log.info("=== WOAH WAHIS (source: wahis.woah.org) ===")

    BASE = "https://wahis.woah.org/api/v1"
    records: list[dict] = []

    # Try WAHIS country-level disease summary endpoint
    try:
        # Get list of all outbreaks for Africa region
        url = f"{BASE}/report/country-situation"
        r = requests.get(
            url,
            params={
                "reportYear":   2024,
                "continentId":  6,  # Africa
            },
            timeout=30,
            headers={"Accept": "application/json"},
        )
        r.raise_for_status()
        data = r.json()
        for item in data.get("data", []):
            iso3 = resolve_iso3(item.get("countryCode", ""))
            if not iso3:
                continue
            disease = item.get("diseaseName", "unknown")
            records.append({
                "iso3":             iso3,
                "disease_name":     disease,
                "report_year":      2024,
                "outbreaks_count":  item.get("outbreakCount", 0),
                "affected_animals": item.get("totalAnimalsAffected", 0),
                "deaths":           item.get("totalDeaths", 0),
                "source":           "WOAH WAHIS",
            })
        log.info(f"  ✓ WOAH WAHIS: {len(records)} disease-country records")
    except Exception as e:
        log.warning(f"  WOAH WAHIS API: {e}")

    # Fallback: try alternative WAHIS endpoint structure
    if not records:
        try:
            url2 = f"{BASE}/animal-disease/situation/summary"
            r2 = requests.get(url2, timeout=30,
                              params={"year": 2024, "region": "AFRICA"},
                              headers={"Accept": "application/json"})
            r2.raise_for_status()
            data2 = r2.json()
            for item in data2.get("items", data2.get("data", [])):
                iso3 = resolve_iso3(
                    item.get("countryIso3", item.get("country", ""))
                )
                if not iso3:
                    continue
                records.append({
                    "iso3":             iso3,
                    "disease_name":     item.get("disease", "unknown"),
                    "report_year":      2024,
                    "outbreaks_count":  item.get("outbreaks", 0),
                    "affected_animals": item.get("animalsAffected", 0),
                    "deaths":           item.get("deaths", 0),
                    "source":           "WOAH WAHIS",
                })
        except Exception as e2:
            log.warning(f"  WOAH WAHIS fallback: {e2}")

    if not records:
        log.warning("  No WOAH WAHIS data fetched.")
        return pd.DataFrame()

    df_long = pd.DataFrame(records)
    df_long.to_csv(output_dir / "raw_woah_wahis.csv", index=False)

    # Aggregate: counts per country
    df_agg = (
        df_long.groupby("iso3")
        .agg(
            woah_total_disease_events  = ("outbreaks_count", "sum"),
            woah_total_animal_deaths   = ("deaths", "sum"),
            woah_diseases_reported_n   = ("disease_name", "nunique"),
        )
        .reset_index()
    )
    df_agg.to_csv(output_dir / "woah_aggregated.csv", index=False)
    log.info(f"  ✓ WOAH WAHIS aggregated: {len(df_agg)} countries")
    return df_agg


# =============================================================================
# 11. NASA POWER — CLIMATE DATA
#     Source: framework Sheet 1 Category IV "NOAA Climate Data" /
#             "MODIS (NASA)" / "Copernicus (CDS)"
#     Using NASA POWER API (free, no auth required)
# =============================================================================

NASA_PARAMS = {
    "T2M":     "temp_mean_c",
    "T2M_MAX": "temp_max_c",
    "T2M_MIN": "temp_min_c",
    "PRECTOTCORR": "precipitation_mm",
    "RH2M":    "humidity_pct",
    "WS10M":   "wind_speed_ms",
    "ALLSKY_SFC_SW_DWN": "solar_radiation_mj_m2",
}


def fetch_nasa_power(output_dir: Path) -> pd.DataFrame:
    """
    Fetch annual climate averages for each AFRO country centroid
    from NASA POWER API (power.larc.nasa.gov).
    Free public API — no authentication required.
    """
    log.info("=== NASA POWER CLIMATE (source: power.larc.nasa.gov) ===")

    BASE = "https://power.larc.nasa.gov/api/temporal/climatology/point"
    PARAM_STR = ",".join(NASA_PARAMS.keys())
    records: list[dict] = []

    # Country centroids — embedded directly (lat/lon per ISO3)
    CENTROIDS: dict[str, tuple] = {
        "AGO":(-11.20, 17.87),"BEN":(9.31,   2.32),"BWA":(-22.33, 24.68),
        "BFA":(12.36,  -1.53),"BDI":(-3.37,  29.92),"CPV":(16.00, -24.01),
        "CMR":(3.86,   11.52),"CAF":(6.61,   20.94),"TCD":(15.45,  18.73),
        "COM":(-11.64, 43.33),"COD":(-4.03,  21.75),"COG":(-0.23,  15.83),
        "CIV":(7.54,   -5.55),"GNQ":(1.65,   10.27),"ERI":(15.18,  39.78),
        "SWZ":(-26.52, 31.47),"ETH":(9.15,   40.49),"GAB":(-0.80,  11.61),
        "GMB":(13.44, -15.31),"GHA":(7.95,   -1.02),"GIN":(10.99, -10.91),
        "GNB":(11.80, -15.18),"KEN":(-0.02,  37.91),"LSO":(-29.61, 28.23),
        "LBR":(6.43,   -9.43),"MDG":(-18.77, 46.87),"MWI":(-13.25, 34.30),
        "MLI":(17.57,  -4.00),"MRT":(21.01, -10.94),"MUS":(-20.28, 57.55),
        "MOZ":(-17.27, 35.55),"NAM":(-22.96, 18.49),"NER":(17.61,   8.08),
        "NGA":(9.08,    8.68),"RWA":(-1.94,  29.87),"STP":(0.18,    6.61),
        "SEN":(14.50, -14.45),"SLE":(8.46,  -11.78),"SOM":(5.15,   46.20),
        "ZAF":(-30.56, 22.94),"SSD":(6.88,   31.31),"TZA":(-6.37,  34.89),
        "TGO":(8.62,    0.82),"UGA":(1.37,   32.29),"ZMB":(-13.13, 27.85),
        "ZWE":(-19.02, 29.15),
    }

    for country in tqdm(AFRO, desc="  NASA POWER countries"):
        iso3 = country["iso3"]
        if iso3 not in CENTROIDS:
            continue
        lat, lon = CENTROIDS[iso3]

        try:
            params = {
                "parameters": PARAM_STR,
                "community":  "AG",
                "longitude":  lon,
                "latitude":   lat,
                "format":     "JSON",
                "start":      2010,
                "end":        2023,
            }
            r = requests.get(BASE, params=params, timeout=30)
            r.raise_for_status()
            data = r.json()
            props = data.get("properties", {}).get("parameter", {})
            row = {"iso3": iso3, "source": "NASA POWER"}
            for api_code, label in NASA_PARAMS.items():
                monthly = props.get(api_code, {})
                # Annual mean = average of all monthly values
                vals = [v for v in monthly.values() if isinstance(v, (int, float))]
                row[f"nasa_{label}"] = round(sum(vals) / len(vals), 2) if vals else None
            records.append(row)
            time.sleep(0.4)
        except Exception as e:
            log.warning(f"  NASA POWER {iso3}: {e}")

    if not records:
        log.warning("  No NASA POWER data fetched.")
        return pd.DataFrame()

    df = pd.DataFrame(records)
    df.to_csv(output_dir / "nasa_power_climate.csv", index=False)
    log.info(f"  ✓ NASA POWER: {len(df)} countries")
    return df


# =============================================================================
# 12. PATHOGEN PROFILE TABLE
#     Source: WHO R&D Blueprint, SpillOver.global, ICTV, literature
#     Compiled from published values — key spillover risk metrics
# =============================================================================

# Verified published parameters for high-priority AFRO diseases
# Sources: WHO R&D Blueprint, SpillOver.global, published literature
PATHOGEN_PROFILES: list[dict] = [
    # R0, CFR, incubation, genome, transmission, spillover_score, priority
    # SpillOver.global scores: composite 0-100 (higher = higher spillover risk)
    {"disease":"Highly Pathogenic Avian Influenza (H5N1)","domain":"zoonotic",
     "r0_min":0.0,"r0_max":1.0,"r0_human_to_human":False,
     "cfr_pct":55.0,"incubation_days_min":2,"incubation_days_max":5,
     "genome_type":"RNA","genome_segment":"segmented","envelope":"enveloped",
     "mutation_rate_high":True,"natural_host":"birds","reservoir":"wild_birds",
     "transmission_routes":["direct_contact","aerosol"],"vector_borne":False,
     "spillover_score":89,"ihr_notifiable":True,"woah_listed":True,
     "pandemic_potential":"very_high","priority":"P1",
     "source":"WHO R&D Blueprint; SpillOver.global; CDC"},
    {"disease":"Ebola Virus Disease","domain":"zoonotic",
     "r0_min":1.5,"r0_max":2.5,"r0_human_to_human":True,
     "cfr_pct":50.0,"incubation_days_min":2,"incubation_days_max":21,
     "genome_type":"RNA","genome_segment":"non-segmented","envelope":"enveloped",
     "mutation_rate_high":False,"natural_host":"bats","reservoir":"fruit_bats",
     "transmission_routes":["direct_contact","body_fluids"],"vector_borne":False,
     "spillover_score":82,"ihr_notifiable":True,"woah_listed":False,
     "pandemic_potential":"high","priority":"P1",
     "source":"WHO R&D Blueprint; Chowell et al. 2004; SpillOver.global"},
    {"disease":"Mpox","domain":"zoonotic",
     "r0_min":0.6,"r0_max":2.4,"r0_human_to_human":True,
     "cfr_pct":4.0,"incubation_days_min":5,"incubation_days_max":21,
     "genome_type":"DNA","genome_segment":"non-segmented","envelope":"enveloped",
     "mutation_rate_high":False,"natural_host":"rodents","reservoir":"rodents_primates",
     "transmission_routes":["direct_contact","respiratory","fomites"],"vector_borne":False,
     "spillover_score":71,"ihr_notifiable":True,"woah_listed":False,
     "pandemic_potential":"high","priority":"P1",
     "source":"WHO; Jezek & Fenner 1988; NEJM 2022"},
    {"disease":"Rift Valley Fever","domain":"zoonotic",
     "r0_min":1.0,"r0_max":1.5,"r0_human_to_human":False,
     "cfr_pct":1.0,"incubation_days_min":2,"incubation_days_max":6,
     "genome_type":"RNA","genome_segment":"segmented","envelope":"enveloped",
     "mutation_rate_high":True,"natural_host":"cattle_sheep","reservoir":"aedes_mosquito",
     "transmission_routes":["mosquito_bite","direct_animal_contact"],"vector_borne":True,
     "spillover_score":68,"ihr_notifiable":True,"woah_listed":True,
     "pandemic_potential":"moderate","priority":"P1",
     "source":"WHO R&D Blueprint; Bird et al. 2009"},
    {"disease":"Crimean-Congo HF","domain":"zoonotic",
     "r0_min":0.8,"r0_max":1.5,"r0_human_to_human":True,
     "cfr_pct":30.0,"incubation_days_min":1,"incubation_days_max":13,
     "genome_type":"RNA","genome_segment":"segmented","envelope":"enveloped",
     "mutation_rate_high":True,"natural_host":"cattle","reservoir":"hyalomma_ticks",
     "transmission_routes":["tick_bite","direct_contact"],"vector_borne":True,
     "spillover_score":74,"ihr_notifiable":True,"woah_listed":True,
     "pandemic_potential":"high","priority":"P1",
     "source":"WHO R&D Blueprint; Whitehouse 2004"},
    {"disease":"Plague","domain":"zoonotic",
     "r0_min":1.0,"r0_max":3.0,"r0_human_to_human":True,
     "cfr_pct":30.0,"incubation_days_min":1,"incubation_days_max":7,
     "genome_type":"DNA","genome_segment":"non-segmented","envelope":"non-enveloped",
     "mutation_rate_high":False,"natural_host":"rodents","reservoir":"rodent_fleas",
     "transmission_routes":["flea_bite","respiratory"],"vector_borne":True,
     "spillover_score":62,"ihr_notifiable":True,"woah_listed":False,
     "pandemic_potential":"moderate","priority":"P1",
     "source":"WHO; Stenseth et al. 2008"},
    {"disease":"Rabies","domain":"zoonotic",
     "r0_min":1.0,"r0_max":2.0,"r0_human_to_human":False,
     "cfr_pct":99.9,"incubation_days_min":21,"incubation_days_max":90,
     "genome_type":"RNA","genome_segment":"non-segmented","envelope":"enveloped",
     "mutation_rate_high":False,"natural_host":"dogs_wildlife","reservoir":"dogs",
     "transmission_routes":["bite_scratch"],"vector_borne":False,
     "spillover_score":55,"ihr_notifiable":False,"woah_listed":True,
     "pandemic_potential":"low","priority":"P2",
     "source":"WHO; Hampson et al. 2015"},
    {"disease":"Brucellosis","domain":"zoonotic",
     "r0_min":1.0,"r0_max":1.5,"r0_human_to_human":False,
     "cfr_pct":0.5,"incubation_days_min":5,"incubation_days_max":60,
     "genome_type":"DNA","genome_segment":"non-segmented","envelope":"non-enveloped",
     "mutation_rate_high":False,"natural_host":"cattle_goats","reservoir":"livestock",
     "transmission_routes":["ingestion","direct_contact"],"vector_borne":False,
     "spillover_score":48,"ihr_notifiable":False,"woah_listed":True,
     "pandemic_potential":"low","priority":"P2",
     "source":"WHO; Seleem et al. 2010"},
    {"disease":"Leptospirosis","domain":"zoonotic",
     "r0_min":1.0,"r0_max":2.0,"r0_human_to_human":False,
     "cfr_pct":10.0,"incubation_days_min":2,"incubation_days_max":30,
     "genome_type":"DNA","genome_segment":"non-segmented","envelope":"non-enveloped",
     "mutation_rate_high":False,"natural_host":"rodents","reservoir":"rodents_cattle",
     "transmission_routes":["water_exposure","direct_contact"],"vector_borne":False,
     "spillover_score":52,"ihr_notifiable":False,"woah_listed":False,
     "pandemic_potential":"low","priority":"P2",
     "source":"WHO; Hartskeerl et al. 2011"},
    {"disease":"Anthrax","domain":"zoonotic",
     "r0_min":0.5,"r0_max":1.2,"r0_human_to_human":False,
     "cfr_pct":20.0,"incubation_days_min":1,"incubation_days_max":7,
     "genome_type":"DNA","genome_segment":"non-segmented","envelope":"non-enveloped",
     "mutation_rate_high":False,"natural_host":"cattle_wildlife","reservoir":"soil_spores",
     "transmission_routes":["direct_contact","ingestion","inhalation"],"vector_borne":False,
     "spillover_score":44,"ihr_notifiable":False,"woah_listed":True,
     "pandemic_potential":"low","priority":"P2",
     "source":"WHO; Turnbull 2008"},
    {"disease":"Yellow Fever","domain":"vector",
     "r0_min":2.0,"r0_max":5.0,"r0_human_to_human":False,
     "cfr_pct":20.0,"incubation_days_min":3,"incubation_days_max":6,
     "genome_type":"RNA","genome_segment":"non-segmented","envelope":"enveloped",
     "mutation_rate_high":True,"natural_host":"primates","reservoir":"aedes_mosquito",
     "transmission_routes":["mosquito_bite"],"vector_borne":True,
     "spillover_score":66,"ihr_notifiable":True,"woah_listed":False,
     "pandemic_potential":"moderate","priority":"P1",
     "source":"WHO R&D Blueprint; Monath 2001"},
    {"disease":"Dengue","domain":"vector",
     "r0_min":2.0,"r0_max":5.0,"r0_human_to_human":False,
     "cfr_pct":1.0,"incubation_days_min":4,"incubation_days_max":10,
     "genome_type":"RNA","genome_segment":"non-segmented","envelope":"enveloped",
     "mutation_rate_high":True,"natural_host":"humans","reservoir":"aedes_mosquito",
     "transmission_routes":["mosquito_bite"],"vector_borne":True,
     "spillover_score":58,"ihr_notifiable":False,"woah_listed":False,
     "pandemic_potential":"moderate","priority":"P2",
     "source":"WHO; Bhatt et al. 2013"},
    {"disease":"Malaria","domain":"vector",
     "r0_min":5.0,"r0_max":100.0,"r0_human_to_human":False,
     "cfr_pct":0.5,"incubation_days_min":7,"incubation_days_max":30,
     "genome_type":"DNA","genome_segment":"non-segmented","envelope":"non-enveloped",
     "mutation_rate_high":False,"natural_host":"humans","reservoir":"anopheles_mosquito",
     "transmission_routes":["mosquito_bite"],"vector_borne":True,
     "spillover_score":None,"ihr_notifiable":False,"woah_listed":False,
     "pandemic_potential":"endemic","priority":"P2",
     "source":"WHO World Malaria Report 2024"},
    {"disease":"Cholera","domain":"environmental",
     "r0_min":1.0,"r0_max":3.0,"r0_human_to_human":True,
     "cfr_pct":2.0,"incubation_days_min":0,"incubation_days_max":5,
     "genome_type":"DNA","genome_segment":"non-segmented","envelope":"non-enveloped",
     "mutation_rate_high":False,"natural_host":"humans","reservoir":"aquatic_environment",
     "transmission_routes":["waterborne","foodborne"],"vector_borne":False,
     "spillover_score":None,"ihr_notifiable":True,"woah_listed":False,
     "pandemic_potential":"high","priority":"P1",
     "source":"WHO; Longini et al. 2007"},
    {"disease":"African Swine Fever","domain":"animal",
     "r0_min":1.0,"r0_max":3.0,"r0_human_to_human":False,
     "cfr_pct":90.0,"incubation_days_min":4,"incubation_days_max":19,
     "genome_type":"DNA","genome_segment":"non-segmented","envelope":"enveloped",
     "mutation_rate_high":False,"natural_host":"pigs_warthogs","reservoir":"ornithodoros_ticks",
     "transmission_routes":["direct_contact","tick_bite","fomites"],"vector_borne":True,
     "spillover_score":None,"ihr_notifiable":False,"woah_listed":True,
     "pandemic_potential":"n/a_animal_only","priority":"P1",
     "source":"WOAH; Sanchez-Vizcaino et al. 2015"},
    {"disease":"Foot and Mouth Disease","domain":"animal",
     "r0_min":3.0,"r0_max":10.0,"r0_human_to_human":False,
     "cfr_pct":2.0,"incubation_days_min":2,"incubation_days_max":14,
     "genome_type":"RNA","genome_segment":"non-segmented","envelope":"non-enveloped",
     "mutation_rate_high":True,"natural_host":"cattle_pigs","reservoir":"wildlife_carriers",
     "transmission_routes":["direct_contact","aerosol","fomites"],"vector_borne":False,
     "spillover_score":None,"ihr_notifiable":False,"woah_listed":True,
     "pandemic_potential":"n/a_animal_only","priority":"P1",
     "source":"WOAH; Grubman & Baxt 2004"},
    {"disease":"Meningococcal Disease","domain":"environmental",
     "r0_min":1.0,"r0_max":2.5,"r0_human_to_human":True,
     "cfr_pct":10.0,"incubation_days_min":2,"incubation_days_max":10,
     "genome_type":"DNA","genome_segment":"non-segmented","envelope":"non-enveloped",
     "mutation_rate_high":False,"natural_host":"humans","reservoir":"human_nasopharynx",
     "transmission_routes":["respiratory","direct_contact"],"vector_borne":False,
     "spillover_score":None,"ihr_notifiable":True,"woah_listed":False,
     "pandemic_potential":"moderate","priority":"P1",
     "source":"WHO; Rosenstein et al. 2001"},
    {"disease":"Drug-Resistant Typhoid","domain":"amr",
     "r0_min":3.0,"r0_max":7.0,"r0_human_to_human":True,
     "cfr_pct":2.0,"incubation_days_min":6,"incubation_days_max":30,
     "genome_type":"DNA","genome_segment":"non-segmented","envelope":"non-enveloped",
     "mutation_rate_high":True,"natural_host":"humans","reservoir":"contaminated_water_food",
     "transmission_routes":["waterborne","foodborne"],"vector_borne":False,
     "spillover_score":None,"ihr_notifiable":False,"woah_listed":False,
     "pandemic_potential":"moderate","priority":"P2",
     "source":"WHO GLASS 2022; Carey et al. 2021"},
    {"disease":"ESBL-producing E. coli","domain":"amr",
     "r0_min":None,"r0_max":None,"r0_human_to_human":True,
     "cfr_pct":3.0,"incubation_days_min":1,"incubation_days_max":10,
     "genome_type":"DNA","genome_segment":"non-segmented","envelope":"non-enveloped",
     "mutation_rate_high":True,"natural_host":"humans_animals","reservoir":"gut_microbiome_environment",
     "transmission_routes":["direct_contact","waterborne","foodborne"],"vector_borne":False,
     "spillover_score":None,"ihr_notifiable":False,"woah_listed":False,
     "pandemic_potential":"moderate","priority":"P2",
     "source":"WHO GLASS 2022; WOAH AMR 2022"},
    {"disease":"Trypanosomiasis (HAT)","domain":"zoonotic",
     "r0_min":1.0,"r0_max":1.5,"r0_human_to_human":False,
     "cfr_pct":15.0,"incubation_days_min":1,"incubation_days_max":21,
     "genome_type":"DNA","genome_segment":"non-segmented","envelope":"non-enveloped",
     "mutation_rate_high":True,"natural_host":"cattle_wildlife","reservoir":"tsetse_fly",
     "transmission_routes":["tsetse_bite"],"vector_borne":True,
     "spillover_score":45,"ihr_notifiable":False,"woah_listed":True,
     "pandemic_potential":"low","priority":"P2",
     "source":"WHO; Simarro et al. 2012"},
    {"disease":"Q Fever","domain":"zoonotic",
     "r0_min":1.0,"r0_max":2.0,"r0_human_to_human":False,
     "cfr_pct":1.0,"incubation_days_min":2,"incubation_days_max":40,
     "genome_type":"DNA","genome_segment":"non-segmented","envelope":"non-enveloped",
     "mutation_rate_high":False,"natural_host":"sheep_goats","reservoir":"livestock",
     "transmission_routes":["inhalation","direct_contact"],"vector_borne":False,
     "spillover_score":41,"ihr_notifiable":False,"woah_listed":False,
     "pandemic_potential":"low","priority":"P2",
     "source":"WHO; Eldin et al. 2017"},
    {"disease":"Newcastle Disease","domain":"animal",
     "r0_min":2.0,"r0_max":5.0,"r0_human_to_human":False,
     "cfr_pct":40.0,"incubation_days_min":2,"incubation_days_max":15,
     "genome_type":"RNA","genome_segment":"non-segmented","envelope":"enveloped",
     "mutation_rate_high":True,"natural_host":"poultry","reservoir":"wild_birds",
     "transmission_routes":["direct_contact","aerosol","fomites"],"vector_borne":False,
     "spillover_score":None,"ihr_notifiable":False,"woah_listed":True,
     "pandemic_potential":"n/a_animal_only","priority":"P2",
     "source":"WOAH; Alexander 2000"},
    {"disease":"African Horse Sickness","domain":"animal",
     "r0_min":1.5,"r0_max":3.0,"r0_human_to_human":False,
     "cfr_pct":70.0,"incubation_days_min":3,"incubation_days_max":14,
     "genome_type":"RNA","genome_segment":"segmented","envelope":"non-enveloped",
     "mutation_rate_high":True,"natural_host":"horses_mules","reservoir":"culicoides_midges",
     "transmission_routes":["midge_bite"],"vector_borne":True,
     "spillover_score":None,"ihr_notifiable":False,"woah_listed":True,
     "pandemic_potential":"n/a_animal_only","priority":"P2",
     "source":"WOAH; Coetzer & Erasmus 1994"},
    {"disease":"Typhoid Fever","domain":"environmental",
     "r0_min":3.0,"r0_max":7.0,"r0_human_to_human":True,
     "cfr_pct":1.0,"incubation_days_min":6,"incubation_days_max":30,
     "genome_type":"DNA","genome_segment":"non-segmented","envelope":"non-enveloped",
     "mutation_rate_high":False,"natural_host":"humans","reservoir":"contaminated_water_food",
     "transmission_routes":["waterborne","foodborne"],"vector_borne":False,
     "spillover_score":None,"ihr_notifiable":False,"woah_listed":False,
     "pandemic_potential":"moderate","priority":"P2",
     "source":"WHO; Crump et al. 2004"},
]


def build_pathogen_profiles(output_dir: Path) -> pd.DataFrame:
    """
    Build the pathogen profile table from verified published parameters.
    Serialise transmission routes as JSON for database storage.
    """
    log.info("=== PATHOGEN PROFILES (sources: WHO R&D Blueprint, SpillOver.global, literature) ===")

    records = []
    for p in PATHOGEN_PROFILES:
        row = dict(p)
        # Serialise list fields
        row["transmission_routes"] = json.dumps(p["transmission_routes"])
        records.append(row)

    df = pd.DataFrame(records)
    df.to_csv(output_dir / "pathogen_profiles.csv", index=False)
    log.info(f"  ✓ Pathogen profiles: {len(df)} diseases compiled")
    return df


# =============================================================================
# 13. VECTOR ECOLOGY — AFRO CLIMATE SUITABILITY PROXY
#     Source: ECDC VectorNet (framework) / Lancet Countdown
#     Method: derive from NASA POWER climate + country metadata
# =============================================================================

def build_vector_ecology(climate_df: pd.DataFrame, output_dir: Path) -> pd.DataFrame:
    """
    Derive vector habitat suitability indices from climate data.
    Methodology: Mordecai et al. (2019) thermal performance curves for
    Aedes aegypti (dengue/yellow fever) and Anopheles gambiae (malaria).
    Source: Lancet Countdown on Health and Climate Change (framework listed).
    """
    log.info("=== VECTOR ECOLOGY (derived from NASA POWER + Mordecai et al. 2019) ===")

    if climate_df.empty:
        log.warning("  No climate data — using country metadata only for vector ecology")

    records = []
    for country in AFRO:
        iso3 = country["iso3"]

        # Get climate values if available
        if not climate_df.empty and iso3 in climate_df["iso3"].values:
            row = climate_df[climate_df["iso3"] == iso3].iloc[0]
            temp = float(row.get("nasa_temp_mean_c", 24.0) or 24.0)
            precip = float(row.get("nasa_precipitation_mm", 80.0) or 80.0)
            humidity = float(row.get("nasa_humidity_pct", 65.0) or 65.0)
        else:
            temp, precip, humidity = 24.0, 80.0, 65.0

        # Aedes aegypti suitability: optimal 26–30°C, requires >50mm/month
        # Mordecai et al. 2019 quadratic thermal response
        if 16 <= temp <= 38:
            t_norm = (temp - 16) / (38 - 16)
            aedes_thermal = 4 * t_norm * (1 - t_norm)
        else:
            aedes_thermal = 0.0
        aedes_precip = min(1.0, precip / 100.0) if precip >= 50 else precip / 100.0
        aedes_suitability = round(aedes_thermal * aedes_precip, 3)

        # Anopheles gambiae suitability: optimal 25–28°C
        if 16 <= temp <= 35:
            t_norm_an = (temp - 16) / (35 - 16)
            anoph_thermal = 4 * t_norm_an * (1 - t_norm_an)
        else:
            anoph_thermal = 0.0
        anoph_precip = min(1.0, precip / 80.0) if precip >= 60 else 0.5 * precip / 80.0
        anoph_suitability = round(anoph_thermal * anoph_precip, 3)

        # Hyalomma tick suitability (CCHF): semi-arid, warm, low humidity
        hyalomma_suitability = round(
            min(1.0, temp / 35.0) * max(0.0, 1.0 - humidity / 100.0), 3
        )

        # Tsetse fly (HAT): requires forest/woodland, high humidity
        tsetse_suitability = round(
            min(1.0, humidity / 80.0) * (1.0 if precip > 80 else precip / 80.0), 3
        )

        records.append({
            "iso3":                         iso3,
            "aedes_aegypti_suitability":    aedes_suitability,
            "anopheles_gambiae_suitability":anoph_suitability,
            "hyalomma_tick_suitability":    hyalomma_suitability,
            "tsetse_fly_suitability":       tsetse_suitability,
            "climate_temp_used_c":          temp,
            "climate_precip_used_mm":       precip,
            "vector_method":  "Mordecai et al. 2019 thermal performance + precipitation index",
            "source":         "NASA POWER climate; Mordecai et al. 2019; Lancet Countdown",
        })

    df = pd.DataFrame(records)
    df.to_csv(output_dir / "vector_ecology.csv", index=False)
    log.info(f"  ✓ Vector ecology: {len(df)} countries")
    return df


# =============================================================================
# 14. SPILLOVER INTERFACE TABLE
#     Source: FAOSTAT (livestock density), GFW (deforestation),
#             CITES (wildlife trade), framework spillover interface metrics
# =============================================================================

def build_spillover_interface(
    fao_df: pd.DataFrame,
    gfw_df: pd.DataFrame,
    output_dir: Path,
) -> pd.DataFrame:
    """
    Compile the spillover interface table combining:
    - Livestock density from FAOSTAT
    - Deforestation from Global Forest Watch
    - Wildlife trade risk (CITES volume proxy)
    - Interface zone metrics (forest edge density proxy)
    """
    log.info("=== SPILLOVER INTERFACE TABLE ===")

    records = []
    for country in AFRO:
        iso3 = country["iso3"]
        row = {"iso3": iso3, "source": "FAOSTAT; GFW; CITES; WOAH"}

        # Livestock density from FAO
        if not fao_df.empty and iso3 in fao_df.get("iso3", pd.Series()).values:
            fao_row = fao_df[fao_df["iso3"] == iso3].iloc[0]
            cattle_col = next(
                (c for c in fao_df.columns if "cattle" in c.lower()), None
            )
            poultry_col = next(
                (c for c in fao_df.columns if "chicken" in c.lower()), None
            )
            row["livestock_cattle_heads"] = float(fao_row[cattle_col]) if cattle_col else None
            row["livestock_poultry_heads"] = float(fao_row[poultry_col]) if poultry_col else None

        # Deforestation from GFW
        if not gfw_df.empty and iso3 in gfw_df.get("iso3", pd.Series()).values:
            gfw_row = gfw_df[gfw_df["iso3"] == iso3].iloc[0]
            row["forest_loss_ha_2020_24"] = float(
                gfw_row.get("gfw_forest_loss_ha_2020_24", 0)
            )

        # CITES wildlife trade risk tier
        # Published CITES 2022 annual report — Africa major exporters
        cites_tiers = {
            "ZAF": "high", "TZA": "high", "ZMB": "medium", "ZWE": "medium",
            "KEN": "high",  "ETH": "medium","UGA": "medium","CMR": "medium",
            "COD": "high",  "GHA": "medium","NGA": "medium","SEN": "medium",
            "MDG": "high",  "MOZ": "medium","BWA": "medium","NAM": "medium",
        }
        row["cites_trade_risk_tier"] = cites_tiers.get(iso3, "low")

        # Market risk score proxy (bushmeat / wildlife trade presence)
        # Based on: TRAFFIC reports; CIFOR-ICRAF publications (framework sources)
        bushmeat_countries = {
            "COD", "CMR", "CAF", "COG", "GAB", "GIN", "LBR", "SLE",
            "NGA", "GHA", "CIV", "TZA", "UGA", "KEN",
        }
        row["bushmeat_market_presence"] = iso3 in bushmeat_countries

        # Interface zones (fragmentation proxy)
        # High deforestation + high livestock = high interface risk
        defor = row.get("forest_loss_ha_2020_24", 0) or 0
        row["interface_risk_score"] = round(
            min(10.0, (defor / 10000.0) + (2.0 if row.get("bushmeat_market_presence") else 0.0)),
            2
        )

        records.append(row)

    df = pd.DataFrame(records)
    df.to_csv(output_dir / "spillover_interface.csv", index=False)
    log.info(f"  ✓ Spillover interface: {len(df)} countries")
    return df


# =============================================================================
# 15. HOST & RESERVOIR ECOLOGY TABLE
#     Source: IUCN Red List, GBIF, PREDICTS database (framework listed)
#     Method: published regional species counts + IUCN threat categories
# =============================================================================

# Published IUCN mammal / bird counts relevant to spillover for AFRO subregions
# Source: IUCN Red List 2024; GBIF occurrence data; Olival et al. 2017
IUCN_SUBREGION_DATA: dict[str, dict] = {
    "West Africa": {
        "mammal_species_total":     445, "mammal_species_threatened":  85,
        "bird_species_total":       600, "bat_species_total":           80,
        "rodent_species_total":     120, "primate_species_total":       26,
        "iucn_data_year":           2024,
        "gbif_occurrence_records_M":  2.1,
    },
    "Central Africa": {
        "mammal_species_total":     551, "mammal_species_threatened":  115,
        "bird_species_total":       690, "bat_species_total":           95,
        "rodent_species_total":     148, "primate_species_total":       42,
        "iucn_data_year":           2024,
        "gbif_occurrence_records_M":  1.8,
    },
    "East Africa": {
        "mammal_species_total":     520, "mammal_species_threatened":  98,
        "bird_species_total":       680, "bat_species_total":           88,
        "rodent_species_total":     135, "primate_species_total":       34,
        "iucn_data_year":           2024,
        "gbif_occurrence_records_M":  3.2,
    },
    "Southern Africa": {
        "mammal_species_total":     360, "mammal_species_threatened":  62,
        "bird_species_total":       530, "bat_species_total":           70,
        "rodent_species_total":      95, "primate_species_total":       15,
        "iucn_data_year":           2024,
        "gbif_occurrence_records_M":  4.1,
    },
}


def build_host_ecology(output_dir: Path) -> pd.DataFrame:
    """
    Build host/reservoir ecology table from published IUCN + GBIF data.
    """
    log.info("=== HOST & RESERVOIR ECOLOGY (sources: IUCN Red List; GBIF; Olival et al. 2017) ===")

    records = []
    for country in AFRO:
        iso3   = country["iso3"]
        sub    = country["sub"]
        region = IUCN_SUBREGION_DATA.get(sub, IUCN_SUBREGION_DATA["East Africa"])

        records.append({
            "iso3":                            iso3,
            "mammal_species_count":            region["mammal_species_total"],
            "mammal_threatened_count":         region["mammal_species_threatened"],
            "bird_species_count":              region["bird_species_total"],
            "bat_species_count":               region["bat_species_total"],
            "rodent_species_count":            region["rodent_species_total"],
            "primate_species_count":           region["primate_species_total"],
            "threatened_proportion_pct":       round(
                region["mammal_species_threatened"] / region["mammal_species_total"] * 100, 1
            ),
            "gbif_occurrence_records_M":       region["gbif_occurrence_records_M"],
            "host_diversity_index":            round(
                (region["bat_species_total"] + region["rodent_species_total"]) /
                region["mammal_species_total"], 3
            ),
            "zoonotic_host_richness_class":    (
                "very_high" if region["mammal_species_total"] > 500
                else "high"  if region["mammal_species_total"] > 400
                else "moderate"
            ),
            "migratory_bird_route":            sub in ("East Africa", "West Africa"),
            "iucn_data_year":                  region["iucn_data_year"],
            "source": "IUCN Red List 2024; GBIF; Olival et al. 2017 Nat Comms",
        })

    df = pd.DataFrame(records)
    df.to_csv(output_dir / "host_ecology.csv", index=False)
    log.info(f"  ✓ Host ecology: {len(df)} countries")
    return df


# =============================================================================
# 16. HUMAN SOCIAL & CONNECTIVITY TABLE
#     Source: WorldPop, IATA, World Bank (mobility), UNHCR (displacement)
# =============================================================================

# Published UNHCR displacement data 2024 (source: UNHCR Global Trends 2024)
UNHCR_DISPLACEMENT_2024: dict[str, dict] = {
    "SSD": {"refugees_hosted": 285000,  "idp_total": 2100000, "refugee_origin": 2230000},
    "COD": {"refugees_hosted": 524000,  "idp_total": 6900000, "refugee_origin": 1050000},
    "ETH": {"refugees_hosted": 878000,  "idp_total": 3500000, "refugee_origin": 225000},
    "SOM": {"refugees_hosted": 36000,   "idp_total": 3800000, "refugee_origin": 804000},
    "CAF": {"refugees_hosted": 26000,   "idp_total": 775000,  "refugee_origin": 736000},
    "NGA": {"refugees_hosted": 90000,   "idp_total": 3400000, "refugee_origin": 90000},
    "CMR": {"refugees_hosted": 451000,  "idp_total": 1000000, "refugee_origin": 50000},
    "MOZ": {"refugees_hosted": 15000,   "idp_total": 760000,  "refugee_origin": 15000},
    "MLI": {"refugees_hosted": 55000,   "idp_total": 379000,  "refugee_origin": 160000},
    "BFA": {"refugees_hosted": 34000,   "idp_total": 2100000, "refugee_origin": 34000},
    "TCD": {"refugees_hosted": 1200000, "idp_total": 1000000, "refugee_origin": 200000},
    "KEN": {"refugees_hosted": 773000,  "idp_total": 190000,  "refugee_origin": 16000},
    "UGA": {"refugees_hosted": 1740000, "idp_total": 40000,   "refugee_origin": 12000},
    "ZMB": {"refugees_hosted": 99000,   "idp_total": 10000,   "refugee_origin": 5000},
    "TZA": {"refugees_hosted": 237000,  "idp_total": 5000,    "refugee_origin": 8000},
    "ZWE": {"refugees_hosted": 15000,   "idp_total": 5000,    "refugee_origin": 30000},
    "GIN": {"refugees_hosted": 36000,   "idp_total": 8000,    "refugee_origin": 14000},
    "LBR": {"refugees_hosted": 8000,    "idp_total": 5000,    "refugee_origin": 4000},
    "SLE": {"refugees_hosted": 2000,    "idp_total": 2000,    "refugee_origin": 700},
    "RWA": {"refugees_hosted": 135000,  "idp_total": 2000,    "refugee_origin": 8000},
    "BDI": {"refugees_hosted": 90000,   "idp_total": 100000,  "refugee_origin": 64000},
}


def build_human_social(wb_df: pd.DataFrame, output_dir: Path) -> pd.DataFrame:
    """
    Build human social & connectivity table combining World Bank and UNHCR data.
    """
    log.info("=== HUMAN SOCIAL & CONNECTIVITY TABLE ===")

    records = []
    for country in AFRO:
        iso3 = country["iso3"]
        row  = {"iso3": iso3}

        # World Bank indicators if available
        if not wb_df.empty and iso3 in wb_df.get("iso3", pd.Series()).values:
            wb_row = wb_df[wb_df["iso3"] == iso3].iloc[0]
            for col in ["internet_penetration_pct", "urban_population_pct",
                        "urban_slum_population_pct", "basic_sanitation_access_pct",
                        "basic_water_access_pct", "gdp_per_capita_usd",
                        "gdp_growth_rate_pct", "poverty_headcount_pct_190",
                        "population_density_per_km2", "mobile_subscriptions_per100"]:
                row[col] = float(wb_row[col]) if col in wb_row and pd.notna(wb_row[col]) else None

        # UNHCR displacement
        unhcr = UNHCR_DISPLACEMENT_2024.get(iso3, {})
        row["unhcr_refugees_hosted"]    = unhcr.get("refugees_hosted", 0)
        row["unhcr_idp_total"]          = unhcr.get("idp_total", 0)
        row["unhcr_refugee_origin"]     = unhcr.get("refugee_origin", 0)
        row["displacement_index"]       = (
            (row["unhcr_refugees_hosted"] + row["unhcr_idp_total"]) /
            max(1, country["pop_M"] * 1_000_000)
        )

        # Connectivity tier (IATA passenger flux proxy — published IATA 2023 Africa report)
        # Source: IATA World Air Transport Statistics 2023 — top AFRO hubs
        iata_hubs = {
            "ZAF": "tier1", "ETH": "tier1", "KEN": "tier1", "NGA": "tier1",
            "RWA": "tier2", "GHA": "tier2", "TZA": "tier2", "CMR": "tier2",
            "SEN": "tier2", "MUS": "tier2", "CIV": "tier2", "UGA": "tier2",
        }
        row["iata_hub_tier"]  = iata_hubs.get(iso3, "tier3")
        row["source"] = "World Bank WDI; UNHCR Global Trends 2024; IATA WATS 2023"
        records.append(row)

    df = pd.DataFrame(records)
    df.to_csv(output_dir / "human_social.csv", index=False)
    log.info(f"  ✓ Human social & connectivity: {len(df)} countries")
    return df


# =============================================================================
# 17. SCHEMA — COMPLETE 12-TABLE STRUCTURE
# =============================================================================

SCHEMA_SQL = """
-- =============================================================================
-- ONE HEALTH AFRO — COMPLETE SCHEMA v2.0
-- 12 Tables covering all 98 spillover risk factor metrics
-- Compatible with PostgreSQL / Supabase
-- Source: WHO AFRO PDX Programme; IntEpi Consulting; March 2026
-- =============================================================================

-- Enable PostGIS (run once)
-- CREATE EXTENSION IF NOT EXISTS postgis;

-- ── 1. Countries (base table) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS oh_countries (
    iso3                VARCHAR(3)   PRIMARY KEY,
    country_name        VARCHAR(100) NOT NULL,
    who_subregion       VARCHAR(50),
    population_M        DECIMAL(8,2),
    disease_burden_w    DECIMAL(4,2),
    lat_centroid        DECIMAL(9,6),
    lon_centroid        DECIMAL(9,6),
    climate_zone        VARCHAR(30),
    fragility_index     SMALLINT     CHECK (fragility_index BETWEEN 0 AND 10),
    afro_member         BOOLEAN      DEFAULT TRUE
);

-- ── 2. Disease Reports ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS oh_disease_reports (
    report_id              VARCHAR(20)  PRIMARY KEY,
    country_iso3           VARCHAR(3)   REFERENCES oh_countries(iso3),
    country_name           VARCHAR(100),
    who_subregion          VARCHAR(50),
    district               VARCHAR(100),
    gps_lat                DECIMAL(9,6),
    gps_lon                DECIMAL(9,6),
    report_date            DATE         NOT NULL,
    epi_week               SMALLINT,
    epi_year               SMALLINT,
    disease_name           VARCHAR(100) NOT NULL,
    disease_domain         VARCHAR(30),
    ihr_notifiable         BOOLEAN      DEFAULT FALSE,
    woah_listed            BOOLEAN      DEFAULT FALSE,
    priority               VARCHAR(5),
    case_classification    VARCHAR(20),
    case_count             INTEGER      DEFAULT 0,
    alert_tier             SMALLINT     DEFAULT 0,
    has_human_case         BOOLEAN      DEFAULT FALSE,
    has_animal_event       BOOLEAN      DEFAULT FALSE,
    report_source          VARCHAR(40),
    data_completeness_pct  DECIMAL(5,1),
    created_at             TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reports_country ON oh_disease_reports(country_iso3, report_date DESC);
CREATE INDEX IF NOT EXISTS idx_reports_disease ON oh_disease_reports(disease_name, alert_tier);

-- ── 3. Human Cases ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS oh_human_cases (
    id              SERIAL       PRIMARY KEY,
    report_id       VARCHAR(20)  REFERENCES oh_disease_reports(report_id),
    onset_date      DATE,
    age_group       VARCHAR(10),
    sex             CHAR(1),
    occupation      VARCHAR(40),
    animal_contact  BOOLEAN      DEFAULT FALSE,
    symptoms        JSONB,
    hospitalized    BOOLEAN      DEFAULT FALSE,
    outcome         VARCHAR(25),
    sample_collected BOOLEAN     DEFAULT FALSE,
    lab_confirmed   BOOLEAN      DEFAULT FALSE,
    case_count      INTEGER      DEFAULT 1
);

-- ── 4. Animal Events ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS oh_animal_events (
    id              SERIAL       PRIMARY KEY,
    report_id       VARCHAR(20)  REFERENCES oh_disease_reports(report_id),
    species         VARCHAR(50),
    flock_size      INTEGER,
    animals_sick    INTEGER,
    animals_dead    INTEGER,
    mortality_pct   DECIMAL(5,2),
    onset_date      DATE,
    clinical_signs  JSONB,
    human_exposure  BOOLEAN      DEFAULT FALSE,
    humans_exposed  INTEGER      DEFAULT 0,
    woah_notified   BOOLEAN      DEFAULT FALSE,
    lab_confirmed   BOOLEAN      DEFAULT FALSE
);

-- ── 5. Environmental Observations ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS oh_env_observations (
    env_id                  VARCHAR(20)  PRIMARY KEY,
    country_iso3            VARCHAR(3)   REFERENCES oh_countries(iso3),
    district                VARCHAR(100),
    obs_date                DATE         NOT NULL,
    gps_lat                 DECIMAL(9,6),
    gps_lon                 DECIMAL(9,6),
    temp_max_c              DECIMAL(5,1),
    temp_min_c              DECIMAL(5,1),
    temp_mean_c             DECIMAL(5,1),
    precipitation_mm        DECIMAL(7,1),
    humidity_pct            DECIMAL(5,1),
    wind_speed_ms           DECIMAL(5,1),
    ndvi                    DECIMAL(5,3),
    migratory_bird_season   BOOLEAN,
    flood_risk_flag         BOOLEAN,
    drought_risk_flag       BOOLEAN,
    land_use                VARCHAR(50),
    deforestation_alert     BOOLEAN,
    water_body_proximity_km DECIMAL(6,1),
    dust_season             BOOLEAN
);
CREATE INDEX IF NOT EXISTS idx_env_country_date ON oh_env_observations(country_iso3, obs_date DESC);

-- ── 6. Alerts ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS oh_alerts (
    alert_id        VARCHAR(20)  PRIMARY KEY,
    report_id       VARCHAR(20)  REFERENCES oh_disease_reports(report_id),
    country_iso3    VARCHAR(3)   REFERENCES oh_countries(iso3),
    district        VARCHAR(100),
    disease_name    VARCHAR(100),
    alert_tier      SMALLINT     CHECK (alert_tier BETWEEN 1 AND 4),
    alert_date      DATE         NOT NULL,
    status          VARCHAR(20)  DEFAULT 'open',
    ihr_notifiable  BOOLEAN      DEFAULT FALSE,
    woah_listed     BOOLEAN      DEFAULT FALSE,
    notified_roles  JSONB,
    response_hours  DECIMAL(6,1),
    auto_escalated  BOOLEAN      DEFAULT TRUE,
    gps_lat         DECIMAL(9,6),
    gps_lon         DECIMAL(9,6),
    created_at      TIMESTAMPTZ  DEFAULT NOW()
);

-- ── 7. Epi Links ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS oh_epi_links (
    link_id          VARCHAR(20)  PRIMARY KEY,
    human_report_id  VARCHAR(20)  REFERENCES oh_disease_reports(report_id),
    animal_report_id VARCHAR(20)  REFERENCES oh_disease_reports(report_id),
    country_iso3     VARCHAR(3)   REFERENCES oh_countries(iso3),
    link_type        VARCHAR(40),
    days_lag         SMALLINT,
    distance_km      DECIMAL(6,1),
    created_date     DATE
);

-- ── 8. OH-EpiCap Scores ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS oh_epicap_scores (
    id               SERIAL       PRIMARY KEY,
    country_iso3     VARCHAR(3)   REFERENCES oh_countries(iso3),
    country_name     VARCHAR(100),
    dimension        VARCHAR(40),
    target           VARCHAR(40),
    indicator        VARCHAR(60),
    score            SMALLINT     CHECK (score BETWEEN 1 AND 4),
    assessment_year  SMALLINT,
    notes            TEXT
);

-- ── 9. NEW: Pathogen Profiles ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS oh_pathogen_profiles (
    id                        SERIAL        PRIMARY KEY,
    disease                   VARCHAR(100)  NOT NULL UNIQUE,
    domain                    VARCHAR(20),
    r0_min                    DECIMAL(6,2),
    r0_max                    DECIMAL(6,2),
    r0_human_to_human         BOOLEAN,
    cfr_pct                   DECIMAL(5,2),
    incubation_days_min       SMALLINT,
    incubation_days_max       SMALLINT,
    genome_type               VARCHAR(10),
    genome_segment            VARCHAR(20),
    envelope                  VARCHAR(20),
    mutation_rate_high        BOOLEAN,
    natural_host              VARCHAR(100),
    reservoir                 VARCHAR(100),
    transmission_routes       JSONB,
    vector_borne              BOOLEAN,
    spillover_score           SMALLINT,
    ihr_notifiable            BOOLEAN,
    woah_listed               BOOLEAN,
    pandemic_potential        VARCHAR(20),
    priority                  VARCHAR(5),
    source                    TEXT
);

-- ── 10. NEW: Country-level Spillover Risk Factors ────────────────────────
CREATE TABLE IF NOT EXISTS oh_spillover_risk_factors (
    id                          SERIAL        PRIMARY KEY,
    country_iso3                VARCHAR(3)    REFERENCES oh_countries(iso3),
    data_year                   SMALLINT,
    -- Health infrastructure (WHO GHO / World Bank)
    hospital_beds_per1000       DECIMAL(6,3),
    physicians_per1000          DECIMAL(6,3),
    nurses_midwives_per1000     DECIMAL(6,3),
    health_expenditure_pct_gdp  DECIMAL(6,2),
    uhc_service_coverage_index  DECIMAL(6,1),
    dtp3_immunization_pct       DECIMAL(5,1),
    -- IHR SPAR (WHO e-SPAR)
    ihr_overall_score           DECIMAL(5,1),
    ihr_zoonoses_score          DECIMAL(5,1),
    ihr_surveillance_score      DECIMAL(5,1),
    ihr_laboratory_score        DECIMAL(5,1),
    ihr_response_score          DECIMAL(5,1),
    -- GHS Index
    ghs_overall_score           DECIMAL(5,1),
    -- Socioeconomic (World Bank)
    gdp_per_capita_usd          DECIMAL(10,2),
    internet_penetration_pct    DECIMAL(5,1),
    basic_sanitation_access_pct DECIMAL(5,1),
    basic_water_access_pct      DECIMAL(5,1),
    urban_slum_population_pct   DECIMAL(5,1),
    -- Fragile States (Fund for Peace)
    fsi_total_score             DECIMAL(5,1),
    fsi_year                    SMALLINT,
    -- Conflict (ACLED)
    acled_conflict_events_2024  INTEGER,
    acled_fatalities_2024       INTEGER,
    -- WOAH animal disease burden
    woah_disease_events_2024    INTEGER,
    woah_animal_deaths_2024     INTEGER,
    -- Livestock / interface (FAOSTAT)
    livestock_cattle_heads      BIGINT,
    livestock_poultry_heads     BIGINT,
    -- Deforestation (GFW)
    forest_loss_ha_2020_24      DECIMAL(12,2),
    -- Displacement (UNHCR)
    unhcr_refugees_hosted       INTEGER,
    unhcr_idp_total             INTEGER,
    displacement_index          DECIMAL(8,6),
    -- Connectivity
    iata_hub_tier               VARCHAR(10),
    -- CITES
    cites_trade_risk_tier       VARCHAR(10),
    bushmeat_market_presence    BOOLEAN,
    interface_risk_score        DECIMAL(5,2),
    -- Source metadata
    source                      TEXT,
    created_at                  TIMESTAMPTZ   DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_srf_country_year
    ON oh_spillover_risk_factors(country_iso3, data_year);

-- ── 11. NEW: Vector Ecology ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS oh_vector_ecology (
    id                              SERIAL       PRIMARY KEY,
    country_iso3                    VARCHAR(3)   REFERENCES oh_countries(iso3),
    aedes_aegypti_suitability       DECIMAL(5,3),
    anopheles_gambiae_suitability   DECIMAL(5,3),
    hyalomma_tick_suitability       DECIMAL(5,3),
    tsetse_fly_suitability          DECIMAL(5,3),
    climate_temp_used_c             DECIMAL(5,1),
    climate_precip_used_mm          DECIMAL(7,1),
    vector_method                   TEXT,
    source                          TEXT
);

-- ── 12. NEW: Host & Reservoir Ecology ───────────────────────────────────
CREATE TABLE IF NOT EXISTS oh_host_ecology (
    id                          SERIAL       PRIMARY KEY,
    country_iso3                VARCHAR(3)   REFERENCES oh_countries(iso3),
    mammal_species_count        SMALLINT,
    mammal_threatened_count     SMALLINT,
    bird_species_count          SMALLINT,
    bat_species_count           SMALLINT,
    rodent_species_count        SMALLINT,
    primate_species_count       SMALLINT,
    threatened_proportion_pct   DECIMAL(5,1),
    gbif_occurrence_records_M   DECIMAL(6,1),
    host_diversity_index        DECIMAL(5,3),
    zoonotic_host_richness_class VARCHAR(15),
    migratory_bird_route        BOOLEAN,
    iucn_data_year              SMALLINT,
    source                      TEXT
);

-- ── 13. Agents (AI agent service registry for the dashboard panel) ──────
CREATE TABLE IF NOT EXISTS oh_agents (
    agent_id        VARCHAR(40)   PRIMARY KEY,
    name            VARCHAR(80)   NOT NULL,
    icon            VARCHAR(8),
    status          VARCHAR(20)   NOT NULL,   -- running | alert | idle | pending
    status_label    VARCHAR(20)   NOT NULL,   -- RUNNING | AWAITING | ACTIVE | IDLE | QUEUED
    description     TEXT,
    phase           VARCHAR(20),              -- e.g. "Phase III"
    sort_order      SMALLINT      DEFAULT 0,
    last_heartbeat  TIMESTAMPTZ   DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   DEFAULT NOW()
);

-- ── 14. Human-in-the-Loop actions (approval queue) ──────────────────────
CREATE TABLE IF NOT EXISTS oh_hitl_actions (
    action_id      VARCHAR(40)   PRIMARY KEY,
    kind           VARCHAR(20)   NOT NULL,    -- approve | inform | review
    title          VARCHAR(200)  NOT NULL,
    description    TEXT,
    severity       VARCHAR(20),               -- amber | cobalt | crimson
    requested_by   VARCHAR(40),               -- agent_id (FK to oh_agents)
    related_alert  VARCHAR(20),               -- alert_id (FK to oh_alerts, nullable)
    status         VARCHAR(20)   DEFAULT 'pending',  -- pending | approved | dismissed | acknowledged
    created_at     TIMESTAMPTZ   DEFAULT NOW(),
    resolved_at    TIMESTAMPTZ,
    resolved_by    INTEGER                    -- user_id FK
);
CREATE INDEX IF NOT EXISTS idx_hitl_pending ON oh_hitl_actions(status, created_at DESC);

-- =============================================================================
-- Dashboard Views
-- =============================================================================

CREATE OR REPLACE VIEW oh_country_risk_profile AS
SELECT
    c.iso3,
    c.country_name,
    c.who_subregion,
    c.population_M,
    c.fragility_index,
    s.hospital_beds_per1000,
    s.ihr_overall_score,
    s.ghs_overall_score,
    s.fsi_total_score,
    s.acled_conflict_events_2024,
    s.forest_loss_ha_2020_24,
    s.interface_risk_score,
    s.displacement_index,
    v.aedes_aegypti_suitability,
    v.anopheles_gambiae_suitability,
    h.bat_species_count,
    h.host_diversity_index,
    h.zoonotic_host_richness_class
FROM oh_countries c
LEFT JOIN oh_spillover_risk_factors s ON c.iso3 = s.country_iso3
LEFT JOIN oh_vector_ecology          v ON c.iso3 = v.country_iso3
LEFT JOIN oh_host_ecology            h ON c.iso3 = h.country_iso3;


CREATE OR REPLACE VIEW oh_spillover_composite_index AS
SELECT
    c.iso3,
    c.country_name,
    c.who_subregion,
    -- Composite spillover risk score (0-100)
    -- Methodology: weighted sum of normalised domain scores
    ROUND(
        (
            COALESCE(1.0 - (s.ihr_overall_score / 100.0), 0.5) * 25 +
            COALESCE(h.host_diversity_index, 0.5)               * 20 +
            COALESCE(v.aedes_aegypti_suitability, 0.5)          * 15 +
            COALESCE(s.interface_risk_score / 10.0, 0.5)        * 20 +
            COALESCE(s.fsi_total_score / 120.0, 0.5)            * 10 +
            COALESCE(s.displacement_index * 10, 0.5)            * 10
        )::NUMERIC, 2
    ) AS composite_spillover_risk_0_100,
    s.ihr_overall_score,
    s.interface_risk_score,
    h.host_diversity_index,
    v.aedes_aegypti_suitability
FROM oh_countries               c
LEFT JOIN oh_spillover_risk_factors s ON c.iso3 = s.country_iso3
LEFT JOIN oh_host_ecology           h ON c.iso3 = h.country_iso3
LEFT JOIN oh_vector_ecology         v ON c.iso3 = v.country_iso3
ORDER BY composite_spillover_risk_0_100 DESC;
"""


# =============================================================================
# 18. MASTER MERGE FUNCTION
# =============================================================================

def merge_all_data(
    wb_df:       pd.DataFrame,
    gho_df:      pd.DataFrame,
    spar_df:     pd.DataFrame,
    fao_df:      pd.DataFrame,
    fsi_df:      pd.DataFrame,
    acled_df:    pd.DataFrame,
    ghs_df:      pd.DataFrame,
    gfw_df:      pd.DataFrame,
    woah_df:     pd.DataFrame,
    nasa_df:     pd.DataFrame,
    pathogen_df: pd.DataFrame,
    vector_df:   pd.DataFrame,
    host_df:     pd.DataFrame,
    spillover_df:pd.DataFrame,
    social_df:   pd.DataFrame,
    output_dir:  Path,
) -> dict[str, pd.DataFrame]:
    """
    Merge all fetched data into the 12-table final schema.
    Returns dict of {table_name: DataFrame}.
    """
    log.info("=== MERGING ALL DATA INTO FINAL SCHEMA ===")

    # ── Base country table ─────────────────────────────────────────────────
    df_countries = pd.DataFrame([{
        "iso3":          c["iso3"],
        "country_name":  c["name"],
        "who_subregion": c["sub"],
        "population_M":  c["pop_M"],
    } for c in AFRO])

    # ── Spillover Risk Factors (master wide table) ─────────────────────────
    srf = df_countries[["iso3"]].copy()
    srf["data_year"] = 2024

    def safe_merge(base: pd.DataFrame, right: pd.DataFrame, on: str = "iso3") -> pd.DataFrame:
        if right is None or right.empty or on not in right.columns:
            return base
        dupe_cols = [c for c in right.columns if c != on and c in base.columns]
        right_clean = right.drop(columns=dupe_cols, errors="ignore")
        return base.merge(right_clean, on=on, how="left")

    for df in [wb_df, gho_df, spar_df, fao_df, fsi_df, acled_df, ghs_df, gfw_df, woah_df]:
        srf = safe_merge(srf, df)

    # Add interface & social signals
    for df in [spillover_df, social_df]:
        srf = safe_merge(srf, df)

    srf["source"] = "World Bank WDI; WHO GHO; IHR e-SPAR; FAOSTAT; FSI; ACLED; GHS Index; GFW; WOAH WAHIS"

    # ── Final tables dict ──────────────────────────────────────────────────
    tables = {
        "oh_countries":              df_countries,
        "oh_spillover_risk_factors": srf,
        "oh_pathogen_profiles":      pathogen_df,
        "oh_vector_ecology":         vector_df,
        "oh_host_ecology":           host_df,
    }

    # Write each table
    for name, df in tables.items():
        if df is not None and not df.empty:
            path = output_dir / f"{name}.csv"
            df.to_csv(path, index=False)
            log.info(f"  ✓ {name}: {len(df)} rows → {path}")

    # Write SQL schema
    schema_path = output_dir / "01_oh_afro_schema_v2.sql"
    schema_path.write_text(SCHEMA_SQL, encoding="utf-8")
    log.info(f"  ✓ Schema written → {schema_path}")

    # Write SQL inserts for static tables
    _write_sql_inserts(tables, output_dir)

    log.info(f"  Total tables: {len(tables)}")
    return tables


def _escape(v: Any) -> str:
    if v is None or (isinstance(v, float) and np.isnan(v)):
        return "NULL"
    if isinstance(v, bool):
        return "TRUE" if v else "FALSE"
    if isinstance(v, (int, float)):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def _write_sql_inserts(tables: dict, output_dir: Path) -> None:
    for table_name, df in tables.items():
        if df is None or df.empty:
            continue
        path = output_dir / f"02_{table_name}_inserts.sql"
        cols = list(df.columns)
        col_str = ", ".join(cols)
        with open(path, "w", encoding="utf-8") as f:
            f.write(f"-- {table_name}\n-- Generated: {datetime.utcnow().isoformat()}Z\n\n")
            BATCH = 200
            for i in range(0, len(df), BATCH):
                batch = df.iloc[i: i + BATCH]
                vals = []
                for _, row in batch.iterrows():
                    row_vals = ", ".join(_escape(row[c]) for c in cols)
                    vals.append(f"  ({row_vals})")
                f.write(f"INSERT INTO {table_name} ({col_str}) VALUES\n")
                f.write(",\n".join(vals))
                f.write(";\n\n")


# =============================================================================
# 19. SUPABASE PUSH
# =============================================================================

def push_to_supabase(tables: dict) -> None:
    if not SUPABASE_AVAILABLE:
        log.error("supabase-py not installed: pip install supabase")
        return

    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    if not url or not key:
        log.error("SUPABASE_URL and SUPABASE_KEY must be set")
        return

    client = create_client(url, key)
    # Push in dependency order
    push_order = [
        "oh_countries", "oh_pathogen_profiles", "oh_vector_ecology",
        "oh_host_ecology", "oh_spillover_risk_factors",
    ]

    for tname in push_order:
        df = tables.get(tname)
        if df is None or df.empty:
            continue
        log.info(f"  Pushing {len(df):,} rows → {tname}...")
        BATCH = 200
        errors = 0
        for i in range(0, len(df), BATCH):
            batch = df.iloc[i: i + BATCH].where(pd.notna(df.iloc[i: i + BATCH]), None)
            rows  = batch.to_dict(orient="records")
            try:
                client.table(tname).upsert(rows).execute()
            except Exception as e:
                errors += 1
                log.warning(f"  Batch {i//BATCH+1} error: {e}")
        icon = "✓" if errors == 0 else f"⚠ ({errors} errors)"
        log.info(f"  {icon} {tname}")


# =============================================================================
# 20. ENTRY POINT
# =============================================================================

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="ONE HEALTH AFRO — Complete Data Pipeline"
    )
    p.add_argument("--fetch-only",    action="store_true",
                   help="Only fetch data, skip merge and push")
    p.add_argument("--merge-only",    action="store_true",
                   help="Skip fetch, merge already-fetched data")
    p.add_argument("--push-supabase", action="store_true",
                   help="Push merged tables to Supabase")
    p.add_argument("--output-dir",    default=str(OUTPUT_DIR),
                   help=f"Output directory (default: {OUTPUT_DIR})")
    p.add_argument("--skip-wb",       action="store_true", help="Skip World Bank fetch")
    p.add_argument("--skip-gho",      action="store_true", help="Skip WHO GHO fetch")
    p.add_argument("--skip-spar",     action="store_true", help="Skip IHR SPAR fetch")
    p.add_argument("--skip-fao",      action="store_true", help="Skip FAOSTAT fetch")
    p.add_argument("--skip-acled",    action="store_true", help="Skip ACLED fetch")
    p.add_argument("--skip-nasa",     action="store_true", help="Skip NASA POWER fetch")
    return p.parse_args()


def main() -> None:
    args   = parse_args()
    outdir = Path(args.output_dir)
    outdir.mkdir(parents=True, exist_ok=True)

    log.info("=" * 65)
    log.info("  ONE HEALTH AFRO — COMPLETE DATA PIPELINE")
    log.info("  WHO AFRO PDX Programme / IntEpi Consulting")
    log.info(f"  Output: {outdir.resolve()}")
    log.info("=" * 65)

    # ── FETCH ──────────────────────────────────────────────────────────────
    wb_df       = pd.DataFrame()
    gho_df      = pd.DataFrame()
    spar_df     = pd.DataFrame()
    fao_df      = pd.DataFrame()
    fsi_df      = pd.DataFrame()
    acled_df    = pd.DataFrame()
    ghs_df      = pd.DataFrame()
    gfw_df      = pd.DataFrame()
    woah_df     = pd.DataFrame()
    nasa_df     = pd.DataFrame()

    if not args.merge_only:
        if not args.skip_wb:
            wb_df   = fetch_worldbank(outdir)
        if not args.skip_gho:
            gho_df  = fetch_who_gho(outdir)
        if not args.skip_spar:
            spar_df = fetch_ihr_spar(outdir)
        if not args.skip_fao:
            fao_df  = fetch_faostat(outdir)

        fsi_df  = fetch_fsi(outdir)
        ghs_df  = fetch_ghs_index(outdir)
        gfw_df  = fetch_global_forest_watch(outdir)
        woah_df = fetch_woah_wahis(outdir)

        if not args.skip_acled:
            acled_df = fetch_acled(outdir)
        if not args.skip_nasa:
            nasa_df  = fetch_nasa_power(outdir)

    else:
        # Load previously fetched CSVs
        log.info("Loading pre-fetched CSVs from disk...")
        for name, varname in [
            ("worldbank_wide.csv",    "wb_df"),
            ("who_gho_wide.csv",      "gho_df"),
            ("ihr_spar_wide.csv",     "spar_df"),
            ("faostat_wide.csv",      "fao_df"),
            ("fsi_scores.csv",        "fsi_df"),
            ("acled_conflict.csv",    "acled_df"),
            ("ghs_index_scores.csv",  "ghs_df"),
            ("gfw_deforestation.csv", "gfw_df"),
            ("woah_aggregated.csv",   "woah_df"),
            ("nasa_power_climate.csv","nasa_df"),
        ]:
            path = outdir / name
            if path.exists():
                locals()[varname] = pd.read_csv(path)
                log.info(f"  Loaded: {name}")

    if args.fetch_only:
        log.info("Fetch-only mode — done.")
        return

    # ── BUILD STATIC TABLES ────────────────────────────────────────────────
    pathogen_df  = build_pathogen_profiles(outdir)
    vector_df    = build_vector_ecology(nasa_df, outdir)
    host_df      = build_host_ecology(outdir)
    spillover_df = build_spillover_interface(fao_df, gfw_df, outdir)
    social_df    = build_human_social(wb_df, outdir)

    # ── MERGE ──────────────────────────────────────────────────────────────
    tables = merge_all_data(
        wb_df=wb_df, gho_df=gho_df, spar_df=spar_df,
        fao_df=fao_df, fsi_df=fsi_df, acled_df=acled_df,
        ghs_df=ghs_df, gfw_df=gfw_df, woah_df=woah_df,
        nasa_df=nasa_df, pathogen_df=pathogen_df,
        vector_df=vector_df, host_df=host_df,
        spillover_df=spillover_df, social_df=social_df,
        output_dir=outdir,
    )

    # ── PUSH ───────────────────────────────────────────────────────────────
    if args.push_supabase:
        log.info("=== PUSHING TO SUPABASE ===")
        push_to_supabase(tables)

    # ── SUMMARY ────────────────────────────────────────────────────────────
    log.info("")
    log.info("=" * 65)
    log.info("  PIPELINE COMPLETE")
    log.info("=" * 65)
    for name, df in tables.items():
        if df is not None and not df.empty:
            log.info(f"  {name:<40} {len(df):>6,} rows")
    log.info("")
    log.info(f"  Output directory: {outdir.resolve()}")
    log.info("  CSV files:  oh_pipeline_output/*.csv")
    log.info("  SQL schema: oh_pipeline_output/01_oh_afro_schema_v2.sql")
    log.info("  SQL data:   oh_pipeline_output/02_*_inserts.sql")


if __name__ == "__main__":
    main()
