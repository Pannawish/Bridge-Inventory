"""Purchase, sale, quotation, and credit-note serializers.

This module owns transaction payload compatibility, line-item replacement, and
server-side validation for stock and financial document rules. Keep snapshot
fields in API payloads even when a normalized foreign key also exists.
"""

import datetime
from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from ..models import (
    BillingNote,
    CreditNote,
    CreditNoteLine,
    Customer,
    PaymentBatch,
    Product,
    Purchase,
    PurchaseDocument,
    PurchaseItem,
    Quotation,
    QuotationItem,
    QuotationItemSupplier,
    Sale,
    SaleDocument,
    SaleItem,
    SaleItemAllocation,
    Supplier,
)
from .common import (
    _add_business_days,
    build_file_url,
    build_business_partner_print_profile,
    build_document_payload,
    build_legacy_document_payload,
    compute_credit_note_vat,
    decimal_or_none,
    decimal_or_zero,
    resolve_customer,
    resolve_product,
    resolve_supplier,
    strip_existing_item_id,
    validate_active_products_for_create,
    validate_percentage_discount,
)


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
    supplier_profile = serializers.SerializerMethodField()

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
            "payable_total",
            "items",
            "source_quotation_id",
            "source_quotation_reference_no",
            "payment_batch_links",
            "supplier_profile",
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
            # Derived server-side from item statuses; never written by clients.
            "payable_total": {"read_only": True},
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

    def get_supplier_profile(self, purchase):
        return build_business_partner_print_profile(
            purchase.supplier,
            fallback_name=purchase.supplier_name,
            include_procurement=True,
        )

    def validate_bill_discount(self, value):
        return validate_percentage_discount(value, "Bill discount")

    def validate(self, attrs):
        from ..services import normalize_purchase_items_for_status

        # Resolve the supplier relationship while preserving supplier_name as
        # the historical snapshot printed on the purchase document.
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
                from ..models import Quotation
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

        if self.instance is not None:
            has_allocated_items = SaleItemAllocation.objects.filter(
                purchase_item__purchase=self.instance,
            ).exists()
            if has_allocated_items and items_submitted:
                # Once received stock has been allocated to sales, the purchase
                # lines are part of the stock ledger and must not be rewritten.
                raise serializers.ValidationError(
                    {
                        "items": (
                            "This purchase has stock already allocated to sales. "
                            "Edit the linked sales before changing purchase items."
                        )
                    }
                )
            if has_allocated_items and purchase_status in {
                Purchase.STATUS_DRAFT,
                Purchase.STATUS_ORDERED,
                Purchase.STATUS_CANCELLED,
            }:
                raise serializers.ValidationError(
                    {
                        "status": (
                            "This purchase has stock already allocated to sales and "
                            "must remain received."
                        )
                    }
                )

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

        # Line items are replaced as a set to keep totals/status derivation
        # deterministic and avoid stale rows from earlier drafts.
        purchase.items.all().delete()
        for item in items:
            item = strip_existing_item_id(item)
            PurchaseItem.objects.create(purchase=purchase, **item)
        if hasattr(purchase, "_prefetched_objects_cache"):
            purchase._prefetched_objects_cache = {}

    def _apply_status_to_items(self, purchase):
        from ..services import apply_purchase_status_to_items

        apply_purchase_status_to_items(purchase)

    def create(self, validated_data):
        from ..services import recalculate_purchase_payable, sync_product_supplier_links_for_purchase

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
            recalculate_purchase_payable(purchase)
            sync_product_supplier_links_for_purchase(purchase)
        return purchase

    def update(self, instance, validated_data):
        from ..services import (
            recalculate_purchase_payable,
            sync_product_supplier_links_for_purchase,
            sync_supplier_payment_lines_for_purchase,
        )

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

            # Item totals or statuses may have changed; keep the payable amount
            # and any linked supplier payment batches in sync.
            recalculate_purchase_payable(instance)
            sync_product_supplier_links_for_purchase(instance)
            sync_supplier_payment_lines_for_purchase(instance)

        return instance


