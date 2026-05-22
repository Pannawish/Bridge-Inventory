import json
import math
import re
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.db.models import Prefetch, Q, Sum
from django.utils.dateparse import parse_date
from django.utils import timezone

from .models import (
    BillingNote,
    Customer,
    PaymentBatch,
    Product,
    Purchase,
    PurchaseItem,
    Quotation,
    Sale,
    SaleItem,
    Supplier,
)


SALE_STOCK_DEDUCTED_STATUSES = {"packed", "shipped", "delivered"}
SALE_FULL_TRANSACTION_STATUSES = {"draft", "packed", "shipped", "delivered", "cancelled"}
SALE_PARTIAL_TRANSACTION_STATUSES = {
    "partially_packed",
    "partially_shipped",
    "partially_delivered",
}
SALE_ITEM_STATUSES = {"pending", "packed", "shipped", "delivered", "cancelled"}
PURCHASE_ITEM_STATUSES = {"pending", "received", "cancelled"}
PURCHASE_FULL_TRANSACTION_STATUSES = {"draft", "ordered", "received", "cancelled"}
SAFETY_STOCK_DAYS = 7
CHAT_STOP_WORDS = {
    "about",
    "are",
    "assistant",
    "batch",
    "batches",
    "billing",
    "detail",
    "details",
    "date",
    "between",
    "from",
    "for",
    "inventory",
    "interval",
    "item",
    "items",
    "latest",
    "note",
    "notes",
    "please",
    "product",
    "products",
    "purchase",
    "purchases",
    "payment",
    "show",
    "sale",
    "sales",
    "stock",
    "summarize",
    "summary",
    "tell",
    "the",
    "this",
    "to",
    "transaction",
    "transactions",
    "what",
    "which",
}


def as_number(value):
    if value is None:
        return None

    if isinstance(value, Decimal):
        if value == value.to_integral_value():
            return int(value)

        return float(value)

    return value


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


def get_product_metric_snapshots(product_ids=None, exclude_sale_id=None):
    product_ids = {product_id for product_id in product_ids or [] if product_id}
    received = {}
    received_value = {}
    received_purchase_count = {}
    committed = {}
    active_sales_count = {}

    purchase_items = PurchaseItem.objects.select_related("product").filter(
        product_id__isnull=False,
    )
    if product_ids:
        purchase_items = purchase_items.filter(product_id__in=product_ids)

    for item in purchase_items:
        if item.item_status != PurchaseItem.ITEM_RECEIVED:
            continue

        quantity = item.base_quantity or Decimal("0")
        received[item.product_id] = received.get(item.product_id, Decimal("0")) + quantity
        received_value[item.product_id] = (
            received_value.get(item.product_id, Decimal("0")) + (item.amount or Decimal("0"))
        )
        received_purchase_count[item.product_id] = (
            received_purchase_count.get(item.product_id, 0) + 1
        )

    sale_items = SaleItem.objects.select_related("product").filter(
        product_id__isnull=False,
    )
    if product_ids:
        sale_items = sale_items.filter(product_id__in=product_ids)
    if exclude_sale_id:
        sale_items = sale_items.exclude(sale_id=exclude_sale_id)

    for item in sale_items:
        if item.item_status not in SALE_STOCK_DEDUCTED_STATUSES:
            continue

        quantity = item.base_quantity or Decimal("0")
        committed[item.product_id] = committed.get(item.product_id, Decimal("0")) + quantity
        active_sales_count[item.product_id] = active_sales_count.get(item.product_id, 0) + 1

    products = Product.objects.all()
    if product_ids:
        products = products.filter(id__in=product_ids)

    metrics = {}
    for product in products:
        received_units = received.get(product.id, Decimal("0"))
        average_unit_cost = (
            received_value.get(product.id, Decimal("0")) / received_units
            if received_units > 0
            else Decimal("0")
        )
        metrics[product.id] = {
            "current_stock": max(
                Decimal("0"),
                received_units - committed.get(product.id, Decimal("0")),
            ),
            "average_unit_cost": average_unit_cost,
            "received_purchase_count": received_purchase_count.get(product.id, 0),
            "active_sales_count": active_sales_count.get(product.id, 0),
        }

    return metrics


def get_available_stock_by_product_id(product_ids=None, exclude_sale_id=None):
    metrics = get_product_metric_snapshots(
        product_ids=product_ids,
        exclude_sale_id=exclude_sale_id,
    )
    stock = {}
    for product_id, snapshot in metrics.items():
        stock[product_id] = snapshot.get("current_stock", Decimal("0"))

    return stock


def get_sale_item_product_id(item):
    if isinstance(item, dict):
        product = item.get("product")
        return getattr(product, "id", None) if product else None

    return item.product_id


def get_sale_item_base_quantity(item):
    if isinstance(item, dict):
        return Decimal(str(item.get("base_quantity") or item.get("quantity") or 0))

    return item.base_quantity


def get_sale_item_status(item, sale_status):
    if sale_status in {Sale.STATUS_PACKED, Sale.STATUS_SHIPPED, Sale.STATUS_DELIVERED}:
        return get_sale_item_status_for_transaction_status(sale_status)

    if sale_status in {
        Sale.STATUS_PARTIALLY_PACKED,
        Sale.STATUS_PARTIALLY_SHIPPED,
        Sale.STATUS_PARTIALLY_DELIVERED,
    }:
        if isinstance(item, dict):
            return item.get("item_status") or SaleItem.ITEM_PENDING

        return item.item_status

    return SaleItem.ITEM_CANCELLED if sale_status == Sale.STATUS_CANCELLED else SaleItem.ITEM_PENDING


def get_sale_committed_quantity_by_product_id(items, sale_status):
    committed_by_product_id = {}

    for item in items or []:
        item_status = get_sale_item_status(item, sale_status)
        if item_status not in SALE_STOCK_DEDUCTED_STATUSES:
            continue

        product_id = get_sale_item_product_id(item)
        if not product_id:
            continue

        committed_by_product_id[product_id] = (
            committed_by_product_id.get(product_id, Decimal("0"))
            + get_sale_item_base_quantity(item)
        )

    return committed_by_product_id


def get_sale_stock_issues(
    items,
    sale_status,
    exclude_sale_id=None,
    current_items=None,
    current_sale_status=None,
):
    requested_by_product_id = get_sale_committed_quantity_by_product_id(items, sale_status)

    if current_items is not None:
        current_by_product_id = get_sale_committed_quantity_by_product_id(
            current_items,
            current_sale_status or Sale.STATUS_DRAFT,
        )
        product_ids = set(requested_by_product_id) | set(current_by_product_id)
        requested_by_product_id = {
            product_id: max(
                Decimal("0"),
                requested_by_product_id.get(product_id, Decimal("0"))
                - current_by_product_id.get(product_id, Decimal("0")),
            )
            for product_id in product_ids
        }

    requested_by_product_id = {
        product_id: quantity
        for product_id, quantity in requested_by_product_id.items()
        if quantity > 0
    }

    if not requested_by_product_id:
        return []

    stock_exclude_sale_id = None if current_items is not None else exclude_sale_id
    available_stock = get_available_stock_by_product_id(
        product_ids=requested_by_product_id.keys(),
        exclude_sale_id=stock_exclude_sale_id,
    )
    products = Product.objects.in_bulk(requested_by_product_id.keys())
    issues = []
    for product_id, requested_quantity in requested_by_product_id.items():
        available_quantity = available_stock.get(product_id, Decimal("0"))
        if requested_quantity <= available_quantity:
            continue

        product = products.get(product_id)
        issues.append(
            {
                "product": get_product_label(product) or product_id,
                "requested": as_number(requested_quantity),
                "available": as_number(available_quantity),
                "unit": product.stock_base_unit if product else "",
            }
        )

    return issues


