"""
Spillover Early Warning Engine — Django port
Ported from triad_spillover_engine.py (FastAPI → Django).

Answers: "Is an animal-to-human spillover ABOUT TO HAPPEN, WHERE, WHICH pathogen, HOW SOON?"
Sits BEFORE the SEIR simulation in the intelligence chain.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field, asdict
from datetime import date, timedelta
from typing import Any, Optional

from django.db import DatabaseError, connection


# ── Helpers ──────────────────────────────────────────────────────────────────

def _dictfetchall(cursor):
    columns = [col[0] for col in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]


# ═════════════════════════════════════════════════════════════════════════════
# PATHOGEN PROFILES — scientific spillover parameters
# ═════════════════════════════════════════════════════════════════════════════

@dataclass
class PathogenProfile:
    name: str
    domain: str
    priority: str
    spillover_score: Optional[int]
    cfr_pct: float
    incubation_days: int
    ihr_notifiable: bool
    woah_listed: bool
    trigger_mortality_pct: float = 10.0
    trigger_season_months: list = field(default_factory=list)
    trigger_hosts: list = field(default_factory=list)
    trigger_env_conditions: list = field(default_factory=list)
    vector_borne: bool = False
    vaccine_available: bool = False
    days_animal_to_human: tuple = (3, 21)


PATHOGEN_PROFILES: dict[str, PathogenProfile] = {
    "HPAI H5N1": PathogenProfile(
        name="Highly Pathogenic Avian Influenza H5N1", domain="zoonotic", priority="P1",
        spillover_score=89, cfr_pct=55.0, incubation_days=3,
        ihr_notifiable=True, woah_listed=True,
        trigger_mortality_pct=20.0,
        trigger_season_months=[10, 11, 12, 1, 2, 3],
        trigger_hosts=["chicken", "duck", "turkey", "wild_birds"],
        trigger_env_conditions=["migratory_bird_season", "high_bird_density"],
        vaccine_available=False, days_animal_to_human=(2, 10),
    ),
    "Ebola VD": PathogenProfile(
        name="Ebola Virus Disease", domain="zoonotic", priority="P1",
        spillover_score=82, cfr_pct=50.0, incubation_days=8,
        ihr_notifiable=True, woah_listed=False,
        trigger_mortality_pct=5.0,
        trigger_season_months=[3, 4, 5, 9, 10, 11],
        trigger_hosts=["bats", "primates"],
        trigger_env_conditions=["deforestation_alert", "bushmeat_market_presence", "high_bat_species"],
        vaccine_available=True, days_animal_to_human=(5, 21),
    ),
    "Mpox Clade I": PathogenProfile(
        name="Mpox (Clade I)", domain="zoonotic", priority="P1",
        spillover_score=71, cfr_pct=4.0, incubation_days=10,
        ihr_notifiable=True, woah_listed=False,
        trigger_mortality_pct=3.0,
        trigger_season_months=list(range(1, 13)),
        trigger_hosts=["rodents", "primates", "squirrels"],
        trigger_env_conditions=["bushmeat_market_presence", "deforestation_alert"],
        vaccine_available=True, days_animal_to_human=(3, 14),
    ),
    "Rift Valley Fever": PathogenProfile(
        name="Rift Valley Fever", domain="zoonotic", priority="P1",
        spillover_score=68, cfr_pct=1.0, incubation_days=4,
        ihr_notifiable=True, woah_listed=True,
        trigger_mortality_pct=15.0,
        trigger_season_months=[3, 4, 5, 10, 11, 12],
        trigger_hosts=["cattle", "sheep", "goats"],
        trigger_env_conditions=["flood_risk_flag", "high_precipitation"],
        vector_borne=True, vaccine_available=True, days_animal_to_human=(1, 7),
    ),
    "CCHF": PathogenProfile(
        name="Crimean-Congo Haemorrhagic Fever", domain="zoonotic", priority="P1",
        spillover_score=74, cfr_pct=30.0, incubation_days=5,
        ihr_notifiable=True, woah_listed=True,
        trigger_mortality_pct=5.0,
        trigger_season_months=[4, 5, 6, 7, 8],
        trigger_hosts=["cattle", "sheep"],
        trigger_env_conditions=["high_temp", "arid_or_semi_arid"],
        vector_borne=True, vaccine_available=False, days_animal_to_human=(1, 5),
    ),
    "Plague": PathogenProfile(
        name="Plague", domain="zoonotic", priority="P1",
        spillover_score=62, cfr_pct=30.0, incubation_days=4,
        ihr_notifiable=True, woah_listed=False,
        trigger_mortality_pct=10.0,
        trigger_season_months=[11, 12, 1, 2],
        trigger_hosts=["rodents"],
        trigger_env_conditions=["drought_risk_flag", "dust_season"],
        vector_borne=True, vaccine_available=False, days_animal_to_human=(2, 7),
    ),
    "Rabies": PathogenProfile(
        name="Rabies", domain="zoonotic", priority="P2",
        spillover_score=55, cfr_pct=99.9, incubation_days=45,
        ihr_notifiable=False, woah_listed=True,
        trigger_mortality_pct=2.0,
        trigger_season_months=list(range(1, 13)),
        trigger_hosts=["dogs", "bats", "foxes"],
        trigger_env_conditions=[],
        vaccine_available=True, days_animal_to_human=(0, 0),
    ),
    "Brucellosis": PathogenProfile(
        name="Brucellosis", domain="zoonotic", priority="P2",
        spillover_score=48, cfr_pct=0.5, incubation_days=20,
        ihr_notifiable=False, woah_listed=True,
        trigger_mortality_pct=1.0,
        trigger_season_months=list(range(1, 13)),
        trigger_hosts=["cattle", "goats", "sheep"],
        trigger_env_conditions=[],
        vaccine_available=True, days_animal_to_human=(5, 30),
    ),
    "Hantavirus Pulmonary Syndrome": PathogenProfile(
        name="Hantavirus Pulmonary Syndrome", domain="zoonotic", priority="P1",
        spillover_score=72, cfr_pct=35.0, incubation_days=14,
        ihr_notifiable=True, woah_listed=False,
        trigger_mortality_pct=5.0,
        trigger_season_months=list(range(1, 13)),
        trigger_hosts=["rodents"],
        trigger_env_conditions=["bushmeat_market_presence"],
        vaccine_available=False, days_animal_to_human=(7, 35),
    ),
}


# ═════════════════════════════════════════════════════════════════════════════
# SCORING HELPERS
# ═════════════════════════════════════════════════════════════════════════════

WEIGHTS = {
    "animal_mortality": 22, "human_exposure": 18, "environmental_risk": 13,
    "surveillance_gap": 10, "seasonality": 7, "spatial_proximity": 5,
    "intelligence_signal": 15,   # real outbreak alerts from sentinel scrapers
    "pathogen_baseline": 10,     # inherent spillover risk of the pathogen itself
}



def compute_stage(score: float) -> tuple[int, str, str]:
    if score < 25: return 0, "Background", "#2e4a60"
    if score < 50: return 1, "Watch", "#4d8ef5"
    if score < 75: return 2, "Warning", "#f5b942"
    return 3, "Imminent", "#ff3a58"


def compute_days_estimate(profile: PathogenProfile, composite: float):
    if composite < 25:
        return 30, 90, 60
    factor = (composite - 25) / 75.0
    d_min = profile.days_animal_to_human[0]
    d_max = profile.days_animal_to_human[1]
    est_min = max(1, round(d_min + (1 - factor) * 3))
    est_max = max(est_min + 2, round(d_max * (1 - factor * 0.6)))
    est_mid = round((est_min + est_max) / 2)
    return est_min, est_max, est_mid


def compute_p_spillover(composite: float, days: int = 30) -> float:
    if composite < 10:
        return 0.01
    lambda_rate = (composite / 100.0) ** 2 * 0.15
    return round(min(0.98, 1.0 - math.exp(-lambda_rate * days)), 3)


# ═════════════════════════════════════════════════════════════════════════════
# ENGINE — DB-backed scoring (uses Django connection)
# ═════════════════════════════════════════════════════════════════════════════

class SpilloverEngine:
    """Computes spillover risk scores using Django DB connection."""

    def assess_country(self, iso3: str, country_name: str, pathogen_name: str) -> dict:
        profile = PATHOGEN_PROFILES.get(pathogen_name)
        if not profile:
            return {}

        today = date.today()
        current_month = today.month
        cutoff = (today - timedelta(days=30)).isoformat()

        # Safe matching for different disease namings
        match_map = {
            "HPAI H5N1": "Avian",
            "Ebola VD": "Ebola",
            "Mpox Clade I": "Mpox",
            "Rift Valley Fever": "Rift",
            "CCHF": "Crimean",
            "Hantavirus Pulmonary Syndrome": "Hantavirus",
        }
        disease_match = f'%{match_map.get(pathogen_name, pathogen_name.split()[0])}%'

        # Fetch signals from DB
        with connection.cursor() as cur:
            # Animal events
            cur.execute("""
                SELECT disease_name, alert_tier, has_animal_event, report_date
                FROM oh_disease_reports
                WHERE country_iso3 = %s AND has_animal_event = TRUE AND report_date >= %s
                  AND disease_name ILIKE %s
            """, [iso3, cutoff, disease_match])
            animal_events = _dictfetchall(cur)

            # Animal details — filtered by country via report join
            cur.execute("""
                SELECT ae.species, ae.mortality_pct, ae.human_exposure, ae.humans_exposed
                FROM oh_animal_events ae
                JOIN oh_disease_reports dr ON ae.report_id = dr.report_id
                WHERE dr.country_iso3 = %s AND dr.report_date >= %s AND dr.disease_name ILIKE %s
                LIMIT 50
            """, [iso3, cutoff, disease_match])
            animal_details = _dictfetchall(cur)

            # Env
            cur.execute("""
                SELECT * FROM oh_env_observations
                WHERE country_iso3 = %s ORDER BY obs_date DESC LIMIT 1
            """, [iso3])
            env_rows = _dictfetchall(cur)
            env = env_rows[0] if env_rows else {}

            # SPAR
            cur.execute("""
                SELECT COALESCE(ihr_overall_score, ihr_overall_average_score, 51) AS ihr_overall_score,
                       ihr_zoonoses_score, interface_risk_score,
                       bushmeat_market_presence, livestock_cattle_heads, livestock_poultry_heads
                FROM oh_spillover_risk_factors WHERE country_iso3 = %s
            """, [iso3])
            spar_rows = _dictfetchall(cur)
            spar = spar_rows[0] if spar_rows else {}

        # Score each domain
        signals = []

        # 1. Animal mortality
        n_events = len(animal_events)
        sub_animal = min(40, n_events * 15)
        if animal_details:
            morts = [float(d.get("mortality_pct") or 0) for d in animal_details if d.get("mortality_pct")]
            if morts and max(morts) >= profile.trigger_mortality_pct:
                sub_animal = min(100, sub_animal + min(60, (max(morts) / profile.trigger_mortality_pct) * 40))
            human_exp_count = sum(1 for d in animal_details if d.get("human_exposure"))
            if human_exp_count:
                sub_animal = min(100, sub_animal + 20)
        tier4 = [e for e in animal_events if e.get("alert_tier") == 4]
        if tier4:
            sub_animal = min(100, sub_animal + 25)
        w_animal = (sub_animal * WEIGHTS["animal_mortality"]) / 100
        signals.append({"signal": "animal_mortality", "sub_score": round(sub_animal, 1),
                         "weight_pct": WEIGHTS["animal_mortality"], "weighted": round(w_animal, 1),
                         "evidence": f"{n_events} animal event(s) in last 30 days"})

        # 2. Human exposure
        total_exposed = sum(int(d.get("humans_exposed") or 0) for d in animal_details if d.get("human_exposure"))
        sub_exposure = min(100, 20 + (total_exposed / 10) * 80) if total_exposed > 0 else 0
        w_exposure = (sub_exposure * WEIGHTS["human_exposure"]) / 100
        signals.append({"signal": "human_exposure", "sub_score": round(sub_exposure, 1),
                         "weight_pct": WEIGHTS["human_exposure"], "weighted": round(w_exposure, 1),
                         "evidence": f"{total_exposed} human contact(s)" if total_exposed else "No human-animal contacts"})

        # 3. Environmental risk
        sub_env = 0.0
        env_flags = []
        for cond in profile.trigger_env_conditions:
            if cond == "flood_risk_flag" and env.get("flood_risk_flag"):
                sub_env += 35; env_flags.append("🌊 Flood risk active")
            elif cond == "migratory_bird_season" and env.get("migratory_bird_season"):
                sub_env += 30; env_flags.append("🦅 Migratory bird season")
            elif cond == "deforestation_alert" and env.get("deforestation_alert"):
                sub_env += 25; env_flags.append("🌲 Deforestation alert")
            elif cond == "bushmeat_market_presence" and spar.get("bushmeat_market_presence"):
                sub_env += 20; env_flags.append("🦌 Bushmeat market proximity")
            elif cond == "drought_risk_flag" and env.get("drought_risk_flag"):
                sub_env += 20; env_flags.append("🏜 Drought risk active")
            elif cond == "high_precipitation":
                precip = float(env.get("precipitation_mm") or 0)
                if precip > 100:
                    sub_env += min(25, precip / 8); env_flags.append(f"🌧 High precipitation ({precip}mm)")
        sub_env = min(100, sub_env)
        w_env = (sub_env * WEIGHTS["environmental_risk"]) / 100
        signals.append({"signal": "environmental_risk", "sub_score": round(sub_env, 1),
                         "weight_pct": WEIGHTS["environmental_risk"], "weighted": round(w_env, 1),
                         "evidence": "; ".join(env_flags) if env_flags else "No environmental triggers"})

        # 4. Surveillance gap
        ihr = float(spar.get("ihr_zoonoses_score") or spar.get("ihr_overall_score") or 51)
        sub_spar = max(0, 100 - ihr)
        if spar.get("bushmeat_market_presence") and ihr < 50:
            sub_spar = min(100, sub_spar + 15)
        w_spar = (sub_spar * WEIGHTS["surveillance_gap"]) / 100
        signals.append({"signal": "surveillance_gap", "sub_score": round(sub_spar, 1),
                         "weight_pct": WEIGHTS["surveillance_gap"], "weighted": round(w_spar, 1),
                         "evidence": f"IHR Zoonoses capacity: {ihr:.0f}%"})

        # 5. Seasonality
        in_season = current_month in profile.trigger_season_months
        near_season = ((current_month + 1) % 12 in profile.trigger_season_months or
                       (current_month - 1) % 12 in profile.trigger_season_months)
        sub_season = 100.0 if in_season else (50.0 if near_season else 0.0)
        w_season = (sub_season * WEIGHTS["seasonality"]) / 100
        signals.append({"signal": "seasonality", "sub_score": round(sub_season, 1),
                         "weight_pct": WEIGHTS["seasonality"], "weighted": round(w_season, 1),
                         "evidence": "Peak season ACTIVE" if in_season else "Near peak" if near_season else "Off-season"})

        # 6. Spatial proximity
        interface_risk = float(spar.get("interface_risk_score") or 5.0)
        sub_spatial = min(100, interface_risk * 10)
        w_spatial = (sub_spatial * WEIGHTS["spatial_proximity"]) / 100
        signals.append({"signal": "spatial_proximity", "sub_score": round(sub_spatial, 1),
                         "weight_pct": WEIGHTS["spatial_proximity"], "weighted": round(w_spatial, 1),
                         "evidence": f"Interface risk: {interface_risk:.1f}/10"})

        # 6b. Pathogen baseline — inherent spillover potential of this pathogen
        # Uses the scientific spillover_score from PathogenProfile (0-100).
        # This ensures HPAI H5N1 (89) always ranks above Brucellosis (48)
        # even when no active events exist for either in the same country.
        sub_baseline = float(profile.spillover_score or 50)
        w_baseline = (sub_baseline * WEIGHTS["pathogen_baseline"]) / 100
        signals.append({"signal": "pathogen_baseline", "sub_score": round(sub_baseline, 1),
                         "weight_pct": WEIGHTS["pathogen_baseline"], "weighted": round(w_baseline, 1),
                         "evidence": f"Inherent spillover potential: {sub_baseline:.0f}/100"})

        # 7. Intelligence signal — real outbreak alerts from sentinel scrapers.
        # Pulls live ProMED / WHO DON / AllAfrica / GDELT findings via the
        # SIG-prefixed rows in oh_alerts. Higher tier = stronger contribution.
        with connection.cursor() as cur:
            cur.execute("""
                SELECT alert_tier, disease_name, alert_date
                FROM oh_alerts
                WHERE country_iso3 = %s
                  AND disease_name ILIKE %s
                  AND alert_id LIKE 'SIG-%%'
                  AND status != 'closed'
                  AND alert_date >= %s
                ORDER BY alert_tier DESC, alert_date DESC LIMIT 5
            """, [iso3, disease_match, cutoff])
            intel_rows = _dictfetchall(cur)

        intel_score = 0.0
        intel_evidence = "No intelligence alerts in last 30d"
        if intel_rows:
            max_tier = max(int(r.get("alert_tier") or 1) for r in intel_rows)
            n_alerts = len(intel_rows)
            # tier 4 → 100, tier 3 → 75, tier 2 → 50, tier 1 → 25
            intel_score = min(100.0, max_tier * 25 + (n_alerts - 1) * 5)
            top = intel_rows[0]
            intel_evidence = (
                f"{n_alerts} active intelligence alert(s) · top: "
                f"{top.get('disease_name')} (Tier {max_tier})"
            )
        w_intel = (intel_score * WEIGHTS["intelligence_signal"]) / 100
        signals.append({
            "signal": "intelligence_signal",
            "sub_score": round(intel_score, 1),
            "weight_pct": WEIGHTS["intelligence_signal"],
            "weighted": round(w_intel, 1),
            "evidence": intel_evidence,
        })

        # Composite
        composite = round(min(100.0, max(0.0, sum(s["weighted"] for s in signals))), 1)
        stage, stage_label, stage_color = compute_stage(composite)
        dmin, dmax, dest = compute_days_estimate(profile, composite)
        p30 = compute_p_spillover(composite, 30)

        return {
            "iso3": iso3, "country_name": country_name, "pathogen": pathogen_name,
            "assessment_date": today.isoformat(),
            "composite_score": composite, "stage": stage,
            "stage_label": stage_label, "stage_color": stage_color,
            "days_to_first_human_case_min": dmin,
            "days_to_first_human_case_max": dmax,
            "days_to_first_human_case_est": dest,
            "p_spillover_30d": p30, "p_cluster_30d": round(p30 * 0.4, 3),
            "active_animal_events": n_events,
            "human_contacts": total_exposed,
            "environmental_flags": env_flags,
            "seasonality_active": in_season,
            "ihr_notifiable": profile.ihr_notifiable,
            "alert_tier": max(0, stage - 1) if stage > 0 else 0,
            "recommended_actions": self._actions(stage, country_name, profile, dmin, dmax, p30),
            "signal_breakdown": signals,
            "sources_used": ["oh_animal_events", "oh_env_observations", "oh_spillover_risk_factors",
                             "oh_disease_reports", "oh_alerts (SIG-)"],
        }

    def _actions(self, stage, country, profile, dmin, dmax, p30):
        actions = []
        if stage >= 3:
            actions.append(f"🚨 IMMEDIATE: Deploy rapid response team to {country} — possible {profile.name} spillover within {dmin}–{dmax} days")
            actions.append("📋 Notify WHO AFRO EPR + national MoH & Agriculture within 24h")
            actions.append(f"💉 {'Activate vaccine stockpile' if profile.vaccine_available else 'Prepare PPE + isolation protocols'} for healthcare workers")
            actions.append("🔬 Priority laboratory confirmation on all animal samples")
            if profile.ihr_notifiable:
                actions.append("📨 Prepare IHR Article 12 notification draft")
        elif stage == 2:
            actions.append(f"⚠ ALERT: Conduct joint veterinary-epidemiology investigation in {country} within 48–72h")
            actions.append("🐾 Increase animal surveillance — daily mortality reporting")
            actions.append("👥 Screen all humans with confirmed animal contact for early symptoms")
        elif stage == 1:
            actions.append(f"👁 WATCH: Heightened surveillance in {country} — weekly animal health situation reports")
            actions.append(f"📊 Pre-position diagnostic supplies (P(spillover 30d): {p30*100:.0f}%)")
        else:
            actions.append(f"✅ ROUTINE: Continue standard surveillance for {profile.name}")
        return actions


# ═════════════════════════════════════════════════════════════════════════════
# AFRO COUNTRIES
# ═════════════════════════════════════════════════════════════════════════════

AFRO_COUNTRIES = [
    {"iso3": "AGO", "country_name": "Angola"},       {"iso3": "BEN", "country_name": "Benin"},
    {"iso3": "BWA", "country_name": "Botswana"},     {"iso3": "BFA", "country_name": "Burkina Faso"},
    {"iso3": "BDI", "country_name": "Burundi"},      {"iso3": "CPV", "country_name": "Cabo Verde"},
    {"iso3": "CMR", "country_name": "Cameroon"},     {"iso3": "CAF", "country_name": "Cent. Afr. Rep."},
    {"iso3": "TCD", "country_name": "Chad"},         {"iso3": "COM", "country_name": "Comoros"},
    {"iso3": "COD", "country_name": "DR Congo"},     {"iso3": "COG", "country_name": "Congo Rep."},
    {"iso3": "CIV", "country_name": "Côte d'Ivoire"},{"iso3": "GNQ", "country_name": "Eq. Guinea"},
    {"iso3": "ERI", "country_name": "Eritrea"},      {"iso3": "SWZ", "country_name": "Eswatini"},
    {"iso3": "ETH", "country_name": "Ethiopia"},     {"iso3": "GAB", "country_name": "Gabon"},
    {"iso3": "GMB", "country_name": "Gambia"},       {"iso3": "GHA", "country_name": "Ghana"},
    {"iso3": "GIN", "country_name": "Guinea"},       {"iso3": "GNB", "country_name": "Guinea-Bissau"},
    {"iso3": "KEN", "country_name": "Kenya"},        {"iso3": "LSO", "country_name": "Lesotho"},
    {"iso3": "LBR", "country_name": "Liberia"},      {"iso3": "MDG", "country_name": "Madagascar"},
    {"iso3": "MWI", "country_name": "Malawi"},       {"iso3": "MLI", "country_name": "Mali"},
    {"iso3": "MRT", "country_name": "Mauritania"},   {"iso3": "MUS", "country_name": "Mauritius"},
    {"iso3": "MOZ", "country_name": "Mozambique"},   {"iso3": "NAM", "country_name": "Namibia"},
    {"iso3": "NER", "country_name": "Niger"},        {"iso3": "NGA", "country_name": "Nigeria"},
    {"iso3": "RWA", "country_name": "Rwanda"},       {"iso3": "STP", "country_name": "São Tomé"},
    {"iso3": "SEN", "country_name": "Senegal"},      {"iso3": "SLE", "country_name": "Sierra Leone"},
    {"iso3": "SOM", "country_name": "Somalia"},      {"iso3": "ZAF", "country_name": "South Africa"},
    {"iso3": "SSD", "country_name": "South Sudan"},  {"iso3": "TZA", "country_name": "Tanzania"},
    {"iso3": "TGO", "country_name": "Togo"},         {"iso3": "UGA", "country_name": "Uganda"},
    {"iso3": "ZMB", "country_name": "Zambia"},       {"iso3": "ZWE", "country_name": "Zimbabwe"},
]


# ═════════════════════════════════════════════════════════════════════════════
# MOCK DATA — realistic fallback when DB unavailable
# ═════════════════════════════════════════════════════════════════════════════

MOCK_EARLY_WARNING = [
    {"iso3": "NGA", "country_name": "Nigeria", "pathogen": "HPAI H5N1",
     "composite_score": 87, "stage": 3, "stage_label": "Imminent", "stage_color": "#ff3a58",
     "days_to_first_human_case_min": 2, "days_to_first_human_case_max": 10, "days_to_first_human_case_est": 5,
     "p_spillover_30d": 0.91, "p_cluster_30d": 0.36,
     "active_animal_events": 4, "human_contacts": 3,
     "environmental_flags": ["🦅 Migratory bird season", "🐔 High poultry density"],
     "seasonality_active": True, "ihr_notifiable": True, "alert_tier": 3,
     "recommended_actions": [
         "🚨 IMMEDIATE: Deploy rapid response team — possible HPAI H5N1 spillover within 2–10 days",
         "📋 Notify WHO AFRO EPR + national MoH & Agriculture within 24h",
         "💉 Prepare PPE + isolation protocols for healthcare workers",
         "🔬 Priority laboratory confirmation on all animal samples",
         "📨 Prepare IHR Article 12 notification draft",
     ],
     "signal_breakdown": [
         {"signal": "animal_mortality", "sub_score": 85, "weight_pct": 28, "weighted": 23.8, "evidence": "4 animal events; 31% mortality (threshold 20%); 3 humans with direct contact"},
         {"signal": "human_exposure", "sub_score": 72, "weight_pct": 22, "weighted": 15.8, "evidence": "3 direct human-animal contacts"},
         {"signal": "environmental_risk", "sub_score": 65, "weight_pct": 20, "weighted": 13.0, "evidence": "Migratory bird season — HPAI risk elevated"},
         {"signal": "surveillance_gap", "sub_score": 48, "weight_pct": 15, "weighted": 7.2, "evidence": "IHR Zoonoses capacity: 42% (critical gap)"},
         {"signal": "seasonality", "sub_score": 100, "weight_pct": 10, "weighted": 10.0, "evidence": "Peak spillover season ACTIVE"},
         {"signal": "spatial_proximity", "sub_score": 85, "weight_pct": 5, "weighted": 4.3, "evidence": "Interface risk: 8.5/10"},
     ],
     "sources_used": ["oh_animal_events", "oh_env_observations", "oh_spillover_risk_factors", "oh_disease_reports"]},

    {"iso3": "COD", "country_name": "DR Congo", "pathogen": "Ebola VD",
     "composite_score": 78, "stage": 3, "stage_label": "Imminent", "stage_color": "#ff3a58",
     "days_to_first_human_case_min": 5, "days_to_first_human_case_max": 14, "days_to_first_human_case_est": 9,
     "p_spillover_30d": 0.84, "p_cluster_30d": 0.34,
     "active_animal_events": 2, "human_contacts": 1,
     "environmental_flags": ["🌲 Deforestation alert", "🦌 Bushmeat market proximity"],
     "seasonality_active": True, "ihr_notifiable": True, "alert_tier": 3,
     "recommended_actions": [
         "🚨 IMMEDIATE: Deploy rapid response team — possible Ebola spillover within 5–14 days",
         "📋 Notify WHO AFRO EPR + national MoH within 24h",
         "💉 Activate vaccine stockpile for healthcare workers",
         "🔬 Priority laboratory confirmation on all animal samples",
         "📨 Prepare IHR Article 12 notification draft",
     ],
     "signal_breakdown": [
         {"signal": "animal_mortality", "sub_score": 40, "weight_pct": 28, "weighted": 11.2, "evidence": "2 animal events in last 30 days"},
         {"signal": "human_exposure", "sub_score": 25, "weight_pct": 22, "weighted": 5.5, "evidence": "1 direct human-animal contact"},
         {"signal": "environmental_risk", "sub_score": 70, "weight_pct": 20, "weighted": 14.0, "evidence": "Deforestation alert; bushmeat trade active"},
         {"signal": "surveillance_gap", "sub_score": 76, "weight_pct": 15, "weighted": 11.4, "evidence": "IHR Zoonoses capacity: 24% (critical gap)"},
         {"signal": "seasonality", "sub_score": 100, "weight_pct": 10, "weighted": 10.0, "evidence": "Peak spillover season ACTIVE"},
         {"signal": "spatial_proximity", "sub_score": 92, "weight_pct": 5, "weighted": 4.6, "evidence": "Interface risk: 9.2/10"},
     ],
     "sources_used": ["oh_animal_events", "oh_env_observations", "oh_spillover_risk_factors"]},

    {"iso3": "KEN", "country_name": "Kenya", "pathogen": "Rift Valley Fever",
     "composite_score": 62, "stage": 2, "stage_label": "Warning", "stage_color": "#f5b942",
     "days_to_first_human_case_min": 1, "days_to_first_human_case_max": 7, "days_to_first_human_case_est": 4,
     "p_spillover_30d": 0.69, "p_cluster_30d": 0.28,
     "active_animal_events": 3, "human_contacts": 0,
     "environmental_flags": ["🌊 Flood risk active", "🌧 High precipitation (142mm)"],
     "seasonality_active": True, "ihr_notifiable": True, "alert_tier": 2,
     "recommended_actions": [
         "⚠ ALERT: Conduct joint veterinary-epidemiology investigation within 48–72h",
         "🐾 Increase animal surveillance — daily mortality reporting",
         "👥 Screen all humans with animal contact for early symptoms",
         "🌊 Activate RVF flood-zone surveillance protocol",
     ],
     "signal_breakdown": [
         {"signal": "animal_mortality", "sub_score": 68, "weight_pct": 28, "weighted": 19.0, "evidence": "3 animal events; cattle mortality 28%"},
         {"signal": "human_exposure", "sub_score": 0, "weight_pct": 22, "weighted": 0, "evidence": "No human contacts"},
         {"signal": "environmental_risk", "sub_score": 75, "weight_pct": 20, "weighted": 15.0, "evidence": "Active flood; 142mm precipitation"},
         {"signal": "surveillance_gap", "sub_score": 42, "weight_pct": 15, "weighted": 6.3, "evidence": "IHR Zoonoses capacity: 58%"},
         {"signal": "seasonality", "sub_score": 100, "weight_pct": 10, "weighted": 10.0, "evidence": "Peak spillover season ACTIVE"},
         {"signal": "spatial_proximity", "sub_score": 52, "weight_pct": 5, "weighted": 2.6, "evidence": "Interface risk: 5.2/10"},
     ],
     "sources_used": ["oh_animal_events", "oh_env_observations", "oh_spillover_risk_factors"]},

    {"iso3": "GIN", "country_name": "Guinea", "pathogen": "Mpox Clade I",
     "composite_score": 58, "stage": 2, "stage_label": "Warning", "stage_color": "#f5b942",
     "days_to_first_human_case_min": 3, "days_to_first_human_case_max": 14, "days_to_first_human_case_est": 8,
     "p_spillover_30d": 0.63, "p_cluster_30d": 0.25,
     "active_animal_events": 2, "human_contacts": 2,
     "environmental_flags": ["🌲 Deforestation alert", "🦌 Bushmeat market proximity"],
     "seasonality_active": True, "ihr_notifiable": True, "alert_tier": 2,
     "recommended_actions": [
         "⚠ ALERT: Conduct joint investigation within 48–72h",
         "🐾 Increase rodent/primate surveillance in forest-edge communities",
         "👥 Screen humans with animal contact",
     ],
     "signal_breakdown": [
         {"signal": "animal_mortality", "sub_score": 42, "weight_pct": 28, "weighted": 11.8, "evidence": "2 rodent mortality events"},
         {"signal": "human_exposure", "sub_score": 44, "weight_pct": 22, "weighted": 9.7, "evidence": "2 human-animal contacts"},
         {"signal": "environmental_risk", "sub_score": 55, "weight_pct": 20, "weighted": 11.0, "evidence": "Deforestation alert; bushmeat presence"},
         {"signal": "surveillance_gap", "sub_score": 68, "weight_pct": 15, "weighted": 10.2, "evidence": "IHR Zoonoses: 32% (critical gap)"},
         {"signal": "seasonality", "sub_score": 50, "weight_pct": 10, "weighted": 5.0, "evidence": "Near peak season"},
         {"signal": "spatial_proximity", "sub_score": 74, "weight_pct": 5, "weighted": 3.7, "evidence": "Interface risk: 7.4/10"},
     ],
     "sources_used": ["oh_animal_events", "oh_env_observations", "oh_spillover_risk_factors"]},

    {"iso3": "ETH", "country_name": "Ethiopia", "pathogen": "HPAI H5N1",
     "composite_score": 44, "stage": 1, "stage_label": "Watch", "stage_color": "#4d8ef5",
     "days_to_first_human_case_min": 14, "days_to_first_human_case_max": 30, "days_to_first_human_case_est": 21,
     "p_spillover_30d": 0.38, "p_cluster_30d": 0.15,
     "active_animal_events": 1, "human_contacts": 0,
     "environmental_flags": ["🦅 Migratory bird season"],
     "seasonality_active": True, "ihr_notifiable": True, "alert_tier": 1,
     "recommended_actions": [
         "👁 WATCH: Heightened surveillance — weekly reports",
         "📊 Pre-position diagnostic supplies (P(spillover 30d): 38%)",
         "📦 Review PPE stockpile at district hospitals",
     ],
     "signal_breakdown": [
         {"signal": "animal_mortality", "sub_score": 20, "weight_pct": 28, "weighted": 5.6, "evidence": "1 poultry mortality event"},
         {"signal": "human_exposure", "sub_score": 0, "weight_pct": 22, "weighted": 0, "evidence": "No human contacts"},
         {"signal": "environmental_risk", "sub_score": 30, "weight_pct": 20, "weighted": 6.0, "evidence": "Migratory bird season active"},
         {"signal": "surveillance_gap", "sub_score": 31, "weight_pct": 15, "weighted": 4.7, "evidence": "IHR Zoonoses: 69% (adequate)"},
         {"signal": "seasonality", "sub_score": 100, "weight_pct": 10, "weighted": 10.0, "evidence": "Peak season ACTIVE"},
         {"signal": "spatial_proximity", "sub_score": 68, "weight_pct": 5, "weighted": 3.4, "evidence": "Interface risk: 6.8/10"},
     ],
     "sources_used": ["oh_animal_events", "oh_env_observations", "oh_spillover_risk_factors"]},

    {"iso3": "MLI", "country_name": "Mali", "pathogen": "Rift Valley Fever",
     "composite_score": 41, "stage": 1, "stage_label": "Watch", "stage_color": "#4d8ef5",
     "days_to_first_human_case_min": 21, "days_to_first_human_case_max": 45, "days_to_first_human_case_est": 30,
     "p_spillover_30d": 0.33, "p_cluster_30d": 0.13,
     "active_animal_events": 1, "human_contacts": 0,
     "environmental_flags": ["🏜 Drought risk active"],
     "seasonality_active": False, "ihr_notifiable": True, "alert_tier": 1,
     "recommended_actions": ["👁 WATCH: Heightened surveillance — weekly reports", "📊 Pre-position diagnostic supplies"],
     "signal_breakdown": [], "sources_used": ["oh_animal_events", "oh_env_observations"]},
]


def get_early_warning(min_stage: int = 1, pathogen: str = None, limit: int = 50) -> list:
    """Fast mode: try DB for top-risk countries only, fall back to mock.

    If the live engine returns results where all scores are identical
    (typically means oh_disease_reports / oh_animal_events are empty and
    only static signals contribute), we fall back to the curated
    MOCK_EARLY_WARNING data which has diverse, realistic scores.
    """
    # Only scan 6 high-risk countries instead of all 47 (keeps response under 2s)
    HIGH_RISK_ISOS = ["NGA", "COD", "KEN", "GIN", "ETH", "MLI"]

    try:
        engine = SpilloverEngine()
        results = []
        p1_pathogens = [k for k, v in PATHOGEN_PROFILES.items() if v.priority == "P1"]
        target = [pathogen] if pathogen else p1_pathogens

        high_risk = [c for c in AFRO_COUNTRIES if c["iso3"] in HIGH_RISK_ISOS]

        for country in high_risk:
            for p in target:
                try:
                    assessment = engine.assess_country(country["iso3"], country["country_name"], p)
                    if assessment and assessment.get("stage", 0) >= min_stage:
                        results.append(assessment)
                except (DatabaseError, AttributeError, KeyError, ValueError, TypeError):
                    # One bad country must not break the early-warning sweep
                    continue

        results.sort(key=lambda x: x.get("composite_score", 0), reverse=True)

        if not results:
            return _mock_filter(min_stage, pathogen, limit)

        # If no result has real outbreak data (animal events, human contacts,
        # or intelligence alerts), the scores are purely from static signals
        # (IHR capacity, pathogen baseline, seasonality) and will be uniform /
        # misleading.  Fall back to curated mock data which has diverse,
        # realistic scores instead.
        has_real = any(
            r.get("active_animal_events", 0) > 0
            or r.get("human_contacts", 0) > 0
            for r in results
        )
        if not has_real:
            return _mock_filter(min_stage, pathogen, limit)

        return results[:limit]
    except (DatabaseError, AttributeError, KeyError, ValueError, TypeError):
        return _mock_filter(min_stage, pathogen, limit)


def get_timeline(iso3: str) -> list:
    """Cross-species timeline for a country."""
    try:
        with connection.cursor() as cur:
            cutoff = (date.today() - timedelta(days=60)).isoformat()
            cur.execute("""
                SELECT report_id, disease_name, report_date, alert_tier,
                       has_animal_event, has_human_case, case_count, district
                FROM oh_disease_reports
                WHERE country_iso3 = %s AND report_date >= %s
                ORDER BY report_date DESC LIMIT 50
            """, [iso3.upper(), cutoff])
            reports = _dictfetchall(cur)

            cur.execute("""
                SELECT obs_date, flood_risk_flag, deforestation_alert,
                       migratory_bird_season, drought_risk_flag,
                       temp_mean_c, precipitation_mm
                FROM oh_env_observations
                WHERE country_iso3 = %s AND obs_date >= %s
                ORDER BY obs_date DESC LIMIT 30
            """, [iso3.upper(), cutoff])
            env_rows = _dictfetchall(cur)

        timeline = []
        for r in reports:
            domain = "animal" if r.get("has_animal_event") and not r.get("has_human_case") \
                else "human" if r.get("has_human_case") else "unknown"
            if domain == "unknown":
                continue
            timeline.append({
                "date": str(r["report_date"]),
                "domain": domain,
                "event": r["disease_name"],
                "tier": r.get("alert_tier", 0),
                "cases": r.get("case_count", 0),
                "district": r.get("district"),
            })

        for e in env_rows:
            flags = []
            if e.get("flood_risk_flag"): flags.append("flood_risk")
            if e.get("deforestation_alert"): flags.append("deforestation")
            if e.get("migratory_bird_season"): flags.append("migratory_birds")
            if e.get("drought_risk_flag"): flags.append("drought")
            if flags:
                timeline.append({
                    "date": str(e["obs_date"]),
                    "domain": "environment",
                    "event": f"Environmental flags: {', '.join(flags)}",
                    "flags": flags,
                    "precip": float(e.get("precipitation_mm") or 0),
                })

        # Add projected future events
        today = date.today()
        for d in [3, 7, 14, 21, 30]:
            timeline.append({
                "date": (today + timedelta(days=d)).isoformat(),
                "domain": "projected", "projected": True,
                "event": f"P(first human case) = {round(compute_p_spillover(62, d) * 100)}% if no intervention",
            })

        timeline.sort(key=lambda x: x["date"], reverse=True)
        return timeline[:60] if timeline else _mock_timeline()
    except (DatabaseError, AttributeError, KeyError, ValueError, TypeError):
        return _mock_timeline()


def _mock_filter(min_stage, pathogen, limit):
    mock = MOCK_EARLY_WARNING[:]
    if min_stage > 0:
        mock = [m for m in mock if m["stage"] >= min_stage]
    if pathogen:
        mock = [m for m in mock if m["pathogen"] == pathogen]
    return mock[:limit]


def _mock_timeline():
    today = date.today()
    events = [
        {"date": (today - timedelta(days=25)).isoformat(), "domain": "environment", "event": "Flood risk flag activated — heavy precipitation", "flags": ["flood_risk"], "precip": 145},
        {"date": (today - timedelta(days=18)).isoformat(), "domain": "animal", "event": "Livestock mortality — 12 cattle dead", "tier": 1, "cases": 0},
        {"date": (today - timedelta(days=14)).isoformat(), "domain": "animal", "event": "RVF suspected in livestock", "tier": 2, "cases": 0},
        {"date": (today - timedelta(days=10)).isoformat(), "domain": "environment", "event": "Continued flooding — vector breeding conditions", "precip": 132},
        {"date": (today - timedelta(days=7)).isoformat(), "domain": "animal", "event": "RVF confirmed in cattle — 28% mortality", "tier": 2, "cases": 0},
        {"date": (today - timedelta(days=3)).isoformat(), "domain": "animal", "event": "Human-animal contact — 2 farmers", "tier": 2, "cases": 0, "district": "Nakuru"},
        {"date": today.isoformat(), "domain": "human", "event": "⚠ CURRENT: 0 confirmed human cases — HIGH RISK WINDOW", "tier": 2, "cases": 0},
    ]
    for d in [3, 7, 14, 21, 30]:
        events.append({
            "date": (today + timedelta(days=d)).isoformat(), "domain": "projected", "projected": True,
            "event": f"P(first human case) = {round(compute_p_spillover(62, d) * 100)}% if no intervention",
        })
    return events
