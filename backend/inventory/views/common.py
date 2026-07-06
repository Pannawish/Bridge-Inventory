"""Shared view helpers and base classes.

The focused view modules all pass through this file for request normalization,
common filters, permissions, error formatting, and activity logging. Keep cross
cutting API behavior here so individual domain viewsets stay small.
"""

import json
import logging
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from django.db import IntegrityError, transaction
from django.db.models import ProtectedError, Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.decorators import api_view
from rest_framework.response import Response

from ..audit import log_activity, serialize_model_instance
from ..models import ActivityLog, Purchase, Sale
from ..permissions import InventoryModelPermissions


logger = logging.getLogger(__name__)


NULL_IF_BLANK_FIELDS = {
    "expected_delivery_date",
    "received_date",
    "lead_time_days",
    "shipped_date",
    "delivered_date",
    "payment_date",
    "expected_payment_date",
    "actual_payment_date",
    "planned_payment_date",
    "paid_date",
    "billing_note_date",
    "batch_date",
}

DECIMAL_FIELD_PLACES = {
    "total_before_vat": 2,
    "vat_amount": 2,
    "grand_total": 2,
    "unit_cost": 2,
    "unit_price": 2,
    "cost_price": 2,
    "sale_price": 2,
    "bill_discount": 2,
    "amount": 2,
    "line_total": 2,
    "quantity": 3,
    "base_quantity": 3,
    "conversion_factor": 6,
    "base_unit_cost": 6,
}

JSON_LIST_FIELDS = {
    "items",
    "previousSkus",
    "subNames",
    "unitConversions",
    "remove_document_ids",
    "remove_picture_ids",
}

BILLING_NOTE_ELIGIBLE_SALE_STATUSES = (
    Sale.STATUS_DELIVERED,
    Sale.STATUS_PARTIALLY_DELIVERED,
    Sale.STATUS_SHIPPED,
)

PAYMENT_BATCH_ELIGIBLE_PURCHASE_STATUSES = (
    Purchase.STATUS_RECEIVED,
    Purchase.STATUS_PARTIALLY_RECEIVED,
)

PRODUCT_DELETE_HISTORY_ERROR = (
    "This product cannot be deleted because it already has purchase, sales, "
    "or quotation history."
)


def format_serializer_errors(errors):
    if isinstance(errors, dict):
        parts = []
        for field, messages in errors.items():
            if isinstance(messages, list):
                message = " ".join(format_serializer_errors(item) for item in messages)
            elif isinstance(messages, dict):
                message = format_serializer_errors(messages)
            else:
                message = str(messages)
            parts.append(f"{field}: {message}")
        return " ".join(parts)

    if isinstance(errors, list):
        return " ".join(format_serializer_errors(item) for item in errors)

    return str(errors)


def normalize_decimal_value(value, decimal_places):
    if value in ("", None):
        return value

    try:
        decimal_value = Decimal(str(value))
    except (InvalidOperation, ValueError):
        return value

    quantizer = Decimal("1").scaleb(-decimal_places)
    return str(decimal_value.quantize(quantizer, rounding=ROUND_HALF_UP))


def normalize_decimal_fields(data):
    for field, decimal_places in DECIMAL_FIELD_PLACES.items():
        if field in data:
            data[field] = normalize_decimal_value(data[field], decimal_places)

    return data


def normalize_request_data(request):
    """Normalize JSON and multipart payloads into serializer-friendly data.

    The frontend can submit either JSON bodies or multipart forms with uploaded
    files. This function keeps both shapes compatible while preserving the
    serializer as the authority for validation.
    """
    data = {key: value for key, value in request.data.items()}

    if hasattr(request, "FILES"):
        uploaded_documents = request.FILES.getlist("documents")
        if uploaded_documents:
            data["uploaded_documents"] = uploaded_documents
        uploaded_pictures = request.FILES.getlist("pictures")
        if uploaded_pictures:
            data["uploaded_pictures"] = uploaded_pictures

    for field in JSON_LIST_FIELDS:
        raw_value = data.get(field)
        if isinstance(raw_value, str):
            data[field] = json.loads(raw_value or "[]")

    for field in NULL_IF_BLANK_FIELDS:
        if data.get(field) == "":
            data[field] = None

    data = normalize_decimal_fields(data)

    if isinstance(data.get("items"), list):
        data["items"] = [
            normalize_decimal_fields(
                {
                    key: None if key in NULL_IF_BLANK_FIELDS and value == "" else value
                    for key, value in item.items()
                }
            )
            for item in data["items"]
        ]

    return data