def apply_purchase_status_to_items(purchase):
    today = timezone.localdate()

    if purchase.status == Purchase.STATUS_RECEIVED:
        purchase.items.update(item_status=PurchaseItem.ITEM_RECEIVED, received_date=today)
    elif purchase.status == Purchase.STATUS_CANCELLED:
        purchase.items.update(item_status=PurchaseItem.ITEM_CANCELLED, received_date=None)
    elif purchase.status in {Purchase.STATUS_DRAFT, Purchase.STATUS_ORDERED}:
        purchase.items.update(item_status=PurchaseItem.ITEM_PENDING, received_date=None)


def set_item_payload_value(item, field_name, value):
    if isinstance(item, dict):
        item[field_name] = value
    else:
        setattr(item, field_name, value)


def get_item_payload_value(item, field_name):
    if isinstance(item, dict):
        return item.get(field_name)

    return getattr(item, field_name)


def get_purchase_item_status_for_transaction_status(status):
    if status == Purchase.STATUS_RECEIVED:
        return PurchaseItem.ITEM_RECEIVED
    if status == Purchase.STATUS_CANCELLED:
        return PurchaseItem.ITEM_CANCELLED
    return PurchaseItem.ITEM_PENDING


def get_purchase_item_payload_status(item):
    if isinstance(item, dict):
        status = item.get("item_status") or item.get("status")
    else:
        status = item.item_status

    return status if status in PURCHASE_ITEM_STATUSES else PurchaseItem.ITEM_PENDING


def has_purchase_item_payload_status(item):
    if isinstance(item, dict):
        return bool(item.get("item_status") or item.get("status"))

    return bool(getattr(item, "item_status", None))


def apply_purchase_item_status_dates(item, item_status, today=None):
    today = today or timezone.localdate()

    if item_status == PurchaseItem.ITEM_RECEIVED:
        received_date = get_item_payload_value(item, "received_date")
        set_item_payload_value(item, "received_date", received_date or today)
        return

    set_item_payload_value(item, "received_date", None)


def get_purchase_status_from_item_statuses(
    item_statuses,
    fallback_status=Purchase.STATUS_ORDERED,
):
    if not item_statuses:
        return fallback_status or Purchase.STATUS_ORDERED

    active_statuses = [
        status for status in item_statuses if status != PurchaseItem.ITEM_CANCELLED
    ]

    if all(status == PurchaseItem.ITEM_CANCELLED for status in item_statuses):
        return Purchase.STATUS_CANCELLED

    if not active_statuses:
        return Purchase.STATUS_CANCELLED

    if all(status == PurchaseItem.ITEM_RECEIVED for status in active_statuses):
        return Purchase.STATUS_RECEIVED

    if any(status == PurchaseItem.ITEM_RECEIVED for status in active_statuses):
        return Purchase.STATUS_PARTIALLY_RECEIVED

    if fallback_status == Purchase.STATUS_DRAFT:
        return Purchase.STATUS_DRAFT

    return Purchase.STATUS_ORDERED


def get_purchase_status_from_items(items, fallback_status=Purchase.STATUS_ORDERED):
    return get_purchase_status_from_item_statuses(
        [get_purchase_item_payload_status(item) for item in items or []],
        fallback_status=fallback_status,
    )


def normalize_purchase_items_for_status(items, purchase_status):
    if items is None:
        return purchase_status

    today = timezone.localdate()
    has_explicit_item_statuses = any(has_purchase_item_payload_status(item) for item in items)
    if (
        purchase_status in PURCHASE_FULL_TRANSACTION_STATUSES
        and not has_explicit_item_statuses
    ):
        item_status = get_purchase_item_status_for_transaction_status(purchase_status)
        for item in items:
            set_item_payload_value(item, "item_status", item_status)
            apply_purchase_item_status_dates(item, item_status, today)
        return purchase_status

    for item in items:
        item_status = get_purchase_item_payload_status(item)
        set_item_payload_value(item, "item_status", item_status)
        apply_purchase_item_status_dates(item, item_status, today)

    return get_purchase_status_from_items(items, fallback_status=purchase_status)


def get_sale_item_status_for_transaction_status(status):
    if status == Sale.STATUS_DELIVERED:
        return SaleItem.ITEM_DELIVERED
    if status == Sale.STATUS_SHIPPED:
        return SaleItem.ITEM_SHIPPED
    if status == Sale.STATUS_PACKED:
        return SaleItem.ITEM_PACKED
    if status == Sale.STATUS_CANCELLED:
        return SaleItem.ITEM_CANCELLED
    return SaleItem.ITEM_PENDING


def get_sale_item_payload_status(item):
    if isinstance(item, dict):
        status = item.get("item_status") or item.get("status")
    else:
        status = item.item_status

    return status if status in SALE_ITEM_STATUSES else SaleItem.ITEM_PENDING


def has_sale_item_payload_status(item):
    if isinstance(item, dict):
        return bool(item.get("item_status") or item.get("status"))

    return bool(getattr(item, "item_status", None))


def set_sale_item_payload_value(item, field_name, value):
    if isinstance(item, dict):
        item[field_name] = value
    else:
        setattr(item, field_name, value)


def get_sale_item_payload_value(item, field_name):
    if isinstance(item, dict):
        return item.get(field_name)

    return getattr(item, field_name)


def apply_sale_item_status_dates(item, item_status, today=None):
    today = today or timezone.localdate()

    if item_status == SaleItem.ITEM_DELIVERED:
        shipped_date = get_sale_item_payload_value(item, "shipped_date")
        delivered_date = get_sale_item_payload_value(item, "delivered_date")
        set_sale_item_payload_value(item, "shipped_date", shipped_date or today)
        set_sale_item_payload_value(item, "delivered_date", delivered_date or today)
        return

    if item_status == SaleItem.ITEM_SHIPPED:
        shipped_date = get_sale_item_payload_value(item, "shipped_date")
        set_sale_item_payload_value(item, "shipped_date", shipped_date or today)
        set_sale_item_payload_value(item, "delivered_date", None)
        return

    set_sale_item_payload_value(item, "shipped_date", None)
    set_sale_item_payload_value(item, "delivered_date", None)


def get_sale_status_from_item_statuses(item_statuses, fallback_status=Sale.STATUS_DRAFT):
    if not item_statuses:
        return fallback_status or Sale.STATUS_DRAFT

    active_statuses = [
        status for status in item_statuses if status != SaleItem.ITEM_CANCELLED
    ]

    if all(status == SaleItem.ITEM_CANCELLED for status in item_statuses):
        return Sale.STATUS_CANCELLED

    if not active_statuses:
        return Sale.STATUS_CANCELLED

    if all(status == SaleItem.ITEM_DELIVERED for status in active_statuses):
        return Sale.STATUS_DELIVERED

    if any(status == SaleItem.ITEM_DELIVERED for status in active_statuses):
        return Sale.STATUS_PARTIALLY_DELIVERED

    if all(status == SaleItem.ITEM_SHIPPED for status in active_statuses):
        return Sale.STATUS_SHIPPED

    if any(status == SaleItem.ITEM_SHIPPED for status in active_statuses):
        return Sale.STATUS_PARTIALLY_SHIPPED

    if all(status == SaleItem.ITEM_PACKED for status in active_statuses):
        return Sale.STATUS_PACKED

    if any(status == SaleItem.ITEM_PACKED for status in active_statuses):
        return Sale.STATUS_PARTIALLY_PACKED

    return Sale.STATUS_DRAFT


