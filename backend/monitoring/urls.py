from django.urls import include, path
from rest_framework.routers import DefaultRouter

from monitoring.views import (
    CheckResultViewSet,
    IncidentViewSet,
    PingEndpointViewSet,
    ReportView,
    RetryPolicyViewSet,
    ServiceViewSet,
    ValidationRuleViewSet,
)

router = DefaultRouter()
router.register(r'services', ServiceViewSet, basename='service')
router.register(r'validation-rules', ValidationRuleViewSet, basename='validationrule')
router.register(r'retry-policies', RetryPolicyViewSet, basename='retrypolicy')
router.register(r'ping-endpoints', PingEndpointViewSet, basename='pingendpoint')
router.register(r'check-results', CheckResultViewSet, basename='checkresult')
router.register(r'incidents', IncidentViewSet, basename='incident')

urlpatterns = [
    path('', include(router.urls)),
    path('reports/', ReportView.as_view(), name='reports'),
]
