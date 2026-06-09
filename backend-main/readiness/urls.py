"""
URL configuration for drivequick project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.urls import path
from .views import (
    # Upload views
    ArboVirusUploadView, CholeraUploadView, CholeraSubNationalUploadView,
    CycloneUploadView, FVDUploadView, FVDPoEUploadView,
    LassaFeverUploadView, LassaFeverDistrictUploadView, MarburgUploadView,
    MeningitisUploadView, MeningitiseEliminationUploadView,
    MpoxUploadView, MpoxDistrictUploadView,
    NaturalDisasterUploadView, RiftValleyFeverUploadView,
    # Summary views
    ArboVirusSummaryView, CholeraSummaryView, CholeraSubNationalSummaryView,
    CycloneSummaryView, FVDSummaryView, FVDPoESummaryView,
    LassaFeverSummaryView, LassaFeverDistrictSummaryView, MarburgSummaryView,
    MeningitisSummaryView, MeningitiseEliminationSummaryView,
    MpoxSummaryView, MpoxDistrictSummaryView,
    NaturalDisasterSummaryView, RiftValleyFeverSummaryView,
    # Analytics views
    RegionalHeatmapAPIView, HazardMonitorAPIView, ReadinessCategoryAverageAPIView,
    # Report views
    PreparednessReportView, TeamLookupView, MemberReportsView, TeamReportsView,
    GenerateLinkView, ValidateLinkView, UpdateFieldView, UploadReportImageView,
    GetWeeklyReportView, WeeklyReportsListView, WeeklyReportDetailAdminView,
    DeleteWeeklyReportView, ReactivateLinkView,
)

urlpatterns = [
    path('load/arbovirus', ArboVirusUploadView.as_view()),
    path('load/cholera', CholeraUploadView.as_view()),
    path('load/cholera/sub_national', CholeraSubNationalUploadView.as_view()),
    path('load/cyclone', CycloneUploadView.as_view()),
    path('load/fvd', FVDUploadView.as_view()),
    path('load/fvd/poe', FVDPoEUploadView.as_view()),
    path('load/lassa', LassaFeverUploadView.as_view()),
    path('load/lassa/district', LassaFeverDistrictUploadView.as_view()),
    path('load/marbug', MarburgUploadView.as_view()),
    path('load/meningitis', MeningitisUploadView.as_view()),
    path('load/meningitis/elimination', MeningitiseEliminationUploadView.as_view()),
    path('load/mpox', MpoxUploadView.as_view()),
    path('load/mpox/district', MpoxDistrictUploadView.as_view()),
    path('load/natural_disaster', NaturalDisasterUploadView.as_view()),
    path('load/riftvalley_fever', RiftValleyFeverUploadView.as_view()),
    
    
    path('summary/arbovirus', ArboVirusSummaryView.as_view()),
    path('summary/cholera', CholeraSummaryView.as_view()),
    path('summary/cholerasubnational', CholeraSubNationalSummaryView.as_view()),
    path('summary/cyclone', CycloneSummaryView.as_view()),
    path('summary/fvd', FVDSummaryView.as_view()),
    path('summary/fvdpoe', FVDPoESummaryView.as_view()),
    path('summary/lassafever', LassaFeverSummaryView.as_view()),
    path('summary/lassafeverdistrict', LassaFeverDistrictSummaryView.as_view()),
    path('summary/marburg', MarburgSummaryView.as_view()),
    path('summary/meningitis', MeningitisSummaryView.as_view()),
    path('summary/meningitiseelimination', MeningitiseEliminationSummaryView.as_view()),
    path('summary/mpox', MpoxSummaryView.as_view()),
    path('summary/mpoxdistrict', MpoxDistrictSummaryView.as_view()),
    path('summary/naturaldisaster', NaturalDisasterSummaryView.as_view()),
    path('summary/riftvalleyfever', RiftValleyFeverSummaryView.as_view()),
    
    
    path('heatmap', RegionalHeatmapAPIView.as_view()),
    path('hazard-monitor', HazardMonitorAPIView.as_view()),
    path('category-averages', ReadinessCategoryAverageAPIView.as_view()),
    
    path('preparedness-report', PreparednessReportView.as_view()),
    path('team-lookup', TeamLookupView.as_view()),
    path('my-reports', MemberReportsView.as_view()),
    path('team-reports', TeamReportsView.as_view()),

    # ── New: Collaborative Weekly Report System ──
    path('generate-link', GenerateLinkView.as_view()),
    path('validate-link/<str:token>', ValidateLinkView.as_view()),
    path('update-field', UpdateFieldView.as_view()),
    path('upload-report-image', UploadReportImageView.as_view()),
    path('weekly-report/<str:token>', GetWeeklyReportView.as_view()),
    path('weekly-reports-list', WeeklyReportsListView.as_view()),
    path('weekly-report-detail/<int:pk>', WeeklyReportDetailAdminView.as_view(), name='weekly-report-detail'),
    path('weekly-report-delete/<int:pk>', DeleteWeeklyReportView.as_view(), name='weekly-report-delete'),
    path('reactivate-link/<int:pk>', ReactivateLinkView.as_view(), name='reactivate-link'),
]