def get_sale_status_from_items(items, fallback_status=Sale.STATUS_DRAFT):
    return get_sale_status_from_item_statuses(
        [get_sale_item_payload_status(item) for item in items or []],
        fallback_status=fallback_status,
    )


def normalize_sale_items_for_status(items, sale_status):
    if items is None:
        return sale_status

    today = timezone.localdate()
    has_explicit_item_statuses = any(has_sale_item_payload_status(item) for item in items)
    if (
        sale_status in SALE_FULL_TRANSACTION_STATUSES - {Sale.STATUS_DRAFT}
        and not has_explicit_item_statuses
    ):
        item_status = get_sale_item_status_for_transaction_status(sale_status)
        for item in items:
            set_sale_item_payload_value(item, "item_status", item_status)
            apply_sale_item_status_dates(item, item_status, today)
        return sale_status

    for item in items:
        item_status = get_sale_item_payload_status(item)
        set_sale_item_payload_value(item, "item_status", item_status)
        apply_sale_item_status_dates(item, item_status, today)

    return get_sale_status_from_items(items, fallback_status=sale_status)


def apply_sale_status_to_items(sale):
    if sale.status in {
        Sale.STATUS_PARTIALLY_PACKED,
        Sale.STATUS_PARTIALLY_SHIPPED,
        Sale.STATUS_PARTIALLY_DELIVERED,
    }:
        return

    today = timezone.localdate()
    item_status = get_sale_item_status_for_transaction_status(sale.status)

    updates = {"item_status": item_status}
    if item_status == SaleItem.ITEM_DELIVERED:
        updates.update({"shipped_date": today, "delivered_date": today})
    elif item_status == SaleItem.ITEM_SHIPPED:
        updates.update({"shipped_date": today, "delivered_date": None})
    else:
        updates.update({"shipped_date": None, "delivered_date": None})

    sale.items.update(**updates)


def create_empty_stock_row(product):
    return {
        "product_id": product.id,
        "product_name": product.product_name,
        "sku": product.sku,
        "category": (
            product.category_name
            or (product.category.name if product.category else "")
        ),
        "unit": product.stock_base_unit,
        "reorder_level": product.reorder_level or Decimal("0"),
        "predicted_7_day_demand": Decimal("0"),
        "received_purchase_units": Decimal("0"),
        "received_purchase_value": Decimal("0"),
        "allocated_sales_units": Decimal("0"),
        "committed_sales_value": Decimal("0"),
        "pending_sales_units": Decimal("0"),
        "oversold_units": Decimal("0"),
        "sales_history_units": Decimal("0"),
        "sales_history_dates": [],
        "pending_purchase_units": Decimal("0"),
        "delayed_purchase_units": Decimal("0"),
        "lead_time_sample_days": Decimal("0"),
        "lead_time_sample_count": 0,
    }


def build_stock_report():
    today = timezone.localdate()
    product_rows = {
        product.id: create_empty_stock_row(product)
        for product in Product.objects.select_related("category").all()
    }

    purchase_items = PurchaseItem.objects.select_related("purchase", "product").filter(
        product_id__isnull=False,
    )
    for item in purchase_items:
        row = product_rows.get(item.product_id)
        if not row:
            continue

        quantity = item.base_quantity or Decimal("0")
        if item.item_status == PurchaseItem.ITEM_RECEIVED:
            row["received_purchase_units"] += quantity
            row["received_purchase_value"] += item.amount or Decimal("0")

            lead_time_days = compute_date_diff_in_days(
                item.purchase.transaction_date,
                item.received_date,
            )
            if lead_time_days is not None:
                row["lead_time_sample_days"] += Decimal(lead_time_days)
                row["lead_time_sample_count"] += 1
        elif item.item_status == PurchaseItem.ITEM_PENDING:
            if item.expected_delivery_date and item.expected_delivery_date < today:
                row["delayed_purchase_units"] += quantity
            else:
                row["pending_purchase_units"] += quantity

    sale_items = SaleItem.objects.select_related("sale", "product").filter(
        product_id__isnull=False,
    )
    for item in sale_items:
        row = product_rows.get(item.product_id)
        if not row or item.sale.status == Sale.STATUS_CANCELLED:
            continue

        quantity = item.base_quantity or Decimal("0")
        if item.item_status in SALE_STOCK_DEDUCTED_STATUSES:
            row["allocated_sales_units"] += quantity
            row["committed_sales_value"] += item.amount or Decimal("0")
            row["sales_history_units"] += quantity
            if item.sale.transaction_date:
                row["sales_history_dates"].append(item.sale.transaction_date)
        elif item.item_status == SaleItem.ITEM_PENDING:
            row["pending_sales_units"] += quantity

    rows = []
    for row in product_rows.values():
        raw_available_stock = row["received_purchase_units"] - row["allocated_sales_units"]
        available_stock = max(Decimal("0"), raw_available_stock)
        oversold_units = max(Decimal("0"), -raw_available_stock)
        average_unit_cost = (
            row["received_purchase_value"] / row["received_purchase_units"]
            if row["received_purchase_units"] > 0
            else Decimal("0")
        )
        average_lead_time_days = (
            row["lead_time_sample_days"] / Decimal(row["lead_time_sample_count"])
            if row["lead_time_sample_count"] > 0
            else None
        )
        sales_history_days = compute_date_span_days(row["sales_history_dates"])
        average_daily_demand = (
            row["sales_history_units"] / Decimal(sales_history_days)
            if row["sales_history_units"] > 0 and sales_history_days > 0
            else Decimal("0")
        )
        lead_time_demand = (
            average_daily_demand * average_lead_time_days
            if average_lead_time_days is not None and average_daily_demand > 0
            else Decimal("0")
        )
        safety_stock = average_daily_demand * Decimal(SAFETY_STOCK_DAYS)
        calculated_reorder_level = Decimal(math.ceil(lead_time_demand + safety_stock))
        reorder_level = calculated_reorder_level or row["reorder_level"]
        recommended_restock = max(
            Decimal("0"),
            reorder_level
            + row["pending_sales_units"]
            + oversold_units
            - available_stock
            - row["pending_purchase_units"],
        )
        days_until_stockout = (
            math.floor(available_stock / average_daily_demand)
            if average_daily_demand > 0
            else None
        )
        predicted_7_day_demand = average_daily_demand * Decimal("7")
        stock_value = available_stock * average_unit_cost

        rows.append(
            {
                "product_id": row["product_id"],
                "product_name": row["product_name"],
                "sku": row["sku"],
                "category": row["category"],
                "unit": row["unit"],
                "current_stock": as_number(available_stock),
                "available_stock": as_number(available_stock),
                "reorder_level": as_number(reorder_level),
                "predicted_7_day_demand": as_number(predicted_7_day_demand),
                "days_until_stockout": days_until_stockout,
                "recommended_restock": as_number(recommended_restock),
                "stock_value": as_number(stock_value),
                "total_cost": as_number(stock_value),
                "received_purchase_units": as_number(row["received_purchase_units"]),
                "received_purchase_value": as_number(row["received_purchase_value"]),
                "allocated_sales_units": as_number(row["allocated_sales_units"]),
                "committed_sales_value": as_number(row["committed_sales_value"]),
                "pending_sales_units": as_number(row["pending_sales_units"]),
                "oversold_units": as_number(oversold_units),
                "sales_history_units": as_number(row["sales_history_units"]),
                "pending_purchase_units": as_number(row["pending_purchase_units"]),
                "delayed_purchase_units": as_number(row["delayed_purchase_units"]),
                "incoming_purchase_units": as_number(
                    row["pending_purchase_units"] + row["delayed_purchase_units"]
                ),
                "average_daily_demand": as_number(average_daily_demand),
                "average_unit_cost": as_number(average_unit_cost),
                "average_lead_time_days": (
                    as_number(average_lead_time_days.quantize(Decimal("0.1")))
                    if average_lead_time_days is not None
                    else None
                ),
                "safety_stock": math.ceil(safety_stock),
                "safety_stock_days": SAFETY_STOCK_DAYS,
                "backend_calculated": True,
            }
        )

    return rows


