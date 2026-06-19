import math
import re
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.db.models import Prefetch, Q, Sum
from django.utils.dateparse import parse_date
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import (
    BillingNote,
    CreditNote,
    Customer,
    PaymentBatch,
    PaymentBatchLine,
    Product,
    ProductSupplier,
    Purchase,
    PurchaseItem,
    Quotation,
    Sale,
    SaleItemAllocation,
    SaleItem,
    Supplier,
)


SALE_STOCK_DEDUCTED_STATUSES = {"packed", "shipped", "delivered"}
SALE_INACTIVE_TRANSACTION_STATUSES = {"cancelled", "returned"}
SALE_FULL_TRANSACTION_STATUSES = {
    "draft",
    "packed",
    "shipped",
    "delivered",
    "cancelled",
    "returned",
}
SALE_PARTIAL_TRANSACTION_STATUSES = {
    "partially_packed",
    "partially_shipped",
    "partially_delivered",
}
SALE_INACTIVE_ITEM_STATUSES = {"cancelled", "returned"}
SALE_ITEM_STATUSES = {
    "pending",
    "packed",
    "shipped",
    "delivered",
    "cancelled",
    "returned",
}
PURCHASE_ITEM_STATUSES = {"pending", "received", "cancelled"}
PURCHASE_FULL_TRANSACTION_STATUSES = {"draft", "ordered", "received", "cancelled"}
SAFETY_STOCK_DAYS = 7
RECENT_AVERAGE_COST_HISTORY_LIMIT = 3
RECENT_AVERAGE_SALE_PRICE_HISTORY_LIMIT = 3
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


def get_purchase_item_base_unit_cost(item):
    base_quantity = item.base_quantity or Decimal("0")
    if base_quantity > 0:
        return (item.amount or Decimal("0")) / base_quantity

    conversion_factor = item.conversion_factor or Decimal("1")
    if conversion_factor > 0:
        return (item.unit_cost or Decimal("0")) / conversion_factor

    return Decimal("0")


def sync_product_supplier_links_for_purchase(purchase):
    if not purchase.supplier_id:
        return

    items = purchase.items.select_related("product").filter(product_id__isnull=False)
    for item in items:
        if item.item_status == PurchaseItem.ITEM_CANCELLED:
            continue

        defaults = {
            "supplier_sku": item.sku or "",
            "default_purchase_unit": item.unit or item.product.default_purchase_unit,
            "default_unit_cost": item.unit_cost or Decimal("0"),
            "lead_time_days": item.lead_time_days,
            "min_order_qty": item.quantity or Decimal("0"),
            "is_active": True,
        }
        ProductSupplier.objects.update_or_create(
            product=item.product,
            supplier=purchase.supplier,
            defaults=defaults,
        )


def get_sale_item_allocated_cost(item):
    allocations = getattr(item, "prefetched_allocations", None)
    if allocations is None:
        allocations = item.allocations.all()

    total = sum(
        (allocation.total_cost or Decimal("0"))
        for allocation in allocations
    )
    if total > 0:
        return total

    quantity = item.quantity or Decimal("0")
    return (item.unit_cost or Decimal("0")) * quantity


def get_active_allocation_status_filter():
    return {
        "sale_item__item_status__in": SALE_STOCK_DEDUCTED_STATUSES,
        "sale_item__sale__status__in": [
            Sale.STATUS_PACKED,
            Sale.STATUS_PARTIALLY_PACKED,
            Sale.STATUS_SHIPPED,
            Sale.STATUS_PARTIALLY_SHIPPED,
            Sale.STATUS_DELIVERED,
            Sale.STATUS_PARTIALLY_DELIVERED,
        ],
    }


def get_purchase_item_allocated_quantity(purchase_item_id, exclude_sale_item_id=None):
    allocations = SaleItemAllocation.objects.filter(
        purchase_item_id=purchase_item_id,
        **get_active_allocation_status_filter(),
    )
    if exclude_sale_item_id:
        allocations = allocations.exclude(sale_item_id=exclude_sale_item_id)

    return allocations.aggregate(total=Sum("base_quantity"))["total"] or Decimal("0")


