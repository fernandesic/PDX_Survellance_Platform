"""
Rate throttles for authentication endpoints.

Prevents brute-force attacks on login and token refresh by limiting
requests per IP address. Returns HTTP 429 with Retry-After header
when the limit is exceeded.

Rates are configured in settings via DEFAULT_THROTTLE_RATES:
    'login': '5/min'          — 5 login attempts per minute per IP
    'token_refresh': '10/min' — 10 refresh attempts per minute per IP
"""
from rest_framework.throttling import AnonRateThrottle


class LoginRateThrottle(AnonRateThrottle):
    """Throttle login attempts by IP address."""
    scope = 'login'


class TokenRefreshRateThrottle(AnonRateThrottle):
    """Throttle token refresh attempts by IP address."""
    scope = 'token_refresh'
