"""Dashboard summary and segment services."""

from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.db.models import Count, Prefetch, Sum
from django.utils import timezone

from ..models import (
    BillingNote,
    PaymentBatch,
    Product,
    Purchase,
    PurchaseItem,
    Sale,
    SaleItem,
    SaleItemAllocation,
)
from .common import as_number
from .stock import (
    build_stock_report,
    get_available_stock_by_product_id,
    get_sale_item_allocated_cost,
)
from .transactions import (
    SALE_INACTIVE_ITEM_STATUSES,
    SALE_INACTIVE_TRANSACTION_STATUSES,
    SALE_STOCK_DEDUCTED_STATUSES,
)


# Dashboard funnel stages. These MUST mirror the frontend's stage maps in
# Dashboard.jsx so the funnel numbers (computed here over ALL records) equal what
# the purchase/sales page shows when a stage is opened by its statuses.
DASHBOARD_PURCHASE_STAGES = [
    ("draft", ["draft"]),
    ("ordered", ["ordered"]),
    ("receiving", ["partially_received"]),
]
DASHBOARD_DELIVERY_STAGES = [
    ("draft", ["draft"]),
    ("packing", ["partially_packed", "packed"]),
    ("delivering", ["partially_shipped", "shipped", "partially_delivered"]),
]
# Open = appears in some funnel stage (i.e. not a closed/terminal status).
DASHBOARD_OPEN_PURCHASE_STATUSES = [s for _, statuses in DASHBOARD_PURCHASE_STAGES for s in statuses]
DASHBOARD_OPEN_SALE_STATUSES = [s for _, statuses in DASHBOARD_DELIVERY_STAGES for s in statuses]
DASHBOARD_FUNNEL_LIST_LIMIT = 12

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

CASHFLOW_FORECAST_MONTHS = 6
ORDER_COVERAGE_POPULAR_LIMIT = 5
# Look-back windows for the "popular products" panel, 1 day … 3 years (max).
POPULAR_WINDOWS = (
    {"key": "1d", "label": "1D", "days": 1},
    {"key": "1w", "label": "1W", "days": 7},
    {"key": "1m", "label": "1M", "days": 30},
    {"key": "3m", "label": "3M", "days": 90},
    {"key": "1y", "label": "1Y", "days": 365},
    {"key": "3y", "label": "3Y", "days": 1095},
)


def serialize_light_purchase(purchase, request=None):
    from ..serializers import PurchaseSerializer

    return PurchaseSerializer(purchase, context={"request": request}).data


def serialize_light_sale(sale, request=None):
    from ..serializers import SaleSerializer

    return SaleSerializer(sale, context={"request": request}).data


