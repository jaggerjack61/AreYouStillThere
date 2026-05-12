from django.db.models import Q

from monitoring.models import Incident


def _get_effective_period_start(service, period_start):
    return max(period_start, service.created_at)


def incident_overlap_query(period_start, period_end):
    return Q(started_at__lt=period_end) & (
        Q(resolved_at__gt=period_start) | Q(is_resolved=False)
    )


def _incident_overlaps_period(incident, period_start, period_end):
    if incident.started_at >= period_end:
        return False
    if incident.resolved_at:
        return incident.resolved_at > period_start
    return not incident.is_resolved


def calculate_incident_downtime_seconds_from_incidents(
    service, period_start, period_end, incidents,
):
    period_start = _get_effective_period_start(service, period_start)

    total = 0
    for incident in incidents:
        if not _incident_overlaps_period(incident, period_start, period_end):
            continue

        start = max(incident.started_at, period_start)
        end = (
            min(incident.resolved_at, period_end)
            if incident.resolved_at else period_end
        )
        total += max(0, (end - start).total_seconds())

    return total


def calculate_incident_uptime_from_incidents(
    service, period_start, period_end, incidents,
):
    downtime = calculate_incident_downtime_seconds_from_incidents(
        service, period_start, period_end, incidents,
    )
    return calculate_incident_uptime_from_downtime(
        service, period_start, period_end, downtime,
    )


def calculate_incident_uptime_from_downtime(
    service, period_start, period_end, downtime_seconds,
):
    period_start = _get_effective_period_start(service, period_start)
    total_seconds = (period_end - period_start).total_seconds()
    if total_seconds <= 0:
        return 100.0

    uptime = ((total_seconds - downtime_seconds) / total_seconds) * 100
    return max(0.0, min(100.0, uptime))


def calculate_incident_downtime_seconds(service, period_start, period_end):
    period_start = _get_effective_period_start(service, period_start)
    incidents = Incident.objects.filter(
        service=service,
    ).filter(incident_overlap_query(period_start, period_end))

    return calculate_incident_downtime_seconds_from_incidents(
        service, period_start, period_end, incidents,
    )


def calculate_incident_uptime(service, period_start, period_end):
    downtime = calculate_incident_downtime_seconds(
        service, period_start, period_end,
    )
    return calculate_incident_uptime_from_downtime(
        service, period_start, period_end, downtime,
    )
