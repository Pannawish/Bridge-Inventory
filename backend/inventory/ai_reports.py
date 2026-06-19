import json
import logging
import re
from collections import defaultdict
from datetime import date
from decimal import Decimal
from html import escape

from django.conf import settings
from django.db.models import Prefetch, Q, Sum
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework.exceptions import ValidationError

from .models import (
    BillingNote,
    CreditNote,
    Customer,
    PaymentBatch,
    Product,
    ProductSupplier,
    Purchase,
    PurchaseItem,
    Quotation,
    Sale,
    SaleItem,
    Supplier,
)
from .services import as_number, build_stock_report


logger = logging.getLogger(__name__)

REPORT_RECORD_LIMIT = 25
REPORT_CHART_LIMIT = 8
VALID_SCOPE_TYPES = {"supplier", "customer", "product"}
VALID_LANGUAGES = {"en", "th"}

SALE_INACTIVE_TRANSACTION_STATUSES = {
    Sale.STATUS_CANCELLED,
    Sale.STATUS_RETURNED,
}
SALE_INACTIVE_ITEM_STATUSES = {
    SaleItem.ITEM_CANCELLED,
    SaleItem.ITEM_RETURNED,
}

REPORT_TEXT = {
    "en": {
        "page_title": "AI Report",
        "print": "Print",
        "generated": "Generated",
        "period": "Period",
        "all_time": "All time",
        "scope_supplier": "Supplier",
        "scope_customer": "Customer",
        "scope_product": "Product",
        "summary": "Executive summary",
        "key_insights": "Key insights",
        "charts": "Charts",
        "records": "Records",
        "no_records": "No records found in this scope.",
        "source_note": "Prepared from current Bridge Inventory records.",
        "ai_fallback": "AI API output was unavailable, so this report uses local analysis from the same selected records.",
        "purchase_total": "Purchase total",
        "purchase_count": "Purchases",
        "sales_total": "Sales total",
        "sales_count": "Sales",
        "quotation_total": "Quotation total",
        "quotation_count": "Quotations",
        "open_ap": "Open AP",
        "open_ar": "Open AR",
        "credit_total": "Credits",
        "available_stock": "Available stock",
        "incoming_stock": "Incoming stock",
        "units_sold": "Units sold",
        "gross_margin": "Gross margin",
        "margin_rate": "Margin rate",
        "purchase_trend": "Purchase trend",
        "sales_trend": "Sales trend",
        "top_products": "Top products",
        "top_customers": "Top customers",
        "top_suppliers": "Top suppliers",
        "recent_purchases": "Recent purchases",
        "recent_sales": "Recent sales",
        "recent_quotations": "Recent quotations",
        "billing_notes": "Billing notes",
        "payment_batches": "Payment batches",
        "credit_notes": "Credit notes",
        "supplier_links": "Supplier options",
        "reference": "Reference",
        "date": "Date",
        "partner": "Partner",
        "status": "Status",
        "quantity": "Qty",
        "amount": "Amount",
        "unit_cost": "Unit cost",
        "lead_time": "Lead time",
        "sku": "SKU",
        "product": "Product",
        "category": "Category",
        "not_available": "N/A",
    },
    "th": {
        "page_title": "รายงาน AI",
        "print": "พิมพ์",
        "generated": "สร้างเมื่อ",
        "period": "ช่วงเวลา",
        "all_time": "ตลอดระยะเวลา",
        "scope_supplier": "ผู้จัดจำหน่าย",
        "scope_customer": "ลูกค้า",
        "scope_product": "สินค้า",
        "summary": "สรุปผู้บริหาร",
        "key_insights": "ประเด็นสำคัญ",
        "charts": "แผนภูมิ",
        "records": "รายการเอกสาร",
        "no_records": "ไม่พบรายการในขอบเขตนี้",
        "source_note": "จัดทำจากข้อมูลปัจจุบันใน Bridge Inventory",
        "ai_fallback": "ไม่สามารถรับผลจาก AI API ได้ รายงานนี้จึงใช้การวิเคราะห์ภายในจากข้อมูลชุดเดียวกัน",
        "purchase_total": "ยอดซื้อรวม",
        "purchase_count": "จำนวนใบซื้อ",
        "sales_total": "ยอดขายรวม",
        "sales_count": "จำนวนใบขาย",
        "quotation_total": "ยอดใบเสนอราคา",
        "quotation_count": "จำนวนใบเสนอราคา",
        "open_ap": "เจ้าหนี้คงค้าง",
        "open_ar": "ลูกหนี้คงค้าง",
        "credit_total": "ยอดลดหนี้",
        "available_stock": "สต็อกพร้อมขาย",
        "incoming_stock": "สต็อกกำลังเข้า",
        "units_sold": "จำนวนขาย",
        "gross_margin": "กำไรขั้นต้น",
        "margin_rate": "อัตรากำไร",
        "purchase_trend": "แนวโน้มการซื้อ",
        "sales_trend": "แนวโน้มการขาย",
        "top_products": "สินค้าหลัก",
        "top_customers": "ลูกค้าหลัก",
        "top_suppliers": "ผู้จัดจำหน่ายหลัก",
        "recent_purchases": "ใบซื้อล่าสุด",
        "recent_sales": "ใบขายล่าสุด",
        "recent_quotations": "ใบเสนอราคาล่าสุด",
        "billing_notes": "ใบวางบิล",
        "payment_batches": "ชุดชำระเงิน",
        "credit_notes": "ใบลดหนี้",
        "supplier_links": "ตัวเลือกผู้จัดจำหน่าย",
        "reference": "เลขที่อ้างอิง",
        "date": "วันที่",
        "partner": "คู่ค้า",
        "status": "สถานะ",
        "quantity": "จำนวน",
        "amount": "มูลค่า",
        "unit_cost": "ต้นทุนต่อหน่วย",
        "lead_time": "ระยะเวลาส่งมอบ",
        "sku": "รหัสสินค้า",
        "product": "สินค้า",
        "category": "หมวดหมู่",
        "not_available": "ไม่มีข้อมูล",
    },
}

