from django.urls import path
from .views import (
    SupplierFormListView, 
    GenerateSupplierLinkView, 
    ReactivateSupplierLinkView, 
    ValidateSupplierTokenView,
    SubmitSectionView,
    ReverseSectionView,
    DeleteSupplierFormView,
    WorkflowConfigView
)

urlpatterns = [
    path('forms/', SupplierFormListView.as_view(), name='supplier-form-list'),
    path('generate-link/', GenerateSupplierLinkView.as_view(), name='generate-supplier-link'),
    path('reactivate-link/<int:pk>/', ReactivateSupplierLinkView.as_view(), name='reactivate-supplier-link'),
    path('validate-token/<uuid:token>/', ValidateSupplierTokenView.as_view(), name='validate-supplier-token'),
    path('submit-section/<uuid:token>/', SubmitSectionView.as_view(), name='submit-supplier-section'),
    path('reverse-section/<uuid:token>/', ReverseSectionView.as_view(), name='reverse-supplier-section'),
    path('delete-form/<int:pk>/', DeleteSupplierFormView.as_view(), name='delete-supplier-form'),
    path('workflow-config/', WorkflowConfigView.as_view(), name='workflow-config'),
]
