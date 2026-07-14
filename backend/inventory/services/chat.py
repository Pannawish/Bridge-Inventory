"""AI chat context and response services.

The chat assistant answers from backend-prepared inventory context first. Model
calls, when configured, should consume this context rather than querying raw
tables directly, so totals and eligibility stay aligned with normal API rules.
"""

import re
from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Prefetch, Q, Sum
from django.utils import timezone
from django.utils.dateparse import parse_date

from ..models import (
    BillingNote,
    CreditNote,
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
from .common import (
    as_number,
    build_text_query,
    chat_metric,
    chat_record,
    chat_scope_label,
    chat_section,
    combine_chat_meta,
    contains_any,
    contains_any_token,
    date_interval_label,
    get_month_bounds,
    get_week_bounds,
    normalize_chat_text,
)
from .dashboard import (
    DEFAULT_SEGMENT_PERIOD,
    build_cashflow_segment,
    build_dashboard_summary,
    build_finance_segment,
    build_order_coverage_segment,
    build_products_segment,
)
from .openai_chat import generate_openai_chat_response
from .transactions import SALE_INACTIVE_TRANSACTION_STATUSES


CHAT_RECORD_LIMIT = 25
CHAT_INITIAL_RECORD_LIMIT = 5
CHAT_STOP_WORDS = {
    "about",
    "are",
    "assistant",
    "batch",
    "batches",
    "billing",
    "cash",
    "cashflow",
    "coverage",
    "credit",
    "credits",
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
    "position",
    "show",
    "quotation",
    "quotations",
    "recent",
    "receivable",
    "receivables",
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
    "payable",
    "payables",
    "order",
    "orders",
    "backorder",
    "backordered",
    "open",
    "net",
    "what",
    "which",
}
PARTNER_NAME_STOP_WORDS = {
    "and",
    "co",
    "company",
    "corp",
    "corporation",
    "inc",
    "limited",
    "ltd",
    "llc",
    "plc",
    "public",
    "thai",
    "thailand",
}


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

    if dates:
        start_date = dates[0]
        end_date = dates[1] if len(dates) > 1 else dates[0]
        if end_date < start_date:
            start_date, end_date = end_date, start_date
        return {"start": start_date, "end": end_date}

    question_text = normalize_chat_text(question)
    today = timezone.localdate()
    if contains_any(question_text, ("today", "วันนี้")):
        return {"start": today, "end": today}
    if contains_any(question_text, ("yesterday", "เมื่อวาน")):
        prior_day = today - timedelta(days=1)
        return {"start": prior_day, "end": prior_day}
    if contains_any(question_text, ("this week", "สัปดาห์นี้", "อาทิตย์นี้")):
        start_date, end_date = get_week_bounds(today)
        return {"start": start_date, "end": end_date}
    if contains_any(question_text, ("last week", "สัปดาห์ที่แล้ว", "อาทิตย์ที่แล้ว")):
        start_date, end_date = get_week_bounds(today - timedelta(days=7))
        return {"start": start_date, "end": end_date}
    if contains_any(question_text, ("this month", "เดือนนี้")):
        start_date, end_date = get_month_bounds(today.year, today.month)
        return {"start": start_date, "end": end_date}
    if contains_any(question_text, ("last month", "เดือนที่แล้ว")):
        previous_month_anchor = today.replace(day=1) - timedelta(days=1)
        start_date, end_date = get_month_bounds(previous_month_anchor.year, previous_month_anchor.month)
        return {"start": start_date, "end": end_date}
    if contains_any(question_text, ("this year", "ปีนี้")):
        return {"start": date(today.year, 1, 1), "end": date(today.year, 12, 31)}
    if contains_any(question_text, ("last year", "ปีที่แล้ว")):
        previous_year = today.year - 1
        return {"start": date(previous_year, 1, 1), "end": date(previous_year, 12, 31)}

    return None


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
    question_text = normalize_chat_text(question)
    question_terms = set(question_text.split())
    names = []
    for name in model.objects.values_list("company_name", flat=True):
        normalized_name = normalize_chat_text(name)
        if normalized_name and normalized_name in question_text:
            names.append(name)
            continue
        significant_terms = [
            term
            for term in normalized_name.split()
            if len(term) >= 3 and term not in PARTNER_NAME_STOP_WORDS
        ]
        if not significant_terms:
            continue
        minimum_matches = 1 if len(significant_terms) == 1 else 2
        if sum(1 for term in significant_terms if term in question_terms) >= minimum_matches:
            names.append(name)
    return names


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
                "product_id": item.product_id,
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
                "product_id": item.product_id,
                "product_name": item.product_name,
                "sku": item.sku,
                "status": item.item_status,
                "quantity": as_number(item.quantity),
                "unit": item.unit,
                "base_quantity": as_number(item.base_quantity),
                "base_unit": item.base_unit,
                "unit_price": as_number(item.unit_price),
                "unit_cost": as_number(item.unit_cost),
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
            "product_id": item.product_id,
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


def serialize_credit_note_for_chat(note):
    return {
        "id": note.id,
        "reference_no": note.reference_no,
        "customer_name": note.customer_name,
        "sale_reference_no": note.sale_reference_no,
        "billing_note_reference_no": (
            note.billing_note.reference_no if note.billing_note_id and note.billing_note else ""
        ),
        "credit_note_date": note.credit_note_date,
        "status": note.status,
        "total_amount": as_number(note.total_amount),
        "note": note.note,
        "lines": [
            {
                "product_id": line.sale_item.product_id if line.sale_item_id and line.sale_item else None,
                "product_name": line.product_name,
                "sku": line.sku,
                "quantity": as_number(line.quantity),
                "unit_price": as_number(line.unit_price),
                "amount": as_number(line.amount),
            }
            for line in note.lines.all()
        ],
    }


def build_ai_inventory_context(question, request=None):
    """Prepare deterministic business context used by both local and model answers."""
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
    credit_query = (
        Q(customer_name__in=matching_customer_names)
        if matching_customer_names
        else build_text_query(
            terms,
            ["reference_no", "customer_name", "sale_reference_no", "note"],
        )
    )

    if matching_product_ids and not matching_customer_names and not matching_supplier_names:
        purchase_query |= Q(items__product_id__in=matching_product_ids) | Q(items__sku__in=[row["sku"] for row in matching_stock_rows])
        sale_query |= Q(items__product_id__in=matching_product_ids) | Q(items__sku__in=[row["sku"] for row in matching_stock_rows])

    date_filtered_purchases = filter_by_date_interval(purchases, "transaction_date", date_interval)
    date_filtered_sales = filter_by_date_interval(sales, "transaction_date", date_interval)
    has_purchase_filter = bool(terms or matching_supplier_names or matching_product_ids)
    has_sale_filter = bool(terms or matching_customer_names or matching_product_ids)
    matched_purchases = (
        date_filtered_purchases.filter(purchase_query).distinct()
        if has_purchase_filter
        else (date_filtered_purchases if date_interval else Purchase.objects.none())
    )
    matched_sales = (
        date_filtered_sales.filter(sale_query).distinct()
        if has_sale_filter
        else (date_filtered_sales if date_interval else Sale.objects.none())
    )
    recent_purchases = date_filtered_purchases.order_by("-transaction_date", "-created_at")[:CHAT_RECORD_LIMIT]
    recent_sales = date_filtered_sales.order_by("-transaction_date", "-created_at")[:CHAT_RECORD_LIMIT]

    quotations = Quotation.objects.prefetch_related("line_items__product")
    billing_notes = BillingNote.objects.prefetch_related("lines__sale")
    payment_batches = PaymentBatch.objects.prefetch_related("lines__purchase")
    credit_notes = CreditNote.objects.prefetch_related("lines", "sale", "billing_note")

    date_filtered_quotations = filter_by_date_interval(quotations, "quotation_date", date_interval)
    date_filtered_billing_notes = filter_by_date_interval(billing_notes, "billing_note_date", date_interval)
    date_filtered_payment_batches = filter_by_date_interval(payment_batches, "batch_date", date_interval)
    date_filtered_credit_notes = filter_by_date_interval(credit_notes, "credit_note_date", date_interval)
    has_quotation_filter = bool(terms or matching_customer_names or matching_supplier_names)
    has_billing_filter = bool(terms or matching_customer_names)
    has_payment_filter = bool(terms or matching_supplier_names)
    has_credit_filter = bool(terms or matching_customer_names)
    matched_quotations = (
        date_filtered_quotations.filter(quotation_query).distinct()
        if has_quotation_filter
        else (date_filtered_quotations if date_interval else Quotation.objects.none())
    )
    matched_billing_notes = (
        date_filtered_billing_notes.filter(billing_query).distinct()
        if has_billing_filter
        else (date_filtered_billing_notes if date_interval else BillingNote.objects.none())
    )
    matched_payment_batches = (
        date_filtered_payment_batches.filter(payment_query).distinct()
        if has_payment_filter
        else (date_filtered_payment_batches if date_interval else PaymentBatch.objects.none())
    )
    matched_credit_notes = (
        date_filtered_credit_notes.filter(credit_query).distinct()
        if has_credit_filter
        else (date_filtered_credit_notes if date_interval else CreditNote.objects.none())
    )
    has_query_filter = bool(terms or date_interval or matching_customer_names or matching_supplier_names)
    purchase_fallback = [] if has_query_filter else recent_purchases
    sale_fallback = [] if has_query_filter else recent_sales
    quotation_fallback = (
        []
        if has_query_filter
        else date_filtered_quotations.order_by("-quotation_date", "-created_at")[:CHAT_RECORD_LIMIT]
    )
    billing_note_fallback = (
        []
        if has_query_filter
        else date_filtered_billing_notes.order_by("-billing_note_date", "-created_at")[:CHAT_RECORD_LIMIT]
    )
    payment_batch_fallback = (
        []
        if has_query_filter
        else date_filtered_payment_batches.order_by("-batch_date", "-created_at")[:CHAT_RECORD_LIMIT]
    )
    credit_note_fallback = (
        []
        if has_query_filter
        else date_filtered_credit_notes.order_by("-credit_note_date", "-created_at")[:CHAT_RECORD_LIMIT]
    )
    purchase_rows = [
        serialize_purchase_for_chat(purchase)
        for purchase in limited_unique_rows(matched_purchases, purchase_fallback, limit=CHAT_RECORD_LIMIT)
    ]
    sale_rows = [
        serialize_sale_for_chat(sale)
        for sale in limited_unique_rows(matched_sales, sale_fallback, limit=CHAT_RECORD_LIMIT)
    ]
    quotation_rows = [
        serialize_quotation_for_chat(quotation)
        for quotation in limited_unique_rows(matched_quotations, quotation_fallback, limit=CHAT_RECORD_LIMIT)
    ]
    billing_note_rows = [
        serialize_billing_note_for_chat(note)
        for note in limited_unique_rows(matched_billing_notes, billing_note_fallback, limit=CHAT_RECORD_LIMIT)
    ]
    payment_batch_rows = [
        serialize_payment_batch_for_chat(batch)
        for batch in limited_unique_rows(matched_payment_batches, payment_batch_fallback, limit=CHAT_RECORD_LIMIT)
    ]
    credit_note_rows = [
        serialize_credit_note_for_chat(note)
        for note in limited_unique_rows(matched_credit_notes, credit_note_fallback, limit=CHAT_RECORD_LIMIT)
    ]
    customer_summaries = []
    for name in matching_customer_names[:3]:
        customer_sales = date_filtered_sales.filter(customer_name=name)
        customer_quotations = date_filtered_quotations.filter(customer_name=name)
        customer_billing_notes = date_filtered_billing_notes.filter(customer_name=name)
        customer_credit_notes = date_filtered_credit_notes.filter(customer_name=name)
        customer_open_billing_notes = customer_billing_notes.exclude(
            status__in=(BillingNote.STATUS_FULLY_RECEIVED, BillingNote.STATUS_CANCELLED)
        )
        customer_summaries.append(
            build_customer_chat_summary(
                name,
                date_interval,
                [serialize_sale_for_chat(sale) for sale in customer_sales[:CHAT_RECORD_LIMIT]],
                [serialize_quotation_for_chat(quotation) for quotation in customer_quotations[:CHAT_RECORD_LIMIT]],
                [serialize_billing_note_for_chat(note) for note in customer_billing_notes[:CHAT_RECORD_LIMIT]],
                [serialize_credit_note_for_chat(note) for note in customer_credit_notes[:CHAT_RECORD_LIMIT]],
                sales_summary=summarize_model_rows(customer_sales, "grand_total"),
                quotation_summary=summarize_model_rows(customer_quotations, "grand_total"),
                billing_summary=summarize_model_rows(customer_billing_notes, "total_amount"),
                credit_summary=summarize_model_rows(customer_credit_notes, "total_amount"),
                open_billing_summary=summarize_model_rows(customer_open_billing_notes, "total_amount"),
            )
        )

    supplier_summaries = []
    for name in matching_supplier_names[:3]:
        supplier_purchases = date_filtered_purchases.filter(supplier_name=name)
        supplier_quotations = date_filtered_quotations.filter(supplier_name=name)
        supplier_payment_batches = date_filtered_payment_batches.filter(supplier_name=name)
        supplier_open_payment_batches = supplier_payment_batches.exclude(
            status__in=(PaymentBatch.STATUS_PAID, PaymentBatch.STATUS_CANCELLED)
        )
        supplier_summaries.append(
            build_supplier_chat_summary(
                name,
                date_interval,
                [serialize_purchase_for_chat(purchase) for purchase in supplier_purchases[:CHAT_RECORD_LIMIT]],
                [serialize_quotation_for_chat(quotation) for quotation in supplier_quotations[:CHAT_RECORD_LIMIT]],
                [serialize_payment_batch_for_chat(batch) for batch in supplier_payment_batches[:CHAT_RECORD_LIMIT]],
                purchase_summary=summarize_model_rows(supplier_purchases, "grand_total"),
                quotation_summary=summarize_model_rows(supplier_quotations, "grand_total"),
                payment_summary=summarize_model_rows(supplier_payment_batches, "total_amount"),
                open_payment_summary=summarize_model_rows(supplier_open_payment_batches, "total_amount"),
            )
        )
    dashboard_today = timezone.localdate()
    finance_segment = build_finance_segment(DEFAULT_SEGMENT_PERIOD, today=dashboard_today)
    cashflow_segment = build_cashflow_segment(today=dashboard_today)
    order_coverage_segment = build_order_coverage_segment(today=dashboard_today)
    products_segment = build_products_segment(DEFAULT_SEGMENT_PERIOD, today=dashboard_today)

    return {
        "query_terms": terms,
        "matched_customers": matching_customer_names,
        "matched_suppliers": matching_supplier_names,
        "today": timezone.localdate(),
        "date_interval": date_interval,
        "match_counts": {
            "products": matching_products.count() if terms else 0,
            "purchases": matched_purchases.count() if has_purchase_filter else 0,
            "sales": matched_sales.count() if has_sale_filter else 0,
            "quotations": matched_quotations.count() if has_quotation_filter else 0,
            "billing_notes": matched_billing_notes.count() if has_billing_filter else 0,
            "payment_batches": matched_payment_batches.count() if has_payment_filter else 0,
            "credit_notes": matched_credit_notes.count() if has_credit_filter else 0,
        },
        "dashboard_metrics": dashboard_summary["metrics"],
        "dashboard": {
            "metrics": dashboard_summary["metrics"],
            "finance": finance_segment,
            "cashflow": cashflow_segment,
            "order_coverage": order_coverage_segment,
            "products": products_segment,
        },
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
            "credit_notes": summarize_model_rows(matched_credit_notes, "total_amount", credit_note_rows),
        },
        "partner_summaries": {
            "customers": customer_summaries,
            "suppliers": supplier_summaries,
        },
        "purchases": purchase_rows,
        "sales": sale_rows,
        "quotations": quotation_rows,
        "billing_notes": billing_note_rows,
        "payment_batches": payment_batch_rows,
        "credit_notes": credit_note_rows,
    }