def get_purchase_item_remaining_quantity(purchase_item, exclude_sale_item_id=None):
    if purchase_item.item_status != PurchaseItem.ITEM_RECEIVED:
        return Decimal("0")

    received_quantity = purchase_item.base_quantity or Decimal("0")
    allocated_quantity = get_purchase_item_allocated_quantity(
        purchase_item.id,
        exclude_sale_item_id=exclude_sale_item_id,
    )
    return max(Decimal("0"), received_quantity - allocated_quantity)


def get_available_stock_layers(product_id, exclude_sale_item_id=None):
    layers = []
    if not product_id:
        return layers

    purchase_items = (
        PurchaseItem.objects.select_related("purchase", "purchase__supplier", "product")
        .filter(
            product_id=product_id,
            item_status=PurchaseItem.ITEM_RECEIVED,
            base_quantity__gt=0,
        )
        .order_by("received_date", "purchase__transaction_date", "purchase__created_at", "id")
    )

    for item in purchase_items:
        available_quantity = get_purchase_item_remaining_quantity(
            item,
            exclude_sale_item_id=exclude_sale_item_id,
        )
        if available_quantity <= 0:
            continue

        layers.append(
            {
                "purchase_item": item,
                "purchase_item_id": item.id,
                "purchase_id": item.purchase_id,
                "purchase_reference_no": item.purchase.reference_no or "",
                "supplier_id": item.purchase.supplier_id,
                "supplier_name": item.purchase.supplier_name or "",
                "product_id": item.product_id,
                "product_name": item.product_name,
                "sku": item.sku,
                "received_date": item.received_date,
                "transaction_date": item.purchase.transaction_date,
                "available_quantity": available_quantity,
                "base_unit": item.base_unit,
                "unit": item.unit,
                "base_unit_cost": get_purchase_item_base_unit_cost(item),
            }
        )

    return layers


def serialize_stock_layer(layer):
    return {
        "purchase_item_id": layer["purchase_item_id"],
        "purchase_id": layer["purchase_id"],
        "purchase_reference_no": layer["purchase_reference_no"],
        "supplier_id": layer["supplier_id"],
        "supplier_name": layer["supplier_name"],
        "product_id": layer["product_id"],
        "product_name": layer["product_name"],
        "sku": layer["sku"],
        "received_date": layer["received_date"].isoformat() if layer["received_date"] else None,
        "transaction_date": (
            layer["transaction_date"].isoformat() if layer["transaction_date"] else None
        ),
        "available_quantity": as_number(layer["available_quantity"]),
        "base_unit": layer["base_unit"],
        "unit": layer["unit"],
        "base_unit_cost": as_number(layer["base_unit_cost"]),
    }


def get_sale_item_requested_allocations(sale_item):
    return getattr(sale_item, "_allocation_requests", None)


def set_sale_item_cost_snapshot_from_allocations(sale_item):
    allocations = list(sale_item.allocations.select_related("supplier"))
    if not allocations:
        return

    total_base_quantity = sum(
        (allocation.base_quantity or Decimal("0"))
        for allocation in allocations
    )
    total_cost = sum(
        (allocation.total_cost or Decimal("0"))
        for allocation in allocations
    )
    if total_base_quantity <= 0:
        return

    quantity = sale_item.quantity or Decimal("0")
    unit_cost = (
        total_cost / quantity
        if quantity > 0
        else total_cost / total_base_quantity
    )
    unit_cost = unit_cost.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    update_fields = ["unit_cost"]
    sale_item.unit_cost = unit_cost

    supplier_names = {
        allocation.supplier_name
        for allocation in allocations
        if allocation.supplier_name
    }
    if len(supplier_names) == 1:
        allocation = allocations[0]
        sale_item.supplier = allocation.supplier
        sale_item.supplier_name = allocation.supplier_name
        update_fields.extend(["supplier", "supplier_name"])

    sale_item.save(update_fields=update_fields)


