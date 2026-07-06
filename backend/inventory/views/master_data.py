"""Master data viewsets and lookup endpoints."""

from ._legacy import (
    CategoryViewSet,
    CustomerViewSet,
    ProductSupplierViewSet,
    ProductViewSet,
    SupplierViewSet,
    customer_lookups,
    product_has_transaction_history,
    product_lookups,
    product_picture_file,
    product_stock_layers,
    product_transaction_history,
    supplier_lookups,
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