def format_transaction_line(row, party_key):
    return (
        f"{row['reference_no'] or row['id']}: {row[party_key]}, {row['status']}, "
        f"total {row.get('grand_total', row.get('total_amount'))}."
    )


def summarize_money_rows(rows, amount_key="grand_total"):
    rows = list(rows)
    active_rows = [
        row for row in rows if row.get("status") not in SALE_INACTIVE_TRANSACTION_STATUSES
    ]
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

    active_rows = [
        row
        for row in rows
        if getattr(row, "status", "") not in SALE_INACTIVE_TRANSACTION_STATUSES
    ]
    return {
        "count": len(rows),
        "active_count": len(active_rows),
        "cancelled_count": len(rows) - len(active_rows),
        "total": as_number(sum(getattr(row, amount_attr, Decimal("0")) or Decimal("0") for row in rows)),
        "active_total": as_number(
            sum(getattr(row, amount_attr, Decimal("0")) or Decimal("0") for row in active_rows)
        ),
    }


def transaction_target(record_type, row):
    return {"target_type": record_type, "target_id": row.get("id")}


def build_top_product_records(rows, item_key="items", limit=CHAT_RECORD_LIMIT):
    product_totals = {}
    for row in rows:
        for item in row.get(item_key, []):
            key = item.get("sku") or item.get("product_name") or "Unknown"
            bucket = product_totals.setdefault(
                key,
                {
                    "product_id": item.get("product_id"),
                    "product_name": item.get("product_name") or key,
                    "sku": item.get("sku") or "",
                    "quantity": Decimal("0"),
                    "amount": Decimal("0"),
                    "unit": item.get("base_unit") or item.get("unit") or "",
                },
            )
            if not bucket.get("product_id") and item.get("product_id"):
                bucket["product_id"] = item.get("product_id")
            quantity = item.get("base_quantity")
            if quantity in (None, ""):
                quantity = item.get("quantity")
            bucket["quantity"] += Decimal(str(quantity or 0))
            amount = item.get("amount")
            if amount in (None, "") and item.get("sale_price") not in (None, "") and item.get("quantity") not in (None, ""):
                amount = Decimal(str(item.get("sale_price") or 0)) * Decimal(str(item.get("quantity") or 0))
            bucket["amount"] += Decimal(str(amount or 0))

    ranked_rows = sorted(
        product_totals.values(),
        key=lambda row: (row["amount"], row["quantity"]),
        reverse=True,
    )[:limit]
    return [
        chat_record(
            f"{row['product_name']} ({row['sku']})" if row["sku"] else row["product_name"],
            meta=combine_chat_meta(f"{as_number(row['quantity'])} {row['unit']}".strip()),
            value=as_number(row["amount"]),
            value_label="Amount",
            target_type="product",
            target_id=row.get("product_id"),
        )
        for row in ranked_rows
    ]


