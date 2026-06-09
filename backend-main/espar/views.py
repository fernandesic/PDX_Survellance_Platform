import json
import logging
from typing import Dict, List, TypedDict

from django.db import DatabaseError
from django.db.models import Max
from rest_framework.views import APIView
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from utils.permissions import IsNotSupplierRole
from rest_framework import generics
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models.functions import Trim

from account.serializers import FileUploadSerializer
from utils.index import custom_response
from utils.pagination import LargeResultsSetPagination
from utils.filters import EsparFilter
from utils.constants import CAPACITIES, AFRO_COUNTRIES
from utils.tenant_resolver import resolve_tenant
from .models import Espar, Indicator, Sheet

from .serializers import EsparSerializer

import pandas as pd
from statistics import mean

logger = logging.getLogger(__name__)



class ExcelUploadView(APIView):
    """
    Upload e-SPAR Excel file and directly insert data into database.
    No file is saved to storage - data is processed inline.
    """
    def post(self, request, *args, **kwargs):
        from utils.index import gen_unique_key, parse_number, is_year
        
        serializer = FileUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        file = serializer.validated_data['file']
        
        try:
            # Process file directly from memory - no file storage
            xls = pd.ExcelFile(file)
            records_created = 0
            indicators_created = 0
            
            for sheet_name in xls.sheet_names:
                if not is_year(sheet_name):
                    continue
                
                # Load with header detection
                df = pd.read_excel(xls, sheet_name, skiprows=13)
                df = df.dropna(how="all")
                sheet_obj, _ = Sheet.objects.get_or_create(name=sheet_name.strip())
                
                for idx, row in df.iterrows():
                    row = row.where(pd.notna(row), None)
                    unique_key = gen_unique_key(sheet_name, idx)
                    
                    iso = row.get("ISO Code")
                    state_name = str(row.get("States Party of IHR")).strip() if row.get("States Party of IHR") else None
                    espar, _ = Espar.objects.update_or_create(
                        sheet=sheet_obj,
                        key_on_table=unique_key,
                        defaults={
                            "data_received": str(row.get("Data Received")).strip() if row.get("Data Received") else None,
                            "region": str(row.get("Region")).strip() if row.get("Region") else None,
                            "states": state_name,
                            "iso_code": iso,
                            "total_average": parse_number(row.get("Total Average")),
                            "tenant": resolve_tenant(iso=iso, name=state_name),
                        }
                    )
                    records_created += 1
                    
                    # Process indicators
                    for col in CAPACITIES.keys():
                        value = row.get(col)
                        if value is None:
                            continue
                        Indicator.objects.update_or_create(
                            espar=espar,
                            code=col,
                            defaults={"value": parse_number(value)}
                        )
                        indicators_created += 1
            
            return custom_response(
                status="OK",
                message=f"Data imported successfully. {records_created} records and {indicators_created} indicators created.",
                data={
                    "records_created": records_created,
                    "indicators_created": indicators_created
                },
                http_status=status.HTTP_200_OK
            )
        except Exception as e:  # noqa: BLE001 — top-level import view: any failure must return a structured 400 response
            return custom_response(
                status="ERROR",
                message=f"Failed to import data: {str(e)}",
                data={},
                http_status=status.HTTP_400_BAD_REQUEST
            )


class EsparListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsNotSupplierRole]
    serializer_class=EsparSerializer
    queryset=Espar.objects.all()
    pagination_class=LargeResultsSetPagination
    filterset_class = EsparFilter
    filter_backends = [DjangoFilterBackend]
    


def overall_average(indicators):
    if not indicators:
        return 0
    scores = [ind.scaled_score() for ind in indicators]
    return round(mean(scores) * 20, 2)
    
def capacity_averages(indicators, named: bool=False):
    """
    Returns a dict with percentage values (0-100):
    {
        "C.1": 70.0,
        "C.2": 40.0,
        ...
        "C.15": 80.0
    }
    """
    from collections import defaultdict
    groups = defaultdict(list)

    for ind in indicators:
        capacity = ind.code.split(".")[0] + "." + ind.code.split(".")[1]
        groups[capacity].append(ind.scaled_score())

    if named:
        return {CAPACITIES[cap]: round((sum(vals)/len(vals)) * 20, 2) for cap, vals in groups.items()}
    return {cap: round((sum(vals)/len(vals)) * 20, 2) for cap, vals in groups.items()}


