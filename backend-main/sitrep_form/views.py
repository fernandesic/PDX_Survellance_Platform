"""
SITREP Form — API Views

8 views for the SITREP form workflow:
  1. GenerateSitrepLinkView  — Admin generates a token link
  2. ValidateSitrepLinkView  — Public: validate token & get report data
  3. UpdateSitrepFieldView   — Public: auto-save a single field
  4. SitrepReportsListView   — Admin: list all SITREP reports
  5. SitrepReportDetailView  — Admin: get full report by ID
  6. DeleteSitrepReportView  — Admin: hard-delete a report
  7. ReactivateSitrepLinkView — Admin: extend link expiry
  8. ChecklistConfigView     — Public: get country→risk→checklist mapping
"""
import json
from datetime import timedelta

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache

from utils.index import custom_response
from .models import SitrepReport, SitrepLink, SitrepFieldEdit
from .serializers import SitrepReportSerializer, SitrepReportListSerializer
from .checklist_data import (
    COUNTRY_RISK_MAP, DEFAULT_RISK, AFRO_MEMBER_STATES,
    CHECKLIST_1, CHECKLIST_2, PILLAR_OPTIONS,
    get_country_risk, get_checklist,
)


class GenerateSitrepLinkView(APIView):
    """Admin generates a link for the SITREP form."""

    def post(self, request):
        sitrep_number = request.data.get('sitrep_number', '').strip()
        if not sitrep_number:
            return custom_response(
                "ERROR", message="sitrep_number is required.",
                data={}, http_status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            expires_in_hours = int(request.data.get('expires_in_hours', 24))
        except (TypeError, ValueError):
            expires_in_hours = 24
        expires_in_hours = max(1, min(expires_in_hours, 72))

        # Deactivate any previous links for this sitrep_number
        SitrepLink.objects.filter(sitrep_number=sitrep_number).update(is_active=False)

        # Create new link
        link = SitrepLink.objects.create(
            sitrep_number=sitrep_number,
            created_by=request.user,
            expires_at=timezone.now() + timedelta(hours=expires_in_hours),
        )

        # Get or create the report
        report, created = SitrepReport.objects.get_or_create(
            sitrep_number=sitrep_number, defaults={'link': link},
        )
        if not created and report.link != link:
            report.link = link
            report.save(update_fields=['link'])

        # Pre-fill fields from request if provided
        prefill_fields = [
            'reporting_period', 'triggering_event', 'prepared_by',
            'date_of_issue', 'data_cutoff', 'next_issue',
        ]
        updated = []
        for field in prefill_fields:
            value = request.data.get(field, '').strip()
            if value:
                old_value = getattr(report, field, '')
                setattr(report, field, value)
                updated.append(field)
                SitrepFieldEdit.objects.create(
                    report=report, field_name=field,
                    old_value=old_value, new_value=value,
                    edited_by=request.user.get_full_name() or request.user.email,
                )
        if updated:
            report.save(update_fields=updated)

        return custom_response(
            "OK", message="SITREP link generated successfully.",
            data={
                "token": str(link.token),
                "sitrep_number": sitrep_number,
                "expires_at": link.expires_at.isoformat(),
                "expires_in_hours": expires_in_hours,
            },
            http_status=status.HTTP_201_CREATED,
        )


@method_decorator(never_cache, name='dispatch')
class ValidateSitrepLinkView(APIView):
    """Validate a SITREP link token and return the report data."""
    permission_classes = [AllowAny]

    def get(self, request, token):
        try:
            link = SitrepLink.objects.get(token=token, is_active=True)
        except SitrepLink.DoesNotExist:
            return custom_response(
                "ERROR", message="Invalid or deactivated link.",
                data={}, http_status=status.HTTP_404_NOT_FOUND,
            )

        if link.is_expired:
            return custom_response(
                "ERROR",
                message="This link has expired. Please request a new link.",
                data={}, http_status=status.HTTP_410_GONE,
            )

        report, _ = SitrepReport.objects.get_or_create(
            sitrep_number=link.sitrep_number, defaults={'link': link},
        )

        serializer = SitrepReportSerializer(report)
        return custom_response(
            "OK", message="Link is valid.",
            data={
                "valid": True,
                "sitrep_number": link.sitrep_number,
                "expires_at": link.expires_at.isoformat(),
                "report": serializer.data,
            },
            http_status=status.HTTP_200_OK,
        )


class UpdateSitrepFieldView(APIView):
    """Auto-save a single field in the SITREP report (called on blur/change)."""
    permission_classes = [AllowAny]

    def patch(self, request):
        token = request.data.get('token')
        field_name = request.data.get('field_name')
        value = request.data.get('value', '')
        edited_by = request.data.get('edited_by', 'Anonymous')

        if not token or not field_name:
            return custom_response(
                "ERROR", message="token and field_name are required.",
                data={}, http_status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            link = SitrepLink.objects.get(token=token, is_active=True)
        except SitrepLink.DoesNotExist:
            return custom_response(
                "ERROR", message="Invalid or deactivated link.",
                data={}, http_status=status.HTTP_404_NOT_FOUND,
            )

        if link.is_expired:
            return custom_response(
                "ERROR", message="This link has expired.",
                data={}, http_status=status.HTTP_410_GONE,
            )

        if field_name not in SitrepReport.EDITABLE_FIELDS:
            return custom_response(
                "ERROR", message=f"Invalid field: {field_name}",
                data={}, http_status=status.HTTP_400_BAD_REQUEST,
            )

        report, _ = SitrepReport.objects.get_or_create(
            sitrep_number=link.sitrep_number, defaults={'link': link},
        )

        # For JSON fields, convert string to JSON if needed
        if field_name in ('checklist_responses', 'action_points'):
            if isinstance(value, str):
                try:
                    value = json.loads(value)
                except (json.JSONDecodeError, TypeError):
                    pass

        old_value = getattr(report, field_name, '')
        # Convert old value to string for audit comparison
        old_str = json.dumps(old_value) if isinstance(old_value, (dict, list)) else str(old_value)
        new_str = json.dumps(value) if isinstance(value, (dict, list)) else str(value)

        if old_str != new_str:
            SitrepFieldEdit.objects.create(
                report=report, field_name=field_name,
                old_value=old_str, new_value=new_str,
                edited_by=edited_by,
            )

        setattr(report, field_name, value)
        report.save(update_fields=[field_name, 'updated_on'])

        return custom_response(
            "OK", message=f"Field '{field_name}' updated.",
            data={"field": field_name, "value": value},
            http_status=status.HTTP_200_OK,
        )


class SitrepReportsListView(APIView):
    """Admin: list all SITREP reports with completion stats."""

    def get(self, request):
        reports = (
            SitrepReport.objects
            .select_related('link')
            .prefetch_related('edits')
            .order_by('-created_on')
        )

        data = []
        for report in reports:
            serialized = SitrepReportListSerializer(report).data

            # Calculate completion — count filled fields
            # Note: '0' IS a valid value for numeric stat fields (e.g. population_in_screening)
            # so we don't exclude it. Only truly blank strings are considered unfilled.
            filled = 0
            total = len(SitrepReport.EDITABLE_FIELDS)
            for f in SitrepReport.EDITABLE_FIELDS:
                val = getattr(report, f, '')
                if isinstance(val, str) and val.strip():
                    filled += 1
                elif isinstance(val, dict) and val:
                    filled += 1
                elif isinstance(val, list) and val:
                    filled += 1

            # Recent edits
            all_edits = sorted(
                report.edits.all(), key=lambda e: e.edited_at, reverse=True,
            )[:10]

            # Link info
            link_info = None
            link = report.link
            if link:
                link_info = {
                    'token': str(link.token),
                    'expires_at': link.expires_at.isoformat(),
                    'is_expired': link.is_expired,
                    'is_active': link.is_active,
                }

            data.append({
                **serialized,
                'filled_fields': filled,
                'total_fields': total,
                'completion_pct': round((filled / total) * 100) if total else 0,
                'recent_edits': [
                    {
                        'field': e.field_name,
                        'by': e.edited_by,
                        'at': e.edited_at.strftime('%Y-%m-%d %H:%M'),
                    }
                    for e in all_edits
                ],
                'link_info': link_info,
            })

        return custom_response(
            "OK", message="SITREP reports retrieved.",
            data=data, http_status=status.HTTP_200_OK,
        )


class SitrepReportDetailView(APIView):
    """Admin: get full report by ID (for PDF generation)."""

    def get(self, request, pk):
        try:
            report = SitrepReport.objects.get(pk=pk)
        except SitrepReport.DoesNotExist:
            return custom_response(
                "ERROR", message="Report not found.",
                data={}, http_status=status.HTTP_404_NOT_FOUND,
            )

        serializer = SitrepReportSerializer(report)
        return custom_response(
            "OK", message="Report retrieved.",
            data=serializer.data, http_status=status.HTTP_200_OK,
        )


class DeleteSitrepReportView(APIView):
    """Admin: hard-delete a SITREP report."""

    def delete(self, request, pk):
        try:
            report = SitrepReport.objects.get(pk=pk)
        except SitrepReport.DoesNotExist:
            return custom_response(
                "ERROR", message="Report not found.",
                data={}, http_status=status.HTTP_404_NOT_FOUND,
            )

        report.delete()
        return custom_response(
            "OK", message="Report deleted successfully.",
            data={"id": pk}, http_status=status.HTTP_200_OK,
        )


class ReactivateSitrepLinkView(APIView):
    """Admin: extend the expiry of a SITREP link and reactivate it."""

    def post(self, request, pk):
        try:
            expires_in_hours = int(request.data.get('expires_in_hours', 24))
        except (TypeError, ValueError):
            expires_in_hours = 24
        expires_in_hours = max(1, min(expires_in_hours, 168))

        try:
            report = SitrepReport.objects.get(pk=pk)
        except SitrepReport.DoesNotExist:
            return custom_response(
                "ERROR", message="Report not found.",
                data={}, http_status=status.HTTP_404_NOT_FOUND,
            )

        if not report.link:
            link = SitrepLink.objects.create(
                sitrep_number=report.sitrep_number,
                created_by=request.user,
                expires_at=timezone.now() + timedelta(hours=expires_in_hours),
            )
            report.link = link
            report.save(update_fields=['link'])
        else:
            link = report.link
            link.expires_at = timezone.now() + timedelta(hours=expires_in_hours)
            link.is_active = True
            link.save()

        # Deactivate all other links for this sitrep
        SitrepLink.objects.filter(
            sitrep_number=report.sitrep_number,
        ).exclude(pk=link.pk).update(is_active=False)

        return custom_response(
            "OK", message=f"Link reactivated for {expires_in_hours} hours.",
            data={
                "token": str(link.token),
                "expires_at": link.expires_at.isoformat(),
                "expires_in_hours": expires_in_hours,
            },
            http_status=status.HTTP_200_OK,
        )


class UploadHighlightImageView(APIView):
    """Public (token-gated): upload an image for the Weekly Highlights section.

    Accepts a multipart `image` file, converts it to a base64 data URL
    and appends a new item onto the report's `weekly_highlights` list.
    The frontend then manages captions / dates / is_highlight via the
    normal update-field endpoint.
    """
    permission_classes = [AllowAny]
    MAX_BYTES = 6 * 1024 * 1024  # 6 MB per image cap
    ALLOWED_MIME_PREFIX = 'image/'

    def post(self, request):
        import base64
        import uuid as _uuid

        token = request.data.get('token')
        caption = (request.data.get('caption') or '').strip()
        date = (request.data.get('date') or '').strip()
        image = request.FILES.get('image')

        if not token:
            return custom_response(
                "ERROR", message="token is required.",
                data={}, http_status=status.HTTP_400_BAD_REQUEST,
            )
        if not image:
            return custom_response(
                "ERROR", message="No image file provided.",
                data={}, http_status=status.HTTP_400_BAD_REQUEST,
            )

        content_type = image.content_type or ''
        if not content_type.startswith(self.ALLOWED_MIME_PREFIX):
            return custom_response(
                "ERROR", message="Uploaded file must be an image.",
                data={}, http_status=status.HTTP_400_BAD_REQUEST,
            )
        if image.size and image.size > self.MAX_BYTES:
            return custom_response(
                "ERROR",
                message=f"Image too large (max {self.MAX_BYTES // (1024*1024)} MB).",
                data={}, http_status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            link = SitrepLink.objects.get(token=token, is_active=True)
        except SitrepLink.DoesNotExist:
            return custom_response(
                "ERROR", message="Invalid or deactivated link.",
                data={}, http_status=status.HTTP_404_NOT_FOUND,
            )
        if link.is_expired:
            return custom_response(
                "ERROR", message="This link has expired.",
                data={}, http_status=status.HTTP_410_GONE,
            )

        report, _ = SitrepReport.objects.get_or_create(
            sitrep_number=link.sitrep_number, defaults={'link': link},
        )

        # Encode the image as a data URL.
        data_url = "data:%s;base64,%s" % (
            content_type,
            base64.b64encode(image.read()).decode('utf-8'),
        )

        highlights = list(report.weekly_highlights or [])
        new_item = {
            'id': str(_uuid.uuid4()),
            'image_data': data_url,
            'caption': caption,
            'date': date,
            # First image uploaded auto-becomes the highlight; later uploads do not.
            'is_highlight': len(highlights) == 0,
        }
        highlights.append(new_item)
        report.weekly_highlights = highlights
        report.save(update_fields=['weekly_highlights', 'updated_on'])

        SitrepFieldEdit.objects.create(
            report=report, field_name='weekly_highlights',
            old_value=f"len={len(highlights) - 1}",
            new_value=f"len={len(highlights)} (uploaded image)",
            edited_by=(request.data.get('edited_by') or 'Form User'),
        )

        return custom_response(
            "OK", message="Image uploaded.",
            data={
                "item": new_item,
                "weekly_highlights": highlights,
            },
            http_status=status.HTTP_201_CREATED,
        )


class ChecklistConfigView(APIView):
    """Public: return country→risk→checklist mapping and all checklist data."""
    permission_classes = [AllowAny]

    def get(self, request):
        return custom_response(
            "OK", message="Checklist config retrieved.",
            data={
                "countries": AFRO_MEMBER_STATES,
                "country_risk_map": COUNTRY_RISK_MAP,
                "default_risk": DEFAULT_RISK,
                "checklists": {
                    "1": CHECKLIST_1,
                    "2": CHECKLIST_2,
                },
                "pillar_options": PILLAR_OPTIONS,
            },
            http_status=status.HTTP_200_OK,
        )
