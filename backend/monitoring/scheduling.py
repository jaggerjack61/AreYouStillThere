import json

from django_celery_beat.models import IntervalSchedule, PeriodicTask


TASK_NAME_PREFIX = 'service-check'
TASK_PATH = 'monitoring.tasks.run_service_check'


def build_service_task_name(service_id):
    return f'{TASK_NAME_PREFIX}-{service_id}'


def sync_service_periodic_task(service):
    schedule = get_interval_schedule(service.check_interval_seconds)
    PeriodicTask.objects.update_or_create(
        name=build_service_task_name(service.pk),
        defaults={
            'task': TASK_PATH,
            'interval': schedule,
            'args': json.dumps([service.pk]),
            'enabled': service.is_active,
            'description': f'Periodic health check for {service.name}',
        },
    )


def delete_service_periodic_task(service_id):
    PeriodicTask.objects.filter(name=build_service_task_name(service_id)).delete()


def get_interval_schedule(interval_seconds):
    normalized_seconds = max(1, int(interval_seconds))
    schedule, _ = IntervalSchedule.objects.get_or_create(
        every=normalized_seconds,
        period=IntervalSchedule.SECONDS,
    )
    return schedule