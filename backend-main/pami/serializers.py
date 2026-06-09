from rest_framework import serializers
from .models import PamiData

class PamiDataSerializer(serializers.ModelSerializer):
    class Meta:
        model = PamiData
        fields = [
            'id', 'country', 'province', 'district',
            'priority_index', 'risk_level', 'additional_data',
        ]
