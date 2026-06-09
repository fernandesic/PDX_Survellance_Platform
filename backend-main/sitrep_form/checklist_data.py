"""
SITREP Form — Checklist Data & Country-Risk Mapping

Source: WHO temporary recommendations for Bundibugyo virus disease (BVD)
dated 22 May 2026 (Geneva).  See BVD_checklist.docx.

  Checklist 1 — States with documented BDBV detection (DRC and Uganda)
  Checklist 2 — All other States Parties (neighbours and the rest)
"""

# ─────────────────────────────────────────────────────────────────
# Country → Risk Tier Mapping
# ─────────────────────────────────────────────────────────────────

COUNTRY_RISK_MAP = {
    "Democratic Republic of the Congo": {"risk": "VERY_HIGH", "checklist": "1", "color": "#991b1b"},
    "Uganda":                            {"risk": "HIGH",      "checklist": "1", "color": "#dc2626"},
}

# Every other AFRO Member State falls through to Checklist 2.
DEFAULT_RISK = {"risk": "MODERATE", "checklist": "2", "color": "#d97706"}

# All 47 WHO AFRO Member States (for the dropdown)
AFRO_MEMBER_STATES = [
    "Algeria", "Angola", "Benin", "Botswana", "Burkina Faso",
    "Burundi", "Cabo Verde", "Cameroon", "Central African Republic", "Chad",
    "Comoros", "Côte d'Ivoire", "Democratic Republic of the Congo",
    "Equatorial Guinea", "Eritrea", "Eswatini", "Ethiopia",
    "Gabon", "Gambia", "Ghana", "Guinea", "Guinea-Bissau",
    "Kenya", "Lesotho", "Liberia", "Madagascar", "Malawi",
    "Mali", "Mauritania", "Mauritius", "Mozambique", "Namibia",
    "Niger", "Nigeria", "Republic of Congo", "Rwanda",
    "Sao Tome and Principe", "Senegal", "Seychelles", "Sierra Leone",
    "South Africa", "South Sudan", "Tanzania", "Togo",
    "Uganda", "Zambia", "Zimbabwe",
]

# Response pillar options for Section 4 — Action Points
PILLAR_OPTIONS = [
    "Surveillance",
    "Laboratory",
    "IPC",
    "Case management",
    "RCCE",
    "Logistics",
    "Coordination",
    "Border health",
]


# ─────────────────────────────────────────────────────────────────
# Checklist 1 — States with documented BDBV detection (DRC + Uganda)
# ─────────────────────────────────────────────────────────────────

