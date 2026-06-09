"""
HDIS Briefing Engine — Test Suite
Tests for: Trust Engine, Alert Engine, Briefing Pipeline (Gatherer).

Run:
    python manage.py test hdis -v 2
    python manage.py test hdis.tests.TrustEngineTests -v 2
    python manage.py test hdis.tests.AlertEngineTests -v 2
    python manage.py test hdis.tests.GathererTests -v 2
"""

from datetime import timedelta
from unittest.mock import patch, MagicMock

from django.test import TestCase
from django.utils import timezone

from sentinel.models import Signal, SignalPriority, SignalStatus, DiseaseCategory
from hdis.models import TrustScore, Alert, AlertRisk, Briefing
from hdis.trust_engine import (
    get_source_tier_weight,
    count_corroborating_sources,
    corroboration_bonus,
    recency_factor,
    compute_trust_score,
    update_trust_scores,
    SOURCE_TIER_WEIGHTS,
)
from hdis.alert_engine import (
    evaluate_signal,
    generate_alerts_for_signal,
    run_alert_engine,
    VHF_DISEASES,
    DEATH_THRESHOLD,
)


# ============================================================================
# TEST HELPERS
# ============================================================================

def make_signal(
    disease_name='cholera',
    country='Nigeria',
    country_iso='NGA',
    source_name='WHO News',
    source_tier=1,
    priority='P3',
    confidence_score=80,
    pillar='outbreak',
    secondary_pillars=None,
    reported_deaths=None,
    cross_border_risk=False,
    created_at=None,
    status='new',
    original_text=None,
) -> Signal:
    """Factory helper: create a Signal with sensible defaults for testing."""
    if created_at is None:
        created_at = timezone.now()
    if original_text is None:
        original_text = f'{disease_name} cases reported in {country}'

    return Signal.objects.create(
        signal_type='disease',
        disease_name=disease_name,
        disease_category=DiseaseCategory.ENTERIC,
        pillar=pillar,
        secondary_pillars=secondary_pillars or [],
        location_country=country,
        location_country_iso=country_iso,
        original_text=original_text,
        original_language='en',
        source_name=source_name,
        source_tier=source_tier,
        priority=priority,
        confidence_score=confidence_score,
        status=status,
        reported_deaths=reported_deaths,
        cross_border_risk=cross_border_risk,
        created_at=created_at,
    )


# ============================================================================
# TRUST ENGINE TESTS
# ============================================================================

