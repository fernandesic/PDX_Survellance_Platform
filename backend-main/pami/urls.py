from django.urls import path
from .views import PamiDataListAPIView

urlpatterns = [
    path('', PamiDataListAPIView.as_view(), name='pami-list'),
]