def apply_text_search(queryset, request, fields):
    search_query = (
        request.query_params.get("search") or request.query_params.get("q") or ""
    ).strip()
    if not search_query:
        return queryset

    search_filter = Q()
    for field in fields:
        search_filter |= Q(**{f"{field}__icontains": search_query})
    return queryset.filter(search_filter).distinct()


def apply_date_range(queryset, request, date_field):
    date_from = (
        request.query_params.get("date_from") or request.query_params.get("from") or ""
    ).strip()
    date_to = (
        request.query_params.get("date_to") or request.query_params.get("to") or ""
    ).strip()

    if date_from:
        queryset = queryset.filter(**{f"{date_field}__gte": date_from})
    if date_to:
        queryset = queryset.filter(**{f"{date_field}__lte": date_to})

    return queryset


def build_next_reference_no(model, prefix):
    today = timezone.localdate()
    year_month = f"{today.year + 543}"[-2:] + f"{today.month:02d}"
    reference_prefix = f"{prefix}-{year_month}-"
    max_serial = 0

    for reference_no in model.objects.filter(
        reference_no__startswith=reference_prefix
    ).values_list("reference_no", flat=True):
        suffix = f"{reference_no or ''}"[len(reference_prefix):]

        if suffix.isdigit():
            max_serial = max(max_serial, int(suffix))

    return f"{reference_prefix}{max_serial + 1:03d}"


def build_next_sequential_reference_no(model, prefix):
    """Sequential format: PREFIX-000001, PREFIX-000002 … (count-up only, never resets by month)."""
    pattern = f"{prefix}-"
    max_serial = 0

    for reference_no in model.objects.filter(
        reference_no__startswith=pattern
    ).values_list("reference_no", flat=True):
        suffix = f"{reference_no or ''}"[len(pattern):]

        if suffix.isdigit() and len(suffix) == 6:
            max_serial = max(max_serial, int(suffix))

    return f"{pattern}{max_serial + 1:06d}"


class AutoReferenceNumberMixin:
    """Assign a reference number when a create request leaves it blank or reused."""
    reference_prefix = ""
    sequential_reference = False

    def perform_create(self, serializer):
        model = self.queryset.model
        reference_no = serializer.validated_data.get("reference_no") or ""

        if not reference_no or model.objects.filter(reference_no=reference_no).exists():
            if self.sequential_reference:
                ref = build_next_sequential_reference_no(model, self.reference_prefix)
            else:
                ref = build_next_reference_no(model, self.reference_prefix)
            serializer.save(reference_no=ref)
            return

        serializer.save()


def build_party_options(names, model):
    names = sorted({name for name in names if name})
    partners = {
        partner.company_name: partner
        for partner in model.objects.filter(company_name__in=names)
    }

    return [
        {
            "id": partners[name].id if name in partners else name,
            "name": name,
            "companyName": name,
        }
        for name in names
    ]