def create_sale_item_allocation(sale_item, purchase_item, base_quantity):
    base_quantity = Decimal(str(base_quantity or 0))
    if base_quantity <= 0:
        return None

    base_unit_cost = get_purchase_item_base_unit_cost(purchase_item)
    total_cost = (base_quantity * base_unit_cost).quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP,
    )
    quantity = base_quantity / (sale_item.conversion_factor or Decimal("1"))

    return SaleItemAllocation.objects.create(
        sale_item=sale_item,
        purchase_item=purchase_item,
        supplier=purchase_item.purchase.supplier,
        supplier_name=purchase_item.purchase.supplier_name or "",
        product=sale_item.product,
        product_name=sale_item.product_name,
        sku=sale_item.sku,
        quantity=quantity,
        base_quantity=base_quantity,
        base_unit_cost=base_unit_cost,
        total_cost=total_cost,
    )


def allocate_sale_item_from_requests(sale_item, allocation_requests):
    requested_total = Decimal("0")

    for allocation in allocation_requests or []:
        purchase_item_id = str(
            allocation.get("purchase_item_id") or allocation.get("purchaseItemId") or ""
        ).strip()
        if not purchase_item_id:
            raise ValidationError("Allocation requires a purchase item.")

        base_quantity = Decimal(str(allocation.get("base_quantity") or allocation.get("quantity") or 0))
        if base_quantity <= 0:
            raise ValidationError("Allocation quantity must be greater than zero.")

        try:
            purchase_item = (
                PurchaseItem.objects.select_for_update()
                .select_related("purchase", "purchase__supplier", "product")
                .get(pk=purchase_item_id)
            )
        except PurchaseItem.DoesNotExist:
            raise ValidationError("Selected stock source no longer exists.")

        if purchase_item.product_id != sale_item.product_id:
            raise ValidationError("Selected stock source does not match the sale product.")
        if purchase_item.item_status != PurchaseItem.ITEM_RECEIVED:
            raise ValidationError("Selected stock source has not been received.")

        available_quantity = get_purchase_item_remaining_quantity(
            purchase_item,
            exclude_sale_item_id=sale_item.id,
        )
        if base_quantity > available_quantity:
            raise ValidationError(
                f"Insufficient stock in {purchase_item.purchase.reference_no or purchase_item.id}."
            )

        create_sale_item_allocation(sale_item, purchase_item, base_quantity)
        requested_total += base_quantity

    required_quantity = sale_item.base_quantity or Decimal("0")
    if requested_total != required_quantity:
        raise ValidationError("Sale item allocations must match the sale item quantity.")


def allocate_sale_item_fifo(sale_item):
    remaining_quantity = sale_item.base_quantity or Decimal("0")
    if remaining_quantity <= 0:
        return

    layers = get_available_stock_layers(
        sale_item.product_id,
        exclude_sale_item_id=sale_item.id,
    )
    for layer in layers:
        if remaining_quantity <= 0:
            break

        purchase_item = (
            PurchaseItem.objects.select_for_update()
            .select_related("purchase", "purchase__supplier", "product")
            .get(pk=layer["purchase_item_id"])
        )
        available_quantity = get_purchase_item_remaining_quantity(
            purchase_item,
            exclude_sale_item_id=sale_item.id,
        )
        quantity = min(remaining_quantity, available_quantity)
        create_sale_item_allocation(sale_item, purchase_item, quantity)
        remaining_quantity -= quantity

    if remaining_quantity > 0:
        raise ValidationError(f"Insufficient stock for {sale_item.product_name}.")


def sync_sale_item_allocations(sale_item):
    if sale_item.item_status not in SALE_STOCK_DEDUCTED_STATUSES:
        sale_item.allocations.all().delete()
        return

    allocation_requests = get_sale_item_requested_allocations(sale_item)
    has_existing_allocations = sale_item.allocations.exists()
    if allocation_requests is None and has_existing_allocations:
        return

    sale_item.allocations.all().delete()
    if allocation_requests:
        allocate_sale_item_from_requests(sale_item, allocation_requests)
    else:
        allocate_sale_item_fifo(sale_item)

    set_sale_item_cost_snapshot_from_allocations(sale_item)


