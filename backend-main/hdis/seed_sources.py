"""
Seed initial HDIS source configurations and test the ingestion pipeline.
Run: python manage.py shell < hdis/seed_sources.py
"""
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'datarepr.settings')

import django
django.setup()

from hdis.source_config import SourceConfig
from hdis.pillar_classifier import SignalPillar

# ============================================================================
# SEED RSS SOURCES
# ============================================================================

SOURCES = [
    {
        'name': 'WHO AFRO News',
        'slug': 'who-afro',
        'description': 'WHO Regional Office for Africa — official health news and policy updates',
        'source_type': 'rss',
        'url': 'https://www.afro.who.int/rss.xml',
        'default_pillar': SignalPillar.POLICY,
        'source_tier': 1,
        'keyword_include': [],  # Accept all WHO AFRO news
        'keyword_exclude': ['vacancy', 'recruitment', 'career', 'procurement'],
        'require_africa': False,  # WHO AFRO is always about Africa
        'poll_interval_minutes': 30,
    },
    {
        'name': 'Africa CDC',
        'slug': 'africa-cdc',
        'description': 'Africa Centres for Disease Control and Prevention — surveillance and governance',
        'source_type': 'rss',
        'url': 'https://africacdc.org/feed/',
        'default_pillar': SignalPillar.OUTBREAK,
        'source_tier': 1,
        'keyword_include': [],
        'keyword_exclude': ['webinar', 'training course', 'apply now'],
        'require_africa': False,
        'poll_interval_minutes': 60,
    },
    {
        'name': 'Global Fund News',
        'slug': 'global-fund',
        'description': 'The Global Fund to Fight AIDS, TB and Malaria — funding and grant news',
        'source_type': 'rss',
        'url': 'https://www.theglobalfund.org/en/rss/',
        'default_pillar': SignalPillar.FUNDING,
        'source_tier': 1,
        'keyword_include': ['africa', 'african', 'grant', 'funding', 'disbursement',
                           'replenishment', 'malaria', 'hiv', 'tuberculosis'],
        'keyword_exclude': [],
        'require_africa': True,
        'poll_interval_minutes': 120,
    },
    {
        'name': 'GAVI Vaccine Alliance',
        'slug': 'gavi',
        'description': 'GAVI — vaccine access, immunization, and vaccine diplomacy in Africa',
        'source_type': 'rss',
        'url': 'https://www.gavi.org/rss.xml',
        'default_pillar': SignalPillar.VACCINE,
        'source_tier': 1,
        'keyword_include': ['africa', 'african', 'vaccine', 'immunization', 'covax'],
        'keyword_exclude': [],
        'require_africa': True,
        'poll_interval_minutes': 120,
    },
    {
        'name': 'Health Policy Watch',
        'slug': 'health-policy-watch',
        'description': 'Independent health policy journalism — policy, governance, agreements, climate-health, workforce, UHC',
        'source_type': 'rss',
        'url': 'https://healthpolicy-watch.news/feed/',
        'default_pillar': SignalPillar.POLICY,
        'source_tier': 2,
        'keyword_include': [
            'africa', 'african', 'who', 'pandemic treaty', 'pandemic agreement',
            'PABS', 'global health', 'immunization', 'funding',
            'health workforce', 'health workers', 'brain drain',
            'universal health coverage', 'UHC', 'primary health care',
            'climate change', 'climate health', 'health insurance',
            'benefit-sharing', 'WHA', 'world health assembly',
            'community health', 'out-of-pocket', 'health financing',
        ],
        'keyword_exclude': [],
        'require_africa': True,
        'poll_interval_minutes': 60,
    },
    {
        'name': 'ICRC Africa',
        'slug': 'icrc-africa',
        'description': 'International Committee of the Red Cross — conflict, humanitarian, health',
        'source_type': 'rss',
        'url': 'https://www.icrc.org/en/rss',
        'default_pillar': SignalPillar.CONFLICT,
        'source_tier': 1,
        'keyword_include': ['africa', 'african', 'hospital', 'health', 'clinic',
                           'medical', 'displaced', 'humanitarian'],
        'keyword_exclude': [],
        'require_africa': True,
        'poll_interval_minutes': 60,
    },
    # ── Phase 9: New sources for missing pillars (climate, agreement, workforce, UHC) ──
    {
        'name': 'ReliefWeb Climate+Africa',
        'slug': 'reliefweb-climate-africa',
        'description': 'UN OCHA ReliefWeb — Climate Change & Environment reports for Africa',
        'source_type': 'rss',
        'url': (
            'https://reliefweb.int/updates/rss.xml?search='
            'primary_country.iso3%3A%28COD+OR+NGA+OR+KEN+OR+ETH+OR+ZAF'
            '+OR+TZA+OR+GHA+OR+SEN+OR+MOZ+OR+AGO+OR+SDN+OR+SSD+OR+CMR'
            '+OR+UGA+OR+MWI+OR+ZWE+OR+BFA+OR+MLI+OR+NER+OR+TCD+OR+RWA%29'
            '+AND+theme%3A%28Climate+Change+and+Environment%29'
        ),
        'default_pillar': SignalPillar.CLIMATE,
        'source_tier': 1,
        'keyword_include': [],  # Pre-filtered by URL query
        'keyword_exclude': ['vacancy', 'training course', 'webinar', 'tender'],
        'require_africa': False,  # Already filtered by country in URL
        'poll_interval_minutes': 60,
    },
    {
        'name': 'ReliefWeb Health+Africa',
        'slug': 'reliefweb-health-africa',
        'description': 'UN OCHA ReliefWeb — Health reports for Africa (UHC, workforce, policy, financing)',
        'source_type': 'rss',
        'url': (
            'https://reliefweb.int/updates/rss.xml?search='
            'theme%3A%28Health%29+AND+primary_country.iso3%3A%28COD+OR+NGA'
            '+OR+KEN+OR+ETH+OR+ZAF+OR+TZA+OR+GHA+OR+SEN+OR+MOZ+OR+AGO'
            '+OR+SDN+OR+SSD+OR+CMR+OR+UGA%29'
        ),
        'default_pillar': SignalPillar.POLICY,
        'source_tier': 1,
        'keyword_include': [],  # Pre-filtered by URL query
        'keyword_exclude': ['vacancy', 'recruitment', 'tender', 'procurement', 'training course'],
        'require_africa': False,
        'poll_interval_minutes': 60,
    },
    {
        'name': 'WHO Global News',
        'slug': 'who-global-news',
        'description': 'WHO HQ news — pandemic treaty, WHA, workforce, UHC, global governance',
        'source_type': 'rss',
        'url': 'https://www.who.int/rss-feeds/news-english.xml',
        'default_pillar': SignalPillar.POLICY,
        'source_tier': 1,
        'keyword_include': [
            'africa', 'african', 'pandemic treaty', 'pandemic agreement',
            'PABS', 'WHO AFRO', 'health workforce', 'universal health coverage',
            'UHC', 'primary health care', 'benefit-sharing', 'world health assembly',
            'WHA', 'international health regulations', 'IHR',
        ],
        'keyword_exclude': ['vacancy', 'recruitment'],
        'require_africa': True,
        'poll_interval_minutes': 120,
    },
]

