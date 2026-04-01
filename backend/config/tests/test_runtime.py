from pathlib import Path

from django.test import SimpleTestCase
from rest_framework.test import APITestCase

from config.runtime import build_database_config


class DatabaseConfigTest(SimpleTestCase):
    def test_build_database_config_defaults_to_sqlite(self):
        config = build_database_config(Path('/app'), {})

        self.assertEqual(config['default']['ENGINE'], 'django.db.backends.sqlite3')
        self.assertEqual(config['default']['NAME'], Path('/app') / 'db.sqlite3')

    def test_build_database_config_parses_postgres_url(self):
        config = build_database_config(
            Path('/app'),
            {'DATABASE_URL': 'postgresql://appuser:secret@db:5432/areyoustillthere'},
        )

        self.assertEqual(config['default']['ENGINE'], 'django.db.backends.postgresql')
        self.assertEqual(config['default']['NAME'], 'areyoustillthere')
        self.assertEqual(config['default']['USER'], 'appuser')
        self.assertEqual(config['default']['PASSWORD'], 'secret')
        self.assertEqual(config['default']['HOST'], 'db')
        self.assertEqual(config['default']['PORT'], 5432)


class HealthCheckAPITest(APITestCase):
    def test_health_check_returns_ok(self):
        response = self.client.get('/health/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'status': 'ok'})