"""
SITREP Form — URL Configuration
All endpoints under /api/v1/sitrep/
"""
from django.urls import path
from .views import (
    GenerateSitrepLinkView,
    ValidateSitrepLinkView,
    UpdateSitrepFieldView,
    SitrepReportsListView,
    SitrepReportDetailView,
    DeleteSitrepReportView,
    ReactivateSitrepLinkView,
    ChecklistConfigView,
    UploadHighlightImageView,
)

urlpatterns = [
    path('generate-link', GenerateSitrepLinkView.as_view(), name='sitrep-generate-link'),
    path('validate-link/<str:token>', ValidateSitrepLinkView.as_view(), name='sitrep-validate-link'),
    path('update-field', UpdateSitrepFieldView.as_view(), name='sitrep-update-field'),
    path('upload-highlight', UploadHighlightImageView.as_view(), name='sitrep-upload-highlight'),
    path('reports-list', SitrepReportsListView.as_view(), name='sitrep-reports-list'),
    path('report-detail/<int:pk>', SitrepReportDetailView.as_view(), name='sitrep-report-detail'),
    path('report-delete/<int:pk>', DeleteSitrepReportView.as_view(), name='sitrep-report-delete'),
    path('reactivate-link/<int:pk>', ReactivateSitrepLinkView.as_view(), name='sitrep-reactivate-link'),
    path('checklist-config', ChecklistConfigView.as_view(), name='sitrep-checklist-config'),
]