def build_purchase_records(rows, limit=CHAT_RECORD_LIMIT):
    return [
        chat_record(
            row["reference_no"] or row["id"],
            meta=combine_chat_meta(row["transaction_date"], row["supplier_name"], row["status"]),
            value=row["grand_total"],
            value_label="Total",
            **transaction_target("purchase", row),
        )
        for row in rows[:limit]
    ]


def build_sale_records(rows, limit=CHAT_RECORD_LIMIT):
    return [
        chat_record(
            row["reference_no"] or row["id"],
            meta=combine_chat_meta(row["transaction_date"], row["customer_name"], row["status"]),
            value=row["grand_total"],
            value_label="Total",
            **transaction_target("sale", row),
        )
        for row in rows[:limit]
    ]


def build_quotation_records(rows, limit=CHAT_RECORD_LIMIT):
    return [
        chat_record(
            row["reference_no"] or row["id"],
            meta=combine_chat_meta(
                row["quotation_date"],
                row["customer_name"] or row["supplier_name"],
                f"valid until {row['valid_until_date']}" if row.get("valid_until_date") else "",
            ),
            value=row["grand_total"],
            value_label="Total",
            **transaction_target("quotation", row),
        )
        for row in rows[:limit]
    ]


def build_billing_note_records(rows, limit=CHAT_RECORD_LIMIT):
    return [
        chat_record(
            row["reference_no"] or row["id"],
            meta=combine_chat_meta(row["billing_note_date"], row["customer_name"], row["status"]),
            value=row["total_amount"],
            value_label="Total",
            **transaction_target("billing_note", row),
        )
        for row in rows[:limit]
    ]


def build_payment_batch_records(rows, limit=CHAT_RECORD_LIMIT):
    return [
        chat_record(
            row["reference_no"] or row["id"],
            meta=combine_chat_meta(row["batch_date"], row["supplier_name"], row["status"]),
            value=row["total_amount"],
            value_label="Total",
            **transaction_target("payment_batch", row),
        )
        for row in rows[:limit]
    ]


def build_credit_note_records(rows, limit=CHAT_RECORD_LIMIT):
    return [
        chat_record(
            row["reference_no"] or row["id"],
            meta=combine_chat_meta(row["credit_note_date"], row["customer_name"], row["status"]),
            value=row["total_amount"],
            value_label="Total",
            **transaction_target("credit_note", row),
        )
        for row in rows[:limit]
    ]


