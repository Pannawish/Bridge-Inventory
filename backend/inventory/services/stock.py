"""Stock, allocation, and inventory report services."""

import math
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from ..models import Product, ProductSupplier, PurchaseItem, Sale, SaleItem, SaleItemAllocation
from .common import (
    as_number,
    compute_date_diff_in_days,
    compute_date_span_days,
    get_product_label,
)
from .transactions import (
    SALE_INACTIVE_ITEM_STATUSES,
    SALE_INACTIVE_TRANSACTION_STATUSES,
    SALE_STOCK_DEDUCTED_STATUSES,
    apply_sale_status_to_items,
    get_sale_item_status_for_transaction_status,
)


SAFETY_STOCK_DAYS = 7
RECENT_AVERAGE_COST_HISTORY_LIMIT = 3
RECENT_AVERAGE_SALE_PRICE_HISTORY_LIMIT = 3


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
        # The reorder point is only the ALARM line. We refill up to a higher
        # "order-up-to" level — the reorder point plus one more lead-time of
        # demand — so a triggered reorder is a real batch with a cushion, never 0
        # when stock is sitting exactly on the reorder line.
        order_up_to_level = reorder_level + Decimal(math.ceil(lead_time_demand))
        recommended_restock = max(
            Decimal("0"),
            order_up_to_level
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


__all__ = [
    "RECENT_AVERAGE_COST_HISTORY_LIMIT",
    "RECENT_AVERAGE_SALE_PRICE_HISTORY_LIMIT",
    "SAFETY_STOCK_DAYS",
    "SALE_INACTIVE_ITEM_STATUSES",
    "SALE_INACTIVE_TRANSACTION_STATUSES",
    "SALE_STOCK_DEDUCTED_STATUSES",
    "allocate_sale_item_fifo",
    "allocate_sale_item_from_requests",
    "apply_sale_status_to_items",
    "build_purchase_pack",
    "build_stock_report",
    "build_supplier_options",
    "create_empty_stock_row",
    "create_sale_item_allocation",
    "get_active_allocation_status_filter",
    "get_available_stock_by_product_id",
    "get_available_stock_layers",
    "get_product_metric_snapshots",
    "get_purchase_item_allocated_quantity",
    "get_purchase_item_base_unit_cost",
    "get_purchase_item_remaining_quantity",
    "get_sale_committed_quantity_by_product_id",
    "get_sale_item_allocated_cost",
    "get_sale_item_base_quantity",
    "get_sale_item_base_unit_price",
    "get_sale_item_product_id",
    "get_sale_item_requested_allocations",
    "get_sale_item_status",
    "get_sale_stock_issues",
    "record_supplier_cost",
    "serialize_stock_layer",
    "set_sale_item_cost_snapshot_from_allocations",
    "sync_product_supplier_links_for_purchase",
    "sync_sale_allocations",
    "sync_sale_item_allocations",
]
