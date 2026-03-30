from rest_framework.pagination import PageNumberPagination


class CheckResultPagination(PageNumberPagination):
    page_size = 50