def sync_sale_allocations(sale, sale_items=None):
    sale_items = sale_items or list(sale.items.select_related("product").all())
    with transaction.atomic():
        Sale.objects.select_for_update().filter(pk=sale.pk).exists()
        for sale_item in sale_items:
            sync_sale_item_allocations(sale_item)


def get_sale_item_base_unit_price(item):
    conversion_factor = item.conversion_factor or Decimal("0")
    if conversion_factor > 0:
        return (item.unit_price or Decimal("0")) / conversion_factor

    quantity = item.quantity or Decimal("0")
    base_quantity = item.base_quantity or Decimal("0")
    if quantity > 0 and base_quantity > 0:
        return ((item.unit_price or Decimal("0")) * quantity) / base_quantity

    return item.unit_price or Decimal("0")


def get_product_metric_snapshots(product_ids=None, exclude_sale_id=None):
    product_ids = {product_id for product_id in product_ids or [] if product_id}
    received = {}
    received_purchase_count = {}
    recent_received_items = {}
    committed = {}
    active_sales_count = {}
    recent_sale_items = {}

    purchase_items = PurchaseItem.objects.select_related("product", "purchase").filter(
        item_status=PurchaseItem.ITEM_RECEIVED,
        product_id__isnull=False,
    )
    if product_ids:
        purchase_items = purchase_items.filter(product_id__in=product_ids)

    for item in purchase_items:
        quantity = item.base_quantity or Decimal("0")
        received[item.product_id] = received.get(item.product_id, Decimal("0")) + quantity
        received_purchase_count[item.product_id] = (
            received_purchase_count.get(item.product_id, 0) + 1
        )
        recent_received_items.setdefault(item.product_id, []).append(item)

    sale_items = SaleItem.objects.select_related("product").filter(
        product_id__isnull=False,
    )
    if product_ids:
        sale_items = sale_items.filter(product_id__in=product_ids)
    if exclude_sale_id:
        sale_items = sale_items.exclude(sale_id=exclude_sale_id)

    for item in sale_items:
        if item.item_status not in SALE_INACTIVE_ITEM_STATUSES:
            recent_sale_items.setdefault(item.product_id, []).append(item)

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
        recent_items = sorted(
            recent_received_items.get(product.id, []),
            key=lambda item: (
                item.received_date or item.purchase.transaction_date or date.min,
                item.purchase.transaction_date or date.min,
                item.purchase.created_at,
                item.id,
            ),
            reverse=True,
        )[:RECENT_AVERAGE_COST_HISTORY_LIMIT]
        recent_base_unit_costs = [
            get_purchase_item_base_unit_cost(item)
            for item in recent_items
        ]
        average_unit_cost = (
            sum(recent_base_unit_costs, Decimal("0")) / Decimal(len(recent_base_unit_costs))
            if recent_base_unit_costs
            else Decimal("0")
        )
        sorted_recent_sale_items = sorted(
            recent_sale_items.get(product.id, []),
            key=lambda item: (
                item.sale.transaction_date or date.min,
                item.sale.created_at,
                item.id,
            ),
            reverse=True,
        )
        latest_sale_transaction_prices = []
        sale_prices_by_sale_id = {}
        for item in sorted_recent_sale_items:
            if item.sale_id not in sale_prices_by_sale_id:
                sale_prices_by_sale_id[item.sale_id] = []
                latest_sale_transaction_prices.append(sale_prices_by_sale_id[item.sale_id])

            sale_prices_by_sale_id[item.sale_id].append(get_sale_item_base_unit_price(item))

        recent_average_sale_price_history = [
            sum(transaction_prices, Decimal("0")) / Decimal(len(transaction_prices))
            for transaction_prices in latest_sale_transaction_prices[
                :RECENT_AVERAGE_SALE_PRICE_HISTORY_LIMIT
            ]
            if transaction_prices
        ]
        average_recent_sale_price = (
            sum(recent_average_sale_price_history, Decimal("0"))
            / Decimal(len(recent_average_sale_price_history))
            if recent_average_sale_price_history
            else Decimal("0")
        )
        metrics[product.id] = {
            "current_stock": max(
                Decimal("0"),
                received_units - committed.get(product.id, Decimal("0")),
            ),
            "average_unit_cost": average_unit_cost,
            "average_recent_sale_price": average_recent_sale_price,
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

    if sale_status == Sale.STATUS_CANCELLED:
        return SaleItem.ITEM_CANCELLED
    if sale_status == Sale.STATUS_RETURNED:
        return SaleItem.ITEM_RETURNED

    return SaleItem.ITEM_PENDING


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


def to_decimal(value):
    """Coerce a model/decimal/number value into Decimal for money math.

    Unlike ``as_number`` (which returns int/float for display), this keeps
    financial values as Decimal so totals stay exact.
    """
    if value in (None, ""):
        return Decimal("0")
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def compute_purchase_payable_total(purchase):
    """Return the amount still owed for a purchase: grand_total minus the value
    of cancelled line items.

    Cancelled items keep their stored ``amount`` so the original document total
    (``grand_total``) stays intact for audit. The payable amount is derived by
    scaling ``grand_total`` by the non-cancelled share of the line totals, which
    preserves the purchase's VAT and bill-discount math without re-deriving it.
    """
    items = list(purchase.items.all())
    full_base = sum((to_decimal(item.amount) for item in items), Decimal("0"))
    payable_base = sum(
        (
            to_decimal(item.amount)
            for item in items
            if item.item_status != PurchaseItem.ITEM_CANCELLED
        ),
        Decimal("0"),
    )

    grand_total = to_decimal(purchase.grand_total)

    if not items:
        return grand_total
    if full_base <= 0:
        return Decimal("0") if payable_base <= 0 else grand_total

    payable = grand_total * (payable_base / full_base)
    return payable.quantize(Decimal("0.01"))


def recalculate_purchase_payable(purchase, save=True):
    """Recompute and store ``purchase.payable_total`` from its current items."""
    payable_total = compute_purchase_payable_total(purchase)
    if to_decimal(purchase.payable_total) != payable_total:
        purchase.payable_total = payable_total
        if save:
            purchase.save(update_fields=["payable_total", "updated_at"])
    return payable_total


def recalculate_payment_batch_total(payment_batch):
    total = sum(
        (to_decimal(line.amount) for line in payment_batch.lines.all()),
        Decimal("0"),
    )
    if to_decimal(payment_batch.total_amount) != total:
        payment_batch.total_amount = total
        payment_batch.save(update_fields=["total_amount", "updated_at"])
    return total


def sync_supplier_payment_lines_for_purchase(purchase):
    """Keep supplier payment batches aligned with a purchase's payable amount.

    Lines that are not yet paid are re-synced to the current payable total so the
    business always sees the correct amount to pay. Lines already marked paid are
    left frozen as a financial record; any difference from the current payable is
    surfaced in the UI for reconciliation rather than rewritten here.
    """
    payable_total = to_decimal(purchase.payable_total)

    affected_batch_ids = set()
    lines = (
        PaymentBatchLine.objects.select_related("payment_batch")
        .filter(purchase=purchase, paid=False)
        .exclude(payment_batch__status=PaymentBatch.STATUS_CANCELLED)
    )
    for line in lines:
        if to_decimal(line.amount) != payable_total:
            line.amount = payable_total
            line.save(update_fields=["amount"])
        affected_batch_ids.add(line.payment_batch_id)

    for batch in PaymentBatch.objects.filter(id__in=affected_batch_ids):
        recalculate_payment_batch_total(batch)


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
    if status == Sale.STATUS_RETURNED:
        return SaleItem.ITEM_RETURNED
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
        status for status in item_statuses if status not in SALE_INACTIVE_ITEM_STATUSES
    ]

    if all(status in SALE_INACTIVE_ITEM_STATUSES for status in item_statuses):
        if any(status == SaleItem.ITEM_RETURNED for status in item_statuses):
            return Sale.STATUS_RETURNED
        return Sale.STATUS_CANCELLED

    if not active_statuses:
        if any(status == SaleItem.ITEM_RETURNED for status in item_statuses):
            return Sale.STATUS_RETURNED
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