SCRIPT_TAG_RE = re.compile(r"<\s*script\b[^>]*>.*?<\s*/\s*script\s*>", re.IGNORECASE | re.DOTALL)
UNSAFE_TAG_RE = re.compile(r"</?\s*(iframe|object|embed|form|input|button|link)\b[^>]*>", re.IGNORECASE)
EVENT_ATTR_RE = re.compile(
    r"\s+on[a-zA-Z]+\s*=\s*(\"[^\"]*\"|'[^']*'|[^\s>]+)",
    re.IGNORECASE,
)
JS_URL_ATTR_RE = re.compile(
    r"\s+(href|src)\s*=\s*(\"[^\"]*(javascript:|data:)[^\"]*\"|'[^']*(javascript:|data:)[^']*'|[^\s>]*(javascript:|data:)[^\s>]*)",
    re.IGNORECASE,
)
UNSAFE_STYLE_ATTR_RE = re.compile(
    r"\s+style\s*=\s*(\"[^\"]*(url\s*\(|expression\s*\(|javascript:)[^\"]*\"|'[^']*(url\s*\(|expression\s*\(|javascript:)[^']*')",
    re.IGNORECASE,
)


def generate_ai_report(payload):
    request_data = normalize_report_request(payload)
    context = build_report_context(request_data)
    ai_body, used_model = generate_ai_report_body(context)

    if not ai_body:
        ai_body = build_local_report_body(context, fallback=used_model == "local-report-fallback")
        used_model = used_model or "local-report"

    html = build_report_document(context, ai_body)
    return {
        "html": html,
        "used_model": used_model,
        "scope": context["scope"],
        "period": context["period"],
        "generated_at": context["generated_at"],
    }


def normalize_report_request(payload):
    scope_type = f"{payload.get('scope_type') or ''}".strip().lower()
    if scope_type not in VALID_SCOPE_TYPES:
        raise ValidationError({"scope_type": "Choose supplier, customer, or product."})

    entity_id = f"{payload.get('entity_id') or ''}".strip()
    if not entity_id:
        raise ValidationError({"entity_id": "Selected record is required."})

    language = f"{payload.get('language') or 'en'}".strip().lower()
    if language not in VALID_LANGUAGES:
        language = "en"

    period_type = f"{payload.get('period_type') or 'all'}".strip().lower()
    date_interval = None
    if period_type != "all":
        start_date = parse_date(f"{payload.get('date_from') or ''}".strip())
        end_date = parse_date(f"{payload.get('date_to') or ''}".strip())
        if start_date is None or end_date is None:
            raise ValidationError({"date_range": "Start and end dates are required."})
        if end_date < start_date:
            raise ValidationError({"date_range": "End date must be on or after start date."})
        date_interval = {"start": start_date, "end": end_date}

    return {
        "scope_type": scope_type,
        "entity_id": entity_id,
        "language": language,
        "date_interval": date_interval,
    }


def build_report_context(request_data):
    scope_type = request_data["scope_type"]
    if scope_type == "supplier":
        return build_supplier_report_context(request_data)
    if scope_type == "customer":
        return build_customer_report_context(request_data)
    return build_product_report_context(request_data)