def compute_margin_rows_from_sales_rows(rows, sku_filter=None, limit=6):
    performance = {}
    allowed_skus = set(sku_filter or [])
    for row in rows:
        for item in row.get("items", []):
            sku = item.get("sku") or ""
            if allowed_skus and sku not in allowed_skus:
                continue
            key = sku or item.get("product_name") or "Unknown"
            quantity = Decimal(str(item.get("base_quantity") or item.get("quantity") or 0))
            revenue = Decimal(str(item.get("amount") or 0))
            cost = Decimal(str(item.get("unit_cost") or 0)) * quantity
            bucket = performance.setdefault(
                key,
                {
                    "product_name": item.get("product_name") or key,
                    "sku": sku,
                    "units": Decimal("0"),
                    "revenue": Decimal("0"),
                    "cost": Decimal("0"),
                },
            )
            bucket["units"] += quantity
            bucket["revenue"] += revenue
            bucket["cost"] += cost

    ranked = []
    for row in performance.values():
        margin = row["revenue"] - row["cost"]
        margin_pct = (margin / row["revenue"] * Decimal("100")) if row["revenue"] > 0 else Decimal("0")
        ranked.append(
            {
                "product_name": row["product_name"],
                "sku": row["sku"],
                "units": as_number(row["units"]),
                "revenue": as_number(row["revenue"]),
                "cost": as_number(row["cost"]),
                "margin": as_number(margin),
                "margin_pct": as_number(margin_pct.quantize(Decimal("0.1"))),
            }
        )

    return sorted(ranked, key=lambda row: (row["margin"], row["revenue"]), reverse=True)[:limit]


def build_margin_records(rows, limit=6):
    return [
        chat_record(
            f"{row['product_name']} ({row['sku']})" if row.get("sku") else row["product_name"],
            meta=combine_chat_meta(
                f"{row['units']} units",
                f"revenue {row['revenue']}",
                f"cost {row['cost']}",
                f"margin {row['margin_pct']}%",
            ),
            value=row["margin"],
            value_label="Margin",
        )
        for row in rows[:limit]
    ]


def build_exception_transaction_records(
    rows,
    date_key,
    party_key,
    amount_key,
    due_label,
    target_type="",
    limit=CHAT_RECORD_LIMIT,
):
    return [
        chat_record(
            row["reference_no"] or row["id"],
            meta=combine_chat_meta(row.get(date_key), row.get(party_key), row.get("status"), due_label),
            value=row.get(amount_key),
            value_label="Amount",
            **(transaction_target(target_type, row) if target_type else {}),
        )
        for row in rows[:limit]
    ]


def build_detail_records(items, record_type="item", limit=CHAT_RECORD_LIMIT, parent_target_type="", parent_target_id=None):
    records = []
    target_kwargs = (
        {"target_type": parent_target_type, "target_id": parent_target_id}
        if parent_target_type and parent_target_id not in (None, "")
        else {}
    )
    for item in items[:limit]:
        if record_type == "sale":
            records.append(
                chat_record(
                    f"{item.get('product_name')} ({item.get('sku')})" if item.get("sku") else item.get("product_name"),
                    meta=combine_chat_meta(
                        f"qty {item.get('quantity')} {item.get('unit')}",
                        item.get("status"),
                        f"unit price {item.get('unit_price')}",
                    ),
                    value=item.get("amount"),
                    value_label="Amount",
                    **target_kwargs,
                )
            )
        elif record_type == "purchase":
            records.append(
                chat_record(
                    f"{item.get('product_name')} ({item.get('sku')})" if item.get("sku") else item.get("product_name"),
                    meta=combine_chat_meta(
                        f"qty {item.get('quantity')} {item.get('unit')}",
                        item.get("status"),
                        f"expected {item.get('expected_delivery_date')}",
                    ),
                    value=item.get("amount"),
                    value_label="Amount",
                    **target_kwargs,
                )
            )
        elif record_type == "credit":
            records.append(
                chat_record(
                    f"{item.get('product_name')} ({item.get('sku')})" if item.get("sku") else item.get("product_name"),
                    meta=combine_chat_meta(
                        f"qty {item.get('quantity')}",
                        f"unit price {item.get('unit_price')}",
                    ),
                    value=item.get("amount"),
                    value_label="Amount",
                    **target_kwargs,
                )
            )
        elif record_type == "billing":
            records.append(
                chat_record(
                    item.get("sale_reference_no") or "Sale line",
                    meta=combine_chat_meta(item.get("sale_status"), f"received {item.get('received')}"),
                    value=item.get("amount"),
                    value_label="Amount",
                    **target_kwargs,
                )
            )
        elif record_type == "payment":
            records.append(
                chat_record(
                    item.get("purchase_reference_no") or "Purchase line",
                    meta=combine_chat_meta(item.get("purchase_status"), f"paid {item.get('paid')}"),
                    value=item.get("amount"),
                    value_label="Amount",
                    **target_kwargs,
                )
            )
        else:
            records.append(
                chat_record(
                    f"{item.get('product_name')} ({item.get('sku')})" if item.get("sku") else item.get("product_name"),
                    meta=combine_chat_meta(f"qty {item.get('quantity')} {item.get('unit')}"),
                    value=item.get("amount"),
                    value_label="Amount",
                    **target_kwargs,
                )
            )
    return records


def build_customer_chat_summary(
    name,
    date_interval,
    sale_rows,
    quotation_rows,
    billing_note_rows,
    credit_note_rows,
    sales_summary=None,
    quotation_summary=None,
    billing_summary=None,
    credit_summary=None,
    open_billing_summary=None,
):
    sales_summary = sales_summary or summarize_money_rows(sale_rows)
    quotation_summary = quotation_summary or summarize_money_rows(quotation_rows)
    billing_summary = billing_summary or summarize_money_rows(billing_note_rows, amount_key="total_amount")
    credit_summary = credit_summary or summarize_money_rows(credit_note_rows, amount_key="total_amount")
    open_billing_rows = [
        row
        for row in billing_note_rows
        if row.get("status") not in {BillingNote.STATUS_FULLY_RECEIVED, BillingNote.STATUS_CANCELLED}
    ]
    open_billing_summary = open_billing_summary or summarize_money_rows(open_billing_rows, amount_key="total_amount")
    top_product_records = build_top_product_records(sale_rows)
    scope_label = chat_scope_label(date_interval)

    return {
        "role": "customer",
        "name": name,
        "scope_label": scope_label,
        "title": f"Customer summary: {name}",
        "subtitle": scope_label,
        "metrics": [
            chat_metric("Sales total", sales_summary["total"]),
            chat_metric("Sales count", sales_summary["count"]),
            chat_metric("Open AR", open_billing_summary["total"], tone="success" if open_billing_summary["total"] else "default"),
            chat_metric("Credits", credit_summary["total"], tone="warning" if credit_summary["total"] else "default"),
        ],
        "sections": [
            chat_section(
                "Highlights",
                items=[
                    f"Sales: {sales_summary['count']} records, active total {sales_summary['active_total']}.",
                    f"Quotations: {quotation_summary['count']} records, total {quotation_summary['total']}.",
                    f"Billing notes: {billing_summary['count']} records, open receivables {open_billing_summary['total']}.",
                    f"Credit notes: {credit_summary['count']} records, total {credit_summary['total']}.",
                ],
            ),
            chat_section(
                "What this means",
                items=[
                    f"This customer has {sales_summary['active_count']} active sales records in the selected scope.",
                    f"Open AR is {open_billing_summary['total']} before any fully received or cancelled billing notes are excluded.",
                    "Use the records below to inspect the specific documents behind the totals.",
                ],
            ),
            chat_section("Recent sales", records=build_sale_records(sale_rows)),
            chat_section("Billing notes", records=build_billing_note_records(billing_note_rows)),
            chat_section("Top products", records=top_product_records),
            chat_section("Recent quotations", records=build_quotation_records(quotation_rows)),
            chat_section("Credit notes", records=build_credit_note_records(credit_note_rows)),
        ],
    }


