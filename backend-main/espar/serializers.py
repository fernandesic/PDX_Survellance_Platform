from rest_framework import serializers
from .models import Espar, Indicator

class IndicatorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Indicator
        fields = ['id', 'espar', 'code', 'value']
        
class EsparSerializer(serializers.ModelSerializer):
    indicators = IndicatorSerializer(many=True)
    class Meta:
        model = Espar
        fields = [
            'id', 'sheet', 'key_on_table', 'data_received',
            'region', 'states', 'iso_code', 'total_average',
            'indicators',
        ]
        
class EsparNewsSerializer(serializers.ModelSerializer):
    key = serializers.CharField(source='states')
    value_1 = serializers.CharField(source='iso_code')
    value_2 = serializers.CharField(source='total_average')
    class Meta:
        model = Espar
        fields = ['key', 'value_1', 'value_2']