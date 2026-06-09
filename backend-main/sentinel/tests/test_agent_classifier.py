"""
Tests for sentinel/agent_classifier.py — Fused Agent Pipeline.

All tests mock the LLM (chat_json) and DB to run without external dependencies.
"""

import json
from datetime import datetime, timezone as dt_tz
from unittest.mock import patch, MagicMock, call, PropertyMock

from django.test import SimpleTestCase, override_settings
from django.utils import timezone


def _make_signal(**overrides):
    """Create a mock Signal object with sane defaults."""
    signal = MagicMock()
    signal.id = overrides.get('id', 42)
    signal.disease_name = overrides.get('disease_name', 'Cholera')
    signal.location_country = overrides.get('location_country', 'Nigeria')
    signal.location_country_iso = overrides.get('location_country_iso', 'NGA')
    signal.original_text = overrides.get('original_text', 'Cholera outbreak confirmed in Lagos.')
    signal.priority = overrides.get('priority', 'P1')
    signal.source_name = overrides.get('source_name', 'WHO')
    signal.source_tier = overrides.get('source_tier', 1)
    signal.reported_cases = overrides.get('reported_cases', 120)
    signal.reported_deaths = overrides.get('reported_deaths', 5)
    signal.cross_border_risk = overrides.get('cross_border_risk', True)
    signal.ai_classification = overrides.get('ai_classification', None)
    signal.ai_severity = overrides.get('ai_severity', None)
    signal.ai_notification_scope = overrides.get('ai_notification_scope', None)
    signal.ai_reasoning = overrides.get('ai_reasoning', None)
    signal.ai_classified_at = overrides.get('ai_classified_at', None)
    signal.analyst_notes = overrides.get('analyst_notes', None)
    signal.save = MagicMock()
    return signal


# ── monitor_classify tests ───────────────────────────────────────────────

class TestMonitorClassify(SimpleTestCase):
    """Tests for the monitor_classify() step."""

    @patch('hdis.llm_client.chat_json')
    def test_returns_valid_classification(self, mock_chat):
        """monitor_classify returns classification + rationale from LLM."""
        from sentinel.agent_classifier import monitor_classify

        mock_chat.return_value = {
            'classification': 'area_alert',
            'rationale': 'Cholera cases confirmed near border.',
        }
        signal = _make_signal()
        result = monitor_classify(signal)

        self.assertEqual(result['classification'], 'area_alert')
        self.assertIn('Cholera', result['rationale'])
        mock_chat.assert_called_once()

    @patch('hdis.llm_client.chat_json')
    def test_handles_llm_failure(self, mock_chat):
        """monitor_classify returns 'uncertain' when LLM raises exception."""
        from sentinel.agent_classifier import monitor_classify

        mock_chat.side_effect = RuntimeError("Ollama is down")
        signal = _make_signal()
        result = monitor_classify(signal)

        self.assertEqual(result['classification'], 'uncertain')
        self.assertIn('LLM unavailable', result['rationale'])

    @patch('hdis.llm_client.chat_json')
    def test_handles_null_llm_response(self, mock_chat):
        """monitor_classify returns 'uncertain' when LLM returns None."""
        from sentinel.agent_classifier import monitor_classify

        mock_chat.return_value = None
        signal = _make_signal()
        result = monitor_classify(signal)

        self.assertEqual(result['classification'], 'uncertain')

    @patch('hdis.llm_client.chat_json')
    def test_truncates_long_text(self, mock_chat):
        """monitor_classify truncates original_text to 2000 chars."""
        from sentinel.agent_classifier import monitor_classify

        mock_chat.return_value = {'classification': 'no_alert', 'rationale': 'ok'}
        signal = _make_signal(original_text='A' * 5000)
        monitor_classify(signal)

        # Check the user_prompt sent to chat_json
        call_args = mock_chat.call_args
        user_prompt = call_args[0][1]  # second positional arg
        # The JSON-serialized signal data should have truncated text
        self.assertNotIn('A' * 5000, user_prompt)


