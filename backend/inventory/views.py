import json
import logging
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.db import IntegrityError, transaction
from django.db.models import ProtectedError, Q, Sum
from django.http import Http404, HttpResponse
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .access_control import ensure_default_inventory_groups, get_managed_permission_options
from .audit import log_activity, serialize_model_instance
from .models import (
    ActivityLog,
    BillingNote,
    BillingNoteLine,
    Category,
    CreditNote,
    CreditNoteLine,
    Customer,
    PaymentBatch,
    PaymentBatchLine,
    Product,
    ProductPicture,
    ProductSupplier,
    Purchase,
    PurchaseItem,
    Quotation,
    Sale,
    SaleItem,
    Supplier,
)
from .ai_reports import generate_ai_report
from .serializers import (
    ActivityLogSerializer,
    AdminRoleSerializer,
    AdminUserSerializer,
    BillingNoteSerializer,
    CategorySerializer,
    CreditNoteSerializer,
    CustomerSerializer,
    PaymentBatchSerializer,
    ProductSerializer,
    ProductSupplierSerializer,
    PurchaseSerializer,
    QuotationSerializer,
    SaleSerializer,
    SupplierSerializer,
    PermissionOptionSerializer,
)
from .permissions import CanViewActivityLog, InventoryModelPermissions, IsUserAccessAdmin
from .services import (
    SALE_INACTIVE_ITEM_STATUSES,
    SALE_STOCK_DEDUCTED_STATUSES,
    answer_inventory_question,
    build_dashboard_overview,
    build_dashboard_segment,
    build_dashboard_summary,
    get_available_stock_by_product_id,
    get_available_stock_layers,
    get_product_metric_snapshots,
    serialize_stock_layer,
)


logger = logging.getLogger(__name__)
User = get_user_model()


def serialize_admin_user_access(user):
    snapshot = serialize_model_instance(user)
    if user.pk:
        snapshot["group_ids"] = list(user.groups.order_by("id").values_list("id", flat=True))
        snapshot["permission_ids"] = list(
            user.user_permissions.order_by("id").values_list("id", flat=True)
        )
    return snapshot


def serialize_admin_role_access(group):
    snapshot = serialize_model_instance(group)
    if group.pk:
        snapshot["permission_ids"] = list(
            group.permissions.order_by("id").values_list("id", flat=True)
        )
    return snapshot

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


def product_has_transaction_history(product):
    return (
        product.purchase_items.exists()
        or product.sale_items.exists()
        or product.quotation_items.exists()
    )


