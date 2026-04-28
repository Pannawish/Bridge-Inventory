import json

from django.db.models import ProtectedError
from django.db import IntegrityError
from rest_framework import status, viewsets
from rest_framework.decorators import api_view
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from .models import Category, Customer, Product, Purchase, Sale, Supplier
from .serializers import (
    CategorySerializer,
    CustomerSerializer,
    ProductSerializer,
    PurchaseSerializer,
    SaleSerializer,
    SupplierSerializer,
)
from .services import answer_inventory_question, build_dashboard_summary


def format_serializer_errors(errors):
    if isinstance(errors, dict):
        parts = []
        for field, messages in errors.items():
            if isinstance(messages, list):
                message = " ".join(str(item) for item in messages)
            elif isinstance(messages, dict):
                message = format_serializer_errors(messages)
            else:
                message = str(messages)
            parts.append(f"{field}: {message}")
        return " ".join(parts)

    if isinstance(errors, list):
        return " ".join(str(item) for item in errors)

    return str(errors)


def normalize_request_data(request):
    data = {key: value for key, value in request.data.items()}

    raw_items = data.get("items")
    if isinstance(raw_items, str):
        data["items"] = json.loads(raw_items or "[]")

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
            return Response(
                {"error": format_serializer_errors(serializer.errors)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            self.perform_create(serializer)
        except IntegrityError:
            return Response(
                {"error": "This record conflicts with existing data."},
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
    queryset = Purchase.objects.prefetch_related("items__product")
    serializer_class = PurchaseSerializer


class SaleViewSet(InventoryModelViewSet):
    queryset = Sale.objects.prefetch_related("items__product")
    serializer_class = SaleSerializer


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
