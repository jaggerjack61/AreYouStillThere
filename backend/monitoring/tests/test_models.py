from django.test import TestCase
from django_celery_beat.models import IntervalSchedule, PeriodicTask

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
    ValidationRule,
    ValidationRuleType,
)


class ServiceModelTest(TestCase):
    def test_create_service(self):
        service = Service.objects.create(
            name='Test Service', url='https://example.com',
        )
        self.assertEqual(service.name, 'Test Service')
        self.assertEqual(service.status, ServiceStatus.UNKNOWN)
        self.assertTrue(service.is_active)
        self.assertEqual(service.method, 'GET')
        self.assertEqual(service.check_type, CheckType.API)

    def test_service_str(self):
        service = Service.objects.create(
            name='My API', url='https://api.example.com',
        )
        self.assertEqual(str(service), 'My API')

    def test_service_defaults(self):
        service = Service.objects.create(
            name='Defaults', url='https://example.com',
        )
        self.assertEqual(service.timeout_seconds, 10)
        self.assertEqual(service.check_interval_seconds, 60)
        self.assertEqual(service.max_retries, 3)
        self.assertEqual(service.log_retention_limit, 100)
        self.assertEqual(service.total_check_count, 0)
        self.assertEqual(service.successful_check_count, 0)
        self.assertEqual(service.failed_check_count, 0)
        self.assertEqual(service.headers, {})
        self.assertEqual(service.body, '')

    def test_active_service_creates_periodic_task(self):
        service = Service.objects.create(
            name='Scheduled',
            url='https://example.com/health',
            check_interval_seconds=120,
        )

        task = PeriodicTask.objects.get(name=f'service-check-{service.pk}')

        self.assertEqual(task.task, 'monitoring.tasks.run_service_check')
        self.assertTrue(task.enabled)
        self.assertEqual(task.args, f'[{service.pk}]')
        self.assertEqual(task.interval.every, 120)
        self.assertEqual(task.interval.period, IntervalSchedule.SECONDS)

    def test_updating_interval_updates_periodic_task(self):
        service = Service.objects.create(
            name='Scheduled',
            url='https://example.com/health',
            check_interval_seconds=60,
        )

        service.check_interval_seconds = 300
        service.save()

        task = PeriodicTask.objects.get(name=f'service-check-{service.pk}')
        self.assertEqual(task.interval.every, 300)
        self.assertEqual(task.interval.period, IntervalSchedule.SECONDS)

    def test_inactive_service_disables_periodic_task(self):
        service = Service.objects.create(
            name='Scheduled',
            url='https://example.com/health',
        )

        service.is_active = False
        service.save()

        task = PeriodicTask.objects.get(name=f'service-check-{service.pk}')
        self.assertFalse(task.enabled)

    def test_deleting_service_removes_periodic_task(self):
        service = Service.objects.create(
            name='Scheduled',
            url='https://example.com/health',
        )

        service.delete()

        self.assertFalse(
            PeriodicTask.objects.filter(name=f'service-check-{service.pk}').exists()
        )


class ValidationRuleModelTest(TestCase):
    def setUp(self):
        self.service = Service.objects.create(
            name='Test', url='https://example.com',
        )

    def test_create_rule(self):
        rule = ValidationRule.objects.create(
            service=self.service,
            type=ValidationRuleType.CONTAINS,
            value='welcome',
        )
        self.assertTrue(rule.expected)

    def test_str(self):
        rule = ValidationRule.objects.create(
            service=self.service,
            type=ValidationRuleType.STATUS_CODE,
            value='200',
        )
        self.assertIn('STATUS_CODE', str(rule))


class RetryPolicyModelTest(TestCase):
    def test_create_policy(self):
        service = Service.objects.create(
            name='Test', url='https://example.com',
        )
        policy = RetryPolicy.objects.create(
            service=service, max_retries=5, retry_interval_seconds=15,
        )
        self.assertTrue(policy.enabled)
        self.assertEqual(policy.max_retries, 5)


class PingEndpointModelTest(TestCase):
    def test_create_endpoint(self):
        ep = PingEndpoint.objects.create(url='https://google.com')
        self.assertTrue(ep.enabled)
        self.assertEqual(str(ep), 'https://google.com')


class CheckResultModelTest(TestCase):
    def setUp(self):
        self.service = Service.objects.create(
            name='Test', url='https://example.com',
        )

    def test_create_check_result(self):
        result = CheckResult.objects.create(
            service=self.service,
            status_code=200,
            response_time_ms=150.5,
            is_successful=True,
        )
        self.assertTrue(result.is_successful)

    def test_failure_reason(self):
        result = CheckResult.objects.create(
            service=self.service,
            is_successful=False,
            failure_reason=FailureReason.TIMEOUT,
        )
        self.assertEqual(result.failure_reason, FailureReason.TIMEOUT)

    def test_ordering(self):
        CheckResult.objects.create(
            service=self.service, is_successful=True,
        )
        r2 = CheckResult.objects.create(
            service=self.service, is_successful=False,
        )
        results = list(CheckResult.objects.all())
        self.assertEqual(results[0], r2)

    def test_service_log_keeps_last_n_requests(self):
        service = Service.objects.create(
            name='Trimmed',
            url='https://trim.example.com',
            log_retention_limit=2,
        )

        first = CheckResult.objects.create(service=service, is_successful=True)
        second = CheckResult.objects.create(service=service, is_successful=False)
        third = CheckResult.objects.create(service=service, is_successful=True)

        retained_ids = list(
            CheckResult.objects.filter(service=service)
            .order_by('-checked_at', '-id')
            .values_list('id', flat=True)
        )

        self.assertEqual(retained_ids, [third.id, second.id])
        self.assertFalse(CheckResult.objects.filter(id=first.id).exists())

    def test_service_check_counters_increment_on_new_results(self):
        CheckResult.objects.create(
            service=self.service,
            is_successful=True,
        )
        CheckResult.objects.create(
            service=self.service,
            is_successful=False,
        )

        self.service.refresh_from_db()

        self.assertEqual(self.service.total_check_count, 2)
        self.assertEqual(self.service.successful_check_count, 1)
        self.assertEqual(self.service.failed_check_count, 1)


class IncidentModelTest(TestCase):
    def setUp(self):
        self.service = Service.objects.create(
            name='Test', url='https://example.com',
        )

    def test_create_incident(self):
        incident = Incident.objects.create(service=self.service)
        self.assertFalse(incident.is_resolved)
        self.assertEqual(incident.status, IncidentStatus.OPEN)

    def test_incident_str(self):
        incident = Incident.objects.create(service=self.service)
        self.assertIn('Active', str(incident))

    def test_user_reason(self):
        incident = Incident.objects.create(
            service=self.service, user_reason='Server maintenance',
        )
        self.assertEqual(incident.user_reason, 'Server maintenance')
