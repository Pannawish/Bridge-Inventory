import uuid

from django.db import models
from django.utils import timezone


def make_prefixed_id(prefix):
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


def category_id():
    return make_prefixed_id("category")


def supplier_id():
    return make_prefixed_id("supplier")


def customer_id():
    return make_prefixed_id("customer")


def product_id():
    return make_prefixed_id("product")


def product_picture_id():
    return make_prefixed_id("product-picture")


def purchase_id():
    return make_prefixed_id("purchase")


def purchase_item_id():
    return make_prefixed_id("purchase-item")


def purchase_document_id():
    return make_prefixed_id("purchase-document")


def sale_id():
    return make_prefixed_id("sale")


def sale_item_id():
    return make_prefixed_id("sale-item")


def sale_document_id():
    return make_prefixed_id("sale-document")


def quotation_id():
    return make_prefixed_id("quotation")


def quotation_item_id():
    return make_prefixed_id("quotation-item")


def quotation_item_supplier_id():
    return make_prefixed_id("quotation-item-supplier")


def billing_note_id():
    return make_prefixed_id("billing-note")


def billing_note_line_id():
    return make_prefixed_id("billing-note-line")


def payment_batch_id():
    return make_prefixed_id("payment-batch")


def payment_batch_line_id():
    return make_prefixed_id("payment-batch-line")


def credit_note_id():
    return make_prefixed_id("credit-note")


def credit_note_line_id():
    return make_prefixed_id("credit-note-line")


def list_default():
    return []


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Category(TimeStampedModel):
    id = models.CharField(max_length=80, primary_key=True, default=category_id)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    parent = models.ForeignKey(
        "self",
        on_delete=models.PROTECT,
        related_name="children",
        blank=True,
        null=True,
    )

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "categories"

    def __str__(self):
        return self.name


class BusinessPartner(TimeStampedModel):
    company_name = models.CharField(max_length=255)
    locations = models.JSONField(default=list_default, blank=True)
    selected_location_index = models.PositiveIntegerField(default=0)
    emails = models.JSONField(default=list_default, blank=True)
    selected_email_index = models.PositiveIntegerField(default=0)
    tels = models.JSONField(default=list_default, blank=True)
    selected_tel_index = models.PositiveIntegerField(default=0)
    taxpayer_id = models.CharField(max_length=64, blank=True)
    branches = models.JSONField(default=list_default, blank=True)
    selected_branch_index = models.PositiveIntegerField(default=0)
    shipping_addresses = models.JSONField(default=list_default, blank=True)
    selected_shipping_address_index = models.PositiveIntegerField(default=0)
    remark = models.TextField(blank=True)
    term_type = models.CharField(max_length=20, blank=True, default="")
    billing_note_date = models.CharField(max_length=40, blank=True, default="")

    class Meta:
        abstract = True

    def __str__(self):
        return self.company_name


class Supplier(BusinessPartner):
    id = models.CharField(max_length=80, primary_key=True, default=supplier_id)
    procurement_name = models.CharField(max_length=255, blank=True, default="")
    procurement_tel = models.CharField(max_length=80, blank=True, default="")

    class Meta:
        ordering = ["company_name"]
        indexes = [
            models.Index(fields=["company_name"], name="inv_supplier_name_idx"),
            models.Index(fields=["taxpayer_id"], name="inv_supplier_tax_idx"),
        ]


class Customer(BusinessPartner):
    id = models.CharField(max_length=80, primary_key=True, default=customer_id)

    class Meta:
        ordering = ["company_name"]
        indexes = [
            models.Index(fields=["company_name"], name="inv_customer_name_idx"),
            models.Index(fields=["taxpayer_id"], name="inv_customer_tax_idx"),
        ]