# ── review_assess tests ──────────────────────────────────────────────────

class TestReviewAssess(SimpleTestCase):
    """Tests for the review_assess() step."""

    @patch('hdis.llm_client.chat_json')
    def test_returns_severity_and_scope(self, mock_chat):
        """review_assess returns 4-key dict from LLM."""
        from sentinel.agent_classifier import review_assess

        mock_chat.return_value = {
            'severity': 'high',
            'notification_scope': 'continental',
            'notify_groups': 'Africa CDC, ECDC',
            'reasoning': 'Significant case count near border.',
        }
        result = review_assess(42, 'area_alert', [])

        self.assertEqual(result['severity'], 'high')
        self.assertEqual(result['notification_scope'], 'continental')
        self.assertIn('Africa CDC', result['notify_groups'])
        mock_chat.assert_called_once()

    @patch('hdis.llm_client.chat_json')
    def test_handles_llm_failure(self, mock_chat):
        """review_assess returns safe defaults when LLM fails."""
        from sentinel.agent_classifier import review_assess

        mock_chat.side_effect = RuntimeError("timeout")
        result = review_assess(42, 'continent_alert', [])

        self.assertEqual(result['severity'], 'uncertain')
        self.assertEqual(result['notification_scope'], 'local')
        self.assertIn('LLM unavailable', result['reasoning'])

    @patch('hdis.llm_client.chat_json')
    def test_passes_history_to_prompt(self, mock_chat):
        """review_assess includes history in user prompt."""
        from sentinel.agent_classifier import review_assess

        mock_chat.return_value = {
            'severity': 'low',
            'notification_scope': 'local',
            'notify_groups': 'Local clinicians',
            'reasoning': 'OK',
        }
        history = [
            {'id': 10, 'ai_classification': 'no_alert', 'ai_severity': 'low',
             'disease_name': 'Malaria', 'location_country': 'Ghana'},
        ]
        review_assess(42, 'area_alert', history)

        user_prompt = mock_chat.call_args[0][1]
        self.assertIn('Malaria', user_prompt)
        self.assertIn('Ghana', user_prompt)

    @patch('hdis.llm_client.chat_json')
    def test_empty_history_message(self, mock_chat):
        """review_assess uses 'first alert' message when history is empty."""
        from sentinel.agent_classifier import review_assess

        mock_chat.return_value = {
            'severity': 'low',
            'notification_scope': 'local',
            'notify_groups': '',
            'reasoning': 'OK',
        }
        review_assess(42, 'area_alert', [])

        user_prompt = mock_chat.call_args[0][1]
        self.assertIn('first alert', user_prompt)


# ── notify_officers tests ────────────────────────────────────────────────

