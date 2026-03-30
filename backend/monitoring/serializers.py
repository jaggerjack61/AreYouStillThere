from django.contrib.auth.models import User
from django.db.models import Avg, Count, Q
from django.utils import timezone
from rest_framework import serializers

from monitoring.models import (
    CheckResult,
    Incident,
    PingEndpoint,
    RetryPolicy,
    Service,
    ValidationRule,
)


class ValidationRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = ValidationRule
        fields = '__all__'


class RetryPolicySerializer(serializers.ModelSerializer):
    class Meta:
        model = RetryPolicy
        fields = '__all__'


class PingEndpointSerializer(serializers.ModelSerializer):
    class Meta:
        model = PingEndpoint
        fields = '__all__'


class ServiceSerializer(serializers.ModelSerializer):
    validation_rules = ValidationRuleSerializer(many=True, read_only=True)
    retry_policy = RetryPolicySerializer(read_only=True)

    class Meta:
        model = Service
        fields = '__all__'
        read_only_fields = [
            'status',
            'created_at',
            'updated_at',
            'total_check_count',
            'successful_check_count',
            'failed_check_count',
        ]


class CheckResultListSerializer(serializers.ModelSerializer):
    service_name = serializers.CharField(
        source='service.name', read_only=True,
    )

    class Meta:
        model = CheckResult
        exclude = ['full_response_body']
        read_only_fields = ['checked_at']


class CheckResultDetailSerializer(serializers.ModelSerializer):
    service_name = serializers.CharField(
        source='service.name', read_only=True,
    )

    class Meta:
        model = CheckResult
        fields = '__all__'
        read_only_fields = ['checked_at']


class IncidentSerializer(serializers.ModelSerializer):
    service_name = serializers.CharField(
        source='service.name', read_only=True,
    )
    duration_display = serializers.SerializerMethodField()

    class Meta:
        model = Incident
        fields = '__all__'

    def get_duration_display(self, obj):
        if obj.duration:
            total = int(obj.duration.total_seconds())
            hours, remainder = divmod(total, 3600)
            minutes, seconds = divmod(remainder, 60)
            return f"{hours}h {minutes}m {seconds}s"
        if not obj.is_resolved:
            delta = timezone.now() - obj.started_at
            total = int(delta.total_seconds())
            hours, remainder = divmod(total, 3600)
            minutes, seconds = divmod(remainder, 60)
            return f"{hours}h {minutes}m {seconds}s (ongoing)"
        return ''


class ServiceReportSerializer(serializers.Serializer):
    service_id = serializers.IntegerField()
    service_name = serializers.CharField()
    total_checks = serializers.IntegerField()
    successful_checks = serializers.IntegerField()
    failed_checks = serializers.IntegerField()
    uptime_percentage = serializers.FloatField()
    avg_response_time = serializers.FloatField()
    incident_count = serializers.IntegerField()
    total_downtime_seconds = serializers.IntegerField()


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'password']

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)
