from django.shortcuts import render
from rest_framework import generics
from rest_framework import permissions
from rest_framework.views import APIView

from .models import IhmrefCategory, IhmrefData, IhmrefDataSummary, IhmrefCountry, CountryIncident
from .serializer import (
    IhmrefCategorySerialiser, IhmrefDataSerialiser,
    IhmrefDataSummarySerialiser, IhmrefCountrySerializer,
    CountryIncidentSerializer,
)
from utils.index import custom_response

class CategoryListAPIView(APIView):
    serializer_class=IhmrefCategorySerialiser
    queryset=IhmrefCategory.objects.all()
    def get(self, request, *args, **kwargs):
        category = IhmrefCategory.objects.all().values_list("category", flat=True)
        return custom_response(
            status="OK",
            message="Retrieved",
            data={
                "category": category
            }
        )
    
    
class CategorySummaryView(generics.RetrieveAPIView):
    serializer_class=IhmrefDataSummarySerialiser
    def get_object(self):
        category = self.kwargs.get("category")
        self.category = IhmrefCategory.objects.get(category=category)
        return IhmrefDataSummary.objects.get(category=self.category)
    
    def get(self, request, *args, **kwargs):
        response = super().get(request, *args, **kwargs)
        years = IhmrefData.objects.filter(category=self.category).values_list("year", flat=True)
        return custom_response(
            status="Ok",
            message="Retrieved",
            data={
                "data": response.data,
                "years": years
            }
        )
        
class SummaryListAPIView(generics.ListAPIView):
    serializer_class = IhmrefDataSummarySerialiser
    queryset = IhmrefDataSummary.objects.all()
    
    
class CategoryDataAPIView(generics.ListAPIView):
    serializer_class=IhmrefDataSerialiser
    def get_queryset(self):
        category = self.kwargs.get("category")
        category = IhmrefCategory.objects.get(category=category)
        queryset=IhmrefData.objects.filter(category=category)
        year = self.request.query_params.get("year")
        if year:
            queryset=queryset.filter(year=year)
        return queryset
    
class IhmrefCountriesAPIView(APIView):
    def get(self, request, *args, **kwargs):
        return custom_response(
            status="OK",
            message="",
            data={
                "countries": IhmrefCountry.objects.all().values_list("country", flat=True)
            }
        )
        
class CountryIncidentView(generics.ListAPIView):
    serializer_class=CountryIncidentSerializer
    def get_queryset(self):
        queryset = CountryIncident.objects.all()
        country = self.request.query_params.get("country")
        if country:
            queryset = queryset.filter(country__country=country)
        return queryset