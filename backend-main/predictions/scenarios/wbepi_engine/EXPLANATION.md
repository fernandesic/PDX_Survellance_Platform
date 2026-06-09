# wbepi — Complete Code Explanation

This is a **complete reference** for the wbepi counterfactual scenario
engine. It explains what each file does, how they connect, what to
install, how to run things, and how to extend.

Audience: a new engineer who has never seen this codebase.

---

## 1. What is wbepi (in one paragraph)

**wbepi** is a stochastic SEIRDV epidemic simulator originally written
in R by Thibaut Jombart for the **World Bank Group** in collaboration
with the **London School of Tropical Medicine** (LSTM — *not* the
neural network). PDX has re-implemented it in Python and embedded it
in the Predictions Dashboard as a **counterfactual scenario engine**:
"if we apply intervention X (e.g. ring vaccination 7 days after
detection), what is the distribution of outbreak sizes vs doing
nothing?". It is **not a forecaster** — it does not predict whether
an outbreak will happen, only what it would look like under various
response strategies given parameters you provide.

The model has 6 compartments per population:

```
S (Susceptible) ─β·I/N─▶ E (Exposed) ─σ─▶ I (Infectious) ─γ─┬─▶ R (Recovered)
       │                                                    │
       └────vaccination────▶ V (Vaccinated)              ─μ─▶ D (Dead)
```

Multi-population spatial diffusion, reactive vaccination, and a
response-mode switch are built in. See [README.md](README.md) for the
quick-start.

---

## 2. What you need to install

### Python runtime + libraries

| Package | Version | Why |
|---|---|---|
| Python | 3.11 (the project venv targets this) | Required by `manage.py` and DRF stack |
| `numpy` | 2.x | Stochastic engine (Binomial draws, ndarray state) |
| `pandas` | 2.x | Output reshaping into long-format DataFrame + per-step quantile aggregation |
| `scipy` | 1.17+ | Parameter fitting (`scipy.integrate.solve_ivp`, `scipy.optimize.minimize`) |
| `Django` | 4.2.x (already in project) | Persistence + REST API |
| `djangorestframework` | 3.14.x (already in project) | Viewsets, serializers |
| `celery` | 5.3.x (already in project) | Async scenario execution |
| `redis` | service running on port 6379 | Celery broker |
| `pytest` | 7.x | Test runner |

To install scipy (the only one not already in `requirements.txt`):

```bash
cd backend-main
./venv/bin/python3.11 -m pip install scipy
```

Add to `requirements.txt` permanently:

```
scipy>=1.17
```

### Services that must be running for end-to-end use

1. **PostgreSQL** — Django DB (already set up; `DATABASE_URL` in env)
2. **Redis** — Celery broker (`localhost:6379`)
3. **Celery worker** — runs scenario simulations
4. **Django dev server** — serves the API + admin

Start them in three terminals:

```bash
# Terminal 1: Redis (if not already running)
redis-server

# Terminal 2: Celery worker
cd backend-main && ./venv/bin/celery -A datarepr worker -l info

# Terminal 3: Django
cd backend-main && ./venv/bin/python manage.py runserver
```

### Database migrations

Two migrations create + protect the wbepi tables:

```bash
cd backend-main
./venv/bin/python manage.py migrate predictions
```

This applies `0005_scenario_scenariorun` (creates tables) and
`0006_enable_rls_scenarios` (Row-Level Security policies).

### Running with R + rpy2 (the only engine)

> [!IMPORTANT]
> **The R engine is the only engine.** Production traffic flows
> through the upstream R `wbepi` package via rpy2 (Approach 2 from
> the original `wbepi-integration/plan.md`).
>
> All sprints **R1–R6** are complete:
>
> - **R1** — environment bootstrap + smoke test.
> - **R2** — `r_engine.py` rpy2 wrapper with identical `run_seirdv` signature.
> - **R3** — test parity against existing 42 tests.
> - **R4** — production hardening (worker recycle, GIL safety,
>   fork-safe lazy init, R→Python logging, soft timeouts, health check).
> - **R5** — cutover: default engine switched to R.
> - **R6** — cleanup (Option A): Python port (`model.py`, `runner.py`,
>   `validators.py`) and vendored R reference (`_r_reference/`)
>   deleted. R is now the sole engine.