def read_hq_data_from_db(year):
    """
    Read data from database for all AFRO countries
    Returns capacity summary and overall average
    """
    from django.db.models import Avg
    
    # Query database for AFRO countries
    filtered_espars = Espar.objects.filter(
        states__in=AFRO_COUNTRIES,
        sheet__name=str(year)
    )
    
    if not filtered_espars.exists():
        return None, None
    
    capacities = Indicator.objects.filter(espar__in=filtered_espars)
    
    capacity_summary = []
    capacity_scores = []
    
    for capacity_code, capacity_label in CAPACITIES.items():
        if len(capacity_code.split(".")) > 2:
            continue
        
        filtered_capacity = capacities.filter(code=capacity_code)
        avg_result = filtered_capacity.aggregate(avg_value=Avg('value'))
        avg_value = avg_result['avg_value']
        
        if avg_value is not None:
            capacity_summary.append({
                "category": capacity_label,
                "value": int(avg_value)
            })
            capacity_scores.append(avg_value)
    
    overall_avg = round(float(sum(capacity_scores) / len(capacity_scores)), 2) if capacity_scores else 0.0
    
    return capacity_summary, overall_avg



def read_africa_data_from_db(year):
    """
    Read data from database for all Africa countries (AFRO + North Africa)
    Returns capacity summary and overall average
    """
    from django.db.models import Avg
    
    # North African countries to include
    north_african_countries = ['Algeria', 'Egypt', 'Libya', 'Morocco', 'Tunisia', 'Sudan']
    africa_countries = list(AFRO_COUNTRIES) + [c for c in north_african_countries if c not in AFRO_COUNTRIES]
    
    # Query database for Africa countries
    filtered_espars = Espar.objects.filter(
        states__in=africa_countries,
        sheet__name=str(year)
    )
    
    if not filtered_espars.exists():
        return None, None
    
    capacities = Indicator.objects.filter(espar__in=filtered_espars)
    
    capacity_summary = []
    capacity_scores = []
    
    for capacity_code, capacity_label in CAPACITIES.items():
        if len(capacity_code.split(".")) > 2:
            continue
        
        filtered_capacity = capacities.filter(code=capacity_code)
        avg_result = filtered_capacity.aggregate(avg_value=Avg('value'))
        avg_value = avg_result['avg_value']
        
        if avg_value is not None:
            capacity_summary.append({
                "category": capacity_label,
                "value": int(avg_value)
            })
            capacity_scores.append(avg_value)
    
    overall_avg = round(float(sum(capacity_scores) / len(capacity_scores)), 2) if capacity_scores else 0.0
    
    return capacity_summary, overall_avg

# HUMANITARIAN_COUNTRIES list for humanitarian comparison
HUMANITARIAN_COUNTRIES = [
    "Burkina Faso",
    "Central African Republic",
    "Chad",
    "Democratic Republic of the Congo",
    "Ethiopia",
    "Mali",
    "Niger",
    "Nigeria",
    "South Sudan"
]


def read_humanitarian_comparison_data_from_db(year):
    """
    Read humanitarian comparison data from database.
    Returns averages for humanitarian, non-humanitarian, global, and afro countries.
    """
    from django.db.models import Avg
    
    # Get all espars for the year
    all_espars = Espar.objects.filter(sheet__name=str(year))
    
    if not all_espars.exists():
        return None, None, None, None
    
    def calculate_avg_for_countries(country_list):
        """Calculate average total_average for a list of countries"""
        espars = all_espars.filter(states__in=country_list)
        if not espars.exists():
            return 0.0
        avg_result = espars.aggregate(avg_value=Avg('total_average'))
        return round(float(avg_result['avg_value'] or 0), 2)
    
    # Calculate averages for different groups
    non_humanitarian_afro = [c for c in AFRO_COUNTRIES if c not in HUMANITARIAN_COUNTRIES]
    
    humanitarian_avg = calculate_avg_for_countries(HUMANITARIAN_COUNTRIES)
    non_humanitarian_avg = calculate_avg_for_countries(non_humanitarian_afro)
    afro_avg = calculate_avg_for_countries(list(AFRO_COUNTRIES))
    
    # Global average (all countries in the sheet)
    global_result = all_espars.aggregate(avg_value=Avg('total_average'))
    global_avg = round(float(global_result['avg_value'] or 0), 2)
    
    return humanitarian_avg, non_humanitarian_avg, global_avg, afro_avg


