import os
from collections import defaultdict
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from utils.index import custom_response
from .models import StarCandlestick


class RVFCandlestickAPIView(APIView):
    """Returns aggregated candlestick data with optional hazard and country filters"""
    
    def get(self, request, *args, **kwargs):
        # Get filter parameters
        hazard_filter = request.query_params.get('hazard', None)
        country_filter = request.query_params.get('country', None)
        year_filter = request.query_params.get('year', None)
        
        # Build query
        queryset = StarCandlestick.objects.all()
        
        if hazard_filter:
            queryset = queryset.filter(hazard__icontains=hazard_filter)
        if country_filter:
            queryset = queryset.filter(country=country_filter)
        if year_filter:
            queryset = queryset.filter(year=year_filter)
            
        # If no data exists, check if we need to migrate or just empty filters
        if not queryset.exists() and StarCandlestick.objects.count() == 0:
             return custom_response(
                status="ERROR",
                message="No candlestick data found in database. Please run migration.",
                data={},
                http_status=404
            )

        # Aggregate data by month_key (YYYY-MM)
        # We need to perform aggregation in Python because we need to count unique countries per month
        # and calculate sums for OHLC averages
        
        # Optimization: Use values() to fetch only needed fields
        data_rows = queryset.values(
            'month_key', 
            'open_val', 'high_val', 'low_val', 'close_val', 
            'country'
        )
        
        monthly_data = defaultdict(lambda: {
            'open_sum': 0,
            'high_sum': 0,
            'low_sum': 0,
            'close_sum': 0,
            'count': 0,
            'countries': set()
        })
        
        for row in data_rows:
            month_key = row['month_key']
            
            monthly_data[month_key]['open_sum'] += row['open_val']
            monthly_data[month_key]['high_sum'] += row['high_val']
            monthly_data[month_key]['low_sum'] += row['low_val']
            monthly_data[month_key]['close_sum'] += row['close_val']
            monthly_data[month_key]['count'] += 1
            monthly_data[month_key]['countries'].add(row['country'])
        
        # Calculate averages and MA
        sorted_months = sorted(monthly_data.keys())
        result_data = []
        close_values = []  # For MA calculation
        
        for month_key in sorted_months:
            data = monthly_data[month_key]
            count = data['count']
            
            if count == 0:
                continue
            
            # Calculate averages
            avg_open = round(data['open_sum'] / count, 2)
            avg_high = round(data['high_sum'] / count, 2)
            avg_low = round(data['low_sum'] / count, 2)
            avg_close = round(data['close_sum'] / count, 2)
            
            close_values.append(avg_close)
            
            # Calculate MA-5
            ma5 = None
            if len(close_values) >= 5:
                ma5 = round(sum(close_values[-5:]) / 5, 2)
            
            # Calculate MA-10
            ma10 = None
            if len(close_values) >= 10:
                ma10 = round(sum(close_values[-10:]) / 10, 2)
            
            # Format month label (YYYY-MM -> Mon YYYY)
            year, month = month_key.split('-')
            month_names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
            try:
                month_idx = int(month) - 1
                if 0 <= month_idx < 12:
                    month_label = f"{month_names[month_idx]} {year}"
                else:
                    month_label = month_key
            except ValueError:
                month_label = month_key
            
            result_data.append({
                'date': month_key,
                'month': month_label,
                'open': avg_open,
                'high': avg_high,
                'low': avg_low,
                'close': avg_close,
                'volume': len(data['countries']),  # Number of countries affected
                'ma5': ma5,
                'ma10': ma10,
            })
        
        # Determine date range
        date_range = ""
        if result_data:
            first_month = result_data[0]['month']
            last_month = result_data[-1]['month']
            date_range = f"{first_month} - {last_month}"
        
        # Determine title
        title = hazard_filter if hazard_filter else "All Hazards"
        if country_filter:
            title = f"{title} - {country_filter}"
        
        # Count total unique countries in the result set
        total_unique_countries = len(queryset.values('country').distinct())
        
        return custom_response(
            status="OK",
            message="Candlestick data retrieved successfully",
            data={
                'title': title,
                'countries': total_unique_countries,
                'date_range': date_range,
                'data': result_data,
            }
        )


class CandlestickMetadataAPIView(APIView):
    """Returns available hazards, countries, and years from the database"""
    
    def get(self, request, *args, **kwargs):
        try:
             # Check if data exists
            if StarCandlestick.objects.count() == 0:
                 return custom_response(
                    status="OK",
                    message="No metadata available (database empty)",
                    data={
                        'hazards': [],
                        'countries': [],
                        'years': [],
                    }
                )

            hazards = StarCandlestick.objects.values_list('hazard', flat=True).distinct().order_by('hazard')
            countries = StarCandlestick.objects.values_list('country', flat=True).distinct().order_by('country')
            years = StarCandlestick.objects.values_list('year', flat=True).distinct().order_by('year')
            
            return custom_response(
                status="OK",
                message="Metadata retrieved successfully",
                data={
                    'hazards': list(hazards),
                    'countries': list(countries),
                    'years': list(years),
                }
            )
            
        except Exception as e:  # noqa: BLE001 — top-level metadata view: any failure must return a structured error
            return custom_response(
                status="ERROR",
                message=f"Error retrieving metadata: {str(e)}",
                data={},
                http_status=500
            )