def build_supplier_chat_summary(
    name,
    date_interval,
    purchase_rows,
    quotation_rows,
    payment_batch_rows,
    purchase_summary=None,
    quotation_summary=None,
    payment_summary=None,
    open_payment_summary=None,
):
    purchase_summary = purchase_summary or summarize_money_rows(purchase_rows)
    quotation_summary = quotation_summary or summarize_money_rows(quotation_rows)
    payment_summary = payment_summary or summarize_money_rows(payment_batch_rows, amount_key="total_amount")
    open_payment_rows = [
        row
        for row in payment_batch_rows
        if row.get("status") not in {PaymentBatch.STATUS_PAID, PaymentBatch.STATUS_CANCELLED}
    ]
    open_payment_summary = open_payment_summary or summarize_money_rows(open_payment_rows, amount_key="total_amount")
    top_product_records = build_top_product_records(purchase_rows)
    scope_label = chat_scope_label(date_interval)

    return {
        "role": "supplier",
        "name": name,
        "scope_label": scope_label,
        "title": f"Supplier summary: {name}",
        "subtitle": scope_label,
        "metrics": [
            chat_metric("Purchase total", purchase_summary["total"]),
            chat_metric("Purchase count", purchase_summary["count"]),
            chat_metric("Scheduled AP", open_payment_summary["total"], tone="warning" if open_payment_summary["total"] else "default"),
            chat_metric("Payment batches", payment_summary["count"]),
        ],
        "sections": [
            chat_section(
                "Highlights",
                items=[
                    f"Purchases: {purchase_summary['count']} records, active total {purchase_summary['active_total']}.",
                    f"Supplier quotations: {quotation_summary['count']} records, total {quotation_summary['total']}.",
                    f"Payment batches: {payment_summary['count']} records, scheduled or open payables {open_payment_summary['total']}.",
                ],
            ),
            chat_section(
                "What this means",
                items=[
                    f"This supplier has {purchase_summary['active_count']} active purchase records in the selected scope.",
                    f"Scheduled or open AP is {open_payment_summary['total']} after paid and cancelled batches are excluded.",
                    "Open the records below to review line items, statuses, due dates, and payment status.",
                ],
            ),
            chat_section("Recent purchases", records=build_purchase_records(purchase_rows)),
            chat_section("Payment batches", records=build_payment_batch_records(payment_batch_rows)),
            chat_section("Top purchased products", records=top_product_records),
            chat_section("Supplier quotations", records=build_quotation_records(quotation_rows)),
        ],
    }


def presentation_to_text(presentation):
    if not presentation:
        return ""

    lines = [presentation.get("title", "Assistant summary")]
    if presentation.get("subtitle"):
        lines.append(presentation["subtitle"])
    if presentation.get("metrics"):
        lines.append(
            ", ".join(
                f"{metric['label']}: {metric['value']}"
                for metric in presentation["metrics"][:5]
            )
        )
    for section in presentation.get("sections", []):
        items = section.get("items") or []
        records = section.get("records") or []
        if items:
            lines.append(f"{section['title']}: " + " ".join(items[:3]))
            continue
        if records:
            lines.append(
                f"{section['title']}: "
                + " ".join(
                    f"{record['label']} ({record['meta']}) {record['value']}".strip()
                    for record in records[:4]
                )
            )
    return "\n".join(line for line in lines if line)


def get_partner_summary_presentation(question, context):
    question_text = normalize_chat_text(question)
    customer_summaries = context.get("partner_summaries", {}).get("customers", [])
    supplier_summaries = context.get("partner_summaries", {}).get("suppliers", [])
    has_partner_scope = bool(customer_summaries or supplier_summaries)
    has_named_date_scope = bool(context.get("date_interval"))
    wants_summary = any(
        phrase in question_text
        for phrase in (
            "summary",
            "summarize",
            "overview",
            "activity",
            "account",
            "customer",
            "supplier",
            "partner",
            "business",
            "from",
            "between",
            "during",
            "total",
            "สรุป",
            "กิจกรรม",
            "บัญชี",
            "ลูกค้า",
            "ผู้จัดจำหน่าย",
            "ผู้ขาย",
            "คู่ค้า",
            "ยอดรวม",
        )
    )
    if not has_partner_scope:
        return None
    if customer_summaries and contains_any(
        question_text,
        ("customer", "sale", "billing", "credit", "ลูกค้า", "ขาย", "ใบวางบิล", "ใบลดหนี้"),
    ):
        return customer_summaries[0]
    if supplier_summaries and contains_any(
        question_text,
        ("supplier", "purchase", "payment", "ผู้จัดจำหน่าย", "ผู้ขาย", "ซื้อ", "จ่ายเงิน", "เจ้าหนี้"),
    ):
        return supplier_summaries[0]
    if has_named_date_scope or wants_summary:
        return customer_summaries[0] if customer_summaries else supplier_summaries[0]
    if customer_summaries and not supplier_summaries:
        return customer_summaries[0]
    if supplier_summaries and not customer_summaries:
        return supplier_summaries[0]
    return None


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
        for prefix in ["PO", "TI", "BN", "PMT", "QT", "CN"]:
            if upper_term.startswith(f"{prefix}-"):
                return prefix
    return ""


def matched_rows(context, key):
    count = context["match_counts"].get(key, 0)
    return context[key][:count] if count else []


def build_quotation_summary_answer(rows, date_interval=None, summary=None):
    if not rows:
        scope = f" for {date_interval_label(date_interval)}" if date_interval else ""
        return f"No quotation records were found{scope}."

    summary = summary or summarize_money_rows(rows)
    scope = f" for {date_interval_label(date_interval)}" if date_interval else ""
    lines = " ".join(
        f"{row['reference_no'] or row['id']}: {row['customer_name'] or row['supplier_name']}, total {row['grand_total']}."
        for row in rows[:5]
    )
    return f"Quotation summary{scope}: {summary['count']} records, total {summary['total']}. {lines}"


def build_credit_note_summary_answer(rows, date_interval=None, summary=None):
    if not rows:
        scope = f" for {date_interval_label(date_interval)}" if date_interval else ""
        return f"No credit note records were found{scope}."

    summary = summary or summarize_money_rows(rows, amount_key="total_amount")
    scope = f" for {date_interval_label(date_interval)}" if date_interval else ""
    lines = " ".join(
        f"{row['reference_no'] or row['id']}: {row['customer_name']}, {row['status']}, total {row['total_amount']}."
        for row in rows[:5]
    )
    return (
        f"Credit note summary{scope}: {summary['count']} records, "
        f"{summary['active_count']} active, total {summary['total']}, "
        f"active total {summary['active_total']}. {lines}"
    )


