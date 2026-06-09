"""
URL configuration for drivequick project.

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
from django.urls import path
from .views import (
    LoginView, LogoutView, SessionView, TokenRefreshView, Overview,
    NewsAPIView, AlertAPIView, AlertAcknowledgeView, AlertResolveView,
    SSOInitView, SSOCallbackView,
)

urlpatterns = [
    path('auth/login', LoginView.as_view()),
    path('auth/sso/init', SSOInitView.as_view()),         # SSO: get Azure AD auth URL
    path('auth/sso/callback', SSOCallbackView.as_view()), # SSO: Azure AD redirects here
    path('auth/logout', LogoutView.as_view()),
    path('auth/session', SessionView.as_view()),
    path('auth/token/refresh', TokenRefreshView.as_view()),
     
    path('overview', Overview.as_view()),
    path('news', NewsAPIView.as_view()),
    path('alerts', AlertAPIView.as_view()),
    path('alert/<int:id>/acknowledge', AlertAcknowledgeView.as_view()),
    path('alert/<int:id>/resolve', AlertResolveView.as_view()),
]
