"""
Tests for run_scenario_task — tests the Celery task with mocked DB objects.

Uses predictions.models.ScenarioRun (main repo model).
"""

import gzip
import json
from unittest.mock import MagicMock, patch

import pytest


# ── Helpers ────────────────────────────────────────────────────────

def _make_mock_run(config, run_id=1, status='PENDING', seed=None):
    """Create a mock ScenarioRun object matching main repo model."""
    run = MagicMock()
    run.pk = run_id
    run.id = run_id
    run.parameters_snapshot = config
    run.status = status
    run.seed = seed
    run.n_sims = config.get('n_sims', 1)
    run.time_steps = config.get('time', 1)
    run.started_at = None
    run.completed_at = None
    run.error_message = ''
    run.summary_stats = {}
    run.output_blob = None
    run.save = MagicMock()
    return run


MINIMAL_CONFIG = {
    'n_populations': 1,
    'ini_S': [100],
    'ini_I': [5],
    'beta': 0.3,
    'sigma': 1 / 7,
    'gamma': 1 / 14,
    'mu': 0.0,
    'time': 30,
    'n_sims': 2,
    'diffusion': 0.0,
}

# Patch path — task imports from predictions.models inside the function
_MODELS = 'predictions.models'


class TestTaskSuccess:
    """Task completes successfully and updates run record."""

    @patch(f'{_MODELS}.ScenarioRun')
    def test_success_flow(self, MockScenarioRun):
        from predictions.scenarios.tasks import run_scenario_task

        mock_run = _make_mock_run(MINIMAL_CONFIG)
        MockScenarioRun.objects.get.return_value = mock_run
        MockScenarioRun.DoesNotExist = Exception
        MockScenarioRun.STATUS_RUNNING = 'RUNNING'
        MockScenarioRun.STATUS_SUCCESS = 'SUCCESS'

        result = run_scenario_task(run_id=1)

        # Should have set status to running then success
        assert mock_run.status == 'SUCCESS'
        assert mock_run.summary_stats is not None
        assert mock_run.completed_at is not None
        assert mock_run.save.call_count >= 2

        # Result should indicate success
        assert result['status'] == 'success'
        assert result['rows'] > 0

    @patch(f'{_MODELS}.ScenarioRun')
    def test_rng_seed_recorded(self, MockScenarioRun):
        """When no seed provided, task generates and records one."""
        from predictions.scenarios.tasks import run_scenario_task

        mock_run = _make_mock_run(MINIMAL_CONFIG, seed=None)
        MockScenarioRun.objects.get.return_value = mock_run
        MockScenarioRun.DoesNotExist = Exception
        MockScenarioRun.STATUS_RUNNING = 'RUNNING'
        MockScenarioRun.STATUS_SUCCESS = 'SUCCESS'

        run_scenario_task(run_id=2)

        assert mock_run.seed is not None
        assert isinstance(mock_run.seed, int)

    @patch(f'{_MODELS}.ScenarioRun')
    def test_explicit_seed_used(self, MockScenarioRun):
        """When explicit seed is provided, it should be used."""
        from predictions.scenarios.tasks import run_scenario_task

        mock_run = _make_mock_run(MINIMAL_CONFIG, seed=42)
        MockScenarioRun.objects.get.return_value = mock_run
        MockScenarioRun.DoesNotExist = Exception
        MockScenarioRun.STATUS_RUNNING = 'RUNNING'
        MockScenarioRun.STATUS_SUCCESS = 'SUCCESS'

        result = run_scenario_task(run_id=3)
        assert result['status'] == 'success'


class TestTaskFailure:
    """Task handles errors gracefully."""

    @patch(f'{_MODELS}.ScenarioRun')
    def test_run_not_found(self, MockScenarioRun):
        from predictions.scenarios.tasks import run_scenario_task

        MockScenarioRun.DoesNotExist = Exception
        MockScenarioRun.objects.get.side_effect = Exception('not found')

        result = run_scenario_task(run_id=999)
        assert 'error' in result

    @patch('predictions.scenarios.wbepi_engine.run_seirdv', side_effect=ValueError('negative beta'))
    @patch(f'{_MODELS}.ScenarioRun')
    def test_simulation_error(self, MockScenarioRun, mock_engine):
        from predictions.scenarios.tasks import run_scenario_task

        mock_run = _make_mock_run(MINIMAL_CONFIG)
        MockScenarioRun.objects.get.return_value = mock_run
        MockScenarioRun.DoesNotExist = Exception
        MockScenarioRun.STATUS_RUNNING = 'RUNNING'
        MockScenarioRun.STATUS_FAILED = 'FAILED'

        result = run_scenario_task(run_id=4)

        assert mock_run.status == 'FAILED'
        assert 'negative beta' in mock_run.error_message
        assert result['status'] == 'failed'


class TestOutputStorage:
    """Verify that output is stored as inline JSON."""

    @patch(f'{_MODELS}.ScenarioRun')
    def test_output_blob_stored(self, MockScenarioRun):
        from predictions.scenarios.tasks import run_scenario_task

        mock_run = _make_mock_run(MINIMAL_CONFIG)
        MockScenarioRun.objects.get.return_value = mock_run
        MockScenarioRun.DoesNotExist = Exception
        MockScenarioRun.STATUS_RUNNING = 'RUNNING'
        MockScenarioRun.STATUS_SUCCESS = 'SUCCESS'

        run_scenario_task(run_id=5)

        # Verify output_blob was set with valid split-format JSON
        assert mock_run.output_blob is not None
        assert 'columns' in mock_run.output_blob
        assert 'data' in mock_run.output_blob


class TestSummaryStats:
    """Verify summary stats format."""

    @patch(f'{_MODELS}.ScenarioRun')
    def test_summary_format(self, MockScenarioRun):
        from predictions.scenarios.tasks import run_scenario_task

        config = {**MINIMAL_CONFIG, 'n_populations': 2, 'ini_S': [100, 200], 'ini_I': [5, 3]}
        mock_run = _make_mock_run(config)
        MockScenarioRun.objects.get.return_value = mock_run
        MockScenarioRun.DoesNotExist = Exception
        MockScenarioRun.STATUS_RUNNING = 'RUNNING'
        MockScenarioRun.STATUS_SUCCESS = 'SUCCESS'

        run_scenario_task(run_id=6)

        stats = mock_run.summary_stats
        assert stats is not None
        assert set(stats['compartments']) == {'S', 'E', 'I', 'R', 'D', 'V'}
        assert stats['populations'] == [1, 2]
        assert len(stats['steps']) == config['time']

        # Check quantile keys exist for each compartment-population pair
        for comp in ['S', 'E', 'I', 'R', 'D', 'V']:
            for p in [1, 2]:
                col = f"{comp}[{p}]"
                assert col in stats['quantiles'], f"Missing {col}"
                q = stats['quantiles'][col]
                assert set(q.keys()) == {'median', 'q05', 'q25', 'q75', 'q95'}
                assert len(q['median']) == config['time']