class SaleItemSerializer(serializers.ModelSerializer):
    product_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    supplier_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    line_total = serializers.SerializerMethodField()
    allocations = serializers.SerializerMethodField()

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
            "allocations",
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

    def get_allocations(self, item):
        allocations = getattr(item, "prefetched_allocations", None)
        if allocations is None:
            allocations = item.allocations.select_related(
                "purchase_item",
                "purchase_item__purchase",
                "supplier",
            ).all()

        return [
            {
                "id": allocation.id,
                "purchase_item_id": allocation.purchase_item_id,
                "purchase_reference_no": (
                    allocation.purchase_item.purchase.reference_no
                    if allocation.purchase_item_id
                    else ""
                ),
                "supplier_id": allocation.supplier_id,
                "supplier_name": allocation.supplier_name,
                "product_id": allocation.product_id,
                "product_name": allocation.product_name,
                "sku": allocation.sku,
                "quantity": allocation.quantity,
                "base_quantity": allocation.base_quantity,
                "base_unit_cost": allocation.base_unit_cost,
                "total_cost": allocation.total_cost,
            }
            for allocation in allocations
        ]

    def to_internal_value(self, data):
        allocation_requests = serializers.empty
        if isinstance(data, dict) and "allocations" in data:
            allocation_requests = data.get("allocations")
            data = {key: value for key, value in data.items() if key != "allocations"}

        attrs = super().to_internal_value(data)
        if allocation_requests is not serializers.empty:
            if not isinstance(allocation_requests, list):
                raise serializers.ValidationError({"allocations": "Allocations must be a list."})
            attrs["_allocation_requests"] = allocation_requests

        return attrs

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
    customer_profile = serializers.SerializerMethodField()

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
            "customer_profile",
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

    def get_customer_profile(self, sale):
        return build_business_partner_print_profile(
            sale.customer,
            fallback_name=sale.customer_name,
        )

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
            return None

        # Manual allocation requests ride along on temporary item attributes
        # until sync_sale_allocations creates durable allocation rows.
        sale.items.all().delete()
        created_items = []
        for item in items:
            item = strip_existing_item_id(item)
            allocation_requests = item.pop("_allocation_requests", None)
            sale_item = SaleItem.objects.create(sale=sale, **item)
            if allocation_requests is not None:
                sale_item._allocation_requests = allocation_requests
            created_items.append(sale_item)
        if hasattr(sale, "_prefetched_objects_cache"):
            sale._prefetched_objects_cache = {}
        return created_items

    def _apply_status_to_items(self, sale):
        from ..services import apply_sale_status_to_items

        apply_sale_status_to_items(sale)

    def validate(self, attrs):
        from ..services import (
            SALE_PARTIAL_TRANSACTION_STATUSES,
            get_sale_status_from_items,
            get_sale_stock_issues,
            normalize_sale_items_for_status,
        )

        # Resolve the customer relationship while preserving customer_name as
        # the historical snapshot printed on the sale document.
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
                from ..models import Quotation
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
            # The frontend shows a stock preview, but the backend makes the
            # authoritative decision using all committed purchase/sale rows.
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
            created_items = self._replace_items(sale, items)
            from ..services import sync_sale_allocations

            sync_sale_allocations(sale, created_items)
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
            created_items = self._replace_items(instance, items)

            if status_changed and items is None:
                self._apply_status_to_items(instance)
                if hasattr(instance, "_prefetched_objects_cache"):
                    instance._prefetched_objects_cache = {}

            from ..services import sync_sale_allocations

            sync_sale_allocations(instance, created_items)

        return instance


class QuotationSerializer(serializers.ModelSerializer):
    """Serializer for quotation headers with normalized line-item rows.

    The API still accepts and returns an ``items`` array for frontend
    compatibility, but the database source of truth is ``QuotationItem``.
    """

    items = serializers.JSONField(required=False, write_only=True)
    customer_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    supplier_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    derived_purchase_links = serializers.SerializerMethodField()
    derived_sale_links = serializers.SerializerMethodField()
    customer_profile = serializers.SerializerMethodField()
    supplier_profile = serializers.SerializerMethodField()

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
            "shipping_date",
            "payment_term_type",
            "payment_term_days",
            "vat_mode",
            "note",
            "items",
            "total_before_vat",
            "vat_amount",
            "grand_total",
            "derived_purchase_links",
            "derived_sale_links",
            "customer_profile",
            "supplier_profile",
        ]
        extra_kwargs = {
            "id": {"required": False},
            "reference_no": {"required": False, "allow_blank": True},
            "valid_until_date": {"required": False, "allow_null": True},
            "shipping_date": {"required": False, "allow_null": True},
            "payment_term_type": {"required": False, "allow_blank": True},
            "payment_term_days": {"required": False, "allow_blank": True},
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

    def get_customer_profile(self, quotation):
        return build_business_partner_print_profile(
            quotation.customer,
            fallback_name=quotation.customer_name,
        )

    def get_supplier_profile(self, quotation):
        return build_business_partner_print_profile(
            quotation.supplier,
            fallback_name=quotation.supplier_name,
            include_procurement=True,
        )

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
    customer_profile = serializers.SerializerMethodField()

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
            "vat_mode",
            "total_before_vat",
            "vat_amount",
            "total_amount",
            "lines",
            "customer_profile",
            "created_at",
            "updated_at",
        ]
        extra_kwargs = {
            "id": {"required": False},
            "reference_no": {"required": False, "allow_blank": True},
            "billing_note": {"required": False, "allow_null": True},
            "note": {"required": False, "allow_blank": True},
            "status": {"required": False},
            # Derived from the source sale's VAT treatment, not client input.
            "vat_mode": {"read_only": True},
            "total_before_vat": {"read_only": True},
            "vat_amount": {"read_only": True},
            "total_amount": {"required": False},
            "created_at": {"read_only": True},
            "updated_at": {"read_only": True},
        }

    def get_billing_note_reference_no(self, credit_note):
        if not credit_note.billing_note_id:
            return ""
        return credit_note.billing_note.reference_no

    def get_customer_profile(self, credit_note):
        return build_business_partner_print_profile(
            credit_note.customer,
            fallback_name=credit_note.customer_name,
        )

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
        line_total = Decimal("0")
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
            line_total += amount

        CreditNoteLine.objects.bulk_create(rows)

        # Mirror the source sale's VAT treatment so the credit reduces the bill by
        # the same VAT-inclusive value the customer was charged — not the bare
        # line price. total_amount becomes the gross credit.
        vat_mode = (getattr(credit_note.sale, "vat_mode", "") or "not_included")
        subtotal, vat = compute_credit_note_vat(line_total, vat_mode)
        credit_note.vat_mode = vat_mode
        credit_note.total_before_vat = subtotal
        credit_note.vat_amount = vat
        credit_note.total_amount = subtotal + vat
        credit_note.save(
            update_fields=[
                "vat_mode",
                "total_before_vat",
                "vat_amount",
                "total_amount",
                "updated_at",
            ]
        )
        return rows

    def create(self, validated_data):
        lines_data = validated_data.pop("lines", [])
        if not lines_data:
            raise serializers.ValidationError(
                {"lines": "Add at least one cancelled or returned item to the credit note."}
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

__all__ = [
    "CreditNoteLineSerializer",
    "CreditNoteSerializer",
    "PurchaseItemSerializer",
    "PurchaseSerializer",
    "QuotationSerializer",
    "SaleItemSerializer",
    "SaleSerializer",
]