def build_supplier_report_context(request_data):
    labels = get_labels(request_data["language"])
    supplier = Supplier.objects.filter(pk=request_data["entity_id"]).first()
    if supplier is None:
        raise ValidationError({"entity_id": "Supplier was not found."})

    interval = request_data["date_interval"]
    name = supplier.company_name
    purchases = apply_interval(
        Purchase.objects.filter(Q(supplier=supplier) | Q(supplier_name=name)),
        "transaction_date",
        interval,
    )
    purchases = purchases.prefetch_related(
        Prefetch("items", queryset=PurchaseItem.objects.select_related("product"))
    )
    quotations = apply_interval(
        Quotation.objects.filter(Q(supplier=supplier) | Q(supplier_name=name)),
        "quotation_date",
        interval,
    ).prefetch_related("line_items")
    payment_batches = apply_interval(
        PaymentBatch.objects.filter(Q(supplier=supplier) | Q(supplier_name=name)),
        "batch_date",
        interval,
    ).prefetch_related("lines__purchase")

    purchase_summary = money_summary(
        purchases,
        "grand_total",
        inactive_statuses={Purchase.STATUS_CANCELLED},
    )
    quotation_summary = money_summary(quotations, "grand_total")
    open_ap = queryset_total(
        payment_batches.exclude(
            status__in=(PaymentBatch.STATUS_PAID, PaymentBatch.STATUS_CANCELLED)
        ),
        "total_amount",
    )

    item_queryset = PurchaseItem.objects.filter(purchase__in=purchases).exclude(
        item_status=PurchaseItem.ITEM_CANCELLED
    ).exclude(purchase__status=Purchase.STATUS_CANCELLED)
    top_products = item_chart_rows(item_queryset, labels["not_available"])
    purchase_trend = trend_chart_rows(
        purchases.exclude(status=Purchase.STATUS_CANCELLED),
        "transaction_date",
        "grand_total",
    )

    metrics = [
        metric(labels["purchase_total"], money_display(purchase_summary["active_total"]), "accent"),
        metric(labels["purchase_count"], purchase_summary["active_count"]),
        metric(labels["open_ap"], money_display(open_ap), "warning" if open_ap else "default"),
        metric(labels["quotation_count"], quotation_summary["count"]),
    ]
    charts = [
        chart(labels["purchase_trend"], purchase_trend),
        chart(labels["top_products"], top_products),
    ]
    tables = [
        table(
            labels["recent_purchases"],
            ["reference", "date", "status", "amount"],
            [
                purchase_table_row(purchase, labels)
                for purchase in purchases.order_by("-transaction_date", "-created_at")[:REPORT_RECORD_LIMIT]
            ],
            labels,
        ),
        table(
            labels["payment_batches"],
            ["reference", "date", "status", "amount"],
            [
                payment_batch_table_row(batch, labels)
                for batch in payment_batches.order_by("-batch_date", "-created_at")[:REPORT_RECORD_LIMIT]
            ],
            labels,
        ),
        table(
            labels["recent_quotations"],
            ["reference", "date", "status", "amount"],
            [
                quotation_table_row(quotation, labels)
                for quotation in quotations.order_by("-quotation_date", "-created_at")[:REPORT_RECORD_LIMIT]
            ],
            labels,
        ),
    ]

    insights = [
        f"{labels['purchase_count']}: {purchase_summary['active_count']}.",
        f"{labels['purchase_total']}: {money_display(purchase_summary['active_total'])}.",
        f"{labels['open_ap']}: {money_display(open_ap)}.",
    ]
    return report_context(
        request_data,
        labels,
        scope_type="supplier",
        entity={
            "id": supplier.id,
            "name": supplier.company_name,
            "taxpayer_id": supplier.taxpayer_id,
        },
        title=f"{labels['scope_supplier']} {supplier.company_name}",
        metrics=metrics,
        charts=charts,
        tables=tables,
        insights=insights,
    )


def build_customer_report_context(request_data):
    labels = get_labels(request_data["language"])
    customer = Customer.objects.filter(pk=request_data["entity_id"]).first()
    if customer is None:
        raise ValidationError({"entity_id": "Customer was not found."})

    interval = request_data["date_interval"]
    name = customer.company_name
    sales = apply_interval(
        Sale.objects.filter(Q(customer=customer) | Q(customer_name=name)),
        "transaction_date",
        interval,
    ).prefetch_related(Prefetch("items", queryset=SaleItem.objects.select_related("product")))
    quotations = apply_interval(
        Quotation.objects.filter(Q(customer=customer) | Q(customer_name=name)),
        "quotation_date",
        interval,
    ).prefetch_related("line_items")
    billing_notes = apply_interval(
        BillingNote.objects.filter(Q(customer=customer) | Q(customer_name=name)),
        "billing_note_date",
        interval,
    ).prefetch_related("lines__sale")
    credit_notes = apply_interval(
        CreditNote.objects.filter(Q(customer=customer) | Q(customer_name=name)),
        "credit_note_date",
        interval,
    ).prefetch_related("lines")

    sales_summary = money_summary(
        sales,
        "grand_total",
        inactive_statuses=SALE_INACTIVE_TRANSACTION_STATUSES,
    )
    quotation_summary = money_summary(quotations, "grand_total")
    open_ar = queryset_total(
        billing_notes.exclude(
            status__in=(BillingNote.STATUS_FULLY_RECEIVED, BillingNote.STATUS_CANCELLED)
        ),
        "total_amount",
    )
    credits = queryset_total(
        credit_notes.exclude(status=CreditNote.STATUS_CANCELLED),
        "total_amount",
    )

    item_queryset = SaleItem.objects.filter(sale__in=sales).exclude(
        item_status__in=SALE_INACTIVE_ITEM_STATUSES
    ).exclude(sale__status__in=SALE_INACTIVE_TRANSACTION_STATUSES)
    top_products = item_chart_rows(item_queryset, labels["not_available"])
    sales_trend = trend_chart_rows(
        sales.exclude(status__in=SALE_INACTIVE_TRANSACTION_STATUSES),
        "transaction_date",
        "grand_total",
    )

    metrics = [
        metric(labels["sales_total"], money_display(sales_summary["active_total"]), "accent"),
        metric(labels["sales_count"], sales_summary["active_count"]),
        metric(labels["open_ar"], money_display(open_ar), "positive" if open_ar else "default"),
        metric(labels["credit_total"], money_display(credits), "warning" if credits else "default"),
    ]
    charts = [
        chart(labels["sales_trend"], sales_trend),
        chart(labels["top_products"], top_products),
    ]
    tables = [
        table(
            labels["recent_sales"],
            ["reference", "date", "status", "amount"],
            [
                sale_table_row(sale, labels)
                for sale in sales.order_by("-transaction_date", "-created_at")[:REPORT_RECORD_LIMIT]
            ],
            labels,
        ),
        table(
            labels["billing_notes"],
            ["reference", "date", "status", "amount"],
            [
                billing_note_table_row(note, labels)
                for note in billing_notes.order_by("-billing_note_date", "-created_at")[:REPORT_RECORD_LIMIT]
            ],
            labels,
        ),
        table(
            labels["recent_quotations"],
            ["reference", "date", "status", "amount"],
            [
                quotation_table_row(quotation, labels)
                for quotation in quotations.order_by("-quotation_date", "-created_at")[:REPORT_RECORD_LIMIT]
            ],
            labels,
        ),
        table(
            labels["credit_notes"],
            ["reference", "date", "status", "amount"],
            [
                credit_note_table_row(note, labels)
                for note in credit_notes.order_by("-credit_note_date", "-created_at")[:REPORT_RECORD_LIMIT]
            ],
            labels,
        ),
    ]

    insights = [
        f"{labels['sales_count']}: {sales_summary['active_count']}.",
        f"{labels['sales_total']}: {money_display(sales_summary['active_total'])}.",
        f"{labels['open_ar']}: {money_display(open_ar)}.",
    ]
    return report_context(
        request_data,
        labels,
        scope_type="customer",
        entity={
            "id": customer.id,
            "name": customer.company_name,
            "taxpayer_id": customer.taxpayer_id,
        },
        title=f"{labels['scope_customer']} {customer.company_name}",
        metrics=metrics,
        charts=charts,
        tables=tables,
        insights=insights,
    )


