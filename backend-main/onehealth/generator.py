"""
=============================================================================
ONE HEALTH SYNTHETIC DATA GENERATOR — WHO AFRO 47 MEMBER STATES
=============================================================================
Purpose : Generate realistic, epidemiologically coherent synthetic One Health
          data covering human health, animal health, and environmental domains
          for all 47 WHO AFRO Member States.

Output  : PostgreSQL / Supabase-ready tables (CSV + SQL INSERT batches)
          with referential integrity across all 8 core tables.

Domains : Human Health  → disease cases, outbreaks, IHR alerts, AMR, vaccination
          Animal Health → livestock events, wildlife mortality, zoonotic detections
          Environment   → climate indicators, land-use, NDVI, risk flags
          Integrated    → alerts (tiered 1–4), epi-links, OH-EpiCap scores

Usage   :
    python oh_afro_generator.py                     # write CSVs + SQL to ./output/
    python oh_afro_generator.py --push-supabase      # also push to Supabase
    python oh_afro_generator.py --years 3            # generate 3 years of data
    python oh_afro_generator.py --seed 99            # reproducible seed

Author  : IntEpi Consulting / WHO AFRO PDX Programme
Date    : March 2026
=============================================================================
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import os
import random
import sys
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from faker import Faker

# ── Optional Supabase push ────────────────────────────────────────────────────
try:
    from supabase import create_client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False

# ── Optional .env loading ─────────────────────────────────────────────────────
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# =============================================================================
# 1. CONFIGURATION
# =============================================================================

DEFAULT_SEED        = 42
DEFAULT_YEARS       = 2          # years of historical data to generate
RECORDS_PER_COUNTRY = 120        # disease reports per country per year (base)
OUTPUT_DIR          = Path(__file__).resolve().parents[3] / "data" / "onehealth"

# ── 47 WHO AFRO Member States with geographic and epidemiological metadata ────
AFRO_COUNTRIES: list[dict] = [
    # (iso3, name, subregion, pop_millions, disease_burden_weight,
    #  lat_centroid, lon_centroid, climate_zone, fragility_index)
    # disease_burden_weight: 1.0=average, >1.0=higher burden, <1.0=lower burden
    # fragility_index: 0–10 (10=most fragile, affects data completeness simulation)

    {"iso3":"AGO","name":"Angola",           "sub":"Central Africa",  "pop":35.6,  "w":1.3,"lat":-11.20,"lon": 17.87,"climate":"tropical_savanna","fragility":6},
    {"iso3":"BEN","name":"Benin",             "sub":"West Africa",     "pop": 13.7, "w":1.1,"lat":  9.31,"lon":  2.32,"climate":"tropical_wet_dry", "fragility":4},
    {"iso3":"BWA","name":"Botswana",          "sub":"Southern Africa", "pop":  2.6, "w":0.8,"lat":-22.33,"lon": 24.68,"climate":"semi_arid",        "fragility":2},
    {"iso3":"BFA","name":"Burkina Faso",      "sub":"West Africa",     "pop": 22.7, "w":1.4,"lat": 12.36,"lon": -1.53,"climate":"semi_arid",        "fragility":7},
    {"iso3":"BDI","name":"Burundi",           "sub":"East Africa",     "pop": 13.2, "w":1.6,"lat": -3.37,"lon": 29.92,"climate":"tropical_highland","fragility":8},
    {"iso3":"CPV","name":"Cabo Verde",        "sub":"West Africa",     "pop":  0.6, "w":0.5,"lat": 16.00,"lon":-24.01,"climate":"semi_arid",        "fragility":1},
    {"iso3":"CMR","name":"Cameroon",          "sub":"Central Africa",  "pop": 28.0, "w":1.2,"lat":  3.86,"lon": 11.52,"climate":"tropical_wet",     "fragility":5},
    {"iso3":"CAF","name":"Central African Republic","sub":"Central Africa","pop": 5.5,"w":1.8,"lat":  6.61,"lon": 20.94,"climate":"tropical_wet",  "fragility":9},
    {"iso3":"TCD","name":"Chad",              "sub":"Central Africa",  "pop": 18.3, "w":1.7,"lat": 15.45,"lon": 18.73,"climate":"semi_arid",        "fragility":9},
    {"iso3":"COM","name":"Comoros",           "sub":"East Africa",     "pop":  0.9, "w":1.0,"lat":-11.64,"lon": 43.33,"climate":"tropical_wet",     "fragility":5},
    {"iso3":"COD","name":"Dem. Rep. of Congo","sub":"Central Africa",  "pop": 99.0, "w":2.0,"lat": -4.03,"lon": 21.75,"climate":"tropical_wet",     "fragility":9},
    {"iso3":"COG","name":"Republic of Congo", "sub":"Central Africa",  "pop":  5.8, "w":1.2,"lat": -0.23,"lon": 15.83,"climate":"tropical_wet",     "fragility":6},
    {"iso3":"CIV","name":"Côte d'Ivoire",     "sub":"West Africa",     "pop": 27.5, "w":1.1,"lat":  7.54,"lon": -5.55,"climate":"tropical_wet_dry", "fragility":5},
    {"iso3":"GNQ","name":"Equatorial Guinea", "sub":"Central Africa",  "pop":  1.5, "w":0.9,"lat":  1.65,"lon": 10.27,"climate":"tropical_wet",     "fragility":5},
    {"iso3":"ERI","name":"Eritrea",           "sub":"East Africa",     "pop":  3.5, "w":1.3,"lat": 15.18,"lon": 39.78,"climate":"semi_arid",        "fragility":8},
    {"iso3":"SWZ","name":"Eswatini",          "sub":"Southern Africa", "pop":  1.2, "w":1.0,"lat":-26.52,"lon": 31.47,"climate":"tropical_savanna","fragility":3},
    {"iso3":"ETH","name":"Ethiopia",          "sub":"East Africa",     "pop":126.5, "w":1.5,"lat":  9.15,"lon": 40.49,"climate":"tropical_highland","fragility":7},
    {"iso3":"GAB","name":"Gabon",             "sub":"Central Africa",  "pop":  2.3, "w":0.8,"lat": -0.80,"lon": 11.61,"climate":"tropical_wet",     "fragility":3},
    {"iso3":"GMB","name":"Gambia",            "sub":"West Africa",     "pop":  2.7, "w":1.2,"lat": 13.44,"lon":-15.31,"climate":"tropical_wet_dry", "fragility":5},
    {"iso3":"GHA","name":"Ghana",             "sub":"West Africa",     "pop": 33.5, "w":1.0,"lat":  7.95,"lon": -1.02,"climate":"tropical_wet_dry", "fragility":3},
    {"iso3":"GIN","name":"Guinea",            "sub":"West Africa",     "pop": 13.5, "w":1.5,"lat": 10.99,"lon":-10.91,"climate":"tropical_wet",     "fragility":7},
    {"iso3":"GNB","name":"Guinea-Bissau",     "sub":"West Africa",     "pop":  2.1, "w":1.4,"lat": 11.80,"lon":-15.18,"climate":"tropical_wet",     "fragility":8},
    {"iso3":"KEN","name":"Kenya",             "sub":"East Africa",     "pop": 54.0, "w":1.1,"lat": -0.02,"lon": 37.91,"climate":"tropical_savanna","fragility":4},
    {"iso3":"LSO","name":"Lesotho",           "sub":"Southern Africa", "pop":  2.2, "w":1.1,"lat":-29.61,"lon": 28.23,"climate":"highland",         "fragility":4},
    {"iso3":"LBR","name":"Liberia",           "sub":"West Africa",     "pop":  5.3, "w":1.6,"lat":  6.43,"lon": -9.43,"climate":"tropical_wet",     "fragility":8},
    {"iso3":"MDG","name":"Madagascar",        "sub":"Southern Africa", "pop": 28.9, "w":1.3,"lat":-18.77,"lon": 46.87,"climate":"tropical_wet",     "fragility":6},
    {"iso3":"MWI","name":"Malawi",            "sub":"Southern Africa", "pop": 20.9, "w":1.3,"lat":-13.25,"lon": 34.30,"climate":"tropical_wet_dry", "fragility":5},
    {"iso3":"MLI","name":"Mali",              "sub":"West Africa",     "pop": 22.7, "w":1.5,"lat": 17.57,"lon": -4.00,"climate":"semi_arid",        "fragility":8},
    {"iso3":"MRT","name":"Mauritania",        "sub":"West Africa",     "pop":  4.7, "w":1.0,"lat": 21.01,"lon":-10.94,"climate":"arid",             "fragility":6},
    {"iso3":"MUS","name":"Mauritius",         "sub":"Southern Africa", "pop":  1.3, "w":0.4,"lat":-20.28,"lon": 57.55,"climate":"subtropical",      "fragility":1},
    {"iso3":"MOZ","name":"Mozambique",        "sub":"Southern Africa", "pop": 33.0, "w":1.4,"lat":-17.27,"lon": 35.55,"climate":"tropical_savanna","fragility":7},
    {"iso3":"NAM","name":"Namibia",           "sub":"Southern Africa", "pop":  2.6, "w":0.7,"lat":-22.96,"lon": 18.49,"climate":"arid",             "fragility":2},
    {"iso3":"NER","name":"Niger",             "sub":"West Africa",     "pop": 25.1, "w":1.6,"lat": 17.61,"lon":  8.08,"climate":"semi_arid",        "fragility":8},
    {"iso3":"NGA","name":"Nigeria",           "sub":"West Africa",     "pop":218.5, "w":1.4,"lat":  9.08,"lon":  8.68,"climate":"tropical_wet_dry", "fragility":7},
    {"iso3":"RWA","name":"Rwanda",            "sub":"East Africa",     "pop": 13.9, "w":1.0,"lat": -1.94,"lon": 29.87,"climate":"tropical_highland","fragility":4},
    {"iso3":"STP","name":"São Tomé & Príncipe","sub":"Central Africa", "pop":  0.2, "w":0.8,"lat":  0.18,"lon":  6.61,"climate":"tropical_wet",     "fragility":3},
    {"iso3":"SEN","name":"Senegal",           "sub":"West Africa",     "pop": 17.2, "w":1.0,"lat": 14.50,"lon":-14.45,"climate":"semi_arid",        "fragility":3},
    {"iso3":"SLE","name":"Sierra Leone",      "sub":"West Africa",     "pop":  8.4, "w":1.6,"lat":  8.46,"lon":-11.78,"climate":"tropical_wet",     "fragility":7},
    {"iso3":"SOM","name":"Somalia",           "sub":"East Africa",     "pop": 17.1, "w":2.0,"lat":  5.15,"lon": 46.20,"climate":"arid",             "fragility":10},
    {"iso3":"ZAF","name":"South Africa",      "sub":"Southern Africa", "pop": 60.1, "w":0.7,"lat":-30.56,"lon": 22.94,"climate":"subtropical",      "fragility":2},
    {"iso3":"SSD","name":"South Sudan",       "sub":"East Africa",     "pop": 11.1, "w":2.0,"lat":  6.88,"lon": 31.31,"climate":"tropical_savanna","fragility":10},
    {"iso3":"TZA","name":"Tanzania",          "sub":"East Africa",     "pop": 63.3, "w":1.2,"lat": -6.37,"lon": 34.89,"climate":"tropical_savanna","fragility":4},
    {"iso3":"TGO","name":"Togo",              "sub":"West Africa",     "pop":  8.7, "w":1.1,"lat":  8.62,"lon":  0.82,"climate":"tropical_wet_dry", "fragility":5},
    {"iso3":"UGA","name":"Uganda",            "sub":"East Africa",     "pop": 47.2, "w":1.2,"lat":  1.37,"lon": 32.29,"climate":"tropical_wet",     "fragility":5},
    {"iso3":"ZMB","name":"Zambia",            "sub":"Southern Africa", "pop": 19.5, "w":1.1,"lat":-13.13,"lon": 27.85,"climate":"tropical_savanna","fragility":5},
    {"iso3":"ZWE","name":"Zimbabwe",          "sub":"Southern Africa", "pop": 15.9, "w":1.2,"lat":-19.02,"lon": 29.15,"climate":"tropical_savanna","fragility":6},
]

# ── One Health disease catalogue ──────────────────────────────────────────────
# Each entry: name, domain, IHR_notifiable, WOAH_listed, primary_host,
#             base_case_rate (per 100k per year), fatality_rate, seasonality_peak (month)
DISEASES: list[dict] = [
    # Zoonotic (human + animal)
    {"name":"Highly Pathogenic Avian Influenza (H5N1)", "domain":"zoonotic","ihr":True, "woah":True, "host":"poultry_wild_birds","base_rate":0.8, "cfr":0.55,"season":2,"priority":"P1"},
    {"name":"Mpox",                    "domain":"zoonotic","ihr":True, "woah":False,"host":"rodents_primates",  "base_rate":3.2, "cfr":0.04,"season":7,"priority":"P1"},
    {"name":"Ebola Virus Disease",     "domain":"zoonotic","ihr":True, "woah":False,"host":"bats_primates",    "base_rate":0.3, "cfr":0.50,"season":4,"priority":"P1"},
    {"name":"Rift Valley Fever",       "domain":"zoonotic","ihr":True, "woah":True, "host":"cattle_sheep",     "base_rate":1.1, "cfr":0.01,"season":4,"priority":"P1"},
    {"name":"Rabies",                  "domain":"zoonotic","ihr":False,"woah":True, "host":"dogs_wildlife",    "base_rate":0.5, "cfr":0.99,"season":0,"priority":"P2"},
    {"name":"Brucellosis",             "domain":"zoonotic","ihr":False,"woah":True, "host":"cattle_goats",     "base_rate":2.4, "cfr":0.005,"season":5,"priority":"P2"},
    {"name":"Anthrax",                 "domain":"zoonotic","ihr":False,"woah":True, "host":"cattle_wildlife",  "base_rate":0.4, "cfr":0.20,"season":8,"priority":"P2"},
    {"name":"Leptospirosis",           "domain":"zoonotic","ihr":False,"woah":False,"host":"rodents_cattle",   "base_rate":4.2, "cfr":0.10,"season":4,"priority":"P2"},
    {"name":"Crimean-Congo HF",        "domain":"zoonotic","ihr":True, "woah":True, "host":"cattle_ticks",     "base_rate":0.6, "cfr":0.30,"season":6,"priority":"P1"},
    {"name":"Plague",                  "domain":"zoonotic","ihr":True, "woah":False,"host":"rodents_fleas",    "base_rate":0.2, "cfr":0.30,"season":11,"priority":"P1"},
    {"name":"Q Fever",                 "domain":"zoonotic","ihr":False,"woah":False,"host":"sheep_goats",      "base_rate":1.8, "cfr":0.01,"season":3,"priority":"P2"},
    {"name":"Trypanosomiasis (HAT)",   "domain":"zoonotic","ihr":False,"woah":True, "host":"cattle_wildlife",  "base_rate":0.9, "cfr":0.15,"season":0,"priority":"P2"},
    # Animal-specific
    {"name":"Foot and Mouth Disease",  "domain":"animal", "ihr":False,"woah":True, "host":"cattle_pigs",      "base_rate":0.0, "cfr":0.02,"season":0,"priority":"P2"},
    {"name":"Newcastle Disease",       "domain":"animal", "ihr":False,"woah":True, "host":"poultry",          "base_rate":0.0, "cfr":0.40,"season":2,"priority":"P2"},
    {"name":"African Swine Fever",     "domain":"animal", "ihr":False,"woah":True, "host":"pigs_warthogs",    "base_rate":0.0, "cfr":0.90,"season":0,"priority":"P1"},
    {"name":"African Horse Sickness",  "domain":"animal", "ihr":False,"woah":True, "host":"horses_mules",     "base_rate":0.0, "cfr":0.70,"season":3,"priority":"P2"},
    # Vector-borne
    {"name":"Yellow Fever",            "domain":"vector", "ihr":True, "woah":False,"host":"primates_mosquito","base_rate":1.5, "cfr":0.20,"season":4,"priority":"P1"},
    {"name":"Dengue",                  "domain":"vector", "ihr":False,"woah":False,"host":"humans_mosquito",  "base_rate":6.0, "cfr":0.01,"season":4,"priority":"P2"},
    {"name":"Malaria",                 "domain":"vector", "ihr":False,"woah":False,"host":"humans_mosquito",  "base_rate":80.0,"cfr":0.005,"season":4,"priority":"P2"},
    # Human-primary with environmental nexus
    {"name":"Cholera",                 "domain":"environmental","ihr":True,"woah":False,"host":"humans_water","base_rate":12.0,"cfr":0.02,"season":4,"priority":"P1"},
    {"name":"Typhoid Fever",           "domain":"environmental","ihr":False,"woah":False,"host":"humans_water","base_rate":22.0,"cfr":0.01,"season":0,"priority":"P2"},
    {"name":"Meningococcal Disease",   "domain":"environmental","ihr":True, "woah":False,"host":"humans_dust", "base_rate":3.0, "cfr":0.10,"season":3,"priority":"P1"},
    # AMR
    {"name":"Drug-Resistant Typhoid",  "domain":"amr",    "ihr":False,"woah":False,"host":"humans_food_water","base_rate":5.0,"cfr":0.02,"season":0,"priority":"P2"},
    {"name":"ESBL-producing E. coli",  "domain":"amr",    "ihr":False,"woah":False,"host":"humans_animals_water","base_rate":8.0,"cfr":0.03,"season":0,"priority":"P2"},
]

# ── Admin units (districts) per country — simplified synthetic ────────────────
DISTRICT_TEMPLATES: list[str] = [
    "North {c}", "South {c}", "East {c}", "West {c}", "Central {c}",
    "{c} Capital", "{c} Coast", "{c} Highland", "{c} Valley", "{c} Lake Region",
    "Upper {c}", "Lower {c}", "Greater {c}", "Inner {c}", "Outer {c}",
]

# ── Animal species pools by region ───────────────────────────────────────────
LIVESTOCK_SPECIES: dict[str, list] = {
    "West Africa":    ["cattle","goat","sheep","chicken","duck","pig"],
    "East Africa":    ["cattle","goat","camel","chicken","sheep","donkey"],
    "Central Africa": ["cattle","pig","chicken","goat","sheep","duck"],
    "Southern Africa":["cattle","sheep","goat","chicken","pig","horse"],
}

# ── Clinical sign pools ───────────────────────────────────────────────────────
ANIMAL_CLINICAL_SIGNS: list[str] = [
    "sudden_death","respiratory_distress","neurological_signs",
    "vesicular_lesions","hemorrhagic_signs","abortions",
    "decreased_milk_production","lameness","diarrhea","fever",
    "skin_lesions","lymphadenopathy","anorexia",
]
HUMAN_SYMPTOMS: list[str] = [
    "fever","cough","respiratory_distress","hemorrhagic_signs",
    "rash","jaundice","vomiting","diarrhea","headache",
    "altered_consciousness","conjunctivitis","lymphadenopathy",
    "myalgia","fatigue","abdominal_pain",
]

# ── OH-EpiCap indicator dimensions ───────────────────────────────────────────
EPICAP_DIMENSIONS: dict = {
    "D1_Organization": {
        "T1.1_Formalization":   ["formal_agreements","legal_mandate","coordination_mechanism","budget_allocation"],
        "T1.2_Resources":       ["dedicated_oh_staff","lab_infrastructure","data_systems","training_budget"],
        "T1.3_Capacities":      ["epidemiology_capacity","vet_capacity","env_capacity","joint_training"],
        "T1.4_Dissemination":   ["data_sharing_agreements","joint_reports","cross_sector_meetings","public_communication"],
    },
    "D2_Operations": {
        "T2.1_DataSharing":     ["interoperable_databases","shared_case_definitions","data_harmonization","joint_analysis"],
        "T2.2_Laboratory":      ["shared_lab_protocols","cross_referral","joint_confirmations","biosafety"],
        "T2.3_Surveillance":    ["joint_investigations","unified_reporting_forms","sentinel_sites","integrated_alerts"],
        "T2.4_Preparedness":    ["joint_response_plans","cross_sector_simex","stockpile_sharing","joint_rrts"],
    },
    "D3_Impact": {
        "T3.1_Detection":       ["earlier_detection","zoonotic_attribution","cluster_identification","amr_detection"],
        "T3.2_Response":        ["coordinated_response","outbreak_containment","resource_mobilization","cross_border"],
        "T3.3_Communication":   ["policy_briefs","media_communication","community_engagement","who_reporting"],
        "T3.4_PolicyChange":    ["oh_policy_adopted","budget_change","regulatory_change","programme_change"],
    },
}


# =============================================================================
# 2. UTILITY FUNCTIONS
# =============================================================================

def short_id(prefix: str, n: int = 8) -> str:
    """Generate a deterministic-looking short ID."""
    return f"{prefix}-{uuid.uuid4().hex[:n].upper()}"


def jitter(value: float, pct: float = 0.15) -> float:
    """Add random percentage noise to a value."""
    return value * (1 + random.uniform(-pct, pct))


def seasonal_multiplier(month: int, peak_month: int, amplitude: float = 0.6) -> float:
    """
    Return a multiplier based on sinusoidal seasonality.
    peak_month=0 means no seasonality (flat = 1.0).
    """
    if peak_month == 0:
        return 1.0
    delta = abs(month - peak_month)
    if delta > 6:
        delta = 12 - delta
    return 1.0 + amplitude * math.cos(math.pi * delta / 6)


def clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def weighted_choice(items: list, weights: list) -> Any:
    total = sum(weights)
    r = random.random() * total
    cumulative = 0.0
    for item, w in zip(items, weights):
        cumulative += w
        if r <= cumulative:
            return item
    return items[-1]


def get_districts(country_name: str, n: int = 8) -> list[str]:
    short = country_name.split()[0][:6]
    templates = DISTRICT_TEMPLATES[:n]
    return [t.replace("{c}", short) for t in templates]


def lat_lon_jitter(base_lat: float, base_lon: float,
                   radius_deg: float = 2.5) -> tuple[float, float]:
    """Generate a GPS point within radius_deg of the centroid."""
    dlat = random.uniform(-radius_deg, radius_deg)
    dlon = random.uniform(-radius_deg, radius_deg)
    return round(base_lat + dlat, 6), round(base_lon + dlon, 6)


# =============================================================================
# 3. CLIMATE & ENVIRONMENT GENERATORS
# =============================================================================

def generate_climate_profile(country: dict, record_date: date) -> dict:
    """
    Realistic climate values based on climate zone and month.
    Sources mimic what NASA POWER API would return.
    """
    month      = record_date.month
    clim       = country["climate"]
    lat        = country["lat"]
    base_lat   = abs(lat)

    # Base temperature by climate zone
    temp_bases = {
        "tropical_wet":      28, "tropical_wet_dry":  27, "tropical_savanna": 26,
        "tropical_highland": 18, "semi_arid":         30, "arid":             33,
        "subtropical":       20, "highland":          15,
    }
    base_temp = temp_bases.get(clim, 25)

    # Seasonal temperature variation (cooler southern hemisphere winter = Jul/Aug)
    if lat < 0:  # southern hemisphere
        temp_var = 4.0 * math.cos(math.pi * (month - 1) / 6)
    else:
        temp_var = 4.0 * math.cos(math.pi * (month - 7) / 6)

    temp_mean = round(jitter(base_temp + temp_var, 0.05), 1)
    temp_max  = round(temp_mean + random.uniform(4, 8), 1)
    temp_min  = round(temp_mean - random.uniform(4, 8), 1)

    # Precipitation by climate zone and season
    precip_bases = {
        "tropical_wet": 200, "tropical_wet_dry": 80, "tropical_savanna": 60,
        "tropical_highland": 100, "semi_arid": 30, "arid": 5,
        "subtropical": 50, "highland": 70,
    }
    base_precip = precip_bases.get(clim, 60)
    # Rainy season peak: April–June for West/Central, March–May for East
    precip_peak = 4 if "west" in country["sub"].lower() or "central" in country["sub"].lower() else 4
    precip_mult = seasonal_multiplier(month, precip_peak, amplitude=1.2)
    precipitation = round(max(0, jitter(base_precip * precip_mult, 0.30)), 1)

    humidity = clamp(round(40 + (precipitation / base_precip) * 35 + random.uniform(-8, 8), 1), 20, 98)

    # NDVI: vegetation index 0–1 (correlated with rain)
    ndvi = round(clamp(0.15 + (precipitation / 250) + random.uniform(-0.05, 0.05), 0.05, 0.90), 3)

    # Migratory bird season: Oct–Mar in most of Africa
    mig_birds = month in [10, 11, 12, 1, 2, 3]

    # Flood risk: high precipitation + low elevation proxy
    flood_risk = precipitation > 120 and clim in ["tropical_wet", "tropical_wet_dry", "tropical_savanna"]

    # Drought risk
    drought_risk = precipitation < 10 and clim in ["arid", "semi_arid"]

    return {
        "temp_max_c":              temp_max,
        "temp_min_c":              temp_min,
        "temp_mean_c":             temp_mean,
        "precipitation_mm":        precipitation,
        "humidity_pct":            humidity,
        "wind_speed_ms":           round(random.uniform(1.5, 8.5), 1),
        "ndvi":                    ndvi,
        "migratory_bird_season":   mig_birds,
        "flood_risk_flag":         flood_risk,
        "drought_risk_flag":       drought_risk,
        "land_use":                random.choice(["mixed_agriculture_livestock",
                                                   "dense_forest","savanna",
                                                   "peri_urban","irrigated_agriculture",
                                                   "arid_rangeland"]),
        "deforestation_alert":     random.random() < 0.08,
        "water_body_proximity_km": round(random.uniform(0.5, 45.0), 1),
        "dust_season":             month in [11, 12, 1, 2, 3] and clim in ["semi_arid","arid"],
    }


# =============================================================================
# 4. DISEASE REPORT GENERATOR
# =============================================================================

def expected_cases(disease: dict, country: dict, record_date: date) -> int:
    """
    Calculate expected case count using:
      base_rate × country_weight × population × seasonal_multiplier
    Returns an integer drawn from a Negative Binomial distribution
    to simulate over-dispersed count data (as seen in real epi data).
    """
    if disease["domain"] == "animal":
        return 0  # handled separately in animal events

    pop100k   = country["pop"] * 10          # pop in millions → per 100k units
    base      = disease["base_rate"] * country["w"] * pop100k / 365
    seasonal  = seasonal_multiplier(record_date.month, disease.get("season", 0))
    mu        = base * seasonal

    if mu <= 0:
        return 0
    # Negative binomial: mean=mu, overdispersion r=2
    r = 2.0
    p = r / (r + mu)
    return int(np.random.negative_binomial(r, p))


def generate_human_case_record(
    country: dict,
    disease: dict,
    record_date: date,
    district: str,
    report_id: str,
) -> dict:
    """Generate a single human disease case record."""
    age_group_weights = [0.15, 0.20, 0.30, 0.20, 0.10, 0.05]
    age_groups        = ["0-4","5-14","15-29","30-44","45-59","60+"]
    age_group         = weighted_choice(age_groups, age_group_weights)
    sex               = random.choice(["M", "F"])

    # Hospitalization: higher for severe diseases
    hosp_prob = clamp(disease["cfr"] * 8, 0.05, 0.90)
    hospitalized = random.random() < hosp_prob

    # Outcome
    if random.random() < disease["cfr"]:
        outcome = "died"
    elif random.random() < 0.15:
        outcome = "under_observation"
    else:
        outcome = "recovered"

    # Sample collection
    sample_collected = random.random() < (0.85 - country["fragility"] * 0.05)

    return {
        "report_id":       report_id,
        "onset_date":      (record_date - timedelta(days=random.randint(0, 7))).isoformat(),
        "age_group":       age_group,
        "sex":             sex,
        "occupation":      random.choice(["farmer","healthcare_worker","student",
                                          "trader","pastoralist","unknown"]),
        "animal_contact":  disease["domain"] == "zoonotic" and random.random() < 0.70,
        "symptoms":        json.dumps(random.sample(HUMAN_SYMPTOMS, k=random.randint(2, 5))),
        "hospitalized":    hospitalized,
        "outcome":         outcome,
        "sample_collected":sample_collected,
        "lab_confirmed":   sample_collected and random.random() < 0.60,
    }


# =============================================================================
# 5. ANIMAL EVENT GENERATOR
# =============================================================================

def generate_animal_event(
    country: dict,
    disease: dict,
    record_date: date,
    district: str,
    report_id: str,
) -> dict | None:
    """Generate an animal health event record. Returns None if not applicable."""
    if disease["domain"] not in ("zoonotic", "animal"):
        return None

    sub_region = country["sub"]
    species_pool = LIVESTOCK_SPECIES.get(sub_region, ["cattle", "goat", "chicken"])

    # Match host species to disease
    host_hint = disease.get("host", "").split("_")[0]
    if host_hint in species_pool:
        species = host_hint
    elif host_hint == "poultry":
        species = random.choice([s for s in species_pool if s in ("chicken","duck","turkey")] or ["chicken"])
    elif host_hint == "pigs":
        species = "pig" if "pig" in species_pool else random.choice(species_pool)
    else:
        species = random.choice(species_pool)

    # Realistic flock/herd sizes
    flock_size_ranges = {
        "chicken": (200, 5000), "duck": (50, 800), "cattle": (15, 300),
        "goat":    (20, 200),   "sheep":(20, 300), "pig":    (10, 150),
        "camel":   (5,  80),    "horse":(2,  40),  "donkey": (2, 30),
    }
    lo, hi = flock_size_ranges.get(species, (20, 500))
    flock_size = random.randint(lo, hi)

    # Mortality rate drawn from Beta distribution around disease CFR
    mort_rate  = np.random.beta(2, max(1, int(10 * (1 - disease["cfr"]))))
    mort_rate  = clamp(mort_rate, 0.0, 0.95)
    animals_dead = int(flock_size * mort_rate)
    animals_sick = int(flock_size * clamp(mort_rate * random.uniform(2, 5), 0, 1))
    animals_sick = min(animals_sick, flock_size)

    # Human exposure probability
    human_exposure = disease["domain"] == "zoonotic" and random.random() < 0.45
    humans_exposed = random.randint(1, 8) if human_exposure else 0

    # Clinical signs
    n_signs = random.randint(2, 5)
    signs   = random.sample(ANIMAL_CLINICAL_SIGNS, k=n_signs)

    return {
        "report_id":        report_id,
        "species":          species,
        "flock_size":       flock_size,
        "animals_sick":     animals_sick,
        "animals_dead":     animals_dead,
        "mortality_pct":    round((animals_dead / flock_size) * 100, 2) if flock_size else 0,
        "onset_date":       (record_date - timedelta(days=random.randint(0, 5))).isoformat(),
        "clinical_signs":   json.dumps(signs),
        "human_exposure":   human_exposure,
        "humans_exposed":   humans_exposed,
        "woah_notified":    disease["woah"] and random.random() < 0.70,
        "lab_confirmed":    random.random() < (0.50 - country["fragility"] * 0.04),
    }


# =============================================================================
# 6. ALERT TIER ENGINE
# =============================================================================

def compute_alert_tier(
    disease: dict,
    human_case: dict | None,
    animal_event: dict | None,
    country: dict,
) -> int:
    """
    Reproduce OHTK-style tier logic.
    Returns 0 (no alert) through 4 (highest).
    """
    tier = 0

    # Tier 1: Any animal death or suspected case
    if animal_event and animal_event["animals_dead"] > 0:
        tier = max(tier, 1)
    if human_case:
        tier = max(tier, 1)

    # Tier 2: High animal mortality OR human exposure
    if animal_event:
        if animal_event["mortality_pct"] >= 20:
            tier = max(tier, 2)
        if animal_event["human_exposure"]:
            tier = max(tier, 2)

    # Tier 3: IHR-notifiable disease with confirmed case
    if disease["ihr"] and human_case and human_case.get("lab_confirmed"):
        tier = max(tier, 3)
    if disease["domain"] == "animal" and animal_event and animal_event.get("woah_notified"):
        tier = max(tier, 3)

    # Tier 4: High CFR disease + deaths + human cluster signal
    high_cfr_diseases = {"Ebola Virus Disease","Highly Pathogenic Avian Influenza (H5N1)",
                         "Crimean-Congo HF","African Swine Fever","Plague"}
    if disease["name"] in high_cfr_diseases:
        if human_case and human_case["outcome"] == "died":
            tier = max(tier, 4)
        if animal_event and animal_event["mortality_pct"] >= 50 and animal_event["human_exposure"]:
            tier = max(tier, 4)

    # Fragile states: simulate under-reporting → downgrade tier occasionally
    if country["fragility"] >= 8 and random.random() < 0.25:
        tier = max(0, tier - 1)

    return tier


# =============================================================================
# 7. OH-EPICAP SCORE GENERATOR
# =============================================================================

def generate_epicap_scores(country: dict) -> list[dict]:
    """
    Generate OH-EpiCap scores (1–4) for all 48 indicators per country.
    Scores are correlated with:
      - fragility_index (higher fragility → lower scores)
      - sub-region (Eastern/Southern Africa tend to score higher)
      - country-specific random variation
    """
    fragility   = country["fragility"]
    region_bonus = {
        "Southern Africa": 0.6, "East Africa": 0.3,
        "West Africa": 0.1,     "Central Africa": -0.2,
    }.get(country["sub"], 0.0)

    # Base OH score 1–4 for this country (lower fragility = higher base)
    base_score = clamp(4.0 - (fragility / 4.0) + region_bonus, 1.0, 4.0)

    rows = []
    for dim_key, targets in EPICAP_DIMENSIONS.items():
        for target_key, indicators in targets.items():
            for indicator in indicators:
                # Draw score from truncated normal around base_score
                raw  = np.random.normal(base_score, 0.7)
                score = int(clamp(round(raw), 1, 4))
                rows.append({
                    "country_iso3":  country["iso3"],
                    "country_name":  country["name"],
                    "dimension":     dim_key,
                    "target":        target_key,
                    "indicator":     indicator,
                    "score":         score,
                    "assessment_year": 2025,
                    "notes":         "",
                })
    return rows


# =============================================================================
# 8. MAIN GENERATION PIPELINE
# =============================================================================

def generate_all(seed: int, years: int) -> dict[str, list[dict]]:
    """
    Master function: generates all 8 tables as lists of dicts.
    Returns:
        {
          "countries":        [...],
          "disease_reports":  [...],
          "human_cases":      [...],
          "animal_events":    [...],
          "env_observations": [...],
          "alerts":           [...],
          "epi_links":        [...],
          "epicap_scores":    [...],
        }
    """
    random.seed(seed)
    np.random.seed(seed)
    faker = Faker()
    Faker.seed(seed)

    tables: dict[str, list] = {
        "countries":        [],
        "disease_reports":  [],
        "human_cases":      [],
        "animal_events":    [],
        "env_observations": [],
        "alerts":           [],
        "epi_links":        [],
        "epicap_scores":    [],
    }

    # ── Table: countries ────────────────────────────────────────────────────
    for c in AFRO_COUNTRIES:
        tables["countries"].append({
            "iso3":             c["iso3"],
            "country_name":     c["name"],
            "who_subregion":    c["sub"],
            "population_M":     c["pop"],
            "disease_burden_w": c["w"],
            "lat_centroid":     c["lat"],
            "lon_centroid":     c["lon"],
            "climate_zone":     c["climate"],
            "fragility_index":  c["fragility"],
            "afro_member":      True,
        })

    # ── Build date range ────────────────────────────────────────────────────
    end_date   = date(2026, 3, 1)
    start_date = date(end_date.year - years, end_date.month, end_date.day)
    date_range = [start_date + timedelta(days=i)
                  for i in range((end_date - start_date).days)]

    report_id_set: set[str] = set()
    alert_id_set:  set[str] = set()

    # ── Main loop: country × disease × date ─────────────────────────────────
    for country in AFRO_COUNTRIES:
        print(f"  Generating: {country['name']} ({country['iso3']})...")

        districts = get_districts(country["name"], n=8)

        # ── OH-EpiCap scores (once per country) ───────────────────────────
        tables["epicap_scores"].extend(generate_epicap_scores(country))

        # ── Environmental observations: weekly ────────────────────────────
        # One record per week per country
        for week_start in pd.date_range(start_date, end_date, freq="W"):
            wd = week_start.date()
            climate = generate_climate_profile(country, wd)
            lat, lon = lat_lon_jitter(country["lat"], country["lon"], 1.5)
            tables["env_observations"].append({
                "env_id":           short_id("ENV"),
                "country_iso3":     country["iso3"],
                "district":         random.choice(districts),
                "obs_date":         wd.isoformat(),
                "gps_lat":          lat,
                "gps_lon":          lon,
                **climate,
            })

        # ── Disease reports: sample dates weighted by disease load ─────────
        annual_reports = int(RECORDS_PER_COUNTRY * country["w"])

        for _ in range(annual_reports * years):
            record_date = random.choice(date_range)
            disease     = random.choice(DISEASES)
            district    = random.choice(districts)
            lat, lon    = lat_lon_jitter(country["lat"], country["lon"])

            # Skip animal-only diseases for human records
            case_count  = expected_cases(disease, country, record_date)
            if disease["domain"] == "animal":
                case_count = 0

            # Generate unique report ID
            report_id = short_id("RPT")
            while report_id in report_id_set:
                report_id = short_id("RPT")
            report_id_set.add(report_id)

            # Case classification
            classif = weighted_choice(
                ["suspected", "probable", "confirmed"],
                [0.55, 0.25, 0.20]
            )

            # ── Human case record ──────────────────────────────────────────
            human_case = None
            if case_count > 0 or (disease["domain"] in ("zoonotic","vector","environmental","amr")):
                human_case = generate_human_case_record(
                    country, disease, record_date, district, report_id
                )
                if case_count > 0:
                    human_case["case_count"] = case_count
                    tables["human_cases"].append(human_case)

            # ── Animal event record ────────────────────────────────────────
            animal_event = None
            if disease["domain"] in ("zoonotic", "animal"):
                animal_event = generate_animal_event(
                    country, disease, record_date, district, report_id
                )
                if animal_event:
                    tables["animal_events"].append(animal_event)

            # ── Compute alert tier ─────────────────────────────────────────
            tier = compute_alert_tier(disease, human_case, animal_event, country)

            # ── Disease report (master record) ────────────────────────────
            report = {
                "report_id":          report_id,
                "country_iso3":       country["iso3"],
                "country_name":       country["name"],
                "who_subregion":      country["sub"],
                "district":           district,
                "gps_lat":            lat,
                "gps_lon":            lon,
                "report_date":        record_date.isoformat(),
                "epi_week":           record_date.isocalendar()[1],
                "epi_year":           record_date.year,
                "disease_name":       disease["name"],
                "disease_domain":     disease["domain"],
                "ihr_notifiable":     disease["ihr"],
                "woah_listed":        disease["woah"],
                "priority":           disease["priority"],
                "case_classification":classif,
                "case_count":         case_count,
                "alert_tier":         tier,
                "has_human_case":     human_case is not None,
                "has_animal_event":   animal_event is not None,
                "report_source":      random.choice(["community_reporter","health_facility",
                                                      "veterinary_officer","lab_confirmation",
                                                      "media_report","official_notification"]),
                "data_completeness_pct": round(clamp(
                    100 - country["fragility"] * 6 + random.uniform(-10, 10), 20, 100
                ), 1),
            }
            tables["disease_reports"].append(report)

            # ── Alert record (tier > 0) ────────────────────────────────────
            if tier > 0:
                alert_id = short_id("ALT")
                while alert_id in alert_id_set:
                    alert_id = short_id("ALT")
                alert_id_set.add(alert_id)

                notification_roles = {
                    1: ["district_health_officer"],
                    2: ["district_health_officer","county_chief_vet"],
                    3: ["national_epi_unit","national_vet_authority","who_afro_ihr"],
                    4: ["national_epi_unit","who_afro_ihr","who_hq","fao","woah"],
                }

                tables["alerts"].append({
                    "alert_id":          alert_id,
                    "report_id":         report_id,
                    "country_iso3":      country["iso3"],
                    "district":          district,
                    "disease_name":      disease["name"],
                    "alert_tier":        tier,
                    "alert_date":        record_date.isoformat(),
                    "status":            random.choice(["open","investigating","closed"]),
                    "ihr_notifiable":    disease["ihr"],
                    "woah_listed":       disease["woah"],
                    "notified_roles":    json.dumps(notification_roles.get(tier, [])),
                    "response_hours":    round(random.uniform(2, 72) * (1 + country["fragility"] * 0.1), 1),
                    "auto_escalated":    True,
                    "gps_lat":           lat,
                    "gps_lon":           lon,
                })

        # ── Epi-links: link zoonotic human cases to animal events ──────────
        # Find matching pairs within the same country / district / disease
        country_human   = [r for r in tables["human_cases"]
                           if tables["disease_reports"][
                               next(i for i,x in enumerate(tables["disease_reports"])
                                    if x["report_id"]==r["report_id"])
                           ]["country_iso3"] == country["iso3"]]
        country_animal  = [r for r in tables["animal_events"]
                           if tables["disease_reports"][
                               next(i for i,x in enumerate(tables["disease_reports"])
                                    if x["report_id"]==r["report_id"])
                           ]["country_iso3"] == country["iso3"]]

        n_links = min(len(country_human), len(country_animal), 10)
        for i in range(n_links):
            if random.random() < 0.40:  # not every case gets linked
                tables["epi_links"].append({
                    "link_id":            short_id("LNK"),
                    "human_report_id":    country_human[i]["report_id"],
                    "animal_report_id":   country_animal[i]["report_id"],
                    "country_iso3":       country["iso3"],
                    "link_type":          random.choice(["suspected_spillover",
                                                          "confirmed_spillover",
                                                          "epidemiological_association"]),
                    "days_lag":           random.randint(0, 21),
                    "distance_km":        round(random.uniform(0.5, 45.0), 1),
                    "created_date":       (start_date + timedelta(days=random.randint(0, 365 * years))).isoformat(),
                })

    print(f"\n  Generation complete.")
    _print_summary(tables)
    return tables


def _print_summary(tables: dict) -> None:
    print("\n" + "="*60)
    print("  ONE HEALTH AFRO SYNTHETIC DATA — GENERATION SUMMARY")
    print("="*60)
    for table, rows in tables.items():
        print(f"  {table:<25} {len(rows):>8,} rows")
    total = sum(len(r) for r in tables.values())
    print(f"  {'TOTAL RECORDS':<25} {total:>8,}")
    print("="*60)


# =============================================================================
# 9. OUTPUT WRITERS
# =============================================================================

def write_csvs(tables: dict, output_dir: Path) -> None:
    """Write each table to a separate CSV file."""
    output_dir.mkdir(parents=True, exist_ok=True)
    for table_name, rows in tables.items():
        if not rows:
            continue
        filepath = output_dir / f"oh_afro_{table_name}.csv"
        fieldnames = list(rows[0].keys())
        with open(filepath, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
        print(f"  ✓ Written: {filepath}  ({len(rows):,} rows)")


def write_sql(tables: dict, output_dir: Path) -> None:
    """
    Write PostgreSQL-compatible SQL:
      1. CREATE TABLE statements with correct types
      2. COPY-ready INSERT batches (1000 rows per INSERT)
    """
    output_dir.mkdir(parents=True, exist_ok=True)

    # Schema DDL
    schema_sql = _build_schema_ddl()
    schema_path = output_dir / "01_schema.sql"
    schema_path.write_text(schema_sql, encoding="utf-8")
    print(f"  ✓ Written: {schema_path}")

    # Data INSERT files
    for table_name, rows in tables.items():
        if not rows:
            continue
        sql_path = output_dir / f"02_data_{table_name}.sql"
        with open(sql_path, "w", encoding="utf-8") as f:
            f.write(f"-- ONE HEALTH AFRO: {table_name}\n")
            f.write(f"-- Generated: {datetime.utcnow().isoformat()}Z\n\n")
            _write_insert_batches(f, f"oh_{table_name}", rows, batch_size=500)
        print(f"  ✓ Written: {sql_path}  ({len(rows):,} rows)")


def _escape_sql_value(v: Any) -> str:
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "TRUE" if v else "FALSE"
    if isinstance(v, (int, float)):
        return str(v)
    # Escape single quotes
    return "'" + str(v).replace("'", "''") + "'"


def _write_insert_batches(f, table: str, rows: list[dict], batch_size: int = 500) -> None:
    if not rows:
        return
    cols = list(rows[0].keys())
    col_str = ", ".join(cols)
    for i in range(0, len(rows), batch_size):
        batch = rows[i: i + batch_size]
        vals  = []
        for row in batch:
            row_vals = ", ".join(_escape_sql_value(row.get(c)) for c in cols)
            vals.append(f"  ({row_vals})")
        f.write(f"INSERT INTO {table} ({col_str}) VALUES\n")
        f.write(",\n".join(vals))
        f.write(";\n\n")


def _build_schema_ddl() -> str:
    return """
