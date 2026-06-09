"""
Epidemiological Number Extractor — Regex-based.

Extracts reported_cases and reported_deaths from free-text headlines
and article bodies. No LLM dependency — runs at ingestion time.

Examples it handles:
    "3 dead, 14 injured in shooting"          → deaths=3, cases=14
    "Cholera kills 30 in DRC, 500 cases"      → deaths=30, cases=500
    "1,200 confirmed cases of measles"        → cases=1200
    "at least 42 people died"                 → deaths=42
    "over 3000 suspected cases reported"      → cases=3000
"""

import re
from typing import Optional, Dict


# ── Death patterns (order matters: more specific first) ──────────────────

_DEATH_PATTERNS = [
    # "3 dead" / "3 killed" / "3 died"
    r'(\d[\d,]*)\s*(?:people\s+)?(?:dead|killed|died)',
    # "killed 3" / "kills 30"
    r'(?:killed?|kills)\s+(\d[\d,]*)',
    # "3 deaths" / "3 fatalities"
    r'(\d[\d,]*)\s*(?:deaths?|fatalities?|fatality)',
    # "death toll of 3" / "death toll: 3" / "death toll rises to 3"
    r'death\s*toll\s*(?:of|:|\s*rises?\s*to|reaches?)\s*(\d[\d,]*)',
    # "at least 3 people died"
    r'(?:at\s+least|over|more\s+than|nearly|approximately|about)\s+(\d[\d,]*)\s*(?:people\s+)?(?:dead|killed|died)',
    # "claimed 3 lives"
    r'claimed?\s+(\d[\d,]*)\s*lives?',
]

# ── Case patterns ────────────────────────────────────────────────────────

_CASE_PATTERNS = [
    # "500 cases" / "500 confirmed cases" / "500 suspected cases"
    r'(\d[\d,]*)\s*(?:confirmed\s+|suspected\s+|reported\s+|new\s+)?cases?',
    # "14 injured" / "14 infected" / "14 hospitalized"
    r'(\d[\d,]*)\s*(?:people\s+)?(?:injured|infected|hospitalized|hospitalised|sickened|affected)',
    # "infected 500" / "sickened 200"
    r'(?:infected|sickened|affected|struck)\s+(\d[\d,]*)',
    # "over 3000 people infected"
    r'(?:at\s+least|over|more\s+than|nearly)\s+(\d[\d,]*)\s*(?:people\s+)?(?:cases?|infected|affected)',
]


def _parse_number(s: str) -> Optional[int]:
    """Parse a number string like '1,200' → 1200."""
    try:
        return int(s.replace(',', '').strip())
    except (ValueError, AttributeError):
        return None


def _extract_best_match(text: str, patterns: list) -> Optional[int]:
    """Run patterns against text and return the largest number found."""
    text_lower = text.lower()
    candidates = []

    for pattern in patterns:
        for match in re.finditer(pattern, text_lower, re.IGNORECASE):
            num = _parse_number(match.group(1))
            if num is not None and num > 0:
                candidates.append(num)

    # Return the largest number found (most likely the total)
    return max(candidates) if candidates else None


def extract_epi_numbers(text: str) -> Dict[str, Optional[int]]:
    """
    Extract reported_cases and reported_deaths from free text.

    Returns:
        {'cases': int | None, 'deaths': int | None}
    """
    if not text:
        return {'cases': None, 'deaths': None}

    deaths = _extract_best_match(text, _DEATH_PATTERNS)
    cases = _extract_best_match(text, _CASE_PATTERNS)

    # Sanity: if deaths > cases and cases is set, something's off
    # In that case, only trust the more specific (deaths) number
    if deaths is not None and cases is not None and deaths > cases:
        # "3 dead, 14 injured" → deaths=3, cases=14 (correct)
        # But "30 dead, 5 cases" → deaths=30, cases=5 (also valid — low testing)
        pass  # Trust both, real-world data can have deaths > confirmed cases

    return {'cases': cases, 'deaths': deaths}