def build_product_report_context(request_data):
    labels = get_labels(request_data["language"])
    product = Product.objects.select_related("category").filter(pk=request_data["entity_id"]).first()
    if product is None:
        raise ValidationError({"entity_id": "Product was not found."})

    interval = request_data["date_interval"]
    purchase_items = apply_interval(
        PurchaseItem.objects.filter(Q(product=product) | Q(sku=product.sku)).select_related("purchase"),
        "purchase__transaction_date",
        interval,
    )
    sale_items = apply_interval(
        SaleItem.objects.filter(Q(product=product) | Q(sku=product.sku)).select_related("sale"),
        "sale__transaction_date",
        interval,
    )
    quotation_items = apply_interval(
        product.quotation_items.select_related("quotation"),
        "quotation__quotation_date",
        interval,
    )
    supplier_links = ProductSupplier.objects.filter(product=product, is_active=True).select_related("supplier")

    valid_purchase_items = purchase_items.exclude(
        item_status=PurchaseItem.ITEM_CANCELLED
    ).exclude(purchase__status=Purchase.STATUS_CANCELLED)
    valid_sale_items = sale_items.exclude(
        item_status__in=SALE_INACTIVE_ITEM_STATUSES
    ).exclude(sale__status__in=SALE_INACTIVE_TRANSACTION_STATUSES)

    purchase_units = queryset_total(valid_purchase_items, "base_quantity")
    purchase_amount = queryset_total(valid_purchase_items, "amount")
    incoming_units = queryset_total(
        valid_purchase_items.filter(item_status=PurchaseItem.ITEM_PENDING),
        "base_quantity",
    )
    sales_units = queryset_total(valid_sale_items, "base_quantity")
    sales_amount = queryset_total(valid_sale_items, "amount")
    sales_cost = sale_item_cost_total(valid_sale_items)
    gross_margin = sales_amount - sales_cost
    margin_pct = (gross_margin / sales_amount * Decimal("100")) if sales_amount else Decimal("0")
    stock_row = find_stock_report_row(product.id)
    available_stock = decimal_value((stock_row or {}).get("available_stock"))

    purchase_trend = trend_chart_rows_from_items(
        valid_purchase_items,
        "purchase__transaction_date",
        "amount",
    )
    sales_trend = trend_chart_rows_from_items(
        valid_sale_items,
        "sale__transaction_date",
        "amount",
    )
    top_customers = partner_chart_rows(valid_sale_items, "sale__customer_name")
    top_suppliers = partner_chart_rows(valid_purchase_items, "purchase__supplier_name")

    metrics = [
        metric(labels["available_stock"], quantity_display(available_stock, product.stock_base_unit), "accent"),
        metric(labels["incoming_stock"], quantity_display(incoming_units, product.stock_base_unit), "warning" if incoming_units else "default"),
        metric(labels["units_sold"], quantity_display(sales_units, product.stock_base_unit)),
        metric(labels["gross_margin"], money_display(gross_margin), "positive" if gross_margin >= 0 else "warning"),
        metric(labels["margin_rate"], f"{format_decimal(margin_pct)}%"),
    ]
    charts = [
        chart(labels["sales_trend"], sales_trend),
        chart(labels["purchase_trend"], purchase_trend),
        chart(labels["top_customers"], top_customers),
        chart(labels["top_suppliers"], top_suppliers),
    ]
    tables = [
        table(
            labels["recent_sales"],
            ["reference", "date", "partner", "status", "quantity", "amount"],
            [
                sale_item_table_row(item, labels)
                for item in valid_sale_items.order_by("-sale__transaction_date", "-sale__created_at")[:REPORT_RECORD_LIMIT]
            ],
            labels,
        ),
        table(
            labels["recent_purchases"],
            ["reference", "date", "partner", "status", "quantity", "amount"],
            [
                purchase_item_table_row(item, labels)
                for item in valid_purchase_items.order_by("-purchase__transaction_date", "-purchase__created_at")[:REPORT_RECORD_LIMIT]
            ],
            labels,
        ),
        table(
            labels["recent_quotations"],
            ["reference", "date", "partner", "quantity", "amount"],
            [
                quotation_item_table_row(item, labels)
                for item in quotation_items.order_by("-quotation__quotation_date", "-quotation__created_at")[:REPORT_RECORD_LIMIT]
            ],
            labels,
        ),
        table(
            labels["supplier_links"],
            ["partner", "unit_cost", "lead_time", "quantity"],
            [
                supplier_link_table_row(link, labels)
                for link in supplier_links.order_by("-is_preferred", "supplier__company_name")[:REPORT_RECORD_LIMIT]
            ],
            labels,
        ),
    ]

    insights = [
        f"{labels['available_stock']}: {quantity_display(available_stock, product.stock_base_unit)}.",
        f"{labels['sales_total']}: {money_display(sales_amount)}.",
        f"{labels['purchase_total']}: {money_display(purchase_amount)}.",
        f"{labels['gross_margin']}: {money_display(gross_margin)} ({format_decimal(margin_pct)}%).",
    ]
    category_name = product.category.name if product.category_id and product.category else product.category_name
    return report_context(
        request_data,
        labels,
        scope_type="product",
        entity={
            "id": product.id,
            "name": product.product_name,
            "sku": product.sku,
            "category": category_name,
            "stock_base_unit": product.stock_base_unit,
        },
        title=f"{labels['scope_product']} {product.product_name}",
        metrics=metrics,
        charts=charts,
        tables=tables,
        insights=insights,
    )


