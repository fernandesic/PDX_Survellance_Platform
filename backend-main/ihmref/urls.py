from django.urls import path
from .views import (
    CategoryListAPIView, CategorySummaryView, SummaryListAPIView,
    CategoryDataAPIView, IhmrefCountriesAPIView, CountryIncidentView,
)

urlpatterns = [
    path('categories', CategoryListAPIView.as_view()),
    path('category/<str:category>/summary', CategorySummaryView.as_view()),
    path("summary", SummaryListAPIView.as_view()),
    path('category/<str:category>/data', CategoryDataAPIView.as_view()),
    path('countries', IhmrefCountriesAPIView.as_view()),
    path('country/incident', CountryIncidentView.as_view()),
]