def build_net_position_answer(context):
    finance = context["dashboard"]["finance"]
    cashflow = context["dashboard"]["cashflow"]
    return (
        f"Net position ({finance['period_label']}): AR {finance['ar']['outstanding']}, "
        f"AP {finance['ap']['outstanding']}, net {finance['net_position']}. "
        f"Open balances today: AR {cashflow['ar_total_open']}, AP {cashflow['ap_total_open']}, "
        f"net {cashflow['net_open']}. Overdue AR {cashflow['overdue_ar']}, overdue AP {cashflow['overdue_ap']}."
    )


def build_order_coverage_answer(context):
    coverage = context["dashboard"]["order_coverage"]
    ready = coverage["states"]["ready"]
    incoming = coverage["states"]["incoming"]
    gap = coverage["states"]["gap"]
    total = coverage["total"]
    return (
        f"Order coverage: {coverage['coverage_pct']}% covered. "
        f"Ready now {ready['units']} units / {ready['value']} value, "
        f"incoming {incoming['units']} units / {incoming['value']} value, "
        f"gap {gap['units']} units / {gap['value']} value, "
        f"across {total['units']} units / {total['value']} total open demand."
    )


def build_stock_chat_presentation(context, matching_stock_only=False):
    rows = context["stock"]["matching_rows"] if matching_stock_only else context["stock"]["low_stock_rows"]
    if not rows:
        return {
            "title": "Stock summary",
            "subtitle": chat_scope_label(context.get("date_interval"), fallback="Current inventory"),
            "metrics": [chat_metric("Low-stock items", 0)],
            "sections": [chat_section("Highlights", items=["No low-stock products were found from the current inventory data."])],
        }
    return {
        "title": "Stock summary" if matching_stock_only else "Restock priorities",
        "subtitle": chat_scope_label(context.get("date_interval"), fallback="Current inventory"),
        "metrics": [
            chat_metric("Items shown", min(len(rows), CHAT_RECORD_LIMIT)),
            chat_metric("Low-stock items", len(context["stock"]["low_stock_rows"])),
        ],
        "sections": [
            chat_section(
                "How to read this",
                items=[
                    "Available stock is the quantity currently free to sell.",
                    "Reorder is the calculated point where replenishment should start.",
                    "Recommended restock is the quantity needed to move the product back above its reorder need.",
                ],
            ),
            chat_section(
                "Products",
                records=[
                    chat_record(
                        f"{row['product_name']} ({row['sku']})",
                        meta=combine_chat_meta(
                            f"available {row['available_stock']} {row['unit']}",
                            f"reorder {row['reorder_level']}",
                        ),
                        value=row["recommended_restock"],
                        value_label="Recommended restock",
                        target_type="product",
                        target_id=row["product_id"],
                    )
                    for row in rows[:CHAT_RECORD_LIMIT]
                ],
            )
        ],
    }


def build_transaction_chat_presentation(title, subtitle, summary, rows, record_builder):
    if not rows:
        return {
            "title": title,
            "subtitle": subtitle,
            "metrics": [chat_metric("Records", 0)],
            "sections": [chat_section("Highlights", items=[f"No records were found for {subtitle.lower()}."])],
        }
    return {
        "title": title,
        "subtitle": subtitle,
        "metrics": [
            chat_metric("Records", summary["count"]),
            chat_metric("Active", summary["active_count"]),
            chat_metric("Total", summary["total"]),
        ],
        "sections": [
            chat_section(
                "Highlights",
                items=[
                    f"{summary['count']} records matched the question.",
                    f"Active total is {summary['active_total']}.",
                    "Open any listed record to review document fields, line items, status, totals, and linked documents.",
                ],
            ),
            chat_section("Recent records", records=record_builder(rows)),
        ],
    }


def build_reference_chat_presentation(context, reference_prefix):
    if reference_prefix == "PO" and matched_rows(context, "purchases"):
        return build_transaction_chat_presentation(
            "Purchase summary",
            chat_scope_label(context.get("date_interval"), fallback="Matched reference"),
            context["summaries"]["purchases"],
            matched_rows(context, "purchases"),
            build_purchase_records,
        )
    if reference_prefix == "TI" and matched_rows(context, "sales"):
        return build_transaction_chat_presentation(
            "Sales summary",
            chat_scope_label(context.get("date_interval"), fallback="Matched reference"),
            context["summaries"]["sales"],
            matched_rows(context, "sales"),
            build_sale_records,
        )
    if reference_prefix == "BN" and matched_rows(context, "billing_notes"):
        return build_transaction_chat_presentation(
            "Billing note summary",
            chat_scope_label(context.get("date_interval"), fallback="Matched reference"),
            context["summaries"]["billing_notes"],
            matched_rows(context, "billing_notes"),
            build_billing_note_records,
        )
    if reference_prefix == "PMT" and matched_rows(context, "payment_batches"):
        return build_transaction_chat_presentation(
            "Payment batch summary",
            chat_scope_label(context.get("date_interval"), fallback="Matched reference"),
            context["summaries"]["payment_batches"],
            matched_rows(context, "payment_batches"),
            build_payment_batch_records,
        )
    if reference_prefix == "QT" and matched_rows(context, "quotations"):
        return build_transaction_chat_presentation(
            "Quotation summary",
            chat_scope_label(context.get("date_interval"), fallback="Matched reference"),
            context["summaries"]["quotations"],
            matched_rows(context, "quotations"),
            build_quotation_records,
        )
    if reference_prefix == "CN" and matched_rows(context, "credit_notes"):
        return build_transaction_chat_presentation(
            "Credit note summary",
            chat_scope_label(context.get("date_interval"), fallback="Matched reference"),
            context["summaries"]["credit_notes"],
            matched_rows(context, "credit_notes"),
            build_credit_note_records,
        )
    return {
        "title": "Reference lookup",
        "subtitle": "Matched reference",
        "metrics": [chat_metric("Matches", 0)],
        "sections": [chat_section("Highlights", items=["I could not find a matching reference number in the current inventory data."])],
    }


def build_net_position_presentation(context):
    finance = context["dashboard"]["finance"]
    cashflow = context["dashboard"]["cashflow"]
    return {
        "title": "Net position",
        "subtitle": finance["period_label"],
        "metrics": [
            chat_metric("AR", finance["ar"]["outstanding"], tone="success"),
            chat_metric("AP", finance["ap"]["outstanding"], tone="warning"),
            chat_metric("Net", finance["net_position"]),
            chat_metric("Open net", cashflow["net_open"]),
        ],
        "sections": [
            chat_section(
                "Highlights",
                items=[
                    f"Open receivables today: {cashflow['ar_total_open']}.",
                    f"Open payables today: {cashflow['ap_total_open']}.",
                    f"Overdue AR {cashflow['overdue_ar']}; overdue AP {cashflow['overdue_ap']}.",
                    f"Net open position is {cashflow['net_open']}, calculated as open AR minus open AP.",
                ],
            )
        ],
    }