**Additional system dependencies** for the rpy2 path:

| Component | Version | Install |
|---|---|---|
| R | 4.6.0+ | macOS: `brew install r` · Debian/Ubuntu: `apt install r-base r-base-dev` |
| R packages | wbepi 0.1.0.999, odin 1.5.12, rio, dde, remotes | Bootstrapped by `wbepi-rpy2/setup_r_env.sh` |
| `rpy2` | 3.6.x (range `>=3.5,<4` in `requirements.txt`) | Built from source against the local R install — **do not** rely on the pre-built wheel; it links against whatever R was current when uploaded to PyPI and will fail at import time if your local R version differs |

**Bootstrap (one command)** from the repo root:

```bash
./wbepi-rpy2/setup_r_env.sh
```

The script is idempotent — safe to re-run on a working environment.
It verifies R, installs missing R packages (rio, dde, odin from
GitHub, then the local wbepi from `wbepi-main/`), rebuilds rpy2 from
source if needed, and runs `wbepi-rpy2/smoke_test.py` to confirm the
Python ↔ R bridge.

**Manual verification** that the bridge works:

```bash
./backend-main/venv/bin/python wbepi-rpy2/smoke_test.py
```

Should print `ALL CHECKS PASSED` and exit 0. If it fails with
`Library not loaded: …libRblas.dylib…`, your rpy2 wheel is linked
against a different R version — re-run `setup_r_env.sh` which will
detect this and rebuild.

---

## 3. High-level architecture

```
┌──────────────────────────────────────────────────────────────┐
│  FRONTEND (frontend-main/src/pages/predictions/scenarios/)   │
│  React + Recharts — quantile band charts, polling hook       │
└─────────────────────────┬────────────────────────────────────┘
                          │ HTTP (POST /scenario-runs/adhoc/)
                          ▼
┌──────────────────────────────────────────────────────────────┐
│  DJANGO REST API (predictions/views.py, urls.py, serializers)│
│  ScenarioRunViewSet — creates ScenarioRun, enqueues task     │
└─────────────────────────┬────────────────────────────────────┘
                          │ run_scenario_task.delay(...)
                          ▼
┌──────────────────────────────────────────────────────────────┐
│  CELERY WORKER (predictions/scenarios/tasks.py)              │
│  Reads ScenarioRun, calls run_seirdv, saves results          │
└─────────────────────────┬────────────────────────────────────┘
                          │ run_seirdv(...)
                          ▼
┌──────────────────────────────────────────────────────────────┐
│  PURE ENGINE (predictions/scenarios/wbepi_engine/)           │
│  NumPy/pandas only — no Django coupling                      │
│  model.py + runner.py + validators.py + priors.py + fitting.py│
└──────────────────────────────────────────────────────────────┘
```

Three layers, cleanly separated:

1. **Pure engine** — `wbepi_engine/`. No Django, no HTTP, no database.
   Stateless. Importable as a library.
2. **Django bridge** — `predictions/scenarios/tasks.py` +
   `predictions/views.py`. Wraps the engine in a Celery task and
   exposes it through DRF.
3. **Frontend** — React component that hits the API and renders
   trajectory charts.

---

## 4. File-by-file breakdown

### 4.1 Pure engine — `predictions/scenarios/wbepi_engine/`