@api_view(["GET"])
def product_stock_layers(request, product_id):
    product = Product.objects.filter(pk=product_id).first()
    if product is None:
        return Response(
            {"error": "Product not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    exclude_sale_item_id = (
        request.query_params.get("exclude_sale_item_id")
        or request.query_params.get("exclude_sale_item")
        or ""
    ).strip()

    layers = [
        serialize_stock_layer(layer)
        for layer in get_available_stock_layers(
            product_id,
            exclude_sale_item_id=exclude_sale_item_id or None,
        )
    ]
    return Response(
        {
            "product_id": product.id,
            "product_name": product.product_name,
            "sku": product.sku,
            "stock_base_unit": product.stock_base_unit,
            "layers": layers,
        }
    )


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


class InventoryModelViewSet(viewsets.ModelViewSet):
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


class ProductSupplierViewSet(InventoryModelViewSet):
    queryset = ProductSupplier.objects.select_related("product", "supplier").all()
    serializer_class = ProductSupplierSerializer
    search_fields = (
        "product__product_name",
        "product__sku",
        "supplier__company_name",
        "supplier_sku",
    )

    def get_queryset(self):
        queryset = super().get_queryset()
        product_id = (self.request.query_params.get("product") or "").strip()
        supplier_id = (self.request.query_params.get("supplier") or "").strip()
        active = (self.request.query_params.get("active") or "").strip().lower()

        if product_id:
            queryset = queryset.filter(product_id=product_id)
        if supplier_id:
            queryset = queryset.filter(supplier_id=supplier_id)
        if active in {"1", "true", "yes"}:
            queryset = queryset.filter(is_active=True)

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
    queryset = Product.objects.select_related("category").prefetch_related(
        "unit_conversions",
        "pictures",
    )
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
        if stock_filter in {"in-stock", "out-of-stock", "low-stock"}:
            product_ids = list(queryset.values_list("id", flat=True))
            stock_by_product_id = get_available_stock_by_product_id(product_ids=product_ids)
            reorder_by_product_id = dict(queryset.values_list("id", "reorder_level"))
            matching_ids = []
            for product_id in product_ids:
                stock_quantity = stock_by_product_id.get(product_id, Decimal("0"))
                if stock_filter == "in-stock" and stock_quantity > 0:
                    matching_ids.append(product_id)
                elif stock_filter == "out-of-stock" and stock_quantity <= 0:
                    matching_ids.append(product_id)
                elif stock_filter == "low-stock":
                    reorder_level = reorder_by_product_id.get(product_id) or Decimal("0")
                    if stock_quantity > 0 and reorder_level > 0 and stock_quantity <= reorder_level:
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

    def get_serializer_context(self):
        context = super().get_serializer_context()

        if self.action == "list":
            product_ids = list(self.get_queryset().values_list("id", flat=True))
            context["product_metrics_by_product_id"] = get_product_metric_snapshots(
                product_ids=product_ids
            )
        elif self.action == "retrieve":
            product_id = self.kwargs.get(self.lookup_field or "pk")
            context["product_metrics_by_product_id"] = get_product_metric_snapshots(
                product_ids=[product_id]
            )

        return context

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if product_has_transaction_history(instance):
            return Response(
                {"error": PRODUCT_DELETE_HISTORY_ERROR},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return super().destroy(request, *args, **kwargs)


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


class AdminUserViewSet(viewsets.ModelViewSet):
    serializer_class = AdminUserSerializer
    permission_classes = [IsUserAccessAdmin]
    lookup_value_regex = "[^/]+"

    def get_queryset(self):
        ensure_default_inventory_groups()
        queryset = User.objects.prefetch_related("groups", "user_permissions").order_by(
            "username"
        )
        params = self.request.query_params

        search_query = (params.get("search") or params.get("q") or "").strip()
        if search_query:
            queryset = queryset.filter(
                Q(username__icontains=search_query)
                | Q(email__icontains=search_query)
                | Q(first_name__icontains=search_query)
                | Q(last_name__icontains=search_query)
            )

        active = (params.get("active") or "").strip().lower()
        if active in {"true", "1", "yes"}:
            queryset = queryset.filter(is_active=True)
        elif active in {"false", "0", "no"}:
            queryset = queryset.filter(is_active=False)

        role_id = (params.get("role") or "").strip()
        if role_id:
            queryset = queryset.filter(groups__id=role_id)

        return queryset.distinct()

    def perform_create(self, serializer):
        user = serializer.save()
        log_activity(
            self.request,
            ActivityLog.ACTION_CREATE,
            user,
            before={},
            after=serialize_admin_user_access(user),
        )

    def perform_update(self, serializer):
        before = serialize_admin_user_access(serializer.instance)
        user = serializer.save()
        log_activity(
            self.request,
            ActivityLog.ACTION_UPDATE,
            user,
            before=before,
            after=serialize_admin_user_access(user),
        )

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        if user.id == request.user.id:
            return Response(
                {"error": "You cannot delete your own account."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)

    def perform_destroy(self, instance):
        before = serialize_admin_user_access(instance)
        with transaction.atomic():
            instance.delete()
            log_activity(
                self.request,
                ActivityLog.ACTION_DELETE,
                instance,
                before=before,
                after={},
            )


class AdminRoleViewSet(viewsets.ModelViewSet):
    serializer_class = AdminRoleSerializer
    permission_classes = [IsUserAccessAdmin]
    queryset = Group.objects.prefetch_related("permissions__content_type").order_by("name")

    def get_queryset(self):
        ensure_default_inventory_groups()
        queryset = super().get_queryset()
        search_query = (self.request.query_params.get("search") or "").strip()
        if search_query:
            queryset = queryset.filter(name__icontains=search_query)
        return queryset

    def perform_create(self, serializer):
        role = serializer.save()
        log_activity(
            self.request,
            ActivityLog.ACTION_CREATE,
            role,
            before={},
            after=serialize_admin_role_access(role),
        )

    def perform_update(self, serializer):
        before = serialize_admin_role_access(serializer.instance)
        role = serializer.save()
        log_activity(
            self.request,
            ActivityLog.ACTION_UPDATE,
            role,
            before=before,
            after=serialize_admin_role_access(role),
        )

    def perform_destroy(self, instance):
        before = serialize_admin_role_access(instance)
        with transaction.atomic():
            instance.delete()
            log_activity(
                self.request,
                ActivityLog.ACTION_DELETE,
                instance,
                before=before,
                after={},
            )

    @action(detail=False, methods=["get"], url_path="permission-options")
    def permission_options(self, request):
        permissions = get_managed_permission_options()
        serializer = PermissionOptionSerializer(permissions, many=True)
        return Response(serializer.data)


class ActivityLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ActivityLogSerializer
    permission_classes = [CanViewActivityLog]
    queryset = ActivityLog.objects.select_related("user").all()

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params

        search_query = (params.get("search") or params.get("q") or "").strip()
        if search_query:
            queryset = queryset.filter(
                Q(actor_username__icontains=search_query)
                | Q(object_type__icontains=search_query)
                | Q(object_id__icontains=search_query)
                | Q(object_repr__icontains=search_query)
                | Q(summary__icontains=search_query)
            )

        action_value = (params.get("action") or "").strip()
        if action_value:
            queryset = queryset.filter(action=action_value)

        user_id = (params.get("user") or "").strip()
        if user_id:
            queryset = queryset.filter(user_id=user_id)

        object_type = (params.get("object_type") or "").strip()
        if object_type:
            queryset = queryset.filter(object_type=object_type)

        date_from = (params.get("date_from") or params.get("from") or "").strip()
        date_to = (params.get("date_to") or params.get("to") or "").strip()
        if date_from:
            queryset = queryset.filter(created_at__date__gte=date_from)
        if date_to:
            queryset = queryset.filter(created_at__date__lte=date_to)

        return queryset


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


@api_view(["GET"])
@permission_classes([AllowAny])
def product_picture_file(request, picture_id):
    # Serve a product attachment's bytes from the database. Public (AllowAny)
    # because it is loaded by <img>/<iframe> tags, which cannot send the JWT auth
    # header; the picture id is an unguessable random string.
    picture = ProductPicture.objects.filter(id=picture_id).first()
    if not picture or not picture.content:
        raise Http404("Attachment not found")
    response = HttpResponse(
        bytes(picture.content),
        content_type=picture.content_type or "application/octet-stream",
    )
    response["Content-Disposition"] = f'inline; filename="{picture.filename or "attachment"}"'
    response["Cache-Control"] = "public, max-age=86400"
    return response


@api_view(["GET"])
def dashboard(request):
    data = build_dashboard_summary(request)
    data["overview"] = build_dashboard_overview()
    return Response(data)


@api_view(["GET"])
def dashboard_segment(request):
    segment = (request.query_params.get("segment") or "").strip()
    period = (request.query_params.get("period") or "").strip()
    result = build_dashboard_segment(segment, period)
    if result is None:
        return Response({"detail": "Unknown dashboard segment."}, status=400)
    return Response(result)


@api_view(["GET"])
def product_lookups(request):
    queryset = Product.objects.select_related("category").prefetch_related(
        "unit_conversions",
        "pictures",
    )
    include_disabled = str(request.query_params.get("include_disabled") or "").lower()
    if include_disabled not in {"1", "true", "yes"}:
        queryset = queryset.filter(is_active=True)

    queryset = apply_text_search(
        queryset,
        request,
        ("product_name", "sku", "category__name", "category_name", "detail"),
    )
    products = list(queryset)
    product_metrics_by_product_id = get_product_metric_snapshots(
        product_ids=[product.id for product in products]
    )
    serializer = ProductSerializer(
        products,
        many=True,
        context={
            "product_metrics_by_product_id": product_metrics_by_product_id,
            "request": request,
        },
    )
    return Response(serializer.data)


@api_view(["GET"])
def supplier_lookups(request):
    queryset = apply_text_search(
        Supplier.objects.all(),
        request,
        ("company_name", "taxpayer_id", "term_type", "billing_note_date", "remark"),
    )
    return Response(SupplierSerializer(queryset, many=True).data)


@api_view(["GET"])
def customer_lookups(request):
    queryset = apply_text_search(
        Customer.objects.all(),
        request,
        ("company_name", "taxpayer_id", "term_type", "billing_note_date", "remark"),
    )
    return Response(CustomerSerializer(queryset, many=True).data)


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


@api_view(["GET"])
def product_transaction_history(request, product_id):
    product = Product.objects.filter(pk=product_id).first()
    if product is None:
        return Response({"error": "Product not found."}, status=status.HTTP_404_NOT_FOUND)

    purchases = (
        Purchase.objects.filter(items__product_id=product_id)
        .prefetch_related("items__product", "documents")
        .distinct()
    )
    sales = (
        Sale.objects.filter(items__product_id=product_id)
        .prefetch_related("items__product", "documents")
        .distinct()
    )
    has_transaction_history = (
        purchases.exists()
        or sales.exists()
        or product.quotation_items.exists()
    )

    return Response(
        {
            "product_id": product.id,
            "has_transaction_history": has_transaction_history,
            "purchases": PurchaseSerializer(
                purchases,
                many=True,
                context={"request": request},
            ).data,
            "sales": SaleSerializer(
                sales,
                many=True,
                context={"request": request},
            ).data,
        }
    )


@api_view(["POST"])
def chat(request):
    question = (request.data.get("question") or "").strip()

    if not question:
        return Response({"error": "Question is required."}, status=status.HTTP_400_BAD_REQUEST)

    return Response(answer_inventory_question(question, request))


@api_view(["POST"])
def ai_report(request):
    return Response(generate_ai_report(request.data))
