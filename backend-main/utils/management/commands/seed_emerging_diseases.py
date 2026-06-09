"""
Seed emerging-pathogen disease keywords + retroactively classify scraped
sentinel signals that the original detector missed.

Discovered while debugging the Cape Verde MV Hondius hantavirus cluster
(May 2026): 10 real news articles ingested but disease_name = NULL because
'hantavirus' wasn't in DiseaseKeyword. The AFRO-only oh_alerts converter
silently dropped all of them.

This command:
  1. Inserts (or updates) DiseaseKeyword rows for emerging pathogens
     that frequently appear in surveillance feeds but were missing.
  2. Re-runs the disease detector across every sentinel_signal whose
     disease_name is NULL, populating it where text now matches.

Run after deploying so newly-recognised diseases populate, then run
`import_sentinel_to_oh_alerts` to flow them into oh_alerts.

Usage:
    python manage.py seed_emerging_diseases
"""
from django.core.management.base import BaseCommand
from django.db import connection

from utils.tenant_tasks import tenant_context


# Disease keyword seed — focused on pathogens that appeared in real surveillance
# feeds without being detected. Add to this list as new gaps are found.
EMERGING_DISEASES = [
    {
        "disease_name": "Hantavirus Pulmonary Syndrome",
        "category": "VIRAL_HAEMORRHAGIC",
        "default_priority": "P1",
        "keywords_en": [
            "hantavirus", "hanta virus", "hantaviral",
            "andes virus", "andv",
            "hantavirus pulmonary syndrome", "hps",
            "sin nombre virus", "puumala virus",
            "haemorrhagic fever with renal syndrome",
            "hemorrhagic fever with renal syndrome", "hfrs",
        ],
        "transmission_routes": ["rodent_excreta", "aerosol", "human_to_human_rare"],
        "case_fatality_rate": 35.0,
    },
    {
        "disease_name": "Nipah virus",
        "category": "VIRAL",
        "default_priority": "P1",
        "keywords_en": ["nipah", "nipah virus", "niv"],
        "transmission_routes": ["bat_to_human", "human_to_human"],
        "case_fatality_rate": 70.0,
    },
    {
        "disease_name": "Rift Valley Fever",
        "category": "ZOONOTIC",
        "default_priority": "P1",
        "keywords_en": ["rift valley fever", "rvf"],
        "transmission_routes": ["mosquito", "livestock_contact"],
        "case_fatality_rate": 1.0,
    },
    {
        "disease_name": "Crimean-Congo Haemorrhagic Fever",
        "category": "VIRAL_HAEMORRHAGIC",
        "default_priority": "P1",
        "keywords_en": [
            "crimean-congo haemorrhagic fever", "crimean congo hemorrhagic fever",
            "cchf", "crimean-congo", "crimean congo",
        ],
        "transmission_routes": ["tick_bite", "livestock_contact"],
        "case_fatality_rate": 30.0,
    },
    {
        "disease_name": "Lassa Fever",
        "category": "VIRAL_HAEMORRHAGIC",
        "default_priority": "P1",
        "keywords_en": ["lassa", "lassa fever", "lassa virus"],
        "transmission_routes": ["rodent_excreta", "human_to_human"],
        "case_fatality_rate": 15.0,
    },
    {
        "disease_name": "Marburg",
        "category": "VIRAL_HAEMORRHAGIC",
        "default_priority": "P1",
        "keywords_en": [
            "marburg", "marburg virus", "marburg viral disease",
            "marv", "marburgvirus",
        ],
        "transmission_routes": ["bat_to_human", "human_to_human"],
        "case_fatality_rate": 50.0,
    },
    {
        "disease_name": "Mpox",
        "category": "VIRAL",
        "default_priority": "P1",
        "keywords_en": [
            "mpox", "monkeypox", "mpox clade i", "mpox clade ii",
            "mpxv", "monkeypox virus",
        ],
        "transmission_routes": ["close_contact", "respiratory"],
        "case_fatality_rate": 4.0,
    },
    {
        "disease_name": "Ebola Virus Disease",
        "category": "VIRAL_HAEMORRHAGIC",
        "default_priority": "P1",
        "keywords_en": [
            "ebola", "ebola virus", "ebola virus disease", "evd",
            "sudan ebolavirus", "zaire ebolavirus", "bundibugyo ebolavirus",
        ],
        "transmission_routes": ["body_fluid", "human_to_human"],
        "case_fatality_rate": 50.0,
    },
]