| File | Role | Length |
|---|---|---|
| [`__init__.py`](__init__.py) | Public API export — `from … import run_seirdv`. Directly imports from `r_engine`. | ~40 |
| [`README.md`](README.md) | Quick-start, what's NOT here yet (Django coupling), how to run tests. | — |
| [`LICENSE.md`](LICENSE.md) | MIT license — vendored from upstream. Preserves attribution chain. | — |
| [`r_engine.py`](r_engine.py) | **Primary engine (default).** rpy2 bridge — calls `wbepi::run_seirdv` in R. Lazy post-fork init, R→Python logging, `gc()` + `gc.collect()`, RSS monitoring, health check. | ~340 |
| [`priors.py`](priors.py) | **Pathogen prior library.** `PathogenPriors` dataclass per pathogen with literature-cited parameter ranges. Cholera fully validated; others are stubs. `sample_from_priors()` for Monte Carlo draws. | ~270 |
| [`fitting.py`](fitting.py) | **Parameter estimation from observed data.** `fit_parameters()` uses scipy L-BFGS-B. `fit_with_bootstrap()` adds 95% CI. Returns `FitResult` compatible with `run_seirdv`. | ~270 |
| [`cost_effectiveness.py`](cost_effectiveness.py) | **CEA framework.** DALYs, deaths averted, ICER, WHO-CHOICE thresholds. Uses active engine via package-level import. | ~196 |

#### Subdirectories

| Path | What | Role |
|---|---|---|
| `docs/` | `integration_brief.docx` (original WHO-AFRO design brief), `wbepi_pdx_analysis.md` (internal analysis) | Background reading |
| `tests/` | pytest suite | See §6 |
| `tests/data/` | `toy_data.xlsx` (10-sim R reference) + README with regen recipe | Tier-2 parity fixture |

### 4.1a Production hardening (Sprint R4)

The rpy2 bridge introduces production risks that the pure-Python
engine did not have. These are mitigated at three levels:

#### Celery worker configuration (`datarepr/settings/base.py`)

| Setting | Value | Why |
|---|---|---|
| `CELERY_WORKER_MAX_TASKS_PER_CHILD` | 50 (env-overridable) | R's RSS grows monotonically. Recycling every 50 tasks ≈ 1–2 hours of traffic prevents OOM kills. |
| `CELERY_WORKER_CONCURRENCY` | 1 (env-overridable) | rpy2 holds the GIL during R calls. Only one simulation per process. Scale horizontally with more workers. |

#### Task hardening (`predictions/scenarios/tasks.py`)

| Feature | Details |
|---|---|
| `soft_time_limit` | 540s (9 min). Raises `SoftTimeLimitExceeded` so the task can mark the row `FAILED` with a human-readable timeout message. |
| `time_limit` | 630s (10 min 30s). Hard kill — fallback if the soft timeout fails. |
| `acks_late` | `True`. Broker keeps the message until the task completes. If the worker is recycled mid-task, the message is redelivered. |
| Logger | Uses `wbepi` logger for structured output alongside Python tracebacks. |

#### R engine safety (`r_engine.py`)

| Feature | Details |
|---|---|
| Lazy init | R loads on first call inside the worker child — **never** in the parent (fork-safe; risk R-3). |
| Pre-warm | `datarepr/celery.py` `worker_process_init` signal triggers `health_check()` post-fork so the first scenario task has zero cold-start lag. Controlled by `WBEPI_PREWARM=1\|0`. |
| Logging callbacks | R's `stdout` / `stderr` / `warning()` routed to `wbepi.r` Python logger via rpy2 console callbacks. R warnings appear in the Celery log. |
| Post-run GC | Both R `gc()` and Python `gc.collect()` fire after every simulation to limit RSS drift. |
| RSS monitoring | `get_worker_rss_mb()` logs before/after RSS at DEBUG level. Useful for tuning `MAX_TASKS_PER_CHILD`. |
| Health check API | `GET /api/v1/predictions/scenario-runs/engine-health/` reports active engine, R version, wbepi version, and worker RSS. Returns 503 if R fails. |

### 4.2 Django bridge — `predictions/scenarios/`

| File | Role |
|---|---|
| [`__init__.py`](__init__.py) | Namespace package marker (sub-package, NOT in INSTALLED_APPS). |
| [`tasks.py`](tasks.py) | **Celery task `run_scenario_task`**: fetches a PENDING `ScenarioRun`, builds kwargs from `parameters_snapshot`, calls `run_seirdv`, computes per-step quantile summary, writes status + summary + output to the row. 10-minute time limit, `acks_late=True`, no auto-retry. |
| `tests/conftest.py` | pytest fixtures for the task tests. |
| `tests/test_celery_task.py` | Tests `tasks.py` against mocked DB rows — verifies status transitions and error-message capture without needing a real worker or broker. |