class InventoryModelViewSet(viewsets.ModelViewSet):
    """Base viewset for inventory records with shared filters and audit logging."""
    parser_classes = [JSONParser, FormParser, MultiPartParser]
    permission_classes = [InventoryModelPermissions]
    lookup_value_regex = "[^/]+"
    search_fields = ()
    date_filter_field = None
    party_filter_field = None
    party_filter_param = None
    amount_filter_field = None
    product_filter_field = None

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params

        search_query = (params.get("search") or params.get("q") or "").strip()
        if search_query and self.search_fields:
            search_filter = Q()
            for field in self.search_fields:
                search_filter |= Q(**{f"{field}__icontains": search_query})
            queryset = queryset.filter(search_filter).distinct()

        statuses = [
            value.strip()
            for value in (params.get("status") or params.get("statuses") or "").split(",")
            if value.strip()
        ]
        if statuses and hasattr(queryset.model, "status"):
            queryset = queryset.filter(status__in=statuses)

        party_value = (
            params.get(self.party_filter_param or "")
            or params.get(self.party_filter_field or "")
            or ""
        ).strip()
        if party_value and self.party_filter_field:
            queryset = queryset.filter(**{f"{self.party_filter_field}__iexact": party_value})

        product_value = (params.get("product") or "").strip()
        if product_value and self.product_filter_field:
            queryset = queryset.filter(**{self.product_filter_field: product_value}).distinct()

        if self.date_filter_field:
            date_from = (params.get("date_from") or params.get("from") or "").strip()
            date_to = (params.get("date_to") or params.get("to") or "").strip()

            if date_from:
                queryset = queryset.filter(**{f"{self.date_filter_field}__gte": date_from})
            if date_to:
                queryset = queryset.filter(**{f"{self.date_filter_field}__lte": date_to})

        if self.amount_filter_field:
            for param, op in (("amount_min", "gte"), ("amount_max", "lte")):
                raw = (params.get(param) or "").strip()
                if not raw:
                    continue
                try:
                    amount = Decimal(raw)
                except (InvalidOperation, ValueError):
                    continue
                queryset = queryset.filter(**{f"{self.amount_filter_field}__{op}": amount})

        vat_mode = (params.get("vat_mode") or "").strip()
        if vat_mode and hasattr(queryset.model, "vat_mode"):
            queryset = queryset.filter(vat_mode=vat_mode)

        return queryset

    def create(self, request, *args, **kwargs):
        try:
            serializer = self.get_serializer(data=normalize_request_data(request))
        except json.JSONDecodeError:
            return Response({"error": "Items must be valid JSON."}, status=status.HTTP_400_BAD_REQUEST)

        if not serializer.is_valid():
            logger.debug("%s create validation error: %s", self.__class__.__name__, serializer.errors)
            return Response(
                {"error": format_serializer_errors(serializer.errors)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            self.perform_create(serializer)
        except IntegrityError as exc:
            logger.warning("%s create integrity error: %s", self.__class__.__name__, exc)
            return Response(
                {"error": f"This record conflicts with existing data: {exc}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_create(self, serializer):
        instance = serializer.save()
        log_activity(
            self.request,
            ActivityLog.ACTION_CREATE,
            instance,
            before={},
            after=serialize_model_instance(instance),
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        self._audit_before_update = serialize_model_instance(instance)

        try:
            serializer = self.get_serializer(
                instance,
                data=normalize_request_data(request),
                partial=partial,
            )
        except json.JSONDecodeError:
            return Response({"error": "Items must be valid JSON."}, status=status.HTTP_400_BAD_REQUEST)

        if not serializer.is_valid():
            return Response(
                {"error": format_serializer_errors(serializer.errors)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            self.perform_update(serializer)
        except IntegrityError:
            return Response(
                {"error": "This update conflicts with existing data."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(serializer.data)

    def perform_update(self, serializer):
        instance = serializer.save()
        log_activity(
            self.request,
            ActivityLog.ACTION_UPDATE,
            instance,
            before=getattr(self, "_audit_before_update", {}),
            after=serialize_model_instance(instance),
        )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        try:
            self.perform_destroy(instance)
        except ProtectedError:
            return Response(
                {"error": "This record is still used by another record and cannot be deleted."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(status=status.HTTP_204_NO_CONTENT)

    def perform_destroy(self, instance):
        before = serialize_model_instance(instance)
        with transaction.atomic():
            instance.delete()
            log_activity(
                self.request,
                ActivityLog.ACTION_DELETE,
                instance,
                before=before,
                after={},
            )

@api_view(["GET"])
def api_home(request):
    return Response(
        {
            "message": "Inventory Management API",
            "endpoints": [
                "/api/dashboard/",
                "/api/suppliers/",
                "/api/customers/",
                "/api/categories/",
                "/api/products/",
                "/api/lookups/products/",
                "/api/lookups/suppliers/",
                "/api/lookups/customers/",
                "/api/purchases/",
                "/api/sales/",
                "/api/quotations/",
                "/api/billing-notes/",
                "/api/eligibility/billing-note-sales/",
                "/api/payment-batches/",
                "/api/eligibility/payment-batch-purchases/",
                "/api/credit-notes/",
                "/api/eligibility/credit-note-sales/",
                "/api/chat/",
                "/api/ai-reports/",
            ],
        }
    )

__all__ = [
    "AutoReferenceNumberMixin",
    "BILLING_NOTE_ELIGIBLE_SALE_STATUSES",
    "DECIMAL_FIELD_PLACES",
    "InventoryModelViewSet",
    "JSON_LIST_FIELDS",
    "NULL_IF_BLANK_FIELDS",
    "PAYMENT_BATCH_ELIGIBLE_PURCHASE_STATUSES",
    "PRODUCT_DELETE_HISTORY_ERROR",
    "api_home",
    "apply_date_range",
    "apply_text_search",
    "build_next_reference_no",
    "build_next_sequential_reference_no",
    "build_party_options",
    "format_serializer_errors",
    "normalize_decimal_fields",
    "normalize_decimal_value",
    "normalize_request_data",
]
