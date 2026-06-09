"""
Security Headers Middleware — CSP + Permissions-Policy.

Adds Content-Security-Policy and Permissions-Policy headers to all
responses. These headers are required for WHO cybersecurity compliance
and protect against XSS, clickjacking, and unauthorized API usage.

CSP specifically whitelists login.microsoftonline.com for SSO redirects
while blocking all other cross-origin scripts/frames.
"""

from django.conf import settings
from django.utils.deprecation import MiddlewareMixin


class SecurityHeadersMiddleware(MiddlewareMixin):
    """
    Injects security headers into every HTTP response.

    Reads CSP_POLICY and PERMISSIONS_POLICY from Django settings.
    Only adds headers if the settings are defined and non-empty.
    """

    def process_response(self, request, response):
        # Content-Security-Policy
        csp = getattr(settings, 'CSP_POLICY', '')
        if csp:
            response['Content-Security-Policy'] = csp

        # Permissions-Policy (replaces Feature-Policy)
        pp = getattr(settings, 'PERMISSIONS_POLICY', '')
        if pp:
            response['Permissions-Policy'] = pp

        return response
