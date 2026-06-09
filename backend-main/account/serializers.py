from rest_framework import serializers
from chwfolder.models import Country
from .models import Alert

class FileUploadSerializer(serializers.Serializer):
    file = serializers.FileField()
    
class ChartCountrySerializer(serializers.ModelSerializer):
    year = serializers.IntegerField(source='data_year')
    population = serializers.IntegerField(source='population_2024')
    chw = serializers.IntegerField(source='total_chws')
    class Meta:
        model=Country
        fields=['year', 'country', 'chw', 'population']
        
class AlertSerializer(serializers.ModelSerializer):
    class Meta:
        model = Alert
        fields = [
            'id', 'title', 'description', 'category', 'status',
            'severity', 'country', 'region', 'date',
            'acknowledge_by', 'last_updated_date',
        ]
        
    def to_representation(self, instance):
        repr = super().to_representation(instance)
        repr['severity'] = instance.get_severity_display()
        repr['category'] = instance.get_category_display()
        return repr