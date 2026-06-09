"""
Pathogen-specific prior distributions for SEIRDV parameters.

Each entry encodes the published-literature plausible range for the four
core parameters that ``run_seirdv`` consumes:

- ``beta``  — transmission rate (day^-1)
- ``sigma`` — 1 / mean incubation period (day^-1)
- ``gamma`` — 1 / mean infectious period (day^-1)
- ``mu``    — case fatality ratio in [0, 1]

Priors are encoded as **uniform ranges** ``(low, high)``. A more expressive
(log-normal / beta) representation is a future enhancement; uniform is
sufficient for the bootstrap fitting in ``fitting.py`` and for sampling
in scenario uncertainty propagation.

Validation status
-----------------

Each entry carries ``validated: bool``. ``True`` means the values are
sourced directly from published literature, with citations in
``sources``. ``False`` means the entry is a placeholder for the API
shape — **do not use in production scenarios** without a domain
expert's review.

Currently validated: cholera.
Currently stubbed   : mpox, ebola_zaire, measles, meningitis, marburg,
                      lassa_fever, rift_valley_fever, yellow_fever.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np


@dataclass(frozen=True)
class ParameterPrior:
    """Uniform prior on a single parameter."""

    low: float
    high: float
    units: str = ""
    note: str = ""

    def __post_init__(self) -> None:
        if self.low > self.high:
            raise ValueError(f"low ({self.low}) > high ({self.high})")
        if self.low < 0:
            raise ValueError(f"low ({self.low}) must be >= 0")

    @property
    def midpoint(self) -> float:
        return 0.5 * (self.low + self.high)

    def sample(self, rng: np.random.Generator, size: int = 1) -> np.ndarray:
        return rng.uniform(self.low, self.high, size=size)


@dataclass(frozen=True)
class PathogenPriors:
    """Prior distribution bundle for a single pathogen."""

    pathogen_id: str
    name: str
    description: str
    beta: ParameterPrior
    sigma: ParameterPrior
    gamma: ParameterPrior
    mu: ParameterPrior
    sources: tuple[str, ...] = field(default_factory=tuple)
    validated: bool = False

    def midpoints(self) -> dict[str, float]:
        """Default midpoint values, useful as a starting guess for fitting."""
        return {
            "beta": self.beta.midpoint,
            "sigma": self.sigma.midpoint,
            "gamma": self.gamma.midpoint,
            "mu": self.mu.midpoint,
        }

    def sample(self, rng: np.random.Generator, size: int = 1) -> dict[str, np.ndarray]:
        """Independent prior draws for each parameter."""
        return {
            "beta": self.beta.sample(rng, size),
            "sigma": self.sigma.sample(rng, size),
            "gamma": self.gamma.sample(rng, size),
            "mu": self.mu.sample(rng, size),
        }


# ─── Pathogen library ────────────────────────────────────────────────


_CHOLERA = PathogenPriors(
    pathogen_id="cholera",
    name="Cholera (Vibrio cholerae)",
    description=(
        "Acute diarrhoeal disease, primarily transmitted via faecally "
        "contaminated water. Outbreak dynamics depend strongly on water/"
        "sanitation context."
    ),
    # β: outbreak-context transmission rate. Mukandavire et al. (2011)
    # report R0 ≈ 2.8 for Zimbabwe 2008-09, with γ ≈ 1/3.5; β ≈ R0·γ ≈ 0.8.
    # Codeço (2001) and Hartley et al. (2006) put R0 in 1.5-3.5 for
    # outbreak settings, so β across γ-range is ~0.3-0.8.
    beta=ParameterPrior(0.3, 0.8, units="day^-1", note="frequency-dependent FOI"),
    # σ: 1 / incubation. Cholera incubation 1-5 days (Nelson et al. 2009).
    sigma=ParameterPrior(0.20, 1.00, units="day^-1", note="incubation 1-5 days"),
    # γ: 1 / infectious period. ~3-14 days (Kaper et al. 1995).
    gamma=ParameterPrior(0.07, 0.33, units="day^-1", note="infectious 3-14 days"),
    # μ: case fatality ratio. With timely ORS treatment <1%; without
    # treatment up to 50%. Outbreak settings in WHO AFRO range typically
    # reported at 1-5% (UNICEF/WHO situation reports).
    mu=ParameterPrior(0.01, 0.05, units="proportion", note="treated outbreak setting"),
    sources=(
        "Codeço CT (2001). Endemic and epidemic dynamics of cholera. BMC ID 1:1.",
        "Mukandavire Z et al. (2011). Estimating the reproductive numbers for the "
        "2008-2009 cholera outbreaks in Zimbabwe. PNAS 108(21).",
        "Nelson EJ, Harris JB, Morris JG, Calderwood SB, Camilli A (2009). "
        "Cholera transmission. Nat Rev Microbiol 7:693-702.",
    ),
    validated=True,
)


# ─── Stubs (placeholder values — DO NOT USE without domain review) ──
#
# Each entry below has a single citation as a starting reference and uses
# rough literature midpoints. A pathogen lead must validate before these
# drive a real ministerial-facing scenario.


_MPOX = PathogenPriors(
    pathogen_id="mpox",
    name="Mpox (Clade I, DRC context)",
    description="Zoonotic poxvirus; Clade I has ~10% CFR untreated.",
    beta=ParameterPrior(0.10, 0.30, units="day^-1"),
    sigma=ParameterPrior(0.05, 0.20, units="day^-1", note="incubation 5-21 days"),
    gamma=ParameterPrior(0.04, 0.10, units="day^-1", note="infectious ~10-25 days"),
    mu=ParameterPrior(0.05, 0.12, units="proportion", note="Clade I, untreated"),
    sources=(
        "Bunge EM et al. (2022). The changing epidemiology of human monkeypox. "
        "PLoS Negl Trop Dis 16(2):e0010141.",
    ),
    validated=False,
)


_EBOLA_ZAIRE = PathogenPriors(
    pathogen_id="ebola",
    name="Ebola virus (Zaire ebolavirus)",
    description="Filovirus; high CFR, person-to-person via body fluids.",
    beta=ParameterPrior(0.20, 0.45, units="day^-1"),
    sigma=ParameterPrior(0.10, 0.20, units="day^-1", note="incubation 5-12 days"),
    gamma=ParameterPrior(0.08, 0.14, units="day^-1", note="infectious 7-14 days"),
    mu=ParameterPrior(0.40, 0.70, units="proportion", note="historical untreated"),
    sources=(
        "Legrand J et al. (2007). Understanding the dynamics of Ebola epidemics. "
        "Epidemiol Infect 135(4):610-21.",
    ),
    validated=False,
)


_MEASLES = PathogenPriors(
    pathogen_id="measles",
    name="Measles (Morbillivirus)",
    description="Highly transmissible respiratory virus; R0 12-18 in naïve populations.",
    beta=ParameterPrior(1.00, 2.50, units="day^-1", note="very high R0"),
    sigma=ParameterPrior(0.08, 0.13, units="day^-1", note="incubation 8-12 days"),
    gamma=ParameterPrior(0.14, 0.20, units="day^-1", note="infectious 5-7 days"),
    mu=ParameterPrior(0.005, 0.05, units="proportion", note="varies LMIC vs HIC"),
    sources=(
        "Anderson RM, May RM (1991). Infectious Diseases of Humans. Oxford UP.",
    ),
    validated=False,
)


_MENINGITIS = PathogenPriors(
    pathogen_id="meningitis",
    name="Meningococcal meningitis",
    description="Bacterial; African meningitis-belt seasonal outbreaks.",
    beta=ParameterPrior(0.05, 0.20, units="day^-1"),
    sigma=ParameterPrior(0.10, 1.00, units="day^-1", note="incubation 1-10 days"),
    gamma=ParameterPrior(0.10, 0.25, units="day^-1"),
    mu=ParameterPrior(0.10, 0.50, units="proportion", note="varies by treatment access"),
    sources=(
        "WHO (2018). Meningococcal meningitis fact sheet.",
    ),
    validated=False,
)


_MARBURG = PathogenPriors(
    pathogen_id="marburg",
    name="Marburg virus",
    description="Filovirus; high CFR (24-88%), zoonotic.",
    beta=ParameterPrior(0.20, 0.45, units="day^-1"),
    sigma=ParameterPrior(0.10, 0.30, units="day^-1", note="incubation 3-10 days"),
    gamma=ParameterPrior(0.07, 0.14, units="day^-1"),
    mu=ParameterPrior(0.24, 0.88, units="proportion"),
    sources=("WHO (2024). Marburg virus disease fact sheet.",),
    validated=False,
)


_LASSA = PathogenPriors(
    pathogen_id="lassa_fever",
    name="Lassa fever",
    description="Arenavirus; rodent-borne with secondary human-to-human.",
    beta=ParameterPrior(0.05, 0.20, units="day^-1"),
    sigma=ParameterPrior(0.05, 0.15, units="day^-1", note="incubation 7-21 days"),
    gamma=ParameterPrior(0.05, 0.15, units="day^-1"),
    mu=ParameterPrior(0.01, 0.15, units="proportion"),
    sources=("WHO (2017). Lassa fever fact sheet.",),
    validated=False,
)


_RVF = PathogenPriors(
    pathogen_id="rift_valley_fever",
    name="Rift Valley fever",
    description="Phlebovirus; primarily livestock with mosquito vectors.",
    beta=ParameterPrior(0.05, 0.30, units="day^-1"),
    sigma=ParameterPrior(0.15, 0.30, units="day^-1", note="incubation 2-6 days"),
    gamma=ParameterPrior(0.10, 0.30, units="day^-1"),
    mu=ParameterPrior(0.005, 0.10, units="proportion"),
    sources=("WHO (2018). Rift Valley fever fact sheet.",),
    validated=False,
)


_YELLOW_FEVER = PathogenPriors(
    pathogen_id="yellow_fever",
    name="Yellow fever",
    description="Flavivirus; Aedes-borne, vaccine-preventable.",
    beta=ParameterPrior(0.05, 0.30, units="day^-1"),
    sigma=ParameterPrior(0.15, 0.50, units="day^-1", note="incubation 3-6 days"),
    gamma=ParameterPrior(0.20, 0.50, units="day^-1"),
    mu=ParameterPrior(0.02, 0.50, units="proportion", note="severe form CFR 30-60%"),
    sources=("WHO (2023). Yellow fever fact sheet.",),
    validated=False,
)


_REGISTRY: dict[str, PathogenPriors] = {
    p.pathogen_id: p
    for p in (
        _CHOLERA,
        _MPOX,
        _EBOLA_ZAIRE,
        _MEASLES,
        _MENINGITIS,
        _MARBURG,
        _LASSA,
        _RVF,
        _YELLOW_FEVER,
    )
}


# ─── Public API ─────────────────────────────────────────────────────


def get_pathogen_priors(pathogen_id: str) -> PathogenPriors:
    """Look up a pathogen by id. Raises KeyError on unknown."""
    try:
        return _REGISTRY[pathogen_id]
    except KeyError as exc:
        valid = ", ".join(sorted(_REGISTRY.keys()))
        raise KeyError(
            f"Unknown pathogen_id={pathogen_id!r}. Known: {valid}"
        ) from exc


def list_pathogens(*, only_validated: bool = False) -> list[str]:
    """Return pathogen ids registered in the library.

    With ``only_validated=True``, returns only those with ``validated=True``.
    """
    if only_validated:
        return sorted(p.pathogen_id for p in _REGISTRY.values() if p.validated)
    return sorted(_REGISTRY.keys())


def sample_from_priors(
    pathogen_id: str,
    *,
    n_samples: int = 1,
    rng: np.random.Generator | None = None,
) -> dict[str, np.ndarray]:
    """Draw ``n_samples`` parameter sets from a pathogen's priors.

    Useful for uncertainty propagation in scenario runs — e.g. run a
    sensitivity sweep across the prior distribution.

    Returns a dict with keys ``beta``, ``sigma``, ``gamma``, ``mu``,
    each value an ndarray of shape ``(n_samples,)``.
    """
    rng = rng if rng is not None else np.random.default_rng()
    priors = get_pathogen_priors(pathogen_id)
    return priors.sample(rng, size=n_samples)