class Product(TimeStampedModel):
    id = models.CharField(max_length=80, primary_key=True, default=product_id)
    product_display_id = models.PositiveIntegerField(default=1001)
    sku = models.CharField(max_length=80, unique=True)
    previous_skus = models.JSONField(default=list_default, blank=True)
    product_name = models.CharField(max_length=255)
    sub_names = models.JSONField(default=list_default, blank=True)
    stock_base_unit = models.CharField(max_length=40, default="pcs")
    default_purchase_unit = models.CharField(max_length=40, default="pcs")
    default_sales_unit = models.CharField(max_length=40, default="pcs")
    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        related_name="products",
        blank=True,
        null=True,
    )
    category_name = models.CharField(max_length=255, blank=True)
    detail = models.TextField(blank=True)
    reorder_level = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["product_display_id", "product_name"]
        indexes = [
            models.Index(
                fields=["product_display_id", "product_name"],
                name="inv_prod_display_name",
            ),
            models.Index(fields=["product_name"], name="inv_prod_name_idx"),
            models.Index(fields=["category_name"], name="inv_prod_catname_idx"),
            models.Index(fields=["is_active", "product_name"], name="inv_prod_active_name"),
        ]

    def __str__(self):
        return f"{self.product_name} ({self.sku})"


class ProductPicture(TimeStampedModel):
    id = models.CharField(max_length=80, primary_key=True, default=product_picture_id)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="pictures")
    file = models.FileField(upload_to="products/pictures/")
    is_selected = models.BooleanField(default=False)

    class Meta:
        ordering = ["created_at", "id"]
        indexes = [
            models.Index(fields=["product", "is_selected"], name="inv_ppic_product_sel"),
        ]

    def __str__(self):
        return self.file.name


class ProductUnitConversion(models.Model):
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="unit_conversions",
    )
    unit = models.CharField(max_length=40)
    factor_to_base = models.DecimalField(max_digits=12, decimal_places=6, default=1)
    allow_purchase = models.BooleanField(default=True)
    allow_sale = models.BooleanField(default=True)

    class Meta:
        ordering = ["id"]
        unique_together = [("product", "unit")]

    def __str__(self):
        return f"{self.product} - {self.unit}"


class Purchase(TimeStampedModel):
    STATUS_DRAFT = "draft"
    STATUS_ORDERED = "ordered"
    STATUS_PARTIALLY_RECEIVED = "partially_received"
    STATUS_RECEIVED = "received"
    STATUS_CANCELLED = "cancelled"

    STATUS_CHOICES = [
        (STATUS_DRAFT, "Draft"),
        (STATUS_ORDERED, "Ordered"),
        (STATUS_PARTIALLY_RECEIVED, "Partially received"),
        (STATUS_RECEIVED, "Received"),
        (STATUS_CANCELLED, "Cancelled"),
    ]

    id = models.CharField(max_length=80, primary_key=True, default=purchase_id)
    reference_no = models.CharField(max_length=80, blank=True)
    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.SET_NULL,
        related_name="purchases",
        blank=True,
        null=True,
    )
    supplier_name = models.CharField(max_length=255)
    supplier_tax_invoice = models.CharField(max_length=120, blank=True)
    status = models.CharField(max_length=40, choices=STATUS_CHOICES, default=STATUS_ORDERED)
    transaction_date = models.DateField(default=timezone.localdate)
    payment_term_type = models.CharField(max_length=20, blank=True, default="")
    payment_term_days = models.CharField(max_length=20, blank=True, default="")
    payment_date = models.DateField(blank=True, null=True)
    note = models.TextField(blank=True)
    document = models.FileField(upload_to="documents/purchases/", blank=True, null=True)
    vat_mode = models.CharField(max_length=40, default="not_included")
    bill_discount = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    total_before_vat = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    vat_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    grand_total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    source_quotation = models.ForeignKey(
        "Quotation",
        on_delete=models.SET_NULL,
        related_name="derived_purchases",
        blank=True,
        null=True,
    )

    class Meta:
        ordering = ["-transaction_date", "-created_at"]
        indexes = [
            models.Index(fields=["transaction_date"], name="inv_purch_date_idx"),
            models.Index(
                fields=["status", "transaction_date"],
                name="inv_purch_status_date",
            ),
            models.Index(
                fields=["supplier_name", "transaction_date"],
                name="inv_purch_supplier_date",
            ),
            models.Index(fields=["reference_no"], name="inv_purch_ref_idx"),
        ]

    def __str__(self):
        return self.reference_no or self.id


