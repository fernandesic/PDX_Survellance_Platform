from rest_framework import serializers
from .models import IhmrefDataSummary, IhmrefData, IhmrefCategory, IhmrefCountry, CountryIncident

class IhmrefDataSummarySerialiser(serializers.ModelSerializer):
    category = serializers.CharField(source="category.category")
    class Meta:
        model = IhmrefDataSummary
        fields = ['id', 'category', 'afro', 'global_t', 'contribution']
        
        
class IhmrefDataSerialiser(serializers.ModelSerializer):
    category = serializers.CharField(source="category.category")
    class Meta:
        model = IhmrefData
        fields = [
            'id', 'category', 'year', 'afro', 'global_t', 'contribution',
            'no_of_african_countries', 'african_countries_involved',
        ]
        
class IhmrefCategorySerialiser(serializers.ModelSerializer):
    
    class Meta:
        model = IhmrefCategory
        fields = ['id', 'category']

class IhmrefCountrySerializer(serializers.ModelSerializer):
    class Meta:
        model = IhmrefCountry
        fields = ['id', 'country', 'full_name', 'state']

class CountryIncidentSerializer(serializers.ModelSerializer):
    ihmref_data = IhmrefDataSerialiser()
    country = IhmrefCountrySerializer()
    class Meta:
        model = CountryIncident
        fields = ['id', 'country', 'ihmref_data', 'incident', 'start_date', 'end_date']