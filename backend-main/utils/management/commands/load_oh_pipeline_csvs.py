"""
Load pipeline.py output CSVs into the local Postgres oh_* tables.

The pipeline.py module fetches real data from World Bank, WHO GHO, IHR
SPAR, FAOSTAT, FSI, GHS Index, Global Forest Watch, WOAH WAHIS, NASA
POWER, and (optionally) ACLED, but its `push_to_supabase` step only
writes to a Supabase REST endpoint. When the Django backend uses local
Postgres (or any non-Supabase Postgres), this loader is the bridge.

Workflow:
    # 1. Fetch real data into CSVs (~30 min, hits external APIs)
    python -m onehealth.pipeline --fetch-only --skip-acled --output-dir /tmp/oh-data

    # 2. Merge into final-table DataFrames + write CSVs (already done above)
    python -m onehealth.pipeline --merge-only --skip-acled --output-dir /tmp/oh-data

    # 3. UPSERT those CSVs into local Postgres
    python manage.py load_oh_pipeline_csvs /tmp/oh-data

The loader handles 5 reference tables:
    oh_countries
    oh_pathogen_profiles
    oh_vector_ecology
    oh_host_ecology
    oh_spillover_risk_factors

Idempotent: uses ON CONFLICT DO UPDATE so re-running is safe.
"""
from pathlib import Path

import pandas as pd
from django.core.management.base import BaseCommand
from django.db import connection

from utils.tenant_tasks import tenant_context


# Map: csv filename → (table, primary key column(s))
TABLE_SPEC = [
    ("oh_countries.csv",                "oh_countries",                ["iso3"]),
    ("oh_pathogen_profiles.csv",        "oh_pathogen_profiles",        ["disease"]),
    ("oh_vector_ecology.csv",           "oh_vector_ecology",           ["country_iso3"]),
    ("oh_host_ecology.csv",             "oh_host_ecology",             ["country_iso3"]),
    ("oh_spillover_risk_factors.csv",   "oh_spillover_risk_factors",   ["country_iso3"]),
]


def _get_existing_columns(cur, table):
    cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name = %s
    """, [table])
    return {r[0] for r in cur.fetchall()}


def _upsert_dataframe(cur, df, table, pk_cols):
    """UPSERT every row of df into table, keying on pk_cols.

    Skips columns in the CSV that don't exist on the target table so
    schema drift doesn't crash the load.
    """
    if df is None or df.empty:
        return 0, "empty CSV"

    existing = _get_existing_columns(cur, table)
    if not existing:
        return 0, f"table {table} not found"

    cols = [c for c in df.columns if c in existing]
    skipped = [c for c in df.columns if c not in existing]
    if not cols:
        return 0, "no matching columns"
    if not all(pk in cols for pk in pk_cols):
        return 0, f"primary key {pk_cols} not in CSV/table intersection"

    placeholders = ", ".join(["%s"] * len(cols))
    col_list = ", ".join(cols)
    pk_list = ", ".join(pk_cols)
    update_cols = [c for c in cols if c not in pk_cols]
    if update_cols:
        set_clause = ", ".join(f"{c} = EXCLUDED.{c}" for c in update_cols)
        sql = (f"INSERT INTO {table} ({col_list}) VALUES ({placeholders}) "
               f"ON CONFLICT ({pk_list}) DO UPDATE SET {set_clause}")
    else:
        sql = (f"INSERT INTO {table} ({col_list}) VALUES ({placeholders}) "
               f"ON CONFLICT ({pk_list}) DO NOTHING")

    inserted = 0
    for _, row in df.iterrows():
        # Convert NaN → None so psycopg2 sends NULL
        values = [None if pd.isna(row[c]) else row[c] for c in cols]
        try:
            cur.execute(sql, values)
            inserted += 1
        except Exception as e:
            # Don't abort whole load on one bad row
            print(f"    row failed ({pk_cols}=" +
                  ", ".join(str(row[c]) for c in pk_cols) +
                  f"): {e}")

    note = f"inserted/updated {inserted}/{len(df)}"
    if skipped:
        note += f"; skipped extra cols: {skipped[:5]}{'…' if len(skipped) > 5 else ''}"
    return inserted, note


class Command(BaseCommand):
    help = "Load pipeline.py output CSVs into local Postgres oh_* tables."

    def add_arguments(self, parser):
        parser.add_argument(
            "output_dir",
            help="Directory containing pipeline.py CSV outputs",
        )
        parser.add_argument(
            "--only", nargs="+",
            help="Only load these tables (default: all)",
        )

    def handle(self, *args, **opts):
        outdir = Path(opts["output_dir"])
        if not outdir.exists():
            self.stderr.write(self.style.ERROR(f"directory not found: {outdir}"))
            return

        only = set(opts["only"]) if opts["only"] else None

        with tenant_context('0'):
            with connection.cursor() as cur:
                for fname, table, pk_cols in TABLE_SPEC:
                    if only and table not in only:
                        continue
                    path = outdir / fname
                    if not path.exists():
                        self.stdout.write(self.style.WARNING(
                            f"  {table:32s} — CSV missing: {fname}"
                        ))
                        continue
                    try:
                        df = pd.read_csv(path)
                    except Exception as e:
                        self.stdout.write(self.style.ERROR(
                            f"  {table:32s} — read failed: {e}"
                        ))
                        continue

                    inserted, note = _upsert_dataframe(cur, df, table, pk_cols)
                    style = self.style.SUCCESS if inserted > 0 else self.style.WARNING
                    self.stdout.write(style(f"  {table:32s} — {note}"))

        self.stdout.write(self.style.SUCCESS("\nReference data load complete."))
