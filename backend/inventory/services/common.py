"""Shared service helpers."""

from ._legacy import (
    as_number,
    build_text_query,
    chat_metric,
    chat_record,
    chat_scope_label,
    chat_section,
    compute_date_diff_in_days,
    compute_date_span_days,
    contains_any,
    contains_any_token,
    get_month_bounds,
    get_product_label,
    get_week_bounds,
)

__all__ = [
    "as_number",
    "build_text_query",
    "chat_metric",
    "chat_record",
    "chat_scope_label",
    "chat_section",
    "compute_date_diff_in_days",
    "compute_date_span_days",
    "contains_any",
    "contains_any_token",
    "get_month_bounds",
    "get_product_label",
    "get_week_bounds",
]

