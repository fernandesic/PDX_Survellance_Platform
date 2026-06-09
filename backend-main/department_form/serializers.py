from rest_framework import serializers
from .models import DepartmentForm, FormLink

class DepartmentFormSerializer(serializers.ModelSerializer):
    status_display = serializers.SerializerMethodField()
    access_link = serializers.SerializerMethodField()

    class Meta:
        model = DepartmentForm
        fields = [
            'id', 'serial_no', 'status', 'status_display',
            'invoice_no', 'department_name', 'po_number',
            'contract_date', 'commodity_type', 'report_date',
            'contract_value_currency', 'contract_value_amount',
            'designated_program', 'initiator_email',
            'section_1_email', 'section_2_email',
            'section_3_email', 'supervisor_email',
            'section_1_data', 'section_1_signature',
            'section_2_data', 'section_2_signature',
            'section_3_data', 'section_3_signature',
            'supervisor_data', 'supervisor_signature',
            'access_link', 'created_at', 'updated_at',
        ]

    def get_status_display(self, obj):
        return obj.get_status_display()
        
    def get_access_link(self, obj):
        if hasattr(obj, 'access_link') and obj.access_link:
            return {
                'token': str(obj.access_link.token),
                'is_active': obj.access_link.is_active,
                'target_email': obj.access_link.target_email,
                'expires_at': obj.access_link.expires_at
            }
        return None

class FormLinkSerializer(serializers.ModelSerializer):
    form_serial = serializers.CharField(source='form.serial_no', read_only=True)
    form_status = serializers.CharField(source='form.get_status_display', read_only=True)

    class Meta:
        model = FormLink
        fields = ['token', 'target_email', 'is_active', 'expires_at', 'form_serial', 'form_status']
