from django.contrib import admin

from monitoring.models import (
    CheckResult,
    Incident,
    PingEndpoint,
    RetryPolicy,
    Service,
    ValidationRule,
)


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ['name', 'url', 'status', 'check_type', 'is_active']
    list_filter = ['status', 'is_active', 'check_type']


@admin.register(ValidationRule)
class ValidationRuleAdmin(admin.ModelAdmin):
    list_display = ['service', 'type', 'value', 'expected']


@admin.register(RetryPolicy)
class RetryPolicyAdmin(admin.ModelAdmin):
    list_display = ['service', 'enabled', 'max_retries']


@admin.register(PingEndpoint)
class PingEndpointAdmin(admin.ModelAdmin):
    list_display = ['url', 'enabled']


@admin.register(CheckResult)
class CheckResultAdmin(admin.ModelAdmin):
    list_display = [
        'service', 'is_successful', 'status_code',
        'failure_reason', 'checked_at',
    ]
    list_filter = ['is_successful', 'failure_reason']


@admin.register(Incident)
class IncidentAdmin(admin.ModelAdmin):
    list_display = ['service', 'started_at', 'status', 'is_resolved']
    list_filter = ['status', 'is_resolved']
