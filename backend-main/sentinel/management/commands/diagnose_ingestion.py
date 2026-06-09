"""
diagnose_ingestion — One-stop health check for the Sentinel ingestion pipeline.

Usage:
    python manage.py diagnose_ingestion          # full report
    python manage.py diagnose_ingestion --json   # machine-readable output
"""

import json
import sys
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone


class Command(BaseCommand):
    help = 'Diagnose the Sentinel signal ingestion pipeline'

    def add_arguments(self, parser):
        parser.add_argument(
            '--json', action='store_true',
            help='Output results as JSON instead of formatted text',
        )

    def handle(self, *args, **options):
        results = {}
        now = timezone.now()

        self._header('SENTINEL INGESTION DIAGNOSTICS')
        self._header(f'Run at: {now.isoformat()}')

        # ── 1. Database signal stats ──────────────────────────────────
        results['db'] = self._check_database(now)

        # ── 2. Source breakdown ───────────────────────────────────────
        results['sources'] = self._check_sources(now)

        # ── 3. External API reachability ──────────────────────────────
        results['apis'] = self._check_apis()

        # ── 4. Celery Beat schedule ───────────────────────────────────
        results['celery'] = self._check_celery()

        # ── 5. Tenant integrity ───────────────────────────────────────
        results['tenants'] = self._check_tenants()

        # ── 6. AI classifier ─────────────────────────────────────────
        results['ai'] = self._check_ai_classifier()

        # ── 7. Disease keywords ───────────────────────────────────────
        results['keywords'] = self._check_disease_keywords()

        # ── Summary ──────────────────────────────────────────────────
        self._summary(results)

        if options['json']:
            self.stdout.write(json.dumps(results, indent=2, default=str))

    # ─── Checks ──────────────────────────────────────────────────────

    def _check_database(self, now):
        from sentinel.models import Signal
        self._section('DATABASE SIGNALS')

        total = Signal.objects.count()
        last_24h = Signal.objects.filter(created_at__gte=now - timedelta(hours=24)).count()
        last_1h = Signal.objects.filter(created_at__gte=now - timedelta(hours=1)).count()
        last_signal = Signal.objects.order_by('-created_at').first()

        last_at = last_signal.created_at if last_signal else None
        age_mins = int((now - last_at).total_seconds() / 60) if last_at else None

        self._kv('Total signals', total)
        self._kv('Last 24h', last_24h)
        self._kv('Last 1h', last_1h)
        self._kv('Latest signal', f'{last_at} ({age_mins}m ago)' if last_at else 'NONE')

        if age_mins and age_mins > 60:
            self._warn(f'No signals ingested in {age_mins} minutes — pipeline may be stalled')
        elif total == 0:
            self._warn('Database is empty — run `python manage.py sync_live` to seed')

        # Status breakdown
        from django.db.models import Count
        statuses = dict(
            Signal.objects.values_list('status').annotate(c=Count('id')).values_list('status', 'c')
        )
        self._kv('Status breakdown', statuses)

        # Priority breakdown
        priorities = dict(
            Signal.objects.values_list('priority').annotate(c=Count('id')).values_list('priority', 'c')
        )
        self._kv('Priority breakdown', priorities)

        return {
            'total': total,
            'last_24h': last_24h,
            'last_1h': last_1h,
            'latest_at': last_at,
            'age_minutes': age_mins,
            'statuses': statuses,
            'priorities': priorities,
        }

    def _check_sources(self, now):
        from sentinel.models import Signal
        from django.db.models import Count, Max
        self._section('INGESTION SOURCES')

        sources = (
            Signal.objects
            .values('ingestion_source')
            .annotate(
                count=Count('id'),
                latest=Max('created_at'),
                last_24h=Count(
                    'id',
                    filter=__import__('django.db.models', fromlist=['Q']).Q(
                        created_at__gte=now - timedelta(hours=24)
                    ),
                ),
            )
            .order_by('-count')
        )

        data = {}
        for src in sources:
            name = src['ingestion_source'] or 'unknown'
            age = int((now - src['latest']).total_seconds() / 60) if src['latest'] else None
            status = '✓' if age and age < 120 else '⚠' if age and age < 1440 else '✗'
            self._kv(
                f'  {status} {name}',
                f"{src['count']} total, {src['last_24h']} last 24h, latest {age}m ago" if age else f"{src['count']} total"
            )
            data[name] = {
                'count': src['count'],
                'last_24h': src['last_24h'],
                'latest_at': src['latest'],
                'age_minutes': age,
            }

        return data

    def _check_apis(self):
        import requests
        self._section('EXTERNAL API REACHABILITY')

        apis = {
            'GDELT': 'https://api.gdeltproject.org/api/v2/doc/doc?query=test&format=json&maxrecords=1',
            'ReliefWeb': 'https://api.reliefweb.int/v1/reports?limit=1',
            'WHO News RSS': 'https://www.who.int/rss-feeds/news-english.xml',
            'AllAfrica RSS': 'https://allafrica.com/tools/headlines/rdf/health/headlines.rdf',
        }

        data = {}
        for name, url in apis.items():
            try:
                r = requests.get(url, timeout=10, headers={
                    'User-Agent': 'AFRO-Sentinel-WHO/1.0 (health-surveillance)'
                })
                status = r.status_code
                ok = 200 <= status < 400
                icon = '✓' if ok else '✗'
                self._kv(f'  {icon} {name}', f'HTTP {status}')
                data[name] = {'status': status, 'ok': ok}
            except requests.exceptions.Timeout:
                self._kv(f'  ✗ {name}', 'TIMEOUT')
                data[name] = {'status': 'timeout', 'ok': False}
            except Exception as e:
                self._kv(f'  ✗ {name}', str(e)[:80])
                data[name] = {'status': 'error', 'ok': False, 'error': str(e)[:200]}

        return data

    def _check_celery(self):
        from django.conf import settings
        self._section('CELERY BEAT SCHEDULE')

        schedule = getattr(settings, 'CELERY_BEAT_SCHEDULE', {})
        data = {}
        for name, entry in schedule.items():
            task = entry.get('task', '?')
            sched = entry.get('schedule', '?')
            self._kv(f'  {name}', f'{task} — {sched}')
            data[name] = {'task': task, 'schedule': str(sched)}

        if not schedule:
            self._warn('No CELERY_BEAT_SCHEDULE found — periodic ingestion is disabled')

        return data

    def _check_tenants(self):
        from sentinel.models import Signal
        self._section('TENANT INTEGRITY')

        total = Signal.objects.count()
        null_tenant = Signal.objects.filter(tenant__isnull=True).count()

        self._kv('Total signals', total)
        self._kv('Missing tenant (NULL)', null_tenant)

        if null_tenant > 0:
            self._warn(f'{null_tenant} signals have NULL tenant — run backfill migration')

        # Check AFR tenant exists
        try:
            from account.models import Tenant
            afr = Tenant.objects.filter(is_continental=True).first()
            self._kv('AFR continental tenant', f'id={afr.id} ({afr.name})' if afr else 'MISSING')
            tenant_count = Tenant.objects.count()
            self._kv('Total tenants', tenant_count)
        except Exception as e:
            self._kv('Tenant check', f'Error: {e}')

        return {
            'total': total,
            'null_tenant': null_tenant,
        }

    def _check_ai_classifier(self):
        from sentinel.models import Signal
        self._section('AI CLASSIFIER STATUS')

        total = Signal.objects.count()
        classified = Signal.objects.exclude(ai_classification__isnull=True).exclude(ai_classification='').count()
        unclassified = total - classified

        self._kv('Total signals', total)
        self._kv('AI classified', f'{classified} ({(classified / total * 100):.1f}%)' if total else '0')
        self._kv('Unclassified', unclassified)

        if total > 0 and classified / total < 0.5:
            self._warn('Less than 50% of signals are AI-classified — check agent_classifier and Ollama')

        # Check Ollama
        try:
            import requests
            r = requests.get('http://localhost:11434/api/tags', timeout=3)
            models = [m['name'] for m in r.json().get('models', [])] if r.ok else []
            self._kv('Ollama status', f'UP — {len(models)} models: {", ".join(models[:5])}' if models else 'UP but no models')
        except Exception:
            self._kv('Ollama status', 'DOWN or unreachable')

        return {
            'total': total,
            'classified': classified,
            'unclassified': unclassified,
        }

    def _check_disease_keywords(self):
        from sentinel.models import DiseaseKeyword
        self._section('DISEASE KEYWORDS')

        count = DiseaseKeyword.objects.count()
        self._kv('Disease keywords loaded', count)

        if count == 0:
            self._warn('No disease keywords — run `python manage.py seed_diseases`')

        return {'count': count}

    # ─── Output helpers ──────────────────────────────────────────────

    def _header(self, text):
        self.stdout.write(self.style.SUCCESS(f'\n{"=" * 60}'))
        self.stdout.write(self.style.SUCCESS(f'  {text}'))
        self.stdout.write(self.style.SUCCESS(f'{"=" * 60}'))

    def _section(self, text):
        self.stdout.write(self.style.MIGRATE_HEADING(f'\n── {text} {"─" * max(1, 50 - len(text))}'))

    def _kv(self, key, value):
        self.stdout.write(f'  {key}: {value}')

    def _warn(self, text):
        self.stdout.write(self.style.WARNING(f'  ⚠  {text}'))

    def _summary(self, results):
        self._header('SUMMARY')
        issues = []

        db = results.get('db', {})
        if db.get('age_minutes') and db['age_minutes'] > 60:
            issues.append(f"Pipeline stalled — no signals in {db['age_minutes']}m")
        if db.get('total', 0) == 0:
            issues.append('Database empty')

        tenants = results.get('tenants', {})
        if tenants.get('null_tenant', 0) > 0:
            issues.append(f"{tenants['null_tenant']} signals missing tenant")

        ai = results.get('ai', {})
        if ai.get('total', 0) > 0 and ai.get('classified', 0) / ai['total'] < 0.5:
            issues.append('AI classifier coverage below 50%')

        apis = results.get('apis', {})
        down_apis = [name for name, info in apis.items() if not info.get('ok')]
        if down_apis:
            issues.append(f"Unreachable APIs: {', '.join(down_apis)}")

        kw = results.get('keywords', {})
        if kw.get('count', 0) == 0:
            issues.append('No disease keywords loaded')

        if issues:
            self.stdout.write(self.style.WARNING(f'\n  Found {len(issues)} issue(s):'))
            for i, issue in enumerate(issues, 1):
                self.stdout.write(self.style.WARNING(f'    {i}. {issue}'))
        else:
            self.stdout.write(self.style.SUCCESS('\n  ✓ All checks passed — pipeline looks healthy'))
