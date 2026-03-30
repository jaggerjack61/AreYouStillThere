from django.db.models import F
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from monitoring.models import CheckResult, Service
from monitoring.scheduling import (
    delete_service_periodic_task,
    sync_service_periodic_task,
)


@receiver(post_save, sender=Service)
def sync_periodic_task_for_service(sender, instance, **kwargs):
    sync_service_periodic_task(instance)


@receiver(post_save, sender=CheckResult)
def trim_service_log_for_check_result(sender, instance, created, **kwargs):
    if created:
        updates = {
            'total_check_count': F('total_check_count') + 1,
        }
        if instance.is_successful:
            updates['successful_check_count'] = F('successful_check_count') + 1
        else:
            updates['failed_check_count'] = F('failed_check_count') + 1

        Service.objects.filter(pk=instance.service_id).update(**updates)
        instance.service.trim_check_results()


@receiver(post_delete, sender=Service)
def delete_periodic_task_for_service(sender, instance, **kwargs):
    delete_service_periodic_task(instance.pk)