def serialize_light_purchase(purchase, request=None):
    from .serializers import PurchaseSerializer

    return PurchaseSerializer(purchase, context={"request": request}).data


def serialize_light_sale(sale, request=None):
    from .serializers import SaleSerializer

    return SaleSerializer(sale, context={"request": request}).data


def get_query_terms(question):
    normalized = re.sub(r"\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b", " ", question or "")
    normalized = re.sub(r"[^0-9a-zA-Zก-๙_-]+", " ", normalized).lower()
    terms = [
        term
        for term in normalized.split()
        if len(term) >= 3 and term not in CHAT_STOP_WORDS
    ]
    return terms[:8]


def get_date_interval(question):
    raw_dates = re.findall(r"\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b", question or "")
    dates = []
    for raw_date in raw_dates[:2]:
        parsed_date = parse_date(raw_date.replace("/", "-"))
        if parsed_date:
            dates.append(parsed_date)

    if not dates:
        return None

    start_date = dates[0]
    end_date = dates[1] if len(dates) > 1 else dates[0]
    if end_date < start_date:
        start_date, end_date = end_date, start_date
    return {"start": start_date, "end": end_date}


def filter_by_date_interval(queryset, date_field, date_interval):
    if not date_interval:
        return queryset
    return queryset.filter(
        **{
            f"{date_field}__gte": date_interval["start"],
            f"{date_field}__lte": date_interval["end"],
        }
    )


def get_matching_partner_names(question, model):
    question_text = (question or "").lower()
    names = []
    for name in model.objects.values_list("company_name", flat=True):
        normalized_name = (name or "").strip()
        if normalized_name and normalized_name.lower() in question_text:
            names.append(normalized_name)
    return names


def build_text_query(terms, fields):
    query = Q()
    for term in terms:
        for field in fields:
            query |= Q(**{f"{field}__icontains": term})
    return query


def limited_unique_rows(primary_rows, fallback_rows, limit=8):
    rows = []
    seen = set()
    for row in list(primary_rows) + list(fallback_rows):
        key = getattr(row, "id", None)
        if key in seen:
            continue
        seen.add(key)
        rows.append(row)
        if len(rows) >= limit:
            break
    return rows


def serialize_purchase_for_chat(purchase):
    return {
        "id": purchase.id,
        "reference_no": purchase.reference_no,
        "supplier_name": purchase.supplier_name,
        "status": purchase.status,
        "transaction_date": purchase.transaction_date,
        "payment_term": {
            "type": purchase.payment_term_type,
            "days": purchase.payment_term_days,
            "date": purchase.payment_date,
        },
        "grand_total": as_number(purchase.grand_total),
        "note": purchase.note,
        "items": [
            {
                "product_name": item.product_name,
                "sku": item.sku,
                "status": item.item_status,
                "quantity": as_number(item.quantity),
                "unit": item.unit,
                "base_quantity": as_number(item.base_quantity),
                "base_unit": item.base_unit,
                "expected_delivery_date": item.expected_delivery_date,
                "received_date": item.received_date,
                "amount": as_number(item.amount),
            }
            for item in purchase.items.all()
        ],
    }


def serialize_sale_for_chat(sale):
    return {
        "id": sale.id,
        "reference_no": sale.reference_no,
        "customer_name": sale.customer_name,
        "status": sale.status,
        "transaction_date": sale.transaction_date,
        "payment_term": {
            "type": sale.payment_term_type,
            "days": sale.payment_term_days,
            "date": sale.payment_date,
        },
        "grand_total": as_number(sale.grand_total),
        "note": sale.note,
        "items": [
            {
                "product_name": item.product_name,
                "sku": item.sku,
                "status": item.item_status,
                "quantity": as_number(item.quantity),
                "unit": item.unit,
                "base_quantity": as_number(item.base_quantity),
                "base_unit": item.base_unit,
                "shipped_date": item.shipped_date,
                "delivered_date": item.delivered_date,
                "amount": as_number(item.amount),
            }
            for item in sale.items.all()
        ],
    }


def serialize_billing_note_for_chat(note):
    return {
        "id": note.id,
        "reference_no": note.reference_no,
        "customer_name": note.customer_name,
        "billing_note_date": note.billing_note_date,
        "expected_payment_date": note.expected_payment_date,
        "actual_payment_date": note.actual_payment_date,
        "status": note.status,
        "bank_reference": note.bank_reference,
        "total_amount": as_number(note.total_amount),
        "note": note.note,
        "lines": [
            {
                "sale_reference_no": line.sale.reference_no,
                "sale_status": line.sale.status,
                "received": line.received,
                "received_date": line.received_date,
                "amount": as_number(line.amount),
            }
            for line in note.lines.all()
        ],
    }


def serialize_payment_batch_for_chat(batch):
    return {
        "id": batch.id,
        "reference_no": batch.reference_no,
        "supplier_name": batch.supplier_name,
        "batch_date": batch.batch_date,
        "planned_payment_date": batch.planned_payment_date,
        "actual_payment_date": batch.actual_payment_date,
        "status": batch.status,
        "bank_reference": batch.bank_reference,
        "total_amount": as_number(batch.total_amount),
        "note": batch.note,
        "lines": [
            {
                "purchase_reference_no": line.purchase.reference_no,
                "purchase_status": line.purchase.status,
                "paid": line.paid,
                "paid_date": line.paid_date,
                "amount": as_number(line.amount),
            }
            for line in batch.lines.all()
        ],
    }


def serialize_quotation_for_chat(quotation):
    items = [
        {
            "product_name": item.product_name,
            "sku": item.sku,
            "unit": item.unit,
            "quantity": as_number(item.quantity),
            "sale_price": as_number(item.sale_price),
            "cost_price": None if item.cost_price is None else as_number(item.cost_price),
            "discounts": item.discounts or ["0"],
        }
        for item in quotation.line_items.all()[:8]
    ]

    return {
        "id": quotation.id,
        "reference_no": quotation.reference_no,
        "quotation_date": quotation.quotation_date,
        "valid_until_date": quotation.valid_until_date,
        "customer_name": quotation.customer_name,
        "supplier_name": quotation.supplier_name,
        "grand_total": as_number(quotation.grand_total),
        "note": quotation.note,
        "items": items,
    }