CHECKLIST_1 = [
    {
        "category": "Coordination and high-level engagement",
        "items": [
            {"key": "c1_coord_1", "text": "Declared the BVD epidemic a health emergency (national or sub-national), per domestic laws."},
            {"key": "c1_coord_2", "text": "Activated national disaster/health emergency mechanisms and an emergency operation centre, under the Head of State or relevant authority, to coordinate response across sectors, levels and partners."},
            {"key": "c1_coord_3", "text": "Established and maintain a register of signals consistent with BVD (\"alerts\"), including investigation status."},
            {"key": "c1_coord_4", "text": "Established and maintain a line list of suspected, probable and confirmed BVD cases (including via syndromic surveillance)."},
            {"key": "c1_coord_5", "text": "Established and maintain a list of contacts of all confirmed and probable cases; each contact monitored for 21 days after last known exposure (risk-based prioritisation as needed)."},
            {"key": "c1_coord_6", "text": "Negotiated/established security corridors (including cross-border) for responders to reach communities and communities to seek care."},
            {"key": "c1_coord_7", "text": "Notify WHO (via the WHO IHR Contact Point in the Regional Office) of suspected, probable and confirmed cases on a daily basis."},
        ],
    },
    {
        "category": "Risk communication and community engagement",
        "items": [
            {"key": "c1_rcce_1", "text": "Implementing large-scale trust-building and community engagement using trusted channels, working with religious/traditional leaders and traditional healers."},
            {"key": "c1_rcce_2", "text": "Strengthening community awareness, engagement and participation, including addressing cultural barriers and integrating community feedback (esp. in the protracted humanitarian crisis in Eastern DRC)."},
            {"key": "c1_rcce_3", "text": "Training community leaders on the rationale for isolation, contact monitoring and safe burials — done in a dignified, non-stigmatising, non-punitive manner."},
            {"key": "c1_rcce_4", "text": "Activated local networks (community health workers, Red Cross volunteers, trusted actors) to promote protective behaviours, detection, referral, contact tracing and feedback."},
            {"key": "c1_rcce_5", "text": "Enabling adherence to movement restrictions by providing food, water, communication, financial and psychosocial support."},
        ],
    },
    {
        "category": "Surveillance and laboratory",
        "items": [
            {"key": "c1_surv_1", "text": "Strengthened decentralised surveillance and laboratory capacity in sub-national areas with BDBV detection and neighbouring areas (dedicated teams, active case finding, alerts investigated within 24 hours, scaled-up RT-PCR, safe sampling, biosafety training)."},
            {"key": "c1_surv_2", "text": "Noted that field labs meet biosafety standards and that any near-point-of-care assay is validated against RT-PCR. (NB: GeneXpert cannot detect Bundibugyo virus.)"},
            {"key": "c1_surv_3", "text": "Identify and monitor contacts of suspected/probable/confirmed cases for 21 days; daily health status recorded; symptomatic contacts assessed, isolated, tested and cared for."},
            {"key": "c1_surv_4", "text": "Established a mechanism to monitor indicators on contact-tracing performance."},
        ],
    },
    {
        "category": "Infection prevention and control (IPC)",
        "items": [
            {"key": "c1_ipc_1", "text": "Strengthened measures to prevent nosocomial infections (facility mapping, triage protocols, targeted IPC, monitoring/supervision)."},
            {"key": "c1_ipc_2", "text": "Providing continuous IPC training to health workers, including proper PPE use."},
            {"key": "c1_ipc_3", "text": "Providing health facilities with sufficient PPE, timely salaries and, as appropriate, hazard pay."},
            {"key": "c1_ipc_4", "text": "Established channels for health workers to report/be assessed after exposure, with psychosocial support and, where possible, post-exposure prophylaxis; all occupational exposures investigated."},
            {"key": "c1_ipc_5", "text": "Considering community IPC capacity (training leaders; facilitating hand hygiene at schools, churches, bars, markets, gatherings, points of entry)."},
        ],
    },
    {
        "category": "Patient referral pathway and intensive care",
        "items": [
            {"key": "c1_care_1", "text": "Established dedicated BVD isolation/treatment centers or units near areas with detection, with trained, equipped staff for optimized supportive care."},
            {"key": "c1_care_2", "text": "Established protocols for safe, humane patient transfer (trained ambulance teams, facility notification, IPC during transfer, vehicle/equipment decontamination)."},
            {"key": "c1_care_3", "text": "Established protocols for handling and disposal of medical waste per biosafety principles."},
            {"key": "c1_care_4", "text": "Established survivor follow-up programmes (clinical care, counselling, semen testing, sexual health advice/condoms, psychosocial support, stigma reduction)."},
            {"key": "c1_care_5", "text": "Maintaining the package of essential health services (at minimum malaria diagnosis/treatment and maternal & child health) with IPC equipment to operate safely."},
        ],
    },
    {
        "category": "Safe and dignified burials",
        "items": [
            {"key": "c1_burial_1", "text": "Established protocols so funerals/burials are conducted by trained personnel, allowing family presence and cultural practices, per national laws."},
        ],
    },
    {
        "category": "Operations, supplies and logistics",
        "items": [
            {"key": "c1_ops_1", "text": "Established logistics support for a robust supply pipeline (PPE, diagnostics, therapeutics, IPC and safe-burial materials)."},
        ],
    },
    {
        "category": "Border health, international travel and mass gatherings",
        "items": [
            {"key": "c1_border_1", "text": "Enhanced surveillance at ground crossings/border areas through arrangements between bordering countries."},
            {"key": "c1_border_2", "text": "Implementing measures to prevent suspected/probable/confirmed cases and their contacts from international travel (except appropriate medical evacuation)."},
            {"key": "c1_border_3", "text": "Preventing cross-border movement of human remains of suspected/probable/confirmed cases unless authorised by bilateral arrangement."},
            {"key": "c1_border_4", "text": "Implementing exit screening at all points of entry (questionnaire on exposure, temperature check, in-depth assessment if febrile, by trained PPE-equipped staff); ill travellers not allowed to travel except for medical evacuation."},
            {"key": "c1_border_5", "text": "Report to WHO any international-traffic measure adopted."},
            {"key": "c1_border_6", "text": "Considering postponing mass gatherings until transmission is interrupted."},
        ],
    },
    {
        "category": "Research and development of medical countermeasures",
        "items": [
            {"key": "c1_research_1", "text": "Engaging research partners to define a laboratory strategy and run head-to-head PCR comparison studies to validate/invalidate the platform used in the field (Radione®)."},
            {"key": "c1_research_2", "text": "Implementing ethically approved, robust clinical trials for candidate therapeutics (treatment & post-exposure prophylaxis) and vaccines."},
            {"key": "c1_research_3", "text": "Established expedited national regulatory/ethics reviews, community engagement, pharmacovigilance, data sharing and equitable access arrangements."},
        ],
    },
]


