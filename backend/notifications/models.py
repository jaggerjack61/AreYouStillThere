from django.db import models

from notifications.encryption import decrypt_value, encrypt_value


class SMTPConfig(models.Model):
    host = models.CharField(max_length=255)
    port = models.IntegerField(default=587)
    username = models.CharField(max_length=255, blank=True, default='')
    _password = models.TextField(
        db_column='password', blank=True, default=''
    )
    use_tls = models.BooleanField(default=True)
    use_ssl = models.BooleanField(default=False)
    from_email = models.EmailField()
    enabled = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'SMTP Configuration'
        verbose_name_plural = 'SMTP Configurations'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.host}:{self.port}"

    @property
    def password(self):
        return decrypt_value(self._password)

    @password.setter
    def password(self, value):
        self._password = encrypt_value(value)


class EventType(models.TextChoices):
    DOWN = 'DOWN', 'Down'
    RECOVERY = 'RECOVERY', 'Recovery'
    RETRY_FAILURE = 'RETRY_FAILURE', 'Retry Failure'


class NotificationPolicy(models.Model):
    service = models.OneToOneField(
        'monitoring.Service',
        on_delete=models.CASCADE,
        related_name='notification_policy',
    )
    email_enabled = models.BooleanField(default=False)
    notify_on_down = models.BooleanField(default=True)
    notify_on_recovery = models.BooleanField(default=True)
    notify_on_retry_failure = models.BooleanField(default=False)
    cooldown_seconds = models.IntegerField(default=300)
    recipient_emails = models.JSONField(default=list, blank=True)

    class Meta:
        verbose_name_plural = 'notification policies'
        ordering = ['service__name']

    def __str__(self):
        return f"Policy for {self.service.name}"


class NotificationStatus(models.TextChoices):
    SENT = 'SENT', 'Sent'
    FAILED = 'FAILED', 'Failed'


class NotificationLog(models.Model):
    service = models.ForeignKey(
        'monitoring.Service',
        on_delete=models.CASCADE,
        related_name='notification_logs',
    )
    timestamp = models.DateTimeField(auto_now_add=True)
    event_type = models.CharField(
        max_length=20, choices=EventType.choices,
    )
    recipients = models.JSONField(default=list)
    status = models.CharField(
        max_length=10, choices=NotificationStatus.choices,
    )
    error_message = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.service.name} - {self.event_type} - {self.status}"