def build_dashboard_summary(request=None):
    stock_report = build_stock_report()
    low_stock_items = [
        {
            "product_id": row["product_id"],
            "product_name": row["product_name"],
            "current_stock": row["current_stock"],
            "available_stock": row["available_stock"],
            "reorder_level": row["reorder_level"],
            "unit": row["unit"],
        }
        for row in stock_report
        if Decimal(str(row["available_stock"])) <= Decimal(str(row["reorder_level"]))
    ]

    purchase_total = (
        Purchase.objects.exclude(status=Purchase.STATUS_CANCELLED).aggregate(
            total=Sum("grand_total")
        )["total"]
        or Decimal("0")
    )
    sales_total = (
        Sale.objects.exclude(status=Sale.STATUS_CANCELLED).aggregate(
            total=Sum("grand_total")
        )["total"]
        or Decimal("0")
    )
    recent_purchases = Purchase.objects.prefetch_related(
        Prefetch("items", queryset=PurchaseItem.objects.select_related("product")),
        "documents",
    ).order_by("-transaction_date", "-created_at")[:5]
    recent_sales = Sale.objects.prefetch_related(
        Prefetch("items", queryset=SaleItem.objects.select_related("product")),
        "documents",
    ).order_by("-transaction_date", "-created_at")[:5]

    return {
        "metrics": {
            "total_products": Product.objects.count(),
            "total_stock_units": as_number(
                sum(Decimal(str(row["available_stock"])) for row in stock_report)
            ),
            "total_stock_value": as_number(
                sum(Decimal(str(row["stock_value"])) for row in stock_report)
            ),
            "purchase_total": as_number(purchase_total),
            "sales_total": as_number(sales_total),
            "low_stock_count": len(low_stock_items),
        },
        "low_stock_items": low_stock_items[:10],
        "stock_report": stock_report,
        "recent_purchases": [
            serialize_light_purchase(purchase, request)
            for purchase in recent_purchases
        ],
        "recent_sales": [
            serialize_light_sale(sale, request)
            for sale in recent_sales
        ],
    }


SEGMENT_PERIOD_ORDER = ["1d", "2d", "5d", "1w", "2w", "1m", "3m", "6m", "1y"]
SEGMENT_PERIOD_DAYS = {
    "1d": 1,
    "2d": 2,
    "5d": 5,
    "1w": 7,
    "2w": 14,
    "1m": 30,
    "3m": 90,
    "6m": 180,
    "1y": 365,
}
SEGMENT_PERIOD_LABELS = {
    "1d": "Today",
    "2d": "Last 2 days",
    "5d": "Last 5 days",
    "1w": "Last week",
    "2w": "Last 2 weeks",
    "1m": "Last month",
    "3m": "Last 3 months",
    "6m": "Last 6 months",
    "1y": "Last year",
}
DEFAULT_SEGMENT_PERIOD = "1m"


def normalize_segment_period(period):
    return period if period in SEGMENT_PERIOD_DAYS else DEFAULT_SEGMENT_PERIOD


def get_segment_period_range(period, today=None):
    """Rolling window ending today. e.g. '1w' -> last 7 days incl. today."""
    today = today or timezone.localdate()
    days = SEGMENT_PERIOD_DAYS[normalize_segment_period(period)]
    return today - timedelta(days=days - 1), today


def build_finance_segment(period, today=None):
    """AR/AP, sales, purchases and gross margin for a rolling period window."""
    today = today or timezone.localdate()
    period = normalize_segment_period(period)
    start, end = get_segment_period_range(period, today)

    open_billing = BillingNote.objects.exclude(
        status__in=(BillingNote.STATUS_FULLY_RECEIVED, BillingNote.STATUS_CANCELLED)
    ).filter(billing_note_date__gte=start, billing_note_date__lte=end)
    ar_outstanding = open_billing.aggregate(total=Sum("total_amount"))["total"] or Decimal("0")
    ar_overdue = (
        open_billing.filter(expected_payment_date__lt=today).aggregate(
            total=Sum("total_amount")
        )["total"]
        or Decimal("0")
    )

    open_payment = PaymentBatch.objects.exclude(
        status__in=(PaymentBatch.STATUS_PAID, PaymentBatch.STATUS_CANCELLED)
    ).filter(batch_date__gte=start, batch_date__lte=end)
    ap_outstanding = open_payment.aggregate(total=Sum("total_amount"))["total"] or Decimal("0")
    ap_overdue = (
        open_payment.filter(planned_payment_date__lt=today).aggregate(
            total=Sum("total_amount")
        )["total"]
        or Decimal("0")
    )

    period_sales = Sale.objects.exclude(status=Sale.STATUS_CANCELLED).filter(
        transaction_date__gte=start, transaction_date__lte=end
    )
    period_purchases = Purchase.objects.exclude(status=Purchase.STATUS_CANCELLED).filter(
        transaction_date__gte=start, transaction_date__lte=end
    )
    sales_total = period_sales.aggregate(total=Sum("grand_total"))["total"] or Decimal("0")
    purchase_total = (
        period_purchases.aggregate(total=Sum("grand_total"))["total"] or Decimal("0")
    )

    sale_items = SaleItem.objects.filter(sale__in=period_sales).exclude(
        item_status="cancelled"
    )
    revenue = Decimal("0")
    cost = Decimal("0")
    for item in sale_items.iterator():
        qty = Decimal(str(item.quantity or 0))
        revenue += Decimal(str(item.amount or 0))
        cost += Decimal(str(item.unit_cost or 0)) * qty
    gross_margin = revenue - cost
    margin_pct = (gross_margin / revenue * 100) if revenue > 0 else Decimal("0")

    return {
        "period": period,
        "period_label": SEGMENT_PERIOD_LABELS[period],
        "period_start": start.isoformat(),
        "period_end": end.isoformat(),
        "ar": {"outstanding": as_number(ar_outstanding), "overdue": as_number(ar_overdue)},
        "ap": {"outstanding": as_number(ap_outstanding), "overdue": as_number(ap_overdue)},
        "net_position": as_number(ar_outstanding - ap_outstanding),
        "sales_total": as_number(sales_total),
        "sales_count": period_sales.count(),
        "purchase_total": as_number(purchase_total),
        "purchase_count": period_purchases.count(),
        "gross_margin": as_number(gross_margin),
        "margin_pct": as_number(margin_pct.quantize(Decimal("0.1"))),
    }


def _trend_granularity(days):
    if days <= 14:
        return "day"
    if days <= 90:
        return "week"
    return "month"


def _build_trend_buckets(start, end, granularity):
    """Ordered list of {label, key, start, end} spanning [start, end]."""
    buckets = []
    if granularity == "day":
        current = start
        while current <= end:
            buckets.append(
                {"key": current.isoformat(), "label": f"{current.day}/{current.month}",
                 "start": current, "end": current}
            )
            current += timedelta(days=1)
    elif granularity == "week":
        current = start
        while current <= end:
            chunk_end = min(current + timedelta(days=6), end)
            buckets.append(
                {"key": current.isoformat(), "label": f"{current.day}/{current.month}",
                 "start": current, "end": chunk_end}
            )
            current = chunk_end + timedelta(days=1)
    else:  # month
        current = start.replace(day=1)
        while current <= end:
            if current.month == 12:
                next_month = current.replace(year=current.year + 1, month=1)
            else:
                next_month = current.replace(month=current.month + 1)
            buckets.append(
                {"key": current.isoformat(), "label": current.strftime("%b"),
                 "start": max(current, start), "end": min(next_month - timedelta(days=1), end)}
            )
            current = next_month
    return buckets


