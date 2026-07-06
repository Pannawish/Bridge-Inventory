"""Billing note and payment batch views."""

from decimal import Decimal

from django.db.models import Sum
from django.utils import timezone
from rest_framework.decorators import api_view
from rest_framework.response import Response

from ..models import (
    BillingNote,
    BillingNoteLine,
    Customer,
    PaymentBatch,
    PaymentBatchLine,
    Purchase,
    Sale,
    Supplier,
)
from ..serializers import BillingNoteSerializer, PaymentBatchSerializer
from .common import (
    AutoReferenceNumberMixin,
    InventoryModelViewSet,
    BILLING_NOTE_ELIGIBLE_SALE_STATUSES,
    PAYMENT_BATCH_ELIGIBLE_PURCHASE_STATUSES,
    apply_date_range,
    apply_text_search,
    build_next_reference_no,
    build_party_options,
)
from .transactions import serialize_purchase_lookup, serialize_sale_lookup


def build_billing_note_summary():
    today = timezone.localdate()

    outstanding = (
        BillingNote.objects.exclude(
            status__in=(BillingNote.STATUS_FULLY_RECEIVED, BillingNote.STATUS_CANCELLED)
        ).aggregate(total=Sum("total_amount"))["total"]
        or Decimal("0")
    )
    overdue = (
        BillingNote.objects.exclude(
            status__in=(BillingNote.STATUS_FULLY_RECEIVED, BillingNote.STATUS_CANCELLED)
        )
        .filter(expected_payment_date__lt=today)
        .aggregate(total=Sum("total_amount"))["total"]
        or Decimal("0")
    )
    received = (
        BillingNote.objects.filter(
            status=BillingNote.STATUS_FULLY_RECEIVED
        ).aggregate(total=Sum("total_amount"))["total"]
        or Decimal("0")
    )

    return {
        "outstanding": outstanding,
        "overdue": overdue,
        "received": received,
    }


def build_payment_batch_summary():
    today = timezone.localdate()

    outstanding = (
        PaymentBatch.objects.exclude(
            status__in=(PaymentBatch.STATUS_PAID, PaymentBatch.STATUS_CANCELLED)
        ).aggregate(total=Sum("total_amount"))["total"]
        or Decimal("0")
    )
    overdue = (
        PaymentBatch.objects.exclude(
            status__in=(PaymentBatch.STATUS_PAID, PaymentBatch.STATUS_CANCELLED)
        )
        .filter(planned_payment_date__lt=today)
        .aggregate(total=Sum("total_amount"))["total"]
        or Decimal("0")
    )
    paid = (
        PaymentBatch.objects.filter(
            status=PaymentBatch.STATUS_PAID
        ).aggregate(total=Sum("total_amount"))["total"]
        or Decimal("0")
    )

    return {
        "outstanding": outstanding,
        "overdue": overdue,
        "paid": paid,
    }

class BillingNoteViewSet(AutoReferenceNumberMixin, InventoryModelViewSet):
    reference_prefix = "BN"
    queryset = BillingNote.objects.select_related("customer").prefetch_related(
        "lines__sale",
        "credit_notes",
    )
    serializer_class = BillingNoteSerializer
    search_fields = (
        "reference_no",
        "customer_name",
        "status",
        "billing_note_date",
        "expected_payment_date",
        "actual_payment_date",
        "bank_reference",
        "note",
        "lines__sale__reference_no",
    )
    date_filter_field = "billing_note_date"
    party_filter_field = "customer_name"
    party_filter_param = "customer"
    amount_filter_field = "total_amount"

class PaymentBatchViewSet(AutoReferenceNumberMixin, InventoryModelViewSet):
    reference_prefix = "PMT"
    queryset = PaymentBatch.objects.select_related("supplier").prefetch_related(
        "lines__purchase__items"
    )
    serializer_class = PaymentBatchSerializer
    search_fields = (
        "reference_no",
        "supplier_name",
        "status",
        "batch_date",
        "planned_payment_date",
        "actual_payment_date",
        "bank_reference",
        "note",
        "lines__purchase__reference_no",
    )
    date_filter_field = "batch_date"
    party_filter_field = "supplier_name"
    party_filter_param = "supplier"
    amount_filter_field = "total_amount"

@api_view(["GET"])
def eligible_billing_note_sales(request):
    active_sale_ids = BillingNoteLine.objects.exclude(
        billing_note__status=BillingNote.STATUS_CANCELLED
    ).values_list("sale_id", flat=True)

    queryset = Sale.objects.filter(
        status__in=BILLING_NOTE_ELIGIBLE_SALE_STATUSES,
    ).exclude(id__in=active_sale_ids)

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

    return Response(
        {
            "customers": build_party_options(customer_names, Customer),
            "sales": [serialize_sale_lookup(sale) for sale in sales],
            "summary": build_billing_note_summary(),
            "next_reference_no": build_next_reference_no(BillingNote, "BN"),
        }
    )

@api_view(["GET"])
def eligible_payment_batch_purchases(request):
    active_purchase_ids = PaymentBatchLine.objects.exclude(
        payment_batch__status=PaymentBatch.STATUS_CANCELLED
    ).values_list("purchase_id", flat=True)

    queryset = Purchase.objects.filter(
        status__in=PAYMENT_BATCH_ELIGIBLE_PURCHASE_STATUSES,
    ).exclude(id__in=active_purchase_ids)

    queryset = apply_text_search(
        queryset,
        request,
        (
            "reference_no",
            "supplier_name",
            "supplier_tax_invoice",
            "status",
            "transaction_date",
            "note",
        ),
    )
    queryset = apply_date_range(queryset, request, "transaction_date")

    supplier = (request.query_params.get("supplier") or "").strip()
    if supplier:
        queryset = queryset.filter(supplier_name__iexact=supplier)

    purchases = list(queryset)
    supplier_names = [purchase.supplier_name for purchase in purchases]

    return Response(
        {
            "suppliers": build_party_options(supplier_names, Supplier),
            "purchases": [serialize_purchase_lookup(purchase) for purchase in purchases],
            "summary": build_payment_batch_summary(),
            "next_reference_no": build_next_reference_no(PaymentBatch, "PMT"),
        }
    )

__all__ = [
    "BillingNoteViewSet",
    "PaymentBatchViewSet",
    "build_billing_note_summary",
    "build_payment_batch_summary",
    "eligible_billing_note_sales",
    "eligible_payment_batch_purchases",
]
