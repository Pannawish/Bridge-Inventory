from decimal import Decimal

from rest_framework import serializers

from .models import (
    Category,
    Customer,
    Product,
    ProductUnitConversion,
    Purchase,
    PurchaseItem,
    Sale,
    SaleItem,
    Supplier,
)


def clean_list(value):
    if not isinstance(value, list):
        return []

    return ["" if item is None else str(item) for item in value]


def decimal_or_zero(value):
    if value in ("", None):
        return Decimal("0")

    return Decimal(str(value))


def build_file_url(request, file_field):
    if not file_field:
        return ""

    url = file_field.url
    return request.build_absolute_uri(url) if request else url


class CategorySerializer(serializers.ModelSerializer):
    parentId = serializers.CharField(
        source="parent_id",
        allow_blank=True,
        allow_null=True,
        required=False,
    )

    class Meta:
        model = Category
        fields = ["id", "name", "description", "parentId"]
        extra_kwargs = {
            "id": {"required": False},
            "name": {"allow_blank": False},
            "description": {"required": False, "allow_blank": True},
        }

    def validate_parentId(self, value):
        return value or None


class BusinessPartnerSerializer(serializers.ModelSerializer):
    companyName = serializers.CharField(source="company_name")
    selectedLocationIndex = serializers.IntegerField(source="selected_location_index", required=False)
    selectedEmailIndex = serializers.IntegerField(source="selected_email_index", required=False)
    selectedTelIndex = serializers.IntegerField(source="selected_tel_index", required=False)
    taxpayerId = serializers.CharField(source="taxpayer_id", required=False, allow_blank=True)
    selectedBranchIndex = serializers.IntegerField(source="selected_branch_index", required=False)
    shippingAddresses = serializers.JSONField(source="shipping_addresses", required=False)
    selectedShippingAddressIndex = serializers.IntegerField(
        source="selected_shipping_address_index",
        required=False,
    )
    billingNoteDate = serializers.CharField(source="billing_note_date", required=False, allow_blank=True)

    def validate_locations(self, value):
        return clean_list(value)

    def validate_emails(self, value):
        return clean_list(value)

    def validate_tels(self, value):
        return clean_list(value)

    def validate_branches(self, value):
        return clean_list(value)

    def validate_shippingAddresses(self, value):
        return clean_list(value)


class SupplierSerializer(BusinessPartnerSerializer):
    class Meta:
        model = Supplier
        fields = [
            "id",
            "companyName",
            "locations",
            "selectedLocationIndex",
            "emails",
            "selectedEmailIndex",
            "tels",
            "selectedTelIndex",
            "taxpayerId",
            "branches",
            "selectedBranchIndex",
            "shippingAddresses",
            "selectedShippingAddressIndex",
            "remark",
            "billingNoteDate",
        ]
        extra_kwargs = {
            "id": {"required": False},
            "remark": {"required": False, "allow_blank": True},
        }


class CustomerSerializer(BusinessPartnerSerializer):
    class Meta:
        model = Customer
        fields = [
            "id",
            "companyName",
            "locations",
            "selectedLocationIndex",
            "emails",
            "selectedEmailIndex",
            "tels",
            "selectedTelIndex",
            "taxpayerId",
            "branches",
            "selectedBranchIndex",
            "shippingAddresses",
            "selectedShippingAddressIndex",
            "remark",
            "billingNoteDate",
        ]
        extra_kwargs = {
            "id": {"required": False},
            "remark": {"required": False, "allow_blank": True},
        }


class ProductUnitConversionSerializer(serializers.ModelSerializer):
    factorToBase = serializers.DecimalField(
        source="factor_to_base",
        max_digits=12,
        decimal_places=6,
    )
    allowPurchase = serializers.BooleanField(source="allow_purchase", required=False)
    allowSale = serializers.BooleanField(source="allow_sale", required=False)

    class Meta:
        model = ProductUnitConversion
        fields = ["unit", "factorToBase", "allowPurchase", "allowSale"]


