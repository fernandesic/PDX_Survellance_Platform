from django.contrib import admin
from .models import OutbreakPrediction, PredictionModel


@admin.register(PredictionModel)
class PredictionModelAdmin(admin.ModelAdmin):
    list_display = ['name', 'model_type', 'weight', 'is_active', 'last_run']
    list_filter = ['model_type', 'is_active']


@admin.register(OutbreakPrediction)
class OutbreakPredictionAdmin(admin.ModelAdmin):
    list_display = [
        'country_name', 'disease_name', 'composite_risk_score',
        'risk_level', 'confidence', 'prediction_date',
    ]
    list_filter = ['risk_level', 'disease_name']
    search_fields = ['country_name', 'country_iso']
    ordering = ['-composite_risk_score']
