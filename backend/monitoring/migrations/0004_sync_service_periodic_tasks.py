import json

from django.db import migrations


def sync_service_periodic_tasks(apps, schema_editor):
    Service = apps.get_model('monitoring', 'Service')
    IntervalSchedule = apps.get_model('django_celery_beat', 'IntervalSchedule')
    PeriodicTask = apps.get_model('django_celery_beat', 'PeriodicTask')

    for service in Service.objects.all():
        interval, _ = IntervalSchedule.objects.get_or_create(
            every=max(1, int(service.check_interval_seconds)),
            period='seconds',
        )
        PeriodicTask.objects.update_or_create(
            name=f'service-check-{service.pk}',
            defaults={
                'task': 'monitoring.tasks.run_service_check',
                'interval': interval,
                'args': json.dumps([service.pk]),
                'enabled': service.is_active,
                'description': f'Periodic health check for {service.name}',
            },
        )


class Migration(migrations.Migration):

    dependencies = [
        ('django_celery_beat', '0019_alter_periodictasks_options'),
        ('monitoring', '0003_pingendpoint_checkresult_failure_reason_and_more'),
    ]

    operations = [
        migrations.RunPython(sync_service_periodic_tasks, migrations.RunPython.noop),
    ]