def report_context(request_data, labels, scope_type, entity, title, metrics, charts, tables, insights):
    generated_at = timezone.localtime().strftime("%Y-%m-%d %H:%M")
    return {
        "language": request_data["language"],
        "labels": labels,
        "generated_at": generated_at,
        "title": title,
        "scope": {
            "type": scope_type,
            "label": labels[f"scope_{scope_type}"],
            "entity": entity,
        },
        "period": {
            "label": period_label(request_data["date_interval"], labels),
            "date_from": date_iso(request_data["date_interval"]["start"]) if request_data["date_interval"] else "",
            "date_to": date_iso(request_data["date_interval"]["end"]) if request_data["date_interval"] else "",
            "all_time": request_data["date_interval"] is None,
        },
        "metrics": metrics,
        "charts": [item for item in charts if item["rows"]],
        "tables": tables,
        "insights": insights,
        "source_note": labels["source_note"],
    }


def generate_ai_report_body(context):
    if not settings.OPENAI_API_KEY:
        return "", "local-report"

    prompt = build_ai_report_prompt(context)
    try:
        from openai import OpenAI

        client = OpenAI(api_key=settings.OPENAI_API_KEY, timeout=45.0)
        if hasattr(client, "responses"):
            try:
                response = client.responses.create(
                    model=settings.OPENAI_MODEL,
                    input=[
                        {"role": "system", "content": ai_report_system_prompt(context["language"])},
                        {"role": "user", "content": prompt},
                    ],
                    max_output_tokens=7000,
                )
                body = getattr(response, "output_text", "") or ""
                if body:
                    return sanitize_report_fragment(body), settings.OPENAI_MODEL
            except Exception:
                logger.info("OpenAI Responses API report generation failed; trying chat completions.", exc_info=True)

        response = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": ai_report_system_prompt(context["language"])},
                {"role": "user", "content": prompt},
            ],
            max_tokens=7000,
        )
        body = response.choices[0].message.content or ""
        if body:
            return sanitize_report_fragment(body), settings.OPENAI_MODEL
    except Exception:
        logger.exception("AI report generation failed.")

    return "", "local-report-fallback"


def ai_report_system_prompt(language):
    output_language = "Thai" if language == "th" else "English"
    return (
        "You create concise management reports for an SME inventory reseller. "
        f"Write in {output_language}. Use only the supplied JSON data; do not invent documents, totals, dates, or partners. "
        "Return only an HTML fragment suitable to place inside a <main> element. "
        "Do not include markdown, scripts, forms, buttons, external images, external CSS, or external links. "
        "Use these CSS classes when useful: report-section, metric-grid, metric-card, metric-card tone-accent, "
        "tone-positive, tone-warning, chart-list, chart-row, chart-label, chart-track, chart-fill, chart-value, "
        "data-table, insight-list, action-list, muted. "
        "For chart bars, use inline CSS custom property style=\"--bar: 50%;\" on .chart-fill elements. "
        "Keep the report readable, specific, and business-focused."
    )


def build_ai_report_prompt(context):
    return (
        "Build a printable HTML business report from this Bridge Inventory report context. "
        "Include a title, period, executive summary, metrics, chart sections, useful interpretation, and compact record tables. "
        "Flag empty sections clearly. Context JSON:\n"
        f"{json.dumps(context, ensure_ascii=False, default=str)}"
    )


def build_local_report_body(context, fallback=False):
    labels = context["labels"]
    fallback_note = (
        f"<p class=\"report-note\">{escape(labels['ai_fallback'])}</p>"
        if fallback
        else ""
    )
    metrics_html = "".join(
        f"<article class=\"metric-card tone-{escape(metric_row.get('tone') or 'default')}\">"
        f"<span>{escape(str(metric_row['label']))}</span>"
        f"<strong>{escape(str(metric_row['value']))}</strong>"
        "</article>"
        for metric_row in context["metrics"]
    )
    charts_html = "".join(chart_html(chart_row) for chart_row in context["charts"])
    tables_html = "".join(table_html(table_row, labels) for table_row in context["tables"])
    insights_html = "".join(f"<li>{escape(insight)}</li>" for insight in context["insights"])

    return (
        "<main class=\"ai-report-document\">"
        "<header class=\"report-hero\">"
        f"<p class=\"eyebrow\">{escape(labels['page_title'])}</p>"
        f"<h1>{escape(context['title'])}</h1>"
        f"<p>{escape(labels['period'])}: {escape(context['period']['label'])}</p>"
        f"<p class=\"muted\">{escape(context['source_note'])}</p>"
        f"{fallback_note}"
        "</header>"
        f"<section class=\"report-section\"><h2>{escape(labels['summary'])}</h2>"
        f"<div class=\"metric-grid\">{metrics_html}</div></section>"
        f"<section class=\"report-section\"><h2>{escape(labels['key_insights'])}</h2>"
        f"<ul class=\"insight-list\">{insights_html}</ul></section>"
        f"<section class=\"report-section\"><h2>{escape(labels['charts'])}</h2>{charts_html}</section>"
        f"<section class=\"report-section\"><h2>{escape(labels['records'])}</h2>{tables_html}</section>"
        "</main>"
    )