class TestNotifyOfficers(SimpleTestCase):
    """Tests for the notify_officers() notification step."""

    @patch.dict('os.environ', {'ALERT_NOTIFY_EMAILS': 'a@who.int,b@who.int'})
    @patch('sentinel.agent_classifier.send_mail')
    def test_sends_email_for_critical(self, mock_send):
        """Email is sent when severity is critical."""
        from sentinel.agent_classifier import notify_officers

        signal = _make_signal(ai_classification='continent_alert')
        review_result = {
            'severity': 'critical',
            'notification_scope': 'worldwide',
            'notify_groups': 'WHO HQ',
            'reasoning': 'VHF outbreak.',
        }

        result = notify_officers(signal, review_result)

        self.assertTrue(result['notified'])
        self.assertIn('email', result['channels'])
        mock_send.assert_called_once()
        call_kwargs = mock_send.call_args
        self.assertIn('CRITICAL', call_kwargs[1]['subject'] if 'subject' in call_kwargs[1] else call_kwargs[0][0])

    @patch.dict('os.environ', {'ALERT_NOTIFY_EMAILS': 'a@who.int'})
    @patch('sentinel.agent_classifier.send_mail')
    def test_sends_email_for_high(self, mock_send):
        """Email is sent when severity is high."""
        from sentinel.agent_classifier import notify_officers

        signal = _make_signal(ai_classification='area_alert')
        review_result = {
            'severity': 'high',
            'notification_scope': 'continental',
            'notify_groups': 'Africa CDC',
            'reasoning': 'Significant cases.',
        }

        result = notify_officers(signal, review_result)

        self.assertTrue(result['notified'])
        self.assertIn('email', result['channels'])
        mock_send.assert_called_once()

    @patch.dict('os.environ', {'ALERT_NOTIFY_EMAILS': 'a@who.int'})
    @patch('sentinel.agent_classifier.send_mail')
    def test_skips_for_low(self, mock_send):
        """No notification for low severity."""
        from sentinel.agent_classifier import notify_officers

        signal = _make_signal()
        review_result = {'severity': 'low'}

        result = notify_officers(signal, review_result)

        self.assertFalse(result['notified'])
        self.assertEqual(result['reason'], 'severity=low')
        mock_send.assert_not_called()

    @patch.dict('os.environ', {'ALERT_NOTIFY_EMAILS': 'a@who.int'})
    @patch('sentinel.agent_classifier.send_mail')
    def test_skips_for_moderate(self, mock_send):
        """No notification for moderate severity."""
        from sentinel.agent_classifier import notify_officers

        signal = _make_signal()
        review_result = {'severity': 'moderate'}

        result = notify_officers(signal, review_result)

        self.assertFalse(result['notified'])
        mock_send.assert_not_called()

    @patch.dict('os.environ', {
        'ALERT_NOTIFY_EMAILS': '',
        'TELEGRAM_BOT_TOKEN': 'bot123',
        'TELEGRAM_CHAT_ID': '-100',
    })
    @patch('sentinel.agent_classifier.http_requests.post')
    def test_sends_telegram(self, mock_post):
        """Telegram message sent when bot token + chat ID are configured."""
        from sentinel.agent_classifier import notify_officers

        mock_post.return_value = MagicMock(status_code=200)
        signal = _make_signal(ai_classification='area_alert')
        review_result = {
            'severity': 'critical',
            'notification_scope': 'continental',
            'notify_groups': 'Africa CDC',
            'reasoning': 'Ebola confirmed.',
        }

        # Mock the dedup query (AgentStep) and corroboration lookup (AgentRun)
        with patch('sentinel.models.AgentStep') as MockStep, \
             patch('sentinel.models.AgentRun') as MockRun:
            MockStep.objects.filter.return_value.exclude.return_value.exists.return_value = False
            MockRun.objects.filter.return_value.order_by.return_value.first.return_value = None
            result = notify_officers(signal, review_result)

        self.assertTrue(result['notified'])
        self.assertIn('telegram', result['channels'])
        mock_post.assert_called_once()
        call_args = mock_post.call_args
        self.assertIn('api.telegram.org', call_args[0][0])
        # Verify Intelligence Briefing format
        msg_json = call_args[1]['json'] if 'json' in call_args[1] else call_args[0][1]
        self.assertEqual(msg_json['parse_mode'], 'HTML')
        self.assertIn('text', msg_json)

    @patch.dict('os.environ', {
        'ALERT_NOTIFY_EMAILS': 'a@who.int',
        'TELEGRAM_BOT_TOKEN': '',
        'TELEGRAM_CHAT_ID': '',
        'ALERT_TELEGRAM_BOT_TOKEN': '',
        'ALERT_TELEGRAM_CHAT_ID': '',
    })
    @patch('sentinel.agent_classifier.http_requests.post')
    @patch('sentinel.agent_classifier.send_mail')
    def test_skips_telegram_when_not_configured(self, mock_send, mock_post):
        """No Telegram call when env vars are empty."""
        from sentinel.agent_classifier import notify_officers

        signal = _make_signal(ai_classification='area_alert')
        review_result = {'severity': 'high'}

        notify_officers(signal, review_result)

        mock_post.assert_not_called()
        mock_send.assert_called_once()  # email still goes

    @patch.dict('os.environ', {'ALERT_NOTIFY_EMAILS': 'a@who.int'})
    @patch('sentinel.agent_classifier.send_mail')
    def test_logs_to_analyst_notes(self, mock_send):
        """Notification is logged to signal.analyst_notes."""
        from sentinel.agent_classifier import notify_officers

        signal = _make_signal(analyst_notes=None, ai_classification='area_alert')
        review_result = {'severity': 'critical'}

        notify_officers(signal, review_result)

        # analyst_notes should have been set
        signal.save.assert_called()
        self.assertIsNotNone(signal.analyst_notes)
        self.assertIn('NOTIFICATION SENT', signal.analyst_notes)
        self.assertIn('email', signal.analyst_notes)

    @patch.dict('os.environ', {'ALERT_NOTIFY_EMAILS': 'a@who.int'})
    @patch('sentinel.agent_classifier.send_mail')
    def test_appends_to_existing_notes(self, mock_send):
        """Notification is appended (not replaced) when notes already exist."""
        from sentinel.agent_classifier import notify_officers

        signal = _make_signal(
            analyst_notes='Previous note',
            ai_classification='area_alert',
        )
        review_result = {'severity': 'high'}

        notify_officers(signal, review_result)

        self.assertIn('Previous note', signal.analyst_notes)
        self.assertIn('NOTIFICATION SENT', signal.analyst_notes)


