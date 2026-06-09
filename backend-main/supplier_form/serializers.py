from rest_framework import serializers
from .models import SupplierForm, FormLink

class FormLinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = FormLink
        fields = ['token', 'target_email', 'is_active', 'expires_at']

class SupplierFormSerializer(serializers.ModelSerializer):
    access_link = FormLinkSerializer(read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = SupplierForm
        fields = [
            'id', 'serial_no', 'status', 'status_display', 'invoice_no', 'supplier_name', 
            'po_number', 'contract_date', 'commodity_type', 'report_date',
            'contract_value_currency', 'contract_value_amount', 'designated_program',
            'initiator_email', 'section_1_email', 'section_2_email', 'section_3_email', 'supervisor_email',
            'section_1_data', 'section_1_signature',
            'section_2_data', 'section_2_signature',
            'section_3_data', 'section_3_signature',
            'supervisor_data', 'supervisor_signature',
            'created_at', 'updated_at', 'access_link'
        ]
