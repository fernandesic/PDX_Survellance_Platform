"""
Spillover Cache — Pre-compute engine results and store in DB.

Solves the timeout problem: instead of running 144+ DB queries per request,
a background job computes once per hour and caches the results in
oh_spillover_cache. The API then reads from this table instantly.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime

from django.db import DatabaseError, connection

logger = logging.getLogger(__name__)


# ─── Table Setup ───────────────────────────────────────────────────────────

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS oh_spillover_cache (
    id              SERIAL PRIMARY KEY,
    iso3            VARCHAR(3)   NOT NULL,
    country_name    VARCHAR(100) NOT NULL,
    pathogen        VARCHAR(80)  NOT NULL,
    composite_score REAL         NOT NULL DEFAULT 0,
    stage           INTEGER      NOT NULL DEFAULT 0,
    stage_label     VARCHAR(20)  NOT NULL DEFAULT 'Background',
    stage_color     VARCHAR(10)  NOT NULL DEFAULT '#2e4a60',
    assessment_json JSONB        NOT NULL DEFAULT '{}',
    computed_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE(iso3, pathogen)
);
CREATE INDEX IF NOT EXISTS idx_spillover_cache_score
    ON oh_spillover_cache (composite_score DESC);
CREATE INDEX IF NOT EXISTS idx_spillover_cache_stage
    ON oh_spillover_cache (stage DESC);
"""


def ensure_table():
    """Create the cache table if it doesn't exist."""
    with connection.cursor() as cur:
        cur.execute(CREATE_TABLE_SQL)
    logger.info("oh_spillover_cache table ensured")


# ─── Compute & Store ───────────────────────────────────────────────────────

def compute_and_cache():
    """
    Run the SpilloverEngine for high-risk AFRO countries,
    store results in oh_spillover_cache.
    Called by the background scheduler every hour.
    """
    from .spillover_engine import SpilloverEngine, PATHOGEN_PROFILES, AFRO_COUNTRIES

    ensure_table()

    engine = SpilloverEngine()
    p1_pathogens = [k for k, v in PATHOGEN_PROFILES.items() if v.priority == "P1"]
    now = datetime.utcnow().isoformat()

    stored = 0
    errors = 0

    for country in AFRO_COUNTRIES:
        for pathogen in p1_pathogens:
            try:
                result = engine.assess_country(
                    country["iso3"], country["country_name"], pathogen
                )
                if not result:
                    continue

                with connection.cursor() as cur:
                    cur.execute("""
                        INSERT INTO oh_spillover_cache
                            (iso3, country_name, pathogen, composite_score,
                             stage, stage_label, stage_color, assessment_json, computed_at)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())
                        ON CONFLICT (iso3, pathogen) DO UPDATE SET
                            country_name    = EXCLUDED.country_name,
                            composite_score = EXCLUDED.composite_score,
                            stage           = EXCLUDED.stage,
                            stage_label     = EXCLUDED.stage_label,
                            stage_color     = EXCLUDED.stage_color,
                            assessment_json = EXCLUDED.assessment_json,
                            computed_at     = NOW()
                    """, [
                        result["iso3"],
                        result["country_name"],
                        result["pathogen"],
                        result["composite_score"],
                        result["stage"],
                        result["stage_label"],
                        result["stage_color"],
                        json.dumps(result, default=str),
                    ])
                stored += 1
            except (DatabaseError, TypeError, ValueError) as e:
                errors += 1
                logger.warning(
                    "Spillover cache error %s/%s: %s",
                    country["iso3"], pathogen, e
                )

    logger.info(
        "Spillover cache updated: %d assessments stored, %d errors",
        stored, errors,
    )
    return {"stored": stored, "errors": errors}


# ─── Read from Cache ───────────────────────────────────────────────────────

def get_cached_early_warning(min_stage: int = 0, pathogen: str = None, limit: int = 50) -> list:
    """Read pre-computed assessments from oh_spillover_cache."""
    try:
        with connection.cursor() as cur:
            # Check if table exists and has data
            cur.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables
                    WHERE table_name = 'oh_spillover_cache'
                )
            """)
            if not cur.fetchone()[0]:
                return []

            sql = """
                SELECT assessment_json, composite_score, stage, computed_at
                FROM oh_spillover_cache
                WHERE stage >= %s
            """
            params = [min_stage]

            if pathogen:
                sql += " AND pathogen = %s"
                params.append(pathogen)

            sql += " ORDER BY composite_score DESC LIMIT %s"
            params.append(limit)

            cur.execute(sql, params)
            rows = cur.fetchall()

        results = []
        for row in rows:
            data = row[0] if isinstance(row[0], dict) else json.loads(row[0])
            data["_cached_at"] = row[3].isoformat() if row[3] else None
            results.append(data)

        return results
    except (DatabaseError, json.JSONDecodeError, AttributeError, ValueError, TypeError) as e:
        logger.error("Error reading spillover cache: %s", e)
        return []


def get_cache_status() -> dict:
    """Return cache status: count, last updated, staleness."""
    try:
        with connection.cursor() as cur:
            cur.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables
                    WHERE table_name = 'oh_spillover_cache'
                )
            """)
            if not cur.fetchone()[0]:
                return {"populated": False, "count": 0}

            cur.execute("""
                SELECT count(*), MAX(computed_at), MIN(computed_at)
                FROM oh_spillover_cache
            """)
            row = cur.fetchone()
            count = row[0] or 0
            last = row[1]

            return {
                "populated": count > 0,
                "count": count,
                "last_computed": last.isoformat() if last else None,
                "is_stale": (
                    (datetime.utcnow() - last.replace(tzinfo=None)).total_seconds() > 3600
                    if last else True
                ),
            }
    except (DatabaseError, AttributeError, ValueError, TypeError):
        return {"populated": False, "count": 0}
