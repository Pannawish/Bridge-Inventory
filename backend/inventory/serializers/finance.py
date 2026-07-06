"""Billing note and payment batch serializers.

These serializers enforce receivable/payable grouping rules: one customer per
billing note, one supplier per payment batch, and no duplicate active source
documents across finance batches.
"""

from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from ..models import (
    BillingNote,
    BillingNoteLine,
    CreditNote,
    PaymentBatch,
    PaymentBatchLine,
    Purchase,
    PurchaseItem,
    Sale,
)
from .common import (
    build_business_partner_print_profile,
    decimal_or_zero,
    resolve_customer,
    resolve_supplier,
)


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
    customer_profile = serializers.SerializerMethodField()

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
            "customer_profile",
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

    def get_customer_profile(self, billing_note):
        return build_business_partner_print_profile(
            billing_note.customer,
            fallback_name=billing_note.customer_name,
        )

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
        """Prevent a sale from appearing in two active billing notes."""
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
        """Replace billing lines and recompute the document total atomically."""
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
    purchase_payable_total = serializers.DecimalField(
        source="purchase.payable_total",
        max_digits=14,
        decimal_places=2,
        read_only=True,
    )
    purchase_cancelled_items = serializers.SerializerMethodField()
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
            "purchase_payable_total",
            "purchase_cancelled_items",
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

    def get_purchase_cancelled_items(self, line):
        """Cancelled line items on the purchase, used to explain why the amount
        owed is lower than the purchase's original total."""
        purchase = line.purchase
        if purchase is None:
            return []
        return [
            {
                "product_name": item.product_name,
                "sku": item.sku,
                "quantity": item.quantity,
                "unit": item.unit,
                "amount": item.amount,
            }
            for item in purchase.items.all()
            if item.item_status == PurchaseItem.ITEM_CANCELLED
        ]


class PaymentBatchSerializer(serializers.ModelSerializer):
    lines = PaymentBatchLineSerializer(many=True, required=False)
    supplier_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    supplier_profile = serializers.SerializerMethodField()

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
            "supplier_profile",
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

    def get_supplier_profile(self, payment_batch):
        return build_business_partner_print_profile(
            payment_batch.supplier,
            fallback_name=payment_batch.supplier_name,
            include_procurement=True,
        )

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
        """Prevent a purchase from appearing in two active payment batches."""
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
            paid = bool(line.get("paid", False))
            paid_date = line.get("paid_date") or None

            # The amount still owed for the purchase, excluding cancelled items.
            # Fall back to the full total only when a payable has not been derived
            # yet (e.g. legacy rows), never below the real amount owed.
            payable = decimal_or_zero(getattr(purchase_obj, "payable_total", 0))
            if payable <= 0:
                payable = decimal_or_zero(getattr(purchase_obj, "grand_total", 0))

            if paid:
                # Paid lines are frozen as a financial record of what was committed.
                amount = decimal_or_zero(line.get("amount")) or payable
            else:
                # Unpaid lines always reflect the current amount owed.
                amount = payable
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

__all__ = [
    "BillingNoteCreditSummarySerializer",
    "BillingNoteLineSerializer",
    "BillingNoteSerializer",
    "PaymentBatchLineSerializer",
    "PaymentBatchSerializer",
    "compute_billing_note_status",
    "compute_payment_batch_status",
]