# ─────────────────────────────────────────────────────────────────
# Checklist 2 — All other States Parties
# ─────────────────────────────────────────────────────────────────

CHECKLIST_2 = [
    {
        "category": "Coordination, surveillance and readiness",
        "items": [
            {"key": "c2_ready_1", "text": "Established a national coordination mechanism articulated with subnational levels."},
            {"key": "c2_ready_2", "text": "Rapidly enhanced readiness to respond to BVD cases: active surveillance across health facilities with zero reporting; community-based surveillance for clusters of unexplained deaths; access to qualified labs; health-worker awareness; IPC training; rapid response teams; a mechanism for contact identification and monitoring."},
            {"key": "c2_ready_3", "text": "Established capacity at national reference laboratory(ies) to test for BDBV safely and timely, with relevant differential testing (and consider shipment to an international reference lab for inter-lab comparison / external QA)."},
            {"key": "c2_ready_4", "text": "Conducting international contact-tracing as necessary (obtaining info from airlines/conveyances, identifying contacts on international voyages, communicating with destination States Parties)."},
            {"key": "c2_ready_5", "text": "Intensified risk communication and community engagement in border communities and points of entry connected to states with detection; public given accurate, up-to-date information."},
            {"key": "c2_ready_6", "text": "Exercising arrangements through simulation exercises (managing alerts incl. cross-border, sample referral, activating rapid response teams/mechanisms)."},
            {"key": "c2_ready_7", "text": "Established expedited national regulatory/ethics reviews, community engagement, pharmacovigilance, data sharing and equitable access arrangements."},
        ],
    },
    {
        "category": "Border health and international travel",
        "items": [
            {"key": "c2_border_1", "text": "Providing travellers with accurate, up-to-date information and discouraging travel to areas with documented BDBV detection."},
            {"key": "c2_border_2", "text": "Enhanced surveillance at ground crossings via arrangements between bordering countries (coordination for detecting/assessing febrile travellers; timely sharing of contact information across borders for continuity of follow-up)."},
            {"key": "c2_border_3", "text": "Pre-positioned PPE, IPC materials, sample-collection kits, case investigation forms and safe-burial supplies in border areas adjacent to those with detection."},
            {"key": "c2_border_4", "text": "Activated health contingency plans at airports/ports (with conveyance operators) to detect, assess and manage symptomatic travellers from states with detection and identify their contacts (trained personnel, referral mechanisms, IPC measures)."},
            {"key": "c2_border_5", "text": "Coordinating with conveyance operators for timely pre-arrival communication of suspected cases and identification of contacts on international voyages (incl. sharing personal details with destination States Parties)."},
            {"key": "c2_border_6", "text": "Noted: at this time, neither suspension of flights/waterway routes nor denial of entry to travellers/conveyances from states with detection is recommended."},
            {"key": "c2_border_7", "text": "Report to WHO any international-traffic measure adopted."},
        ],
    },
    {
        "category": "Emergency declaration and notification",
        "items": [
            {"key": "c2_emerg_1", "text": "Treating as a health emergency (incl. formal declaration per domestic laws) the detection of a suspected/confirmed case, a contact, or a cluster of unexplained deaths — investigating within 24 hours, isolating/managing cases, establishing definitive diagnosis, and identifying/monitoring contacts."},
            {"key": "c2_emerg_2", "text": "Notify WHO immediately (via the WHO IHR Contact Point) of any suspected, probable or confirmed case. NB: once a case is present, the recommendations for States with documented detection (Checklist 1) apply."},
        ],
    },
]


def get_country_risk(country_name):
    """Get risk tier and checklist id for a country."""
    return COUNTRY_RISK_MAP.get(country_name, DEFAULT_RISK)


def get_checklist(checklist_id):
    """Get checklist data by id ('1' or '2')."""
    return CHECKLIST_1 if str(checklist_id) == "1" else CHECKLIST_2