def get_afro_countries_from_db():
    """
    Get list of AFRO countries from database
    Returns regional options + sorted list of countries
    """
    # pyrefly: ignore [missing-import]
    from django.db.models.functions import Trim
    
    regional_options = ['All Country (AFRO)', 'All Country (AFRICA)']
    
    try:
        # Get unique countries from database for latest year (2025)
        afro_data = Espar.objects.annotate(
            cleaned_state=Trim('states')
        ).filter(
            cleaned_state__in=AFRO_COUNTRIES,
            sheet__name='2025'
        ).values_list('cleaned_state', flat=True).distinct()
        
        country_list = sorted(list(afro_data))
        return regional_options + country_list
    except (DatabaseError, AttributeError, ValueError):
        logger.exception("Error getting afro countries from db")
        return regional_options + sorted(AFRO_COUNTRIES)

    
    
class SummaryAPIView(APIView):
    permission_classes = [IsAuthenticated, IsNotSupplierRole]
    def get(self, request, *args, **kwargs):
        state=request.query_params.get('country', "Algeria")
        year=request.query_params.get('year', "2025")
        
        # Validate year parameter - must be a valid year string
        if not year or not year.strip():
            year = "2025"
        try:
            int(year)  # Test if it's a valid integer
        except (ValueError, TypeError):
            year = "2025"
      
        is_africa = state.strip() == "All Country (AFRICA)"
        is_afro = state.strip() == "All Country (AFRO)" or state.strip() == ""
        
        if is_africa or is_afro:
            if is_africa:
                capacity_summary, overall_average_ = read_africa_data_from_db(year)
            else:
                capacity_summary, overall_average_ = read_hq_data_from_db(year)
            
            if capacity_summary is None:
                filtered_espars = Espar.objects.filter(
                    states__in=AFRO_COUNTRIES, 
                    sheet__name=year.strip()
                )
                capacities = Indicator.objects.filter(espar__in=filtered_espars)
                capacity_summary = []
                for capacity_code, capacity_label in CAPACITIES.items():
                    if len(capacity_code.split(".")) > 2:
                        continue
                    filtered_capacity = capacities.filter(code=capacity_code)
                    aggregated = filtered_capacity.aggregate(max_value=Max("value"))
                    max_value = aggregated["max_value"]
                    if max_value is None:
                        continue
                    capacity_summary.append({
                        "category": capacity_label,
                        "value": max_value
                    })
                overall_average_ = overall_average(capacities)
            
            if is_africa:
                _, prev_year_avg = read_africa_data_from_db(str(int(year) - 1))
            else:
                _, prev_year_avg = read_hq_data_from_db(str(int(year) - 1))
            if prev_year_avg is None:
                prev_year_espar = Espar.objects.filter(states__in=AFRO_COUNTRIES, sheet__name=int(year)-1)
                prev_year_capacities = Indicator.objects.filter(espar__in=prev_year_espar)
                prev_year_avg = overall_average(prev_year_capacities)
            
            change_value = overall_average_ - prev_year_avg
            
            capacity_average_dict = {}
            capacity_average_named_dict = {}
            for idx, item in enumerate(capacity_summary, 1):
                key = f"C.{idx}"
                capacity_average_dict[key] = item['value']
                capacity_average_named_dict[item['category']] = item['value']
            
        else:
            filtered_espars = Espar.objects.annotate(
                cleaned_state=Trim('states'),
            ).filter(cleaned_state=state.strip(), sheet__name=year.strip())
            
            capacities = Indicator.objects.filter(espar__in=filtered_espars)
            capacity_summary = []
            for capacity_code, capacity_label in CAPACITIES.items():
                if len(capacity_code.split(".")) > 2:
                    continue
                filtered_capacity = capacities.filter(code=capacity_code)
                aggregated = filtered_capacity.aggregate(max_value=Max("value"))
                max_value = aggregated["max_value"]
                if max_value is None:
                    continue
                capacity_summary.append({
                    "category": capacity_label,
                    "value": max_value
                })
            
            prev_year_espar = Espar.objects.filter(states=state, sheet__name=int(year)-1)
            prev_year_capacities = Indicator.objects.filter(espar__in=prev_year_espar)
            
            overall_average_ = overall_average(capacities)
            change_value = overall_average_ - overall_average(prev_year_capacities)
            
            capacity_average_dict = capacity_averages(capacities)
            capacity_average_named_dict = capacity_averages(capacities, named=True)
        
        return custom_response(
            status="Ok",
            message=f"{state} - {year} Self Assessment",
            data={
                'filters': {
                    'country': state, 
                    'year': year,
                    'countries': get_afro_countries_from_db(),
                    'years': Sheet.objects.values_list("name", flat=True).distinct().order_by("name"),
                },
                'capacity_summary': capacity_summary,
                'capacity_average': capacity_average_dict,
                'capacity_average_named': capacity_average_named_dict,
                'overall': {
                    'value': overall_average_,
                    'change': change_value, 
                    'prev_year': int(year)-1,
                }
            }
        )
    
    
