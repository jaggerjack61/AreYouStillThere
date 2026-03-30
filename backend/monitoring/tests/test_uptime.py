from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from monitoring.models import Incident, IncidentStatus, Service
from monitoring.uptime import (
    calculate_incident_downtime_seconds,
    calculate_incident_uptime,
)


def create_incident(service, started_at, resolved_at=None, is_resolved=False):
    inc = Incident.objects.create(
        service=service,
        is_resolved=is_resolved,
        status=IncidentStatus.RESOLVED if is_resolved else IncidentStatus.OPEN,
        duration=(resolved_at - started_at) if resolved_at else None,
        resolved_at=resolved_at,
    )
    Incident.objects.filter(pk=inc.pk).update(started_at=started_at)
    inc.refresh_from_db()
    return inc


class CalculateIncidentUptimeTest(TestCase):
    def setUp(self):
        self.service = Service.objects.create(
            name='UptimeSvc', url='https://example.com',
        )
        self.now = timezone.now()
        Service.objects.filter(pk=self.service.pk).update(
            created_at=self.now - timedelta(days=7),
        )
        self.service.refresh_from_db()

    def test_no_incidents_returns_full_uptime(self):
        start = self.now - timedelta(hours=24)
        uptime = calculate_incident_uptime(self.service, start, self.now)
        self.assertEqual(uptime, 100.0)

    def test_single_resolved_incident_within_period(self):
        start = self.now - timedelta(hours=24)
        inc_start = self.now - timedelta(hours=2)
        inc_end = self.now - timedelta(hours=1)

        create_incident(
            self.service, inc_start,
            resolved_at=inc_end, is_resolved=True,
        )

        uptime = calculate_incident_uptime(self.service, start, self.now)
        expected = ((24 * 3600 - 3600) / (24 * 3600)) * 100
        self.assertAlmostEqual(uptime, expected, places=2)

    def test_ongoing_incident_counts_until_period_end(self):
        start = self.now - timedelta(hours=24)
        inc_start = self.now - timedelta(hours=3)

        create_incident(self.service, inc_start)

        uptime = calculate_incident_uptime(self.service, start, self.now)
        expected = ((24 * 3600 - 3 * 3600) / (24 * 3600)) * 100
        self.assertAlmostEqual(uptime, expected, places=2)

    def test_incident_spanning_before_period_start(self):
        start = self.now - timedelta(hours=24)
        inc_start = self.now - timedelta(hours=30)
        inc_end = self.now - timedelta(hours=20)

        create_incident(
            self.service, inc_start,
            resolved_at=inc_end, is_resolved=True,
        )

        downtime = calculate_incident_downtime_seconds(
            self.service, start, self.now,
        )
        self.assertAlmostEqual(downtime, 4 * 3600, delta=1)

    def test_incident_ending_after_period_clips_to_period_end(self):
        start = self.now - timedelta(hours=24)
        inc_start = self.now - timedelta(hours=1)

        create_incident(self.service, inc_start)

        downtime = calculate_incident_downtime_seconds(
            self.service, start, self.now,
        )
        self.assertAlmostEqual(downtime, 3600, delta=1)

    def test_multiple_incidents_sum_downtime(self):
        start = self.now - timedelta(hours=24)

        create_incident(
            self.service,
            self.now - timedelta(hours=10),
            resolved_at=self.now - timedelta(hours=9),
            is_resolved=True,
        )
        create_incident(
            self.service,
            self.now - timedelta(hours=5),
            resolved_at=self.now - timedelta(hours=4),
            is_resolved=True,
        )

        downtime = calculate_incident_downtime_seconds(
            self.service, start, self.now,
        )
        self.assertAlmostEqual(downtime, 2 * 3600, delta=1)

    def test_zero_period_returns_full_uptime(self):
        uptime = calculate_incident_uptime(
            self.service, self.now, self.now,
        )
        self.assertEqual(uptime, 100.0)

    def test_does_not_count_other_services_incidents(self):
        other = Service.objects.create(
            name='OtherSvc', url='https://other.example.com',
        )
        start = self.now - timedelta(hours=24)

        create_incident(other, self.now - timedelta(hours=12))

        uptime = calculate_incident_uptime(self.service, start, self.now)
        self.assertEqual(uptime, 100.0)

    def test_incident_outside_period_is_ignored(self):
        start = self.now - timedelta(hours=24)
        inc_start = self.now - timedelta(hours=48)
        inc_end = self.now - timedelta(hours=36)

        create_incident(
            self.service, inc_start,
            resolved_at=inc_end, is_resolved=True,
        )

        uptime = calculate_incident_uptime(self.service, start, self.now)
        self.assertEqual(uptime, 100.0)

    def test_uptime_counts_only_incident_downtime(self):
        created_at = self.now - timedelta(hours=5)
        Service.objects.filter(pk=self.service.pk).update(created_at=created_at)
        self.service.refresh_from_db()

        create_incident(self.service, self.now - timedelta(hours=4))

        uptime = calculate_incident_uptime(
            self.service,
            self.now - timedelta(hours=24),
            self.now,
        )

        # Effective period is 5h (created_at to now), incident covers 4h
        expected = ((5 * 3600 - 4 * 3600) / (5 * 3600)) * 100
        self.assertAlmostEqual(uptime, expected, places=2)
