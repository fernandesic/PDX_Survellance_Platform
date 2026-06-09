from rest_framework import serializers
from .models import StarData

class StardataSerializer(serializers.ModelSerializer):
    class Meta:
        model = StarData
        fields = [
            'id', 'key_on_table', 'n', 'country', 'level', 'year',
            'start_date', 'end_date', 'subgroup_of_hazards',
            'main_type_of_hazard', 'hazard', 'health_consequences',
            'scale', 'geographical_area', 'exposure', 'frequency',
            'seasonality', 'jan', 'feb', 'mar', 'apr', 'may', 'jun',
            'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
            'likelihood', 'severity', 'vulnerability',
            'vulnerability_details', 'coping_capacity',
            'coping_capacity_details', 'governance_and_resouces',
            'health_sector_capacity', 'non_health_sector_capcity',
            'commuty_capacity', 'resources', 'impact',
            'confidence_level', 'risk_level', 'risk_level_number', 'status',
        ]
        

class StarDataNewsSerializer(serializers.ModelSerializer):
    key = serializers.CharField(source='country')
    value_1 = serializers.CharField(source='year')
    value_2 = serializers.CharField(source='scale')
    class Meta:
        model = StarData
        fields =['key', 'value_1', 'value_2']