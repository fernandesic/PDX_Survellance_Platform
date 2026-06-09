# wbepi_engine — SEIRDV Stochastic Epidemic Simulator (Python Port)

> **Original R package by Thibaut Jombart (World Bank Group / LSTM — London School of Tropical Medicine).**
>
> License: MIT. This Python port preserves the original MIT license terms.
> Upstream reference: `wbepi` v0.1.0.9000.

## What is this?

A pure-Python re-implementation of the `wbepi` R package's stochastic SEIRDV
epidemic simulator.  It models a meta-population SEIRDV compartmental system
with:

- **Frequency-dependent transmission** with spatial dispersal (δ matrix).
- **Vaccination** — routine and reactive (global or ring).
- **Intervention response** — triggered by case detection, with configurable
  delay and release criteria.
- **Stochastic dynamics** via nested binomial draws (NumPy).

This is a **counterfactual scenario engine**, not a forecaster: *"If we trigger
ring vaccination 7 days after detection, what's the distribution of outbreak
sizes vs. doing nothing?"*

## Quick start

```python
from predictions.scenarios.wbepi_engine import run_seirdv

df = run_seirdv(
    n_populations=4,
    ini_S=[1000, 3000, 12000, 2000],
    ini_I=[10, 0, 0, 1],
    beta=0.2, sigma=1/7, gamma=1/14, mu=0.3,
    interv_delay=10, interv_efficacy=0.25,
    interv_vacc_type=2, target_size=200,
    interv_release=28, time=365, diffusion=0.1,
    n_sims=10,
    rng=numpy.random.default_rng(42),  # for reproducibility
)

print(df.shape)   # (3650, 30)
print(df.head())
```

## Output schema

A long-format `pandas.DataFrame` with columns:

```
sim, step, S[1], S[2], ..., S[n], E[1], ..., V[n], status[1], ..., status[n]
```

- `sim` and `step` are 1-indexed (matches R convention).
- Total columns: `2 + 7 × n_populations`.
- Total rows: `n_sims × time`.

## Dependencies

- Python 3.11+
- NumPy
- pandas

No Django, no SciPy, no Celery. Pure library.

## Running tests

```bash
# From the repo root
pytest backend-main/predictions/scenarios/wbepi_engine/tests/ -v

# Run only fast (Tier 1 + 3) tests
pytest backend-main/predictions/scenarios/wbepi_engine/tests/ -v -m "not slow"

# Run distributional (Tier 2) tests (requires toy_data.xlsx)
pytest backend-main/predictions/scenarios/wbepi_engine/tests/ -v -m slow
```

## Known limitations (model, not port)

- No age structure or contact matrices.
- No waning immunity or reinfection.
- No vital dynamics (births, non-disease deaths) — closed-population assumption.
- Single pathogen at a time.

These are acceptable for **acute-outbreak counterfactual scenarios** (<1 year
horizon), which is the target use case.

## Attribution

This work is based on the `wbepi` R package:

- **Author:** Thibaut Jombart
- **Affiliation:** World Bank Group / LSTM (London School of Tropical Medicine)
- **License:** MIT
