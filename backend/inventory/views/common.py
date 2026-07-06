"""Shared view helpers and base classes."""

from ._legacy import (
    AutoReferenceNumberMixin,
    InventoryModelViewSet,
    api_home,
    apply_date_range,
    apply_text_search,
    build_next_reference_no,
    build_next_sequential_reference_no,
    build_party_options,
    format_serializer_errors,
    normalize_decimal_fields,
    normalize_decimal_value,
    normalize_request_data,
)

__all__ = [
    "AutoReferenceNumberMixin",
    "InventoryModelViewSet",
    "api_home",
    "apply_date_range",
    "apply_text_search",
    "build_next_reference_no",
    "build_next_sequential_reference_no",
    "build_party_options",
    "format_serializer_errors",
    "normalize_decimal_fields",
    "normalize_decimal_value",
    "normalize_request_data",
]

