import json
import logging
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from django.db import IntegrityError
from django.db.models import ProtectedError
from rest_framework import status, viewsets
from rest_framework.decorators import api_view
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from .models import (
    BillingNote,
    Category,
    Customer,
    PaymentBatch,
    Product,
    Purchase,
    Quotation,
    Sale,
    Supplier,
)
from .serializers import (
    BillingNoteSerializer,
    CategorySerializer,
    CustomerSerializer,
    PaymentBatchSerializer,
    ProductSerializer,
    PurchaseSerializer,
    QuotationSerializer,
    SaleSerializer,
    SupplierSerializer,
)
from .services import answer_inventory_question, build_dashboard_summary


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
    "amount": 2,
    "line_total": 2,
    "quantity": 3,
    "base_quantity": 3,
    "conversion_factor": 6,
}


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
    data = {key: value for key, value in request.data.items()}

    if hasattr(request, "FILES"):
        uploaded_documents = request.FILES.getlist("documents")
        if uploaded_documents:
            data["uploaded_documents"] = uploaded_documents

    raw_items = data.get("items")
    if isinstance(raw_items, str):
        data["items"] = json.loads(raw_items or "[]")

    raw_remove_document_ids = data.get("remove_document_ids")
    if isinstance(raw_remove_document_ids, str):
        data["remove_document_ids"] = json.loads(raw_remove_document_ids or "[]")

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


class InventoryModelViewSet(viewsets.ModelViewSet):
    parser_classes = [JSONParser, FormParser, MultiPartParser]
    lookup_value_regex = "[^/]+"

    def create(self, request, *args, **kwargs):
        try:
            serializer = self.get_serializer(data=normalize_request_data(request))
        except json.JSONDecodeError:
            return Response({"error": "Items must be valid JSON."}, status=status.HTTP_400_BAD_REQUEST)

        if not serializer.is_valid():
            logger.warning("%s create validation error: %s", self.__class__.__name__, serializer.errors)
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

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()

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


class CategoryViewSet(InventoryModelViewSet):
    queryset = Category.objects.select_related("parent").all()
    serializer_class = CategorySerializer


class SupplierViewSet(InventoryModelViewSet):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer


class CustomerViewSet(InventoryModelViewSet):
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer


class ProductViewSet(InventoryModelViewSet):
    queryset = Product.objects.select_related("category").prefetch_related("unit_conversions")
    serializer_class = ProductSerializer


class PurchaseViewSet(InventoryModelViewSet):
    queryset = Purchase.objects.prefetch_related("items__product", "documents")
    serializer_class = PurchaseSerializer


class SaleViewSet(InventoryModelViewSet):
    queryset = Sale.objects.prefetch_related("items__product", "documents")
    serializer_class = SaleSerializer


class QuotationViewSet(InventoryModelViewSet):
    queryset = Quotation.objects.all()
    serializer_class = QuotationSerializer


class BillingNoteViewSet(InventoryModelViewSet):
    queryset = BillingNote.objects.prefetch_related("lines__sale")
    serializer_class = BillingNoteSerializer


class PaymentBatchViewSet(InventoryModelViewSet):
    queryset = PaymentBatch.objects.prefetch_related("lines__purchase")
    serializer_class = PaymentBatchSerializer


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
                "/api/purchases/",
                "/api/sales/",
                "/api/quotations/",
                "/api/billing-notes/",
                "/api/payment-batches/",
                "/api/chat/",
            ],
        }
    )


@api_view(["GET"])
def dashboard(request):
    return Response(build_dashboard_summary(request))


@api_view(["POST"])
def chat(request):
    question = (request.data.get("question") or "").strip()

    if not question:
        return Response({"error": "Question is required."}, status=status.HTTP_400_BAD_REQUEST)

    return Response(answer_inventory_question(question, request))