def build_purchase_pack(product):
    # The product's default buying unit and how many base units it holds (a "box"
    # of 12, a "ream" of 500, …). Lets the Quick-PO drawer round an order up to
    # whole packs and show the pack equivalent. factor == 1 means it's bought in
    # the base unit, so no rounding applies.
    base_unit = product.stock_base_unit
    purchase_unit = product.default_purchase_unit or base_unit
    factor = Decimal("1")
    if purchase_unit and purchase_unit != base_unit:
        for conversion in product.unit_conversions.all():
            if (
                conversion.unit == purchase_unit
                and conversion.allow_purchase
                and conversion.factor_to_base
            ):
                factor = conversion.factor_to_base
                break
    return {"unit": purchase_unit, "factor": as_number(factor)}


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
        "purchase_pack": build_purchase_pack(product),
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
        # Distinct sale orders this product has appeared in (deducted statuses),
        # used by the dashboard to classify how a product cycles through stock:
        # one-off custom sourcing vs. reliable long-cycle vs. fast high-cycle.
        "sales_order_ids": set(),
        "pending_purchase_units": Decimal("0"),
        "delayed_purchase_units": Decimal("0"),
        "lead_time_sample_days": Decimal("0"),
        "lead_time_sample_count": 0,
        # supplier_name -> {"last_date", "last_cost", "best_cost", "order_count"}
        # Records the cost (per base unit) each supplier charged for this product
        # so the inventory page can recommend the cheapest source to reorder from.
        "supplier_costs": {},
    }


