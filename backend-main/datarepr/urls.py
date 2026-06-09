"""
URL configuration for datarepr project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include, re_path
from rest_framework import permissions
from drf_yasg.views import get_schema_view
from drf_yasg import openapi

from utils.chat_views import ChatQueryView, ChatStreamView, ChatHealthView, ChatWarmupView

schema_view = get_schema_view(
   openapi.Info(
      title="DataRepr Web API",
      default_version='v1',
      description="Test description",
      terms_of_service="",
      contact=openapi.Contact(email="datarepr@snippets.local"),
      license=openapi.License(name="BSD License"),
   ),
   public=True,
   permission_classes=[permissions.AllowAny],
   authentication_classes=[],
)

from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/account/', include('account.urls')),
    path('api/v1/chwfolder/', include('chwfolder.urls')),
    path('api/v1/espar/', include('espar.urls')),
    path('api/v1/readiness/', include('readiness.urls')),
    path('api/v1/stardata/', include('stardata.urls')),
    path('api/v1/ihmref/', include('ihmref.urls')),
    path('api/v1/sentinel/', include('sentinel.urls')),  # AFRO Sentinel Watchtower
    path('api/v1/hdis/', include('hdis.urls')),  # HDIS Intelligence (PRO)
    path('api/v1/supplier/', include('supplier_form.urls')),
    path('api/v1/department/', include('department_form.urls')),
    path('api/v1/sitrep/', include('sitrep_form.urls')),
    path('api/v1/arcgis/', include('arcgis_proxy.urls')),
    path('api/v1/predictions/', include('predictions.urls')),  # Outbreak Risk Predictions
    path('api/v1/verification/', include('verification.urls')),  # Intelligence Verification & Feedback Loop
    path('api/v1/onehealth/', include('onehealth.urls')),  # One Health Dashboard
    path('api/v1/pami/', include('pami.urls')),
    path('api/v1/pip/', include('pip_dashboard.urls')),
    path('api/v1/outbreak/', include('outbreak.urls')),  # Outbreak Workspace (PHEIC)
    path('api/v1/kobo/', include('kobo.urls')),  # KoboToolbox CHW Integration

    # Chat/LLM endpoints
    path('api/v1/chat/query', ChatQueryView.as_view(), name='chat-query'),
    path('api/v1/chat/stream', ChatStreamView.as_view(), name='chat-stream'),
    path('api/v1/chat/health', ChatHealthView.as_view(), name='chat-health'),
    path('api/v1/chat/warmup', ChatWarmupView.as_view(), name='chat-warmup'),
    
    #Documentation UI
    re_path(r'^swagger(?P<format>\.json|\.yaml)$', schema_view.without_ui(cache_timeout=0), name='schema-json'),
    re_path(r'^swagger/$', schema_view.with_ui('swagger', cache_timeout=0), name='schema-swagger-ui'),
    re_path(r'^redoc/$', schema_view.with_ui('redoc', cache_timeout=0), name='schema-redoc'),
]

# Serve uploaded media files (works regardless of DEBUG setting)
from django.views.static import serve as static_serve
urlpatterns += [
    re_path(r'^media/(?P<path>.*)$', static_serve, {'document_root': settings.MEDIA_ROOT}),
]