class PurchaseItem(models.Model):
    ITEM_PENDING = "pending"
    ITEM_RECEIVED = "received"
    ITEM_CANCELLED = "cancelled"

    ITEM_STATUS_CHOICES = [
        (ITEM_PENDING, "Pending"),
        (ITEM_RECEIVED, "Received"),
        (ITEM_CANCELLED, "Cancelled"),
    ]

    id = models.CharField(max_length=80, primary_key=True, default=purchase_item_id)
    purchase = models.ForeignKey(Purchase, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(
        Product,
        on_delete=models.SET_NULL,
        related_name="purchase_items",
        blank=True,
        null=True,
    )
    product_name = models.CharField(max_length=255)
    sku = models.CharField(max_length=80, blank=True)
    expected_delivery_date = models.DateField(blank=True, null=True)
    item_status = models.CharField(
        max_length=40,
        choices=ITEM_STATUS_CHOICES,
        default=ITEM_PENDING,
    )
    received_date = models.DateField(blank=True, null=True)
    lead_time_days = models.PositiveIntegerField(blank=True, null=True)
    unit = models.CharField(max_length=40, default="pcs")
    base_unit = models.CharField(max_length=40, default="pcs")
    conversion_factor = models.DecimalField(max_digits=12, decimal_places=6, default=1)
    quantity = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    base_quantity = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    unit_cost = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    discounts = models.JSONField(default=list_default, blank=True)
    amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    class Meta:
        ordering = ["id"]
        indexes = [
            models.Index(
                fields=["item_status", "product"],
                name="inv_pitem_status_product",
            ),
        ]

    def __str__(self):
        return self.product_name


class PurchaseDocument(TimeStampedModel):
    id = models.CharField(max_length=80, primary_key=True, default=purchase_document_id)
    purchase = models.ForeignKey(Purchase, on_delete=models.CASCADE, related_name="documents")
    file = models.FileField(upload_to="documents/purchases/")

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self):
        return self.file.name


class Sale(TimeStampedModel):
    STATUS_DRAFT = "draft"
    STATUS_PARTIALLY_PACKED = "partially_packed"
    STATUS_PACKED = "packed"
    STATUS_PARTIALLY_SHIPPED = "partially_shipped"
    STATUS_SHIPPED = "shipped"
    STATUS_PARTIALLY_DELIVERED = "partially_delivered"
    STATUS_DELIVERED = "delivered"
    STATUS_CANCELLED = "cancelled"
    STATUS_RETURNED = "returned"

    STATUS_CHOICES = [
        (STATUS_DRAFT, "Draft"),
        (STATUS_PARTIALLY_PACKED, "Partially packed"),
        (STATUS_PACKED, "Packed"),
        (STATUS_PARTIALLY_SHIPPED, "Partially shipped"),
        (STATUS_SHIPPED, "Shipped"),
        (STATUS_PARTIALLY_DELIVERED, "Partially delivered"),
        (STATUS_DELIVERED, "Delivered"),
        (STATUS_CANCELLED, "Cancelled"),
        (STATUS_RETURNED, "Returned"),
    ]

    id = models.CharField(max_length=80, primary_key=True, default=sale_id)
    reference_no = models.CharField(max_length=80, blank=True)
    customer = models.ForeignKey(
        Customer,
        on_delete=models.SET_NULL,
        related_name="sales",
        blank=True,
        null=True,
    )
    customer_name = models.CharField(max_length=255)
    customer_po_reference = models.CharField(max_length=120, blank=True)
    status = models.CharField(max_length=40, choices=STATUS_CHOICES, default=STATUS_DRAFT)
    payment_term_type = models.CharField(max_length=20, blank=True, default="")
    payment_term_days = models.CharField(max_length=20, blank=True, default="")
    payment_date = models.DateField(blank=True, null=True)
    transaction_date = models.DateField(default=timezone.localdate)
    note = models.TextField(blank=True)
    document = models.FileField(upload_to="documents/sales/", blank=True, null=True)
    vat_mode = models.CharField(max_length=40, default="not_included")
    bill_discount = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    total_before_vat = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    vat_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    grand_total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    source_quotation = models.ForeignKey(
        "Quotation",
        on_delete=models.SET_NULL,
        related_name="derived_sales",
        blank=True,
        null=True,
    )

    class Meta:
        ordering = ["-transaction_date", "-created_at"]
        indexes = [
            models.Index(fields=["transaction_date"], name="inv_sale_date_idx"),
            models.Index(
                fields=["status", "transaction_date"],
                name="inv_sale_status_date",
            ),
            models.Index(
                fields=["customer_name", "transaction_date"],
                name="inv_sale_customer_date",
            ),
            models.Index(fields=["reference_no"], name="inv_sale_ref_idx"),
        ]

    def __str__(self):
        return self.reference_no or self.id


