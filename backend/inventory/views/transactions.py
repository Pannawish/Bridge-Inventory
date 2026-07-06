"""Purchase, sale, quotation, and credit-note views.

This module owns transaction list filtering and create-flow eligibility helpers.
Validation and stock-changing behavior remain in serializers/services so direct
API calls get the same safety rules as frontend workflows.
"""

from decimal import Decimal

from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from ..models import CreditNote, CreditNoteLine, Customer, Purchase, Sale, SaleItem, Quotation
from ..serializers import CreditNoteSerializer, PurchaseSerializer, QuotationSerializer, SaleSerializer
from ..services import SALE_INACTIVE_ITEM_STATUSES, get_available_stock_by_product_id
from .common import (
    AutoReferenceNumberMixin,
    InventoryModelViewSet,
    apply_date_range,
    apply_text_search,
    build_next_reference_no,
    build_party_options,
)


def serialize_sale_lookup(sale):
    return {
        "id": sale.id,
        "reference_no": sale.reference_no,
        "customer_name": sale.customer_name,
        "status": sale.status,
        "transaction_date": sale.transaction_date,
        "payment_term_type": sale.payment_term_type,
        "payment_term_days": sale.payment_term_days,
        "payment_date": sale.payment_date,
        "grand_total": sale.grand_total,
    }


def serialize_credit_note_line_option(sale_item):
    return {
        "sale_item": sale_item.id,
        "product_name": sale_item.product_name,
        "sku": sale_item.sku,
        "quantity": sale_item.quantity,
        "unit_price": sale_item.unit_price,
        "amount": sale_item.amount,
    }


def serialize_purchase_lookup(purchase):
    return {
        "id": purchase.id,
        "reference_no": purchase.reference_no,
        "supplier_name": purchase.supplier_name,
        "status": purchase.status,
        "transaction_date": purchase.transaction_date,
        "payment_term_type": purchase.payment_term_type,
        "payment_term_days": purchase.payment_term_days,
        "payment_date": purchase.payment_date,
        "grand_total": purchase.grand_total,
        "payable_total": purchase.payable_total,
    }

class PurchaseViewSet(AutoReferenceNumberMixin, InventoryModelViewSet):
    reference_prefix = "PO"
    queryset = Purchase.objects.select_related("supplier").prefetch_related(
        "items__product",
        "documents",
        "payment_batch_lines__payment_batch",
    )
    serializer_class = PurchaseSerializer
    search_fields = (
        "reference_no",
        "supplier_name",
        "supplier_tax_invoice",
        "status",
        "transaction_date",
        "note",
        "items__product_name",
        "items__sku",
    )
    date_filter_field = "transaction_date"
    party_filter_field = "supplier_name"
    party_filter_param = "supplier"
    amount_filter_field = "grand_total"
    product_filter_field = "items__product_id"


class SaleViewSet(AutoReferenceNumberMixin, InventoryModelViewSet):
    reference_prefix = "TI"
    queryset = Sale.objects.select_related("customer").prefetch_related(
        "items__product",
        "items__allocations__purchase_item__purchase",
        "items__allocations__supplier",
        "documents",
        "billing_note_lines__billing_note",
        "credit_notes",
    )
    serializer_class = SaleSerializer
    search_fields = (
        "reference_no",
        "customer_name",
        "customer_po_reference",
        "status",
        "transaction_date",
        "note",
        "items__product_name",
        "items__sku",
    )
    date_filter_field = "transaction_date"
    party_filter_field = "customer_name"
    party_filter_param = "customer"
    amount_filter_field = "grand_total"
    product_filter_field = "items__product_id"

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params

        stock_filter = (params.get("stock_filter") or "").strip()
        if stock_filter == "insufficient_stock":
            candidate_sales_qs = queryset.exclude(status__in=[Sale.STATUS_CANCELLED, Sale.STATUS_RETURNED])
            product_ids = set(
                SaleItem.objects.filter(sale__in=candidate_sales_qs, item_status=SaleItem.ITEM_PENDING)
                .values_list("product_id", flat=True)
                .distinct()
            )
            stock_by_product_id = get_available_stock_by_product_id(product_ids=list(product_ids))

            candidate_sales = candidate_sales_qs.prefetch_related("items")
            insufficient_sale_ids = []
            for sale in candidate_sales:
                req_qty_by_product = {}
                for item in sale.items.all():
                    if not item.product_id or item.item_status != SaleItem.ITEM_PENDING:
                        continue
                    req_qty_by_product[item.product_id] = req_qty_by_product.get(item.product_id, Decimal("0")) + (item.base_quantity or Decimal("0"))

                has_insufficient = False
                for prod_id, req_qty in req_qty_by_product.items():
                    available_qty = stock_by_product_id.get(prod_id, Decimal("0"))
                    if req_qty > available_qty:
                        has_insufficient = True
                        break
                if has_insufficient:
                    insufficient_sale_ids.append(sale.id)

            queryset = queryset.filter(id__in=insufficient_sale_ids)

        return queryset