-- =============================================================================
-- ONE HEALTH AFRO — PostgreSQL Schema (Supabase-compatible)
-- Generated by oh_afro_generator.py
-- =============================================================================

-- Enable PostGIS for spatial queries (run once per database)
-- CREATE EXTENSION IF NOT EXISTS postgis;

-- ── Countries ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS oh_countries (
    iso3                VARCHAR(3)     PRIMARY KEY,
    country_name        VARCHAR(100)   NOT NULL,
    who_subregion       VARCHAR(50),
    population_M        DECIMAL(8,2),
    disease_burden_w    DECIMAL(4,2),
    lat_centroid        DECIMAL(9,6),
    lon_centroid        DECIMAL(9,6),
    climate_zone        VARCHAR(30),
    fragility_index     SMALLINT       CHECK (fragility_index BETWEEN 0 AND 10),
    afro_member         BOOLEAN        DEFAULT TRUE
);

-- ── Disease Reports (master event table) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS oh_disease_reports (
    report_id              VARCHAR(20)   PRIMARY KEY,
    country_iso3           VARCHAR(3)    NOT NULL REFERENCES oh_countries(iso3),
    country_name           VARCHAR(100),
    who_subregion          VARCHAR(50),
    district               VARCHAR(100),
    gps_lat                DECIMAL(9,6),
    gps_lon                DECIMAL(9,6),
    report_date            DATE          NOT NULL,
    epi_week               SMALLINT,
    epi_year               SMALLINT,
    disease_name           VARCHAR(100)  NOT NULL,
    disease_domain         VARCHAR(30),
    ihr_notifiable         BOOLEAN       DEFAULT FALSE,
    woah_listed            BOOLEAN       DEFAULT FALSE,
    priority               VARCHAR(5),
    case_classification    VARCHAR(20),
    case_count             INTEGER       DEFAULT 0,
    alert_tier             SMALLINT      DEFAULT 0,
    has_human_case         BOOLEAN       DEFAULT FALSE,
    has_animal_event       BOOLEAN       DEFAULT FALSE,
    report_source          VARCHAR(40),
    data_completeness_pct  DECIMAL(5,1),
    created_at             TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_country   ON oh_disease_reports(country_iso3, report_date DESC);
CREATE INDEX IF NOT EXISTS idx_reports_disease   ON oh_disease_reports(disease_name, alert_tier);
CREATE INDEX IF NOT EXISTS idx_reports_week      ON oh_disease_reports(epi_year, epi_week);

-- ── Human Cases ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS oh_human_cases (
    id                 SERIAL        PRIMARY KEY,
    report_id          VARCHAR(20)   NOT NULL REFERENCES oh_disease_reports(report_id),
    onset_date         DATE,
    age_group          VARCHAR(10),
    sex                CHAR(1),
    occupation         VARCHAR(40),
    animal_contact     BOOLEAN       DEFAULT FALSE,
    symptoms           JSONB,
    hospitalized       BOOLEAN       DEFAULT FALSE,
    outcome            VARCHAR(25),
    sample_collected   BOOLEAN       DEFAULT FALSE,
    lab_confirmed      BOOLEAN       DEFAULT FALSE,
    case_count         INTEGER       DEFAULT 1
);

-- ── Animal Events ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS oh_animal_events (
    id                SERIAL        PRIMARY KEY,
    report_id         VARCHAR(20)   NOT NULL REFERENCES oh_disease_reports(report_id),
    species           VARCHAR(50),
    flock_size        INTEGER,
    animals_sick      INTEGER,
    animals_dead      INTEGER,
    mortality_pct     DECIMAL(5,2),
    onset_date        DATE,
    clinical_signs    JSONB,
    human_exposure    BOOLEAN       DEFAULT FALSE,
    humans_exposed    INTEGER       DEFAULT 0,
    woah_notified     BOOLEAN       DEFAULT FALSE,
    lab_confirmed     BOOLEAN       DEFAULT FALSE,
    CONSTRAINT mortality_check CHECK (animals_dead <= flock_size)
);

-- ── Environmental Observations ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS oh_env_observations (
    env_id                   VARCHAR(20)   PRIMARY KEY,
    country_iso3             VARCHAR(3)    NOT NULL REFERENCES oh_countries(iso3),
    district                 VARCHAR(100),
    obs_date                 DATE          NOT NULL,
    gps_lat                  DECIMAL(9,6),
    gps_lon                  DECIMAL(9,6),
    temp_max_c               DECIMAL(5,1),
    temp_min_c               DECIMAL(5,1),
    temp_mean_c              DECIMAL(5,1),
    precipitation_mm         DECIMAL(7,1),
    humidity_pct             DECIMAL(5,1),
    wind_speed_ms            DECIMAL(5,1),
    ndvi                     DECIMAL(5,3),
    migratory_bird_season    BOOLEAN,
    flood_risk_flag          BOOLEAN,
    drought_risk_flag        BOOLEAN,
    land_use                 VARCHAR(50),
    deforestation_alert      BOOLEAN,
    water_body_proximity_km  DECIMAL(6,1),
    dust_season              BOOLEAN
);

CREATE INDEX IF NOT EXISTS idx_env_country_date ON oh_env_observations(country_iso3, obs_date DESC);

-- ── Alerts ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS oh_alerts (
    alert_id          VARCHAR(20)   PRIMARY KEY,
    report_id         VARCHAR(20)   NOT NULL REFERENCES oh_disease_reports(report_id),
    country_iso3      VARCHAR(3)    NOT NULL REFERENCES oh_countries(iso3),
    district          VARCHAR(100),
    disease_name      VARCHAR(100),
    alert_tier        SMALLINT      NOT NULL CHECK (alert_tier BETWEEN 1 AND 4),
    alert_date        DATE          NOT NULL,
    status            VARCHAR(20)   DEFAULT 'open',
    ihr_notifiable    BOOLEAN       DEFAULT FALSE,
    woah_listed       BOOLEAN       DEFAULT FALSE,
    notified_roles    JSONB,
    response_hours    DECIMAL(6,1),
    auto_escalated    BOOLEAN       DEFAULT TRUE,
    gps_lat           DECIMAL(9,6),
    gps_lon           DECIMAL(9,6),
    created_at        TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_country_tier ON oh_alerts(country_iso3, alert_tier, alert_date DESC);

-- ── Epi Links (human–animal cross-domain linkages) ─────────────────────────
CREATE TABLE IF NOT EXISTS oh_epi_links (
    link_id             VARCHAR(20)   PRIMARY KEY,
    human_report_id     VARCHAR(20)   REFERENCES oh_disease_reports(report_id),
    animal_report_id    VARCHAR(20)   REFERENCES oh_disease_reports(report_id),
    country_iso3        VARCHAR(3)    REFERENCES oh_countries(iso3),
    link_type           VARCHAR(40),
    days_lag            SMALLINT,
    distance_km         DECIMAL(6,1),
    created_date        DATE
);

-- ── OH-EpiCap Scores ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS oh_epicap_scores (
    id               SERIAL        PRIMARY KEY,
    country_iso3     VARCHAR(3)    NOT NULL REFERENCES oh_countries(iso3),
    country_name     VARCHAR(100),
    dimension        VARCHAR(40),
    target           VARCHAR(40),
    indicator        VARCHAR(60),
    score            SMALLINT      NOT NULL CHECK (score BETWEEN 1 AND 4),
    assessment_year  SMALLINT,
    notes            TEXT
);

CREATE INDEX IF NOT EXISTS idx_epicap_country ON oh_epicap_scores(country_iso3, dimension);

-- =============================================================================
-- Useful views for Superset / PDX dashboards
-- =============================================================================

CREATE OR REPLACE VIEW oh_alert_dashboard AS
SELECT
    a.alert_id,
    a.alert_tier,
    a.alert_date,
    a.status,
    a.disease_name,
    a.response_hours,
    c.country_name,
    c.who_subregion,
    c.population_M,
    c.fragility_index,
    r.disease_domain,
    r.case_count,
    r.data_completeness_pct,
    ae.species,
    ae.mortality_pct,
    ae.human_exposure,
    ae.humans_exposed,
    hc.outcome,
    hc.hospitalized,
    a.gps_lat,
    a.gps_lon
FROM oh_alerts          a
JOIN oh_disease_reports r  ON a.report_id    = r.report_id
JOIN oh_countries       c  ON a.country_iso3 = c.iso3
LEFT JOIN oh_animal_events ae ON r.report_id = ae.report_id
LEFT JOIN oh_human_cases   hc ON r.report_id = hc.report_id;


CREATE OR REPLACE VIEW oh_weekly_summary AS
SELECT
    r.epi_year,
    r.epi_week,
    r.country_iso3,
    c.country_name,
    c.who_subregion,
    r.disease_name,
    r.disease_domain,
    COUNT(r.report_id)                                    AS total_reports,
    SUM(r.case_count)                                     AS total_cases,
    SUM(CASE WHEN r.alert_tier >= 3 THEN 1 ELSE 0 END)   AS high_tier_alerts,
    AVG(r.data_completeness_pct)                          AS avg_completeness
FROM oh_disease_reports r
JOIN oh_countries       c ON r.country_iso3 = c.iso3
GROUP BY r.epi_year, r.epi_week, r.country_iso3, c.country_name,
         c.who_subregion, r.disease_name, r.disease_domain;


CREATE OR REPLACE VIEW oh_epicap_summary AS
SELECT
    country_iso3,
    country_name,
    dimension,
    ROUND(AVG(score)::NUMERIC, 2)    AS avg_score,
    MIN(score)                        AS min_score,
    MAX(score)                        AS max_score,
    COUNT(*)                          AS indicator_count
FROM oh_epicap_scores
GROUP BY country_iso3, country_name, dimension;
"""


# =============================================================================
# 10. SUPABASE PUSH
# =============================================================================

def push_to_supabase(tables: dict) -> None:
    """
    Push all tables to Supabase via the REST API.
    Requires SUPABASE_URL and SUPABASE_KEY in environment / .env file.
    """
    if not SUPABASE_AVAILABLE:
        print("  ✗ supabase-py not installed. Run: pip install supabase")
        return

    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    if not url or not key:
        print("  ✗ SUPABASE_URL and SUPABASE_KEY must be set in environment or .env")
        return

    client = create_client(url, key)
    SUPABASE_TABLE_MAP = {
        "countries":        "oh_countries",
        "disease_reports":  "oh_disease_reports",
        "human_cases":      "oh_human_cases",
        "animal_events":    "oh_animal_events",
        "env_observations": "oh_env_observations",
        "alerts":           "oh_alerts",
        "epi_links":        "oh_epi_links",
        "epicap_scores":    "oh_epicap_scores",
    }

    # Push in dependency order (parents before children)
    push_order = ["countries","disease_reports","human_cases",
                  "animal_events","env_observations","alerts",
                  "epi_links","epicap_scores"]

    for key_name in push_order:
        rows = tables[key_name]
        if not rows:
            continue
        table_name = SUPABASE_TABLE_MAP[key_name]
        print(f"  Pushing {len(rows):,} rows → {table_name}...")

        BATCH = 200
        errors = 0
        for i in range(0, len(rows), BATCH):
            batch = rows[i: i + BATCH]
            try:
                client.table(table_name).upsert(batch).execute()
            except Exception as e:
                errors += 1
                print(f"    ✗ Batch {i//BATCH + 1} error: {e}")

        status = "✓" if errors == 0 else f"⚠ ({errors} batch errors)"
        print(f"  {status} {table_name}")


# =============================================================================
# 11. ENTRY POINT
# =============================================================================

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="One Health AFRO Synthetic Data Generator — WHO AFRO 47 Member States"
    )
    parser.add_argument("--seed",          type=int,  default=DEFAULT_SEED,
                        help=f"Random seed (default: {DEFAULT_SEED})")
    parser.add_argument("--years",         type=int,  default=DEFAULT_YEARS,
                        help=f"Years of data to generate (default: {DEFAULT_YEARS})")
    parser.add_argument("--output-dir",    type=str,  default=str(OUTPUT_DIR),
                        help=f"Output directory (default: {OUTPUT_DIR})")
    parser.add_argument("--push-supabase", action="store_true",
                        help="Push generated data to Supabase (requires .env with SUPABASE_URL + SUPABASE_KEY)")
    parser.add_argument("--csv-only",      action="store_true",
                        help="Write only CSVs, skip SQL generation")
    parser.add_argument("--sql-only",      action="store_true",
                        help="Write only SQL, skip CSV generation")
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    print("\n" + "="*60)
    print("  ONE HEALTH AFRO SYNTHETIC DATA GENERATOR")
    print("  WHO AFRO — 47 Member States")
    print(f"  Seed: {args.seed}  |  Years: {args.years}")
    print("="*60 + "\n")

    output_dir = Path(args.output_dir)

    print("Generating data...")
    tables = generate_all(seed=args.seed, years=args.years)

    if not args.sql_only:
        print("\nWriting CSVs...")
        write_csvs(tables, output_dir / "csv")

    if not args.csv_only:
        print("\nWriting SQL...")
        write_sql(tables, output_dir / "sql")

    if args.push_supabase:
        print("\nPushing to Supabase...")
        push_to_supabase(tables)

    print("\n✓ All done. Output in:", output_dir.resolve())
    print("  → CSV files:        output/csv/oh_afro_*.csv")
    print("  → SQL schema:       output/sql/01_schema.sql")
    print("  → SQL data:         output/sql/02_data_*.sql")


if __name__ == "__main__":
    main()
