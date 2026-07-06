"""Master data serializers.

These serializers translate between the frontend's compatibility field names
and normalized master-data models. They intentionally preserve aliases,
snapshots, and attachment payloads used by existing frontend workflows.
"""

from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from ..models import (
    Category,
    Customer,
    Product,
    ProductPicture,
    ProductSupplier,
    ProductUnitConversion,
    Supplier,
)
from .common import (
    build_product_picture_payload,
    clean_list,
    decimal_or_zero,
    resolve_product,
    resolve_supplier,
)


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


class ProductSupplierSerializer(serializers.ModelSerializer):
    product_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    supplier_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    product_name = serializers.SerializerMethodField()
    supplier_name = serializers.SerializerMethodField()

    class Meta:
        model = ProductSupplier
        fields = [
            "id",
            "product_id",
            "product_name",
            "supplier_id",
            "supplier_name",
            "supplier_sku",
            "default_purchase_unit",
            "default_unit_cost",
            "lead_time_days",
            "min_order_qty",
            "is_preferred",
            "is_active",
        ]
        extra_kwargs = {
            "id": {"read_only": True},
            "supplier_sku": {"required": False, "allow_blank": True},
            "default_purchase_unit": {"required": False, "allow_blank": True},
            "default_unit_cost": {"required": False},
            "lead_time_days": {"required": False, "allow_null": True},
            "min_order_qty": {"required": False},
            "is_preferred": {"required": False},
            "is_active": {"required": False},
        }

    def get_product_name(self, link):
        return link.product.product_name if link.product else ""

    def get_supplier_name(self, link):
        return link.supplier.company_name if link.supplier else ""

    def validate(self, attrs):
        product_id_value = attrs.pop("product_id", None)
        supplier_id_value = attrs.pop("supplier_id", None)
        if product_id_value is not None:
            attrs["product"] = resolve_product(product_id=product_id_value)
        if supplier_id_value is not None:
            attrs["supplier"] = resolve_supplier(supplier_id=supplier_id_value)

        if self.instance is None and not attrs.get("product"):
            raise serializers.ValidationError({"product_id": "Product is required."})
        if self.instance is None and not attrs.get("supplier"):
            raise serializers.ValidationError({"supplier_id": "Supplier is required."})

        return attrs


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
    average_unit_cost = serializers.SerializerMethodField()
    average_recent_sale_price = serializers.SerializerMethodField()
    received_purchase_count = serializers.SerializerMethodField()
    active_sales_count = serializers.SerializerMethodField()

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
            "average_unit_cost",
            "average_recent_sale_price",
            "received_purchase_count",
            "active_sales_count",
        ]
        extra_kwargs = {
            "id": {"required": False},
            "sku": {"allow_blank": False},
            "detail": {"required": False, "allow_blank": True},
            "reorder_level": {"required": False},
        }

    def get_metric_snapshot(self, product):
        from ..services import get_product_metric_snapshots

        metrics_by_product_id = self.context.get("product_metrics_by_product_id")
        if metrics_by_product_id is None:
            metrics_by_product_id = {}
            self.context["product_metrics_by_product_id"] = metrics_by_product_id

        if product.id not in metrics_by_product_id:
            metrics_by_product_id.update(
                get_product_metric_snapshots(product_ids=[product.id])
            )

        return metrics_by_product_id.get(product.id, {})

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
        return self.get_metric_snapshot(product).get("current_stock", Decimal("0"))

    def get_average_unit_cost(self, product):
        return self.get_metric_snapshot(product).get("average_unit_cost", Decimal("0"))

    def get_average_recent_sale_price(self, product):
        return self.get_metric_snapshot(product).get(
            "average_recent_sale_price",
            Decimal("0"),
        )

    def get_received_purchase_count(self, product):
        return self.get_metric_snapshot(product).get("received_purchase_count", 0)

    def get_active_sales_count(self, product):
        return self.get_metric_snapshot(product).get("active_sales_count", 0)

    def validate_previousSkus(self, value):
        return clean_list(value)

    def validate_subNames(self, value):
        return clean_list(value)

    def validate_categoryId(self, value):
        return value or None

    def validate_uploaded_pictures(self, value):
        for picture in value:
            content_type = getattr(picture, "content_type", "") or ""
            name = (getattr(picture, "name", "") or "").lower()
            is_image = content_type.startswith("image/")
            is_pdf = content_type == "application/pdf" or name.endswith(".pdf")
            if not (is_image or is_pdf):
                raise serializers.ValidationError(
                    "Product attachments must be an image or PDF file."
                )

        return value

    def _add_pictures(self, product, pictures):
        created_pictures = []
        for picture in pictures:
            # Store the bytes in the database so the attachment survives Railway
            # redeploys (the disk is wiped) and serves with DEBUG off.
            if hasattr(picture, "seek"):
                picture.seek(0)
            created_pictures.append(
                ProductPicture.objects.create(
                    product=product,
                    content=picture.read(),
                    content_type=getattr(picture, "content_type", "")
                    or "application/octet-stream",
                    filename=getattr(picture, "name", "") or "attachment",
                )
            )
        return created_pictures

    def _remove_pictures(self, product, picture_ids):
        ids = {str(picture_id) for picture_id in picture_ids or []}
        if not ids:
            return

        for picture in product.pictures.filter(id__in=ids):
            if picture.file:
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

__all__ = [
    "BusinessPartnerSerializer",
    "CategorySerializer",
    "CustomerSerializer",
    "ProductSerializer",
    "ProductSupplierSerializer",
    "ProductUnitConversionSerializer",
    "SupplierSerializer",
]
