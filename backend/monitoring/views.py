from datetime import timedelta

from django.contrib.auth.models import User
from django.db.models import Avg, Count, Q, Sum
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from rest_framework import filters, generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from monitoring.models import (
    CheckResult,
    Incident,
    PingEndpoint,
    RetryPolicy,
    Service,
    ValidationRule,
)
from monitoring.pagination import CheckResultPagination
from monitoring.serializers import (
    CheckResultDetailSerializer,
    CheckResultListSerializer,
    IncidentSerializer,
    PingEndpointSerializer,
    RegisterSerializer,
    RetryPolicySerializer,
    ServiceReportSerializer,
    ServiceSerializer,
    ValidationRuleSerializer,
)
from monitoring.uptime import (
    calculate_incident_downtime_seconds,
    calculate_incident_uptime,
)


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


class ServiceViewSet(viewsets.ModelViewSet):
    queryset = Service.objects.all()
    serializer_class = ServiceSerializer

    @action(detail=True, methods=['get'])
    def stats(self, request, pk=None):
        service = self.get_object()
        now = timezone.now()
        day_ago = now - timedelta(days=1)
        week_ago = now - timedelta(days=7)

        uptime = calculate_incident_uptime(service, day_ago, now)

        avg_response = CheckResult.objects.filter(
            service=service, checked_at__gte=day_ago,
        ).aggregate(
            avg=Avg('response_time_ms'),
        )['avg'] or 0

        total = CheckResult.objects.filter(
            service=service, checked_at__gte=day_ago,
        ).count()

        incidents_week = Incident.objects.filter(
            service=service, started_at__gte=week_ago,
        ).count()

        return Response({
            'uptime_24h': round(uptime, 2),
            'avg_response_time_24h': round(avg_response, 2),
            'total_checks_24h': total,
            'incidents_7d': incidents_week,
        })

    @action(detail=False, methods=['get'], url_path='bulk-stats')
    def bulk_stats(self, request):
        now = timezone.now()
        day_ago = now - timedelta(days=1)
        week_ago = now - timedelta(days=7)

        services = Service.objects.all()
        data = []
        for svc in services:
            uptime = calculate_incident_uptime(svc, day_ago, now)
            agg = CheckResult.objects.filter(
                service=svc, checked_at__gte=day_ago,
            ).aggregate(avg=Avg('response_time_ms'))
            incidents_week = Incident.objects.filter(
                service=svc, started_at__gte=week_ago,
            ).count()
            data.append({
                'service_id': svc.pk,
                'uptime_24h': round(uptime, 2),
                'avg_response_time_24h': round(agg['avg'] or 0, 2),
                'incidents_7d': incidents_week,
            })
        return Response(data)


class ValidationRuleViewSet(viewsets.ModelViewSet):
    queryset = ValidationRule.objects.select_related('service').all()
    serializer_class = ValidationRuleSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        service_id = self.request.query_params.get('service')
        if service_id:
            qs = qs.filter(service_id=service_id)
        return qs


class RetryPolicyViewSet(viewsets.ModelViewSet):
    queryset = RetryPolicy.objects.select_related('service').all()
    serializer_class = RetryPolicySerializer

    def get_queryset(self):
        qs = super().get_queryset()
        service_id = self.request.query_params.get('service')
        if service_id:
            qs = qs.filter(service_id=service_id)
        return qs


class PingEndpointViewSet(viewsets.ModelViewSet):
    queryset = PingEndpoint.objects.all()
    serializer_class = PingEndpointSerializer


class CheckResultViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = CheckResult.objects.select_related('service').all()
    serializer_class = CheckResultListSerializer
    pagination_class = CheckResultPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        'service__name',
        'response_snippet',
        'error_message',
        'failure_reason',
        'network_status',
    ]
    ordering_fields = [
        'checked_at',
        'service__name',
        'is_successful',
        'status_code',
        'response_time_ms',
        'response_snippet',
    ]
    ordering = ['-checked_at', '-id']

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return CheckResultDetailSerializer
        return CheckResultListSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        service_id = self.request.query_params.get('service')
        if service_id:
            qs = qs.filter(service_id=service_id)
        return self._filter_by_result(qs)

    def _filter_by_result(self, queryset):
        result = (self.request.query_params.get('result') or '').upper()
        if result == 'SUCCESS':
            return queryset.filter(is_successful=True)
        if result == 'FAILURE':
            return queryset.filter(is_successful=False)
        return queryset


class IncidentViewSet(viewsets.ModelViewSet):
    queryset = Incident.objects.select_related('service').all()
    serializer_class = IncidentSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        service_id = self.request.query_params.get('service')
        if service_id:
            qs = qs.filter(service_id=service_id)
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)
        return qs


class ReportView(generics.GenericAPIView):
    serializer_class = ServiceReportSerializer

    def get(self, request):
        start_param = request.query_params.get('start')
        end_param = request.query_params.get('end')
        service_ids = request.query_params.getlist('service')

        now = timezone.now()
        period_end = _parse_boundary(end_param) or now

        check_filters = Q()
        if start_param:
            check_filters &= Q(checked_at__gte=start_param)
        if end_param:
            check_filters &= Q(checked_at__lte=end_param)

        services = Service.objects.all()
        if service_ids:
            services = services.filter(id__in=service_ids)

        data = []
        for svc in services:
            period_start = (
                _parse_boundary(start_param) or svc.created_at
            )

            uptime = calculate_incident_uptime(
                svc, period_start, period_end,
            )
            downtime = calculate_incident_downtime_seconds(
                svc, period_start, period_end,
            )

            checks = svc.check_results.filter(check_filters)
            total = checks.count()
            success = checks.filter(is_successful=True).count()

            avg_rt = checks.aggregate(
                avg=Avg('response_time_ms'),
            )['avg'] or 0

            inc_count = svc.incidents.filter(
                started_at__gte=period_start,
                started_at__lte=period_end,
            ).count()

            data.append({
                'service_id': svc.id,
                'service_name': svc.name,
                'total_checks': total,
                'successful_checks': success,
                'failed_checks': total - success,
                'uptime_percentage': round(uptime, 2),
                'avg_response_time': round(avg_rt, 2),
                'incident_count': inc_count,
                'total_downtime_seconds': int(downtime),
            })

        serializer = self.get_serializer(data, many=True)
        return Response(serializer.data)


def _parse_boundary(value):
    if not value:
        return None
    dt = parse_datetime(value)
    if dt:
        return dt
    from datetime import datetime as dt_cls
    d = parse_date(value)
    if d:
        return timezone.make_aware(dt_cls.combine(d, dt_cls.min.time()))
    return None
