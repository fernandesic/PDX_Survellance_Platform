from django.contrib import admin
from .models import IhmrefCategory, IhmrefData, IhmrefDataSummary

admin.site.register(IhmrefCategory)
admin.site.register(IhmrefData)
admin.site.register(IhmrefDataSummary)
