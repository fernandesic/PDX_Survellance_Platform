"""
Department Form — Views (thin HTTP layer)

Each view parses the request, calls a service function, and returns a Response.
All business logic lives in services.py. All email logic lives in emails.py.
"""

import logging

from rest_framework import status, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.utils import timezone

from utils.permissions import IsAdminOrSuperAdmin, IsDepartmentOrAdmin
from .models import DepartmentForm, FormLink
from .serializers import DepartmentFormSerializer, FormLinkSerializer
from . import services

logger = logging.getLogger(__name__)


class WorkflowConfigView(APIView):
    """Expose workflow email configurations from settings.py."""
    permission_classes = [AllowAny]

    def get(self, request):
        return Response(services.get_workflow_config(), status=status.HTTP_200_OK)


class DepartmentFormListView(generics.ListAPIView):
    """List all department forms for the Admin Dashboard."""
    permission_classes = [IsAuthenticated, IsDepartmentOrAdmin]
    queryset = DepartmentForm.objects.all().order_by('-created_at')
    serializer_class = DepartmentFormSerializer


class GenerateDepartmentLinkView(APIView):
    """Generate a new link for a department form."""
    permission_classes = [IsAuthenticated, IsDepartmentOrAdmin]

    def post(self, request):
        try:
            email = request.data.get('email')
            form = services.create_department_form(email=email, data=request.data)
            return Response(DepartmentFormSerializer(form).data, status=status.HTTP_201_CREATED)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:  # noqa: BLE001 — top-level view: any failure must return a structured 500
            logger.error("Department form generation failed", exc_info=True)
            return Response(
                {"error": "An internal error occurred. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class ReactivateDepartmentLinkView(APIView):
    """Reactivate or extend a link's expiry."""
    permission_classes = [IsAuthenticated, IsDepartmentOrAdmin]

    def post(self, request, pk):
        try:
            services.reactivate_link(form_pk=pk)
            return Response({"message": "Link reactivated successfully"}, status=status.HTTP_200_OK)
        except DepartmentForm.DoesNotExist:
            return Response({"error": "Form not found"}, status=status.HTTP_404_NOT_FOUND)


class ValidateDepartmentTokenView(APIView):
    """Validate a token for the public form."""
    permission_classes = [AllowAny]

    def get(self, request, token):
        try:
            link = FormLink.objects.get(token=token, is_active=True)
            if link.expires_at and timezone.now() > link.expires_at:
                return Response({"error": "Link has expired"}, status=status.HTTP_410_GONE)
            return Response(DepartmentFormSerializer(link.form).data, status=status.HTTP_200_OK)
        except FormLink.DoesNotExist:
            return Response(
                {"error": "Invalid or consumed link. The form may have been submitted or moved to the next stage."},
                status=status.HTTP_404_NOT_FOUND,
            )


class SubmitSectionView(APIView):
    """Submit a section and advance the workflow."""
    permission_classes = [AllowAny]

    def post(self, request, token):
        try:
            form = services.submit_section(
                token=token,
                section_data=request.data.get('section_data'),
                signature=request.data.get('signature') or "",
                next_email=request.data.get('next_email'),
                particulars=request.data.get('particulars'),
            )
            return Response(DepartmentFormSerializer(form).data, status=status.HTTP_200_OK)
        except FormLink.DoesNotExist:
            return Response({"error": "Invalid token"}, status=status.HTTP_404_NOT_FOUND)
        except RuntimeError:
            # Form was saved but email failed — return form data with warning
            form = FormLink.objects.get(token__isnull=False).form  # already saved
            return Response({
                "error": "Form saved but email notification failed. Please contact support.",
                "form_data": DepartmentFormSerializer(form).data,
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception:  # noqa: BLE001 — top-level view: any failure must return a structured 500
            logger.error("Submit error for department form", exc_info=True)
            return Response(
                {"error": "An internal error occurred. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class ReverseSectionView(APIView):
    """Send the form back to the previous section."""
    permission_classes = [AllowAny]

    def post(self, request, token):
        try:
            form = services.reverse_section(
                token=token,
                next_email=request.data.get('next_email'),
                note=request.data.get('note', ''),
            )
            return Response(DepartmentFormSerializer(form).data, status=status.HTTP_200_OK)
        except FormLink.DoesNotExist:
            return Response({"error": "Invalid token"}, status=status.HTTP_404_NOT_FOUND)


class DeleteDepartmentFormView(APIView):
    """Delete a department form and its associated link."""
    permission_classes = [IsAuthenticated, IsDepartmentOrAdmin]

    def delete(self, request, pk):
        try:
            services.delete_department_form(form_pk=pk)
            return Response({"message": "Form deleted successfully"}, status=status.HTTP_200_OK)
        except DepartmentForm.DoesNotExist:
            return Response({"error": "Form not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception:  # noqa: BLE001 — top-level view: any failure must return a structured 500
            logger.error("Delete error for department form pk=%s", pk, exc_info=True)
            return Response(
                {"error": "An internal error occurred during deletion."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
