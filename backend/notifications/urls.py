from django.urls import include, path
from rest_framework.routers import DefaultRouter

from notifications.views import (
    NotificationLogViewSet,
    NotificationPolicyViewSet,
    SMTPConfigViewSet,
)

router = DefaultRouter()
router.register(r'smtp-config', SMTPConfigViewSet, basename='smtpconfig')
router.register(
    r'policies', NotificationPolicyViewSet, basename='notificationpolicy'
)
router.register(r'logs', NotificationLogViewSet, basename='notificationlog')

urlpatterns = [
    path('', include(router.urls)),
]
