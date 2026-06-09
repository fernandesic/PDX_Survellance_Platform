"""
KoboToolbox URL Configuration

Webhook is secured by secret URL token:
  /api/v1/kobo/webhook/<KOBO_WEBHOOK_SECRET>/
"""

from django.urls import path

from kobo.views import KoboWebhookView

app_name = 'kobo'

urlpatterns = [
    path(
        'webhook/<str:secret>/',
        KoboWebhookView.as_view(),
        name='webhook',
    ),
]