def build_trend_segment(period, today=None):
    """Sales vs purchases totals bucketed by day/week/month based on range."""
    today = today or timezone.localdate()
    period = normalize_segment_period(period)
    start, end = get_segment_period_range(period, today)
    granularity = _trend_granularity(SEGMENT_PERIOD_DAYS[period])

    sales_by_day = {
        row["transaction_date"]: row["total"] or Decimal("0")
        for row in Sale.objects.exclude(status=Sale.STATUS_CANCELLED)
        .filter(transaction_date__gte=start, transaction_date__lte=end)
        .values("transaction_date")
        .annotate(total=Sum("grand_total"))
    }
    purchases_by_day = {
        row["transaction_date"]: row["total"] or Decimal("0")
        for row in Purchase.objects.exclude(status=Purchase.STATUS_CANCELLED)
        .filter(transaction_date__gte=start, transaction_date__lte=end)
        .values("transaction_date")
        .annotate(total=Sum("grand_total"))
    }

    def _sum_range(by_day, range_start, range_end):
        total = Decimal("0")
        cursor = range_start
        while cursor <= range_end:
            total += by_day.get(cursor, Decimal("0"))
            cursor += timedelta(days=1)
        return total

    trend = [
        {
            "label": bucket["label"],
            "key": bucket["key"],
            "sales": as_number(_sum_range(sales_by_day, bucket["start"], bucket["end"])),
            "purchases": as_number(_sum_range(purchases_by_day, bucket["start"], bucket["end"])),
        }
        for bucket in _build_trend_buckets(start, end, granularity)
    ]

    return {
        "period": period,
        "period_label": SEGMENT_PERIOD_LABELS[period],
        "period_start": start.isoformat(),
        "period_end": end.isoformat(),
        "granularity": granularity,
        "trend": trend,
    }


def build_products_segment(period, today=None):
    """Top products by sales revenue for a rolling period window."""
    today = today or timezone.localdate()
    period = normalize_segment_period(period)
    start, end = get_segment_period_range(period, today)

    period_sales = Sale.objects.exclude(status=Sale.STATUS_CANCELLED).filter(
        transaction_date__gte=start, transaction_date__lte=end
    )
    sale_items = SaleItem.objects.filter(sale__in=period_sales).exclude(
        item_status="cancelled"
    )
    product_margin = {}
    for item in sale_items.iterator():
        qty = Decimal(str(item.quantity or 0))
        amount = Decimal(str(item.amount or 0))
        unit_cost = Decimal(str(item.unit_cost or 0))
        key = item.product_id or item.product_name
        bucket = product_margin.setdefault(
            key,
            {
                "product_id": item.product_id,
                "product_name": item.product_name,
                "sku": item.sku,
                "revenue": Decimal("0"),
                "cost": Decimal("0"),
                "units": Decimal("0"),
            },
        )
        bucket["revenue"] += amount
        bucket["cost"] += unit_cost * qty
        bucket["units"] += qty

    def _row(row):
        margin = row["revenue"] - row["cost"]
        return {
            "product_id": row["product_id"],
            "product_name": row["product_name"],
            "sku": row["sku"],
            "revenue": as_number(row["revenue"]),
            "cost": as_number(row["cost"]),
            "margin": as_number(margin),
            "units": as_number(row["units"]),
        }

    top_products = [
        _row(row)
        for row in sorted(
            product_margin.values(), key=lambda r: r["revenue"], reverse=True
        )[:8]
    ]

    return {
        "period": period,
        "period_label": SEGMENT_PERIOD_LABELS[period],
        "period_start": start.isoformat(),
        "period_end": end.isoformat(),
        "top_products": top_products,
    }


def build_dashboard_segment(segment, period, today=None):
    builders = {
        "finance": build_finance_segment,
        "trend": build_trend_segment,
        "products": build_products_segment,
    }
    builder = builders.get(segment)
    return builder(period, today) if builder else None


def build_dashboard_overview(period=DEFAULT_SEGMENT_PERIOD):
    """Initial payload: each box rendered at the default period, plus the
    list of period options every box's own filter can choose from."""
    today = timezone.localdate()
    return {
        "period_options": [
            {"value": key, "label": SEGMENT_PERIOD_LABELS[key]}
            for key in SEGMENT_PERIOD_ORDER
        ],
        "default_period": DEFAULT_SEGMENT_PERIOD,
        "finance": build_finance_segment(DEFAULT_SEGMENT_PERIOD, today),
        "trend": build_trend_segment(DEFAULT_SEGMENT_PERIOD, today),
        "products": build_products_segment(DEFAULT_SEGMENT_PERIOD, today),
    }


