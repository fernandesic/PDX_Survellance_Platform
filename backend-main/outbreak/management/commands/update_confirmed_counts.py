"""
update_confirmed_counts — populate Outbreak.confirmed_cases / deaths / as_of /
source for an active outbreak from an authoritative source (WHO DON or
Ministry sitrep).

Usage (CLI flag form, for one-off updates):
    python manage.py update_confirmed_counts \\
        --pathogen "Ebola Virus Disease" --iso3 COD \\
        --cases 248 --deaths 65 --as-of 2026-05-17 \\
        --source "WHO DON 2026-05-17 — https://www.who.int/emergencies/disease-outbreak-news/item/..."

Usage (registry form, for the current PHEIC — idempotent re-runs):
    python manage.py update_confirmed_counts --use-registry

The registry below is the curated list of latest authoritative figures we
have ingested manually. Update entries here whenever a new sitrep is
published — committing this file is the audit trail until a live
MinistrySitrepAdaptor lands.

Per arc.md / best-code-practice.md rule 2 ("no fake data"): every entry
MUST carry a source citation. Entries without a source are rejected.
"""

import argparse
from datetime import datetime, timezone as dt_timezone

from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from outbreak.models import Outbreak


# ── Curated registry of latest confirmed counts ─────────────────────
#
# Keyed by (pathogen_name, iso3). When you receive a new WHO DON or
# Ministry sitrep, replace the matching entry. Old entries are not
# preserved here — git history is the audit trail.
#
# `as_of`: the date the sitrep itself is dated (NOT today's date).
# `source`: the full citation. WHO DON URL preferred; if Ministry-only,
#   include sitrep title + date.
REGISTRY: list[dict] = [
    {
        'pathogen': 'Ebola Virus Disease',
        'iso3': 'COD',
        'cases': 248,
        'deaths': 65,
        'as_of': '2026-05-17',
        'source': (
            'WHO DON 2026-05-17 — Ebola Virus Disease (Bundibugyo) — '
            'Democratic Republic of the Congo. '
            'https://www.who.int/emergencies/disease-outbreak-news/'
        ),
    },
]


def _parse_date(s: str):
    """Accept YYYY-MM-DD or full ISO 8601. Returns aware datetime in UTC."""
    s = s.strip()
    try:
        dt = datetime.fromisoformat(s.replace('Z', '+00:00'))
    except ValueError:
        try:
            dt = datetime.strptime(s, '%Y-%m-%d')
        except ValueError as e:
            raise CommandError(f'--as-of must be YYYY-MM-DD or ISO 8601, got {s!r}: {e}')
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=dt_timezone.utc)
    return dt


class Command(BaseCommand):
    help = (
        'Update Outbreak.confirmed_cases / deaths / as_of / source from an '
        'authoritative source. Use --use-registry to apply the bundled '
        'curated list, or pass --pathogen / --iso3 / --cases / --deaths / '
        '--as-of / --source for a one-off update.'
    )

    def add_arguments(self, parser: argparse.ArgumentParser):
        parser.add_argument('--use-registry', action='store_true',
                            help='Apply every entry from REGISTRY in this file.')
        parser.add_argument('--pathogen', help='Pathogen name (exact match).')
        parser.add_argument('--iso3', help='Country ISO3 code (epicenter).')
        parser.add_argument('--cases', type=int,
                            help='Confirmed + probable case count from sitrep.')
        parser.add_argument('--deaths', type=int,
                            help='Confirmed death count from sitrep.')
        parser.add_argument('--as-of', dest='as_of',
                            help='Date of the sitrep (YYYY-MM-DD or ISO 8601).')
        parser.add_argument('--source',
                            help='Citation — WHO DON URL or sitrep label.')

    def handle(self, *args, **options):
        if options['use_registry']:
            self._apply_registry()
            return

        # CLI form — all fields required.
        required = ['pathogen', 'iso3', 'cases', 'deaths', 'as_of', 'source']
        missing = [r for r in required if not options.get(r) and options.get(r) != 0]
        if missing:
            raise CommandError(
                f'Missing required flags: {", ".join("--" + m.replace("_", "-") for m in missing)}. '
                f'Or pass --use-registry to apply the bundled entries.'
            )

        self._apply_one(
            pathogen=options['pathogen'],
            iso3=options['iso3'],
            cases=int(options['cases']),
            deaths=int(options['deaths']),
            as_of=_parse_date(options['as_of']),
            source=options['source'].strip(),
        )

    # ── Internals ──────────────────────────────────────────────────

    def _apply_registry(self):
        if not REGISTRY:
            self.stdout.write(self.style.WARNING('REGISTRY is empty — nothing to do.'))
            return
        applied = 0
        for entry in REGISTRY:
            try:
                self._apply_one(
                    pathogen=entry['pathogen'],
                    iso3=entry['iso3'],
                    cases=int(entry['cases']),
                    deaths=int(entry['deaths']),
                    as_of=_parse_date(entry['as_of']),
                    source=entry['source'].strip(),
                )
                applied += 1
            except CommandError as e:
                self.stdout.write(self.style.WARNING(f'  skipped: {e}'))
        self.stdout.write(self.style.SUCCESS(
            f'\nRegistry applied: {applied}/{len(REGISTRY)} entries updated.'
        ))

    def _apply_one(self, *, pathogen: str, iso3: str, cases: int, deaths: int,
                   as_of, source: str):
        if not source:
            raise CommandError(
                f'Refusing to update {pathogen}/{iso3}: source citation is empty. '
                f'Every confirmed-count update MUST carry a source (rule 2).'
            )
        if deaths > cases:
            raise CommandError(
                f'Refusing to update {pathogen}/{iso3}: deaths ({deaths}) > '
                f'cases ({cases}) is invalid.'
            )

        # Update the active outbreak (status in suspected/confirmed) for this
        # pathogen + country. Contained/closed rows are intentionally not
        # touched — they're historical and should be edited in admin.
        qs = Outbreak.objects.filter(
            pathogen__name=pathogen,
            iso3=iso3.upper(),
            status__in=['suspected', 'confirmed'],
        )
        n = qs.count()
        if n == 0:
            raise CommandError(
                f'No active outbreak found for {pathogen} in {iso3}. '
                f'Create one in admin first.'
            )
        if n > 1:
            raise CommandError(
                f'Found {n} active outbreaks for {pathogen} in {iso3} '
                f'(expected exactly one). Resolve via admin first.'
            )

        outbreak = qs.first()
        outbreak.confirmed_cases = cases
        outbreak.confirmed_deaths = deaths
        outbreak.confirmed_as_of = as_of
        outbreak.confirmed_source = source[:300]
        try:
            outbreak.full_clean()
        except ValidationError as e:
            raise CommandError(f'Validation failed: {e.message_dict}')
        outbreak.save()

        cfr = (deaths / cases * 100) if cases > 0 else 0.0
        self.stdout.write(self.style.SUCCESS(
            f'  Updated outbreak #{outbreak.id} ({pathogen} / {iso3}): '
            f'{cases:,} cases, {deaths:,} deaths, CFR {cfr:.1f}%, '
            f'as of {as_of.date().isoformat()}'
        ))
        self.stdout.write(f'    source: {source[:120]}{"..." if len(source) > 120 else ""}')
        self.stdout.write(f'    updated_at: {timezone.now().isoformat()}')
