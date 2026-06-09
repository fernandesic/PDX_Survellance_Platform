"""Tests for AgentRun + AgentStep models."""

from uuid import UUID

from django.db import IntegrityError, transaction
from django.test import TestCase

from sentinel.models import (
    AgentRun,
    AgentRunStatus,
    AgentStep,
    AgentStepKind,
    Signal,
)


def _make_signal():
    return Signal.objects.create(
        location_country='Democratic Republic of the Congo',
        location_country_iso='COD',
        original_text='Cholera outbreak reported in Kinshasa',
        source_name='WHO',
    )


class AgentRunModelTests(TestCase):
    def test_run_id_is_uuid(self):
        run = AgentRun.objects.create(signal=_make_signal())
        self.assertIsInstance(run.run_id, UUID)
        self.assertEqual(run.status, AgentRunStatus.QUEUED)
        self.assertEqual(run.corroboration_count, 0)
        self.assertIsNone(run.confidence)
        self.assertIsNone(run.finished_at)

    def test_create_run_and_steps_ordered(self):
        signal = _make_signal()
        run = AgentRun.objects.create(
            signal=signal,
            status=AgentRunStatus.RUNNING,
            provider='openai',
            model_name='gpt-5.5',
        )
        AgentStep.objects.create(
            run=run, step_number=2, kind=AgentStepKind.CLASSIFY,
            output_summary='continent_alert', latency_ms=1200,
        )
        AgentStep.objects.create(
            run=run, step_number=1, kind=AgentStepKind.PERCEIVE,
            output_summary='picked up signal', latency_ms=80,
        )
        AgentStep.objects.create(
            run=run, step_number=3, kind=AgentStepKind.CORROBORATE,
            output_summary='3 sources', latency_ms=210,
            citations=[{'source_name': 'WHO', 'tier': 1}],
        )

        steps = list(run.steps.all())
        self.assertEqual([s.step_number for s in steps], [1, 2, 3])
        self.assertEqual(steps[2].citations[0]['tier'], 1)

    def test_cascade_delete_from_signal(self):
        signal = _make_signal()
        run = AgentRun.objects.create(signal=signal)
        AgentStep.objects.create(
            run=run, step_number=1, kind=AgentStepKind.PERCEIVE,
        )
        self.assertEqual(AgentRun.objects.count(), 1)
        self.assertEqual(AgentStep.objects.count(), 1)

        signal.delete()

        self.assertEqual(AgentRun.objects.count(), 0)
        self.assertEqual(AgentStep.objects.count(), 0)

    def test_unique_step_number_per_run(self):
        run = AgentRun.objects.create(signal=_make_signal())
        AgentStep.objects.create(
            run=run, step_number=1, kind=AgentStepKind.PERCEIVE,
        )
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                AgentStep.objects.create(
                    run=run, step_number=1, kind=AgentStepKind.CLASSIFY,
                )

    def test_same_step_number_allowed_in_different_runs(self):
        signal = _make_signal()
        run_a = AgentRun.objects.create(signal=signal)
        run_b = AgentRun.objects.create(signal=signal)
        AgentStep.objects.create(
            run=run_a, step_number=1, kind=AgentStepKind.PERCEIVE,
        )
        AgentStep.objects.create(
            run=run_b, step_number=1, kind=AgentStepKind.PERCEIVE,
        )
        self.assertEqual(AgentStep.objects.count(), 2)
