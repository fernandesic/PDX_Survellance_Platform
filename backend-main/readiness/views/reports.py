"""
Readiness Report Views — Preparedness reports + collaborative weekly report system.
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from utils.permissions import IsNotSupplierRole
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache

from utils.index import custom_response
from ..models import (
    PreparednessReport, ReportTeam, ReportMember,
    WeeklyReport, WeeklyReportLink, ReportFieldEdit,
)
from ..serializers import (
    PreparednessReportSerializer, TeamLookupSerializer,
    WeeklyReportSerializer, WeeklyReportListSerializer,
)


# ─── Preparedness Reports ───────────────────────────────────────────────

class PreparednessReportView(APIView):
    permission_classes = [IsAuthenticated, IsNotSupplierRole]

    def post(self, request):
        serializer = PreparednessReportSerializer(data=request.data)
        if serializer.is_valid():
            member_id = request.data.get('member')
            team_id = request.data.get('team')
            week_range = request.data.get('week_range')

            if member_id and team_id and week_range:
                exists = PreparednessReport.objects.filter(
                    member_id=member_id, team_id=team_id, week_range=week_range,
                ).exists()
                if exists:
                    return custom_response(
                        "ERROR",
                        message="You have already submitted a report for this week.",
                        data={},
                        http_status=status.HTTP_400_BAD_REQUEST,
                    )

            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


def get_current_week_range():
    """Compute the current Mon–Fri week range string."""
    from datetime import timedelta

    now = timezone.now()
    day = now.weekday()
    monday = now - timedelta(days=day)
    friday = monday + timedelta(days=4)
    month_names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    mon_month = month_names[monday.month - 1]
    fri_month = month_names[friday.month - 1]
    if mon_month == fri_month:
        return f"{mon_month} {monday.day}\u2013{friday.day}"
    return f"{mon_month} {monday.day} \u2013 {fri_month} {friday.day}"


class TeamLookupView(APIView):
    """Worker enters email + team code → returns member info + submission status."""
    permission_classes = [IsAuthenticated, IsNotSupplierRole]

    def post(self, request):
        serializer = TeamLookupSerializer(data=request.data)
        if not serializer.is_valid():
            return custom_response(
                "ERROR", message="Invalid input.",
                data=serializer.errors, http_status=status.HTTP_400_BAD_REQUEST,
            )

        team_code = serializer.validated_data['team_code']
        email = serializer.validated_data['email'].lower()

        try:
            team = ReportTeam.objects.get(code=team_code, is_active=True)
        except ReportTeam.DoesNotExist:
            return custom_response(
                "ERROR", message="Invalid team code.",
                data={}, http_status=status.HTTP_404_NOT_FOUND,
            )

        name = request.data.get('name', '').strip() or email.split('@')[0].title()
        member, created = ReportMember.objects.get_or_create(
            team=team, email__iexact=email,
            defaults={'name': name, 'email': email, 'is_active': True},
        )
        if not member.is_active:
            return custom_response(
                "ERROR",
                message="Your account has been deactivated. Contact your supervisor.",
                data={}, http_status=status.HTTP_403_FORBIDDEN,
            )

        current_week = get_current_week_range()
        already_submitted = PreparednessReport.objects.filter(
            member=member, team=team, week_range=current_week,
        ).exists()

        data = {
            "member_id": member.id,
            "member_name": member.name,
            "team_id": team.id,
            "team_name": team.name,
            "current_week": current_week,
            "already_submitted": already_submitted,
        }

        if already_submitted:
            past_reports = PreparednessReport.objects.filter(
                member=member,
            ).order_by('-created_on').values('id', 'week_range', 'created_on')
            data["past_reports"] = [
                {
                    "id": r["id"],
                    "week_range": r["week_range"],
                    "created_on": r["created_on"].strftime('%Y-%m-%d'),
                }
                for r in past_reports
            ]

        return custom_response("OK", message="Member found.", data=data, http_status=status.HTTP_200_OK)


class MemberReportsView(APIView):
    """Get all past reports for a specific member."""
    permission_classes = [IsAuthenticated, IsNotSupplierRole]

    def get(self, request):
        member_id = request.query_params.get('member_id')
        if not member_id:
            return custom_response(
                "ERROR", message="member_id is required.",
                data={}, http_status=status.HTTP_400_BAD_REQUEST,
            )

        reports = PreparednessReport.objects.filter(member_id=member_id).order_by('-created_on')
        serializer = PreparednessReportSerializer(reports, many=True)
        return custom_response("OK", message="Reports retrieved.", data=serializer.data, http_status=status.HTTP_200_OK)


class TeamReportsView(APIView):
    """Supervisor sees all reports for their team(s)."""

    def get(self, request):
        teams = ReportTeam.objects.filter(supervisor=request.user, is_active=True)
        if not teams.exists():
            return custom_response(
                "ERROR", message="You are not a supervisor of any team.",
                data={}, http_status=status.HTTP_403_FORBIDDEN,
            )

        team_id = request.query_params.get('team_id')
        week = request.query_params.get('week')

        reports = PreparednessReport.objects.filter(team__in=teams)
        if team_id:
            reports = reports.filter(team_id=team_id)
        if week:
            reports = reports.filter(week_range=week)

        reports = reports.select_related('member', 'team').order_by('-created_on')

        data = []
        for r in reports:
            report_data = PreparednessReportSerializer(r).data
            report_data['member_name'] = r.member.name if r.member else None
            report_data['member_email'] = r.member.email if r.member else None
            report_data['team_name'] = r.team.name if r.team else None
            report_data['team_code'] = r.team.code if r.team else None
            data.append(report_data)

        all_weeks = (
            PreparednessReport.objects.filter(team__in=teams)
            .values_list('week_range', flat=True)
            .distinct()
            .order_by('-week_range')
        )
        team_info = list(teams.values('id', 'name', 'code'))

        return custom_response(
            "OK", message="Team reports retrieved.",
            data={"reports": data, "weeks": list(all_weeks), "teams": team_info},
            http_status=status.HTTP_200_OK,
        )


# ─── Collaborative Weekly Report System ─────────────────────────────────

class GenerateLinkView(APIView):
    """Supervisor generates a link for the weekly form."""

    def post(self, request):
        from datetime import timedelta

        week_range = request.data.get('week_range', '').strip()
        if not week_range:
            week_range = get_current_week_range()

        try:
            expires_in_hours = int(request.data.get('expires_in_hours', 24))
        except (TypeError, ValueError):
            expires_in_hours = 24
        expires_in_hours = max(1, min(expires_in_hours, 72))

        WeeklyReportLink.objects.filter(week_range=week_range).update(is_active=False)

        link = WeeklyReportLink.objects.create(
            week_range=week_range,
            created_by=request.user,
            expires_at=timezone.now() + timedelta(hours=expires_in_hours),
        )

        report, created = WeeklyReport.objects.get_or_create(
            week_range=week_range, defaults={'link': link},
        )
        if not created and report.link != link:
            report.link = link
            report.save(update_fields=['link'])

        prefill_fields = ['featured_achievement', 'key_figures']
        updated = []
        for field in prefill_fields:
            value = request.data.get(field, '').strip()
            if value:
                old_value = getattr(report, field, '')
                setattr(report, field, value)
                updated.append(field)
                ReportFieldEdit.objects.create(
                    report=report, field_name=field,
                    old_value=old_value, new_value=value,
                    edited_by=request.user.get_full_name() or request.user.email,
                )
        if updated:
            report.save(update_fields=updated)

        return custom_response(
            "OK", message="Link generated successfully.",
            data={
                "token": str(link.token),
                "week_range": week_range,
                "expires_at": link.expires_at.isoformat(),
                "expires_in_hours": expires_in_hours,
            },
            http_status=status.HTTP_201_CREATED,
        )


@method_decorator(never_cache, name='dispatch')
class ValidateLinkView(APIView):
    """Validate a link token and return the report data."""
    permission_classes = [AllowAny]

    def get(self, request, token):
        try:
            link = WeeklyReportLink.objects.get(token=token, is_active=True)
        except WeeklyReportLink.DoesNotExist:
            return custom_response(
                "ERROR", message="Invalid or deactivated link.",
                data={}, http_status=status.HTTP_404_NOT_FOUND,
            )

        if link.is_expired:
            return custom_response(
                "ERROR",
                message="This link has expired. Please request a new link from your supervisor.",
                data={}, http_status=status.HTTP_410_GONE,
            )

        report, _ = WeeklyReport.objects.get_or_create(
            week_range=link.week_range, defaults={'link': link},
        )

        serializer = WeeklyReportSerializer(report)
        return custom_response(
            "OK", message="Link is valid.",
            data={
                "valid": True,
                "week_range": link.week_range,
                "expires_at": link.expires_at.isoformat(),
                "report": serializer.data,
            },
            http_status=status.HTTP_200_OK,
        )


class UpdateFieldView(APIView):
    """Update a single field in the weekly report (auto-save on blur)."""
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
            link = WeeklyReportLink.objects.get(token=token, is_active=True)
        except WeeklyReportLink.DoesNotExist:
            return custom_response(
                "ERROR", message="Invalid or deactivated link.",
                data={}, http_status=status.HTTP_404_NOT_FOUND,
            )

        if link.is_expired:
            return custom_response(
                "ERROR", message="This link has expired.",
                data={}, http_status=status.HTTP_410_GONE,
            )

        allowed_fields = WeeklyReport.EDITABLE_FIELDS + ['featured_achievement_image', 'key_figures_image']
        if field_name not in allowed_fields:
            return custom_response(
                "ERROR", message=f"Invalid field: {field_name}",
                data={}, http_status=status.HTTP_400_BAD_REQUEST,
            )

        report, _ = WeeklyReport.objects.get_or_create(
            week_range=link.week_range, defaults={'link': link},
        )

        old_value = getattr(report, field_name, '')
        if old_value != value:
            ReportFieldEdit.objects.create(
                report=report, field_name=field_name,
                old_value=old_value or '', new_value=value,
                edited_by=edited_by,
            )

        setattr(report, field_name, value)
        report.save(update_fields=[field_name, 'updated_on'])

        return custom_response(
            "OK", message=f"Field '{field_name}' updated.",
            data={"field": field_name, "value": value},
            http_status=status.HTTP_200_OK,
        )


class UploadReportImageView(APIView):
    """Upload an image for a weekly report field (converts to base64 data URL)."""
    permission_classes = [AllowAny]
    ALLOWED_IMAGE_FIELDS = ['featured_achievement_image', 'key_figures_image']

    def post(self, request):
        import base64

        token = request.data.get('token')
        field_name = request.data.get('field_name')
        image = request.FILES.get('image')

        if not token or not field_name:
            return custom_response(
                "ERROR", message="token and field_name are required.",
                data={}, http_status=status.HTTP_400_BAD_REQUEST,
            )

        if field_name not in self.ALLOWED_IMAGE_FIELDS:
            return custom_response(
                "ERROR",
                message=f"Invalid image field: {field_name}. Allowed: {', '.join(self.ALLOWED_IMAGE_FIELDS)}",
                data={}, http_status=status.HTTP_400_BAD_REQUEST,
            )

        if not image:
            return custom_response(
                "ERROR", message="No image file provided.",
                data={}, http_status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            link = WeeklyReportLink.objects.get(token=token, is_active=True)
        except WeeklyReportLink.DoesNotExist:
            return custom_response(
                "ERROR", message="Invalid or deactivated link.",
                data={}, http_status=status.HTTP_404_NOT_FOUND,
            )

        if link.is_expired:
            return custom_response(
                "ERROR", message="This link has expired.",
                data={}, http_status=status.HTTP_410_GONE,
            )

        report, _ = WeeklyReport.objects.get_or_create(
            week_range=link.week_range, defaults={'link': link},
        )

        image_data = image.read()
        content_type = image.content_type or 'image/png'
        b64_string = base64.b64encode(image_data).decode('utf-8')
        data_url = f"data:{content_type};base64,{b64_string}"

        setattr(report, field_name, data_url)
        report.save(update_fields=[field_name, 'updated_on'])

        return custom_response(
            "OK", message=f"Image uploaded for '{field_name}'.",
            data={"field": field_name, "image_data": data_url},
            http_status=status.HTTP_200_OK,
        )


class GetWeeklyReportView(APIView):
    """Get the full current state of the weekly report."""
    permission_classes = [AllowAny]

    def get(self, request, token):
        try:
            link = WeeklyReportLink.objects.get(token=token, is_active=True)
        except WeeklyReportLink.DoesNotExist:
            return custom_response(
                "ERROR", message="Invalid link.",
                data={}, http_status=status.HTTP_404_NOT_FOUND,
            )

        if link.is_expired:
            return custom_response(
                "ERROR", message="This link has expired.",
                data={}, http_status=status.HTTP_410_GONE,
            )

        try:
            report = WeeklyReport.objects.get(week_range=link.week_range)
        except WeeklyReport.DoesNotExist:
            return custom_response(
                "ERROR", message="Report not found.",
                data={}, http_status=status.HTTP_404_NOT_FOUND,
            )

        serializer = WeeklyReportSerializer(report)
        return custom_response(
            "OK", message="Report retrieved.",
            data=serializer.data, http_status=status.HTTP_200_OK,
        )


class WeeklyReportDetailAdminView(APIView):
    """Get the full report by ID (for admin/supervisor PDF generation)."""
    permission_classes = [IsAuthenticated, IsNotSupplierRole]

    def get(self, request, pk):
        try:
            report = WeeklyReport.objects.get(pk=pk)
        except WeeklyReport.DoesNotExist:
            return custom_response(
                "ERROR", message="Report not found.",
                data={}, http_status=status.HTTP_404_NOT_FOUND,
            )

        serializer = WeeklyReportSerializer(report)
        return custom_response(
            "OK", message="Report retrieved.",
            data=serializer.data, http_status=status.HTTP_200_OK,
        )


class WeeklyReportsListView(APIView):
    """Supervisor views all weekly reports."""

    def get(self, request):
        reports = (
            WeeklyReport.objects
            .select_related('link')
            .prefetch_related('edits')
            .defer('featured_achievement_image', 'key_figures_image')
            .order_by('-created_on')
        )

        data = []
        for report in reports:
            serialized = WeeklyReportListSerializer(report).data

            filled = sum(
                1 for f in WeeklyReport.EDITABLE_FIELDS
                if getattr(report, f, '').strip()
            )
            total = len(WeeklyReport.EDITABLE_FIELDS)

            all_edits = sorted(report.edits.all(), key=lambda e: e.edited_at, reverse=True)[:10]

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
                    {'field': e.field_name, 'by': e.edited_by, 'at': e.edited_at.strftime('%Y-%m-%d %H:%M')}
                    for e in all_edits
                ],
                'link_info': link_info,
            })

        return custom_response(
            "OK", message="Weekly reports retrieved.",
            data=data, http_status=status.HTTP_200_OK,
        )


class DeleteWeeklyReportView(APIView):
    """Hard-delete a weekly report."""

    def delete(self, request, pk):
        try:
            report = WeeklyReport.objects.get(pk=pk)
        except WeeklyReport.DoesNotExist:
            return custom_response(
                "ERROR", message="Report not found.",
                data={}, http_status=status.HTTP_404_NOT_FOUND,
            )

        report.delete()
        return custom_response(
            "OK", message="Report deleted successfully.",
            data={"id": pk}, http_status=status.HTTP_200_OK,
        )


class LatestWeeklyReportView(APIView):
    """Public endpoint to get the latest weekly report for the dashboard ticker."""
    permission_classes = [IsAuthenticated, IsNotSupplierRole]

    def get(self, request):
        report = WeeklyReport.objects.order_by('-created_on').first()
        if not report:
            return custom_response(
                "ERROR", message="No reports found.",
                data={}, http_status=status.HTTP_404_NOT_FOUND,
            )

        serializer = WeeklyReportSerializer(report)
        return custom_response(
            "OK", message="Latest weekly report retrieved.",
            data=serializer.data, http_status=status.HTTP_200_OK,
        )


class ReactivateLinkView(APIView):
    """Extend the expiry of a weekly report link and reactivate it."""

    def post(self, request, pk):
        from datetime import timedelta

        try:
            expires_in_hours = int(request.data.get('expires_in_hours', 24))
        except (TypeError, ValueError):
            expires_in_hours = 24
        expires_in_hours = max(1, min(expires_in_hours, 168))

        try:
            report = WeeklyReport.objects.get(pk=pk)
        except WeeklyReport.DoesNotExist:
            return custom_response(
                "ERROR", message="Report not found.",
                data={}, http_status=status.HTTP_404_NOT_FOUND,
            )

        if not report.link:
            link = WeeklyReportLink.objects.create(
                week_range=report.week_range,
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

        WeeklyReportLink.objects.filter(
            week_range=report.week_range,
        ).exclude(pk=link.pk).update(is_active=False)

        return custom_response(
            "OK", message=f"Link reactivated successfully for {expires_in_hours} hours.",
            data={
                "token": str(link.token),
                "expires_at": link.expires_at.isoformat(),
                "expires_in_hours": expires_in_hours,
            },
            http_status=status.HTTP_200_OK,
        )