class QuotationViewSet(AutoReferenceNumberMixin, InventoryModelViewSet):
    reference_prefix = "QT"
    sequential_reference = True
    queryset = Quotation.objects.select_related("customer", "supplier").prefetch_related(
        "line_items__product",
        "line_items__supplier_options",
        "derived_purchases",
        "derived_sales",
    )
    serializer_class = QuotationSerializer

class CreditNoteViewSet(AutoReferenceNumberMixin, InventoryModelViewSet):
    reference_prefix = "CN"
    queryset = CreditNote.objects.select_related(
        "customer",
        "sale",
        "billing_note",
    ).prefetch_related("lines__sale_item")
    serializer_class = CreditNoteSerializer
    search_fields = (
        "reference_no",
        "customer_name",
        "status",
        "credit_note_date",
        "note",
        "sale__reference_no",
        "billing_note__reference_no",
    )
    date_filter_field = "credit_note_date"
    party_filter_field = "customer_name"
    party_filter_param = "customer"
    amount_filter_field = "total_amount"

@api_view(["GET"])
def eligible_credit_note_sales(request):
    credited_item_ids = set(
        CreditNoteLine.objects.exclude(
            credit_note__status=CreditNote.STATUS_CANCELLED
        )
        .filter(sale_item__isnull=False)
        .values_list("sale_item_id", flat=True)
    )

    cancelled_items = (
        SaleItem.objects.filter(item_status__in=SALE_INACTIVE_ITEM_STATUSES)
        .exclude(id__in=credited_item_ids)
        .select_related("sale")
    )

    cancelled_lines_by_sale_id = {}
    for item in cancelled_items:
        cancelled_lines_by_sale_id.setdefault(item.sale_id, []).append(item)

    queryset = Sale.objects.filter(id__in=cancelled_lines_by_sale_id.keys())
    queryset = apply_text_search(
        queryset,
        request,
        ("reference_no", "customer_name", "status", "transaction_date", "note"),
    )
    queryset = apply_date_range(queryset, request, "transaction_date")

    customer = (request.query_params.get("customer") or "").strip()
    if customer:
        queryset = queryset.filter(customer_name__iexact=customer)

    sales = list(queryset)
    customer_names = [sale.customer_name for sale in sales]

    sale_payloads = [
        {
            **serialize_sale_lookup(sale),
            "cancelled_lines": [
                serialize_credit_note_line_option(item)
                for item in cancelled_lines_by_sale_id.get(sale.id, [])
            ],
        }
        for sale in sales
    ]

    return Response(
        {
            "customers": build_party_options(customer_names, Customer),
            "sales": sale_payloads,
            "next_reference_no": build_next_reference_no(CreditNote, "CN"),
        }
    )

__all__ = [
    "CreditNoteViewSet",
    "PurchaseViewSet",
    "QuotationViewSet",
    "SaleViewSet",
    "eligible_credit_note_sales",
    "serialize_credit_note_line_option",
    "serialize_purchase_lookup",
    "serialize_sale_lookup",
]