# ── _get_notify_emails tests ─────────────────────────────────────────────

class TestGetNotifyEmails(SimpleTestCase):
    """Tests for the _get_notify_emails helper."""

    @patch.dict('os.environ', {'ALERT_NOTIFY_EMAILS': 'a@who.int, b@who.int'})
    def test_parses_comma_separated(self):
        from sentinel.agent_classifier import _get_notify_emails
        emails = _get_notify_emails()
        self.assertEqual(emails, ['a@who.int', 'b@who.int'])

    @patch.dict('os.environ', {'ALERT_NOTIFY_EMAILS': ''})
    def test_returns_empty_for_blank(self):
        from sentinel.agent_classifier import _get_notify_emails
        self.assertEqual(_get_notify_emails(), [])

    @patch.dict('os.environ', {'ALERT_NOTIFY_EMAILS': '  single@who.int  '})
    def test_strips_whitespace(self):
        from sentinel.agent_classifier import _get_notify_emails
        self.assertEqual(_get_notify_emails(), ['single@who.int'])

    @patch.dict('os.environ', {})
    def test_returns_empty_when_not_set(self):
        from sentinel.agent_classifier import _get_notify_emails
        self.assertEqual(_get_notify_emails(), [])


# ── classify_single_signal tests ─────────────────────────────────────────

class TestClassifySingleSignal(SimpleTestCase):
    """Tests for the full pipeline via classify_single_signal()."""

    @patch('sentinel.agent_classifier.notify_officers')
    @patch('sentinel.agent_classifier.review_assess')
    @patch('sentinel.agent_classifier.monitor_classify')
    @patch('sentinel.models.Signal')
    def test_full_pipeline(self, MockSignal, mock_classify, mock_review, mock_notify):
        """classify_single_signal runs classify → review → save → notify."""
        from sentinel.agent_classifier import classify_single_signal

        mock_classify.return_value = {
            'classification': 'area_alert',
            'rationale': 'Cholera confirmed.',
        }
        mock_review.return_value = {
            'severity': 'high',
            'notification_scope': 'continental',
            'notify_groups': 'Africa CDC',
            'reasoning': 'Significant outbreak.',
        }
        MockSignal.objects.filter.return_value.order_by.return_value.values.return_value.__getitem__ = MagicMock(return_value=[])

        signal = _make_signal()
        result = classify_single_signal(signal)

        self.assertEqual(result['classification'], 'area_alert')
        self.assertEqual(result['severity'], 'high')
        signal.save.assert_called()
        mock_notify.assert_called_once()

    @patch('sentinel.agent_classifier.notify_officers')
    @patch('sentinel.agent_classifier.review_assess')
    @patch('sentinel.agent_classifier.monitor_classify')
    @patch('sentinel.models.Signal')
    def test_no_notify_for_no_alert(self, MockSignal, mock_classify, mock_review, mock_notify):
        """classify_single_signal does NOT call notify for no_alert."""
        from sentinel.agent_classifier import classify_single_signal

        mock_classify.return_value = {
            'classification': 'no_alert',
            'rationale': 'Background noise.',
        }
        mock_review.return_value = {
            'severity': 'low',
            'notification_scope': 'local',
            'notify_groups': '',
            'reasoning': 'OK',
        }
        MockSignal.objects.filter.return_value.order_by.return_value.values.return_value.__getitem__ = MagicMock(return_value=[])

        signal = _make_signal()
        classify_single_signal(signal)

        mock_notify.assert_not_called()


