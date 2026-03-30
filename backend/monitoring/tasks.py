import logging

from celery import shared_task

from monitoring.check_engine import perform_check_with_retries
from monitoring.models import Service

logger = logging.getLogger(__name__)


@shared_task
def run_service_check(service_id):
    try:
        service = Service.objects.get(id=service_id, is_active=True)
    except Service.DoesNotExist:
        logger.warning("Service %s not found or inactive", service_id)
        return

    result = perform_check_with_retries(service)
    logger.info(
        "Check for %s: %s",
        service.name,
        'OK' if result.is_successful else 'FAIL',
    )


@shared_task
def run_all_checks():
    services = Service.objects.filter(is_active=True)
    for service in services:
        run_service_check.delay(service.id)
