from django.db.models import Q

from monitoring.models import Incident


def _get_effective_period_start(service, period_start):
    return max(period_start, service.created_at)


def calculate_incident_downtime_seconds(service, period_start, period_end):
    period_start = _get_effective_period_start(service, period_start)
    incidents = Incident.objects.filter(
        service=service,
        started_at__lt=period_end,
    ).filter(
        Q(resolved_at__gt=period_start) | Q(is_resolved=False),
    )

    total = 0
    for inc in incidents:
        start = max(inc.started_at, period_start)
        end = min(inc.resolved_at, period_end) if inc.resolved_at else period_end
        total += max(0, (end - start).total_seconds())

    return total


def calculate_incident_uptime(service, period_start, period_end):
    period_start = _get_effective_period_start(service, period_start)
    total_seconds = (period_end - period_start).total_seconds()
    if total_seconds <= 0:
        return 100.0

    downtime = calculate_incident_downtime_seconds(
        service, period_start, period_end,
    )
    uptime = ((total_seconds - downtime) / total_seconds) * 100
    return max(0.0, min(100.0, uptime))
