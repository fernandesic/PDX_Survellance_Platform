"""
AFRO Sentinel Watchtower - Noise Filter
Ported from AFRO-SENTINEL ingest-signals edge function.

Filters out irrelevant content before processing signals:
- Political news (WHO reform, Trump, funding debates)
- Non-African focus
- Non-health content
"""

import re
from typing import Optional, Dict, Any

# Political noise keywords - reject signals containing these
POLITICAL_NOISE = [
    # US politics  
    "trump", "biden", "white house", "republican", "democrat", "congress",
    "maga", "election campaign", "election", "vote", "ballot",
    # WHO politics
    "who reform", "who funding", "who withdrawal", "defund who",
    "who director", "who leadership", "who budget",
    # General politics
    "parliament", "minister resigns", "cabinet reshuffle", "opposition party",
    "sanctions", "trade war", "tariff", "diplomatic crisis",
]

# Non-outbreak keywords - missing health context
NON_OUTBREAK_KEYWORDS = [
    "vaccine mandate", "vaccination policy", "health insurance",
    "healthcare reform", "hospital funding", "medical staff",
    "pharmaceutical", "drug approval", "clinical trial results",
]

# Required outbreak indicators - at least one must be present
OUTBREAK_INDICATORS = [
    # Cases & deaths
    "cases", "deaths", "died", "killed", "outbreak", "epidemic", "pandemic",
    "spreading", "confirmed", "suspected", "reported", "hospitalized",
    # Symptoms
    "fever", "diarrhea", "vomiting", "bleeding", "rash", "paralysis",
    "jaundice", "cough", "respiratory", "hemorrhagic",
    # Response
    "quarantine", "isolation", "contact tracing", "emergency response",
    "vaccination campaign", "treatment center", "health alert",
]

# African countries - for geo filtering
AFRICAN_COUNTRIES = [
    "algeria", "angola", "benin", "botswana", "burkina faso", "burundi",
    "cameroon", "cape verde", "central african republic", "chad", "comoros",
    "congo", "djibouti", "egypt", "equatorial guinea", "eritrea", "eswatini",
    "ethiopia", "gabon", "gambia", "ghana", "guinea", "guinea-bissau",
    "ivory coast", "cote d'ivoire", "kenya", "lesotho", "liberia", "libya",
    "madagascar", "malawi", "mali", "mauritania", "mauritius", "morocco",
    "mozambique", "namibia", "niger", "nigeria", "rwanda", "senegal",
    "seychelles", "sierra leone", "somalia", "south africa", "south sudan",
    "sudan", "tanzania", "togo", "tunisia", "uganda", "zambia", "zimbabwe",
    # Major cities
    "lagos", "cairo", "kinshasa", "johannesburg", "nairobi", "addis ababa",
    "dar es salaam", "khartoum", "abidjan", "accra", "dakar", "casablanca",
]

# African country ISO3 codes
AFRICAN_ISO3 = [
    "DZA", "AGO", "BEN", "BWA", "BFA", "BDI", "CMR", "CPV", "CAF", "TCD",
    "COM", "COG", "COD", "DJI", "EGY", "GNQ", "ERI", "SWZ", "ETH", "GAB",
    "GMB", "GHA", "GIN", "GNB", "CIV", "KEN", "LSO", "LBR", "LBY", "MDG",
    "MWI", "MLI", "MRT", "MUS", "MAR", "MOZ", "NAM", "NER", "NGA", "RWA",
    "SEN", "SYC", "SLE", "SOM", "ZAF", "SSD", "SDN", "TZA", "TGO", "TUN",
    "UGA", "ZMB", "ZWE",
]


class NoiseFilter:
    """Filter out irrelevant content from signal ingestion."""
    
    def __init__(self):
        # Compile regex patterns for performance
        self.political_pattern = re.compile(
            r'\b(' + '|'.join(re.escape(kw) for kw in POLITICAL_NOISE) + r')\b',
            re.IGNORECASE
        )
        self.outbreak_pattern = re.compile(
            r'\b(' + '|'.join(re.escape(kw) for kw in OUTBREAK_INDICATORS) + r')\b',
            re.IGNORECASE
        )
        self.african_pattern = re.compile(
            r'\b(' + '|'.join(re.escape(c) for c in AFRICAN_COUNTRIES) + r')\b',
            re.IGNORECASE
        )
    
    def is_political_noise(self, text: str) -> bool:
        """Check if text contains political noise keywords."""
        return bool(self.political_pattern.search(text))
    
    def has_outbreak_indicators(self, text: str) -> bool:
        """Check if text contains valid outbreak indicators."""
        return bool(self.outbreak_pattern.search(text))
    
    def has_african_focus(self, text: str, country_iso: Optional[str] = None) -> bool:
        """Check if signal has African geographic focus."""
        if country_iso and country_iso.upper() in AFRICAN_ISO3:
            return True
        return bool(self.african_pattern.search(text))
    
    def is_non_latin(self, text: str) -> bool:
        """Check if text contains non-Latin scripts (Chinese, Arabic, Korean, etc.)."""
        non_latin_pattern = re.compile(r'[\u4e00-\u9fff\u0600-\u06ff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]')
        # If more than 10% of characters are non-Latin, reject
        non_latin_chars = len(non_latin_pattern.findall(text))
        return non_latin_chars > len(text) * 0.1 if text else False
    
    def filter_signal(self, text: str, country_iso: Optional[str] = None) -> Dict[str, Any]:
        """
        Apply all noise filters to a signal.
        
        Returns:
            Dict with:
            - 'pass': bool - whether signal passes filters
            - 'reason': str - reason for rejection (if rejected)
            - 'score': int - quality score 0-100
        """
        # Reject non-Latin text (Chinese, Arabic, etc.)
        if self.is_non_latin(text):
            return {
                'pass': False,
                'reason': 'non_latin_text',
                'score': 0
            }
        
        # Check for political noise
        if self.is_political_noise(text):
            return {
                'pass': False,
                'reason': 'political_noise',
                'score': 0
            }
        
        # Check for African focus
        if not self.has_african_focus(text, country_iso):
            return {
                'pass': False,
                'reason': 'non_african_focus',
                'score': 0
            }
        
        # Check for outbreak indicators
        if not self.has_outbreak_indicators(text):
            return {
                'pass': False,
                'reason': 'missing_outbreak_indicators',
                'score': 20
            }
        
        # Calculate quality score
        score = 50
        
        # Boost for multiple outbreak indicators
        matches = self.outbreak_pattern.findall(text)
        score += min(len(matches) * 5, 30)  # Up to +30
        
        # Boost for specific African location
        if country_iso and country_iso.upper() in AFRICAN_ISO3:
            score += 10
        
        # Boost for specific numbers (cases, deaths)
        number_pattern = r'\b\d+\s*(cases?|deaths?|died|confirmed|suspected)\b'
        if re.search(number_pattern, text, re.IGNORECASE):
            score += 10
        
        return {
            'pass': True,
            'reason': None,
            'score': min(score, 100)
        }


# Singleton instance
noise_filter = NoiseFilter()
