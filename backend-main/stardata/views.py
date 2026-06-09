from datetime import datetime
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
from utils.filters import StardataFilter
from utils.severity_utils import normalize_severity, get_severity_color, VALID_SEVERITIES
from utils.afro_countries import AFRO_COUNTRIES
from utils.tenant_resolver import resolve_tenant
from .models import StarData

from .serializers import StardataSerializer

# Severity normalization mapping - maps all language variants to English
SEVERITY_MAPPING = {
    # English
    'Very High': 'Very High',
    'High': 'High',
    'Moderate': 'Moderate',
    'Low': 'Low',
    # French
    'Très elevée': 'Very High',
    'Tres elevee': 'Very High',
    'Très élevée': 'Very High',
    'Tres elevee': 'Very High',
    'Elevée': 'High',
    'Elevee': 'High',
    'Élevée': 'High',
    'Modérée': 'Moderate',
    'Moderee': 'Moderate',
    'Faible': 'Low',
    # Portuguese
    'Muito elevada': 'Very High',
    'Elevada': 'High',
    'Moderada': 'Moderate',
    'Baixa': 'Low',
    # Spanish
    'Muy alta': 'Very High',
    'Alta': 'High',
    'Moderado': 'Moderate',
    'Baja': 'Low',
    # Numeric values (sometimes stored as numbers)
    '4': 'Very High',
    '3': 'High',
    '2': 'Moderate',
    '1': 'Low',
    '0': 'Low',
    '4.0': 'Very High',
    '3.0': 'High',
    '2.0': 'Moderate',
    '1.0': 'Low',
    '0.0': 'Low',
    'nan': 'Low',
}

# High risk severity levels (in all languages)
HIGH_RISK_SEVERITIES = [
    'Very High', 'High',
    'Très elevée', 'Tres elevee', 'Très élevée', 'Elevée', 'Elevee', 'Élevée',
    'Muito elevada', 'Elevada',
    'Muy alta', 'Alta',
    '4', '3',
]

def normalize_severity(severity: str) -> str:
    """Normalize severity to English standard (Very High, High, Moderate, Low)"""
    if not severity:
        return 'Low'  # Default to Low if empty
    severity = severity.strip()
    # Check exact match first
    if severity in SEVERITY_MAPPING:
        return SEVERITY_MAPPING[severity]
    # Check case-insensitive match
    for key, value in SEVERITY_MAPPING.items():
        if key.lower() == severity.lower():
            return value
    
    # Try converting float-like string to int-like string (e.g. "3.0" -> "3")
    try:
        float_val = float(severity)
        if float_val == float_val: # Check for NaN (NaN != NaN)
            int_str = str(int(float_val))
            if int_str in SEVERITY_MAPPING:
                return SEVERITY_MAPPING[int_str]
    except (ValueError, TypeError):
        pass

    # If no match found, default to the original (might be a valid severity)
    return severity if severity in ['Very High', 'High', 'Moderate', 'Low'] else 'Low'

class StardataUploadView(APIView):
    """
    Upload STAR data CSV file and directly insert data into database.
    No file is saved to storage - data is processed inline.
    """
    
    @staticmethod
    def normalize_text(text: str) -> str:
        """Remove prefix '_' if it exists and convert to lowercase"""
        if text.startswith("_"):
            text = text[1:]
        return text.lower()
    
    @staticmethod
    def extract_base_data(row):
        """Extract base data fields from a row"""
        fields = [
            '_N', 'Country', 'Level', 'Year', 'Start_date', 'End_date', 'Subgroup_of_Hazards', 'Main_Type_of_Hazard',
            'Hazard', 'Health_consequences', 'Scale', 'Geographical_Area', 'Exposure', 'Frequency', 'Seasonality', 
            'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Likelihood',
            'Severity', 'Vulnerability', 'Vulnerability_Details', 'Coping_capacity', 'Coping_capacity_details', 
            'Governance_and_Resouces', 'Health_Sector_Capacity', 'Non_Health_Sector_Capcity', 'Commuty_Capacity', 
            'Resources', 'Impact', 'Confidence_level', 'Risk_level', 'Risk_level_Number', 'Status'
        ]
        return {StardataUploadView.normalize_text(f): row.get(f, None) for f in fields}
    
    def post(self, request, *args, **kwargs):
        import pandas as pd
        from utils.index import gen_unique_key
        
        serializer = FileUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        file = serializer.validated_data['file']
        
        try:
            # Process file directly from memory - no file storage
            df = pd.read_csv(file)
            df = df.where(pd.notna(df), None)  # NaN → None
            
            records_created = 0
            
            for idx, row in df.iterrows():
                base_data = self.extract_base_data(row)
                unique_key = gen_unique_key('stardata', idx)
                base_data['tenant'] = resolve_tenant(name=base_data.get('country'))

                StarData.objects.update_or_create(
                    key_on_table=unique_key,
                    defaults=base_data
                )
                records_created += 1
            
            return custom_response(
                "OK",
                message=f"Data imported successfully. {records_created} records created.",
                data={"records_created": records_created},
                http_status=status.HTTP_200_OK
            )
        except Exception as e:  # noqa: BLE001 — top-level import view: any failure must return a structured 400 response
            return custom_response(
                "ERROR",
                message=f"Failed to import data: {str(e)}",
                data={},
                http_status=status.HTTP_400_BAD_REQUEST
            )


