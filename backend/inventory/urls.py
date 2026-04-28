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

urlpatterns = [
    path("", views.api_home, name="api_home"),
    path("dashboard/", views.dashboard, name="dashboard"),
    path("chat/", views.chat, name="chat"),
]

urlpatterns += router.urls