def build_order_coverage_presentation(context):
    coverage = context["dashboard"]["order_coverage"]
    return {
        "title": "Order coverage",
        "subtitle": coverage["today"],
        "metrics": [
            chat_metric("Coverage", f"{coverage['coverage_pct']}%"),
            chat_metric("Ready units", coverage["states"]["ready"]["units"]),
            chat_metric("Incoming units", coverage["states"]["incoming"]["units"]),
            chat_metric("Gap units", coverage["states"]["gap"]["units"], tone="warning"),
        ],
        "sections": [
            chat_section(
                "Highlights",
                items=[
                    f"Ready now value: {coverage['states']['ready']['value']}.",
                    f"Incoming value: {coverage['states']['incoming']['value']}.",
                    f"Gap value: {coverage['states']['gap']['value']} across open demand {coverage['total']['value']}.",
                    "Ready means stock can cover demand now; incoming means open POs can cover it; gap means demand still needs purchasing action.",
                ],
            )
        ],
    }


def build_exception_presentation(context):
    overdue_billing = BillingNote.objects.exclude(
        status__in=(BillingNote.STATUS_FULLY_RECEIVED, BillingNote.STATUS_CANCELLED)
    ).filter(expected_payment_date__lt=context["today"]).order_by("expected_payment_date", "created_at")
    overdue_payment = PaymentBatch.objects.exclude(
        status__in=(PaymentBatch.STATUS_PAID, PaymentBatch.STATUS_CANCELLED)
    ).filter(planned_payment_date__lt=context["today"]).order_by("planned_payment_date", "created_at")
    delayed_purchase_items = PurchaseItem.objects.select_related("purchase").filter(
        item_status=PurchaseItem.ITEM_PENDING,
        expected_delivery_date__lt=context["today"],
    ).order_by("expected_delivery_date", "purchase__created_at")
    backordered_sale_items = SaleItem.objects.select_related("sale").filter(
        item_status=SaleItem.ITEM_PENDING,
        product_id__isnull=False,
    ).exclude(sale__status__in=SALE_INACTIVE_TRANSACTION_STATUSES).order_by("sale__transaction_date", "sale__created_at")

    overdue_billing_rows = [serialize_billing_note_for_chat(note) for note in overdue_billing[:CHAT_RECORD_LIMIT]]
    overdue_payment_rows = [serialize_payment_batch_for_chat(batch) for batch in overdue_payment[:CHAT_RECORD_LIMIT]]
    gap_units = context["dashboard"]["order_coverage"]["states"]["gap"]["units"]
    return {
        "title": "Overdue and exception monitor",
        "subtitle": context["today"].isoformat(),
        "metrics": [
            chat_metric("Overdue AR", context["dashboard"]["cashflow"]["overdue_ar"], tone="warning"),
            chat_metric("Overdue AP", context["dashboard"]["cashflow"]["overdue_ap"], tone="warning"),
            chat_metric("Delayed PO lines", delayed_purchase_items.count(), tone="warning"),
            chat_metric("Backorder gap units", gap_units, tone="warning"),
        ],
        "sections": [
            chat_section(
                "How to use this",
                items=[
                    "Overdue AR should be followed up with customers.",
                    "Overdue AP should be reviewed against cash position and supplier terms.",
                    "Delayed PO lines and backordered sale lines identify operational blockers.",
                ],
            ),
            chat_section(
                "Overdue billing notes",
                records=build_exception_transaction_records(
                    overdue_billing_rows,
                    "expected_payment_date",
                    "customer_name",
                    "total_amount",
                    "overdue AR",
                    target_type="billing_note",
                ),
            ),
            chat_section(
                "Overdue payment batches",
                records=build_exception_transaction_records(
                    overdue_payment_rows,
                    "planned_payment_date",
                    "supplier_name",
                    "total_amount",
                    "overdue AP",
                    target_type="payment_batch",
                ),
            ),
            chat_section(
                "Delayed purchase lines",
                records=[
                    chat_record(
                        item.purchase.reference_no or item.purchase_id,
                        meta=combine_chat_meta(item.product_name, item.expected_delivery_date, item.purchase.supplier_name),
                        value=as_number(item.base_quantity),
                        value_label="Qty",
                        target_type="purchase",
                        target_id=item.purchase_id,
                    )
                    for item in delayed_purchase_items[:CHAT_RECORD_LIMIT]
                ],
            ),
            chat_section(
                "Backordered sale lines",
                records=[
                    chat_record(
                        item.sale.reference_no or item.sale_id,
                        meta=combine_chat_meta(item.product_name, item.sale.customer_name, item.sale.transaction_date),
                        value=as_number(item.base_quantity),
                        value_label="Qty",
                        target_type="sale",
                        target_id=item.sale_id,
                    )
                    for item in backordered_sale_items[:CHAT_RECORD_LIMIT]
                ],
            ),
        ],
    }


def build_reference_line_item_presentation(context, reference_prefix):
    record_map = {
        "PO": ("Purchase line items", matched_rows(context, "purchases"), "items", "purchase", "purchase"),
        "TI": ("Sales line items", matched_rows(context, "sales"), "items", "sale", "sale"),
        "QT": ("Quotation line items", matched_rows(context, "quotations"), "items", "item", "quotation"),
        "CN": ("Credit note lines", matched_rows(context, "credit_notes"), "lines", "credit", "credit_note"),
        "BN": ("Billing note lines", matched_rows(context, "billing_notes"), "lines", "billing", "billing_note"),
        "PMT": ("Payment batch lines", matched_rows(context, "payment_batches"), "lines", "payment", "payment_batch"),
    }
    title, rows, key, record_type, target_type = record_map.get(reference_prefix, ("Line items", [], "items", "item", ""))
    if not rows:
        return None
    row = rows[0]
    items = row.get(key, [])
    return {
        "title": title,
        "subtitle": row.get("reference_no") or row.get("id") or "Matched reference",
        "metrics": [
            chat_metric("Lines", len(items)),
            chat_metric("Status", row.get("status", "")),
            chat_metric("Total", row.get("grand_total", row.get("total_amount", ""))),
        ],
        "sections": [
            chat_section(
                "Document detail",
                items=[
                    f"Reference: {row.get('reference_no') or row.get('id')}.",
                    f"Status: {row.get('status', '')}.",
                    f"Total: {row.get('grand_total', row.get('total_amount', ''))}.",
                    "Open any line below to view the parent document detail.",
                ],
            ),
            chat_section(
                "Line details",
                records=build_detail_records(
                    items,
                    record_type=record_type,
                    parent_target_type=target_type,
                    parent_target_id=row.get("id"),
                ),
            )
        ],
    }


def build_out_of_scope_presentation():
    return {
        "title": "Outside current assistant scope",
        "subtitle": "Supported workflows only",
        "metrics": [
            chat_metric("Core focus", 4),
        ],
        "sections": [
            chat_section(
                "This assistant focuses on",
                items=[
                    "Stock, reorder, and fulfillment questions.",
                    "Customer or supplier summaries within a date range.",
                    "Receivables, payables, overdue exceptions, and order coverage.",
                    "Reference lookup and line-item detail for existing documents.",
                ],
            ),
            chat_section(
                "Not currently supported",
                items=[
                    "Deep margin or profitability analysis.",
                    "Customer trend analysis or supplier performance analytics.",
                    "Broad open-ended reporting outside the core workflows.",
                ],
            ),
        ],
    }


