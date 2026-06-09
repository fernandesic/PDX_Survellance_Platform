# Test Data

## `toy_data.xlsx` — vendored R reference (10 sims)

The canonical small-sample R output, vendored alongside the engine. Used
by Tier 2 distributional parity tests in `test_distributional.py`.

Source: ran `_r_reference/run.R` with `set.seed(1)` against the upstream
World Bank wbepi R package (v0.1.0.9000).

## `toy_data_n1000.xlsx` — large reference (NOT in repo)

A 1000-sim version is needed to tighten the Tier 2 tolerances (currently
adaptive to R's small-n SE). Not committed — too large (~40 MB).

To regenerate it, set up R locally with the upstream wbepi package and
run from a directory containing the original R source:

```bash
Rscript -e '
  library(wbepi)
  set.seed(1)
  x <- run_seirdv(
    n_populations = 4, ini_S = c(1000, 3000, 12000, 2000),
    ini_I = c(10, 0, 0, 1), beta = 0.2, sigma = 1/7, gamma = 1/14, mu = 0.3,
    interv_delay = 10, interv_efficacy = 0.25, interv_vacc_type = 2L,
    target_size = 200, interv_release = 28, time = 365, diffusion = 0.1,
    n_sims = 1000
  )
  rio::export(x, file = "toy_data_n1000.xlsx")
'
```

Then copy the resulting file into this directory. The Tier 2 tests will
`pytest.skip` gracefully if the file is not present.