def record_supplier_cost(row, supplier_name, base_unit_cost, transaction_date):
    name = (supplier_name or "").strip()
    if not name or base_unit_cost is None or base_unit_cost <= 0:
        return

    entry = row["supplier_costs"].get(name)
    if entry is None:
        row["supplier_costs"][name] = {
            "last_date": transaction_date,
            "last_cost": base_unit_cost,
            "best_cost": base_unit_cost,
            "order_count": 1,
        }
        return

    entry["order_count"] += 1
    entry["best_cost"] = min(entry["best_cost"], base_unit_cost)
    # Keep the most recent cost as the supplier's quoted price.
    if transaction_date and (
        entry["last_date"] is None or transaction_date >= entry["last_date"]
    ):
        entry["last_date"] = transaction_date
        entry["last_cost"] = base_unit_cost


def build_supplier_options(supplier_costs):
    options = [
        {
            "supplier_name": name,
            "last_cost": as_number(entry["last_cost"]),
            "best_cost": as_number(entry["best_cost"]),
            "order_count": entry["order_count"],
            # When this supplier last sold us the product, so the Quick-PO drawer
            # can show "last bought dd/mm/yy" beside each supplier's price.
            "last_date": entry["last_date"].isoformat() if entry.get("last_date") else None,
        }
        for name, entry in supplier_costs.items()
    ]
    # Cheapest most-recent price first so the first option is the best source.
    options.sort(key=lambda option: (option["last_cost"], -option["order_count"]))
    return options


