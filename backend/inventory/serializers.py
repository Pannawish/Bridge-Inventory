import datetime
from decimal import Decimal, InvalidOperation

from django.db import transaction
from rest_framework import serializers

from .models import (
    BillingNote,
    BillingNoteLine,
    Category,
    CreditNote,
    CreditNoteLine,
    Customer,
    PaymentBatch,
    PaymentBatchLine,
    Product,
    ProductPicture,
    ProductUnitConversion,
    Purchase,
    PurchaseDocument,
    PurchaseItem,
    Quotation,
    QuotationItem,
    QuotationItemSupplier,
    Sale,
    SaleDocument,
    SaleItem,
    Supplier,
)


def _add_business_days(start_date, days):
    current = start_date
    added = 0
    while added < days:
        current += datetime.timedelta(days=1)
        if current.weekday() < 5:  # Monday=0 … Friday=4
            added += 1
    return current


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


def validate_percentage_discount(value, label):
    discount = decimal_or_none(value) or Decimal("0")

    if discount < 0 or discount > 100:
        raise serializers.ValidationError(f"{label} must be between 0 and 100.")

    return discount


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


def validate_active_products_for_create(items, label):
    inactive_products = []

    for item in items or []:
        product = item.get("product") if isinstance(item, dict) else getattr(item, "product", None)
        if product is None and isinstance(item, dict):
            product = resolve_product(
                product_id=item.get("product_id") or item.get("productId"),
                sku=item.get("sku", ""),
                product_name=item.get("product_name")
                or item.get("productName")
                or item.get("name")
                or "",
            )

        if product is not None and not product.is_active:
            inactive_products.append(product.product_name or product.sku or product.id)

    if inactive_products:
        product_list = ", ".join(inactive_products)
        raise serializers.ValidationError(
            {"items": f"Disabled products cannot be used in new {label}: {product_list}."}
        )


def resolve_supplier(supplier_id=None, supplier_name=""):
    supplier_id = str(supplier_id or "").strip()
    supplier_name = str(supplier_name or "").strip()

    if supplier_id:
        supplier = Supplier.objects.filter(pk=supplier_id).first()
        if supplier:
            return supplier

    if supplier_name:
        return Supplier.objects.filter(company_name__iexact=supplier_name).first()

    return None


def resolve_customer(customer_id=None, customer_name=""):
    customer_id = str(customer_id or "").strip()
    customer_name = str(customer_name or "").strip()

    if customer_id:
        customer = Customer.objects.filter(pk=customer_id).first()
        if customer:
            return customer

    if customer_name:
        return Customer.objects.filter(company_name__iexact=customer_name).first()

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