class StardataListView(generics.ListAPIView):
    serializer_class=StardataSerializer
    queryset=StarData.objects.all()
    pagination_class=LargeResultsSetPagination
    filterset_class = StardataFilter
    filter_backends = [DjangoFilterBackend]
    

class SummaryAPIView(APIView):
    permission_classes = [IsAuthenticated, IsNotSupplierRole]
    # Month name mapping
    MONTH_FIELDS = {
        1: 'jan', 2: 'feb', 3: 'mar', 4: 'apr',
        5: 'may', 6: 'jun', 7: 'jul', 8: 'aug',
        9: 'sep', 10: 'oct', 11: 'nov', 12: 'dec'
    }
    
    # AFRO countries from official constants (47 countries, excluding EMRO)
    
    def get(self, request, *args, **kwargs):
        hazard=request.query_params.get('hazard', '')
        hazard_type=request.query_params.get('hazard_type', '')
        severity=request.query_params.get('severity', "")
        status=request.query_params.get('status', "")
        
        # Get month from query param, or default to current month
        month_param = request.query_params.get('month', '').lower()
        if month_param in self.MONTH_FIELDS.values():
            month_field = month_param
        else:
            current_month = datetime.now().month
            month_field = self.MONTH_FIELDS.get(current_month, 'jan')
        
        stardata=StarData.objects.annotate(
            cleaned_hazard=Trim('hazard'), 
            cleaned_severity=Trim('severity'),
            cleaned_status=Trim('status'),
            cleaned_hazard_type=Trim('main_type_of_hazard'),
            cleaned_country=Trim('country')
        )
        hazards = stardata.exclude(cleaned_hazard__isnull=True).values_list("cleaned_hazard", flat=True).distinct()
        cleaned_hazard_types = stardata.exclude(cleaned_hazard_type__isnull=True).values_list("cleaned_hazard_type", flat=True).distinct()
        all_severities = stardata.exclude(cleaned_severity__isnull=True).values_list("cleaned_severity", flat=True).distinct()
        # Normalize and filter to only show unique English severity levels
        normalized_severities = set(normalize_severity(s) for s in all_severities)
        severities = [s for s in VALID_SEVERITIES if s in normalized_severities]
        statuses = stardata.exclude(cleaned_status__isnull=True).values_list("cleaned_status", flat=True).distinct()
        
        star_data_filters = {}
        if hazard:
            star_data_filters['cleaned_hazard'] = hazard
        if hazard_type:
            star_data_filters['cleaned_hazard_type'] = hazard_type
        if severity:
            star_data_filters['cleaned_severity'] = severity
        if status:
            star_data_filters['cleaned_status'] = status

        filtered_stardata = stardata.filter(**star_data_filters)
        # Filter by month - only include records with data for the selected month
        month_filter = {f'{month_field}__isnull': False}
        filtered_stardata = filtered_stardata.exclude(**{f'{month_field}__exact': ''}).filter(**month_filter)
        
        # Count only AFRO countries for affected_country
        all_countries = filtered_stardata.values_list('cleaned_country', flat=True).distinct()
        african_affected = [c for c in all_countries if c and c.strip() in AFRO_COUNTRIES]
        
        # Count high-risk hazard records for the selected month (3=High, 4=Very High)
        # Handle both integer-like and float-like strings from DB
        high_risk_values = ['3', '4', '3.0', '4.0']
        high_risk_count = filtered_stardata.filter(**{f'{month_field}__in': high_risk_values}).count()
        
        return custom_response(
            status="OK",
            message="",
            data={
                'filters': {
                    'hazards': list(hazards),
                    'hazard_types': list(cleaned_hazard_types),
                    'severities': severities,
                    'statuses': list(statuses),
                },
                'incident': {
                    'total': filtered_stardata.count(),
                    # Active = Count of high-risk hazard records
                    'active': high_risk_count,
                    'affected_country': len(african_affected),  # Only count African countries
                }
            }
        )
        
    
    