### 4.3 Django app integration — `predictions/`

These files are part of the existing `predictions` Django app, NOT
the wbepi sub-package. Touch points:

| File | What was added for wbepi |
|---|---|
| [`models.py`](../../models.py) | `Scenario` model (saved scenario template) and `ScenarioRun` model (one stochastic execution). `Scenario` carries `pathogen`, `country_iso`, `parameters` (JSONB), `created_by`, `tenant`. `ScenarioRun` carries `parameters_snapshot`, `seed`, `status`, `summary_stats` (JSONB), `output_blob` (JSONB), timing fields, FK to `created_by` user. Both nullable `tenant` FK + RLS. |
| [`migrations/0005_scenario_scenariorun.py`](../../migrations/0005_scenario_scenariorun.py) | Creates the two tables with indexes on `(pathogen, country_iso)`, `(scenario, -created_at)`, `(status, -created_at)`. |
| [`migrations/0006_enable_rls_scenarios.py`](../../migrations/0006_enable_rls_scenarios.py) | Enables PostgreSQL Row-Level Security on both tables. Policy: row visible iff `current_setting('app.current_tenant')` is `'0'` (super-admin) OR matches `tenant_id`. |
| [`views.py`](../../views.py) | `ScenarioViewSet` (CRUD on saved scenarios) and `ScenarioRunViewSet` (list/retrieve runs + `adhoc` POST action that creates a run, enqueues the Celery task, returns 202). Tenant auto-populated via `_resolve_user_tenant`. |
| [`serializers.py`](../../serializers.py) | DRF serializers — `ScenarioSerializer`, `ScenarioRunListSerializer` (compact, omits heavy `output_blob`), `ScenarioRunDetailSerializer` (includes `summary_stats`, `output_blob`, `has_output`), `ScenarioRunRequestSerializer` (request body validator). |
| [`urls.py`](../../urls.py) | Registers the two viewsets in the existing DRF router. |
| [`admin.py`](../../admin.py) | Admin pages for `Scenario` and `ScenarioRun` (read-only on runs — they are created via API). |

### 4.4 Frontend — `frontend-main/src/pages/predictions/scenarios/`

| File | Role |
|---|---|
| `scenariosApi.ts` | API client — `createRun`, `getRun`, `getOutput`, `listRuns`. TypeScript types for `ScenarioConfig`, `ScenarioRunSummary`, `ScenarioRunDetail`, `SummaryStats`. |
| `useScenarioRun.ts` | React hook: submits a config, sets up a 2s polling interval, stops at SUCCESS/FAILED or after 5min timeout. Returns `{run, loading, error, submit, reset, polling}`. |
| `ScenarioForm.tsx` | Input form, sectioned: Population & Initial State, Epidemiological Rates, Vaccination & Intervention, Simulation Settings. Defaults populated from a sensible cholera-ish scenario. |
| `ScenarioResults.tsx` | Quantile band chart per compartment using Recharts. KPI cards (peak infected, total deaths, attack rate, sims). Status badge (PENDING/RUNNING/SUCCESS/FAILED). |
| `ScenariosSection.tsx` | Container — left side form, right side results. Disclaimer banner. Embedded into `PredictionsView.tsx`. |

---

## 5. End-to-end request flow

When the user clicks **Run Scenario**:

1. **Frontend** (`ScenariosSection` → `useScenarioRun.submit(config)`):
   POSTs the config to `/api/v1/predictions/scenario-runs/adhoc/`.

2. **Django view** (`predictions/views.py::ScenarioRunViewSet.adhoc`):
   - Validates body via `ScenarioRunRequestSerializer`.
   - Creates a `ScenarioRun` row in `PENDING` status with
     `parameters_snapshot=config`.
   - Calls `_enqueue_scenario_run(run, request.user)` which calls
     `run_scenario_task.delay(run_id=…, tenant_id=…)`. Falls back to
     synchronous `apply()` if the broker is unreachable.
   - Returns **202 Accepted** with the stub `ScenarioRunListSerializer`
     payload.

