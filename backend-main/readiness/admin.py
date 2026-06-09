from django.contrib import admin
from .models import (
    ArboVirus, Cholera, CholeraSubNational, Cyclone, FVD, FVDPoE,
    LassaFever, LassaFeverDistrict, Marburg, Meningitis,
    MeningitiseElimination, Mpox, MpoxDistrict, NaturalDisaster,
    RiftValleyFever, ReportTeam, ReportMember, PreparednessReport,
    WeeklyReportLink, WeeklyReport, ReportFieldEdit,
)

admin.site.register(ArboVirus)
admin.site.register(Cholera)
admin.site.register(CholeraSubNational)
admin.site.register(Cyclone)
admin.site.register(FVD)
admin.site.register(FVDPoE)
admin.site.register(LassaFever)
admin.site.register(LassaFeverDistrict)
admin.site.register(Marburg)
admin.site.register(Meningitis)
admin.site.register(MeningitiseElimination)
admin.site.register(Mpox)
admin.site.register(MpoxDistrict)
admin.site.register(NaturalDisaster)
admin.site.register(RiftValleyFever)
admin.site.register(ReportTeam)
admin.site.register(ReportMember)
admin.site.register(PreparednessReport)
admin.site.register(WeeklyReportLink)
admin.site.register(WeeklyReport)
admin.site.register(ReportFieldEdit)