-- =================================================================
-- RLS Audit (read-only)
-- =================================================================
-- Purpose: Map the current state of every tenant-scoped table on
-- the live DB. Pure SELECT. Safe to run anytime.
--
-- Usage:
--   python manage.py dbshell < scripts/rls_audit.sql
--
-- What it answers:
--   1. Is the Tenant table seeded? (expect 48 rows: 47 countries + 1 AFR)
--   2. Per tenant-scoped table: row count, NULL tenant_id count,
--      tenant distribution (top 10).
--   3. Are RLS policies set yet? (expect: NO — Phase 3 not started)
--   4. What roles exist and which is the application using?
--
-- Nothing in this script writes, inserts, updates, or deletes.
-- =================================================================

\echo '=== 1. Tenant table check (expect 48 rows) ==='
SELECT COUNT(*) AS tenant_count,
       SUM(CASE WHEN is_continental THEN 1 ELSE 0 END) AS continental_count,
       SUM(CASE WHEN is_continental THEN 0 ELSE 1 END) AS country_count
FROM account_tenant;

\echo ''
\echo '=== 2. AFR continental tenant (must exist for resolve_tenant fallback) ==='
SELECT id, name, iso_code, is_continental, is_active
FROM account_tenant
WHERE is_continental = TRUE;

\echo ''
\echo '=== 3. User.tenant population (should be 100% non-null after backfill) ==='
SELECT COUNT(*) AS total_users,
       COUNT(tenant_id) AS users_with_tenant,
       COUNT(*) - COUNT(tenant_id) AS users_with_null_tenant
FROM account_user;

\echo ''
\echo '=== 4. Per-table tenant_id NULL counts (NOT NULL tables should be 0) ==='
\echo '--- sentinel_signal ---'
SELECT COUNT(*) AS total, COUNT(tenant_id) AS with_tenant, COUNT(*)-COUNT(tenant_id) AS null_tenant FROM sentinel_signal;
\echo '--- hdis_alert ---'
SELECT COUNT(*) AS total, COUNT(tenant_id) AS with_tenant, COUNT(*)-COUNT(tenant_id) AS null_tenant FROM hdis_alert;
\echo '--- hdis_trustscore ---'
SELECT COUNT(*) AS total, COUNT(tenant_id) AS with_tenant, COUNT(*)-COUNT(tenant_id) AS null_tenant FROM hdis_trustscore;
\echo '--- hdis_briefing ---'
SELECT COUNT(*) AS total, COUNT(tenant_id) AS with_tenant, COUNT(*)-COUNT(tenant_id) AS null_tenant FROM hdis_briefing;
\echo '--- hdis_pro_generation_job ---'
SELECT COUNT(*) AS total, COUNT(tenant_id) AS with_tenant, COUNT(*)-COUNT(tenant_id) AS null_tenant FROM hdis_pro_generation_job;
\echo '--- predictions_outbreakprediction ---'
SELECT COUNT(*) AS total, COUNT(tenant_id) AS with_tenant, COUNT(*)-COUNT(tenant_id) AS null_tenant FROM predictions_outbreakprediction;
\echo '--- predictions_forecastdata ---'
SELECT COUNT(*) AS total, COUNT(tenant_id) AS with_tenant, COUNT(*)-COUNT(tenant_id) AS null_tenant FROM predictions_forecastdata;
\echo '--- stardata_stardata ---'
SELECT COUNT(*) AS total, COUNT(tenant_id) AS with_tenant, COUNT(*)-COUNT(tenant_id) AS null_tenant FROM stardata_stardata;
\echo '--- stardata_starcandlestick ---'
SELECT COUNT(*) AS total, COUNT(tenant_id) AS with_tenant, COUNT(*)-COUNT(tenant_id) AS null_tenant FROM stardata_starcandlestick;
\echo '--- pami_pamidata ---'
SELECT COUNT(*) AS total, COUNT(tenant_id) AS with_tenant, COUNT(*)-COUNT(tenant_id) AS null_tenant FROM pami_pamidata;
\echo '--- espar_espar ---'
SELECT COUNT(*) AS total, COUNT(tenant_id) AS with_tenant, COUNT(*)-COUNT(tenant_id) AS null_tenant FROM espar_espar;
\echo '--- ihmref_ihmrefcountry ---'
SELECT COUNT(*) AS total, COUNT(tenant_id) AS with_tenant, COUNT(*)-COUNT(tenant_id) AS null_tenant FROM ihmref_ihmrefcountry;
\echo '--- chwfolder tables ---'
SELECT 'chwfolder_country' AS tbl, COUNT(*) AS total, COUNT(tenant_id) AS with_tenant, COUNT(*)-COUNT(tenant_id) AS null_tenant FROM chwfolder_country
UNION ALL SELECT 'chwfolder_region', COUNT(*), COUNT(tenant_id), COUNT(*)-COUNT(tenant_id) FROM chwfolder_region
UNION ALL SELECT 'chwfolder_district', COUNT(*), COUNT(tenant_id), COUNT(*)-COUNT(tenant_id) FROM chwfolder_district
UNION ALL SELECT 'chwfolder_workertype', COUNT(*), COUNT(tenant_id), COUNT(*)-COUNT(tenant_id) FROM chwfolder_workertype
UNION ALL SELECT 'chwfolder_facility', COUNT(*), COUNT(tenant_id), COUNT(*)-COUNT(tenant_id) FROM chwfolder_facility
UNION ALL SELECT 'chwfolder_dataupload', COUNT(*), COUNT(tenant_id), COUNT(*)-COUNT(tenant_id) FROM chwfolder_dataupload;

