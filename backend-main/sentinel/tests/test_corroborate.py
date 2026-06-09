"""Tests for the corroborate() function in agent_classifier.py."""

from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from sentinel.agent_classifier import corroborate
from sentinel.models import Signal


def _signal(disease='Cholera', iso='COD', source_name='WHO', tier=1, hours_ago=1, **kw):
    return Signal.objects.create(
        disease_name=disease,
        location_country='Democratic Republic of the Congo',
        location_country_iso=iso,
        original_text=f'{disease} reported in {iso}',
        source_name=source_name,
        source_tier=tier,
        source_timestamp=timezone.now() - timedelta(hours=hours_ago),
        **kw,
    )


class CorroborateTests(TestCase):
    def test_no_corroborating_signals(self):
        signal = _signal()
        result = corroborate(signal)
        self.assertEqual(result['count'], 0)
        self.assertEqual(result['sources'], [])

    def test_counts_distinct_sources_same_disease_country(self):
        signal = _signal()
        _signal(source_name='Reuters', tier=2)
        _signal(source_name='AllAfrica', tier=2)
        result = corroborate(signal)
        self.assertEqual(result['count'], 2)

    def test_excludes_signal_itself(self):
        signal = _signal()
        result = corroborate(signal)
        self.assertEqual(result['count'], 0)

    def test_deduplicates_same_source_name(self):
        signal = _signal()
        _signal(source_name='Reuters', tier=2, hours_ago=10)
        _signal(source_name='Reuters', tier=2, hours_ago=20)
        result = corroborate(signal)
        self.assertEqual(result['count'], 1)

    def test_excludes_signals_beyond_72h(self):
        signal = _signal()
        _signal(source_name='Reuters', tier=2, hours_ago=73)
        result = corroborate(signal)
        self.assertEqual(result['count'], 0)

    def test_excludes_different_disease(self):
        signal = _signal(disease='Cholera')
        _signal(disease='Mpox', source_name='WHO', tier=1)
        result = corroborate(signal)
        self.assertEqual(result['count'], 0)

    def test_excludes_different_country(self):
        signal = _signal(iso='COD')
        _signal(iso='NGA', source_name='Reuters', tier=2)
        result = corroborate(signal)
        self.assertEqual(result['count'], 0)

    def test_tier1_count(self):
        signal = _signal()
        _signal(source_name='Reuters', tier=2)
        _signal(source_name='WHO-Afro', tier=1)
        result = corroborate(signal)
        self.assertEqual(result['count'], 2)
        self.assertEqual(result['tier1_count'], 1)

    def test_citations_shape(self):
        signal = _signal()
        _signal(source_name='Reuters', tier=2, source_url='https://reuters.com/x')
        result = corroborate(signal)
        self.assertEqual(len(result['sources']), 1)
        src = result['sources'][0]
        self.assertEqual(src['source_name'], 'Reuters')
        self.assertEqual(src['tier'], 2)
        self.assertEqual(src['source_url'], 'https://reuters.com/x')
        self.assertIn('matched_at', src)
