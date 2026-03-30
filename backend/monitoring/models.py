from django.core.validators import MinValueValidator
from django.db import models


class ServiceStatus(models.TextChoices):
    UP = 'UP', 'Up'
    DOWN = 'DOWN', 'Down'
    DEGRADED = 'DEGRADED', 'Degraded'
    UNKNOWN = 'UNKNOWN', 'Unknown'


class CheckType(models.TextChoices):
    API = 'API', 'API (structured response)'
    CONTENT = 'CONTENT', 'Content (string matching)'


class Service(models.Model):
    name = models.CharField(max_length=255)
    url = models.URLField()
    method = models.CharField(max_length=10, default='GET')
    headers = models.JSONField(default=dict, blank=True)
    body = models.TextField(blank=True, default='')
    check_type = models.CharField(
        max_length=10, choices=CheckType.choices, default=CheckType.API,
    )
    expected_status_code = models.IntegerField(default=200)
    timeout_seconds = models.IntegerField(default=10)
    check_interval_seconds = models.IntegerField(default=60)
    max_retries = models.IntegerField(default=3)
    log_retention_limit = models.PositiveIntegerField(
        default=100,
        validators=[MinValueValidator(1)],
    )
    total_check_count = models.PositiveIntegerField(default=0)
    successful_check_count = models.PositiveIntegerField(default=0)
    failed_check_count = models.PositiveIntegerField(default=0)
    status = models.CharField(
        max_length=10,
        choices=ServiceStatus.choices,
        default=ServiceStatus.UNKNOWN,
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = 'services'
        ordering = ['name']

    def __str__(self):
        return self.name

    def trim_check_results(self):
        retained_ids = list(
            self.check_results.order_by('-checked_at', '-id').values_list(
                'id', flat=True,
            )[:self.log_retention_limit]
        )
        if not retained_ids:
            return

        self.check_results.exclude(id__in=retained_ids).delete()


class ValidationRuleType(models.TextChoices):
    CONTAINS = 'CONTAINS', 'Contains'
    NOT_CONTAINS = 'NOT_CONTAINS', 'Not Contains'
    STATUS_CODE = 'STATUS_CODE', 'Status Code'


class ValidationRule(models.Model):
    service = models.ForeignKey(
        Service, on_delete=models.CASCADE, related_name='validation_rules',
    )
    type = models.CharField(
        max_length=20, choices=ValidationRuleType.choices,
    )
    value = models.CharField(max_length=500)
    expected = models.BooleanField(default=True)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f"{self.service.name}: {self.type} '{self.value}'"


class RetryPolicy(models.Model):
    service = models.OneToOneField(
        Service, on_delete=models.CASCADE, related_name='retry_policy',
    )
    enabled = models.BooleanField(default=True)
    max_retries = models.IntegerField(default=3)
    retry_interval_seconds = models.IntegerField(default=10)

    class Meta:
        verbose_name_plural = 'retry policies'
        ordering = ['service__name']

    def __str__(self):
        return f"Retry policy for {self.service.name}"


class PingEndpoint(models.Model):
    url = models.URLField()
    enabled = models.BooleanField(default=True)

    class Meta:
        ordering = ['url']

    def __str__(self):
        return self.url


class FailureReason(models.TextChoices):
    TIMEOUT = 'TIMEOUT', 'Timeout'
    DNS_FAILURE = 'DNS_FAILURE', 'DNS Failure'
    CONNECTION_REFUSED = 'CONNECTION_REFUSED', 'Connection Refused'
    HTTP_ERROR = 'HTTP_ERROR', 'HTTP Error'
    VALIDATION_MISMATCH = 'VALIDATION_MISMATCH', 'Validation Mismatch'
    UNKNOWN = 'UNKNOWN', 'Unknown'


class CheckResult(models.Model):
    service = models.ForeignKey(
        Service, on_delete=models.CASCADE, related_name='check_results',
    )
    status_code = models.IntegerField(null=True, blank=True)
    response_time_ms = models.FloatField(null=True, blank=True)
    is_successful = models.BooleanField(default=False)
    error_message = models.TextField(blank=True, default='')
    response_snippet = models.TextField(blank=True, default='')
    full_response_body = models.TextField(blank=True, default='')
    failure_reason = models.CharField(
        max_length=30,
        choices=FailureReason.choices,
        blank=True,
        default='',
    )
    network_status = models.TextField(blank=True, default='')
    checked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-checked_at']
        indexes = [
            models.Index(
                fields=['service', '-checked_at'],
                name='idx_check_svc_time',
            ),
        ]

    def __str__(self):
        status = 'OK' if self.is_successful else 'FAIL'
        return f"{self.service.name} - {status} at {self.checked_at}"


class IncidentStatus(models.TextChoices):
    OPEN = 'OPEN', 'Open'
    RESOLVED = 'RESOLVED', 'Resolved'


class Incident(models.Model):
    service = models.ForeignKey(
        Service, on_delete=models.CASCADE, related_name='incidents',
    )
    started_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    is_resolved = models.BooleanField(default=False)
    status = models.CharField(
        max_length=10,
        choices=IncidentStatus.choices,
        default=IncidentStatus.OPEN,
    )
    auto_reason = models.TextField(blank=True, default='')
    user_reason = models.TextField(blank=True, default='')
    duration = models.DurationField(null=True, blank=True)

    class Meta:
        ordering = ['-started_at']
        indexes = [
            models.Index(
                fields=['service', 'is_resolved', '-started_at'],
                name='idx_inc_svc_resolved',
            ),
        ]

    def __str__(self):
        state = 'Resolved' if self.is_resolved else 'Active'
        return f"{self.service.name} - {state}"
