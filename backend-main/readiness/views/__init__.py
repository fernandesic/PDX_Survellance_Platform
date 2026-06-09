"""
readiness.views — split into focused modules.

This __init__.py re-exports every view class so that existing imports like
``from readiness.views import ArboVirusSummaryView`` continue to work.
"""
# Upload views (generic, 14 disease-specific subclasses)
from .upload import (  # noqa: F401
    snake_case,
    extract_base_data,
    process_csv_upload,
    BaseUploadView,
    ArboVirusUploadView,
    CholeraUploadView,
    CholeraSubNationalUploadView,
    CycloneUploadView,
    FVDUploadView,
    FVDPoEUploadView,
    LassaFeverUploadView,
    LassaFeverDistrictUploadView,
    MarburgUploadView,
    MeningitisUploadView,
    MeningitiseEliminationUploadView,
    MpoxUploadView,
    MpoxDistrictUploadView,
    NaturalDisasterUploadView,
    RiftValleyFeverUploadView,
)

# Summary views (generic, 14 disease-specific subclasses)
from .summary import (  # noqa: F401
    BaseSummaryView,
    ArboVirusSummaryView,
    CholeraSummaryView,
    CholeraSubNationalSummaryView,
    CycloneSummaryView,
    FVDSummaryView,
    FVDPoESummaryView,
    LassaFeverSummaryView,
    LassaFeverDistrictSummaryView,
    MarburgSummaryView,
    MeningitisSummaryView,
    MeningitiseEliminationSummaryView,
    MpoxSummaryView,
    MpoxDistrictSummaryView,
    NaturalDisasterSummaryView,
    RiftValleyFeverSummaryView,
)

# Analytics views (heatmap, hazard monitor, category averages)
from .analytics import (  # noqa: F401
    RegionalHeatmapAPIView,
    HazardMonitorAPIView,
    ReadinessCategoryAverageAPIView,
)

# Report views (preparedness reports + weekly collaborative system)
from .reports import (  # noqa: F401
    PreparednessReportView,
    get_current_week_range,
    TeamLookupView,
    MemberReportsView,
    TeamReportsView,
    GenerateLinkView,
    ValidateLinkView,
    UpdateFieldView,
    UploadReportImageView,
    GetWeeklyReportView,
    WeeklyReportDetailAdminView,
    WeeklyReportsListView,
    DeleteWeeklyReportView,
    LatestWeeklyReportView,
    ReactivateLinkView,
)
