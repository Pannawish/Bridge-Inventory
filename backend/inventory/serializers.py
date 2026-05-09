from decimal import Decimal, InvalidOperation

from django.db import transaction
from rest_framework import serializers

from .models import (
    BillingNote,
    BillingNoteLine,
    Category,
    Customer,
    PaymentBatch,
    PaymentBatchLine,
    Product,
    ProductUnitConversion,
    Purchase,
    PurchaseDocument,
    PurchaseItem,
    Quotation,
    Sale,
    SaleDocument,
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


def decimal_or_none(value):
    if value in ("", None):
        return None

    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        raise serializers.ValidationError("Enter a valid number.")


def resolve_product(product_id=None, sku="", product_name=""):
    product_id = str(product_id or "").strip()
    sku = str(sku or "").strip()
    product_name = str(product_name or "").strip()

    if product_id:
        product = Product.objects.filter(pk=product_id).first()
        if product:
            return product

    if sku:
        product = Product.objects.filter(sku__iexact=sku).first()
        if product:
            return product

    if product_name:
        return Product.objects.filter(product_name__iexact=product_name).first()

    return None


def strip_existing_item_id(item):
    item.pop("id", None)
    return item


def build_file_url(request, file_field):
    if not file_field:
        return ""

    url = file_field.url
    return request.build_absolute_uri(url) if request else url


def build_document_payload(request, document):
    file_name = document.file.name.split("/")[-1] if document.file else "Attached document"
    return {
        "id": document.id,
        "name": file_name,
        "url": build_file_url(request, document.file),
    }


def build_legacy_document_payload(request, file_field):
    file_name = file_field.name.split("/")[-1] if file_field else "Attached document"
    return {
        "id": "__legacy_document__",
        "name": file_name,
        "url": build_file_url(request, file_field),
    }


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
    termType = serializers.CharField(source="term_type", required=False, allow_blank=True)
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
            "termType",
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
            "termType",
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
            "id": {"read_only": True},
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
        product_id_value = attrs.pop("product_id", None)
        attrs["product"] = resolve_product(
            product_id=product_id_value,
            sku=attrs.get("sku", ""),
            product_name=attrs.get("product_name", ""),
        )
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
    documents = serializers.SerializerMethodField()
    uploaded_documents = serializers.ListField(
        child=serializers.FileField(),
        write_only=True,
        required=False,
    )
    remove_document_ids = serializers.ListField(
        child=serializers.CharField(),
        write_only=True,
        required=False,
    )
    remove_document = serializers.BooleanField(write_only=True, required=False, default=False)

    class Meta:
        model = Purchase
        fields = [
            "id",
            "reference_no",
            "supplier_name",
            "supplier_tax_invoice",
            "status",
            "transaction_date",
            "payment_term_type",
            "payment_term_days",
            "payment_date",
            "note",
            "document",
            "document_url",
            "documents",
            "uploaded_documents",
            "remove_document_ids",
            "remove_document",
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
            "payment_term_type": {"required": False, "allow_blank": True},
            "payment_term_days": {"required": False, "allow_blank": True},
            "payment_date": {"required": False, "allow_null": True},
            "note": {"required": False, "allow_blank": True},
            "document": {"required": False, "allow_null": True, "write_only": True},
            "vat_mode": {"required": False},
            "total_before_vat": {"required": False},
            "vat_amount": {"required": False},
            "grand_total": {"required": False},
        }

    def get_document_url(self, purchase):
        first_document = purchase.documents.first()
        if first_document:
            return build_file_url(self.context.get("request"), first_document.file)

        return build_file_url(self.context.get("request"), purchase.document)

    def get_documents(self, purchase):
        request = self.context.get("request")
        documents = [
            build_document_payload(request, document)
            for document in purchase.documents.all()
        ]

        if purchase.document:
            documents.insert(0, build_legacy_document_payload(request, purchase.document))

        return documents

    def _add_documents(self, purchase, documents):
        for document in documents:
            PurchaseDocument.objects.create(purchase=purchase, file=document)

    def _remove_documents(self, purchase, document_ids):
        ids = {str(document_id) for document_id in document_ids or []}

        if "__legacy_document__" in ids and purchase.document:
            purchase.document.delete(save=False)
            purchase.document = None
            purchase.save(update_fields=["document", "updated_at"])

        for document in purchase.documents.filter(id__in=ids):
            document.file.delete(save=False)
            document.delete()

    def _replace_items(self, purchase, items):
        if items is None:
            return

        purchase.items.all().delete()
        for item in items:
            item = strip_existing_item_id(item)
            PurchaseItem.objects.create(purchase=purchase, **item)
        if hasattr(purchase, "_prefetched_objects_cache"):
            purchase._prefetched_objects_cache = {}

    def _apply_status_to_items(self, purchase):
        from .services import apply_purchase_status_to_items

        apply_purchase_status_to_items(purchase)

    def create(self, validated_data):
        items = validated_data.pop("items", [])
        legacy_document = validated_data.pop("document", None)
        uploaded_documents = validated_data.pop("uploaded_documents", [])
        validated_data.pop("remove_document_ids", None)
        validated_data.pop("remove_document", None)
        with transaction.atomic():
            purchase = Purchase.objects.create(**validated_data)
            self._add_documents(
                purchase,
                [document for document in [legacy_document, *uploaded_documents] if document],
            )
            self._replace_items(purchase, items)
        return purchase

    def update(self, instance, validated_data):
        items = validated_data.pop("items", None)
        legacy_document = validated_data.pop("document", None)
        uploaded_documents = validated_data.pop("uploaded_documents", [])
        remove_document_ids = validated_data.pop("remove_document_ids", [])
        remove_document = validated_data.pop("remove_document", False)
        status_changed = "status" in validated_data

        with transaction.atomic():
            if remove_document:
                for document in instance.documents.all():
                    document.file.delete(save=False)
                    document.delete()
                if instance.document:
                    instance.document.delete(save=False)
                    instance.document = None

            self._remove_documents(instance, remove_document_ids)

            if legacy_document:
                self._add_documents(instance, [legacy_document])
            self._add_documents(instance, uploaded_documents)

            if instance.document and instance.documents.exists():
                instance.document.delete(save=False)
                instance.document = None

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
            "id": {"read_only": True},
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
        product_id_value = attrs.pop("product_id", None)
        attrs["product"] = resolve_product(
            product_id=product_id_value,
            sku=attrs.get("sku", ""),
            product_name=attrs.get("product_name", ""),
        )
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
    documents = serializers.SerializerMethodField()
    uploaded_documents = serializers.ListField(
        child=serializers.FileField(),
        write_only=True,
        required=False,
    )
    remove_document_ids = serializers.ListField(
        child=serializers.CharField(),
        write_only=True,
        required=False,
    )
    remove_document = serializers.BooleanField(write_only=True, required=False, default=False)

    class Meta:
        model = Sale
        fields = [
            "id",
            "reference_no",
            "customer_name",
            "status",
            "payment_term_type",
            "payment_term_days",
            "payment_date",
            "transaction_date",
            "note",
            "document",
            "document_url",
            "documents",
            "uploaded_documents",
            "remove_document_ids",
            "remove_document",
            "vat_mode",
            "total_before_vat",
            "vat_amount",
            "grand_total",
            "items",
        ]
        extra_kwargs = {
            "id": {"required": False},
            "reference_no": {"required": False, "allow_blank": True},
            "payment_term_type": {"required": False, "allow_blank": True},
            "payment_term_days": {"required": False, "allow_blank": True},
            "payment_date": {"required": False, "allow_null": True},
            "note": {"required": False, "allow_blank": True},
            "document": {"required": False, "allow_null": True, "write_only": True},
            "vat_mode": {"required": False},
            "total_before_vat": {"required": False},
            "vat_amount": {"required": False},
            "grand_total": {"required": False},
        }

    def get_document_url(self, sale):
        first_document = sale.documents.first()
        if first_document:
            return build_file_url(self.context.get("request"), first_document.file)

        return build_file_url(self.context.get("request"), sale.document)

    def get_documents(self, sale):
        request = self.context.get("request")
        documents = [
            build_document_payload(request, document)
            for document in sale.documents.all()
        ]

        if sale.document:
            documents.insert(0, build_legacy_document_payload(request, sale.document))

        return documents

    def _add_documents(self, sale, documents):
        for document in documents:
            SaleDocument.objects.create(sale=sale, file=document)

    def _remove_documents(self, sale, document_ids):
        ids = {str(document_id) for document_id in document_ids or []}

        if "__legacy_document__" in ids and sale.document:
            sale.document.delete(save=False)
            sale.document = None
            sale.save(update_fields=["document", "updated_at"])

        for document in sale.documents.filter(id__in=ids):
            document.file.delete(save=False)
            document.delete()

    def _replace_items(self, sale, items):
        if items is None:
            return

        sale.items.all().delete()
        for item in items:
            item = strip_existing_item_id(item)
            SaleItem.objects.create(sale=sale, **item)
        if hasattr(sale, "_prefetched_objects_cache"):
            sale._prefetched_objects_cache = {}

    def _apply_status_to_items(self, sale):
        from .services import apply_sale_status_to_items

        apply_sale_status_to_items(sale)

    def create(self, validated_data):
        items = validated_data.pop("items", [])
        legacy_document = validated_data.pop("document", None)
        uploaded_documents = validated_data.pop("uploaded_documents", [])
        validated_data.pop("remove_document_ids", None)
        validated_data.pop("remove_document", None)
        with transaction.atomic():
            sale = Sale.objects.create(**validated_data)
            self._add_documents(
                sale,
                [document for document in [legacy_document, *uploaded_documents] if document],
            )
            self._replace_items(sale, items)
        return sale

    def update(self, instance, validated_data):
        items = validated_data.pop("items", None)
        legacy_document = validated_data.pop("document", None)
        uploaded_documents = validated_data.pop("uploaded_documents", [])
        remove_document_ids = validated_data.pop("remove_document_ids", [])
        remove_document = validated_data.pop("remove_document", False)
        status_changed = "status" in validated_data

        with transaction.atomic():
            if remove_document:
                for document in instance.documents.all():
                    document.file.delete(save=False)
                    document.delete()
                if instance.document:
                    instance.document.delete(save=False)
                    instance.document = None

            self._remove_documents(instance, remove_document_ids)

            if legacy_document:
                self._add_documents(instance, [legacy_document])
            self._add_documents(instance, uploaded_documents)

            if instance.document and instance.documents.exists():
                instance.document.delete(save=False)
                instance.document = None

            for field, value in validated_data.items():
                setattr(instance, field, value)
            instance.save()
            self._replace_items(instance, items)

            if status_changed and items is None:
                self._apply_status_to_items(instance)
                if hasattr(instance, "_prefetched_objects_cache"):
                    instance._prefetched_objects_cache = {}

        return instance


class QuotationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Quotation
        fields = [
            "id",
            "reference_no",
            "quotation_date",
            "valid_until_date",
            "customer_name",
            "supplier_name",
            "vat_mode",
            "note",
            "items",
            "total_before_vat",
            "vat_amount",
            "grand_total",
        ]
        extra_kwargs = {
            "id": {"required": False},
            "reference_no": {"required": False, "allow_blank": True},
            "valid_until_date": {"required": False, "allow_null": True},
            "customer_name": {"required": False, "allow_blank": True},
            "supplier_name": {"required": False, "allow_blank": True},
            "vat_mode": {"required": False},
            "note": {"required": False, "allow_blank": True},
            "items": {"required": False},
            "total_before_vat": {"required": False},
            "vat_amount": {"required": False},
            "grand_total": {"required": False},
        }

    def validate_items(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Items must be a list.")

        normalized_items = []
        for index, item in enumerate(value, start=1):
            if not isinstance(item, dict):
                raise serializers.ValidationError(f"Item {index} must be an object.")

            product_id = str(item.get("product_id") or item.get("productId") or "").strip()
            product_name = str(
                item.get("product_name") or item.get("productName") or item.get("name") or ""
            ).strip()
            sku = str(item.get("sku") or item.get("SKU") or "").strip()

            if not (product_id or product_name or sku):
                raise serializers.ValidationError(f"Item {index} requires a product.")

            quantity = decimal_or_none(item.get("quantity"))
            if quantity is None or quantity <= 0:
                raise serializers.ValidationError(f"Item {index} requires a quantity greater than 0.")

            sale_price = decimal_or_none(item.get("sale_price"))
            if sale_price is None or sale_price < 0:
                raise serializers.ValidationError(f"Item {index} requires a sale price.")

            cost_price = decimal_or_none(item.get("cost_price"))
            if cost_price is not None and cost_price < 0:
                raise serializers.ValidationError(f"Item {index} cost price cannot be negative.")

            raw_discounts = item.get("discounts")
            if not isinstance(raw_discounts, list):
                raw_discounts = [item.get("discount", 0)]

            discounts = []
            for discount in raw_discounts:
                discount_value = decimal_or_none(discount) or Decimal("0")
                if discount_value < 0 or discount_value > 100:
                    raise serializers.ValidationError(
                        f"Item {index} discounts must be between 0 and 100."
                    )
                discounts.append(str(discount_value))

            normalized_item = {
                **item,
                "product_id": product_id,
                "product_name": product_name,
                "sku": sku,
                "unit": str(item.get("unit") or "pcs").strip() or "pcs",
                "quantity": str(quantity),
                "sale_price": str(sale_price),
                "cost_price": "" if cost_price is None else str(cost_price),
                "discounts": discounts or ["0"],
            }
            normalized_items.append(normalized_item)

        return normalized_items

    def validate(self, attrs):
        quotation_date = attrs.get("quotation_date", getattr(self.instance, "quotation_date", None))
        valid_until_date = attrs.get(
            "valid_until_date",
            getattr(self.instance, "valid_until_date", None),
        )

        if valid_until_date and quotation_date and valid_until_date < quotation_date:
            raise serializers.ValidationError(
                {"valid_until_date": "Valid until date cannot be before quotation date."}
            )

        if self.instance is None and not attrs.get("items"):
            raise serializers.ValidationError({"items": "Add at least one quotation item."})

        return attrs


def compute_billing_note_status(lines):
    if not lines:
        return BillingNote.STATUS_ISSUED

    received_count = sum(1 for line in lines if line.get("received"))

    if received_count == 0:
        return BillingNote.STATUS_ISSUED

    if received_count == len(lines):
        return BillingNote.STATUS_FULLY_RECEIVED

    return BillingNote.STATUS_PARTIALLY_RECEIVED


def compute_payment_batch_status(lines):
    if not lines:
        return PaymentBatch.STATUS_SCHEDULED

    paid_count = sum(1 for line in lines if line.get("paid"))

    if paid_count == 0:
        return PaymentBatch.STATUS_SCHEDULED

    if paid_count == len(lines):
        return PaymentBatch.STATUS_PAID

    return PaymentBatch.STATUS_PARTIALLY_PAID


class BillingNoteLineSerializer(serializers.ModelSerializer):
    sale_id = serializers.CharField(source="sale.id", read_only=True)
    sale_reference_no = serializers.CharField(source="sale.reference_no", read_only=True)
    sale_transaction_date = serializers.DateField(source="sale.transaction_date", read_only=True)
    sale_status = serializers.CharField(source="sale.status", read_only=True)
    sale_grand_total = serializers.DecimalField(
        source="sale.grand_total",
        max_digits=14,
        decimal_places=2,
        read_only=True,
    )
    sale_payment_term_type = serializers.CharField(
        source="sale.payment_term_type",
        read_only=True,
    )
    sale_payment_term_days = serializers.CharField(
        source="sale.payment_term_days",
        read_only=True,
    )
    sale_payment_date = serializers.DateField(source="sale.payment_date", read_only=True)

    class Meta:
        model = BillingNoteLine
        fields = [
            "id",
            "sale",
            "sale_id",
            "sale_reference_no",
            "sale_transaction_date",
            "sale_status",
            "sale_grand_total",
            "sale_payment_term_type",
            "sale_payment_term_days",
            "sale_payment_date",
            "received",
            "received_date",
            "amount",
        ]
        extra_kwargs = {
            "id": {"read_only": True},
            "sale": {"required": True, "write_only": False},
            "received": {"required": False},
            "received_date": {"required": False, "allow_null": True},
            "amount": {"required": False},
        }


class BillingNoteSerializer(serializers.ModelSerializer):
    lines = BillingNoteLineSerializer(many=True, required=False)

    class Meta:
        model = BillingNote
        fields = [
            "id",
            "reference_no",
            "customer_name",
            "billing_note_date",
            "expected_payment_date",
            "actual_payment_date",
            "status",
            "bank_reference",
            "note",
            "total_amount",
            "lines",
            "created_at",
            "updated_at",
        ]
        extra_kwargs = {
            "id": {"required": False},
            "reference_no": {"required": False, "allow_blank": True},
            "expected_payment_date": {"required": False, "allow_null": True},
            "actual_payment_date": {"required": False, "allow_null": True},
            "bank_reference": {"required": False, "allow_blank": True},
            "note": {"required": False, "allow_blank": True},
            "status": {"required": False},
            "total_amount": {"required": False},
            "created_at": {"read_only": True},
            "updated_at": {"read_only": True},
        }

    def _validate_lines_for_customer(self, customer_name, lines):
        sale_ids = [line["sale"].id if hasattr(line["sale"], "id") else line["sale"] for line in lines]
        sales = Sale.objects.filter(pk__in=sale_ids)
        sale_map = {sale.id: sale for sale in sales}

        for line in lines:
            sale_obj = line["sale"] if hasattr(line["sale"], "id") else sale_map.get(line["sale"])

            if sale_obj is None:
                raise serializers.ValidationError({"lines": "Each line must reference an existing sale."})

            if sale_obj.customer_name != customer_name:
                raise serializers.ValidationError(
                    {"lines": "All sales in a billing note must belong to the same customer."}
                )

    def _check_unique_active_sales(self, lines, current_billing_note_id=None):
        sale_ids = [
            line["sale"].id if hasattr(line["sale"], "id") else line["sale"]
            for line in lines
        ]
        if not sale_ids:
            return

        active_filter = BillingNoteLine.objects.filter(
            sale_id__in=sale_ids,
        ).exclude(billing_note__status=BillingNote.STATUS_CANCELLED)

        if current_billing_note_id:
            active_filter = active_filter.exclude(billing_note_id=current_billing_note_id)

        existing = active_filter.values_list("sale_id", flat=True).distinct()

        if existing:
            ids = ", ".join(sorted(set(existing)))
            raise serializers.ValidationError(
                {"lines": f"These sales are already in another active billing note: {ids}."}
            )

    def _replace_lines(self, billing_note, lines):
        billing_note.lines.all().delete()
        rows = []
        total = Decimal("0")
        for line in lines:
            sale_obj = line["sale"]
            amount = decimal_or_zero(line.get("amount"))
            if amount == 0:
                amount = decimal_or_zero(getattr(sale_obj, "grand_total", 0))
            received = bool(line.get("received", False))
            received_date = line.get("received_date") or None
            rows.append(
                BillingNoteLine(
                    billing_note=billing_note,
                    sale=sale_obj,
                    received=received,
                    received_date=received_date,
                    amount=amount,
                )
            )
            total += amount

        BillingNoteLine.objects.bulk_create(rows)
        billing_note.total_amount = total
        billing_note.save(update_fields=["total_amount", "updated_at"])
        return rows

    def _recompute_status_and_dates(self, billing_note):
        line_objs = list(billing_note.lines.all())
        line_dicts = [
            {"received": line.received, "received_date": line.received_date}
            for line in line_objs
        ]
        billing_note.status = compute_billing_note_status(line_dicts)

        received_dates = [line.received_date for line in line_objs if line.received and line.received_date]
        billing_note.actual_payment_date = max(received_dates) if received_dates else None
        billing_note.save(update_fields=["status", "actual_payment_date", "updated_at"])

    def create(self, validated_data):
        lines_data = validated_data.pop("lines", [])
        if not lines_data:
            raise serializers.ValidationError({"lines": "Add at least one sale to the billing note."})

        customer_name = validated_data.get("customer_name", "")
        if not customer_name:
            raise serializers.ValidationError({"customer_name": "Customer is required."})

        self._validate_lines_for_customer(customer_name, lines_data)
        self._check_unique_active_sales(lines_data)

        with transaction.atomic():
            billing_note = BillingNote.objects.create(**validated_data)
            self._replace_lines(billing_note, lines_data)
            self._recompute_status_and_dates(billing_note)
        return billing_note

    def update(self, instance, validated_data):
        lines_data = validated_data.pop("lines", None)
        with transaction.atomic():
            for field, value in validated_data.items():
                setattr(instance, field, value)
            instance.save()

            if lines_data is not None:
                if not lines_data:
                    raise serializers.ValidationError(
                        {"lines": "A billing note must contain at least one sale."}
                    )
                self._validate_lines_for_customer(instance.customer_name, lines_data)
                self._check_unique_active_sales(lines_data, current_billing_note_id=instance.id)
                self._replace_lines(instance, lines_data)

            if validated_data.get("status") != BillingNote.STATUS_CANCELLED:
                self._recompute_status_and_dates(instance)
        return instance


class PaymentBatchLineSerializer(serializers.ModelSerializer):
    purchase_id = serializers.CharField(source="purchase.id", read_only=True)
    purchase_reference_no = serializers.CharField(source="purchase.reference_no", read_only=True)
    purchase_transaction_date = serializers.DateField(
        source="purchase.transaction_date",
        read_only=True,
    )
    purchase_status = serializers.CharField(source="purchase.status", read_only=True)
    purchase_grand_total = serializers.DecimalField(
        source="purchase.grand_total",
        max_digits=14,
        decimal_places=2,
        read_only=True,
    )
    purchase_payment_term_type = serializers.CharField(
        source="purchase.payment_term_type",
        read_only=True,
    )
    purchase_payment_term_days = serializers.CharField(
        source="purchase.payment_term_days",
        read_only=True,
    )
    purchase_payment_date = serializers.DateField(
        source="purchase.payment_date",
        read_only=True,
    )

    class Meta:
        model = PaymentBatchLine
        fields = [
            "id",
            "purchase",
            "purchase_id",
            "purchase_reference_no",
            "purchase_transaction_date",
            "purchase_status",
            "purchase_grand_total",
            "purchase_payment_term_type",
            "purchase_payment_term_days",
            "purchase_payment_date",
            "paid",
            "paid_date",
            "amount",
        ]
        extra_kwargs = {
            "id": {"read_only": True},
            "purchase": {"required": True, "write_only": False},
            "paid": {"required": False},
            "paid_date": {"required": False, "allow_null": True},
            "amount": {"required": False},
        }


class PaymentBatchSerializer(serializers.ModelSerializer):
    lines = PaymentBatchLineSerializer(many=True, required=False)

    class Meta:
        model = PaymentBatch
        fields = [
            "id",
            "reference_no",
            "supplier_name",
            "batch_date",
            "planned_payment_date",
            "actual_payment_date",
            "status",
            "bank_reference",
            "note",
            "total_amount",
            "lines",
            "created_at",
            "updated_at",
        ]
        extra_kwargs = {
            "id": {"required": False},
            "reference_no": {"required": False, "allow_blank": True},
            "planned_payment_date": {"required": False, "allow_null": True},
            "actual_payment_date": {"required": False, "allow_null": True},
            "bank_reference": {"required": False, "allow_blank": True},
            "note": {"required": False, "allow_blank": True},
            "status": {"required": False},
            "total_amount": {"required": False},
            "created_at": {"read_only": True},
            "updated_at": {"read_only": True},
        }

    def _validate_lines_for_supplier(self, supplier_name, lines):
        purchase_ids = [
            line["purchase"].id if hasattr(line["purchase"], "id") else line["purchase"]
            for line in lines
        ]
        purchases = Purchase.objects.filter(pk__in=purchase_ids)
        purchase_map = {purchase.id: purchase for purchase in purchases}

        for line in lines:
            purchase_obj = (
                line["purchase"]
                if hasattr(line["purchase"], "id")
                else purchase_map.get(line["purchase"])
            )

            if purchase_obj is None:
                raise serializers.ValidationError(
                    {"lines": "Each line must reference an existing purchase."}
                )

            if purchase_obj.supplier_name != supplier_name:
                raise serializers.ValidationError(
                    {"lines": "All purchases in a payment batch must belong to the same supplier."}
                )

    def _check_unique_active_purchases(self, lines, current_payment_batch_id=None):
        purchase_ids = [
            line["purchase"].id if hasattr(line["purchase"], "id") else line["purchase"]
            for line in lines
        ]
        if not purchase_ids:
            return

        active_filter = PaymentBatchLine.objects.filter(
            purchase_id__in=purchase_ids,
        ).exclude(payment_batch__status=PaymentBatch.STATUS_CANCELLED)

        if current_payment_batch_id:
            active_filter = active_filter.exclude(payment_batch_id=current_payment_batch_id)

        existing = active_filter.values_list("purchase_id", flat=True).distinct()

        if existing:
            ids = ", ".join(sorted(set(existing)))
            raise serializers.ValidationError(
                {"lines": f"These purchases are already in another active payment batch: {ids}."}
            )

    def _replace_lines(self, payment_batch, lines):
        payment_batch.lines.all().delete()
        rows = []
        total = Decimal("0")
        for line in lines:
            purchase_obj = line["purchase"]
            amount = decimal_or_zero(line.get("amount"))
            if amount == 0:
                amount = decimal_or_zero(getattr(purchase_obj, "grand_total", 0))
            paid = bool(line.get("paid", False))
            paid_date = line.get("paid_date") or None
            rows.append(
                PaymentBatchLine(
                    payment_batch=payment_batch,
                    purchase=purchase_obj,
                    paid=paid,
                    paid_date=paid_date,
                    amount=amount,
                )
            )
            total += amount

        PaymentBatchLine.objects.bulk_create(rows)
        payment_batch.total_amount = total
        payment_batch.save(update_fields=["total_amount", "updated_at"])
        return rows

    def _recompute_status_and_dates(self, payment_batch):
        line_objs = list(payment_batch.lines.all())
        line_dicts = [{"paid": line.paid, "paid_date": line.paid_date} for line in line_objs]
        payment_batch.status = compute_payment_batch_status(line_dicts)

        paid_dates = [line.paid_date for line in line_objs if line.paid and line.paid_date]
        payment_batch.actual_payment_date = max(paid_dates) if paid_dates else None
        payment_batch.save(update_fields=["status", "actual_payment_date", "updated_at"])

    def create(self, validated_data):
        lines_data = validated_data.pop("lines", [])
        if not lines_data:
            raise serializers.ValidationError(
                {"lines": "Add at least one purchase to the payment batch."}
            )

        supplier_name = validated_data.get("supplier_name", "")
        if not supplier_name:
            raise serializers.ValidationError({"supplier_name": "Supplier is required."})

        self._validate_lines_for_supplier(supplier_name, lines_data)
        self._check_unique_active_purchases(lines_data)

        with transaction.atomic():
            payment_batch = PaymentBatch.objects.create(**validated_data)
            self._replace_lines(payment_batch, lines_data)
            self._recompute_status_and_dates(payment_batch)
        return payment_batch

    def update(self, instance, validated_data):
        lines_data = validated_data.pop("lines", None)
        with transaction.atomic():
            for field, value in validated_data.items():
                setattr(instance, field, value)
            instance.save()

            if lines_data is not None:
                if not lines_data:
                    raise serializers.ValidationError(
                        {"lines": "A payment batch must contain at least one purchase."}
                    )
                self._validate_lines_for_supplier(instance.supplier_name, lines_data)
                self._check_unique_active_purchases(lines_data, current_payment_batch_id=instance.id)
                self._replace_lines(instance, lines_data)

            if validated_data.get("status") != PaymentBatch.STATUS_CANCELLED:
                self._recompute_status_and_dates(instance)
        return instance
