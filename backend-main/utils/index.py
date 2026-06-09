import logging
import re
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import (
    AuthenticationFailed,
    NotAuthenticated,
    PermissionDenied,
    Throttled,
    ValidationError,
)
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)

User = get_user_model()


def update_lock_count(user, action: str):
    valid_action = ['increase', 'fallback']
    if user.lock_count != 5:
        if action not in valid_action:
            return 0
        if action == 'increase':
            user.lock_count += 1
            user.save()
        if action == 'fallback':
            user.lock_count = 0
            user.save()
            return user.lock_count, False
        if user.lock_count == 5:
            now = timezone.now()
            # Calculate the next minute by adding a timedelta of 1 minute
            next_minute = now + timedelta(minutes=5)
            user.lock_count = 0
            user.lock_duration = next_minute
            user.save()
            return 5, True
        return user.lock_count, True
    return 5, False


def custom_response(status, message, data=None, http_status=status.HTTP_200_OK):
    return Response({
        "status": status,
        "message": message,
        "data": data
    }, status=http_status)


def custom_exception_handler(exc, context):
    """
    Global exception handler — ensures EVERY API error returns:
        {"status": "Error", "message": "<human-readable>", "data": {}}

    Handles:
        - ValidationError      → field-level message extraction
        - AuthenticationFailed  → "Invalid or expired token"
        - NotAuthenticated      → "Authentication credentials were not provided"
        - PermissionDenied      → "You do not have permission"
        - Throttled             → "Too many requests. Try again in X seconds."
        - Http404               → "Not found"
        - Unhandled exceptions  → logged server-side, generic message to client
    """
    # Let DRF handle known exceptions first
    response = exception_handler(exc, context)

    # ── Unhandled exception (500) — DRF returns None ──────────────
    if response is None:
        # Log the full traceback server-side
        view = context.get('view', None)
        view_name = view.__class__.__name__ if view else 'UnknownView'
        logger.error(
            "Unhandled exception in %s: %s",
            view_name, str(exc),
            exc_info=True,
        )
        return Response(
            {
                "status": "Error",
                "message": "An internal error occurred. Please try again.",
                "data": {},
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    # ── Extract a human-readable message from the DRF response ────
    message = _extract_message(exc, response)

    # ── Throttled — include retry info ────────────────────────────
    if isinstance(exc, Throttled):
        wait = int(exc.wait or 0)
        message = f"Too many requests. Try again in {wait} seconds."

    # ── Rebuild response in standard shape ────────────────────────
    response.data = {
        "status": "Error",
        "message": message,
        "data": {},
    }
    return response


def _extract_message(exc, response):
    """Pull a single human-readable string from any DRF exception."""

    # ValidationError — can be dict, list, or string
    if isinstance(exc, ValidationError):
        detail = exc.detail
        if isinstance(detail, dict):
            try:
                first_field = next(iter(detail))
                first_error = detail[first_field]
                if isinstance(first_error, list):
                    return str(first_error[0])
                return str(first_error)
            except (StopIteration, TypeError):
                return "Validation error occurred."
        elif isinstance(detail, list):
            return str(detail[0])
        return str(detail)

    # Standard DRF exceptions with 'detail'
    if hasattr(exc, 'detail'):
        detail = exc.detail
        if isinstance(detail, str):
            return detail
        if isinstance(detail, list):
            return str(detail[0])

    # Fallback — try response.data keys
    data = response.data
    if isinstance(data, dict):
        for key in ('message', 'detail', 'error'):
            if key in data:
                val = data[key]
                return str(val[0]) if isinstance(val, list) else str(val)
        # Last resort — first value
        try:
            first = next(iter(data.values()))
            return str(first[0]) if isinstance(first, list) else str(first)
        except (StopIteration, TypeError):
            pass

    return "An error occurred."


def format_date(date):
    """Generates and returns the formatted date

    Args:
        date (datetime): A datetime obj or DateTimeField
        returns {day}{suffix} of {month} {year}

    Returns:
        str: 4th of december 2024
    """
    day = str(date.day)
    month = date.strftime('%B')
    year = date.year
    #predefine the suffixes
    suffixes = {1: 'st', 2: 'nd', 3: 'rd'}
    
    if int(day[-1]) in suffixes.keys():
        suffix = suffixes[int(day[-1])]
    else:
        suffix = 'th'
        
    return f"{day}{suffix} of {month} {year}"


def check_special_character(password: str)->bool:
    # Define the regular expression for special characters
    special_char_pattern = r'[!@#$%^&*(),.?":{}|<>]'
    
    # Search for a special character in the password
    if re.search(special_char_pattern, password):
        return True
    else:
        return False
    

def get_client_ip(request):
    """Get the real client IP address even if behind a proxy."""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip

def get_browser_info(request):
    ua_string = request.META.get('HTTP_USER_AGENT', '')

    # Look for major browsers
    match = re.search(r'(Chrome|Firefox|Safari|Edge|Opera|MSIE|Trident)\/([\d.]+)', ua_string)
    if match:
        browser, version = match.groups()
        # Map "Trident" to "Internet Explorer"
        if browser == "Trident":
            browser = "Internet Explorer"
        return f"{browser} {version}"

    return "Unknown Browser"

def gen_unique_key(sheet_name, idx):
    return f"{sheet_name}_row_{idx}"

def parse_number(value):
    try:
        return float(value)
    except (ValueError, TypeError):
        return None
    
def is_year(s: str) -> bool:
    return s.isdigit() and len(s) == 4