class ChartsAPIView(APIView):
    def get(self, request, *args, **kwargs):
        stardata=StarData.objects.annotate(
            cleaned_country=Trim('country')
        )
        countries = stardata.values_list('cleaned_country', flat=True).distinct()
        country=request.query_params.get('country')
        # Get month from query param, or default to current month
        month_param = request.query_params.get('month', '').lower()
        MONTH_FIELDS = {1:'jan', 2:'feb', 3:'mar', 4:'apr', 5:'may', 6:'jun', 7:'jul', 8:'aug', 9:'sep', 10:'oct', 11:'nov', 12:'dec'}
        
        if month_param in MONTH_FIELDS.values():
            month_field = month_param
        else:
            current_month = datetime.now().month
            month_field = MONTH_FIELDS.get(current_month, 'jan')

        # Filter for current month - only include records with data for the selected month
        filtered_stardata = stardata
        if country:
            filtered_stardata = filtered_stardata.filter(cleaned_country=country.strip())
        month_filter = {f'{month_field}__isnull': False}
        filtered_stardata = filtered_stardata.exclude(**{f'{month_field}__exact': ''}).filter(**month_filter)
        
        # Prepare severity distribution using monthly risk
        severity_dist = []
        for i in filtered_stardata:
            raw_val = getattr(i, month_field, None)
            if raw_val:
                severity_dist.append({
                    'name': i.hazard.strip() if i.hazard else 'Unknown',
                    'value': normalize_severity(str(raw_val).strip())
                })

        return custom_response(
            status="OK",
            message="",
            data={
                'filters': {
                    # Filter to AFRO countries only
                    'countries': [c for c in countries if c in AFRO_COUNTRIES]
                },
                'hazard_frequency': [{'name': i.hazard.strip(), 'value':i.frequency} for i in filtered_stardata if i.frequency],
                'severity_distribution': severity_dist,
                'status': [{'name': i.hazard.strip(), 'value': i.status.strip() } for i in filtered_stardata if i.status],
            }
        )   


