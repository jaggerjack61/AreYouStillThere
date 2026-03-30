from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from monitoring.models import Service
from notifications.models import (
    EventType,
    NotificationLog,
    NotificationPolicy,
    NotificationStatus,
    SMTPConfig,
)


class AuthMixin:
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser', password='testpass123',
        )
        self.client.force_authenticate(user=self.user)


class SMTPConfigAPITest(AuthMixin, APITestCase):
    def setUp(self):
        super().setUp()

    def test_create_smtp_config(self):
        data = {
            'host': 'smtp.gmail.com',
            'port': 587,
            'username': 'user@gmail.com',
            'password': 'secret',
            'from_email': 'user@gmail.com',
            'use_tls': True,
            'use_ssl': False,
            'enabled': True,
        }
        response = self.client.post(
            reverse('smtpconfig-list'), data, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertNotIn('password', response.data)

    def test_list_smtp_configs(self):
        SMTPConfig.objects.create(
            host='smtp.test.com', port=587,
            from_email='a@b.com',
        )
        response = self.client.get(reverse('smtpconfig-list'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_update_smtp_config(self):
        config = SMTPConfig(
            host='smtp.test.com', port=587,
            from_email='a@b.com',
        )
        config.password = 'old'
        config.save()
        response = self.client.patch(
            reverse('smtpconfig-detail', args=[config.pk]),
            {'host': 'smtp.new.com'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        config.refresh_from_db()
        self.assertEqual(config.host, 'smtp.new.com')

    def test_password_not_exposed(self):
        config = SMTPConfig(
            host='smtp.test.com', port=587,
            from_email='a@b.com',
        )
        config.password = 'secret123'
        config.save()
        response = self.client.get(
            reverse('smtpconfig-detail', args=[config.pk])
        )
        self.assertNotIn('password', response.data)


class NotificationPolicyAPITest(AuthMixin, APITestCase):
    def setUp(self):
        super().setUp()
        self.service = Service.objects.create(
            name='Test', url='https://example.com'
        )

    def test_create_policy(self):
        data = {
            'service': self.service.pk,
            'email_enabled': True,
            'notify_on_down': True,
            'notify_on_recovery': True,
            'notify_on_retry_failure': False,
            'cooldown_seconds': 300,
            'recipient_emails': ['admin@test.com'],
        }
        response = self.client.post(
            reverse('notificationpolicy-list'), data, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_filter_by_service(self):
        NotificationPolicy.objects.create(
            service=self.service, email_enabled=True,
        )
        response = self.client.get(
            reverse('notificationpolicy-list'),
            {'service': self.service.pk},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class NotificationLogAPITest(AuthMixin, APITestCase):
    def setUp(self):
        super().setUp()
        self.service = Service.objects.create(
            name='Test', url='https://example.com'
        )
        NotificationLog.objects.create(
            service=self.service,
            event_type=EventType.DOWN,
            recipients=['a@b.com'],
            status=NotificationStatus.SENT,
        )

    def test_list_logs(self):
        response = self.client.get(reverse('notificationlog-list'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_filter_by_service(self):
        response = self.client.get(
            reverse('notificationlog-list'),
            {'service': self.service.pk},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
