from django.contrib import admin

from notifications.models import (
    NotificationLog,
    NotificationPolicy,
    SMTPConfig,
)


@admin.register(SMTPConfig)
class SMTPConfigAdmin(admin.ModelAdmin):
    list_display = ['host', 'port', 'from_email', 'enabled']
    exclude = ['_password']


@admin.register(NotificationPolicy)
class NotificationPolicyAdmin(admin.ModelAdmin):
    list_display = [
        'service', 'email_enabled', 'notify_on_down',
        'notify_on_recovery',
    ]


@admin.register(NotificationLog)
class NotificationLogAdmin(admin.ModelAdmin):
    list_display = ['service', 'event_type', 'status', 'timestamp']
    list_filter = ['event_type', 'status']
