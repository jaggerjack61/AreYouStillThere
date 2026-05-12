from datetime import timedelta

from django.contrib.auth.models import User
from django.db.models import Avg, Count, Q
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
    calculate_incident_downtime_seconds_from_incidents,
    calculate_incident_uptime,
    calculate_incident_uptime_from_downtime,
    calculate_incident_uptime_from_incidents,
    incident_overlap_query,
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

        services = list(Service.objects.all())
        service_ids = [service.pk for service in services]
        avg_response_times = _get_avg_response_times(service_ids, day_ago)
        incident_counts = _get_incident_counts(service_ids, week_ago)
        uptime_incidents = _get_uptime_incidents(service_ids, day_ago, now)

        data = [_build_bulk_stats_entry(
            service,
            day_ago,
            now,
            avg_response_times,
            incident_counts,
            uptime_incidents,
        ) for service in services]
        return Response(data)


def _build_bulk_stats_entry(
    service, period_start, period_end, avg_response_times,
    incident_counts, uptime_incidents,
):
    uptime = calculate_incident_uptime_from_incidents(
        service,
        period_start,
        period_end,
        uptime_incidents.get(service.pk, []),
    )
    return {
        'service_id': service.pk,
        'uptime_24h': round(uptime, 2),
        'avg_response_time_24h': round(
            avg_response_times.get(service.pk) or 0, 2,
        ),
        'incidents_7d': incident_counts.get(service.pk, 0),
    }


def _get_avg_response_times(service_ids, period_start):
    if not service_ids:
        return {}

    rows = CheckResult.objects.filter(
        service_id__in=service_ids,
        checked_at__gte=period_start,
    ).values('service_id').annotate(
        avg_response_time=Avg('response_time_ms'),
    ).order_by()
    return {
        row['service_id']: row['avg_response_time'] for row in rows
    }


def _get_incident_counts(service_ids, period_start):
    if not service_ids:
        return {}

    rows = Incident.objects.filter(
        service_id__in=service_ids,
        started_at__gte=period_start,
    ).values('service_id').annotate(
        incident_count=Count('id'),
    ).order_by()
    return {
        row['service_id']: row['incident_count'] for row in rows
    }


def _get_uptime_incidents(service_ids, period_start, period_end):
    incidents_by_service = {service_id: [] for service_id in service_ids}
    if not service_ids:
        return incidents_by_service

    incidents = Incident.objects.filter(
        service_id__in=service_ids,
    ).filter(incident_overlap_query(period_start, period_end)).order_by()
    for incident in incidents:
        incidents_by_service[incident.service_id].append(incident)
    return incidents_by_service


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
        requested_start = _parse_boundary(start_param)
        period_end = _parse_boundary(end_param) or now

        check_filters = Q()
        if start_param:
            check_filters &= Q(checked_at__gte=start_param)
        if end_param:
            check_filters &= Q(checked_at__lte=end_param)

        services = Service.objects.all()
        if service_ids:
            services = services.filter(id__in=service_ids)
        services = list(services)

        report_service_ids = [service.pk for service in services]
        period_starts = _get_report_period_starts(
            services, requested_start,
        )
        check_stats = _get_report_check_stats(
            report_service_ids, check_filters,
        )
        incidents = _get_report_incidents(
            report_service_ids, period_starts, period_end,
        )

        data = [_build_report_entry(
            service,
            period_starts[service.pk],
            period_end,
            check_stats,
            incidents,
        ) for service in services]

        serializer = self.get_serializer(data, many=True)
        return Response(serializer.data)


def _get_report_period_starts(services, requested_start):
    return {
        service.pk: requested_start or service.created_at
        for service in services
    }


def _get_report_check_stats(service_ids, check_filters):
    if not service_ids:
        return {}

    rows = CheckResult.objects.filter(
        service_id__in=service_ids,
    ).filter(check_filters).values('service_id').annotate(
        total_checks=Count('id'),
        successful_checks=Count('id', filter=Q(is_successful=True)),
        avg_response_time=Avg('response_time_ms'),
    ).order_by()
    return {row['service_id']: row for row in rows}


def _get_report_incidents(service_ids, period_starts, period_end):
    incidents_by_service = {service_id: [] for service_id in service_ids}
    if not service_ids:
        return incidents_by_service

    earliest_start = min(period_starts.values())
    incident_filters = incident_overlap_query(earliest_start, period_end) | Q(
        started_at__gte=earliest_start,
        started_at__lte=period_end,
    )
    incidents = Incident.objects.filter(
        service_id__in=service_ids,
    ).filter(incident_filters).order_by()
    for incident in incidents:
        incidents_by_service[incident.service_id].append(incident)
    return incidents_by_service


def _build_report_entry(
    service, period_start, period_end, check_stats, incidents_by_service,
):
    stats = check_stats.get(service.pk, {})
    total = stats.get('total_checks', 0)
    success = stats.get('successful_checks', 0)
    avg_rt = stats.get('avg_response_time') or 0
    incidents = incidents_by_service.get(service.pk, [])
    downtime = calculate_incident_downtime_seconds_from_incidents(
        service, period_start, period_end, incidents,
    )
    uptime = calculate_incident_uptime_from_downtime(
        service, period_start, period_end, downtime,
    )

    return {
        'service_id': service.id,
        'service_name': service.name,
        'total_checks': total,
        'successful_checks': success,
        'failed_checks': total - success,
        'uptime_percentage': round(uptime, 2),
        'avg_response_time': round(avg_rt, 2),
        'incident_count': _count_started_incidents(
            incidents, period_start, period_end,
        ),
        'total_downtime_seconds': int(downtime),
    }


def _count_started_incidents(incidents, period_start, period_end):
    return sum(
        1 for incident in incidents
        if period_start <= incident.started_at <= period_end
    )


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