def build_report_document(context, body):
    labels = context["labels"]
    language = context["language"]
    html_body = ensure_main(sanitize_report_fragment(body), context)
    title = escape(context["title"])
    return (
        "<!doctype html>"
        f"<html lang=\"{escape(language)}\">"
        "<head>"
        "<meta charset=\"utf-8\">"
        "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
        f"<title>{title}</title>"
        f"<style>{report_css()}</style>"
        "</head>"
        "<body>"
        "<div class=\"report-toolbar no-print\">"
        f"<span>{escape(labels['generated'])}: {escape(context['generated_at'])}</span>"
        f"<button type=\"button\" onclick=\"window.print()\">{escape(labels['print'])}</button>"
        "</div>"
        f"{html_body}"
        "</body></html>"
    )


def report_css():
    return """
:root {
  color: #182132;
  background: #eef2f6;
  font-family: Inter, Arial, sans-serif;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: #eef2f6;
  color: #182132;
}
.report-toolbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 12px 24px;
  border-bottom: 1px solid #d9e0ea;
  background: rgba(255, 255, 255, 0.96);
}
.report-toolbar span {
  color: #5b667a;
  font-size: 13px;
}
.report-toolbar button {
  min-height: 38px;
  padding: 8px 16px;
  border: 0;
  border-radius: 4px;
  color: #fff;
  background: #2f6bff;
  font-weight: 700;
  cursor: pointer;
}
.ai-report-document {
  width: min(1100px, calc(100% - 32px));
  margin: 24px auto 56px;
}
.report-hero,
.report-section {
  margin-bottom: 16px;
  padding: 24px;
  border: 1px solid #dfe5ee;
  border-radius: 4px;
  background: #fff;
  box-shadow: 0 12px 26px rgba(24, 33, 50, 0.08);
}
.report-hero {
  border-top: 5px solid #2f6bff;
}
.eyebrow {
  margin: 0 0 8px;
  color: #2f6bff;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
h1, h2, h3, p { margin-top: 0; }
h1 {
  margin-bottom: 10px;
  font-size: 32px;
  line-height: 1.15;
}
h2 {
  margin-bottom: 16px;
  font-size: 20px;
}
h3 {
  margin-bottom: 10px;
  font-size: 16px;
}
.muted,
.report-note {
  color: #687388;
}
.report-note {
  margin: 12px 0 0;
  padding: 10px 12px;
  border-left: 3px solid #e7a928;
  background: #fff8e6;
}
.metric-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 12px;
}
.metric-card {
  min-width: 0;
  padding: 16px;
  border: 1px solid #dfe5ee;
  border-left: 4px solid #8b96aa;
  border-radius: 4px;
  background: #fbfcfe;
}
.metric-card span {
  display: block;
  margin-bottom: 8px;
  color: #69758a;
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
}
.metric-card strong {
  display: block;
  overflow-wrap: anywhere;
  font-size: 24px;
  line-height: 1.15;
}
.tone-accent { border-left-color: #2f6bff; }
.tone-positive { border-left-color: #0a8f5a; }
.tone-warning { border-left-color: #d28b00; }
.chart-list {
  display: grid;
  gap: 10px;
  margin-bottom: 18px;
}
.chart-row {
  display: grid;
  grid-template-columns: minmax(140px, 1fr) minmax(180px, 2fr) minmax(80px, auto);
  align-items: center;
  gap: 10px;
}
.chart-label,
.chart-value {
  font-size: 13px;
}
.chart-value {
  text-align: right;
  color: #475268;
  font-weight: 700;
}
.chart-track {
  height: 14px;
  border-radius: 4px;
  overflow: hidden;
  background: #e8edf5;
}
.chart-fill {
  display: block;
  width: var(--bar, 0%);
  height: 100%;
  border-radius: 4px;
  background: linear-gradient(90deg, #2f6bff, #0a8f5a);
}
.insight-list,
.action-list {
  display: grid;
  gap: 8px;
  margin: 0;
  padding-left: 20px;
}
.data-table {
  width: 100%;
  margin-bottom: 18px;
  border-collapse: collapse;
  font-size: 13px;
}
.data-table th,
.data-table td {
  padding: 10px 9px;
  border-bottom: 1px solid #e4e9f1;
  text-align: left;
  vertical-align: top;
}
.data-table th {
  color: #4a566b;
  background: #f6f8fb;
  font-size: 11px;
  text-transform: uppercase;
}
.empty-copy {
  color: #69758a;
  font-size: 13px;
}
@media (max-width: 720px) {
  .ai-report-document {
    width: calc(100% - 18px);
    margin-top: 10px;
  }
  .report-toolbar {
    padding: 10px;
  }
  .report-hero,
  .report-section {
    padding: 16px;
  }
  .chart-row {
    grid-template-columns: 1fr;
  }
  .chart-value {
    text-align: left;
  }
}
@media print {
  :root, body { background: #fff; }
  .no-print { display: none !important; }
  .ai-report-document {
    width: 100%;
    margin: 0;
  }
  .report-hero,
  .report-section {
    break-inside: avoid;
    box-shadow: none;
  }
}
"""


