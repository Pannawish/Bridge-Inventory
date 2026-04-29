from django.contrib import admin

from .models import (
    Category,
    Customer,
    Product,
    ProductUnitConversion,
    Purchase,
    PurchaseItem,
    Quotation,
    Sale,
    SaleItem,
    Supplier,
)


class ProductUnitConversionInline(admin.TabularInline):
    model = ProductUnitConversion
    extra = 0


class PurchaseItemInline(admin.TabularInline):
    model = PurchaseItem
    extra = 0


class SaleItemInline(admin.TabularInline):
    model = SaleItem
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
    inlines = [ProductUnitConversionInline]


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
