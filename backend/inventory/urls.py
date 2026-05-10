from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views


router = DefaultRouter()
router.register("categories", views.CategoryViewSet, basename="category")
router.register("suppliers", views.SupplierViewSet, basename="supplier")
router.register("customers", views.CustomerViewSet, basename="customer")
router.register("products", views.ProductViewSet, basename="product")
router.register("purchases", views.PurchaseViewSet, basename="purchase")
router.register("sales", views.SaleViewSet, basename="sale")
router.register("quotations", views.QuotationViewSet, basename="quotation")
router.register("billing-notes", views.BillingNoteViewSet, basename="billing-note")
router.register("payment-batches", views.PaymentBatchViewSet, basename="payment-batch")

urlpatterns = [
    path("", views.api_home, name="api_home"),
    path("dashboard/", views.dashboard, name="dashboard"),
    path("lookups/products/", views.product_lookups, name="product_lookups"),
    path("lookups/suppliers/", views.supplier_lookups, name="supplier_lookups"),
    path("lookups/customers/", views.customer_lookups, name="customer_lookups"),
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
    path("chat/", views.chat, name="chat"),
]

urlpatterns += router.urls