class SaleItem(models.Model):
    ITEM_PENDING = "pending"
    ITEM_PACKED = "packed"
    ITEM_SHIPPED = "shipped"
    ITEM_DELIVERED = "delivered"
    ITEM_CANCELLED = "cancelled"
    ITEM_RETURNED = "returned"

    ITEM_STATUS_CHOICES = [
        (ITEM_PENDING, "Pending"),
        (ITEM_PACKED, "Packed"),
        (ITEM_SHIPPED, "Shipped"),
        (ITEM_DELIVERED, "Delivered"),
        (ITEM_CANCELLED, "Cancelled"),
        (ITEM_RETURNED, "Returned"),
    ]

    id = models.CharField(max_length=80, primary_key=True, default=sale_item_id)
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(
        Product,
        on_delete=models.SET_NULL,
        related_name="sale_items",
        blank=True,
        null=True,
    )
    product_name = models.CharField(max_length=255)
    sku = models.CharField(max_length=80, blank=True)
    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.SET_NULL,
        related_name="sourced_sale_items",
        blank=True,
        null=True,
    )
    supplier_name = models.CharField(max_length=255, blank=True)
    unit_cost = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    item_status = models.CharField(
        max_length=40,
        choices=ITEM_STATUS_CHOICES,
        default=ITEM_PENDING,
    )
    shipped_date = models.DateField(blank=True, null=True)
    delivered_date = models.DateField(blank=True, null=True)
    unit = models.CharField(max_length=40, default="pcs")
    base_unit = models.CharField(max_length=40, default="pcs")
    conversion_factor = models.DecimalField(max_digits=12, decimal_places=6, default=1)
    quantity = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    base_quantity = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    unit_price = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    discounts = models.JSONField(default=list_default, blank=True)
    amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    class Meta:
        ordering = ["id"]
        indexes = [
            models.Index(
                fields=["item_status", "product"],
                name="inv_sitem_status_product",
            ),
        ]

    def __str__(self):
        return self.product_name


class SaleDocument(TimeStampedModel):
    id = models.CharField(max_length=80, primary_key=True, default=sale_document_id)
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name="documents")
    file = models.FileField(upload_to="documents/sales/")

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self):
        return self.file.name


class Quotation(TimeStampedModel):
    id = models.CharField(max_length=80, primary_key=True, default=quotation_id)
    reference_no = models.CharField(max_length=80, blank=True)
    quotation_date = models.DateField(default=timezone.localdate)
    valid_until_date = models.DateField(blank=True, null=True)
    valid_until_days = models.IntegerField(default=30, blank=True, null=True)
    valid_until_day_type = models.CharField(max_length=20, default="calendar", blank=True)
    customer = models.ForeignKey(
        Customer,
        on_delete=models.SET_NULL,
        related_name="quotations_as_customer",
        blank=True,
        null=True,
    )
    customer_name = models.CharField(max_length=255, blank=True)
    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.SET_NULL,
        related_name="quotations_as_supplier",
        blank=True,
        null=True,
    )
    supplier_name = models.CharField(max_length=255, blank=True)
    vat_mode = models.CharField(max_length=40, default="not_included")
    note = models.TextField(blank=True)
    total_before_vat = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    vat_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    grand_total = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    class Meta:
        ordering = ["-quotation_date", "-created_at"]

    def __str__(self):
        return self.reference_no or self.id


class QuotationItem(models.Model):
    id = models.CharField(max_length=80, primary_key=True, default=quotation_item_id)
    quotation = models.ForeignKey(Quotation, on_delete=models.CASCADE, related_name="line_items")
    product = models.ForeignKey(
        Product,
        on_delete=models.SET_NULL,
        related_name="quotation_items",
        blank=True,
        null=True,
    )
    position = models.PositiveIntegerField(default=0)
    product_name = models.CharField(max_length=255)
    sku = models.CharField(max_length=80, blank=True)
    unit = models.CharField(max_length=40, default="pcs")
    base_unit = models.CharField(max_length=40, default="pcs")
    conversion_factor = models.DecimalField(max_digits=12, decimal_places=6, default=1)
    quantity = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    base_quantity = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    sale_price = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    cost_price = models.DecimalField(max_digits=14, decimal_places=2, blank=True, null=True)
    discounts = models.JSONField(default=list_default, blank=True)

    class Meta:
        ordering = ["position", "id"]

    def __str__(self):
        return self.product_name


