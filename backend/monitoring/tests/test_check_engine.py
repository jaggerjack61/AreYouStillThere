from unittest.mock import patch

from django.test import TestCase

from monitoring.check_engine import SNIPPET_MAX_LENGTH, perform_check
from monitoring.models import Service, ServiceStatus, ValidationRule, ValidationRuleType


class CheckEngineTest(TestCase):
    @patch('monitoring.check_engine.requests.request')
    def test_content_validation_uses_full_response_body(self, mock_request):
        target = 'needle-after-preview'
        response_text = ('a' * SNIPPET_MAX_LENGTH) + target

        service = Service.objects.create(
            name='Long Content',
            url='https://example.com/health',
            check_type='CONTENT',
        )
        ValidationRule.objects.create(
            service=service,
            type=ValidationRuleType.CONTAINS,
            value=target,
        )

        mock_request.return_value.status_code = 200
        mock_request.return_value.text = response_text

        result = perform_check(service)

        self.assertTrue(result.is_successful)
        self.assertEqual(service.status, ServiceStatus.UP)
        self.assertEqual(result.full_response_body, response_text)
        self.assertEqual(result.response_snippet, response_text[:SNIPPET_MAX_LENGTH])
        self.assertNotIn(target, result.response_snippet)