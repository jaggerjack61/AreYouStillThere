from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.models import User
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from monitoring.models import (
    CheckResult,
    Incident,
    IncidentStatus,
    PingEndpoint,
    RetryPolicy,
    Service,
    ValidationRule,
    ValidationRuleType,
)


class AuthMixin:
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser', password='testpass123',
        )
        self.client.force_authenticate(user=self.user)


class RegisterAPITest(APITestCase):
    def test_register_user(self):
        data = {
            'username': 'newuser',
            'email': 'new@test.com',
            'password': 'strongpass1',
        }
        response = self.client.post(reverse('register'), data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(username='newuser').exists())

    def test_token_obtain(self):
        User.objects.create_user(
            username='tokenuser', password='testpass123',
        )
        response = self.client.post(reverse('token_obtain_pair'), {
            'username': 'tokenuser', 'password': 'testpass123',
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)


class ServiceAPITest(AuthMixin, APITestCase):
    def setUp(self):
        super().setUp()
        self.service = Service.objects.create(
            name='Test API', url='https://api.example.com',
        )
        Service.objects.filter(pk=self.service.pk).update(
            created_at=timezone.now() - timedelta(days=7),
        )
        self.service.refresh_from_db()

    def test_list_services(self):
        response = self.client.get(reverse('service-list'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_service(self):
        data = {
            'name': 'New Service',
            'url': 'https://new.example.com',
            'log_retention_limit': 25,
        }
        response = self.client.post(reverse('service-list'), data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['log_retention_limit'], 25)

    def test_retrieve_service(self):
        response = self.client.get(
            reverse('service-detail', args=[self.service.pk]),
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], 'Test API')

    def test_update_service(self):
        data = {
            'name': 'Updated',
            'url': 'https://updated.example.com',
            'log_retention_limit': 10,
        }
        response = self.client.put(
            reverse('service-detail', args=[self.service.pk]), data,
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['log_retention_limit'], 10)

    def test_delete_service(self):
        response = self.client.delete(
            reverse('service-detail', args=[self.service.pk]),
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_service_stats(self):
        response = self.client.get(
            reverse('service-stats', args=[self.service.pk]),
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('uptime_24h', response.data)

    def test_stats_uptime_derived_from_incidents_not_checks(self):
        now = timezone.now()
        half_day_ago = now - timedelta(hours=12)

        inc = Incident.objects.create(
            service=self.service,
            is_resolved=False,
            status=IncidentStatus.OPEN,
        )
        Incident.objects.filter(pk=inc.pk).update(
            started_at=half_day_ago,
        )

        response = self.client.get(
            reverse('service-stats', args=[self.service.pk]),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        uptime = response.data['uptime_24h']
        self.assertLess(uptime, 60.0)
        self.assertGreater(uptime, 40.0)

    def test_bulk_stats_returns_stats_for_all_services(self):
        other = Service.objects.create(
            name='Other API', url='https://other.example.com',
        )

        response = self.client.get(reverse('service-bulk-stats'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = [entry['service_id'] for entry in response.data]
        self.assertIn(self.service.pk, ids)
        self.assertIn(other.pk, ids)
        for entry in response.data:
            self.assertIn('uptime_24h', entry)
            self.assertIn('avg_response_time_24h', entry)

    def test_unauthenticated_denied(self):
        self.client.force_authenticate(user=None)
        response = self.client.get(reverse('service-list'))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class ValidationRuleAPITest(AuthMixin, APITestCase):
    def setUp(self):
        super().setUp()
        self.service = Service.objects.create(
            name='RuleSvc', url='https://example.com',
        )

    def test_create_rule(self):
        data = {
            'service': self.service.pk,
            'type': ValidationRuleType.CONTAINS,
            'value': 'OK',
            'expected': True,
        }
        response = self.client.post(
            reverse('validationrule-list'), data, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_list_rules_filtered(self):
        ValidationRule.objects.create(
            service=self.service,
            type=ValidationRuleType.CONTAINS,
            value='test',
        )
        response = self.client.get(
            reverse('validationrule-list'),
            {'service': self.service.pk},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class RetryPolicyAPITest(AuthMixin, APITestCase):
    def test_create_retry_policy(self):
        service = Service.objects.create(
            name='RetrySvc', url='https://example.com',
        )
        data = {
            'service': service.pk,
            'enabled': True,
            'max_retries': 5,
            'retry_interval_seconds': 10,
        }
        response = self.client.post(
            reverse('retrypolicy-list'), data, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)


class PingEndpointAPITest(AuthMixin, APITestCase):
    def test_create_ping_endpoint(self):
        data = {'url': 'https://google.com', 'enabled': True}
        response = self.client.post(
            reverse('pingendpoint-list'), data, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)


class CheckResultAPITest(AuthMixin, APITestCase):
    def setUp(self):
        super().setUp()
        self.service = Service.objects.create(
            name='Test', url='https://example.com',
        )
        self.result = CheckResult.objects.create(
            service=self.service,
            status_code=200,
            response_time_ms=123.4,
            response_snippet='{"status":"ok"}',
            full_response_body='{"status":"ok","meta":{"region":"eu-west-1"}}',
            error_message='',
            failure_reason='',
            network_status='edge: OK (200)',
            is_successful=True,
        )

    def test_list_check_results(self):
        response = self.client.get(reverse('checkresult-list'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_check_results_are_paginated_in_50_record_chunks(self):
        for index in range(54):
            CheckResult.objects.create(
                service=self.service,
                status_code=200,
                response_time_ms=10 + index,
                response_snippet=f'log-{index}',
                is_successful=True,
            )

        response = self.client.get(reverse('checkresult-list'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 55)
        self.assertEqual(len(response.data['results']), 50)
        self.assertIsNotNone(response.data['next'])

    def test_check_results_support_result_search_and_ordering_filters(self):
        other_service = Service.objects.create(
            name='Other API',
            url='https://other.example.com',
        )
        CheckResult.objects.create(
            service=self.service,
            status_code=503,
            response_time_ms=400,
            response_snippet='gateway timeout from upstream',
            error_message='Gateway timeout',
            failure_reason='HTTP_ERROR',
            network_status='edge: OK (200)',
            is_successful=False,
        )
        CheckResult.objects.create(
            service=other_service,
            status_code=500,
            response_time_ms=250,
            response_snippet='gateway timeout from upstream',
            error_message='Gateway timeout',
            failure_reason='HTTP_ERROR',
            network_status='edge: OK (200)',
            is_successful=False,
        )

        response = self.client.get(reverse('checkresult-list'), {
            'result': 'FAILURE',
            'search': 'timeout',
            'ordering': 'status_code',
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.data['results']
        self.assertEqual([item['status_code'] for item in payload], [500, 503])
        self.assertTrue(all(item['is_successful'] is False for item in payload))

    def test_check_result_list_includes_request_log_details(self):
        response = self.client.get(reverse('checkresult-list'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        payload = response.data['results'] if 'results' in response.data else response.data
        result = payload[0]

        self.assertEqual(result['status_code'], 200)
        self.assertEqual(result['response_time_ms'], 123.4)
        self.assertEqual(result['response_snippet'], '{"status":"ok"}')
        self.assertEqual(result['network_status'], 'edge: OK (200)')
        self.assertNotIn('full_response_body', result)

    def test_retrieve_check_result_includes_full_response_body(self):
        response = self.client.get(
            reverse('checkresult-detail', args=[self.result.pk]),
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data['full_response_body'],
            '{"status":"ok","meta":{"region":"eu-west-1"}}',
        )


class IncidentAPITest(AuthMixin, APITestCase):
    def setUp(self):
        super().setUp()
        self.service = Service.objects.create(
            name='Test', url='https://example.com',
        )
        Incident.objects.create(service=self.service)

    def test_list_incidents(self):
        response = self.client.get(reverse('incident-list'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_update_incident_reason(self):
        incident = Incident.objects.first()
        response = self.client.patch(
            reverse('incident-detail', args=[incident.pk]),
            {'user_reason': 'Scheduled maintenance'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class ReportAPITest(AuthMixin, APITestCase):
    def setUp(self):
        super().setUp()
        self.service = Service.objects.create(
            name='ReportSvc', url='https://example.com',
        )
        Service.objects.filter(pk=self.service.pk).update(
            created_at=timezone.now() - timedelta(days=7),
        )
        self.service.refresh_from_db()
        CheckResult.objects.create(
            service=self.service, is_successful=True,
            status_code=200, response_time_ms=100,
        )

    def test_get_report(self):
        response = self.client.get(reverse('reports'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['service_name'], 'ReportSvc')
        self.assertEqual(response.data[0]['uptime_percentage'], 100.0)

    def test_report_uptime_derived_from_incidents(self):
        now = timezone.now()
        day_ago = now - timedelta(days=1)
        inc = Incident.objects.create(
            service=self.service,
            is_resolved=True,
            status=IncidentStatus.RESOLVED,
            resolved_at=now - timedelta(hours=1),
            duration=timedelta(hours=1),
        )
        Incident.objects.filter(pk=inc.pk).update(
            started_at=now - timedelta(hours=2),
        )

        response = self.client.get(
            reverse('reports'),
            {'start': day_ago.isoformat(), 'end': now.isoformat()},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertLess(response.data[0]['uptime_percentage'], 100.0)
        self.assertGreater(
            response.data[0]['total_downtime_seconds'], 0,
        )