def ensure_main(fragment, context):
    if "<main" in fragment.lower():
        return fragment

    labels = context["labels"]
    return (
        "<main class=\"ai-report-document\">"
        "<header class=\"report-hero\">"
        f"<p class=\"eyebrow\">{escape(labels['page_title'])}</p>"
        f"<h1>{escape(context['title'])}</h1>"
        f"<p>{escape(labels['period'])}: {escape(context['period']['label'])}</p>"
        f"<p class=\"muted\">{escape(context['source_note'])}</p>"
        "</header>"
        f"{fragment}"
        "</main>"
    )


def sanitize_report_fragment(value):
    fragment = f"{value or ''}".strip()
    if fragment.startswith("```"):
        fragment = re.sub(r"^```(?:html)?", "", fragment, flags=re.IGNORECASE).strip()
        fragment = re.sub(r"```$", "", fragment).strip()

    body_match = re.search(r"<\s*body\b[^>]*>(.*?)<\s*/\s*body\s*>", fragment, re.IGNORECASE | re.DOTALL)
    if body_match:
        fragment = body_match.group(1).strip()

    fragment = SCRIPT_TAG_RE.sub("", fragment)
    fragment = UNSAFE_TAG_RE.sub("", fragment)
    fragment = EVENT_ATTR_RE.sub("", fragment)
    fragment = JS_URL_ATTR_RE.sub("", fragment)
    fragment = UNSAFE_STYLE_ATTR_RE.sub("", fragment)
    return fragment


def chart_html(chart_row):
    rows = "".join(
        "<div class=\"chart-row\">"
        f"<span class=\"chart-label\">{escape(str(row['label']))}</span>"
        "<span class=\"chart-track\">"
        f"<span class=\"chart-fill\" style=\"--bar: {escape(str(row['percent']))}%;\"></span>"
        "</span>"
        f"<span class=\"chart-value\">{escape(str(row['display']))}</span>"
        "</div>"
        for row in chart_row["rows"]
    )
    return (
        f"<h3>{escape(chart_row['title'])}</h3>"
        f"<div class=\"chart-list\">{rows}</div>"
    )


def table_html(table_row, labels):
    if not table_row["rows"]:
        return (
            f"<h3>{escape(table_row['title'])}</h3>"
            f"<p class=\"empty-copy\">{escape(labels['no_records'])}</p>"
        )

    header_html = "".join(
        f"<th>{escape(column['label'])}</th>"
        for column in table_row["columns"]
    )
    body_html = "".join(
        "<tr>"
        + "".join(
            f"<td>{escape(str(row.get(column['key'], '')))}</td>"
            for column in table_row["columns"]
        )
        + "</tr>"
        for row in table_row["rows"]
    )
    return (
        f"<h3>{escape(table_row['title'])}</h3>"
        "<table class=\"data-table\">"
        f"<thead><tr>{header_html}</tr></thead>"
        f"<tbody>{body_html}</tbody>"
        "</table>"
    )


def get_labels(language):
    return REPORT_TEXT.get(language, REPORT_TEXT["en"])


def apply_interval(queryset, field_name, interval):
    if not interval:
        return queryset
    return queryset.filter(
        **{
            f"{field_name}__gte": interval["start"],
            f"{field_name}__lte": interval["end"],
        }
    )


def period_label(interval, labels):
    if not interval:
        return labels["all_time"]
    start = date_iso(interval["start"])
    end = date_iso(interval["end"])
    return start if start == end else f"{start} to {end}"


def date_iso(value):
    if isinstance(value, date):
        return value.isoformat()
    return f"{value or ''}"


def decimal_value(value):
    if value in (None, ""):
        return Decimal("0")
    return Decimal(str(value))


def queryset_total(queryset, field_name):
    return decimal_value(queryset.aggregate(total=Sum(field_name))["total"])


def money_summary(queryset, amount_field, inactive_statuses=None):
    inactive_statuses = inactive_statuses or set()
    active_queryset = queryset.exclude(status__in=inactive_statuses) if inactive_statuses else queryset
    total = queryset_total(queryset, amount_field)
    active_total = queryset_total(active_queryset, amount_field)
    count = queryset.count()
    active_count = active_queryset.count()
    return {
        "count": count,
        "active_count": active_count,
        "cancelled_count": count - active_count,
        "total": total,
        "active_total": active_total,
    }


def sale_item_cost_total(queryset):
    total = Decimal("0")
    for quantity, unit_cost in queryset.values_list("base_quantity", "unit_cost"):
        total += decimal_value(quantity) * decimal_value(unit_cost)
    return total


def find_stock_report_row(product_id):
    return next(
        (row for row in build_stock_report() if f"{row.get('product_id')}" == f"{product_id}"),
        None,
    )


def metric(label, value, tone="default"):
    return {"label": label, "value": f"{value}", "tone": tone}


def chart(title, rows):
    return {"title": title, "rows": rows}


def table(title, column_keys, rows, labels):
    return {
        "title": title,
        "columns": [{"key": key, "label": labels[key]} for key in column_keys],
        "rows": rows,
    }


def format_decimal(value, places=2):
    decimal = decimal_value(value)
    if decimal == decimal.to_integral_value():
        return f"{int(decimal):,}"
    return f"{decimal:,.{places}f}".rstrip("0").rstrip(".")


def money_display(value):
    return f"THB {decimal_value(value):,.2f}"


def quantity_display(value, unit=""):
    quantity = format_decimal(value, places=3)
    return f"{quantity} {unit}".strip()


