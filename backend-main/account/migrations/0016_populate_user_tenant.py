# Phase 2.1 — Backfill User.tenant from User.country
#
# This resolves the blocker identified in Mistake 5:
# Phase 1 added User.tenant FK but never populated it.
# All existing users have tenant_id IS NULL, which means:
#   - TenantMiddleware resolves tenant_id_for_rls = '-1' (fail-closed)
#   - AuditLog.tenant backfill populated 0 rows
#   - Under RLS, nobody can see any data
#
# Mapping: User.country (CharField) → Tenant.name (case-insensitive)
# Django superusers → AFR continental tenant (see all data)
# Empty/Unknown country → AFR continental (super admin will re-assign)

from django.db import migrations


def populate_user_tenant(apps, schema_editor):
    """Backfill User.tenant from User.country field."""
    User = apps.get_model('account', 'User')
    Tenant = apps.get_model('account', 'Tenant')

    # Build lookup: lowercased name → tenant
    tenants_by_name = {}
    tenants_by_iso = {}
    afr_tenant = None

    for t in Tenant.objects.all():
        tenants_by_name[t.name.lower()] = t
        tenants_by_iso[t.iso_code.upper()] = t
        if t.iso_code == 'AFR':
            afr_tenant = t

    if not afr_tenant:
        print("  [WARNING] No AFR continental tenant found — skipping backfill")
        return

    # Alias overrides (same as utils/tenant_mapping.py)
    aliases = {
        "tanzania": "TZA",
        "dr congo": "COD",
        "cote d'ivoire": "CIV",
        "cape verde": "CPV",
        "congo republic": "COG",
        "guinea bissau": "GNB",
        "swaziland": "SWZ",
    }
    for alias, iso in aliases.items():
        if iso in tenants_by_iso:
            tenants_by_name[alias] = tenants_by_iso[iso]

    updated = 0
    superuser_count = 0
    fallback_count = 0

    for user in User.objects.filter(tenant__isnull=True):
        # Django superusers → continental tenant
        if user.is_superuser:
            user.tenant = afr_tenant
            user.save(update_fields=['tenant'])
            superuser_count += 1
            updated += 1
            continue

        # Try matching country name
        country = (user.country or '').strip().lower()
        tenant = tenants_by_name.get(country)

        if not tenant:
            # Fallback: unrecognized country → AFR (super admin will fix)
            tenant = afr_tenant
            fallback_count += 1

        user.tenant = tenant
        user.save(update_fields=['tenant'])
        updated += 1

    print(f"  [SUCCESS] Populated tenant on {updated} users "
          f"({superuser_count} superusers -> AFR, "
          f"{fallback_count} unrecognized -> AFR fallback)")


def reverse_populate(apps, schema_editor):
    """Reverse: set all User.tenant to NULL."""
    User = apps.get_model('account', 'User')
    User.objects.all().update(tenant=None)


class Migration(migrations.Migration):

    dependencies = [
        ('account', '0015_add_auditlog_tenant'),
    ]

    operations = [
        migrations.RunPython(populate_user_tenant, reverse_populate),
    ]
