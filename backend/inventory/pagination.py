"""Optional pagination classes and response shape for inventory list endpoints."""

from django.conf import settings
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class InventoryPagination(PageNumberPagination):
    page_query_param = "page"
    page_size_query_param = "page_size"
    extra_page_size_query_params = ("pageSize", "limit")
    default_page_size = 25
    max_page_size = 100

    def get_page_size(self, request):
        requested_page_size = None
        for param in (self.page_size_query_param, *self.extra_page_size_query_params):
            value = request.query_params.get(param)
            if value not in (None, ""):
                requested_page_size = value
                break

        if requested_page_size is None and self.page_query_param not in request.query_params:
            return None

        default_page_size = getattr(settings, "INVENTORY_DEFAULT_PAGE_SIZE", self.default_page_size)
        max_page_size = getattr(settings, "INVENTORY_MAX_PAGE_SIZE", self.max_page_size)

        if requested_page_size is None:
            return default_page_size

        try:
            page_size = int(requested_page_size)
        except (TypeError, ValueError):
            return default_page_size

        if page_size < 1:
            return default_page_size

        return min(page_size, max_page_size)

    def get_paginated_response(self, data):
        return Response(
            {
                "count": self.page.paginator.count,
                "next": self.get_next_link(),
                "previous": self.get_previous_link(),
                "page": self.page.number,
                "page_size": self.page.paginator.per_page,
                "total_pages": self.page.paginator.num_pages,
                "results": data,
            }
        )
