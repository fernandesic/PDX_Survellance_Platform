from django.core.management.base import BaseCommand
from django.db import transaction

from account.models import Tenant
from chwfolder.models import Country
from utils.tenant_tasks import tenant_context


# Admin0 rows from CHW_MAPPING_ADMIN0.csv that were missing from chwfolder_country.
# These 5 have a Total CHW count but no Active CHW count in the source file.
MISSING_ROWS = [
    # (iso_code, country_name, total_chws)
    ('CAF', 'Central African Republic',          7568),
    ('GNQ', 'Equatorial Guinea',                 2013),
    ('ERI', 'Eritrea',                          16005),
    ('NAM', 'Namibia',                           1142),
    ('COD', 'Democratic Republic of the Congo', 10112),
]

DATA_SOURCE = 'CHW_MAPPING_ADMIN0.csv'
DATA_FLAG = 'active_unknown'  # active count not provided by source
DATA_YEAR = 2026


class Command(BaseCommand):
    help = (
        'Insert the 5 CHW admin0 rows that were missing from chwfolder_country '
        '(CAF, GNQ, ERI, NAM, COD). Idempotent — re-runs update in place. '
        'Active CHW count is unknown for these countries; stored as 0 with '
        "data_flag='active_unknown' so the dashboard can distinguish it from a real 0%."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run', action='store_true',
            help='Print what would change without writing to the database.',
        )

    def handle(self, *args, **opts):
        # RLS: chwfolder_country has row-level security enforced. New
        # connections default to deny-all ('-1'), which causes INSERT to fail
        # the policy's WITH CHECK. Run as super-admin ('0') to bypass.
        with tenant_context('0'), transaction.atomic():
            self._seed(opts['dry_run'])

    def _seed(self, dry_run):
        created, updated, skipped = 0, 0, 0
        for iso, name, total in MISSING_ROWS:
            tenant = Tenant.objects.filter(iso_code=iso).first()
            if tenant is None:
                self.stdout.write(self.style.ERROR(
                    f'  [{iso}] no matching Tenant row — skipping.'
                ))
                skipped += 1
                continue

            existing = Country.objects.filter(iso_code=iso).first()
            action = 'UPDATE' if existing else 'CREATE'

            self.stdout.write(
                f'  [{iso}] {action}: {name} | total={total} | active=0 (unknown) | tenant={tenant.name}'
            )

            if dry_run:
                continue

            Country.objects.update_or_create(
                iso_code=iso,
                defaults={
                    'country':     name,
                    'total_chws':  total,
                    'active_chws': 0,
                    'data_flag':   DATA_FLAG,
                    'data_year':   DATA_YEAR,
                    'data_source': DATA_SOURCE,
                    'tenant':      tenant,
                },
            )
            if existing:
                updated += 1
            else:
                created += 1

        if dry_run:
            self.stdout.write(self.style.WARNING(
                f'Dry run — no changes written. Would create/update {len(MISSING_ROWS) - skipped} rows.'
            ))
        else:
            self.stdout.write(self.style.SUCCESS(
                f'Done. created={created} updated={updated} skipped={skipped}'
            ))