class MapDataAPIView(APIView):
    """Returns countries with High/Very High risk hazards for the current month"""
    
    # AFRO country coordinates (excluding EMRO countries)
    COUNTRY_COORDINATES = {
        "Ghana": {"lat": 7.9465, "lng": -1.0232},
        "Kenya": {"lat": -1.2921, "lng": 36.8219},
        "Madagascar": {"lat": -18.8792, "lng": 47.5079},
        "Senegal": {"lat": 14.4974, "lng": -14.4524},
        "Tanzania": {"lat": -6.369, "lng": 34.8888},
        "Nigeria": {"lat": 9.082, "lng": 8.6753},
        "Ethiopia": {"lat": 9.145, "lng": 40.4897},
        "South Africa": {"lat": -30.5595, "lng": 22.9375},
        "Uganda": {"lat": 1.3733, "lng": 32.2903},
        "Mozambique": {"lat": -18.6657, "lng": 35.5296},
        "Zambia": {"lat": -13.1339, "lng": 27.8493},
        "Zimbabwe": {"lat": -19.0154, "lng": 29.1549},
        "Rwanda": {"lat": -1.9403, "lng": 29.8739},
        "Malawi": {"lat": -13.2543, "lng": 34.3015},
        "Cameroon": {"lat": 7.3697, "lng": 12.3547},
        "Democratic Republic of the Congo": {"lat": -4.0383, "lng": 21.7587},
        "Côte d'Ivoire": {"lat": 7.5400, "lng": -5.5471},
        "Angola": {"lat": -11.2027, "lng": 17.8739},
        "Mali": {"lat": 17.5707, "lng": -3.9962},
        "Burkina Faso": {"lat": 12.2383, "lng": -1.5616},
        "Niger": {"lat": 17.6078, "lng": 8.0817},
        "Chad": {"lat": 15.4542, "lng": 18.7322},
        "South Sudan": {"lat": 6.877, "lng": 31.307},
        "Botswana": {"lat": -22.3285, "lng": 24.6849},
        "Namibia": {"lat": -22.9576, "lng": 18.4904},
        "Lesotho": {"lat": -29.6100, "lng": 28.2336},
        "Eswatini": {"lat": -26.5225, "lng": 31.4659},
        "Mauritius": {"lat": -20.3484, "lng": 57.5522},
        "Seychelles": {"lat": -4.6796, "lng": 55.4920},
        "Comoros": {"lat": -11.6455, "lng": 43.3333},
        "Cabo Verde": {"lat": 16.5388, "lng": -23.0418},
        "Gambia": {"lat": 13.4432, "lng": -15.3101},
        "Guinea": {"lat": 9.9456, "lng": -9.6966},
        "Guinea-Bissau": {"lat": 11.8037, "lng": -15.1804},
        "Liberia": {"lat": 6.4281, "lng": -9.4295},
        "Sierra Leone": {"lat": 8.4606, "lng": -11.7799},
        "Togo": {"lat": 8.6195, "lng": 0.8248},
        "Benin": {"lat": 9.3077, "lng": 2.3158},
        "Mauritania": {"lat": 21.0079, "lng": -10.9408},
        "Central African Republic": {"lat": 6.6111, "lng": 20.9394},
        "Republic of the Congo": {"lat": -0.228, "lng": 15.8277},
        "Gabon": {"lat": -0.8037, "lng": 11.6094},
        "Equatorial Guinea": {"lat": 1.6508, "lng": 10.2679},
        "São Tomé and Príncipe": {"lat": 0.1864, "lng": 6.6131},
        "Burundi": {"lat": -3.3731, "lng": 29.9189},
        "Eritrea": {"lat": 15.1794, "lng": 39.7823},
        "Djibouti": {"lat": 11.8251, "lng": 42.5903},
        "Somalia": {"lat": 5.1521, "lng": 46.1996},
    }
    
    # Month name mapping
    MONTH_FIELDS = {
        1: 'jan', 2: 'feb', 3: 'mar', 4: 'apr',
        5: 'may', 6: 'jun', 7: 'jul', 8: 'aug',
        9: 'sep', 10: 'oct', 11: 'nov', 12: 'dec'
    }
    
    def get(self, request, *args, **kwargs):
        # Get month from query param, or default to current month
        month_param = request.query_params.get('month', '').lower()
        
        # If month param provided, use it; otherwise use current month
        if month_param in self.MONTH_FIELDS.values():
            month_field = month_param
        else:
            current_month = datetime.now().month
            month_field = self.MONTH_FIELDS.get(current_month, 'jan')
        
        # Get optional filter parameters
        severity_filter = request.query_params.get('severity', '')  # e.g., "High" or "Very High"
        hazard_filter = request.query_params.get('hazard', '')  # e.g., specific hazard name
        hazard_type_filter = request.query_params.get('hazard_type', '')  # e.g., "Environmental"
        
        stardata_qs = StarData.objects.annotate(
            cleaned_country=Trim('country'),
            cleaned_severity=Trim('severity'),
            cleaned_hazard=Trim('hazard'),
            cleaned_hazard_type=Trim('main_type_of_hazard'),
        )
        
        # Apply hazard filter if provided
        if hazard_filter:
            stardata_qs = stardata_qs.filter(cleaned_hazard=hazard_filter)
        
        # Apply hazard type filter if provided
        if hazard_type_filter:
            stardata_qs = stardata_qs.filter(cleaned_hazard_type=hazard_type_filter)
        
        # Apply severity filter if provided, otherwise show all severities (not just High/Very High)
        valid_severities = ["Low", "Moderate", "High", "Very High"]
        if severity_filter and severity_filter in valid_severities:
            stardata_qs = stardata_qs.filter(cleaned_severity=severity_filter)
        # If no severity filter, show all (to match card counts)
        
        # Filter for current month - check if month field is not empty/null
        month_filter = {f'{month_field}__isnull': False}
        stardata_qs = stardata_qs.exclude(**{f'{month_field}__exact': ''}).filter(**month_filter)
        
        # Country name normalization - map database names to COUNTRY_COORDINATES keys
        COUNTRY_NAME_MAPPING = {
            # Common variations
            'DRC': 'Democratic Republic of the Congo',
            'DR Congo': 'Democratic Republic of the Congo',
            'Congo DR': 'Democratic Republic of the Congo',
            'Congo, DRC': 'Democratic Republic of the Congo',
            'Congo-Kinshasa': 'Democratic Republic of the Congo',
            'Congo-Brazzaville': 'Republic of the Congo',
            'Congo': 'Republic of the Congo',
            'Ivory Coast': "Côte d'Ivoire",
            "Cote d'Ivoire": "Côte d'Ivoire",
            'Tanzania': 'Tanzania',
            'United Republic of Tanzania': 'Tanzania',
            'Swaziland': 'Eswatini',
            'Cape Verde': 'Cabo Verde',
            'Sao Tome and Principe': 'São Tomé and Príncipe',
            'Sao Tome': 'São Tomé and Príncipe',
        }
        
        def get_country_coords(country_name):
            """Get coordinates for a country, handling name variations"""
            # Direct match first
            if country_name in self.COUNTRY_COORDINATES:
                return self.COUNTRY_COORDINATES[country_name]
            
            # Try normalized name
            normalized = COUNTRY_NAME_MAPPING.get(country_name)
            if normalized and normalized in self.COUNTRY_COORDINATES:
                return self.COUNTRY_COORDINATES[normalized]
            
            # Try partial match (case insensitive)
            country_lower = country_name.lower()
            for known_country, coords in self.COUNTRY_COORDINATES.items():
                known_lower = known_country.lower()
                if country_lower in known_lower or known_lower in country_lower:
                    return coords
            
            return None
        
        # Group by country to find the highest risk level for each
        countries_data = []
        countries_data_grouped = {}
        missing_countries = set()  # Track countries without coordinates
        
        for item in stardata_qs:
            country_name = item.cleaned_country.strip() if item.cleaned_country else None
            if not country_name:
                continue
            
            # Get data for this specific month from the month field (e.g. 'jan')
            raw_month_risk = getattr(item, month_field, '1')
            month_risk_str = str(raw_month_risk).strip() if raw_month_risk else '1'
            # Map numeric or string risk to standard English label
            item_severity = normalize_severity(month_risk_str)
            
            # Risk level sorting (higher is more critical)
            risk_numeric_map = {'Very High': 4, 'High': 3, 'Moderate': 2, 'Low': 1}
            current_risk_num = risk_numeric_map.get(item_severity, 1)

            if country_name not in countries_data_grouped:
                coords = get_country_coords(country_name)
                if coords:
                    countries_data_grouped[country_name] = {
                        'country': country_name,
                        'lat': coords['lat'],
                        'lng': coords['lng'],
                        'max_risk_num': current_risk_num,
                        'hazards': [{'name': item.hazard.strip() if item.hazard else '', 'severity': item_severity}],
                        'total_hazard_count': 1
                    }
                else:
                    missing_countries.add(country_name)
            else:
                data = countries_data_grouped[country_name]
                data['total_hazard_count'] += 1
                if current_risk_num > data['max_risk_num']:
                    data['max_risk_num'] = current_risk_num
                if len(data['hazards']) < 5:
                    data['hazards'].append({'name': item.hazard.strip() if item.hazard else '', 'severity': item_severity})

        risk_reverse_map = {4: 'Very High', 3: 'High', 2: 'Moderate', 1: 'Low'}
        for i, (name, data) in enumerate(countries_data_grouped.items()):
            countries_data.append({
                'id': i + 1,
                'country': name,
                'lat': data['lat'],
                'lng': data['lng'],
                'severity': risk_reverse_map.get(data['max_risk_num'], 'Low'),
                'hazard_count': data['total_hazard_count'],
                'hazards': data['hazards'],
                'month': month_field.capitalize(),
            })
        
        return custom_response(
            status="OK",
            message="",
            data={
                'current_month': month_field.capitalize(),
                'countries': countries_data,
                'total_countries': len(countries_data),
                'missing_countries': list(missing_countries),  # Debug: countries without coords
            }
        )


