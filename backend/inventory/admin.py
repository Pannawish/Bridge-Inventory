"""Django admin registrations for inventory models."""

from django.contrib import admin

from .models import (
    ActivityLog,
    Category,
    Customer,
    Product,
    ProductPicture,
    ProductSupplier,
    ProductUnitConversion,
    Purchase,
    PurchaseItem,
    Quotation,
    QuotationItem,
    Sale,
    SaleItemAllocation,
    SaleItem,
    Supplier,
)


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ["created_at", "actor_username", "action", "object_type", "object_repr"]
    list_filter = ["action", "object_type", "created_at"]
    search_fields = ["actor_username", "object_type", "object_id", "object_repr", "summary"]
    readonly_fields = [
        "id",
        "user",
        "actor_username",
        "action",
        "object_type",
        "object_id",
        "object_repr",
        "summary",
        "changes",
        "ip_address",
        "user_agent",
        "created_at",
    ]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


class ProductUnitConversionInline(admin.TabularInline):
    model = ProductUnitConversion
    extra = 0


class ProductPictureInline(admin.TabularInline):
    model = ProductPicture
    extra = 0


class ProductSupplierInline(admin.TabularInline):
    model = ProductSupplier
    extra = 0


class PurchaseItemInline(admin.TabularInline):
    model = PurchaseItem
    extra = 0


class SaleItemAllocationInline(admin.TabularInline):
    model = SaleItemAllocation
    extra = 0


class SaleItemInline(admin.TabularInline):
    model = SaleItem
    extra = 0


class QuotationItemInline(admin.TabularInline):
    model = QuotationItem
    extra = 0


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ["name", "parent", "updated_at"]
    search_fields = ["name", "description"]


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ["company_name", "taxpayer_id", "updated_at"]
    search_fields = ["company_name", "taxpayer_id", "remark"]


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ["company_name", "taxpayer_id", "updated_at"]
    search_fields = ["company_name", "taxpayer_id", "remark"]


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ["product_display_id", "product_name", "sku", "category_name"]
    search_fields = ["product_name", "sku", "category_name"]
    inlines = [ProductUnitConversionInline, ProductSupplierInline, ProductPictureInline]


@admin.register(Purchase)
class PurchaseAdmin(admin.ModelAdmin):
    list_display = ["reference_no", "supplier_name", "status", "transaction_date", "grand_total"]
    search_fields = ["reference_no", "supplier_name", "supplier_tax_invoice"]
    inlines = [PurchaseItemInline]


@admin.register(Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display = ["reference_no", "customer_name", "status", "transaction_date", "grand_total"]
    search_fields = ["reference_no", "customer_name"]
    inlines = [SaleItemInline]


@admin.register(SaleItem)
class SaleItemAdmin(admin.ModelAdmin):
    list_display = ["sale", "product_name", "supplier_name", "item_status", "quantity", "unit_price"]
    search_fields = ["sale__reference_no", "product_name", "sku", "supplier_name"]
    inlines = [SaleItemAllocationInline]


@admin.register(Quotation)
class QuotationAdmin(admin.ModelAdmin):
    list_display = [
        "reference_no",
        "customer_name",
        "supplier_name",
        "quotation_date",
        "valid_until_date",
        "grand_total",
    ]
    search_fields = ["reference_no", "customer_name", "supplier_name", "note"]
    inlines = [QuotationItemInline]
