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
    billing_note_date = models.TextField(blank=True)

    class Meta:
        abstract = True

    def __str__(self):
        return self.company_name


class Supplier(BusinessPartner):
    id = models.CharField(max_length=80, primary_key=True, default=supplier_id)

    class Meta:
        ordering = ["company_name"]


class Customer(BusinessPartner):
    id = models.CharField(max_length=80, primary_key=True, default=customer_id)

    class Meta:
        ordering = ["company_name"]


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
    picture_url = models.URLField(max_length=1000, blank=True)
    reorder_level = models.DecimalField(max_digits=12, decimal_places=3, default=0)

    class Meta:
        ordering = ["product_display_id", "product_name"]

    def __str__(self):
        return f"{self.product_name} ({self.sku})"


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
    supplier_name = models.CharField(max_length=255)
    supplier_tax_invoice = models.CharField(max_length=120, blank=True)
    status = models.CharField(max_length=40, choices=STATUS_CHOICES, default=STATUS_ORDERED)
    transaction_date = models.DateField(default=timezone.localdate)
    note = models.TextField(blank=True)
    document = models.FileField(upload_to="documents/purchases/", blank=True, null=True)
    vat_mode = models.CharField(max_length=40, default="not_included")
    total_before_vat = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    vat_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    grand_total = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    class Meta:
        ordering = ["-transaction_date", "-created_at"]

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

    STATUS_CHOICES = [
        (STATUS_DRAFT, "Draft"),
        (STATUS_PARTIALLY_PACKED, "Partially packed"),
        (STATUS_PACKED, "Packed"),
        (STATUS_PARTIALLY_SHIPPED, "Partially shipped"),
        (STATUS_SHIPPED, "Shipped"),
        (STATUS_PARTIALLY_DELIVERED, "Partially delivered"),
        (STATUS_DELIVERED, "Delivered"),
        (STATUS_CANCELLED, "Cancelled"),
    ]

    id = models.CharField(max_length=80, primary_key=True, default=sale_id)
    reference_no = models.CharField(max_length=80, blank=True)
    customer_name = models.CharField(max_length=255)
    status = models.CharField(max_length=40, choices=STATUS_CHOICES, default=STATUS_DRAFT)
    payment_timing = models.CharField(max_length=40, default="instant")
    payment_received_date = models.DateField(blank=True, null=True)
    transaction_date = models.DateField(default=timezone.localdate)
    note = models.TextField(blank=True)
    document = models.FileField(upload_to="documents/sales/", blank=True, null=True)
    vat_mode = models.CharField(max_length=40, default="not_included")
    total_before_vat = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    vat_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    grand_total = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    class Meta:
        ordering = ["-transaction_date", "-created_at"]

    def __str__(self):
        return self.reference_no or self.id


class SaleItem(models.Model):
    ITEM_PENDING = "pending"
    ITEM_PACKED = "packed"
    ITEM_SHIPPED = "shipped"
    ITEM_DELIVERED = "delivered"
    ITEM_CANCELLED = "cancelled"

    ITEM_STATUS_CHOICES = [
        (ITEM_PENDING, "Pending"),
        (ITEM_PACKED, "Packed"),
        (ITEM_SHIPPED, "Shipped"),
        (ITEM_DELIVERED, "Delivered"),
        (ITEM_CANCELLED, "Cancelled"),
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