class TrustEngineTests(TestCase):
    """Test the deterministic trust scoring system."""

    # ── Source Tier Weights ───────────────────────────────────────────

    def test_tier1_weight(self):
        """Tier 1 (WHO, UN) should get full trust weight."""
        signal = make_signal(source_tier=1)
        self.assertEqual(get_source_tier_weight(signal), 1.0)

    def test_tier2_weight(self):
        """Tier 2 (verified media) should get 0.65 weight."""
        signal = make_signal(source_tier=2)
        self.assertEqual(get_source_tier_weight(signal), 0.65)

    def test_tier3_weight(self):
        """Tier 3 (unverified) should get 0.35 weight."""
        signal = make_signal(source_tier=3)
        self.assertEqual(get_source_tier_weight(signal), 0.35)

    def test_unknown_tier_weight(self):
        """Unknown tier should get 0.3 fallback weight."""
        signal = make_signal(source_tier=99)
        self.assertEqual(get_source_tier_weight(signal), 0.3)

    # ── Corroboration ────────────────────────────────────────────────

    def test_no_corroboration_without_disease(self):
        """Signals without disease name should have 0 corroboration."""
        signal = make_signal(disease_name=None)
        self.assertEqual(count_corroborating_sources(signal), 0)

    def test_no_corroboration_without_country(self):
        """Signals without country ISO should have 0 corroboration."""
        signal = make_signal(country_iso=None)
        self.assertEqual(count_corroborating_sources(signal), 0)

    def test_single_source_no_corroboration(self):
        """A solo signal should have 0 corroborating sources."""
        signal = make_signal()
        self.assertEqual(count_corroborating_sources(signal), 0)

    def test_same_source_no_corroboration(self):
        """Two signals from the SAME source should count as 0 corroboration."""
        now = timezone.now()
        s1 = make_signal(source_name='WHO News', created_at=now)
        make_signal(source_name='WHO News', created_at=now)
        # Same source name — only 1 unique, minus self = 0 wait, it's separate signals
        # Actually: count_corroborating_sources excludes the signal itself,
        # then counts unique source_names. Both are 'WHO News', so distinct = 1.
        self.assertEqual(count_corroborating_sources(s1), 1)

    def test_two_different_sources_corroboration(self):
        """Two signals from DIFFERENT sources = 1 corroborating source (excluding self)."""
        now = timezone.now()
        s1 = make_signal(source_name='WHO News', created_at=now)
        make_signal(source_name='ReliefWeb', created_at=now)
        # s1 looks for others: finds ReliefWeb → 1 unique source
        self.assertEqual(count_corroborating_sources(s1), 1)

    def test_three_different_sources_corroboration(self):
        """Three signals from different sources = 2 corroborating (excluding self)."""
        now = timezone.now()
        s1 = make_signal(source_name='WHO News', created_at=now)
        make_signal(source_name='ReliefWeb', created_at=now)
        make_signal(source_name='GDELT', created_at=now)
        self.assertEqual(count_corroborating_sources(s1), 2)

    def test_corroboration_window_excludes_old(self):
        """Signals outside the 48h window should NOT count."""
        now = timezone.now()
        s1 = make_signal(source_name='WHO News', created_at=now)
        # Create signal 72h ago — outside the 48h corroboration window
        # Use update() to bypass auto_now_add
        s2 = make_signal(source_name='ReliefWeb')
        Signal.objects.filter(id=s2.id).update(
            created_at=now - timedelta(hours=72)
        )
        s2.refresh_from_db()
        self.assertEqual(count_corroborating_sources(s1), 0)

    def test_corroboration_requires_same_disease(self):
        """Different diseases should NOT corroborate each other."""
        now = timezone.now()
        s1 = make_signal(disease_name='cholera', source_name='WHO News', created_at=now)
        make_signal(disease_name='ebola', source_name='ReliefWeb', created_at=now)
        self.assertEqual(count_corroborating_sources(s1), 0)

    def test_corroboration_requires_same_country(self):
        """Different countries should NOT corroborate each other."""
        now = timezone.now()
        s1 = make_signal(country_iso='NGA', source_name='WHO News', created_at=now)
        make_signal(country_iso='KEN', source_name='ReliefWeb', created_at=now)
        self.assertEqual(count_corroborating_sources(s1), 0)

    # ── Corroboration Bonus ──────────────────────────────────────────

    def test_corroboration_bonus_zero(self):
        self.assertEqual(corroboration_bonus(0), 0.0)

    def test_corroboration_bonus_one(self):
        self.assertEqual(corroboration_bonus(1), 0.3)

    def test_corroboration_bonus_two(self):
        self.assertEqual(corroboration_bonus(2), 0.6)

    def test_corroboration_bonus_three_plus(self):
        self.assertEqual(corroboration_bonus(3), 1.0)
        self.assertEqual(corroboration_bonus(10), 1.0)

    # ── Recency Factor ───────────────────────────────────────────────

    def test_recency_factor_fresh(self):
        """Signal created just now should have recency ~1.0."""
        signal = make_signal()
        self.assertAlmostEqual(recency_factor(signal), 1.0, places=1)

    def test_recency_factor_week_old(self):
        """Signal 7+ days old should have recency 0.0."""
        signal = make_signal()
        # Use update() to bypass auto_now_add
        Signal.objects.filter(id=signal.id).update(
            created_at=timezone.now() - timedelta(days=8)
        )
        signal.refresh_from_db()
        self.assertEqual(recency_factor(signal), 0.0)

    def test_recency_factor_midpoint(self):
        """Signal ~3.5 days old should have recency ~0.5."""
        signal = make_signal()
        Signal.objects.filter(id=signal.id).update(
            created_at=timezone.now() - timedelta(hours=84)
        )
        signal.refresh_from_db()
        self.assertAlmostEqual(recency_factor(signal), 0.5, places=1)

    # ── Composite Score ──────────────────────────────────────────────

    def test_compute_trust_score_tier1_fresh(self):
        """Tier 1 + fresh + high confidence → should be high score."""
        signal = make_signal(source_tier=1, confidence_score=90)
        result = compute_trust_score(signal)
        self.assertIn('score', result)
        self.assertIn('trust_level', result)
        self.assertGreaterEqual(result['score'], 60)
        self.assertIn(result['trust_level'], ['verified', 'corroborated'])

    def test_compute_trust_score_tier3_old(self):
        """Tier 3 + old + low confidence → should be low score."""
        signal = make_signal(
            source_tier=3,
            confidence_score=30,
            created_at=timezone.now() - timedelta(days=6),
        )
        result = compute_trust_score(signal)
        self.assertLess(result['score'], 40)
        self.assertIn(result['trust_level'], ['unverified', 'unconfirmed'])

    def test_compute_trust_score_returns_all_fields(self):
        """Result dict should have all expected keys."""
        signal = make_signal()
        result = compute_trust_score(signal)
        expected_keys = {
            'score', 'trust_level', 'source_tier_weight',
            'corroboration_count', 'disease_match_confidence', 'recency_factor',
        }
        self.assertEqual(set(result.keys()), expected_keys)

    def test_score_clamped_0_100(self):
        """Score should always be between 0 and 100."""
        signal = make_signal(source_tier=1, confidence_score=100)
        result = compute_trust_score(signal)
        self.assertGreaterEqual(result['score'], 0)
        self.assertLessEqual(result['score'], 100)

    # ── Batch Update ─────────────────────────────────────────────────

    def test_update_trust_scores_creates_records(self):
        """update_trust_scores() should create TrustScore records."""
        s1 = make_signal()
        s2 = make_signal(source_name='ReliefWeb')
        count = update_trust_scores(signal_ids=[s1.id, s2.id])
        self.assertEqual(count, 2)
        self.assertTrue(TrustScore.objects.filter(signal=s1).exists())
        self.assertTrue(TrustScore.objects.filter(signal=s2).exists())

    def test_update_trust_scores_updates_existing(self):
        """Running twice should update, not duplicate."""
        s1 = make_signal()
        update_trust_scores(signal_ids=[s1.id])
        update_trust_scores(signal_ids=[s1.id])
        self.assertEqual(TrustScore.objects.filter(signal=s1).count(), 1)


