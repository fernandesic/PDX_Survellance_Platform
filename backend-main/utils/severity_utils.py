# Severity Label Normalization
# Maps multilingual severity labels to standardized English labels

SEVERITY_MAPPING = {
    # English
    'low': 'Low',
    'moderate': 'Moderate',
    'high': 'High',
    'very high': 'Very High',
    'very low': 'Very Low',
    
    # French
    'faible': 'Low',
    'modéré': 'Moderate',
    'modérée': 'Moderate',
    'élevé': 'High',
    'élevée': 'High',
    'très élevé': 'Very High',
    'très élevée': 'Very High',
    'très faible': 'Very Low',
    
    # Portuguese
    'baixa': 'Low',
    'baixo': 'Low',
    'moderada': 'Moderate',
    'moderado': 'Moderate',
    'elevada': 'High',
    'elevado': 'High',
    'muito elevada': 'Very High',
    'muito elevado': 'Very High',
    'muito baixa': 'Very Low',
    'muito baixo': 'Very Low',
    
    # Numeric codes
    '0': 'Very Low',
    '1': 'Low',
    '2': 'Moderate', 
    '3': 'High',
    '4': 'Very High',
}

# Valid English severity labels
VALID_SEVERITIES = ['Very Low', 'Low', 'Moderate', 'High', 'Very High']

# Severity colors
SEVERITY_COLORS = {
    'Low': '#22c55e',        # Green
    'Moderate': '#f97316',   # Orange
    'High': '#eab308',       # Yellow
    'Very High': '#dc2626',  # Red
    'Very Low': '#1e3a8a',   # Navy Blue
    'Unknown': '#94a3b8',    # Gray
}


def normalize_severity(severity: str) -> str:
    """
    Normalize severity label to standardized English.
    
    Args:
        severity: Raw severity string (may be in any language)
        
    Returns:
        Normalized English severity label
    """
    if not severity:
        return 'Unknown'
    
    severity_lower = severity.strip().lower()
    return SEVERITY_MAPPING.get(severity_lower, severity.strip())


def get_severity_color(severity: str) -> str:
    """Get color for a severity label."""
    normalized = normalize_severity(severity)
    return SEVERITY_COLORS.get(normalized, SEVERITY_COLORS['Unknown'])