class CountryYear(TypedDict):
    country: str
    year: str
class ComparisonAPIView(APIView):
    def get(self, request, *args, **kwargs):
        states: List[CountryYear] = json.loads(request.query_params.get('countries', '[]'))
        countryScores: Dict[str, Dict[str, int]] = {} 
        for state in states:
            filtered_espars = Espar.objects.annotate(
                cleaned_state=Trim('states'),
            ).filter(cleaned_state=state["country"], sheet__name=state["year"])
            capacities = Indicator.objects.filter(espar__in=filtered_espars)
            
            capacity_summary = {}
            for capacity_code, capacity_label in CAPACITIES.items():
                if len(capacity_code.split(".")) > 2:
                    continue
                filtered_capacity = capacities.filter(code=capacity_code)
                # Get max value safely
                aggregated = filtered_capacity.aggregate(max_value=Max("value"))
                max_value = aggregated["max_value"]
                if max_value is None:
                    capacity_summary[capacity_label] = 0
                    continue
                capacity_summary[capacity_label] = max_value
                
            countryScores[state["country"]] = capacity_summary

        return custom_response(
            status="OK",
            message="",
            data={
                "categories": [
                    capacity_label 
                    for capacity_code, capacity_label in CAPACITIES.items() 
                    if len(capacity_code.split(".")) <= 2
                ],
                "country_scores": countryScores
            }
        )


class HumanitarianComparisonAPIView(APIView):
    """Compare average IHR scores between Humanitarian and Non-Humanitarian countries over time"""
    
    def get(self, request, *args, **kwargs):
        years = list(Sheet.objects.values_list("name", flat=True).distinct().order_by("name"))
        
        humanitarian_scores = []
        non_humanitarian_scores = []
        global_scores = []
        afro_scores = []
        
        for year in years:
            h_avg, nh_avg, g_avg, a_avg = read_humanitarian_comparison_data_from_db(year)
            
            if h_avg is None:
                # Fallback to indicator-based calculation if no data
                humanitarian_espars = Espar.objects.filter(
                    states__in=HUMANITARIAN_COUNTRIES, 
                    sheet__name=year
                )
                non_humanitarian_countries = [c for c in AFRO_COUNTRIES if c not in HUMANITARIAN_COUNTRIES]
                non_humanitarian_espars = Espar.objects.filter(
                    states__in=non_humanitarian_countries,
                    sheet__name=year
                )
                afro_espars = Espar.objects.filter(
                    states__in=AFRO_COUNTRIES,
                    sheet__name=year
                )
                
                h_indicators = Indicator.objects.filter(espar__in=humanitarian_espars)
                nh_indicators = Indicator.objects.filter(espar__in=non_humanitarian_espars)
                a_indicators = Indicator.objects.filter(espar__in=afro_espars)
                
                h_avg = overall_average(h_indicators) if h_indicators.exists() else 0
                nh_avg = overall_average(nh_indicators) if nh_indicators.exists() else 0
                a_avg = overall_average(a_indicators) if a_indicators.exists() else 0
                g_avg = 0 
            
            humanitarian_scores.append(h_avg)
            non_humanitarian_scores.append(nh_avg)
            global_scores.append(g_avg)
            afro_scores.append(a_avg)
        
        return custom_response(
            status="OK",
            message="Humanitarian vs Non-Humanitarian Country Comparison",
            data={
                "years": years,
                "humanitarian_scores": humanitarian_scores,
                "non_humanitarian_scores": non_humanitarian_scores,
                "global_scores": global_scores,
                "afro_scores": afro_scores,
                "humanitarian_count": len(HUMANITARIAN_COUNTRIES),
            }
        )