def normalize_chart_rows(rows):
    if not rows:
        return []

    max_value = max(decimal_value(row.get("value")) for row in rows) or Decimal("1")
    normalized = []
    for row in rows[:REPORT_CHART_LIMIT]:
        value = decimal_value(row.get("value"))
        percent = min(100, max(3, int((value / max_value) * Decimal("100")))) if value else 0
        normalized.append(
            {
                "label": row.get("label") or "",
                "value": as_number(value),
                "display": row.get("display") or format_decimal(value),
                "percent": percent,
            }
        )
    return normalized


def trend_chart_rows(queryset, date_field, amount_field):
    buckets = defaultdict(Decimal)
    for date_value, amount in queryset.values_list(date_field, amount_field):
        if not date_value:
            continue
        buckets[date_value.strftime("%Y-%m")] += decimal_value(amount)
    rows = [
        {"label": label, "value": amount, "display": money_display(amount)}
        for label, amount in sorted(buckets.items())
    ]
    return normalize_chart_rows(rows[-REPORT_CHART_LIMIT:])


def trend_chart_rows_from_items(queryset, date_field, amount_field):
    buckets = defaultdict(Decimal)
    for date_value, amount in queryset.values_list(date_field, amount_field):
        if not date_value:
            continue
        buckets[date_value.strftime("%Y-%m")] += decimal_value(amount)
    rows = [
        {"label": label, "value": amount, "display": money_display(amount)}
        for label, amount in sorted(buckets.items())
    ]
    return normalize_chart_rows(rows[-REPORT_CHART_LIMIT:])


def item_chart_rows(queryset, fallback_label):
    rows = []
    grouped_rows = (
        queryset.values("product_id", "product_name", "sku", "base_unit")
        .annotate(quantity=Sum("base_quantity"), amount=Sum("amount"))
        .order_by("-amount", "-quantity")[:REPORT_CHART_LIMIT]
    )
    for row in grouped_rows:
        label = row.get("product_name") or row.get("sku") or fallback_label
        if row.get("sku"):
            label = f"{label} ({row['sku']})"
        rows.append(
            {
                "label": label,
                "value": decimal_value(row.get("amount")),
                "display": money_display(row.get("amount")),
            }
        )
    return normalize_chart_rows(rows)


def partner_chart_rows(queryset, partner_field):
    rows = []
    grouped_rows = (
        queryset.values(partner_field)
        .annotate(quantity=Sum("base_quantity"), amount=Sum("amount"))
        .order_by("-amount", "-quantity")[:REPORT_CHART_LIMIT]
    )
    for row in grouped_rows:
        label = row.get(partner_field) or "N/A"
        rows.append(
            {
                "label": label,
                "value": decimal_value(row.get("amount")),
                "display": money_display(row.get("amount")),
            }
        )
    return normalize_chart_rows(rows)


def reference_value(record):
    return record.reference_no or record.id


def purchase_table_row(purchase, labels):
    return {
        "reference": reference_value(purchase),
        "date": date_iso(purchase.transaction_date),
        "status": purchase.status,
        "amount": money_display(purchase.grand_total),
    }


def sale_table_row(sale, labels):
    return {
        "reference": reference_value(sale),
        "date": date_iso(sale.transaction_date),
        "status": sale.status,
        "amount": money_display(sale.grand_total),
    }


def quotation_table_row(quotation, labels):
    return {
        "reference": reference_value(quotation),
        "date": date_iso(quotation.quotation_date),
        "status": labels["not_available"],
        "amount": money_display(quotation.grand_total),
    }


def payment_batch_table_row(batch, labels):
    return {
        "reference": reference_value(batch),
        "date": date_iso(batch.batch_date),
        "status": batch.status,
        "amount": money_display(batch.total_amount),
    }


def billing_note_table_row(note, labels):
    return {
        "reference": reference_value(note),
        "date": date_iso(note.billing_note_date),
        "status": note.status,
        "amount": money_display(note.total_amount),
    }


def credit_note_table_row(note, labels):
    return {
        "reference": reference_value(note),
        "date": date_iso(note.credit_note_date),
        "status": note.status,
        "amount": money_display(note.total_amount),
    }


def purchase_item_table_row(item, labels):
    return {
        "reference": reference_value(item.purchase),
        "date": date_iso(item.purchase.transaction_date),
        "partner": item.purchase.supplier_name,
        "status": item.item_status,
        "quantity": quantity_display(item.base_quantity, item.base_unit),
        "amount": money_display(item.amount),
    }


def sale_item_table_row(item, labels):
    return {
        "reference": reference_value(item.sale),
        "date": date_iso(item.sale.transaction_date),
        "partner": item.sale.customer_name,
        "status": item.item_status,
        "quantity": quantity_display(item.base_quantity, item.base_unit),
        "amount": money_display(item.amount),
    }


def quotation_item_table_row(item, labels):
    quantity = quantity_display(item.base_quantity or item.quantity, item.base_unit or item.unit)
    amount = decimal_value(item.sale_price) * decimal_value(item.quantity)
    partner = item.quotation.customer_name or item.quotation.supplier_name or labels["not_available"]
    return {
        "reference": reference_value(item.quotation),
        "date": date_iso(item.quotation.quotation_date),
        "partner": partner,
        "quantity": quantity,
        "amount": money_display(amount),
    }


def supplier_link_table_row(link, labels):
    supplier_name = link.supplier.company_name if link.supplier_id and link.supplier else labels["not_available"]
    return {
        "partner": supplier_name,
        "unit_cost": money_display(link.default_unit_cost),
        "lead_time": link.lead_time_days if link.lead_time_days is not None else labels["not_available"],
        "quantity": quantity_display(link.min_order_qty, link.default_purchase_unit),
    }
