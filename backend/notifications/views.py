from django.core.mail import EmailMessage
from django.core.mail.backends.smtp import EmailBackend
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from notifications.models import (
    NotificationLog,
    NotificationPolicy,
    SMTPConfig,
)
from notifications.serializers import (
    NotificationLogSerializer,
    NotificationPolicySerializer,
    SMTPConfigSerializer,
)


class SMTPConfigViewSet(viewsets.ModelViewSet):
    queryset = SMTPConfig.objects.all()
    serializer_class = SMTPConfigSerializer

    @action(detail=True, methods=['post'])
    def test(self, request, pk=None):
        config = self.get_object()
        recipient = request.data.get('recipient')
        if not recipient:
            return Response(
                {'error': 'recipient email is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            backend = EmailBackend(
                host=config.host,
                port=config.port,
                username=config.username,
                password=config.password,
                use_tls=config.use_tls,
                use_ssl=config.use_ssl,
                fail_silently=False,
            )
            email = EmailMessage(
                subject='Test Email - Monitoring System',
                body='This is a test email from your monitoring system.',
                from_email=config.from_email,
                to=[recipient],
                connection=backend,
            )
            email.send(fail_silently=False)
            return Response({'status': 'sent'})
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class NotificationPolicyViewSet(viewsets.ModelViewSet):
    queryset = NotificationPolicy.objects.select_related('service').all()
    serializer_class = NotificationPolicySerializer

    def get_queryset(self):
        qs = super().get_queryset()
        service_id = self.request.query_params.get('service')
        if service_id:
            qs = qs.filter(service_id=service_id)
        return qs


class NotificationLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = NotificationLog.objects.select_related('service').all()
    serializer_class = NotificationLogSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        service_id = self.request.query_params.get('service')
        if service_id:
            qs = qs.filter(service_id=service_id)
        return qs