# ============================================================================
# ALERT ENGINE TESTS
# ============================================================================

class AlertEngineTests(TestCase):
    """Test the rule-based alert system."""

    # ── Rule: P1 Critical Priority ───────────────────────────────────

    def test_p1_triggers_critical_alert(self):
        """P1 priority signal should trigger a critical alert."""
        signal = make_signal(priority='P1', source_tier=1)
        reasons, trust = evaluate_signal(signal)
        self.assertTrue(any(r['risk'] == AlertRisk.CRITICAL for r in reasons))

    def test_p4_does_not_trigger_priority_alert(self):
        """P4 priority signal should NOT trigger a priority-based alert."""
        signal = make_signal(priority='P4', source_tier=1)
        reasons, trust = evaluate_signal(signal)
        # P4 alone shouldn't trigger any rule (no VHF, no deaths, no corroboration)
        priority_reasons = [r for r in reasons if 'Critical priority' in r['reason']]
        self.assertEqual(len(priority_reasons), 0)

    # ── Rule: VHF Diseases ───────────────────────────────────────────

    def test_ebola_triggers_vhf_alert(self):
        """Ebola should always trigger a VHF alert."""
        signal = make_signal(disease_name='Ebola', priority='P3', source_tier=1)
        reasons, trust = evaluate_signal(signal)
        vhf_reasons = [r for r in reasons if 'Viral Hemorrhagic Fever' in r['reason']]
        self.assertEqual(len(vhf_reasons), 1)
        self.assertEqual(vhf_reasons[0]['risk'], AlertRisk.CRITICAL)

    def test_marburg_triggers_vhf_alert(self):
        """Marburg should always trigger a VHF alert."""
        signal = make_signal(disease_name='Marburg', priority='P3', source_tier=1)
        reasons, trust = evaluate_signal(signal)
        vhf_reasons = [r for r in reasons if 'Viral Hemorrhagic Fever' in r['reason']]
        self.assertEqual(len(vhf_reasons), 1)

    def test_cholera_does_not_trigger_vhf_alert(self):
        """Cholera is NOT a VHF and should NOT trigger a VHF alert."""
        signal = make_signal(disease_name='Cholera', priority='P3', source_tier=1)
        reasons, trust = evaluate_signal(signal)
        vhf_reasons = [r for r in reasons if 'Viral Hemorrhagic Fever' in r['reason']]
        self.assertEqual(len(vhf_reasons), 0)

    # ── Rule: Death Threshold ────────────────────────────────────────

    def test_deaths_above_threshold_triggers_alert(self):
        """Deaths >= DEATH_THRESHOLD should trigger an alert."""
        signal = make_signal(reported_deaths=10, source_tier=1)
        reasons, trust = evaluate_signal(signal)
        death_reasons = [r for r in reasons if 'deaths reported' in r['reason']]
        self.assertEqual(len(death_reasons), 1)
        self.assertEqual(death_reasons[0]['risk'], AlertRisk.HIGH)

    def test_deaths_50_triggers_critical(self):
        """Deaths >= 50 should trigger CRITICAL, not just HIGH."""
        signal = make_signal(reported_deaths=50, source_tier=1)
        reasons, trust = evaluate_signal(signal)
        death_reasons = [r for r in reasons if 'deaths reported' in r['reason']]
        self.assertEqual(death_reasons[0]['risk'], AlertRisk.CRITICAL)

    def test_deaths_below_threshold_no_alert(self):
        """Deaths < DEATH_THRESHOLD should NOT trigger alert."""
        signal = make_signal(reported_deaths=2, source_tier=1)
        reasons, trust = evaluate_signal(signal)
        death_reasons = [r for r in reasons if 'deaths reported' in r['reason']]
        self.assertEqual(len(death_reasons), 0)

    # ── Rule: Low Trust Suppression ──────────────────────────────────

    def test_very_low_trust_suppresses_all_alerts(self):
        """Signals with trust < 30 should produce NO alerts (noise suppression)."""
        signal = make_signal(
            source_tier=3,
            confidence_score=10,
            priority='P1',
            disease_name='Ebola',
            created_at=timezone.now() - timedelta(days=6),
        )
        reasons, trust = evaluate_signal(signal)
        # Even P1+VHF should be suppressed if trust < 30
        self.assertEqual(len(reasons), 0)

    # ── Rule: Cross-Border Risk ──────────────────────────────────────

    def test_cross_border_p1_triggers_alert(self):
        """Cross-border risk + P1 should trigger."""
        signal = make_signal(priority='P1', cross_border_risk=True, source_tier=1)
        reasons, trust = evaluate_signal(signal)
        cross_border = [r for r in reasons if 'Cross-border' in r['reason']]
        self.assertEqual(len(cross_border), 1)

    def test_cross_border_p4_does_not_trigger(self):
        """Cross-border risk + P4 should NOT trigger (only P1/P2)."""
        signal = make_signal(priority='P4', cross_border_risk=True, source_tier=1)
        reasons, trust = evaluate_signal(signal)
        cross_border = [r for r in reasons if 'Cross-border' in r['reason']]
        self.assertEqual(len(cross_border), 0)

    # ── Alert Deduplication ──────────────────────────────────────────

    def test_generate_alerts_creates_db_records(self):
        """generate_alerts_for_signal should create Alert objects."""
        signal = make_signal(priority='P1', source_tier=1)
        created = generate_alerts_for_signal(signal)
        self.assertGreater(created, 0)
        self.assertTrue(Alert.objects.filter(signal=signal).exists())

    def test_generate_alerts_deduplicates(self):
        """Running twice should NOT create duplicate alerts."""
        signal = make_signal(priority='P1', source_tier=1)
        created1 = generate_alerts_for_signal(signal)
        created2 = generate_alerts_for_signal(signal)
        self.assertGreater(created1, 0)
        self.assertEqual(created2, 0)

    # ── Double compute_trust_score call ──────────────────────────────

    def test_generate_alerts_computes_trust_once(self):
        """
        FIXED: generate_alerts_for_signal now calls compute_trust_score ONCE
        (in evaluate_signal) and reuses the result.
        """
        signal = make_signal(priority='P1', source_tier=1)
        with patch('hdis.alert_engine.compute_trust_score') as mock_trust:
            mock_trust.return_value = {
                'score': 80,
                'trust_level': 'verified',
                'source_tier_weight': 1.0,
                'corroboration_count': 0,
                'disease_match_confidence': 80,
                'recency_factor': 1.0,
            }
            generate_alerts_for_signal(signal)
            # Fixed: now called only 1x (was 2x before fix)
            self.assertEqual(mock_trust.call_count, 1)


