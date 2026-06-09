"""Backfill AuditLog.tenant from user.tenant for rows where user is set."""
import django, os, sys
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'datarepr.settings.base')
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
django.setup()

from django.db import connection

with connection.cursor() as c:
    # Before
    c.execute("SELECT COUNT(*), COUNT(tenant_id) FROM account_auditlog")
    total, with_tenant = c.fetchone()
    print(f"BEFORE: {total} total, {with_tenant} with tenant, {total - with_tenant} null")

    # Backfill from user_id -> user.tenant_id
    c.execute("""
        UPDATE account_auditlog al
        SET tenant_id = u.tenant_id
        FROM account_user u
        WHERE al.user_id = u.id
          AND al.tenant_id IS NULL
          AND u.tenant_id IS NOT NULL
    """)
    updated = c.rowcount
    print(f"UPDATED: {updated} rows (from user.tenant_id)")

    # After
    c.execute("SELECT COUNT(*), COUNT(tenant_id) FROM account_auditlog")
    total2, with_tenant2 = c.fetchone()
    print(f"AFTER: {total2} total, {with_tenant2} with tenant, {total2 - with_tenant2} null")

    # Show remaining null breakdown
    c.execute("""
        SELECT 
            CASE WHEN al.user_id IS NULL THEN 'anonymous' ELSE 'has_user' END AS user_state,
            COUNT(*) 
        FROM account_auditlog al
        WHERE al.tenant_id IS NULL
        GROUP BY user_state
    """)
    print("Remaining null breakdown:")
    for row in c.fetchall():
        print(f"  {row[0]}: {row[1]}")
