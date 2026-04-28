import json
from decimal import Decimal

from django.conf import settings
from django.db.models import Prefetch
from django.utils import timezone

from .models import Product, Purchase, PurchaseItem, Sale, SaleItem


SALE_STOCK_DEDUCTED_STATUSES = {"packed", "shipped", "delivered"}


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


def get_available_stock_by_product_id():
    received = {}
    committed = {}

    purchase_items = PurchaseItem.objects.select_related("product").filter(
        item_status=PurchaseItem.ITEM_RECEIVED,
        product_id__isnull=False,
    )
    for item in purchase_items:
        received[item.product_id] = received.get(item.product_id, Decimal("0")) + item.base_quantity

    sale_items = SaleItem.objects.select_related("product").filter(
        item_status__in=SALE_STOCK_DEDUCTED_STATUSES,
        product_id__isnull=False,
    )
    for item in sale_items:
        committed[item.product_id] = committed.get(item.product_id, Decimal("0")) + item.base_quantity

    stock = {}
    for product in Product.objects.all():
        stock[product.id] = max(
            Decimal("0"),
            received.get(product.id, Decimal("0")) - committed.get(product.id, Decimal("0")),
        )

    return stock


def apply_purchase_status_to_items(purchase):
    today = timezone.localdate()

    if purchase.status == Purchase.STATUS_RECEIVED:
        purchase.items.update(item_status=PurchaseItem.ITEM_RECEIVED, received_date=today)
    elif purchase.status == Purchase.STATUS_CANCELLED:
        purchase.items.update(item_status=PurchaseItem.ITEM_CANCELLED, received_date=None)
    elif purchase.status in {Purchase.STATUS_DRAFT, Purchase.STATUS_ORDERED}:
        purchase.items.update(item_status=PurchaseItem.ITEM_PENDING, received_date=None)


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


def apply_sale_status_to_items(sale):
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


def build_stock_report():
    stock_by_product_id = get_available_stock_by_product_id()
    rows = []

    for product in Product.objects.select_related("category").all():
        current_stock = stock_by_product_id.get(product.id, Decimal("0"))
        rows.append(
            {
                "product_id": product.id,
                "product_name": product.product_name,
                "sku": product.sku,
                "category": product.category_name or (product.category.name if product.category else ""),
                "unit": product.stock_base_unit,
                "current_stock": as_number(current_stock),
                "available_stock": as_number(current_stock),
                "reorder_level": as_number(product.reorder_level),
                "predicted_7_day_demand": 0,
                "days_until_stockout": None,
                "recommended_restock": as_number(max(Decimal("0"), product.reorder_level - current_stock)),
                "stock_value": 0,
            }
        )

    return rows


def serialize_light_purchase(purchase, request=None):
    from .serializers import PurchaseSerializer

    return PurchaseSerializer(purchase, context={"request": request}).data


def serialize_light_sale(sale, request=None):
    from .serializers import SaleSerializer

    return SaleSerializer(sale, context={"request": request}).data


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

    purchases = Purchase.objects.prefetch_related(
        Prefetch("items", queryset=PurchaseItem.objects.select_related("product"))
    )
    sales = Sale.objects.prefetch_related(
        Prefetch("items", queryset=SaleItem.objects.select_related("product"))
    )

    purchase_total = sum((purchase.grand_total for purchase in purchases), Decimal("0"))
    sales_total = sum((sale.grand_total for sale in sales), Decimal("0"))

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
            for purchase in purchases.order_by("-transaction_date", "-created_at")[:5]
        ],
        "recent_sales": [
            serialize_light_sale(sale, request)
            for sale in sales.order_by("-transaction_date", "-created_at")[:5]
        ],
    }


def build_local_chat_answer(question):
    stock_report = build_stock_report()
    low_stock = [
        row for row in stock_report if Decimal(str(row["available_stock"])) <= Decimal(str(row["reorder_level"]))
    ]
    question_text = question.lower()

    if "low" in question_text or "restock" in question_text or "stock" in question_text:
        if not low_stock:
            return "No low-stock products were found from the current inventory data."

        lines = [
            f"{row['product_name']} has {row['available_stock']} {row['unit']} available."
            for row in low_stock[:5]
        ]
        return "Products needing attention: " + " ".join(lines)

    if "sale" in question_text:
        recent_sales = Sale.objects.order_by("-transaction_date", "-created_at")[:5]
        if not recent_sales:
            return "No sales transactions are stored yet."

        lines = [
            f"{sale.reference_no or sale.id}: {sale.customer_name}, {sale.status}, total {as_number(sale.grand_total)}."
            for sale in recent_sales
        ]
        return "Latest sales: " + " ".join(lines)

    if "purchase" in question_text:
        recent_purchases = Purchase.objects.order_by("-transaction_date", "-created_at")[:5]
        if not recent_purchases:
            return "No purchase transactions are stored yet."

        lines = [
            f"{purchase.reference_no or purchase.id}: {purchase.supplier_name}, {purchase.status}, total {as_number(purchase.grand_total)}."
            for purchase in recent_purchases
        ]
        return "Latest purchases: " + " ".join(lines)

    return (
        "I can summarize low stock, restock needs, recent sales, and recent purchases. "
        "Try asking which products need restocking."
    )


def answer_inventory_question(question, request=None):
    if not settings.OPENAI_API_KEY:
        return {
            "answer": build_local_chat_answer(question),
            "used_model": "local-summary",
        }

    from openai import OpenAI

    context = build_dashboard_summary(request)
    context["products"] = [
        {
            "id": product.id,
            "sku": product.sku,
            "product_name": product.product_name,
            "category": product.category_name,
            "stock_base_unit": product.stock_base_unit,
        }
        for product in Product.objects.all()[:50]
    ]

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