class QuotationItemSupplier(models.Model):
    id = models.CharField(
        max_length=80,
        primary_key=True,
        default=quotation_item_supplier_id,
    )
    quotation_item = models.ForeignKey(
        QuotationItem,
        on_delete=models.CASCADE,
        related_name="supplier_options",
    )
    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.SET_NULL,
        related_name="quotation_item_options",
        blank=True,
        null=True,
    )
    supplier_name = models.CharField(max_length=255, blank=True)
    cost_price = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    position = models.PositiveIntegerField(default=0)
    note = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["position", "id"]

    def __str__(self):
        return f"{self.quotation_item_id} / {self.supplier_name}"


class BillingNote(TimeStampedModel):
    STATUS_DRAFT = "draft"
    STATUS_ISSUED = "issued"
    STATUS_PARTIALLY_RECEIVED = "partially_received"
    STATUS_FULLY_RECEIVED = "fully_received"
    STATUS_CANCELLED = "cancelled"

    STATUS_CHOICES = [
        (STATUS_DRAFT, "Draft"),
        (STATUS_ISSUED, "Issued"),
        (STATUS_PARTIALLY_RECEIVED, "Partially received"),
        (STATUS_FULLY_RECEIVED, "Fully received"),
        (STATUS_CANCELLED, "Cancelled"),
    ]

    id = models.CharField(max_length=80, primary_key=True, default=billing_note_id)
    reference_no = models.CharField(max_length=80, blank=True)
    customer = models.ForeignKey(
        Customer,
        on_delete=models.SET_NULL,
        related_name="billing_notes",
        blank=True,
        null=True,
    )
    customer_name = models.CharField(max_length=255)
    billing_note_date = models.DateField(default=timezone.localdate)
    expected_payment_date = models.DateField(blank=True, null=True)
    actual_payment_date = models.DateField(blank=True, null=True)
    status = models.CharField(max_length=40, choices=STATUS_CHOICES, default=STATUS_ISSUED)
    bank_reference = models.CharField(max_length=120, blank=True)
    note = models.TextField(blank=True)
    total_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    class Meta:
        ordering = ["-billing_note_date", "-created_at"]
        indexes = [
            models.Index(fields=["billing_note_date"], name="inv_bn_date_idx"),
            models.Index(
                fields=["status", "billing_note_date"],
                name="inv_bn_status_date",
            ),
            models.Index(
                fields=["customer_name", "billing_note_date"],
                name="inv_bn_customer_date",
            ),
            models.Index(fields=["expected_payment_date"], name="inv_bn_expected_idx"),
            models.Index(fields=["reference_no"], name="inv_bn_ref_idx"),
        ]

    def __str__(self):
        return self.reference_no or self.id


class BillingNoteLine(models.Model):
    id = models.CharField(max_length=80, primary_key=True, default=billing_note_line_id)
    billing_note = models.ForeignKey(
        BillingNote,
        on_delete=models.CASCADE,
        related_name="lines",
    )
    sale = models.ForeignKey(
        Sale,
        on_delete=models.PROTECT,
        related_name="billing_note_lines",
    )
    received = models.BooleanField(default=False)
    received_date = models.DateField(blank=True, null=True)
    amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.billing_note_id} / {self.sale_id}"


