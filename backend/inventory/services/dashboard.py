"""Dashboard summary and segment services."""

from ._legacy import (
    DEFAULT_SEGMENT_PERIOD,
    SEGMENT_PERIOD_DAYS,
    SEGMENT_PERIOD_LABELS,
    SEGMENT_PERIOD_ORDER,
    build_cashflow_segment,
    build_dashboard_overview,
    build_dashboard_segment,
    build_dashboard_summary,
    build_finance_segment,
    build_order_coverage_segment,
    build_products_segment,
    build_trend_segment,
    get_segment_period_range,
    normalize_segment_period,
)

__all__ = [
    "DEFAULT_SEGMENT_PERIOD",
    "SEGMENT_PERIOD_DAYS",
    "SEGMENT_PERIOD_LABELS",
    "SEGMENT_PERIOD_ORDER",
    "build_cashflow_segment",
    "build_dashboard_overview",
    "build_dashboard_segment",
    "build_dashboard_summary",
    "build_finance_segment",
    "build_order_coverage_segment",
    "build_products_segment",
    "build_trend_segment",
    "get_segment_period_range",
    "normalize_segment_period",
]

