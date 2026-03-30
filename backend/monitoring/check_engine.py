import logging
import time
from socket import gaierror

import requests
from django.utils import timezone

from monitoring.models import (
    CheckResult,
    CheckType,
    FailureReason,
    Incident,
    IncidentStatus,
    PingEndpoint,
    RetryPolicy,
    Service,
    ServiceStatus,
    ValidationRuleType,
)

logger = logging.getLogger(__name__)

SNIPPET_MAX_LENGTH = 500
FULL_RESPONSE_ATTR = '_full_response_body'


def perform_check(service):
    result = _execute_request(service)
    _evaluate_result(service, result)
    _handle_state_transition(service, result)
    return result


def _execute_request(service):
    start = time.time()
    try:
        response = requests.request(
            method=service.method,
            url=service.url,
            headers=service.headers or {},
            data=service.body or None,
            timeout=service.timeout_seconds,
        )
        elapsed_ms = (time.time() - start) * 1000
        response_body = response.text
        result = CheckResult.objects.create(
            service=service,
            status_code=response.status_code,
            response_time_ms=round(elapsed_ms, 2),
            response_snippet=response_body[:SNIPPET_MAX_LENGTH],
            full_response_body=response_body,
            is_successful=True,
        )
        setattr(result, FULL_RESPONSE_ATTR, response_body)
        return result
    except requests.Timeout:
        return _create_failure(
            service, start, FailureReason.TIMEOUT, 'Request timed out',
        )
    except gaierror:
        return _create_failure(
            service, start, FailureReason.DNS_FAILURE, 'DNS resolution failed',
        )
    except requests.ConnectionError as e:
        return _create_failure(
            service, start, FailureReason.CONNECTION_REFUSED, str(e),
        )
    except requests.RequestException as e:
        return _create_failure(
            service, start, FailureReason.UNKNOWN, str(e),
        )


def _create_failure(service, start_time, reason, message):
    elapsed_ms = (time.time() - start_time) * 1000
    return CheckResult.objects.create(
        service=service,
        response_time_ms=round(elapsed_ms, 2),
        is_successful=False,
        failure_reason=reason,
        error_message=message,
    )


def _evaluate_result(service, result):
    if not result.is_successful:
        return

    rules = service.validation_rules.all()
    if not rules.exists():
        if result.status_code != service.expected_status_code:
            result.is_successful = False
            result.failure_reason = FailureReason.HTTP_ERROR
            result.error_message = (
                f"Expected {service.expected_status_code}, "
                f"got {result.status_code}"
            )
            result.save()
        return

    for rule in rules:
        passed = _check_rule(rule, result)
        if not passed:
            result.is_successful = False
            result.failure_reason = FailureReason.VALIDATION_MISMATCH
            result.error_message = (
                f"Rule failed: {rule.type} '{rule.value}'"
            )
            result.save()
            return


def _check_rule(rule, result):
    response_body = getattr(
        result, FULL_RESPONSE_ATTR, result.response_snippet or '',
    )

    if rule.type == ValidationRuleType.STATUS_CODE:
        match = str(result.status_code) == rule.value
        return match == rule.expected
    if rule.type == ValidationRuleType.CONTAINS:
        match = rule.value in response_body
        return match == rule.expected
    if rule.type == ValidationRuleType.NOT_CONTAINS:
        match = rule.value not in response_body
        return match == rule.expected
    return True


def perform_check_with_retries(service):
    result = perform_check(service)
    if result.is_successful:
        return result

    try:
        policy = service.retry_policy
    except RetryPolicy.DoesNotExist:
        return result

    if not policy.enabled:
        return result

    for attempt in range(policy.max_retries):
        time.sleep(policy.retry_interval_seconds)
        result = perform_check(service)
        if result.is_successful:
            return result

    _run_network_checks(service, result)
    return result


def _run_network_checks(service, result):
    endpoints = PingEndpoint.objects.filter(enabled=True)
    if not endpoints.exists():
        return

    statuses = []
    for ep in endpoints:
        try:
            r = requests.get(ep.url, timeout=5)
            statuses.append(f"{ep.url}: OK ({r.status_code})")
        except Exception:
            statuses.append(f"{ep.url}: UNREACHABLE")

    result.network_status = '\n'.join(statuses)
    result.save()


def _handle_state_transition(service, result):
    previous_status = service.status

    if result.is_successful:
        service.status = ServiceStatus.UP
        service.save()

        if previous_status == ServiceStatus.DOWN:
            _close_active_incident(service)
            _trigger_recovery_notification(service)
    else:
        service.status = ServiceStatus.DOWN
        service.save()

        if previous_status != ServiceStatus.DOWN:
            _open_incident(service, result)
            _trigger_down_notification(service, result)


def _open_incident(service, result):
    Incident.objects.create(
        service=service,
        auto_reason=result.error_message,
        status=IncidentStatus.OPEN,
    )


def _close_active_incident(service):
    active = Incident.objects.filter(
        service=service, is_resolved=False,
    ).first()
    if active:
        now = timezone.now()
        active.resolved_at = now
        active.is_resolved = True
        active.status = IncidentStatus.RESOLVED
        active.duration = now - active.started_at
        active.save()


def _trigger_down_notification(service, result):
    try:
        from notifications.email_service import send_notification
        from notifications.models import EventType
        send_notification(service, EventType.DOWN, check_result=result)
    except Exception as e:
        logger.error("Failed to trigger DOWN notification: %s", e)


def _trigger_recovery_notification(service):
    try:
        from notifications.email_service import send_notification
        from notifications.models import EventType
        incident = Incident.objects.filter(
            service=service, is_resolved=True,
        ).order_by('-resolved_at').first()
        duration = incident.duration if incident else None
        send_notification(
            service, EventType.RECOVERY, downtime_duration=duration,
        )
    except Exception as e:
        logger.error("Failed to trigger RECOVERY notification: %s", e)
