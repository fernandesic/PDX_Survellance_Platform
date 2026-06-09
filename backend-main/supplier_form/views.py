"""
Supplier Form — Views (thin HTTP layer)

Each view:
  1. Parses the request
  2. Calls a service function
  3. Returns a Response

All business logic lives in services.py. All email logic lives in emails.py.
"""

import logging

from rest_framework import status, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated

from utils.permissions import IsAdminOrSuperAdmin, IsSupplierOrAdmin
from .models import SupplierForm, FormLink
from .serializers import SupplierFormSerializer, FormLinkSerializer
from . import services

logger = logging.getLogger(__name__)


class WorkflowConfigView(APIView):
    """Expose workflow email configurations from settings.py."""
    permission_classes = [AllowAny]

    def get(self, request):
        reviewers = services._get_workflow_reviewers()
        return Response({
            "dropdown_emails": reviewers["section_a"],
            "section_b_reviewers": reviewers["section_b"],
            "section_c_emails": reviewers["section_c"],
            "section_d_emails": reviewers["section_d"],
        }, status=status.HTTP_200_OK)


class SupplierFormListView(generics.ListAPIView):
    """List all supplier forms for the Admin Dashboard."""
    permission_classes = [IsAuthenticated, IsSupplierOrAdmin]
    queryset = SupplierForm.objects.all().order_by('-created_at')
    serializer_class = SupplierFormSerializer


class GenerateSupplierLinkView(APIView):
    """Generate a new link for a supplier form."""
    permission_classes = [IsAuthenticated, IsSupplierOrAdmin]

    def post(self, request):
        try:
            email = request.data.get('email')
            form = services.create_supplier_form(email=email, data=request.data)
            return Response(SupplierFormSerializer(form).data, status=status.HTTP_201_CREATED)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:  # noqa: BLE001 — top-level view: any failure must return a structured 500
            logger.error("Form generation failed", exc_info=True)
            return Response(
                {"error": "An internal error occurred. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class ReactivateSupplierLinkView(APIView):
    """Reactivate or extend a link's expiry."""
    permission_classes = [IsAuthenticated, IsSupplierOrAdmin]

    def post(self, request, pk):
        try:
            result = services.reactivate_link(form_pk=pk)
            return Response({
                "message": "Link reactivated successfully",
                "token": result["token"],
                "url": result["url"],
            }, status=status.HTTP_200_OK)
        except SupplierForm.DoesNotExist:
            return Response({"error": "Form not found"}, status=status.HTTP_404_NOT_FOUND)


class ValidateSupplierTokenView(APIView):
    """Validate a token for the public form."""
    permission_classes = [AllowAny]

    def get(self, request, token):
        try:
            link = FormLink.objects.get(token=token, is_active=True)
            return Response(SupplierFormSerializer(link.form).data, status=status.HTTP_200_OK)
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
            return Response(SupplierFormSerializer(form).data, status=status.HTTP_200_OK)
        except FormLink.DoesNotExist:
            return Response({"error": "Invalid token"}, status=status.HTTP_404_NOT_FOUND)
        except Exception:  # noqa: BLE001 — top-level view: any failure must return a structured 500
            logger.error("Submit error for form", exc_info=True)
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
            return Response(SupplierFormSerializer(form).data, status=status.HTTP_200_OK)
        except FormLink.DoesNotExist:
            return Response({"error": "Invalid token"}, status=status.HTTP_404_NOT_FOUND)


class DeleteSupplierFormView(APIView):
    """Delete a supplier form and its associated link."""
    permission_classes = [IsAuthenticated, IsSupplierOrAdmin]

    def delete(self, request, pk):
        try:
            services.delete_supplier_form(form_pk=pk)
            return Response({"message": "Form deleted successfully"}, status=status.HTTP_200_OK)
        except SupplierForm.DoesNotExist:
            return Response({"error": "Form not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception:  # noqa: BLE001 — top-level view: any failure must return a structured 500
            logger.error("Delete error for form pk=%s", pk, exc_info=True)
            return Response(
                {"error": "An internal error occurred during deletion."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )