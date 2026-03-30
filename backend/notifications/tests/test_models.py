from django.test import TestCase, override_settings

from notifications.encryption import decrypt_value, encrypt_value
from notifications.models import (
    EventType,
    NotificationLog,
    NotificationPolicy,
    NotificationStatus,
    SMTPConfig,
)
from monitoring.models import Service


class SMTPConfigModelTest(TestCase):
    def test_create_smtp_config(self):
        config = SMTPConfig(
            host='smtp.gmail.com',
            port=587,
            username='user@gmail.com',
            from_email='user@gmail.com',
            use_tls=True,
        )
        config.password = 'secret123'
        config.save()
        self.assertEqual(config.host, 'smtp.gmail.com')
        self.assertTrue(config.enabled)

    def test_password_encryption(self):
        config = SMTPConfig(
            host='smtp.test.com', port=587,
            from_email='test@test.com',
        )
        config.password = 'mypassword'
        config.save()
        config.refresh_from_db()
        self.assertNotEqual(config._password, 'mypassword')
        self.assertEqual(config.password, 'mypassword')

    def test_str(self):
        config = SMTPConfig.objects.create(
            host='smtp.test.com', port=465,
            from_email='a@b.com',
        )
        self.assertEqual(str(config), 'smtp.test.com:465')


class NotificationPolicyModelTest(TestCase):
    def setUp(self):
        self.service = Service.objects.create(
            name='Test', url='https://example.com'
        )

    def test_create_policy(self):
        policy = NotificationPolicy.objects.create(
            service=self.service,
            email_enabled=True,
            recipient_emails=['admin@example.com'],
        )
        self.assertTrue(policy.notify_on_down)
        self.assertTrue(policy.notify_on_recovery)
        self.assertFalse(policy.notify_on_retry_failure)
        self.assertEqual(policy.cooldown_seconds, 300)

    def test_str(self):
        policy = NotificationPolicy.objects.create(
            service=self.service,
        )
        self.assertIn('Test', str(policy))


class NotificationLogModelTest(TestCase):
    def setUp(self):
        self.service = Service.objects.create(
            name='Test', url='https://example.com'
        )

    def test_create_log(self):
        log = NotificationLog.objects.create(
            service=self.service,
            event_type=EventType.DOWN,
            recipients=['admin@test.com'],
            status=NotificationStatus.SENT,
        )
        self.assertEqual(log.event_type, EventType.DOWN)

    def test_str(self):
        log = NotificationLog.objects.create(
            service=self.service,
            event_type=EventType.RECOVERY,
            recipients=['a@b.com'],
            status=NotificationStatus.SENT,
        )
        self.assertIn('RECOVERY', str(log))
        self.assertIn('SENT', str(log))


class EncryptionTest(TestCase):
    def test_encrypt_decrypt(self):
        original = 'my_secret_password'
        encrypted = encrypt_value(original)
        self.assertNotEqual(encrypted, original)
        self.assertEqual(decrypt_value(encrypted), original)

    def test_empty_value(self):
        self.assertEqual(encrypt_value(''), '')
        self.assertEqual(decrypt_value(''), '')
