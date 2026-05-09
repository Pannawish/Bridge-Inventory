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
    path("chat/", views.chat, name="chat"),
]

urlpatterns += router.urls
