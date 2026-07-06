"""Master data viewsets and lookup endpoints.

Products, categories, suppliers, and customers are master data used by many
transaction serializers. Keep lookup endpoints lightweight and keep delete
guards strict when transaction history would be corrupted by removing a record.
"""

from decimal import Decimal

from django.db.models import Q
from django.http import Http404, HttpResponse
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from ..models import (
    Category,
    Customer,
    Product,
    ProductPicture,
    ProductSupplier,
    Purchase,
    PurchaseItem,
    Sale,
    SaleItem,
    Supplier,
)
from ..serializers import (
    CategorySerializer,
    CustomerSerializer,
    ProductSerializer,
    ProductSupplierSerializer,
    PurchaseSerializer,
    SaleSerializer,
    SupplierSerializer,
)
from ..services import (
    SALE_STOCK_DEDUCTED_STATUSES,
    get_available_stock_by_product_id,
    get_available_stock_layers,
    get_product_metric_snapshots,
    serialize_stock_layer,
)
from .common import (
    InventoryModelViewSet,
    PRODUCT_DELETE_HISTORY_ERROR,
    apply_text_search,
)


def product_has_transaction_history(product):
    """Return whether deleting a product would orphan business history."""
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

__all__ = [
    "CategoryViewSet",
    "CustomerViewSet",
    "ProductSupplierViewSet",
    "ProductViewSet",
    "SupplierViewSet",
    "customer_lookups",
    "product_has_transaction_history",
    "product_lookups",
    "product_picture_file",
    "product_stock_layers",
    "product_transaction_history",
    "supplier_lookups",
]