UPSERT_SQL = """
INSERT INTO sentinel_diseasekeyword (
    disease_name, category, default_priority,
    keywords_en, keywords_fr, keywords_pt, keywords_ar,
    keywords_sw, keywords_ha, keywords_yo, keywords_am,
    symptoms_cluster, endemic_regions,
    case_fatality_rate, incubation_days_min, incubation_days_max,
    transmission_routes,
    created_at, updated_at
) VALUES (
    %s, %s, %s,
    %s::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
    '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
    '[]'::jsonb, '[]'::jsonb,
    %s, NULL, NULL,
    %s::jsonb,
    NOW(), NOW()
)
ON CONFLICT (disease_name) DO UPDATE SET
    category          = EXCLUDED.category,
    default_priority  = EXCLUDED.default_priority,
    keywords_en       = EXCLUDED.keywords_en,
    transmission_routes = EXCLUDED.transmission_routes,
    case_fatality_rate  = EXCLUDED.case_fatality_rate,
    updated_at        = NOW()
"""


class Command(BaseCommand):
    help = "Seed emerging-pathogen disease keywords and re-classify orphan signals."

    def handle(self, *args, **options):
        import json
        with tenant_context('0'):
            with connection.cursor() as cur:
                # ── Step 1: upsert keyword rows ──────────────────────────
                self.stdout.write(self.style.HTTP_INFO("\n=== Seeding disease keywords ==="))
                for d in EMERGING_DISEASES:
                    cur.execute(UPSERT_SQL, [
                        d["disease_name"],
                        d["category"],
                        d["default_priority"],
                        json.dumps(d.get("keywords_en", [])),
                        d.get("case_fatality_rate"),
                        json.dumps(d.get("transmission_routes", [])),
                    ])
                    self.stdout.write(f"  ✓ {d['disease_name']} ({len(d['keywords_en'])} keywords)")

            # Invalidate the in-memory cache so the detector re-reads
            try:
                from sentinel.disease_detector import disease_detector
                disease_detector.invalidate_cache()
            except Exception:
                pass

            # ── Step 2: re-classify orphan signals ────────────────────
            self.stdout.write(self.style.HTTP_INFO("\n=== Re-classifying signals where disease_name IS NULL ==="))
            from sentinel.disease_detector import DiseaseDetector
            detector = DiseaseDetector()

            with connection.cursor() as cur:
                cur.execute("""
                    SELECT id, original_text, translated_text
                    FROM sentinel_signal
                    WHERE disease_name IS NULL
                      AND status NOT IN ('DISMISSED', 'RESOLVED', 'CLOSED')
                """)
                rows = cur.fetchall()

                updated = 0
                for sid, orig, trans in rows:
                    text = (trans or "") + " " + (orig or "")
                    detection = detector.get_primary_disease(text)
                    if detection and detection.get("name"):
                        cur.execute("""
                            UPDATE sentinel_signal
                            SET disease_name = %s, disease_category = %s,
                                confidence_score = %s
                            WHERE id = %s
                        """, [
                            detection["name"],
                            detection.get("category") or "UNKNOWN",
                            detection.get("confidence") or 60,
                            sid,
                        ])
                        updated += 1

            self.stdout.write(self.style.SUCCESS(
                f"  Re-classified {updated}/{len(rows)} previously-orphan signals."
            ))

        self.stdout.write(self.style.SUCCESS(
            "\n✓ Done. Now run:\n"
            "    python manage.py import_sentinel_to_oh_alerts --since-hours 168 --verbose-rows\n"
            "  to flow the newly-recognised events into oh_alerts."
        ))
