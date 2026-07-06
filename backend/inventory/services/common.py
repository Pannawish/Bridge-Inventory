"""Shared service helpers."""

import re
from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Q


def as_number(value):
    if value is None:
        return None

    if isinstance(value, Decimal):
        if value == value.to_integral_value():
            return int(value)

        return float(value)

    return value


def normalize_chat_text(value):
    normalized = re.sub(r"[^0-9a-zA-Zก-๙]+", " ", (value or "").lower())
    return re.sub(r"\s+", " ", normalized).strip()


def contains_any(value, terms):
    return any(term in value for term in terms)


def contains_any_token(value, terms):
    tokens = set(value.split())
    return any(term in tokens for term in terms)


def get_month_bounds(year, month):
    start = date(year, month, 1)
    if month == 12:
        return start, date(year + 1, 1, 1) - timedelta(days=1)
    return start, date(year, month + 1, 1) - timedelta(days=1)


def get_week_bounds(anchor_date):
    start = anchor_date - timedelta(days=anchor_date.weekday())
    return start, start + timedelta(days=6)


def get_product_label(product):
    return product.product_name if product else ""


def compute_date_diff_in_days(start_date, end_date):
    if not start_date or not end_date:
        return None

    return max(0, (end_date - start_date).days)


def compute_date_span_days(dates):
    dates = [date for date in dates if date]
    if len(dates) <= 1:
        return len(dates)

    return max(1, (max(dates) - min(dates)).days + 1)


def build_text_query(terms, fields):
    query = Q()
    for term in terms:
        for field in fields:
            query |= Q(**{f"{field}__icontains": term})
    return query


def date_interval_label(date_interval):
    if not date_interval:
        return ""
    start = date_interval["start"].isoformat()
    end = date_interval["end"].isoformat()
    return start if start == end else f"{start} to {end}"


def chat_scope_label(date_interval, fallback="All dates"):
    return date_interval_label(date_interval) or fallback


def chat_metric(label, value, tone="default"):
    return {"label": label, "value": str(value), "tone": tone}


def chat_record(label, meta="", value="", value_label="", target_type="", target_id=None):
    record = {
        "label": label,
        "meta": meta,
        "value": "" if value is None else str(value),
        "value_label": value_label,
    }
    if target_type and target_id not in (None, ""):
        record["target"] = {"type": target_type, "id": str(target_id)}
    return record


def chat_section(title, items=None, records=None):
    return {
        "title": title,
        "items": items or [],
        "records": records or [],
    }


def combine_chat_meta(*parts):
    values = [str(part) for part in parts if part not in (None, "", [])]
    return " | ".join(values)


__all__ = [
    "as_number",
    "build_text_query",
    "chat_metric",
    "chat_record",
    "chat_scope_label",
    "chat_section",
    "combine_chat_meta",
    "compute_date_diff_in_days",
    "compute_date_span_days",
    "contains_any",
    "contains_any_token",
    "date_interval_label",
    "get_month_bounds",
    "get_product_label",
    "get_week_bounds",
    "normalize_chat_text",
]
