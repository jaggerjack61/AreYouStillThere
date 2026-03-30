import logging
from datetime import timedelta

from django.core.mail import EmailMessage
from django.core.mail.backends.smtp import EmailBackend
from django.template.loader import render_to_string
from django.utils import timezone

from notifications.models import (
    EventType,
    NotificationLog,
    NotificationPolicy,
    NotificationStatus,
    SMTPConfig,
)

logger = logging.getLogger(__name__)

DOWN_SUBJECT = '[ALERT] Service Down: {service_name}'
RECOVERY_SUBJECT = '[RECOVERY] Service Restored: {service_name}'
RETRY_FAILURE_SUBJECT = '[WARNING] Retry Failure: {service_name}'


def get_smtp_backend():
    config = SMTPConfig.objects.filter(enabled=True).first()
    if not config:
        return None, None
    backend = EmailBackend(
        host=config.host,
        port=config.port,
        username=config.username,
        password=config.password,
        use_tls=config.use_tls,
        use_ssl=config.use_ssl,
        fail_silently=False,
    )
    return backend, config


def is_within_cooldown(service, cooldown_seconds):
    cutoff = timezone.now() - timedelta(seconds=cooldown_seconds)
    return NotificationLog.objects.filter(
        service=service,
        timestamp__gte=cutoff,
        status=NotificationStatus.SENT,
    ).exists()


def build_down_content(service, check_result=None):
    context = {
        'service_name': service.name,
        'timestamp': timezone.now().isoformat(),
        'failure_reason': '',
        'status_code': 'N/A',
        'response_time': 'N/A',
    }
    if check_result:
        context['failure_reason'] = check_result.error_message
        context['status_code'] = check_result.status_code or 'N/A'
        context['response_time'] = check_result.response_time_ms or 'N/A'

    subject = DOWN_SUBJECT.format(service_name=service.name)
    body = (
        f"Service: {context['service_name']}\n"
        f"Status: DOWN\n"
        f"Time: {context['timestamp']}\n\n"
        f"Reason:\n{context['failure_reason']}\n\n"
        f"Last Response Code: {context['status_code']}\n"
        f"Response Time: {context['response_time']} ms\n\n"
        f"---\nMonitoring System"
    )
    return subject, body


def build_recovery_content(service, downtime_duration=None):
    subject = RECOVERY_SUBJECT.format(service_name=service.name)
    duration_str = str(downtime_duration) if downtime_duration else 'Unknown'
    body = (
        f"Service: {service.name}\n"
        f"Status: UP\n"
        f"Recovered At: {timezone.now().isoformat()}\n\n"
        f"Downtime Duration: {duration_str}\n\n"
        f"---\nMonitoring System"
    )
    return subject, body


def build_retry_failure_content(service, check_result=None):
    subject = RETRY_FAILURE_SUBJECT.format(service_name=service.name)
    error = check_result.error_message if check_result else ''
    body = (
        f"Service: {service.name}\n"
        f"Status: RETRY FAILURE\n"
        f"Time: {timezone.now().isoformat()}\n\n"
        f"Error:\n{error}\n\n"
        f"---\nMonitoring System"
    )
    return subject, body


CONTENT_BUILDERS = {
    EventType.DOWN: build_down_content,
    EventType.RECOVERY: build_recovery_content,
    EventType.RETRY_FAILURE: build_retry_failure_content,
}


def send_notification(service, event_type, check_result=None,
                      downtime_duration=None):
    try:
        policy = NotificationPolicy.objects.get(service=service)
    except NotificationPolicy.DoesNotExist:
        return

    if not policy.email_enabled:
        return

    if not _should_notify(policy, event_type):
        return

    if is_within_cooldown(service, policy.cooldown_seconds):
        logger.info("Notification throttled for %s", service.name)
        return

    recipients = policy.recipient_emails
    if not recipients:
        return

    backend, smtp_config = get_smtp_backend()
    if not backend or not smtp_config:
        logger.warning("No SMTP config available")
        return

    builder = CONTENT_BUILDERS.get(event_type)
    if not builder:
        return

    kwargs = {}
    if event_type == EventType.RECOVERY:
        kwargs['downtime_duration'] = downtime_duration
    else:
        kwargs['check_result'] = check_result

    subject, body = builder(service, **kwargs)

    try:
        email = EmailMessage(
            subject=subject,
            body=body,
            from_email=smtp_config.from_email,
            to=recipients,
            connection=backend,
        )
        email.send(fail_silently=False)
        NotificationLog.objects.create(
            service=service,
            event_type=event_type,
            recipients=recipients,
            status=NotificationStatus.SENT,
        )
        logger.info("Notification sent for %s: %s", service.name, event_type)
    except Exception as e:
        NotificationLog.objects.create(
            service=service,
            event_type=event_type,
            recipients=recipients,
            status=NotificationStatus.FAILED,
            error_message=str(e),
        )
        logger.error(
            "Failed to send notification for %s: %s", service.name, str(e)
        )


def _should_notify(policy, event_type):
    mapping = {
        EventType.DOWN: policy.notify_on_down,
        EventType.RECOVERY: policy.notify_on_recovery,
        EventType.RETRY_FAILURE: policy.notify_on_retry_failure,
    }
    return mapping.get(event_type, False)