def build_capabilities_presentation(context):
    return {
        "title": "AI assistant core scope",
        "subtitle": chat_scope_label(context.get("date_interval"), fallback="Current data"),
        "metrics": [
            chat_metric("Core workflows", 4),
            chat_metric("Customer matches", len(context.get("matched_customers", []))),
            chat_metric("Supplier matches", len(context.get("matched_suppliers", []))),
            chat_metric("Reference types", 6),
        ],
        "sections": [
            chat_section(
                "You can ask",
                items=[
                    "Stock, reorder, and fulfillment questions.",
                    "Customer or supplier summaries within a date range.",
                    "Receivables, payables, overdue exceptions, and order coverage gaps.",
                    "Reference lookup and line-item detail for PO, TI, QT, BN, PMT, and CN documents.",
                ],
            )
        ],
    }


def build_chat_presentation(question, context=None):
    context = context or build_ai_inventory_context(question)
    matching_stock = context["stock"]["matching_rows"]
    question_text = normalize_chat_text(question)
    reference_prefix = get_reference_prefix(context["query_terms"])
    reference_like = bool(reference_prefix) or any(
        "-" in term and any(char.isdigit() for char in term) for term in context["query_terms"]
    )
    wants_line_items = contains_any(
        question_text,
        (
            "line item",
            "line items",
            "item detail",
            "items in",
            "show items",
            "what is inside",
            "รายการสินค้า",
            "รายละเอียดรายการ",
            "รายการใน",
            "ข้างใน",
        ),
    )

    if contains_any(question_text, ("margin", "profit", "profitability", "gross margin", "มาร์จิ้น", "กำไร")):
        return build_out_of_scope_presentation()

    if contains_any(
        question_text,
        ("lead time", "supplier performance", "vendor performance", "เวลานำ", "ประสิทธิภาพผู้จัดจำหน่าย", "ประสิทธิภาพผู้ขาย"),
    ):
        return build_out_of_scope_presentation()

    if contains_any(question_text, ("trend", "buying pattern", "buying trend", "growth", "แนวโน้ม", "รูปแบบการซื้อ", "การเติบโต")):
        return build_out_of_scope_presentation()

    if reference_like and wants_line_items:
        line_item_presentation = build_reference_line_item_presentation(context, reference_prefix)
        if line_item_presentation:
            return line_item_presentation

    if contains_any(question_text, ("backorder", "backordered", "coverage", "gap", "ค้างส่ง", "ความพร้อมจ่าย", "ช่องว่าง")):
        return build_order_coverage_presentation(context)

    if contains_any(question_text, ("overdue", "exception", "late", "delayed", "เกินกำหนด", "ข้อยกเว้น", "ล่าช้า", "รายการค้าง")):
        return build_exception_presentation(context)

    partner_summary = get_partner_summary_presentation(question, context)
    if partner_summary:
        return partner_summary

    if contains_any(question_text, ("low", "restock", "สต็อกต่ำ", "เติมสินค้า", "เติม", "ต่ำ")):
        return build_stock_chat_presentation(context)

    if matching_stock and contains_any(
        question_text,
        ("product", "sku", "stock", "restock", "reorder", "สินค้า", "รหัสสินค้า", "สต็อก", "จุดสั่งซื้อ"),
    ):
        return build_stock_chat_presentation(context, matching_stock_only=True)

    if contains_any(question_text, ("stock", "สต็อก")):
        return build_stock_chat_presentation(context)

    if reference_like:
        return build_reference_chat_presentation(context, reference_prefix)

    if contains_any(
        question_text,
        ("net position", "receivable", "payable", "ฐานะสุทธิ", "ลูกหนี้", "เจ้าหนี้"),
    ) or contains_any_token(question_text, ("ar", "ap")):
        return build_net_position_presentation(context)

    if contains_any(
        question_text,
        (
            "sale",
            "purchase",
            "quotation",
            "billing",
            "payment",
            "credit",
            "ขาย",
            "ซื้อ",
            "ใบเสนอราคา",
            "ใบวางบิล",
            "จ่ายเงิน",
            "ใบลดหนี้",
        ),
    ):
        return build_out_of_scope_presentation()

    return build_capabilities_presentation(context)


def build_local_chat_answer(question, context=None, presentation=None):
    context = context or build_ai_inventory_context(question)
    presentation = presentation or build_chat_presentation(question, context)
    answer = presentation_to_text(presentation)
    if answer:
        return answer
    return (
        "I focus on four workflows: stock and fulfillment, customer or supplier summaries, "
        "receivables and payables with overdue exceptions, and reference lookup with line-item detail."
    )


def answer_inventory_question(question, request=None):
    """Return the assistant answer for a user question."""
    context = build_ai_inventory_context(question, request)
    presentation = build_chat_presentation(question, context)
    local_answer = build_local_chat_answer(question, context, presentation)
    model_response = generate_openai_chat_response(question, presentation, local_answer)
    response = {
        "answer": model_response["answer"] or local_answer,
        "used_model": model_response["used_model"],
        "presentation": presentation,
    }
    if model_response["used_model"] != "local-summary":
        response["conclusion"] = model_response["conclusion"]
        response["highlights"] = model_response["highlights"]
    return response

__all__ = [
    "CHAT_INITIAL_RECORD_LIMIT",
    "CHAT_RECORD_LIMIT",
    "CHAT_STOP_WORDS",
    "PARTNER_NAME_STOP_WORDS",
    "answer_inventory_question",
    "build_ai_inventory_context",
    "build_billing_note_records",
    "build_capabilities_presentation",
    "build_chat_presentation",
    "build_credit_note_records",
    "build_credit_note_summary_answer",
    "build_customer_chat_summary",
    "build_detail_records",
    "build_exception_presentation",
    "build_exception_transaction_records",
    "build_local_chat_answer",
    "build_margin_records",
    "build_net_position_answer",
    "build_net_position_presentation",
    "build_order_coverage_answer",
    "build_order_coverage_presentation",
    "build_out_of_scope_presentation",
    "build_payment_batch_records",
    "build_purchase_records",
    "build_quotation_records",
    "build_quotation_summary_answer",
    "build_reference_chat_presentation",
    "build_reference_line_item_presentation",
    "build_sale_records",
    "build_stock_chat_presentation",
    "build_supplier_chat_summary",
    "build_top_product_records",
    "build_transaction_chat_presentation",
    "build_transaction_summary_answer",
    "combine_chat_meta",
    "compute_margin_rows_from_sales_rows",
    "date_interval_label",
    "filter_by_date_interval",
    "format_transaction_line",
    "get_date_interval",
    "get_matching_partner_names",
    "get_partner_summary_presentation",
    "get_query_terms",
    "get_reference_prefix",
    "limited_unique_rows",
    "matched_rows",
    "normalize_chat_text",
    "presentation_to_text",
    "serialize_billing_note_for_chat",
    "serialize_credit_note_for_chat",
    "serialize_payment_batch_for_chat",
    "serialize_purchase_for_chat",
    "serialize_quotation_for_chat",
    "serialize_sale_for_chat",
    "summarize_model_rows",
    "summarize_money_rows",
    "transaction_target",
]
