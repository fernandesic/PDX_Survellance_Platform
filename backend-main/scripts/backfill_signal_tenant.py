"""Backfill 18 sentinel_signal rows with NULL tenant_id. One UPDATE, then verify."""
import django, os, sys
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'datarepr.settings.base')
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
django.setup()

from django.db import connection

with connection.cursor() as c:
    # Before count
    c.execute("SELECT COUNT(*) FROM sentinel_signal WHERE tenant_id IS NULL")
    before = c.fetchone()[0]
    print(f"BEFORE: {before} rows with NULL tenant_id")

    # Backfill
    c.execute("""
        UPDATE sentinel_signal s
        SET tenant_id = t.id
        FROM account_tenant t
        WHERE s.tenant_id IS NULL
          AND t.iso_code = s.location_country_iso
    """)
    updated = c.rowcount
    print(f"UPDATED: {updated} rows")

    # Check if any still NULL (e.g. iso didn't match)
    c.execute("SELECT COUNT(*) FROM sentinel_signal WHERE tenant_id IS NULL")
    after = c.fetchone()[0]
    print(f"AFTER: {after} rows with NULL tenant_id")

    if after > 0:
        # Show remaining for manual review
        c.execute("SELECT id, location_country_iso FROM sentinel_signal WHERE tenant_id IS NULL")
        print(f"  Remaining NULL rows: {c.fetchall()}")
        # Fallback: set remaining to AFR
        c.execute("""
            UPDATE sentinel_signal
            SET tenant_id = (SELECT id FROM account_tenant WHERE is_continental = TRUE LIMIT 1)
            WHERE tenant_id IS NULL
        """)
        fallback = c.rowcount
        print(f"  Fallback to AFR: {fallback} rows")
        c.execute("SELECT COUNT(*) FROM sentinel_signal WHERE tenant_id IS NULL")
        final = c.fetchone()[0]
        print(f"  FINAL: {final} rows with NULL tenant_id")
    else:
        print("All sentinel_signal rows now have tenant_id. Clean.")

    # Sanity: total count
    c.execute("SELECT COUNT(*) FROM sentinel_signal")
    print(f"Total sentinel_signal rows: {c.fetchone()[0]}")