class UpcomingHazardsAPIView(APIView):
    """Returns high-risk hazards for the upcoming 2 months"""
    
    # Month name mapping
    MONTH_FIELDS = {
        1: 'jan', 2: 'feb', 3: 'mar', 4: 'apr',
        5: 'may', 6: 'jun', 7: 'jul', 8: 'aug',
        9: 'sep', 10: 'oct', 11: 'nov', 12: 'dec'
    }
    
    MONTH_NAMES = {
        1: 'January', 2: 'February', 3: 'March', 4: 'April',
        5: 'May', 6: 'June', 7: 'July', 8: 'August',
        9: 'September', 10: 'October', 11: 'November', 12: 'December'
    }
    
    # Risk level colors
    RISK_COLORS = {
        '1': '#22c55e', '1.0': '#22c55e',
        '2': '#facc15', '2.0': '#facc15',
        '3': '#f97316', '3.0': '#f97316',
        '4': '#ef4444', '4.0': '#ef4444',
    }
    
    def get(self, request, *args, **kwargs):
        from datetime import datetime
        
        country = request.query_params.get('country', '')
        month_param = request.query_params.get('month', '').lower()
        
        # Get current month and next month
        if month_param in self.MONTH_FIELDS.values():
            current_month = list(self.MONTH_FIELDS.keys())[list(self.MONTH_FIELDS.values()).index(month_param)]
        else:
            current_month = datetime.now().month
            
        next_month = (current_month % 12) + 1
        
        month1_field = self.MONTH_FIELDS.get(current_month, 'jan')
        month2_field = self.MONTH_FIELDS.get(next_month, 'feb')
        
        stardata_qs = StarData.objects.annotate(
            cleaned_country=Trim('country'),
            cleaned_severity=Trim('severity'),
            cleaned_hazard=Trim('main_type_of_hazard'),
        )
        
        # Filter by country if provided
        if country:
            stardata_qs = stardata_qs.filter(cleaned_country=country)
        
        # Filter for High or Very High severity only
        high_risk_severities = ["High", "Very High", "Elevada", "Muito elevada"]
        stardata_qs = stardata_qs.filter(cleaned_severity__in=high_risk_severities)
        
        # Build hazard data
        hazards_data = []
        seen_hazards = set()
        
        for item in stardata_qs:
            hazard_name = item.cleaned_hazard if item.cleaned_hazard else item.hazard
            if not hazard_name:
                continue
            hazard_name = hazard_name.strip()
            
            # Get month values
            month1_value = getattr(item, month1_field, '') or ''
            month2_value = getattr(item, month2_field, '') or ''
            
            # Only include if there's data for at least one month
            if not month1_value.strip() and not month2_value.strip():
                continue
            
            # Create unique key to avoid duplicate hazard types
            hazard_key = f"{hazard_name}-{item.cleaned_severity}"
            if hazard_key in seen_hazards:
                continue
            seen_hazards.add(hazard_key)
            
            normalized_sev = normalize_severity(item.cleaned_severity)
            hazards_data.append({
                'hazard': hazard_name,
                'severity': normalized_sev,  # Use normalized English label
                'month1_value': month1_value.strip(),
                'month2_value': month2_value.strip(),
                'month1_color': self.RISK_COLORS.get(month1_value.strip(), '#94a3b8'),
                'month2_color': self.RISK_COLORS.get(month2_value.strip(), '#94a3b8'),
            })
        
        return custom_response(
            status="OK",
            message="",
            data={
                'month1': self.MONTH_NAMES.get(current_month, 'January'),
                'month2': self.MONTH_NAMES.get(next_month, 'February'),
                'month1_field': month1_field.capitalize(),
                'month2_field': month2_field.capitalize(),
                'hazards': hazards_data,
                'total_hazards': len(hazards_data),
            }
        )