def build_product_picture_payload(request, picture, selected_picture):
    file_name = picture.file.name.split("/")[-1] if picture.file else "Product picture"
    return {
        "id": picture.id,
        "name": file_name,
        "url": build_file_url(request, picture.file),
        "isSelected": picture.id == getattr(selected_picture, "id", None),
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
    procurementName = serializers.CharField(
        source="procurement_name",
        required=False,
        allow_blank=True,
    )
    procurementTel = serializers.CharField(
        source="procurement_tel",
        required=False,
        allow_blank=True,
    )

    class Meta:
        model = Supplier
        fields = [
            "id",
            "companyName",
            "procurementName",
            "procurementTel",
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
    isActive = serializers.BooleanField(source="is_active", required=False)
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
    productPictures = serializers.SerializerMethodField()
    selectedPictureId = serializers.SerializerMethodField()
    uploaded_pictures = serializers.ListField(
        child=serializers.FileField(),
        write_only=True,
        required=False,
    )
    remove_picture_ids = serializers.ListField(
        child=serializers.CharField(),
        write_only=True,
        required=False,
    )
    selected_picture_id = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        allow_null=True,
    )
    selected_picture_index = serializers.IntegerField(
        write_only=True,
        required=False,
        allow_null=True,
        min_value=0,
    )
    current_stock = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id",
            "productDisplayId",
            "isActive",
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
            "productPictures",
            "selectedPictureId",
            "uploaded_pictures",
            "remove_picture_ids",
            "selected_picture_id",
            "selected_picture_index",
            "reorder_level",
            "current_stock",
        ]
        extra_kwargs = {
            "id": {"required": False},
            "sku": {"allow_blank": False},
            "detail": {"required": False, "allow_blank": True},
            "reorder_level": {"required": False},
        }

    def get_selected_picture(self, product):
        pictures = list(product.pictures.all())
        if not pictures:
            return None

        return next((picture for picture in pictures if picture.is_selected), pictures[0])

    def get_productPictures(self, product):
        selected_picture = self.get_selected_picture(product)
        request = self.context.get("request")
        return [
            build_product_picture_payload(request, picture, selected_picture)
            for picture in product.pictures.all()
        ]

    def get_selectedPictureId(self, product):
        selected_picture = self.get_selected_picture(product)
        return selected_picture.id if selected_picture else ""

    def get_current_stock(self, product):
        from .services import get_available_stock_by_product_id

        stock_by_product_id = self.context.get("current_stock_by_product_id")
        if stock_by_product_id is None:
            stock_by_product_id = get_available_stock_by_product_id()
            self.context["current_stock_by_product_id"] = stock_by_product_id

        return stock_by_product_id.get(product.id, Decimal("0"))

    def validate_previousSkus(self, value):
        return clean_list(value)

    def validate_subNames(self, value):
        return clean_list(value)

    def validate_categoryId(self, value):
        return value or None

    def validate_uploaded_pictures(self, value):
        for picture in value:
            content_type = getattr(picture, "content_type", "")
            if not content_type.startswith("image/"):
                raise serializers.ValidationError("Product pictures must be image files.")

        return value

    def _add_pictures(self, product, pictures):
        created_pictures = []
        for picture in pictures:
            created_pictures.append(ProductPicture.objects.create(product=product, file=picture))
        return created_pictures

    def _remove_pictures(self, product, picture_ids):
        ids = {str(picture_id) for picture_id in picture_ids or []}
        if not ids:
            return

        for picture in product.pictures.filter(id__in=ids):
            picture.file.delete(save=False)
            picture.delete()

    def _select_picture(
        self,
        product,
        selected_picture_id=None,
        selected_picture_index=None,
        created_pictures=None,
    ):
        selected_picture = None
        selected_picture_id = str(selected_picture_id or "").strip()
        created_pictures = created_pictures or []

        if selected_picture_id:
            selected_picture = product.pictures.filter(id=selected_picture_id).first()
        elif selected_picture_index is not None and selected_picture_index < len(created_pictures):
            selected_picture = created_pictures[selected_picture_index]

        if selected_picture:
            product.pictures.update(is_selected=False)
            ProductPicture.objects.filter(id=selected_picture.id).update(is_selected=True)
        elif not product.pictures.filter(is_selected=True).exists():
            first_picture = product.pictures.first()
            if first_picture:
                ProductPicture.objects.filter(id=first_picture.id).update(is_selected=True)

        if hasattr(product, "_prefetched_objects_cache"):
            product._prefetched_objects_cache = {}

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
        uploaded_pictures = validated_data.pop("uploaded_pictures", [])
        selected_picture_id = validated_data.pop("selected_picture_id", "")
        selected_picture_index = validated_data.pop("selected_picture_index", None)
        validated_data.pop("remove_picture_ids", None)
        with transaction.atomic():
            product = Product.objects.create(**validated_data)
            created_pictures = self._add_pictures(product, uploaded_pictures)
            self._select_picture(product, selected_picture_id, selected_picture_index, created_pictures)
            self._replace_unit_conversions(product, unit_conversions)
        return product

    def update(self, instance, validated_data):
        unit_conversions = validated_data.pop("unit_conversions", None)
        uploaded_pictures = validated_data.pop("uploaded_pictures", [])
        remove_picture_ids = validated_data.pop("remove_picture_ids", [])
        selected_picture_id = validated_data.pop("selected_picture_id", "")
        selected_picture_index = validated_data.pop("selected_picture_index", None)
        with transaction.atomic():
            self._remove_pictures(instance, remove_picture_ids)
            created_pictures = self._add_pictures(instance, uploaded_pictures)
            for field, value in validated_data.items():
                setattr(instance, field, value)
            instance.save()
            self._select_picture(
                instance,
                selected_picture_id,
                selected_picture_index,
                created_pictures,
            )
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
    supplier_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
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
    source_quotation_id = serializers.CharField(
        required=False, allow_blank=True, allow_null=True
    )
    source_quotation_reference_no = serializers.SerializerMethodField()
    payment_batch_links = serializers.SerializerMethodField()

    class Meta:
        model = Purchase
        fields = [
            "id",
            "reference_no",
            "supplier_id",
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
            "bill_discount",
            "total_before_vat",
            "vat_amount",
            "grand_total",
            "items",
            "source_quotation_id",
            "source_quotation_reference_no",
            "payment_batch_links",
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
            "bill_discount": {"required": False},
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

    def get_source_quotation_reference_no(self, purchase):
        if not purchase.source_quotation_id:
            return ""
        return purchase.source_quotation.reference_no or ""

    def get_payment_batch_links(self, purchase):
        seen = set()
        links = []
        for line in purchase.payment_batch_lines.all():
            batch = line.payment_batch
            if batch.status == PaymentBatch.STATUS_CANCELLED:
                continue
            if batch.id not in seen:
                seen.add(batch.id)
                links.append({"id": batch.id, "reference_no": batch.reference_no or ""})
        return links

    def validate_bill_discount(self, value):
        return validate_percentage_discount(value, "Bill discount")

    def validate(self, attrs):
        from .services import normalize_purchase_items_for_status

        supplier_id_value = attrs.pop("supplier_id", None)
        should_resolve_supplier = (
            supplier_id_value is not None
            or "supplier_name" in attrs
            or self.instance is None
        )

        if should_resolve_supplier:
            attrs["supplier"] = resolve_supplier(
                supplier_id=supplier_id_value,
                supplier_name=attrs.get(
                    "supplier_name",
                    getattr(self.instance, "supplier_name", ""),
                ),
            )

        source_quotation_id_value = attrs.pop("source_quotation_id", None)
        if source_quotation_id_value:
            try:
                from .models import Quotation
                attrs["source_quotation"] = Quotation.objects.get(pk=source_quotation_id_value)
            except Quotation.DoesNotExist:
                attrs["source_quotation"] = None
        elif source_quotation_id_value is not None:
            attrs["source_quotation"] = None

        purchase_status = attrs.get(
            "status",
            getattr(self.instance, "status", Purchase.STATUS_ORDERED),
        )
        items_submitted = "items" in attrs
        if self.instance is None:
            validate_active_products_for_create(attrs.get("items") or [], "purchase")

        if items_submitted:
            purchase_status = normalize_purchase_items_for_status(
                attrs.get("items") or [],
                purchase_status,
            )
            attrs["status"] = purchase_status

        return attrs

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
    supplier_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    line_total = serializers.SerializerMethodField()

    class Meta:
        model = SaleItem
        fields = [
            "id",
            "product_id",
            "product_name",
            "sku",
            "supplier_id",
            "supplier_name",
            "unit_cost",
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
            "supplier_name": {"required": False, "allow_blank": True},
            "unit_cost": {"required": False},
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
        supplier_id_value = attrs.pop("supplier_id", None)
        attrs["supplier"] = resolve_supplier(
            supplier_id=supplier_id_value,
            supplier_name=attrs.get("supplier_name", ""),
        )
        attrs["unit_cost"] = decimal_or_zero(attrs.get("unit_cost"))
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
    customer_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
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
    source_quotation_id = serializers.CharField(
        required=False, allow_blank=True, allow_null=True
    )
    source_quotation_reference_no = serializers.SerializerMethodField()
    billing_note_links = serializers.SerializerMethodField()
    credit_note_links = serializers.SerializerMethodField()

    class Meta:
        model = Sale
        fields = [
            "id",
            "reference_no",
            "customer_id",
            "customer_name",
            "customer_po_reference",
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
            "bill_discount",
            "total_before_vat",
            "vat_amount",
            "grand_total",
            "items",
            "source_quotation_id",
            "source_quotation_reference_no",
            "billing_note_links",
            "credit_note_links",
        ]
        extra_kwargs = {
            "id": {"required": False},
            "reference_no": {"required": False, "allow_blank": True},
            "customer_po_reference": {"required": False, "allow_blank": True},
            "payment_term_type": {"required": False, "allow_blank": True},
            "payment_term_days": {"required": False, "allow_blank": True},
            "payment_date": {"required": False, "allow_null": True},
            "note": {"required": False, "allow_blank": True},
            "document": {"required": False, "allow_null": True, "write_only": True},
            "vat_mode": {"required": False},
            "bill_discount": {"required": False},
            "total_before_vat": {"required": False},
            "vat_amount": {"required": False},
            "grand_total": {"required": False},
        }

    def get_document_url(self, sale):
        first_document = sale.documents.first()
        if first_document:
            return build_file_url(self.context.get("request"), first_document.file)

        return build_file_url(self.context.get("request"), sale.document)

    def validate_bill_discount(self, value):
        return validate_percentage_discount(value, "Bill discount")

    def get_documents(self, sale):
        request = self.context.get("request")
        documents = [
            build_document_payload(request, document)
            for document in sale.documents.all()
        ]

        if sale.document:
            documents.insert(0, build_legacy_document_payload(request, sale.document))

        return documents

    def get_source_quotation_reference_no(self, sale):
        if not sale.source_quotation_id:
            return ""
        return sale.source_quotation.reference_no or ""

    def get_billing_note_links(self, sale):
        seen = set()
        links = []
        for line in sale.billing_note_lines.all():
            bn = line.billing_note
            if bn.id not in seen:
                seen.add(bn.id)
                links.append({"id": bn.id, "reference_no": bn.reference_no or ""})
        return links

    def get_credit_note_links(self, sale):
        return [
            {"id": cn.id, "reference_no": cn.reference_no or ""}
            for cn in sale.credit_notes.all()
            if cn.status != "cancelled"
        ]

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

    def validate(self, attrs):
        from .services import (
            SALE_PARTIAL_TRANSACTION_STATUSES,
            get_sale_status_from_items,
            get_sale_stock_issues,
            normalize_sale_items_for_status,
        )

        customer_id_value = attrs.pop("customer_id", None)
        should_resolve_customer = (
            customer_id_value is not None
            or "customer_name" in attrs
            or self.instance is None
        )

        if should_resolve_customer:
            attrs["customer"] = resolve_customer(
                customer_id=customer_id_value,
                customer_name=attrs.get(
                    "customer_name",
                    getattr(self.instance, "customer_name", ""),
                ),
            )

        source_quotation_id_value = attrs.pop("source_quotation_id", None)
        if source_quotation_id_value:
            try:
                from .models import Quotation
                attrs["source_quotation"] = Quotation.objects.get(pk=source_quotation_id_value)
            except Quotation.DoesNotExist:
                attrs["source_quotation"] = None
        elif source_quotation_id_value is not None:
            attrs["source_quotation"] = None

        sale_status = attrs.get("status", getattr(self.instance, "status", Sale.STATUS_DRAFT))
        current_sale_status = getattr(self.instance, "status", Sale.STATUS_DRAFT)
        current_items = (
            list(self.instance.items.select_related("product"))
            if self.instance is not None
            else None
        )
        items_submitted = "items" in attrs
        items = attrs.get("items")
        if items is None:
            items = current_items

        if self.instance is None:
            validate_active_products_for_create(items or [], "sale")

        if items_submitted:
            sale_status = normalize_sale_items_for_status(items or [], sale_status)
            attrs["status"] = sale_status
        elif sale_status in SALE_PARTIAL_TRANSACTION_STATUSES:
            sale_status = get_sale_status_from_items(items or [], fallback_status=sale_status)
            attrs["status"] = sale_status

        issues = get_sale_stock_issues(
            items or [],
            sale_status,
            exclude_sale_id=getattr(self.instance, "id", None),
            current_items=current_items,
            current_sale_status=current_sale_status,
        )
        if issues:
            details = "; ".join(
                (
                    f"{issue['product']} needs {issue['requested']} {issue['unit']}, "
                    f"available {issue['available']} {issue['unit']}"
                ).strip()
                for issue in issues
            )
            raise serializers.ValidationError(
                {"items": f"Insufficient stock for this sale. {details}."}
            )

        return attrs

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
    items = serializers.JSONField(required=False, write_only=True)
    customer_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    supplier_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    derived_purchase_links = serializers.SerializerMethodField()
    derived_sale_links = serializers.SerializerMethodField()

    class Meta:
        model = Quotation
        fields = [
            "id",
            "reference_no",
            "quotation_date",
            "valid_until_date",
            "valid_until_days",
            "valid_until_day_type",
            "customer_id",
            "customer_name",
            "supplier_id",
            "supplier_name",
            "vat_mode",
            "note",
            "items",
            "total_before_vat",
            "vat_amount",
            "grand_total",
            "derived_purchase_links",
            "derived_sale_links",
        ]
        extra_kwargs = {
            "id": {"required": False},
            "reference_no": {"required": False, "allow_blank": True},
            "valid_until_date": {"required": False, "allow_null": True},
            "valid_until_days": {"required": False, "allow_null": True},
            "valid_until_day_type": {"required": False, "allow_blank": True},
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

            raw_supplier_options = item.get("supplier_options")
            if not isinstance(raw_supplier_options, list):
                raw_supplier_options = []

            supplier_options = []
            for option in raw_supplier_options:
                if not isinstance(option, dict):
                    continue
                option_supplier_id = str(
                    option.get("supplier_id") or option.get("supplierId") or ""
                ).strip()
                option_supplier_name = str(
                    option.get("supplier_name") or option.get("supplierName") or ""
                ).strip()
                if not (option_supplier_id or option_supplier_name):
                    continue
                option_cost = decimal_or_none(option.get("cost_price"))
                if option_cost is None or option_cost < 0:
                    raise serializers.ValidationError(
                        f"Item {index} supplier "
                        f"'{option_supplier_name or option_supplier_id}' "
                        "requires a cost price of 0 or more."
                    )
                supplier_options.append(
                    {
                        "supplier_id": option_supplier_id,
                        "supplier_name": option_supplier_name,
                        "cost_price": str(option_cost),
                        "note": str(option.get("note") or "").strip(),
                    }
                )

            normalized_item = {
                **item,
                "product_id": product_id,
                "product_name": product_name,
                "sku": sku,
                "unit": str(item.get("unit") or "pcs").strip() or "pcs",
                "base_unit": str(item.get("base_unit") or item.get("baseUnit") or "pcs").strip()
                or "pcs",
                "conversion_factor": str(
                    decimal_or_none(
                        item.get("conversion_factor", item.get("conversionFactor", 1))
                    )
                    or Decimal("1")
                ),
                "quantity": str(quantity),
                "base_quantity": str(
                    decimal_or_none(item.get("base_quantity", item.get("baseQuantity")))
                    or quantity
                ),
                "sale_price": str(sale_price),
                "cost_price": "" if cost_price is None else str(cost_price),
                "discounts": discounts or ["0"],
                "supplier_options": supplier_options,
            }
            normalized_items.append(normalized_item)

        return normalized_items

    def _compute_discounted_amount(self, quantity, price, discounts):
        amount = decimal_or_zero(quantity) * decimal_or_zero(price)
        for discount in discounts or []:
            discount_value = decimal_or_none(discount) or Decimal("0")
            if discount_value < 0:
                discount_value = Decimal("0")
            if discount_value > 100:
                discount_value = Decimal("100")
            amount *= Decimal("1") - (discount_value / Decimal("100"))
        return amount

    def _serialize_item(self, item):
        discounts = item.discounts or ["0"]
        sale_amount = self._compute_discounted_amount(
            item.quantity,
            item.sale_price,
            discounts,
        )
        cost_amount = (
            Decimal("0")
            if item.cost_price is None
            else self._compute_discounted_amount(item.quantity, item.cost_price, discounts)
        )

        return {
            "id": item.id,
            "line_id": item.id,
            "product_id": item.product_id or "",
            "product_name": item.product_name,
            "sku": item.sku,
            "unit": item.unit,
            "base_unit": item.base_unit,
            "conversion_factor": str(item.conversion_factor),
            "quantity": str(item.quantity),
            "base_quantity": str(item.base_quantity),
            "sale_price": str(item.sale_price),
            "cost_price": "" if item.cost_price is None else str(item.cost_price),
            "discounts": discounts,
            "sale_amount": str(sale_amount),
            "cost_amount": str(cost_amount),
            "supplier_options": [
                {
                    "id": option.id,
                    "supplier_id": option.supplier_id or "",
                    "supplier_name": option.supplier_name,
                    "cost_price": str(option.cost_price),
                    "note": option.note,
                    "position": option.position,
                }
                for option in item.supplier_options.all()
            ],
        }

    def to_representation(self, instance):
        data = super().to_representation(instance)
        line_items = list(instance.line_items.all())
        data["items"] = [self._serialize_item(item) for item in line_items]
        return data

    def get_derived_purchase_links(self, quotation):
        return [
            {"id": p.id, "reference_no": p.reference_no or ""}
            for p in quotation.derived_purchases.all()
        ]

    def get_derived_sale_links(self, quotation):
        return [
            {"id": s.id, "reference_no": s.reference_no or ""}
            for s in quotation.derived_sales.all()
        ]

    def validate(self, attrs):
        customer_id_value = attrs.pop("customer_id", None)
        supplier_id_value = attrs.pop("supplier_id", None)
        should_resolve_customer = (
            customer_id_value is not None
            or "customer_name" in attrs
            or self.instance is None
        )
        should_resolve_supplier = (
            supplier_id_value is not None
            or "supplier_name" in attrs
            or self.instance is None
        )

        if should_resolve_customer:
            attrs["customer"] = resolve_customer(
                customer_id=customer_id_value,
                customer_name=attrs.get(
                    "customer_name",
                    getattr(self.instance, "customer_name", ""),
                ),
            )
        if should_resolve_supplier:
            attrs["supplier"] = resolve_supplier(
                supplier_id=supplier_id_value,
                supplier_name=attrs.get(
                    "supplier_name",
                    getattr(self.instance, "supplier_name", ""),
                ),
            )

        quotation_date = attrs.get("quotation_date", getattr(self.instance, "quotation_date", None))
        valid_until_days = attrs.get("valid_until_days", getattr(self.instance, "valid_until_days", None))
        valid_until_day_type = attrs.get(
            "valid_until_day_type",
            getattr(self.instance, "valid_until_day_type", "calendar"),
        ) or "calendar"

        if valid_until_days is not None and quotation_date:
            if valid_until_day_type == "no_valid_date" or valid_until_days == 0:
                attrs["valid_until_date"] = None
            elif not (1 <= valid_until_days <= 100):
                raise serializers.ValidationError(
                    {"valid_until_days": "Valid until days must be between 1 and 100."}
                )
            elif valid_until_day_type == "business":
                attrs["valid_until_date"] = _add_business_days(quotation_date, valid_until_days)
            else:
                attrs["valid_until_date"] = quotation_date + datetime.timedelta(days=valid_until_days)
        else:
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

        if self.instance is None:
            validate_active_products_for_create(attrs.get("items") or [], "quotation")

        return attrs

    def _replace_items(self, quotation, items):
        if items is None:
            return

        quotation.line_items.all().delete()
        rows = []
        options_by_index = []
        for position, item in enumerate(items):
            product = resolve_product(
                product_id=item.get("product_id"),
                sku=item.get("sku", ""),
                product_name=item.get("product_name", ""),
            )
            quantity = decimal_or_zero(item.get("quantity"))
            conversion_factor = decimal_or_zero(item.get("conversion_factor", 1)) or Decimal("1")
            base_quantity = decimal_or_zero(item.get("base_quantity")) or (
                quantity * conversion_factor
            )
            base_unit = (
                item.get("base_unit")
                or getattr(product, "stock_base_unit", "")
                or item.get("unit")
                or "pcs"
            )
            supplier_options = item.get("supplier_options") or []
            option_costs = [
                decimal_or_zero(option.get("cost_price")) for option in supplier_options
            ]
            # Headline cost_price is the cheapest recorded supplier, else the legacy value.
            headline_cost = min(option_costs) if option_costs else decimal_or_none(
                item.get("cost_price")
            )
            rows.append(
                QuotationItem(
                    quotation=quotation,
                    product=product,
                    position=position,
                    product_name=item.get("product_name", ""),
                    sku=item.get("sku", ""),
                    unit=item.get("unit") or "pcs",
                    base_unit=base_unit,
                    conversion_factor=conversion_factor,
                    quantity=quantity,
                    base_quantity=base_quantity,
                    sale_price=decimal_or_zero(item.get("sale_price")),
                    cost_price=headline_cost,
                    discounts=item.get("discounts") or ["0"],
                )
            )
            options_by_index.append(supplier_options)

        QuotationItem.objects.bulk_create(rows)

        supplier_rows = []
        for quotation_item, supplier_options in zip(rows, options_by_index):
            for option_position, option in enumerate(supplier_options):
                supplier = resolve_supplier(
                    supplier_id=option.get("supplier_id"),
                    supplier_name=option.get("supplier_name", ""),
                )
                supplier_rows.append(
                    QuotationItemSupplier(
                        quotation_item=quotation_item,
                        supplier=supplier,
                        supplier_name=(
                            option.get("supplier_name")
                            or (supplier.company_name if supplier else "")
                        ),
                        cost_price=decimal_or_zero(option.get("cost_price")),
                        position=option_position,
                        note=option.get("note") or "",
                    )
                )

        if supplier_rows:
            QuotationItemSupplier.objects.bulk_create(supplier_rows)

        if hasattr(quotation, "_prefetched_objects_cache"):
            quotation._prefetched_objects_cache = {}

    def create(self, validated_data):
        items = validated_data.pop("items", [])
        with transaction.atomic():
            quotation = Quotation.objects.create(**validated_data)
            self._replace_items(quotation, items)
        return quotation

    def update(self, instance, validated_data):
        items = validated_data.pop("items", None)
        with transaction.atomic():
            for field, value in validated_data.items():
                setattr(instance, field, value)
            instance.save()
            self._replace_items(instance, items)
        return instance


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


class BillingNoteCreditSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = CreditNote
        fields = ["id", "reference_no", "credit_note_date", "status", "total_amount"]


class BillingNoteSerializer(serializers.ModelSerializer):
    lines = BillingNoteLineSerializer(many=True, required=False)
    customer_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    credit_notes = BillingNoteCreditSummarySerializer(many=True, read_only=True)
    net_amount = serializers.SerializerMethodField()

    class Meta:
        model = BillingNote
        fields = [
            "id",
            "reference_no",
            "customer_id",
            "customer_name",
            "billing_note_date",
            "expected_payment_date",
            "actual_payment_date",
            "status",
            "bank_reference",
            "note",
            "total_amount",
            "lines",
            "credit_notes",
            "net_amount",
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

    def get_net_amount(self, billing_note):
        credits = sum(
            (
                credit_note.total_amount
                for credit_note in billing_note.credit_notes.all()
                if credit_note.status != CreditNote.STATUS_CANCELLED
            ),
            Decimal("0"),
        )
        return billing_note.total_amount - credits

    def validate(self, attrs):
        customer_id_value = attrs.pop("customer_id", None)
        should_resolve_customer = (
            customer_id_value is not None
            or "customer_name" in attrs
            or self.instance is None
        )

        if should_resolve_customer:
            attrs["customer"] = resolve_customer(
                customer_id=customer_id_value,
                customer_name=attrs.get(
                    "customer_name",
                    getattr(self.instance, "customer_name", ""),
                ),
            )

        return attrs

    def _validate_lines_for_customer(self, customer_name, lines, customer=None):
        sale_ids = [line["sale"].id if hasattr(line["sale"], "id") else line["sale"] for line in lines]
        sales = Sale.objects.select_related("customer").filter(pk__in=sale_ids)
        sale_map = {sale.id: sale for sale in sales}

        for line in lines:
            sale_obj = line["sale"] if hasattr(line["sale"], "id") else sale_map.get(line["sale"])

            if sale_obj is None:
                raise serializers.ValidationError({"lines": "Each line must reference an existing sale."})

            if customer and sale_obj.customer_id and sale_obj.customer_id != customer.id:
                raise serializers.ValidationError(
                    {"lines": "All sales in a billing note must belong to the same customer."}
                )
            if not (customer and sale_obj.customer_id) and sale_obj.customer_name != customer_name:
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

        customer = validated_data.get("customer")
        self._validate_lines_for_customer(customer_name, lines_data, customer=customer)
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
                self._validate_lines_for_customer(
                    instance.customer_name,
                    lines_data,
                    customer=instance.customer,
                )
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
    supplier_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = PaymentBatch
        fields = [
            "id",
            "reference_no",
            "supplier_id",
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

    def validate(self, attrs):
        supplier_id_value = attrs.pop("supplier_id", None)
        should_resolve_supplier = (
            supplier_id_value is not None
            or "supplier_name" in attrs
            or self.instance is None
        )

        if should_resolve_supplier:
            attrs["supplier"] = resolve_supplier(
                supplier_id=supplier_id_value,
                supplier_name=attrs.get(
                    "supplier_name",
                    getattr(self.instance, "supplier_name", ""),
                ),
            )

        return attrs

    def _validate_lines_for_supplier(self, supplier_name, lines, supplier=None):
        purchase_ids = [
            line["purchase"].id if hasattr(line["purchase"], "id") else line["purchase"]
            for line in lines
        ]
        purchases = Purchase.objects.select_related("supplier").filter(pk__in=purchase_ids)
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

            if supplier and purchase_obj.supplier_id and purchase_obj.supplier_id != supplier.id:
                raise serializers.ValidationError(
                    {"lines": "All purchases in a payment batch must belong to the same supplier."}
                )
            if not (supplier and purchase_obj.supplier_id) and purchase_obj.supplier_name != supplier_name:
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

        supplier = validated_data.get("supplier")
        self._validate_lines_for_supplier(supplier_name, lines_data, supplier=supplier)
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
                self._validate_lines_for_supplier(
                    instance.supplier_name,
                    lines_data,
                    supplier=instance.supplier,
                )
                self._check_unique_active_purchases(lines_data, current_payment_batch_id=instance.id)
                self._replace_lines(instance, lines_data)

            if validated_data.get("status") != PaymentBatch.STATUS_CANCELLED:
                self._recompute_status_and_dates(instance)
        return instance


class CreditNoteLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = CreditNoteLine
        fields = [
            "id",
            "sale_item",
            "product_name",
            "sku",
            "quantity",
            "unit_price",
            "amount",
        ]
        extra_kwargs = {
            "id": {"read_only": True},
            "sale_item": {"required": False, "allow_null": True},
            "sku": {"required": False, "allow_blank": True},
            "quantity": {"required": False},
            "unit_price": {"required": False},
            "amount": {"required": False},
        }


class CreditNoteSerializer(serializers.ModelSerializer):
    lines = CreditNoteLineSerializer(many=True, required=False)
    customer_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    sale_reference_no = serializers.CharField(read_only=True)
    billing_note_reference_no = serializers.SerializerMethodField()

    class Meta:
        model = CreditNote
        fields = [
            "id",
            "reference_no",
            "customer_id",
            "customer_name",
            "sale",
            "sale_reference_no",
            "billing_note",
            "billing_note_reference_no",
            "credit_note_date",
            "status",
            "note",
            "total_amount",
            "lines",
            "created_at",
            "updated_at",
        ]
        extra_kwargs = {
            "id": {"required": False},
            "reference_no": {"required": False, "allow_blank": True},
            "billing_note": {"required": False, "allow_null": True},
            "note": {"required": False, "allow_blank": True},
            "status": {"required": False},
            "total_amount": {"required": False},
            "created_at": {"read_only": True},
            "updated_at": {"read_only": True},
        }

    def get_billing_note_reference_no(self, credit_note):
        if not credit_note.billing_note_id:
            return ""
        return credit_note.billing_note.reference_no

    def _sale_matches_customer(self, sale, customer, customer_name):
        if customer and sale.customer_id:
            return sale.customer_id == customer.id
        return sale.customer_name == customer_name

    def _billing_note_matches_customer(self, billing_note, customer, customer_name):
        if customer and billing_note.customer_id:
            return billing_note.customer_id == customer.id
        return billing_note.customer_name == customer_name

    def validate(self, attrs):
        customer_id_value = attrs.pop("customer_id", None)
        should_resolve_customer = (
            customer_id_value is not None
            or "customer_name" in attrs
            or self.instance is None
        )
        if should_resolve_customer:
            attrs["customer"] = resolve_customer(
                customer_id=customer_id_value,
                customer_name=attrs.get(
                    "customer_name",
                    getattr(self.instance, "customer_name", ""),
                ),
            )

        customer = attrs.get("customer", getattr(self.instance, "customer", None))
        customer_name = attrs.get(
            "customer_name", getattr(self.instance, "customer_name", "")
        )

        sale = attrs.get("sale", getattr(self.instance, "sale", None))
        if sale is not None and not self._sale_matches_customer(
            sale, customer, customer_name
        ):
            raise serializers.ValidationError(
                {"sale": "The selected sale belongs to a different customer."}
            )

        billing_note = attrs.get(
            "billing_note", getattr(self.instance, "billing_note", None)
        )
        if billing_note is not None and not self._billing_note_matches_customer(
            billing_note, customer, customer_name
        ):
            raise serializers.ValidationError(
                {"billing_note": "The billing note must belong to the same customer."}
            )

        return attrs

    def _replace_lines(self, credit_note, lines):
        credit_note.lines.all().delete()
        rows = []
        total = Decimal("0")
        for line in lines:
            amount = decimal_or_zero(line.get("amount"))
            rows.append(
                CreditNoteLine(
                    credit_note=credit_note,
                    sale_item=line.get("sale_item"),
                    product_name=line.get("product_name", ""),
                    sku=line.get("sku", ""),
                    quantity=decimal_or_zero(line.get("quantity")),
                    unit_price=decimal_or_zero(line.get("unit_price")),
                    amount=amount,
                )
            )
            total += amount

        CreditNoteLine.objects.bulk_create(rows)
        credit_note.total_amount = total
        credit_note.save(update_fields=["total_amount", "updated_at"])
        return rows

    def create(self, validated_data):
        lines_data = validated_data.pop("lines", [])
        if not lines_data:
            raise serializers.ValidationError(
                {"lines": "Add at least one cancelled item to the credit note."}
            )
        if not validated_data.get("customer_name"):
            raise serializers.ValidationError({"customer_name": "Customer is required."})

        sale = validated_data.get("sale")
        validated_data["sale_reference_no"] = sale.reference_no if sale else ""

        with transaction.atomic():
            credit_note = CreditNote.objects.create(**validated_data)
            self._replace_lines(credit_note, lines_data)
        return credit_note

    def update(self, instance, validated_data):
        lines_data = validated_data.pop("lines", None)
        with transaction.atomic():
            for field, value in validated_data.items():
                setattr(instance, field, value)
            if validated_data.get("sale"):
                instance.sale_reference_no = validated_data["sale"].reference_no
            instance.save()

            if lines_data is not None:
                if not lines_data:
                    raise serializers.ValidationError(
                        {"lines": "A credit note must contain at least one line."}
                    )
                self._replace_lines(instance, lines_data)
        return instance
