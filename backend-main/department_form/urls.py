from django.urls import path
from .views import (
    DepartmentFormListView, 
    GenerateDepartmentLinkView, 
    ReactivateDepartmentLinkView, 
    ValidateDepartmentTokenView,
    SubmitSectionView,
    ReverseSectionView,
    DeleteDepartmentFormView,
    WorkflowConfigView
)

urlpatterns = [
    path('forms/', DepartmentFormListView.as_view(), name='department-form-list'),
    path('generate-link/', GenerateDepartmentLinkView.as_view(), name='generate-department-link'),
    path('reactivate-link/<int:pk>/', ReactivateDepartmentLinkView.as_view(), name='reactivate-department-link'),
    path('validate-token/<uuid:token>/', ValidateDepartmentTokenView.as_view(), name='validate-department-token'),
    path('submit-section/<uuid:token>/', SubmitSectionView.as_view(), name='submit-department-section'),
    path('reverse-section/<uuid:token>/', ReverseSectionView.as_view(), name='reverse-department-section'),
    path('delete-form/<int:pk>/', DeleteDepartmentFormView.as_view(), name='delete-department-form'),
    path('workflow-config/', WorkflowConfigView.as_view(), name='workflow-config'),
]