def build_stock_report():
    today = timezone.localdate()
    product_rows = {
        product.id: create_empty_stock_row(product)
        for product in Product.objects.select_related("category")
        .prefetch_related("unit_conversions")
        .all()
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

            if quantity > 0:
                base_unit_cost = (item.amount or Decimal("0")) / quantity
                record_supplier_cost(
                    row,
                    item.purchase.supplier_name,
                    base_unit_cost,
                    item.purchase.transaction_date,
                )

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
        if not row or item.sale.status in SALE_INACTIVE_TRANSACTION_STATUSES:
            continue

        quantity = item.base_quantity or Decimal("0")
        if item.item_status in SALE_STOCK_DEDUCTED_STATUSES:
            row["allocated_sales_units"] += quantity
            row["committed_sales_value"] += item.amount or Decimal("0")
            row["sales_history_units"] += quantity
            row["sales_order_ids"].add(item.sale_id)
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
        cycle_count = len(row["sales_order_ids"])
        sale_dates = [d for d in row["sales_history_dates"] if d]
        first_sale_date = min(sale_dates) if sale_dates else None
        last_sale_date = max(sale_dates) if sale_dates else None
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
        supplier_options = build_supplier_options(row["supplier_costs"])
        best_supplier = supplier_options[0] if supplier_options else None

        rows.append(
            {
                "product_id": row["product_id"],
                "product_name": row["product_name"],
                "sku": row["sku"],
                "category": row["category"],
                "unit": row["unit"],
                "purchase_pack": row["purchase_pack"],
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
                "cycle_count": cycle_count,
                "first_sale_date": first_sale_date.isoformat() if first_sale_date else None,
                "last_sale_date": last_sale_date.isoformat() if last_sale_date else None,
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
                "supplier_options": supplier_options,
                "best_supplier_name": best_supplier["supplier_name"] if best_supplier else "",
                "best_supplier_cost": best_supplier["last_cost"] if best_supplier else None,
                "supplier_count": len(supplier_options),
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
                "product_name": line.product_name,
                "sku": line.sku,
                "quantity": as_number(line.quantity),
                "unit_price": as_number(line.unit_price),
                "amount": as_number(line.amount),
            }
            for line in note.lines.all()
        ],
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


def chat_record(label, meta="", value=""):
    return {"label": label, "meta": meta, "value": "" if value is None else str(value)}


def chat_section(title, items=None, records=None):
    return {
        "title": title,
        "items": items or [],
        "records": records or [],
    }


def combine_chat_meta(*parts):
    values = [str(part) for part in parts if part not in (None, "", [])]
    return " | ".join(values)


def build_top_product_records(rows, item_key="items", limit=CHAT_RECORD_LIMIT):
    product_totals = {}
    for row in rows:
        for item in row.get(item_key, []):
            key = item.get("sku") or item.get("product_name") or "Unknown"
            bucket = product_totals.setdefault(
                key,
                {
                    "product_name": item.get("product_name") or key,
                    "sku": item.get("sku") or "",
                    "quantity": Decimal("0"),
                    "amount": Decimal("0"),
                    "unit": item.get("base_unit") or item.get("unit") or "",
                },
            )
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
        )
        for row in ranked_rows
    ]


def build_purchase_records(rows, limit=CHAT_RECORD_LIMIT):
    return [
        chat_record(
            row["reference_no"] or row["id"],
            meta=combine_chat_meta(row["transaction_date"], row["supplier_name"], row["status"]),
            value=row["grand_total"],
        )
        for row in rows[:limit]
    ]


def build_sale_records(rows, limit=CHAT_RECORD_LIMIT):
    return [
        chat_record(
            row["reference_no"] or row["id"],
            meta=combine_chat_meta(row["transaction_date"], row["customer_name"], row["status"]),
            value=row["grand_total"],
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
        )
        for row in rows[:limit]
    ]


def build_billing_note_records(rows, limit=CHAT_RECORD_LIMIT):
    return [
        chat_record(
            row["reference_no"] or row["id"],
            meta=combine_chat_meta(row["billing_note_date"], row["customer_name"], row["status"]),
            value=row["total_amount"],
        )
        for row in rows[:limit]
    ]


def build_payment_batch_records(rows, limit=CHAT_RECORD_LIMIT):
    return [
        chat_record(
            row["reference_no"] or row["id"],
            meta=combine_chat_meta(row["batch_date"], row["supplier_name"], row["status"]),
            value=row["total_amount"],
        )
        for row in rows[:limit]
    ]