\echo ''
\echo '=== 5. AuditLog (legitimately nullable per Mistake 4) ==='
SELECT COUNT(*) AS total, COUNT(tenant_id) AS with_tenant, COUNT(*)-COUNT(tenant_id) AS null_tenant FROM account_auditlog;

\echo ''
\echo '=== 6. Verify orphan FKs are GONE (column should NOT exist) ==='
\echo '--- espar_indicator: tenant_id column should be missing ---'
SELECT column_name FROM information_schema.columns WHERE table_name = 'espar_indicator' AND column_name = 'tenant_id';
\echo '--- ihmref_countryincident: tenant_id column should be missing ---'
SELECT column_name FROM information_schema.columns WHERE table_name = 'ihmref_countryincident' AND column_name = 'tenant_id';

\echo ''
\echo '=== 7. RLS state — expect ALL false until Phase 3 ==='
SELECT c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
  AND n.nspname = 'public'
  AND (c.relrowsecurity OR c.relforcerowsecurity)
ORDER BY c.relname;

\echo ''
\echo '=== 8. Existing RLS policies — expect zero rows until Phase 3 ==='
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

\echo ''
\echo '=== 9. Application role identity (informational) ==='
SELECT current_user AS connected_as,
       (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS is_superuser,
       (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypass_rls;

\echo ''
\echo '=== 10. Top-10 tenant distribution in largest tables (sanity) ==='
\echo '--- top 10 tenants by sentinel_signal count ---'
SELECT t.iso_code, t.name, COUNT(s.id) AS signal_count
FROM account_tenant t
LEFT JOIN sentinel_signal s ON s.tenant_id = t.id
GROUP BY t.id, t.iso_code, t.name
HAVING COUNT(s.id) > 0
ORDER BY signal_count DESC
LIMIT 10;

\echo '--- top 10 tenants by predictions_forecastdata count ---'
SELECT t.iso_code, t.name, COUNT(f.id) AS forecast_count
FROM account_tenant t
LEFT JOIN predictions_forecastdata f ON f.tenant_id = t.id
GROUP BY t.id, t.iso_code, t.name
HAVING COUNT(f.id) > 0
ORDER BY forecast_count DESC
LIMIT 10;

\echo ''
\echo '=== Audit complete ==='