def build_ai_inventory_context(question, request=None):
    terms = get_query_terms(question)
    date_interval = get_date_interval(question)
    matching_customer_names = get_matching_partner_names(question, Customer)
    matching_supplier_names = get_matching_partner_names(question, Supplier)
    dashboard_summary = build_dashboard_summary(request)
    stock_report = dashboard_summary["stock_report"]

    product_query = build_text_query(terms, ["sku", "product_name", "category_name"])
    matching_products = Product.objects.filter(product_query) if terms else Product.objects.none()
    matching_product_ids = list(matching_products.values_list("id", flat=True)[:20])

    matching_stock_rows = [
        row
        for row in stock_report
        if row["product_id"] in matching_product_ids
        or any(
            term in f"{row['product_name']} {row['sku']} {row['category']}".lower()
            for term in terms
        )
    ][:12]
    low_stock_rows = [
        row
        for row in stock_report
        if Decimal(str(row["reorder_level"])) > 0
        and Decimal(str(row["available_stock"])) <= Decimal(str(row["reorder_level"]))
    ][:12]

    purchases = Purchase.objects.prefetch_related(
        Prefetch("items", queryset=PurchaseItem.objects.select_related("product")),
        "documents",
    )
    sales = Sale.objects.prefetch_related(
        Prefetch("items", queryset=SaleItem.objects.select_related("product")),
        "documents",
    )
    purchase_query = (
        Q(supplier_name__in=matching_supplier_names)
        if matching_supplier_names
        else build_text_query(terms, ["reference_no", "supplier_name", "supplier_tax_invoice", "note"])
    )
    sale_query = (
        Q(customer_name__in=matching_customer_names)
        if matching_customer_names
        else build_text_query(terms, ["reference_no", "customer_name", "note"])
    )
    if matching_customer_names or matching_supplier_names:
        quotation_query = Q()
        if matching_customer_names:
            quotation_query |= Q(customer_name__in=matching_customer_names)
        if matching_supplier_names:
            quotation_query |= Q(supplier_name__in=matching_supplier_names)
    else:
        quotation_query = build_text_query(terms, ["reference_no", "customer_name", "supplier_name", "note"])
    billing_query = (
        Q(customer_name__in=matching_customer_names)
        if matching_customer_names
        else build_text_query(terms, ["reference_no", "customer_name", "bank_reference", "note"])
    )
    payment_query = (
        Q(supplier_name__in=matching_supplier_names)
        if matching_supplier_names
        else build_text_query(terms, ["reference_no", "supplier_name", "bank_reference", "note"])
    )

    if matching_product_ids and not matching_customer_names and not matching_supplier_names:
        purchase_query |= Q(items__product_id__in=matching_product_ids) | Q(items__sku__in=[row["sku"] for row in matching_stock_rows])
        sale_query |= Q(items__product_id__in=matching_product_ids) | Q(items__sku__in=[row["sku"] for row in matching_stock_rows])

    date_filtered_purchases = filter_by_date_interval(purchases, "transaction_date", date_interval)
    date_filtered_sales = filter_by_date_interval(sales, "transaction_date", date_interval)
    matched_purchases = (
        date_filtered_purchases.filter(purchase_query).distinct()
        if terms
        else (date_filtered_purchases if date_interval else Purchase.objects.none())
    )
    matched_sales = (
        date_filtered_sales.filter(sale_query).distinct()
        if terms
        else (date_filtered_sales if date_interval else Sale.objects.none())
    )
    recent_purchases = date_filtered_purchases.order_by("-transaction_date", "-created_at")[:8]
    recent_sales = date_filtered_sales.order_by("-transaction_date", "-created_at")[:8]

    quotations = Quotation.objects.prefetch_related("line_items__product")
    billing_notes = BillingNote.objects.prefetch_related("lines__sale")
    payment_batches = PaymentBatch.objects.prefetch_related("lines__purchase")

    date_filtered_quotations = filter_by_date_interval(quotations, "quotation_date", date_interval)
    date_filtered_billing_notes = filter_by_date_interval(billing_notes, "billing_note_date", date_interval)
    date_filtered_payment_batches = filter_by_date_interval(payment_batches, "batch_date", date_interval)
    matched_quotations = (
        date_filtered_quotations.filter(quotation_query).distinct()
        if terms
        else (date_filtered_quotations if date_interval else Quotation.objects.none())
    )
    matched_billing_notes = (
        date_filtered_billing_notes.filter(billing_query).distinct()
        if terms
        else (date_filtered_billing_notes if date_interval else BillingNote.objects.none())
    )
    matched_payment_batches = (
        date_filtered_payment_batches.filter(payment_query).distinct()
        if terms
        else (date_filtered_payment_batches if date_interval else PaymentBatch.objects.none())
    )
    has_query_filter = bool(terms or date_interval or matching_customer_names or matching_supplier_names)
    purchase_fallback = [] if has_query_filter else recent_purchases
    sale_fallback = [] if has_query_filter else recent_sales
    quotation_fallback = (
        []
        if has_query_filter
        else date_filtered_quotations.order_by("-quotation_date", "-created_at")[:6]
    )
    billing_note_fallback = (
        []
        if has_query_filter
        else date_filtered_billing_notes.order_by("-billing_note_date", "-created_at")[:6]
    )
    payment_batch_fallback = (
        []
        if has_query_filter
        else date_filtered_payment_batches.order_by("-batch_date", "-created_at")[:6]
    )
    purchase_rows = [
        serialize_purchase_for_chat(purchase)
        for purchase in limited_unique_rows(matched_purchases, purchase_fallback, limit=8)
    ]
    sale_rows = [
        serialize_sale_for_chat(sale)
        for sale in limited_unique_rows(matched_sales, sale_fallback, limit=8)
    ]
    quotation_rows = [
        serialize_quotation_for_chat(quotation)
        for quotation in limited_unique_rows(matched_quotations, quotation_fallback, limit=6)
    ]
    billing_note_rows = [
        serialize_billing_note_for_chat(note)
        for note in limited_unique_rows(matched_billing_notes, billing_note_fallback, limit=6)
    ]
    payment_batch_rows = [
        serialize_payment_batch_for_chat(batch)
        for batch in limited_unique_rows(matched_payment_batches, payment_batch_fallback, limit=6)
    ]

    return {
        "query_terms": terms,
        "matched_customers": matching_customer_names,
        "matched_suppliers": matching_supplier_names,
        "today": timezone.localdate(),
        "date_interval": date_interval,
        "match_counts": {
            "products": matching_products.count() if terms else 0,
            "purchases": matched_purchases.count() if terms else 0,
            "sales": matched_sales.count() if terms else 0,
            "quotations": matched_quotations.count() if terms else 0,
            "billing_notes": matched_billing_notes.count() if terms else 0,
            "payment_batches": matched_payment_batches.count() if terms else 0,
        },
        "dashboard_metrics": dashboard_summary["metrics"],
        "stock": {
            "matching_rows": matching_stock_rows,
            "low_stock_rows": low_stock_rows,
        },
        "products": [
            {
                "id": product.id,
                "sku": product.sku,
                "product_name": product.product_name,
                "category": product.category_name,
                "stock_base_unit": product.stock_base_unit,
                "reorder_level": as_number(product.reorder_level),
                "detail": product.detail,
            }
            for product in limited_unique_rows(matching_products[:12], Product.objects.all()[:8], limit=12)
        ],
        "summaries": {
            "purchases": summarize_model_rows(matched_purchases, "grand_total", purchase_rows),
            "sales": summarize_model_rows(matched_sales, "grand_total", sale_rows),
            "quotations": summarize_model_rows(matched_quotations, "grand_total", quotation_rows),
            "billing_notes": summarize_model_rows(matched_billing_notes, "total_amount", billing_note_rows),
            "payment_batches": summarize_model_rows(matched_payment_batches, "total_amount", payment_batch_rows),
        },
        "purchases": purchase_rows,
        "sales": sale_rows,
        "quotations": quotation_rows,
        "billing_notes": billing_note_rows,
        "payment_batches": payment_batch_rows,
    }


def format_transaction_line(row, party_key):
    return (
        f"{row['reference_no'] or row['id']}: {row[party_key]}, {row['status']}, "
        f"total {row.get('grand_total', row.get('total_amount'))}."
    )


def summarize_money_rows(rows, amount_key="grand_total"):
    rows = list(rows)
    active_rows = [row for row in rows if row.get("status") != "cancelled"]
    return {
        "count": len(rows),
        "active_count": len(active_rows),
        "cancelled_count": len(rows) - len(active_rows),
        "total": as_number(sum(Decimal(str(row.get(amount_key) or 0)) for row in rows)),
        "active_total": as_number(sum(Decimal(str(row.get(amount_key) or 0)) for row in active_rows)),
    }


def summarize_model_rows(queryset, amount_attr="grand_total", fallback_rows=None):
    rows = list(queryset)
    if not rows and fallback_rows is not None:
        return summarize_money_rows(fallback_rows, amount_key=amount_attr)

    active_rows = [row for row in rows if getattr(row, "status", "") != "cancelled"]
    return {
        "count": len(rows),
        "active_count": len(active_rows),
        "cancelled_count": len(rows) - len(active_rows),
        "total": as_number(sum(getattr(row, amount_attr, Decimal("0")) or Decimal("0") for row in rows)),
        "active_total": as_number(
            sum(getattr(row, amount_attr, Decimal("0")) or Decimal("0") for row in active_rows)
        ),
    }