print("=" * 60)
print("SEEDING HDIS SOURCE CONFIGURATIONS")
print("=" * 60)

created_count = 0
updated_count = 0

for source_data in SOURCES:
    obj, created = SourceConfig.objects.update_or_create(
        slug=source_data['slug'],
        defaults=source_data,
    )
    if created:
        created_count += 1
        print(f"  ✅ Created: {obj.name}")
    else:
        updated_count += 1
        print(f"  🔄 Updated: {obj.name}")

print(f"\nDone: {created_count} created, {updated_count} updated")
print(f"Total active sources: {SourceConfig.objects.filter(is_active=True).count()}")

# ============================================================================
# TEST INGESTION — Try one source
# ============================================================================

print("\n" + "=" * 60)
print("TESTING INGESTION: WHO AFRO RSS")
print("=" * 60)

from hdis.ingestion import get_adapter

try:
    config = SourceConfig.objects.get(slug='who-afro')
    adapter = get_adapter(config)
    result = adapter.run()
    print(f"\nResult: {result}")
    print(f"✅ WHO AFRO ingestion test passed!")
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()

# Show what we got
from sentinel.models import Signal
recent = Signal.objects.filter(ingestion_source='who-afro').order_by('-created_at')[:5]
print(f"\nRecent signals from WHO AFRO ({recent.count()} shown):")
for s in recent:
    print(f"  [{s.priority}] {s.original_text[:80]}... ({s.location_country_iso or 'N/A'})")