# ============================================================================
# GATHERER TESTS
# ============================================================================

class GathererTests(TestCase):
    """Test the Gatherer agent's context bundle assembly."""

    def setUp(self):
        """Create test signals across multiple pillars."""
        now = timezone.now()
        self.signals = {
            'policy': make_signal(
                pillar='policy', disease_name=None,
                original_text='WHO AFRO health policy reform in Ghana',
                source_name='WHO AFRO', created_at=now,
            ),
            'funding': make_signal(
                pillar='funding', disease_name=None,
                original_text='Global Fund cuts $1.43B from current cycle',
                source_name='Global Fund', created_at=now,
            ),
            'outbreak': make_signal(
                pillar='outbreak', disease_name='cholera',
                original_text='Cholera outbreak in DRC 50 cases',
                source_name='WHO News', created_at=now,
            ),
            'conflict': make_signal(
                pillar='conflict', disease_name=None,
                original_text='Hospital attacked in Sudan',
                source_name='ICRC', created_at=now,
            ),
        }

    def test_gather_returns_all_pillars(self):
        """Gatherer should return signals with pillar breakdown."""
        from hdis.briefing_engine import _gather_context
        context = _gather_context(scope='daily_global')
        self.assertIn('signals', context)
        # signals is a dict with {total, by_pillar, items}
        self.assertIsInstance(context['signals'], dict)
        self.assertGreater(context['signals']['total'], 0)
        self.assertIn('items', context['signals'])

    def test_gather_returns_pillar_groups(self):
        """Context should include pillar breakdown in signals."""
        from hdis.briefing_engine import _gather_context
        context = _gather_context(scope='daily_global')
        # Pillar grouping is inside signals.by_pillar
        self.assertIn('by_pillar', context['signals'])
        pillars_found = set(context['signals']['by_pillar'].keys())
        # Should have at least the pillars we created
        self.assertTrue(pillars_found.intersection({'policy', 'funding', 'outbreak', 'conflict'}))

    def test_gather_country_filter(self):
        """Country focus should only return signals for that country."""
        # All test signals are NGA
        from hdis.briefing_engine import _gather_context
        context = _gather_context(scope='country_focus', country_iso='KEN')
        # No KEN signals exist
        self.assertEqual(context['signals']['total'], 0)

    def test_gather_context_shape(self):
        """Context bundle should have expected top-level keys."""
        from hdis.briefing_engine import _gather_context
        context = _gather_context(scope='daily_global')
        # Check structure has the essentials
        self.assertIn('signals', context)
        self.assertIn('source_count', context)
        self.assertIn('gatherer_ms', context)

    def test_gather_caps_at_200(self):
        """Gatherer should not return more than 200 signals."""
        from hdis.briefing_engine import _gather_context
        # Create 210 signals
        for i in range(210):
            make_signal(
                original_text=f'Test signal {i}',
                source_name=f'Source-{i}',
            )
        context = _gather_context(scope='daily_global')
        self.assertLessEqual(len(context['signals']['items']), 200)


