import json
import logging
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from django.db import IntegrityError
from django.db.models import ProtectedError, Q
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
    PurchaseItem,
    Quotation,
    Sale,
    SaleItem,
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
from .services import (
    SALE_STOCK_DEDUCTED_STATUSES,
    answer_inventory_question,
    build_dashboard_summary,
    get_available_stock_by_product_id,
)


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
    search_fields = ()
    date_filter_field = None
    party_filter_field = None
    party_filter_param = None

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

        if self.date_filter_field:
            date_from = (params.get("date_from") or params.get("from") or "").strip()
            date_to = (params.get("date_to") or params.get("to") or "").strip()

            if date_from:
                queryset = queryset.filter(**{f"{self.date_filter_field}__gte": date_from})
            if date_to:
                queryset = queryset.filter(**{f"{self.date_filter_field}__lte": date_to})

        return queryset

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
    search_fields = (
        "company_name",
        "taxpayer_id",
        "term_type",
        "billing_note_date",
        "remark",
    )

    def get_queryset(self):
        queryset = super().get_queryset()
        profile_filter = (self.request.query_params.get("profile_filter") or "").strip()

        if profile_filter == "missing-tax-id":
            return queryset.filter(taxpayer_id="")
        if profile_filter == "has-email":
            return queryset.exclude(emails=[])
        if profile_filter == "has-phone":
            return queryset.exclude(tels=[])
        if profile_filter == "has-note":
            return queryset.filter(Q(remark__gt="") | Q(billing_note_date__gt=""))

        return queryset


class CustomerViewSet(InventoryModelViewSet):
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer
    search_fields = (
        "company_name",
        "taxpayer_id",
        "term_type",
        "billing_note_date",
        "remark",
    )

    def get_queryset(self):
        queryset = super().get_queryset()
        profile_filter = (self.request.query_params.get("profile_filter") or "").strip()

        if profile_filter == "missing-tax-id":
            return queryset.filter(taxpayer_id="")
        if profile_filter == "has-email":
            return queryset.exclude(emails=[])
        if profile_filter == "has-phone":
            return queryset.exclude(tels=[])
        if profile_filter == "has-note":
            return queryset.filter(Q(remark__gt="") | Q(billing_note_date__gt=""))

        return queryset


class ProductViewSet(InventoryModelViewSet):
    queryset = Product.objects.select_related("category").prefetch_related("unit_conversions")
    serializer_class = ProductSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params

        search_query = (params.get("search") or params.get("q") or "").strip()
        if search_query:
            product_search = (
                Q(product_name__icontains=search_query)
                | Q(sku__icontains=search_query)
                | Q(category__name__icontains=search_query)
                | Q(category_name__icontains=search_query)
                | Q(detail__icontains=search_query)
            )
            if search_query.isdigit():
                product_search |= Q(product_display_id=int(search_query))
            queryset = queryset.filter(product_search).distinct()

        category = (params.get("category") or "").strip()
        if category:
            category_leaf = category.split("/")[-1].strip()
            queryset = queryset.filter(
                Q(category__name__iexact=category)
                | Q(category__name__iexact=category_leaf)
                | Q(category_name__iexact=category)
                | Q(category_name__iexact=category_leaf)
            )

        stock_filter = (params.get("stock_filter") or params.get("stock") or "").strip()
        if stock_filter in {"in-stock", "out-of-stock"}:
            product_ids = list(queryset.values_list("id", flat=True))
            stock_by_product_id = get_available_stock_by_product_id(product_ids=product_ids)
            matching_ids = []
            for product_id in product_ids:
                stock_quantity = stock_by_product_id.get(product_id, Decimal("0"))
                if stock_filter == "in-stock" and stock_quantity > 0:
                    matching_ids.append(product_id)
                elif stock_filter == "out-of-stock" and stock_quantity <= 0:
                    matching_ids.append(product_id)
            queryset = queryset.filter(id__in=matching_ids)

        if stock_filter in {"selling", "no-sales"}:
            product_ids = list(queryset.values_list("id", flat=True))
            selling_product_ids = set(
                SaleItem.objects.filter(
                    item_status__in=SALE_STOCK_DEDUCTED_STATUSES,
                    product_id__in=product_ids,
                )
                .values_list("product_id", flat=True)
                .distinct()
            )
            if stock_filter == "selling":
                queryset = queryset.filter(id__in=selling_product_ids)
            else:
                queryset = queryset.exclude(id__in=selling_product_ids)

        if stock_filter == "no-purchases":
            product_ids = list(queryset.values_list("id", flat=True))
            purchased_product_ids = set(
                PurchaseItem.objects.filter(
                    item_status=PurchaseItem.ITEM_RECEIVED,
                    product_id__in=product_ids,
                )
                .values_list("product_id", flat=True)
                .distinct()
            )
            queryset = queryset.exclude(id__in=purchased_product_ids)

        return queryset


class PurchaseViewSet(InventoryModelViewSet):
    queryset = Purchase.objects.prefetch_related("items__product", "documents")
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


class SaleViewSet(InventoryModelViewSet):
    queryset = Sale.objects.prefetch_related("items__product", "documents")
    serializer_class = SaleSerializer
    search_fields = (
        "reference_no",
        "customer_name",
        "status",
        "transaction_date",
        "note",
        "items__product_name",
        "items__sku",
    )
    date_filter_field = "transaction_date"
    party_filter_field = "customer_name"
    party_filter_param = "customer"


class QuotationViewSet(InventoryModelViewSet):
    queryset = Quotation.objects.all()
    serializer_class = QuotationSerializer


class BillingNoteViewSet(InventoryModelViewSet):
    queryset = BillingNote.objects.prefetch_related("lines__sale")
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


class PaymentBatchViewSet(InventoryModelViewSet):
    queryset = PaymentBatch.objects.prefetch_related("lines__purchase")
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