3. **Celery worker** (`predictions/scenarios/tasks.py::run_scenario_task`):
   - Fetches the `ScenarioRun`, transitions to `RUNNING`, sets
     `started_at`.
   - Builds kwargs from `parameters_snapshot` and calls
     `run_seirdv(...)` from the pure engine.
   - Computes per-step quantiles (`_compute_summary_stats`) — keys
     `compartments`, `populations`, `steps`, `quantiles` (with
     `median`, `q05`, `q25`, `q75`, `q95` per column).
   - Stores the full long-format output (via `df.to_json(orient='split')`)
     in `output_blob`, transitions to `SUCCESS`, sets `completed_at`.
   - On any exception: status `FAILED`, `error_message` populated.

4. **Frontend polling** (`useScenarioRun.startPolling`):
   Polls `GET /scenario-runs/{id}/` every 2 seconds, stops on terminal
   status. The `ScenarioRunDetail` payload contains `summary_stats`,
   which `ScenarioResults` reads to render charts.

5. **Optional raw-output fetch**:
   `GET /scenario-runs/{id}/output/` returns the raw long-format
   DataFrame as JSON (split orient). Frontend currently does not
   call this; available for power users.

---

## 6. Tests

All tests live under `predictions/scenarios/`. Five pytest files
totaling **~53 tests**:

| File | Count | Speed | What it tests |
|---|---|---|---|
| `wbepi_engine/tests/test_schema.py` | 5 | <1s | Output column names, ordering, dtype, row count match the R contract. |
| `wbepi_engine/tests/test_deterministic.py` | 14 | <1s | Behavioural parity ports of R's `tests/testthat/test_run_seirdv.R`: full burn-through, mortality, vaccination (routine + reactive global + reactive targeted), response trigger, response release, spatial isolation. Uses extreme parameters (β=1e6, etc.) to force deterministic regimes. |
| `wbepi_engine/tests/test_distributional.py` | 6 | ~120s | Tier 2 parity vs R `toy_data.xlsx`. Compares marginal distributions over 1000 sims. Tolerance is **adaptive** — based on R's median standard error (1.253·σ/√n) so the test self-tightens as the R reference grows. |
| `wbepi_engine/tests/test_fitting.py` | ~16 | ~10s | Priors load correctly, parameter sampling stays within bounds, fit recovers known parameters from synthetic data, bootstrap CI bracket the point estimate, validation guards reject malformed input. |
| `tests/test_celery_task.py` | (varies) | <1s | `run_scenario_task` end-to-end with mocked DB rows — status transitions, summary compute, error capture. |
| `tests/test_production_hardening.py` | 6 | <2s | **Sprint R4**: fork safety regression (R loads in child process), soft timeout → FAILED, worker recycling config validation, R logging callbacks, RSS monitoring, health check function. Some tests skip if rpy2/R is unavailable. |

### Run them

From `backend-main/`:

```bash
# Fast tests only (under 1 second, skip the slow Tier-2 distributional)
./venv/bin/python -m pytest predictions/scenarios/wbepi_engine/tests/ \
    --ignore=predictions/scenarios/wbepi_engine/tests/test_distributional.py

# All tests including slow Tier-2 (~2 minutes)
./venv/bin/python -m pytest predictions/scenarios/wbepi_engine/tests/

# Just the fitting tests
./venv/bin/python -m pytest predictions/scenarios/wbepi_engine/tests/test_fitting.py -v

# Celery task tests
./venv/bin/python -m pytest predictions/scenarios/tests/

# Sprint R4 production hardening tests
./venv/bin/python -m pytest predictions/scenarios/tests/test_production_hardening.py -v
```

---

## 7. API contract

### `POST /api/v1/predictions/scenario-runs/adhoc/`

Create + execute an ad-hoc scenario run.

**Request body** (all parameters optional; defaults from the engine):