class ActiveHazardsAPIView(APIView):
    """Returns currently active hazards for the current month"""
    
    # Month name mapping
    MONTH_FIELDS = {
        1: 'jan', 2: 'feb', 3: 'mar', 4: 'apr',
        5: 'may', 6: 'jun', 7: 'jul', 8: 'aug',
        9: 'sep', 10: 'oct', 11: 'nov', 12: 'dec'
    }
    
    MONTH_NAMES = {
        1: 'January', 2: 'February', 3: 'March', 4: 'April',
        5: 'May', 6: 'June', 7: 'July', 8: 'August',
        9: 'September', 10: 'October', 11: 'November', 12: 'December'
    }
    
    # Severity colors
    SEVERITY_COLORS = {
        'Low': '#22c55e', 'Moderate': '#facc15', 'High': '#f97316', 'Very High': '#ef4444',
        '1': '#22c55e', '1.0': '#22c55e', '2': '#facc15', '2.0': '#facc15',
        '3': '#f97316', '3.0': '#f97316', '4': '#ef4444', '4.0': '#ef4444',
    }
    
    def get(self, request, *args, **kwargs):
        from datetime import datetime
        
        country = request.query_params.get('country', '')
        month_param = request.query_params.get('month', '').lower()
        
        # Get current month
        if month_param in self.MONTH_FIELDS.values():
            current_month = list(self.MONTH_FIELDS.keys())[list(self.MONTH_FIELDS.values()).index(month_param)]
        else:
            current_month = datetime.now().month
            
        month_field = self.MONTH_FIELDS.get(current_month, 'jan')
        month_name = self.MONTH_NAMES.get(current_month, 'January')
        
        stardata_qs = StarData.objects.annotate(
            cleaned_country=Trim('country'),
            cleaned_severity=Trim('severity'),
            cleaned_hazard=Trim('hazard'),
            cleaned_hazard_type=Trim('main_type_of_hazard'),
            cleaned_status=Trim('status'),
        )
        
        # Filter by country if provided
        if country:
            stardata_qs = stardata_qs.filter(cleaned_country=country)
        
        # Filter for current month - hazards that have values for this month
        # Exclude empty values
        stardata_qs = stardata_qs.exclude(**{f'{month_field}__exact': ''}).filter(**{f'{month_field}__isnull': False})
        
        # Build hazard data
        active_hazards = []
        
        for item in stardata_qs:
            hazard_name = item.cleaned_hazard if item.cleaned_hazard else 'Unknown'
            hazard_type = item.cleaned_hazard_type if item.cleaned_hazard_type else 'Unknown'
            severity = item.cleaned_severity if item.cleaned_severity else 'Unknown'
            month_value = getattr(item, month_field, '') or ''
            is_active = item.cleaned_status == '1'
            
            # Get severity color
            severity_color = self.SEVERITY_COLORS.get(severity, '#94a3b8')
            
            normalized_sev = normalize_severity(severity)
            severity_color = get_severity_color(normalized_sev)
            active_hazards.append({
                'hazard': hazard_name.strip(),
                'hazard_type': hazard_type.strip(),
                'severity': normalized_sev,  # Use normalized English label
                'severity_color': severity_color,
                'month_value': month_value.strip(),
                'is_active': is_active,
                'geographical_area': item.geographical_area.strip() if item.geographical_area else '',
            })
        
        # Sort by severity (Very High first)
        severity_order = {'Very High': 0, 'Muito elevada': 0, 'High': 1, 'Elevada': 1, 'Moderate': 2, 'Moderada': 2, 'Low': 3, 'Baixa': 3}
        active_hazards.sort(key=lambda x: severity_order.get(x['severity'], 4))
        
        # Count by severity
        severity_counts = {}
        for h in active_hazards:
            sev = h['severity']
            severity_counts[sev] = severity_counts.get(sev, 0) + 1
        
        return custom_response(
            status="OK",
            message="",
            data={
                'current_month': month_name,
                'month_field': month_field.capitalize(),
                'hazards': active_hazards[:20],  # Limit to top 20
                'total_hazards': len(active_hazards),
                'severity_counts': severity_counts,
            }
        )