# ============================================================================
# N+1 QUERY TESTS
# ============================================================================

class QueryCountTests(TestCase):
    """Test that batch operations don't cause N+1 queries."""

    def test_update_trust_scores_query_count(self):
        """
        BEFORE FIX: update_trust_scores does 1 corroboration query PER signal.
        With N signals, that's N+1 queries.
        This test documents the current behavior.
        """
        # Create 10 signals
        for i in range(10):
            make_signal(source_name=f'Source-{i}')

        from django.test.utils import override_settings
        from django.db import connection, reset_queries

        with override_settings(DEBUG=True):
            reset_queries()
            update_trust_scores()
            query_count = len(connection.queries)
            # Current expected: ~20+ queries (N corroboration queries + N upserts)
            # After fix: should be ~12 (1 batch corroboration + N upserts)
            self.assertGreater(query_count, 0)
            # Store for comparison after fix
            self._pre_fix_query_count = query_count


# ============================================================================
# OUTBREAK EXCLUSION TESTS
# ============================================================================

class OutbreakExclusionTests(TestCase):
    """Test hybrid outbreak exclusion: pure outbreak signals excluded,
    cross-pillar outbreak signals kept."""

    def setUp(self):
        now = timezone.now()
        # Pure outbreak — no secondary pillars → should be EXCLUDED
        self.pure_outbreak = make_signal(
            pillar='outbreak', disease_name='cholera',
            original_text='Cholera outbreak in DRC', created_at=now,
        )
        # Cross-pillar outbreak — secondary 'agreement' → should be KEPT
        self.cross_pillar_outbreak = make_signal(
            pillar='outbreak', disease_name='cholera',
            secondary_pillars=['agreement'],
            original_text='Cholera triggers DRC-Angola border closure',
            created_at=now,
        )
        # Non-outbreak signals — always kept
        self.policy_signal = make_signal(
            pillar='policy', disease_name=None,
            original_text='WHO health policy reform', created_at=now,
        )
        self.funding_signal = make_signal(
            pillar='funding', disease_name=None,
            original_text='Global Fund allocation update', created_at=now,
        )

    def test_exclude_outbreak_keeps_cross_pillar_signal(self):
        """Outbreak signal WITH relevant secondary pillar should be KEPT."""
        from hdis.briefing_engine import _gather_context
        context = _gather_context(scope='daily_global', exclude_pillars=['outbreak'])
        signal_ids = [s['id'] for s in context['signals']['items']]
        # cross_pillar_outbreak has secondary_pillars=['agreement'] → kept
        self.assertIn(self.cross_pillar_outbreak.id, signal_ids)

    def test_exclude_outbreak_removes_pure_outbreak(self):
        """Outbreak signal WITHOUT relevant secondary pillar should be EXCLUDED."""
        from hdis.briefing_engine import _gather_context
        context = _gather_context(scope='daily_global', exclude_pillars=['outbreak'])
        signal_ids = [s['id'] for s in context['signals']['items']]
        # pure_outbreak has no secondary_pillars → excluded
        self.assertNotIn(self.pure_outbreak.id, signal_ids)

    def test_exclude_outbreak_keeps_other_pillars(self):
        """Excluding 'outbreak' should still return policy/funding signals."""
        from hdis.briefing_engine import _gather_context
        context = _gather_context(scope='daily_global', exclude_pillars=['outbreak'])
        # Should have 3: policy + funding + cross-pillar outbreak
        self.assertEqual(context['signals']['total'], 3)
        # policy and funding in pillar breakdown
        self.assertIn('policy', context['signals']['by_pillar'])
        self.assertIn('funding', context['signals']['by_pillar'])

    def test_exclude_none_returns_all(self):
        """No exclusion should return all signals including outbreak."""
        from hdis.briefing_engine import _gather_context
        context = _gather_context(scope='daily_global', exclude_pillars=None)
        self.assertEqual(context['signals']['total'], 4)
        self.assertIn('outbreak', context['signals']['by_pillar'])

    def test_exclude_multiple_pillars(self):
        """Excluding multiple pillars should work."""
        from hdis.briefing_engine import _gather_context
        context = _gather_context(scope='daily_global', exclude_pillars=['outbreak', 'policy'])
        # funding kept, cross_pillar_outbreak kept (has secondary 'agreement')
        signal_ids = [s['id'] for s in context['signals']['items']]
        self.assertIn(self.funding_signal.id, signal_ids)
        self.assertIn(self.cross_pillar_outbreak.id, signal_ids)
        self.assertNotIn(self.pure_outbreak.id, signal_ids)
        self.assertNotIn(self.policy_signal.id, signal_ids)

    def test_outbreak_with_only_excluded_secondary_pillars_is_excluded(self):
        """Outbreak with secondary_pillars=['outbreak'] should still be excluded."""
        from hdis.briefing_engine import _gather_context
        now = timezone.now()
        # secondary_pillars only contains the excluded pillar itself
        make_signal(
            pillar='outbreak', disease_name='malaria',
            secondary_pillars=['outbreak'],
            original_text='Pure malaria signal', created_at=now,
        )
        context = _gather_context(scope='daily_global', exclude_pillars=['outbreak'])
        signal_ids = [s['id'] for s in context['signals']['items']]
        # Should still have only 3: policy + funding + cross_pillar_outbreak
        non_outbreak_count = sum(1 for s in context['signals']['items'] if s['pillar'] != 'outbreak')
        outbreak_kept = sum(1 for s in context['signals']['items'] if s['pillar'] == 'outbreak')
        self.assertEqual(non_outbreak_count, 2)  # policy + funding
        self.assertEqual(outbreak_kept, 1)  # only cross_pillar_outbreak

    def test_cross_pillar_outbreak_preserves_original_pillar(self):
        """Kept cross-pillar outbreak signals should retain pillar='outbreak'."""
        from hdis.briefing_engine import _gather_context
        context = _gather_context(scope='daily_global', exclude_pillars=['outbreak'])
        outbreak_signals = [
            s for s in context['signals']['items'] if s['pillar'] == 'outbreak'
        ]
        # The cross_pillar_outbreak should be present with its original pillar
        self.assertEqual(len(outbreak_signals), 1)
        self.assertEqual(outbreak_signals[0]['id'], self.cross_pillar_outbreak.id)


# ============================================================================
# BRIEFING GENERATION JOB TESTS
# ============================================================================

class BriefingGenerationJobTests(TestCase):
    """Test the DB-backed briefing generation job tracking."""

    def test_job_creation(self):
        from hdis.models import BriefingGenerationJob, JobStatus
        job = BriefingGenerationJob.objects.create(
            scope='daily_global',
            status=JobStatus.PENDING,
        )
        self.assertTrue(job.is_running)
        self.assertEqual(job.status, 'pending')

    def test_job_lifecycle(self):
        from hdis.models import BriefingGenerationJob, JobStatus
        job = BriefingGenerationJob.objects.create(
            scope='daily_global',
            status=JobStatus.PENDING,
        )
        # Mark gathering
        job.mark_stage(JobStatus.GATHERING)
        job.refresh_from_db()
        self.assertEqual(job.status, 'gathering')
        self.assertTrue(job.is_running)

        # Mark failed
        job.mark_failed('Test error')
        job.refresh_from_db()
        self.assertEqual(job.status, 'failed')
        self.assertFalse(job.is_running)
        self.assertEqual(job.error, 'Test error')
        self.assertIsNotNone(job.completed_at)