class PaymentBatch(TimeStampedModel):
    STATUS_DRAFT = "draft"
    STATUS_SCHEDULED = "scheduled"
    STATUS_PARTIALLY_PAID = "partially_paid"
    STATUS_PAID = "paid"
    STATUS_CANCELLED = "cancelled"

    STATUS_CHOICES = [
        (STATUS_DRAFT, "Draft"),
        (STATUS_SCHEDULED, "Scheduled"),
        (STATUS_PARTIALLY_PAID, "Partially paid"),
        (STATUS_PAID, "Paid"),
        (STATUS_CANCELLED, "Cancelled"),
    ]

    id = models.CharField(max_length=80, primary_key=True, default=payment_batch_id)
    reference_no = models.CharField(max_length=80, blank=True)
    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.SET_NULL,
        related_name="payment_batches",
        blank=True,
        null=True,
    )
    supplier_name = models.CharField(max_length=255)
    batch_date = models.DateField(default=timezone.localdate)
    planned_payment_date = models.DateField(blank=True, null=True)
    actual_payment_date = models.DateField(blank=True, null=True)
    status = models.CharField(max_length=40, choices=STATUS_CHOICES, default=STATUS_SCHEDULED)
    bank_reference = models.CharField(max_length=120, blank=True)
    note = models.TextField(blank=True)
    total_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    class Meta:
        ordering = ["-batch_date", "-created_at"]
        indexes = [
            models.Index(fields=["batch_date"], name="inv_pb_date_idx"),
            models.Index(fields=["status", "batch_date"], name="inv_pb_status_date"),
            models.Index(
                fields=["supplier_name", "batch_date"],
                name="inv_pb_supplier_date",
            ),
            models.Index(fields=["planned_payment_date"], name="inv_pb_planned_idx"),
            models.Index(fields=["reference_no"], name="inv_pb_ref_idx"),
        ]

    def __str__(self):
        return self.reference_no or self.id


class PaymentBatchLine(models.Model):
    id = models.CharField(max_length=80, primary_key=True, default=payment_batch_line_id)
    payment_batch = models.ForeignKey(
        PaymentBatch,
        on_delete=models.CASCADE,
        related_name="lines",
    )
    purchase = models.ForeignKey(
        Purchase,
        on_delete=models.PROTECT,
        related_name="payment_batch_lines",
    )
    paid = models.BooleanField(default=False)
    paid_date = models.DateField(blank=True, null=True)
    amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.payment_batch_id} / {self.purchase_id}"


class CreditNote(TimeStampedModel):
    STATUS_ISSUED = "issued"
    STATUS_CANCELLED = "cancelled"

    STATUS_CHOICES = [
        (STATUS_ISSUED, "Issued"),
        (STATUS_CANCELLED, "Cancelled"),
    ]

    id = models.CharField(max_length=80, primary_key=True, default=credit_note_id)
    reference_no = models.CharField(max_length=80, blank=True)
    customer = models.ForeignKey(
        Customer,
        on_delete=models.SET_NULL,
        related_name="credit_notes",
        blank=True,
        null=True,
    )
    customer_name = models.CharField(max_length=255)
    sale = models.ForeignKey(
        Sale,
        on_delete=models.PROTECT,
        related_name="credit_notes",
    )
    sale_reference_no = models.CharField(max_length=80, blank=True)
    billing_note = models.ForeignKey(
        BillingNote,
        on_delete=models.SET_NULL,
        related_name="credit_notes",
        blank=True,
        null=True,
    )
    credit_note_date = models.DateField(default=timezone.localdate)
    status = models.CharField(max_length=40, choices=STATUS_CHOICES, default=STATUS_ISSUED)
    note = models.TextField(blank=True)
    total_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    class Meta:
        ordering = ["-credit_note_date", "-created_at"]
        indexes = [
            models.Index(fields=["credit_note_date"], name="inv_cn_date_idx"),
            models.Index(
                fields=["status", "credit_note_date"],
                name="inv_cn_status_date",
            ),
            models.Index(
                fields=["customer_name", "credit_note_date"],
                name="inv_cn_customer_date",
            ),
            models.Index(fields=["reference_no"], name="inv_cn_ref_idx"),
        ]

    def __str__(self):
        return self.reference_no or self.id


class CreditNoteLine(models.Model):
    id = models.CharField(max_length=80, primary_key=True, default=credit_note_line_id)
    credit_note = models.ForeignKey(
        CreditNote,
        on_delete=models.CASCADE,
        related_name="lines",
    )
    sale_item = models.ForeignKey(
        SaleItem,
        on_delete=models.SET_NULL,
        related_name="credit_note_lines",
        blank=True,
        null=True,
    )
    product_name = models.CharField(max_length=255)
    sku = models.CharField(max_length=80, blank=True)
    quantity = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    unit_price = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.credit_note_id} / {self.product_name}"