def date_interval_label(date_interval):
    if not date_interval:
        return ""
    start = date_interval["start"].isoformat()
    end = date_interval["end"].isoformat()
    return start if start == end else f"{start} to {end}"


def build_transaction_summary_answer(label, rows, party_key, date_interval=None, summary=None):
    if not rows:
        scope = f" for {date_interval_label(date_interval)}" if date_interval else ""
        return f"No {label.lower()} records were found{scope}."

    summary = summary or summarize_money_rows(rows)
    scope = f" for {date_interval_label(date_interval)}" if date_interval else ""
    lines = " ".join(format_transaction_line(row, party_key) for row in rows[:5])
    return (
        f"{label} summary{scope}: {summary['count']} records, "
        f"{summary['active_count']} active, total {summary['total']}, "
        f"active total {summary['active_total']}. {lines}"
    )


def get_reference_prefix(terms):
    for term in terms:
        upper_term = term.upper()
        for prefix in ["PO", "TI", "BN", "PMT", "QT"]:
            if upper_term.startswith(f"{prefix}-"):
                return prefix
    return ""


def matched_rows(context, key):
    count = context["match_counts"].get(key, 0)
    return context[key][:count] if count else []


def build_local_chat_answer(question, context=None):
    context = context or build_ai_inventory_context(question)
    low_stock = context["stock"]["low_stock_rows"]
    matching_stock = context["stock"]["matching_rows"]
    question_text = question.lower()
    reference_like = any("-" in term and any(char.isdigit() for char in term) for term in context["query_terms"])
    reference_prefix = get_reference_prefix(context["query_terms"])

    if "low" in question_text or "restock" in question_text:
        if not low_stock:
            return "No low-stock products were found from the current inventory data."
        lines = [
            (
                f"{row['product_name']} has {row['available_stock']} {row['unit']} available, "
                f"reorder level {row['reorder_level']}, suggested restock {row['recommended_restock']}."
            )
            for row in low_stock[:5]
        ]
        return "Products needing attention: " + " ".join(lines)

    if matching_stock and any(word in question_text for word in ["product", "sku", "stock", "restock", "reorder"]):
        lines = [
            (
                f"{row['product_name']} ({row['sku']}) has {row['available_stock']} "
                f"{row['unit']} available, reorder level {row['reorder_level']}, "
                f"suggested restock {row['recommended_restock']}."
            )
            for row in matching_stock[:5]
        ]
        return "Matching stock details: " + " ".join(lines)

    if "stock" in question_text:
        if not low_stock:
            return "No low-stock products were found from the current inventory data."
        lines = [
            f"{row['product_name']} has {row['available_stock']} {row['unit']} available."
            for row in low_stock[:5]
        ]
        return "Products needing attention: " + " ".join(lines)

    if reference_like:
        if reference_prefix == "PO" and matched_rows(context, "purchases"):
            return "Purchase summary: " + " ".join(
                format_transaction_line(purchase, "supplier_name")
                for purchase in matched_rows(context, "purchases")[:5]
            )
        if reference_prefix == "TI" and matched_rows(context, "sales"):
            return "Sales summary: " + " ".join(
                format_transaction_line(sale, "customer_name")
                for sale in matched_rows(context, "sales")[:5]
            )
        if reference_prefix == "BN" and matched_rows(context, "billing_notes"):
            return "Billing note summary: " + " ".join(
                f"{note['reference_no'] or note['id']}: {note['customer_name']}, {note['status']}, total {note['total_amount']}."
                for note in matched_rows(context, "billing_notes")[:5]
            )
        if reference_prefix == "PMT" and matched_rows(context, "payment_batches"):
            return "Payment batch summary: " + " ".join(
                f"{batch['reference_no'] or batch['id']}: {batch['supplier_name']}, {batch['status']}, total {batch['total_amount']}."
                for batch in matched_rows(context, "payment_batches")[:5]
            )
        if reference_prefix == "QT" and matched_rows(context, "quotations"):
            return "Quotation summary: " + " ".join(
                f"{quotation['reference_no'] or quotation['id']}: {quotation['customer_name'] or quotation['supplier_name']}, total {quotation['grand_total']}."
                for quotation in matched_rows(context, "quotations")[:5]
            )
        if matched_rows(context, "purchases"):
            return "Purchase summary: " + " ".join(
                format_transaction_line(purchase, "supplier_name")
                for purchase in matched_rows(context, "purchases")[:5]
            )
        if matched_rows(context, "sales"):
            return "Sales summary: " + " ".join(
                format_transaction_line(sale, "customer_name")
                for sale in matched_rows(context, "sales")[:5]
            )
        if matched_rows(context, "billing_notes"):
            return "Billing note summary: " + " ".join(
                f"{note['reference_no'] or note['id']}: {note['customer_name']}, {note['status']}, total {note['total_amount']}."
                for note in matched_rows(context, "billing_notes")[:5]
            )
        if matched_rows(context, "payment_batches"):
            return "Payment batch summary: " + " ".join(
                f"{batch['reference_no'] or batch['id']}: {batch['supplier_name']}, {batch['status']}, total {batch['total_amount']}."
                for batch in matched_rows(context, "payment_batches")[:5]
            )
        return "I could not find a matching reference number in the current inventory data."

    if "sale" in question_text:
        if not context["sales"]:
            return "No sales transactions are stored yet."
        return build_transaction_summary_answer(
            "Sales",
            context["sales"],
            "customer_name",
            context["date_interval"],
            context["summaries"]["sales"],
        )

    if "purchase" in question_text:
        if not context["purchases"]:
            return "No purchase transactions are stored yet."
        return build_transaction_summary_answer(
            "Purchase",
            context["purchases"],
            "supplier_name",
            context["date_interval"],
            context["summaries"]["purchases"],
        )

    if "billing" in question_text:
        if not context["billing_notes"]:
            return "No billing notes are stored yet."
        return "Billing note summary: " + " ".join(
            f"{note['reference_no'] or note['id']}: {note['customer_name']}, {note['status']}, total {note['total_amount']}."
            for note in context["billing_notes"][:5]
        )

    if "payment" in question_text or "paid" in question_text:
        if not context["payment_batches"]:
            return "No payment batches are stored yet."
        return "Payment batch summary: " + " ".join(
            f"{batch['reference_no'] or batch['id']}: {batch['supplier_name']}, {batch['status']}, total {batch['total_amount']}."
            for batch in context["payment_batches"][:5]
        )

    return (
        "I can summarize stock, restock needs, products, sales, purchases, quotations, "
        "billing notes, and payment batches. Include a reference number, SKU, product, "
        "customer, or supplier name for a more specific answer."
    )


def answer_inventory_question(question, request=None):
    context = build_ai_inventory_context(question, request)
    if not settings.OPENAI_API_KEY:
        return {
            "answer": build_local_chat_answer(question, context),
            "used_model": "local-summary",
        }

    from openai import OpenAI

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    response = client.responses.create(
        model=settings.OPENAI_MODEL,
        instructions=(
            "You are a read-only inventory assistant. Answer only from the provided app data. "
            "If the data is missing, say that clearly. Keep answers concise and practical."
        ),
        input=(
            f"User question:\n{question}\n\n"
            f"Inventory app data:\n{json.dumps(context, default=str, ensure_ascii=False)}"
        ),
    )

    return {
        "answer": response.output_text,
        "used_model": settings.OPENAI_MODEL,
    }
