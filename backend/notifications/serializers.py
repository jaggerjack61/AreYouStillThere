from rest_framework import serializers

from notifications.models import (
    NotificationLog,
    NotificationPolicy,
    SMTPConfig,
)


class SMTPConfigSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False,
                                     allow_blank=True)

    class Meta:
        model = SMTPConfig
        fields = [
            'id', 'host', 'port', 'username', 'password',
            'use_tls', 'use_ssl', 'from_email', 'enabled',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']

    def create(self, validated_data):
        password = validated_data.pop('password', '')
        instance = SMTPConfig(**validated_data)
        instance.password = password
        instance.save()
        return instance

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password is not None:
            instance.password = password
        instance.save()
        return instance


class NotificationPolicySerializer(serializers.ModelSerializer):
    service_name = serializers.CharField(
        source='service.name', read_only=True
    )

    class Meta:
        model = NotificationPolicy
        fields = [
            'id', 'service', 'service_name', 'email_enabled',
            'notify_on_down', 'notify_on_recovery',
            'notify_on_retry_failure', 'cooldown_seconds',
            'recipient_emails',
        ]


class NotificationLogSerializer(serializers.ModelSerializer):
    service_name = serializers.CharField(
        source='service.name', read_only=True
    )

    class Meta:
        model = NotificationLog
        fields = [
            'id', 'service', 'service_name', 'timestamp',
            'event_type', 'recipients', 'status', 'error_message',
        ]
        read_only_fields = ['timestamp']
