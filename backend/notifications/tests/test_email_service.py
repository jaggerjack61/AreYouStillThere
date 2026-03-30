from datetime import timedelta
from unittest.mock import MagicMock, patch

from django.test import TestCase
from django.utils import timezone

from monitoring.models import CheckResult, Service, ServiceStatus
from notifications.email_service import (
    build_down_content,
    build_recovery_content,
    is_within_cooldown,
    send_notification,
)
from notifications.models import (
    EventType,
    NotificationLog,
    NotificationPolicy,
    NotificationStatus,
    SMTPConfig,
)


class BuildContentTest(TestCase):
    def setUp(self):
        self.service = Service.objects.create(
            name='MyService', url='https://example.com'
        )

    def test_build_down_content(self):
        check = CheckResult.objects.create(
            service=self.service,
            status_code=500,
            response_time_ms=1200.0,
            error_message='Internal Server Error',
        )
        subject, body = build_down_content(self.service, check)
        self.assertIn('MyService', subject)
        self.assertIn('ALERT', subject)
        self.assertIn('DOWN', body)
        self.assertIn('500', body)

    def test_build_recovery_content(self):
        duration = timedelta(minutes=15)
        subject, body = build_recovery_content(self.service, duration)
        self.assertIn('RECOVERY', subject)
        self.assertIn('UP', body)
        self.assertIn('0:15:00', body)


class CooldownTest(TestCase):
    def setUp(self):
        self.service = Service.objects.create(
            name='CooldownTest', url='https://example.com'
        )

    def test_within_cooldown(self):
        NotificationLog.objects.create(
            service=self.service,
            event_type=EventType.DOWN,
            recipients=['a@b.com'],
            status=NotificationStatus.SENT,
        )
        self.assertTrue(is_within_cooldown(self.service, 300))

    def test_outside_cooldown(self):
        log = NotificationLog.objects.create(
            service=self.service,
            event_type=EventType.DOWN,
            recipients=['a@b.com'],
            status=NotificationStatus.SENT,
        )
        NotificationLog.objects.filter(pk=log.pk).update(
            timestamp=timezone.now() - timedelta(seconds=600)
        )
        self.assertFalse(is_within_cooldown(self.service, 300))


class SendNotificationTest(TestCase):
    def setUp(self):
        self.service = Service.objects.create(
            name='NotifyTest', url='https://example.com'
        )
        self.smtp = SMTPConfig(
            host='smtp.test.com', port=587,
            username='user', from_email='from@test.com',
            enabled=True, use_tls=True,
        )
        self.smtp.password = 'pass'
        self.smtp.save()

    def test_no_policy_skips(self):
        send_notification(self.service, EventType.DOWN)
        self.assertEqual(NotificationLog.objects.count(), 0)

    def test_disabled_email_skips(self):
        NotificationPolicy.objects.create(
            service=self.service, email_enabled=False,
        )
        send_notification(self.service, EventType.DOWN)
        self.assertEqual(NotificationLog.objects.count(), 0)

    def test_disabled_event_skips(self):
        NotificationPolicy.objects.create(
            service=self.service, email_enabled=True,
            notify_on_down=False,
            recipient_emails=['a@b.com'],
        )
        send_notification(self.service, EventType.DOWN)
        self.assertEqual(NotificationLog.objects.count(), 0)

    def test_no_recipients_skips(self):
        NotificationPolicy.objects.create(
            service=self.service, email_enabled=True,
            recipient_emails=[],
        )
        send_notification(self.service, EventType.DOWN)
        self.assertEqual(NotificationLog.objects.count(), 0)

    @patch('notifications.email_service.EmailMessage')
    def test_successful_send_logs(self, mock_email_cls):
        mock_email = MagicMock()
        mock_email_cls.return_value = mock_email

        NotificationPolicy.objects.create(
            service=self.service, email_enabled=True,
            notify_on_down=True,
            recipient_emails=['admin@test.com'],
            cooldown_seconds=0,
        )
        send_notification(self.service, EventType.DOWN)
        self.assertEqual(NotificationLog.objects.count(), 1)
        log = NotificationLog.objects.first()
        self.assertEqual(log.status, NotificationStatus.SENT)

    @patch('notifications.email_service.EmailMessage')
    def test_failed_send_logs_error(self, mock_email_cls):
        mock_email = MagicMock()
        mock_email.send.side_effect = Exception('SMTP error')
        mock_email_cls.return_value = mock_email

        NotificationPolicy.objects.create(
            service=self.service, email_enabled=True,
            notify_on_down=True,
            recipient_emails=['admin@test.com'],
            cooldown_seconds=0,
        )
        send_notification(self.service, EventType.DOWN)
        log = NotificationLog.objects.first()
        self.assertEqual(log.status, NotificationStatus.FAILED)
        self.assertIn('SMTP error', log.error_message)

    @patch('notifications.email_service.EmailMessage')
    def test_cooldown_throttles(self, mock_email_cls):
        NotificationPolicy.objects.create(
            service=self.service, email_enabled=True,
            notify_on_down=True,
            recipient_emails=['admin@test.com'],
            cooldown_seconds=300,
        )
        NotificationLog.objects.create(
            service=self.service,
            event_type=EventType.DOWN,
            recipients=['admin@test.com'],
            status=NotificationStatus.SENT,
        )
        send_notification(self.service, EventType.DOWN)
        self.assertEqual(NotificationLog.objects.count(), 1)
