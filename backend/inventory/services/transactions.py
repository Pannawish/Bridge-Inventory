"""Purchase, sale, and payment transaction services."""

from decimal import Decimal

from django.utils import timezone

from ..models import PaymentBatch, PaymentBatchLine, Purchase, PurchaseItem, Sale, SaleItem


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
    """Return the amount still owed for a purchase.

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


__all__ = [
    "PURCHASE_FULL_TRANSACTION_STATUSES",
    "PURCHASE_ITEM_STATUSES",
    "SALE_FULL_TRANSACTION_STATUSES",
    "SALE_INACTIVE_ITEM_STATUSES",
    "SALE_INACTIVE_TRANSACTION_STATUSES",
    "SALE_ITEM_STATUSES",
    "SALE_PARTIAL_TRANSACTION_STATUSES",
    "SALE_STOCK_DEDUCTED_STATUSES",
    "apply_purchase_item_status_dates",
    "apply_purchase_status_to_items",
    "apply_sale_item_status_dates",
    "apply_sale_status_to_items",
    "compute_purchase_payable_total",
    "get_item_payload_value",
    "get_purchase_item_payload_status",
    "get_purchase_item_status_for_transaction_status",
    "get_purchase_status_from_item_statuses",
    "get_purchase_status_from_items",
    "get_sale_item_payload_status",
    "get_sale_item_payload_value",
    "get_sale_item_status_for_transaction_status",
    "get_sale_status_from_item_statuses",
    "get_sale_status_from_items",
    "has_purchase_item_payload_status",
    "has_sale_item_payload_status",
    "normalize_purchase_items_for_status",
    "normalize_sale_items_for_status",
    "recalculate_payment_batch_total",
    "recalculate_purchase_payable",
    "set_item_payload_value",
    "set_sale_item_payload_value",
    "sync_supplier_payment_lines_for_purchase",
    "to_decimal",
]