```json
{
  "seed": 42,
  "parameters": {
    "n_populations": 1,
    "ini_S": [10000],
    "ini_I": [10],
    "beta": 0.3,
    "sigma": 0.143,
    "gamma": 0.071,
    "mu": 0.01,
    "time": 180,
    "n_sims": 50,
    "interv_delay": 14,
    "interv_efficacy": 0.25,
    "interv_vacc_type": 2,
    "target_size": 200,
    "interv_release": 28
  }
}
```

**Response (202)** — list-shape stub:

```json
{
  "id": 17,
  "status": "PENDING",
  "scenario": null,
  "n_sims": 50,
  "time_steps": 180,
  "seed": null,
  "started_at": null,
  "completed_at": null,
  "duration_seconds": null,
  "created_at": "2026-05-05T11:23:00Z",
  "error_message": ""
}
```

### `GET /api/v1/predictions/scenario-runs/{id}/`

Detail with `summary_stats` once `status="SUCCESS"`.

```json
{
  "id": 17,
  "status": "SUCCESS",
  "duration_seconds": 0.8,
  "summary_stats": {
    "compartments": ["S", "E", "I", "R", "D", "V"],
    "populations": [1],
    "steps": [1, 2, …, 180],
    "quantiles": {
      "S[1]": {
        "median": [10000, 9990, …],
        "q05": […], "q25": […], "q75": […], "q95": […]
      },
      "I[1]": { … }
    }
  },
  …
}
```

### `GET /api/v1/predictions/scenario-runs/{id}/output/`

Raw long-format DataFrame as JSON (split orient): `{columns, index, data}`.

### `GET /api/v1/predictions/scenario-runs/`

List of recent runs (filtered by current user unless super-admin).

### `GET /api/v1/predictions/scenario-runs/engine-health/`

Sprint R4 health probe. Returns the active engine backend and its status.

**Response (200)** when healthy:

```json
{
  "engine": "r",
  "status": "ok",
  "r_version": "R version 4.6.0 (2025-04-11)",
  "wbepi_version": "0.1.0.999",
  "worker_rss_mb": 187.3
}
```

**Response (503)** if R fails to load:

```json
{
  "engine": "r",
  "status": "error",
  "detail": "rpy2 cannot reach R: ..."
}
```

---

## 8. How to extend

### Add a new pathogen to the prior library

Edit `predictions/scenarios/wbepi_engine/priors.py`:

1. Add a new module-level `PathogenPriors` instance with literature-
   sourced parameter ranges and citations.
2. Append it to the `_REGISTRY` tuple at the bottom of the file.
3. Set `validated=True` only after a domain expert reviews the values.

The new pathogen is automatically exposed via `get_pathogen_priors`,
`list_pathogens`, and `sample_from_priors`. Frontend's pathogen
selector pulls from the `PATHOGEN_CHOICES` on the `Scenario` model in
`predictions/models.py` — update that list too if you want the UI to
offer the new pathogen for saved scenarios.

### Add a new model parameter

This requires changes in three places:

1. **Engine**: `_r_reference/` (read the R odin model to confirm
   the math), then `model.py` (the transition equations) and
   `runner.py` (function signature + kwarg pass-through).
2. **Validators**: `validators.py` add a `check_rate`/`check_proportion`
   call.
3. **API**: `predictions/serializers.py` (`ScenarioRunRequestSerializer`)
   and `predictions/scenarios/tasks.py` (the kwarg pass-through to
   `run_seirdv`).
4. **Frontend**: `scenariosApi.ts` (TypeScript type) and
   `ScenarioForm.tsx` (input control).

### Generate a tighter Tier-2 reference (`toy_data_n1000.xlsx`)

See `tests/data/README.md` for the R recipe. Place the resulting file
in `tests/data/`. The Tier-2 distributional tests will pick it up
automatically and tighten their tolerances.

### Run a scenario from a Python script (no Django)

```python
import numpy as np
from predictions.scenarios.wbepi_engine import run_seirdv

df = run_seirdv(
    n_populations=4,
    ini_S=[1000, 3000, 12000, 2000],
    ini_I=[10, 0, 0, 1],
    beta=0.2, sigma=1/7, gamma=1/14, mu=0.3,
    interv_delay=10, interv_efficacy=0.25,
    interv_vacc_type=2, target_size=200,
    interv_release=28, time=365, diffusion=0.1,
    n_sims=10, rng=np.random.default_rng(seed=1),
)
print(df.shape, df.columns.tolist())
```