class ProductSerializer(serializers.ModelSerializer):
    productDisplayId = serializers.IntegerField(source="product_display_id", required=False)
    previousSkus = serializers.JSONField(source="previous_skus", required=False)
    productName = serializers.CharField(source="product_name")
    subNames = serializers.JSONField(source="sub_names", required=False)
    stockBaseUnit = serializers.CharField(source="stock_base_unit", required=False, allow_blank=True)
    defaultPurchaseUnit = serializers.CharField(
        source="default_purchase_unit",
        required=False,
        allow_blank=True,
    )
    defaultSalesUnit = serializers.CharField(
        source="default_sales_unit",
        required=False,
        allow_blank=True,
    )
    unitConversions = ProductUnitConversionSerializer(
        source="unit_conversions",
        many=True,
        required=False,
    )
    categoryId = serializers.CharField(
        source="category_id",
        required=False,
        allow_blank=True,
        allow_null=True,
    )
    category = serializers.CharField(source="category_name", required=False, allow_blank=True)
    pictureUrl = serializers.URLField(source="picture_url", required=False, allow_blank=True)
    current_stock = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id",
            "productDisplayId",
            "sku",
            "previousSkus",
            "productName",
            "subNames",
            "stockBaseUnit",
            "defaultPurchaseUnit",
            "defaultSalesUnit",
            "unitConversions",
            "categoryId",
            "category",
            "detail",
            "pictureUrl",
            "reorder_level",
            "current_stock",
        ]
        extra_kwargs = {
            "id": {"required": False},
            "sku": {"allow_blank": False},
            "detail": {"required": False, "allow_blank": True},
            "reorder_level": {"required": False},
        }

    def get_current_stock(self, product):
        from .services import get_available_stock_by_product_id

        return get_available_stock_by_product_id().get(product.id, Decimal("0"))

    def validate_previousSkus(self, value):
        return clean_list(value)

    def validate_subNames(self, value):
        return clean_list(value)

    def validate_categoryId(self, value):
        return value or None

    def _replace_unit_conversions(self, product, unit_conversions):
        if unit_conversions is None:
            return

        product.unit_conversions.all().delete()
        rows = []
        for conversion in unit_conversions:
            rows.append(
                ProductUnitConversion(
                    product=product,
                    unit=conversion.get("unit") or product.stock_base_unit,
                    factor_to_base=conversion.get("factor_to_base") or Decimal("1"),
                    allow_purchase=conversion.get("allow_purchase", True),
                    allow_sale=conversion.get("allow_sale", True),
                )
            )

        if not rows:
            rows.append(
                ProductUnitConversion(
                    product=product,
                    unit=product.stock_base_unit or "pcs",
                    factor_to_base=Decimal("1"),
                    allow_purchase=True,
                    allow_sale=True,
                )
            )

        ProductUnitConversion.objects.bulk_create(rows)

    def create(self, validated_data):
        unit_conversions = validated_data.pop("unit_conversions", None)
        product = Product.objects.create(**validated_data)
        self._replace_unit_conversions(product, unit_conversions)
        return product

    def update(self, instance, validated_data):
        unit_conversions = validated_data.pop("unit_conversions", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        self._replace_unit_conversions(instance, unit_conversions)
        return instance


class PurchaseItemSerializer(serializers.ModelSerializer):
    product_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    line_total = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseItem
        fields = [
            "id",
            "product_id",
            "product_name",
            "sku",
            "expected_delivery_date",
            "item_status",
            "received_date",
            "lead_time_days",
            "unit",
            "base_unit",
            "conversion_factor",
            "quantity",
            "base_quantity",
            "unit_cost",
            "discounts",
            "amount",
            "line_total",
        ]
        extra_kwargs = {
            "id": {"required": False},
            "sku": {"required": False, "allow_blank": True},
            "expected_delivery_date": {"required": False, "allow_null": True},
            "received_date": {"required": False, "allow_null": True},
            "lead_time_days": {"required": False, "allow_null": True},
            "unit": {"required": False, "allow_blank": True},
            "base_unit": {"required": False, "allow_blank": True},
            "conversion_factor": {"required": False},
            "quantity": {"required": False},
            "base_quantity": {"required": False},
            "unit_cost": {"required": False},
            "discounts": {"required": False},
            "amount": {"required": False},
        }

    def get_line_total(self, item):
        return item.amount

    def validate_product_id(self, value):
        return value or None

    def validate(self, attrs):
        quantity = decimal_or_zero(attrs.get("quantity", 0))
        factor = decimal_or_zero(attrs.get("conversion_factor", 1)) or Decimal("1")
        attrs["quantity"] = quantity
        attrs["conversion_factor"] = factor
        attrs["base_quantity"] = decimal_or_zero(attrs.get("base_quantity")) or quantity * factor
        attrs["amount"] = decimal_or_zero(attrs.get("amount")) or (
            quantity * decimal_or_zero(attrs.get("unit_cost", 0))
        )
        return attrs


class PurchaseSerializer(serializers.ModelSerializer):
    items = PurchaseItemSerializer(many=True, required=False)
    document_url = serializers.SerializerMethodField()

    class Meta:
        model = Purchase
        fields = [
            "id",
            "reference_no",
            "supplier_name",
            "supplier_tax_invoice",
            "status",
            "transaction_date",
            "note",
            "document",
            "document_url",
            "vat_mode",
            "total_before_vat",
            "vat_amount",
            "grand_total",
            "items",
        ]
        extra_kwargs = {
            "id": {"required": False},
            "reference_no": {"required": False, "allow_blank": True},
            "supplier_tax_invoice": {"required": False, "allow_blank": True},
            "note": {"required": False, "allow_blank": True},
            "document": {"required": False, "allow_null": True, "write_only": True},
            "vat_mode": {"required": False},
            "total_before_vat": {"required": False},
            "vat_amount": {"required": False},
            "grand_total": {"required": False},
        }

    def get_document_url(self, purchase):
        return build_file_url(self.context.get("request"), purchase.document)

    def _replace_items(self, purchase, items):
        if items is None:
            return

        purchase.items.all().delete()
        for item in items:
            PurchaseItem.objects.create(purchase=purchase, **item)
        if hasattr(purchase, "_prefetched_objects_cache"):
            purchase._prefetched_objects_cache = {}

    def _apply_status_to_items(self, purchase):
        from .services import apply_purchase_status_to_items

        apply_purchase_status_to_items(purchase)

    def create(self, validated_data):
        items = validated_data.pop("items", [])
        purchase = Purchase.objects.create(**validated_data)
        self._replace_items(purchase, items)
        return purchase

    def update(self, instance, validated_data):
        items = validated_data.pop("items", None)
        status_changed = "status" in validated_data

        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        self._replace_items(instance, items)

        if status_changed and items is None:
            self._apply_status_to_items(instance)
            if hasattr(instance, "_prefetched_objects_cache"):
                instance._prefetched_objects_cache = {}

        return instance


class SaleItemSerializer(serializers.ModelSerializer):
    product_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    line_total = serializers.SerializerMethodField()

    class Meta:
        model = SaleItem
        fields = [
            "id",
            "product_id",
            "product_name",
            "sku",
            "item_status",
            "shipped_date",
            "delivered_date",
            "unit",
            "base_unit",
            "conversion_factor",
            "quantity",
            "base_quantity",
            "unit_price",
            "discounts",
            "amount",
            "line_total",
        ]
        extra_kwargs = {
            "id": {"required": False},
            "sku": {"required": False, "allow_blank": True},
            "shipped_date": {"required": False, "allow_null": True},
            "delivered_date": {"required": False, "allow_null": True},
            "unit": {"required": False, "allow_blank": True},
            "base_unit": {"required": False, "allow_blank": True},
            "conversion_factor": {"required": False},
            "quantity": {"required": False},
            "base_quantity": {"required": False},
            "unit_price": {"required": False},
            "discounts": {"required": False},
            "amount": {"required": False},
        }

    def get_line_total(self, item):
        return item.amount

    def validate_product_id(self, value):
        return value or None

    def validate(self, attrs):
        quantity = decimal_or_zero(attrs.get("quantity", 0))
        factor = decimal_or_zero(attrs.get("conversion_factor", 1)) or Decimal("1")
        attrs["quantity"] = quantity
        attrs["conversion_factor"] = factor
        attrs["base_quantity"] = decimal_or_zero(attrs.get("base_quantity")) or quantity * factor
        attrs["amount"] = decimal_or_zero(attrs.get("amount")) or (
            quantity * decimal_or_zero(attrs.get("unit_price", 0))
        )
        return attrs


class SaleSerializer(serializers.ModelSerializer):
    items = SaleItemSerializer(many=True, required=False)
    document_url = serializers.SerializerMethodField()

    class Meta:
        model = Sale
        fields = [
            "id",
            "reference_no",
            "customer_name",
            "status",
            "payment_timing",
            "payment_received_date",
            "transaction_date",
            "note",
            "document",
            "document_url",
            "vat_mode",
            "total_before_vat",
            "vat_amount",
            "grand_total",
            "items",
        ]
        extra_kwargs = {
            "id": {"required": False},
            "reference_no": {"required": False, "allow_blank": True},
            "payment_timing": {"required": False},
            "payment_received_date": {"required": False, "allow_null": True},
            "note": {"required": False, "allow_blank": True},
            "document": {"required": False, "allow_null": True, "write_only": True},
            "vat_mode": {"required": False},
            "total_before_vat": {"required": False},
            "vat_amount": {"required": False},
            "grand_total": {"required": False},
        }

    def get_document_url(self, sale):
        return build_file_url(self.context.get("request"), sale.document)

    def _replace_items(self, sale, items):
        if items is None:
            return

        sale.items.all().delete()
        for item in items:
            SaleItem.objects.create(sale=sale, **item)
        if hasattr(sale, "_prefetched_objects_cache"):
            sale._prefetched_objects_cache = {}

    def _apply_status_to_items(self, sale):
        from .services import apply_sale_status_to_items

        apply_sale_status_to_items(sale)

    def create(self, validated_data):
        items = validated_data.pop("items", [])
        sale = Sale.objects.create(**validated_data)
        self._replace_items(sale, items)
        return sale

    def update(self, instance, validated_data):
        items = validated_data.pop("items", None)
        status_changed = "status" in validated_data

        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        self._replace_items(instance, items)

        if status_changed and items is None:
            self._apply_status_to_items(instance)
            if hasattr(instance, "_prefetched_objects_cache"):
                instance._prefetched_objects_cache = {}

        return instance