def build_credit_note_records(rows, limit=CHAT_RECORD_LIMIT):
    return [
        chat_record(
            row["reference_no"] or row["id"],
            meta=combine_chat_meta(row["credit_note_date"], row["customer_name"], row["status"]),
            value=row["total_amount"],
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
        )
        for row in rows[:limit]
    ]


def build_exception_transaction_records(rows, date_key, party_key, amount_key, due_label, limit=CHAT_RECORD_LIMIT):
    return [
        chat_record(
            row["reference_no"] or row["id"],
            meta=combine_chat_meta(row.get(date_key), row.get(party_key), row.get("status"), due_label),
            value=row.get(amount_key),
        )
        for row in rows[:limit]
    ]


def build_detail_records(items, record_type="item", limit=CHAT_RECORD_LIMIT):
    records = []
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
                )
            )
        elif record_type == "billing":
            records.append(
                chat_record(
                    item.get("sale_reference_no") or "Sale line",
                    meta=combine_chat_meta(item.get("sale_status"), f"received {item.get('received')}"),
                    value=item.get("amount"),
                )
            )
        elif record_type == "payment":
            records.append(
                chat_record(
                    item.get("purchase_reference_no") or "Purchase line",
                    meta=combine_chat_meta(item.get("purchase_status"), f"paid {item.get('paid')}"),
                    value=item.get("amount"),
                )
            )
        else:
            records.append(
                chat_record(
                    f"{item.get('product_name')} ({item.get('sku')})" if item.get("sku") else item.get("product_name"),
                    meta=combine_chat_meta(f"qty {item.get('quantity')} {item.get('unit')}"),
                    value=item.get("amount"),
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
                "Products",
                records=[
                    chat_record(
                        f"{row['product_name']} ({row['sku']})",
                        meta=combine_chat_meta(
                            f"available {row['available_stock']} {row['unit']}",
                            f"reorder {row['reorder_level']}",
                        ),
                        value=row["recommended_restock"],
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
                "Overdue billing notes",
                records=build_exception_transaction_records(
                    overdue_billing_rows,
                    "expected_payment_date",
                    "customer_name",
                    "total_amount",
                    "overdue AR",
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
                ),
            ),
            chat_section(
                "Delayed purchase lines",
                records=[
                    chat_record(
                        item.purchase.reference_no or item.purchase_id,
                        meta=combine_chat_meta(item.product_name, item.expected_delivery_date, item.purchase.supplier_name),
                        value=as_number(item.base_quantity),
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
                    )
                    for item in backordered_sale_items[:CHAT_RECORD_LIMIT]
                ],
            ),
        ],
    }


def build_reference_line_item_presentation(context, reference_prefix):
    record_map = {
        "PO": ("Purchase line items", matched_rows(context, "purchases"), "items", "purchase"),
        "TI": ("Sales line items", matched_rows(context, "sales"), "items", "sale"),
        "QT": ("Quotation line items", matched_rows(context, "quotations"), "items", "item"),
        "CN": ("Credit note lines", matched_rows(context, "credit_notes"), "lines", "credit"),
        "BN": ("Billing note lines", matched_rows(context, "billing_notes"), "lines", "billing"),
        "PMT": ("Payment batch lines", matched_rows(context, "payment_batches"), "lines", "payment"),
    }
    title, rows, key, record_type = record_map.get(reference_prefix, ("Line items", [], "items", "item"))
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
                "Line details",
                records=build_detail_records(items, record_type=record_type),
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
    context = build_ai_inventory_context(question, request)
    presentation = build_chat_presentation(question, context)
    local_answer = build_local_chat_answer(question, context, presentation)
    # Chat answers are used for operational decisions, so the API returns only
    # the deterministic summary built from current database records.
    return {
        "answer": local_answer,
        "used_model": "local-summary",
        "presentation": presentation,
    }