### Fit parameters from observed cases

```python
import numpy as np
from predictions.scenarios.wbepi_engine.fitting import fit_with_bootstrap

# Cumulative case time series from a real outbreak (e.g. WHO sit-rep)
times = np.arange(0, 90)            # days
cum_cases = np.array([10, 12, 15, …, 4500])  # length must match

result = fit_with_bootstrap(
    "cholera",
    observed_cumulative_cases=cum_cases,
    time_grid=times,
    initial_S=1_000_000,
    initial_I=10,
    n_bootstrap=200,
    rng=np.random.default_rng(0),
)
print(result.point_estimate)        # {"beta": 0.42, "sigma": ...}
print(result.ci_lower, result.ci_upper)
```

---

## 9. Known limitations

These are properties of the underlying SEIRDV model (inherited from R),
**not** bugs in the port. The UI must communicate them so users do not
over-trust:

- **No age structure / contact matrices** — cannot model age-targeted
  interventions.
- **No waning immunity / reinfection** — weak for endemic disease or
  multi-wave dynamics.
- **No vital dynamics** (births, non-disease deaths) — closed-population
  assumption, fine for short outbreak horizons (<1 year).
- **Single pathogen at a time** — no co-circulation modeling.
- **Stochastic parity vs R is statistical, not exact** — R and NumPy use
  different RNG streams. The Tier-1 deterministic tests verify
  exact parity in deterministic regimes; Tier-2 verifies marginal
  distributional parity.
- **Parameter fitting uses deterministic ODE** — the stochastic engine's
  uncertainty is not folded into the fit's confidence intervals. The
  bootstrap CIs reflect **observation-noise** uncertainty only.
- **Cost-effectiveness module data inputs are placeholders** — unit
  costs, DALY weights, and WHO-CHOICE thresholds must be supplied
  externally (or hard-coded per country) before the CEA output is
  decision-grade.

These are acceptable for **acute-outbreak counterfactual scenarios**,
which is the use case PDX targets. They are **not** acceptable for
endemic-disease forecasting; do not let the UI suggest otherwise.

---

## 10. Attribution + licensing

- **Original R implementation**: Thibaut Jombart (World Bank Group /
  London School of Tropical Medicine — abbreviated "LSTM" in upstream
  docs but **not** the neural network architecture of the same name).
- **License**: MIT — see [LICENSE.md](LICENSE.md).
- **PDX deployment**: covered by the World Bank's MIT permission for
  Member State use, but **written confirmation should be obtained**
  before any country-branded ministerial deployment.
- **Pinned upstream version**: wbepi v0.1.0.9000 (R package; canonical
  sources vendored under `_r_reference/`).

Every UI surface, API doc, and PDF export should preserve "World Bank
Group + Thibaut Jombart / London School of Tropical Medicine" credit
and expand "LSTM" on first use to avoid the neural-network confusion.

---

## 11. Pre-launch checklist (before external users see this)

- [ ] **Historical validation**. Run a known outbreak (proposed: 2018
      DRC Ebola) through the simulator with literature-derived
      parameters. Compare to actual outcome trajectories. Without
      this, ministerial trust is unearned.
- [ ] **Attribution audit**. Every UI surface, API doc, PDF export
      credits World Bank + Thibaut Jombart / London School of Tropical
      Medicine.
- [ ] **Licensing confirmation**. Written sign-off from the World Bank
      for Member State deployment.
- [ ] **Domain review of stubbed pathogen priors**. Mpox, Ebola,
      Measles, Meningitis, Marburg, Lassa, RVF, Yellow Fever — all
      currently `validated=False`. An epidemiologist must confirm
      values before they drive a real scenario.
- [ ] **Cost-effectiveness data**. Unit cost tables, DALY weights, and
      WHO-CHOICE thresholds plugged into `cost_effectiveness.py`.