def _funnel_stage_counts(status_counts, stages):
    """Sum per-status DB counts into the funnel stage buckets."""
    return {
        stage_key: sum(status_counts.get(status, 0) for status in statuses)
        for stage_key, statuses in stages
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
        Sale.objects.exclude(status__in=SALE_INACTIVE_TRANSACTION_STATUSES).aggregate(
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

    # ── Procurement / delivery funnels ──────────────────────────────────
    # Counts are computed over EVERY purchase/sale (not the paginated list the
    # frontend holds), so each funnel number equals the rows the purchase/sales
    # page returns when that stage is opened. The lists are the oldest open
    # orders, mirroring the frontend's "oldest first" display order.
    purchase_status_counts = {
        row["status"]: row["count"]
        for row in Purchase.objects.values("status").annotate(count=Count("id"))
    }
    sale_status_counts = {
        row["status"]: row["count"]
        for row in Sale.objects.values("status").annotate(count=Count("id"))
    }
    open_purchases = (
        Purchase.objects.filter(status__in=DASHBOARD_OPEN_PURCHASE_STATUSES)
        .prefetch_related(
            Prefetch("items", queryset=PurchaseItem.objects.select_related("product")),
            "documents",
        )
        .order_by("transaction_date", "created_at")[:DASHBOARD_FUNNEL_LIST_LIMIT]
    )
    open_sales = (
        Sale.objects.filter(status__in=DASHBOARD_OPEN_SALE_STATUSES)
        .prefetch_related(
            Prefetch("items", queryset=SaleItem.objects.select_related("product")),
            "documents",
        )
        .order_by("transaction_date", "created_at")[:DASHBOARD_FUNNEL_LIST_LIMIT]
    )

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
        "order_planning": {
            "stages": _funnel_stage_counts(purchase_status_counts, DASHBOARD_PURCHASE_STAGES),
            "orders": [serialize_light_purchase(purchase, request) for purchase in open_purchases],
        },
        "delivery_planning": {
            "stages": _funnel_stage_counts(sale_status_counts, DASHBOARD_DELIVERY_STAGES),
            "orders": [serialize_light_sale(sale, request) for sale in open_sales],
        },
    }


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

    period_sales = Sale.objects.exclude(status__in=SALE_INACTIVE_TRANSACTION_STATUSES).filter(
        transaction_date__gte=start, transaction_date__lte=end
    )
    period_purchases = Purchase.objects.exclude(status=Purchase.STATUS_CANCELLED).filter(
        transaction_date__gte=start, transaction_date__lte=end
    )
    sales_total = period_sales.aggregate(total=Sum("grand_total"))["total"] or Decimal("0")
    purchase_total = (
        period_purchases.aggregate(total=Sum("grand_total"))["total"] or Decimal("0")
    )

    sale_items = (
        SaleItem.objects.filter(sale__in=period_sales)
        .exclude(item_status__in=SALE_INACTIVE_ITEM_STATUSES)
        .prefetch_related(
            Prefetch("allocations", queryset=SaleItemAllocation.objects.all(), to_attr="prefetched_allocations")
        )
    )
    revenue = Decimal("0")
    cost = Decimal("0")
    for item in sale_items.iterator(chunk_size=500):
        revenue += Decimal(str(item.amount or 0))
        cost += get_sale_item_allocated_cost(item)
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
        for row in Sale.objects.exclude(status__in=SALE_INACTIVE_TRANSACTION_STATUSES)
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

    period_sales = Sale.objects.exclude(status__in=SALE_INACTIVE_TRANSACTION_STATUSES).filter(
        transaction_date__gte=start, transaction_date__lte=end
    )
    sale_items = (
        SaleItem.objects.filter(sale__in=period_sales)
        .exclude(item_status__in=SALE_INACTIVE_ITEM_STATUSES)
        .prefetch_related(
            Prefetch("allocations", queryset=SaleItemAllocation.objects.all(), to_attr="prefetched_allocations")
        )
    )
    product_margin = {}
    for item in sale_items.iterator(chunk_size=500):
        qty = Decimal(str(item.quantity or 0))
        amount = Decimal(str(item.amount or 0))
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
        bucket["cost"] += get_sale_item_allocated_cost(item)
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


def _add_months(d, months):
    """Return ``d`` shifted by ``months`` whole months, snapped to the 1st."""
    total = d.month - 1 + months
    year = d.year + total // 12
    month = total % 12 + 1
    return d.replace(year=year, month=month, day=1)


def build_cashflow_segment(period=None, today=None):
    """Forward-looking cash forecast for the dashboard footer.

    Buckets open receivables (money in, by ``expected_payment_date``) and open
    payables (money out, by ``planned_payment_date``) into an Overdue bucket
    plus the next ``CASHFLOW_FORECAST_MONTHS`` calendar months, so a middle-man
    trader can spot the months where cash dips before it bites. The first month
    runs from today to month-end (earlier-due amounts sit in Overdue); the rest
    are whole calendar months. Also returns point-in-time open balances consumed
    by the dashboard KPI ribbon.

    Open AR/AP mirror the definitions used by :func:`build_finance_segment`.
    ``period`` is accepted for a uniform segment-builder signature but ignored —
    this view is horizon-based, not a rolling window.
    """
    today = today or timezone.localdate()

    open_billing = BillingNote.objects.exclude(
        status__in=(BillingNote.STATUS_FULLY_RECEIVED, BillingNote.STATUS_CANCELLED)
    )
    open_payment = PaymentBatch.objects.exclude(
        status__in=(PaymentBatch.STATUS_PAID, PaymentBatch.STATUS_CANCELLED)
    )

    ar_total_open = open_billing.aggregate(total=Sum("total_amount"))["total"] or Decimal("0")
    ap_total_open = open_payment.aggregate(total=Sum("total_amount"))["total"] or Decimal("0")

    ar_by_date = {
        row["expected_payment_date"]: row["total"] or Decimal("0")
        for row in open_billing.filter(expected_payment_date__isnull=False)
        .values("expected_payment_date")
        .annotate(total=Sum("total_amount"))
    }
    ap_by_date = {
        row["planned_payment_date"]: row["total"] or Decimal("0")
        for row in open_payment.filter(planned_payment_date__isnull=False)
        .values("planned_payment_date")
        .annotate(total=Sum("total_amount"))
    }

    def _sum_due(by_date, start, end):
        total = Decimal("0")
        for due_date, amount in by_date.items():
            if (start is None or due_date >= start) and due_date <= end:
                total += amount
        return total

    # Overdue bucket: everything due before today (however far back).
    overdue_ar = _sum_due(ar_by_date, None, today - timedelta(days=1))
    overdue_ap = _sum_due(ap_by_date, None, today - timedelta(days=1))
    buckets = [
        {
            "key": "overdue",
            "label": "Overdue",
            "is_overdue": True,
            "ar_in": as_number(overdue_ar),
            "ap_out": as_number(overdue_ap),
            "net": as_number(overdue_ar - overdue_ap),
        }
    ]
    month_start = today.replace(day=1)
    for month in range(CASHFLOW_FORECAST_MONTHS):
        bucket_month = _add_months(month_start, month)
        # First month runs from today (earlier-due amounts are already in
        # Overdue); later months span the whole calendar month.
        start = today if month == 0 else bucket_month
        end = _add_months(month_start, month + 1) - timedelta(days=1)
        ar_in = _sum_due(ar_by_date, start, end)
        ap_out = _sum_due(ap_by_date, start, end)
        buckets.append(
            {
                "key": bucket_month.isoformat(),
                "label": bucket_month.strftime("%b %Y"),
                "is_overdue": False,
                "ar_in": as_number(ar_in),
                "ap_out": as_number(ap_out),
                "net": as_number(ar_in - ap_out),
            }
        )

    return {
        "today": today.isoformat(),
        "horizon_months": CASHFLOW_FORECAST_MONTHS,
        "buckets": buckets,
        "ar_total_open": as_number(ar_total_open),
        "ap_total_open": as_number(ap_total_open),
        "net_open": as_number(ar_total_open - ap_total_open),
        "overdue_ar": as_number(overdue_ar),
        "overdue_ap": as_number(overdue_ap),
    }


def _build_popular_products(today, windows, limit):
    """Top-selling products per look-back window (1 day … 3 years) with the
    supplier they were mostly sourced from. Sold lines are read once over the
    widest window, then folded into every shorter window they also fall inside,
    so the dashboard can switch windows client-side with no refetch."""
    if not windows:
        return {}

    horizon_days = max(window["days"] for window in windows)
    earliest = today - timedelta(days=horizon_days - 1)

    buckets = {window["key"]: {} for window in windows}
    lines = (
        SaleItem.objects.filter(
            item_status__in=SALE_STOCK_DEDUCTED_STATUSES,
            product_id__isnull=False,
            sale__transaction_date__gte=earliest,
            sale__transaction_date__lte=today,
        )
        .exclude(sale__status__in=SALE_INACTIVE_TRANSACTION_STATUSES)
        .values_list(
            "product_id",
            "product_name",
            "supplier_name",
            "base_unit",
            "base_quantity",
            "amount",
            "sale__transaction_date",
        )
    )

    for product_id, product_name, supplier_name, base_unit, base_qty, amount, txn_date in lines:
        if not txn_date:
            continue
        age = (today - txn_date).days
        qty = base_qty or Decimal("0")
        amt = amount or Decimal("0")
        name = supplier_name or ""
        for window in windows:
            if age > window["days"] - 1:
                continue
            entry = buckets[window["key"]].get(product_id)
            if entry is None:
                entry = {
                    "product_id": product_id,
                    "product_name": product_name,
                    "unit": base_unit or "",
                    "units": Decimal("0"),
                    "value": Decimal("0"),
                    "suppliers": {},
                }
                buckets[window["key"]][product_id] = entry
            entry["units"] += qty
            entry["value"] += amt
            entry["suppliers"][name] = entry["suppliers"].get(name, Decimal("0")) + qty

    popular = {}
    for window in windows:
        ranked = sorted(
            buckets[window["key"]].values(),
            key=lambda e: (e["units"], e["value"]),
            reverse=True,
        )[:limit]
        popular[window["key"]] = [
            {
                "product_id": entry["product_id"],
                "product_name": entry["product_name"],
                "unit": entry["unit"],
                "supplier_name": (
                    max(entry["suppliers"].items(), key=lambda kv: kv[1])[0]
                    if entry["suppliers"]
                    else ""
                ),
                "units": as_number(entry["units"]),
                "value": as_number(entry["value"]),
            }
            for entry in ranked
        ]
    return popular


def build_order_coverage_segment(period=None, today=None):
    """Order-coverage pipeline for the dashboard footer.

    Splits open customer demand (pending sale-order lines) into three coverage
    states for a sourcing middle-man: **Ready** (free stock on hand),
    **Incoming** (covered by an open purchase order) and **Gap** (must raise a
    PO). Demand is consumed greedily — oldest orders first — against per-product
    free stock then the incoming-PO pool, so one line can split across states.
    Sizes are tracked in both ``units`` (base quantity) and ``value`` (sale-line
    amount). Also returns top-selling products per look-back window with their
    main supplier.

    Open demand mirrors the ``pending_sales_units`` definition in
    :func:`build_stock_report`. ``period`` is accepted for a uniform
    segment-builder signature but ignored — this view is point-in-time.
    """
    today = today or timezone.localdate()

    open_lines = list(
        SaleItem.objects.filter(
            item_status=SaleItem.ITEM_PENDING,
            product_id__isnull=False,
        )
        .exclude(sale__status__in=SALE_INACTIVE_TRANSACTION_STATUSES)
        .select_related("sale", "product")
        .order_by("sale__transaction_date", "sale__created_at", "id")
    )

    product_ids = {item.product_id for item in open_lines}

    # Per-product supply pools, consumed as demand is classified.
    available_by_product = get_available_stock_by_product_id(
        product_ids=product_ids or None
    )
    incoming_by_product = {
        row["product_id"]: row["total"] or Decimal("0")
        for row in (
            PurchaseItem.objects.filter(
                item_status=PurchaseItem.ITEM_PENDING,
                product_id__in=product_ids,
            )
            .values("product_id")
            .annotate(total=Sum("base_quantity"))
        )
    }
    states = {
        "ready": {"units": Decimal("0"), "value": Decimal("0")},
        "incoming": {"units": Decimal("0"), "value": Decimal("0")},
        "gap": {"units": Decimal("0"), "value": Decimal("0")},
    }

    for item in open_lines:
        product_id = item.product_id
        demand = item.base_quantity or Decimal("0")
        if demand <= 0:
            continue

        amount = item.amount or Decimal("0")
        value_per_unit = amount / demand

        # On hand: cover from free stock on hand.
        free = max(Decimal("0"), available_by_product.get(product_id, Decimal("0")))
        ready_units = min(demand, free)
        if ready_units > 0:
            available_by_product[product_id] = free - ready_units
            states["ready"]["units"] += ready_units
            states["ready"]["value"] += ready_units * value_per_unit

        remaining = demand - ready_units

        # Delivering: cover the rest from open purchase orders on the way.
        incoming_units = Decimal("0")
        if remaining > 0:
            pool = max(Decimal("0"), incoming_by_product.get(product_id, Decimal("0")))
            incoming_units = min(remaining, pool)
            if incoming_units > 0:
                incoming_by_product[product_id] = pool - incoming_units
                states["incoming"]["units"] += incoming_units
                states["incoming"]["value"] += incoming_units * value_per_unit

        remaining -= incoming_units

        # Gap: ordered, no stock and no PO.
        if remaining > 0:
            states["gap"]["units"] += remaining
            states["gap"]["value"] += remaining * value_per_unit

    total_units = sum((s["units"] for s in states.values()), Decimal("0"))
    total_value = sum((s["value"] for s in states.values()), Decimal("0"))
    covered_units = states["ready"]["units"] + states["incoming"]["units"]
    coverage_pct = (
        int((covered_units / total_units * Decimal("100")).to_integral_value(ROUND_HALF_UP))
        if total_units > 0
        else 0
    )

    return {
        "today": today.isoformat(),
        "states": {
            name: {
                "units": as_number(values["units"]),
                "value": as_number(values["value"]),
            }
            for name, values in states.items()
        },
        "total": {
            "units": as_number(total_units),
            "value": as_number(total_value),
        },
        "coverage_pct": coverage_pct,
        "windows": [dict(window) for window in POPULAR_WINDOWS],
        "popular": _build_popular_products(
            today, POPULAR_WINDOWS, ORDER_COVERAGE_POPULAR_LIMIT
        ),
    }


def build_dashboard_segment(segment, period, today=None):
    builders = {
        "finance": build_finance_segment,
        "trend": build_trend_segment,
        "products": build_products_segment,
        "cashflow": build_cashflow_segment,
        "order_coverage": build_order_coverage_segment,
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
        "cashflow": build_cashflow_segment(today=today),
        "order_coverage": build_order_coverage_segment(today=today),
    }


__all__ = [
    "CASHFLOW_FORECAST_MONTHS",
    "DASHBOARD_DELIVERY_STAGES",
    "DASHBOARD_FUNNEL_LIST_LIMIT",
    "DASHBOARD_OPEN_PURCHASE_STATUSES",
    "DASHBOARD_OPEN_SALE_STATUSES",
    "DASHBOARD_PURCHASE_STAGES",
    "DEFAULT_SEGMENT_PERIOD",
    "ORDER_COVERAGE_POPULAR_LIMIT",
    "POPULAR_WINDOWS",
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
    "serialize_light_purchase",
    "serialize_light_sale",
]