# ── classify_new_signals tests ───────────────────────────────────────────

class TestClassifyNewSignals(SimpleTestCase):
    """Tests for the batch entry point classify_new_signals()."""

    @patch('sentinel.agent_classifier.notify_officers')
    @patch('sentinel.agent_classifier.review_assess')
    @patch('sentinel.agent_classifier.monitor_classify')
    @patch('sentinel.models.Signal')
    @patch('sentinel.models.SignalStatus')
    def test_batch_processing(self, MockStatus, MockSignal, mock_classify, mock_review, mock_notify):
        """classify_new_signals processes all unclassified signals."""
        from sentinel.agent_classifier import classify_new_signals

        MockStatus.NEW = 'new'
        MockStatus.TRIAGED = 'triaged'
        MockStatus.VALIDATED = 'validated'

        signal1 = _make_signal(id=1, disease_name='Ebola')
        signal2 = _make_signal(id=2, disease_name='Cholera')

        mock_qs = MagicMock()
        mock_qs.filter.return_value.order_by.return_value.__getitem__ = MagicMock(return_value=[signal1, signal2])
        mock_qs.filter.return_value.order_by.return_value.__len__ = MagicMock(return_value=2)

        # History queryset
        history_qs = MagicMock()
        history_qs.order_by.return_value.values.return_value.__getitem__ = MagicMock(return_value=[])

        # Wire filter to return different querysets based on args
        def filter_side_effect(**kwargs):
            if 'ai_classification__isnull' in kwargs and 'status__in' in kwargs:
                return mock_qs.filter.return_value
            return history_qs

        MockSignal.objects.filter = MagicMock(side_effect=filter_side_effect)

        mock_classify.return_value = {
            'classification': 'area_alert',
            'rationale': 'Confirmed cases.',
        }
        mock_review.return_value = {
            'severity': 'high',
            'notification_scope': 'continental',
            'notify_groups': 'Africa CDC',
            'reasoning': 'Outbreak.',
        }

        result = classify_new_signals(limit=10)

        self.assertEqual(result['classified'], 2)
        self.assertEqual(result['total'], 2)
        self.assertEqual(mock_classify.call_count, 2)
        self.assertEqual(mock_review.call_count, 2)
        self.assertEqual(mock_notify.call_count, 2)

    @patch('sentinel.models.Signal')
    @patch('sentinel.models.SignalStatus')
    def test_empty_queue(self, MockStatus, MockSignal):
        """classify_new_signals returns early when no unclassified signals."""
        from sentinel.agent_classifier import classify_new_signals

        MockStatus.NEW = 'new'
        MockStatus.TRIAGED = 'triaged'
        MockStatus.VALIDATED = 'validated'

        mock_qs = MagicMock()
        mock_qs.filter.return_value.order_by.return_value.__getitem__ = MagicMock(return_value=[])
        mock_qs.filter.return_value.order_by.return_value.__len__ = MagicMock(return_value=0)
        MockSignal.objects = mock_qs

        result = classify_new_signals()

        self.assertEqual(result['classified'], 0)
        self.assertEqual(result['total'], 0)
