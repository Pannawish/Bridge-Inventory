"""Inventory app URL routing for viewsets and focused API endpoints."""

from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views


router = DefaultRouter()
router.register("categories", views.CategoryViewSet, basename="category")
router.register("suppliers", views.SupplierViewSet, basename="supplier")
router.register("product-suppliers", views.ProductSupplierViewSet, basename="product-supplier")
router.register("customers", views.CustomerViewSet, basename="customer")
router.register("products", views.ProductViewSet, basename="product")
router.register("purchases", views.PurchaseViewSet, basename="purchase")
router.register("sales", views.SaleViewSet, basename="sale")
router.register("quotations", views.QuotationViewSet, basename="quotation")
router.register("billing-notes", views.BillingNoteViewSet, basename="billing-note")
router.register("payment-batches", views.PaymentBatchViewSet, basename="payment-batch")
router.register("credit-notes", views.CreditNoteViewSet, basename="credit-note")
router.register("admin/users", views.AdminUserViewSet, basename="admin-user")
router.register("admin/roles", views.AdminRoleViewSet, basename="admin-role")
router.register("activity-logs", views.ActivityLogViewSet, basename="activity-log")

urlpatterns = [
    path("", views.api_home, name="api_home"),
    path(
        "product-pictures/<str:picture_id>/",
        views.product_picture_file,
        name="product_picture_file",
    ),
    path("dashboard/", views.dashboard, name="dashboard"),
    path("dashboard/segment/", views.dashboard_segment, name="dashboard_segment"),
    path("lookups/products/", views.product_lookups, name="product_lookups"),
    path("lookups/suppliers/", views.supplier_lookups, name="supplier_lookups"),
    path("lookups/customers/", views.customer_lookups, name="customer_lookups"),
    path(
        "products/<str:product_id>/history/",
        views.product_transaction_history,
        name="product_transaction_history",
    ),
    path(
        "products/<str:product_id>/stock-layers/",
        views.product_stock_layers,
        name="product_stock_layers",
    ),
    path(
        "eligibility/billing-note-sales/",
        views.eligible_billing_note_sales,
        name="eligible_billing_note_sales",
    ),
    path(
        "eligibility/payment-batch-purchases/",
        views.eligible_payment_batch_purchases,
        name="eligible_payment_batch_purchases",
    ),
    path(
        "eligibility/credit-note-sales/",
        views.eligible_credit_note_sales,
        name="eligible_credit_note_sales",
    ),
    path("chat/", views.chat, name="chat"),
    path("ai-reports/", views.ai_report, name="ai_report"),
]

urlpatterns += router.urls
