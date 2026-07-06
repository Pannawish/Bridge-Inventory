"""Shared serializer helpers."""

import datetime
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from rest_framework import serializers

from ..models import Customer, Product, Supplier


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


CREDIT_NOTE_VAT_RATE = Decimal("0.07")


def compute_credit_note_vat(line_total, vat_mode):
    """Split a credit-note's line total into (subtotal, vat) using the SAME rule
    the source sale used. Mirrors the frontend computeVatSummary:
      - "included":     line amounts are gross → peel the VAT back out
      - "not_included": line amounts are net  → add VAT on top
      - anything else:  no VAT
    """
    total = decimal_or_zero(line_total)
    if vat_mode == "included":
        subtotal = (total / (Decimal("1") + CREDIT_NOTE_VAT_RATE)).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        return subtotal, total - subtotal
    if vat_mode == "not_included":
        vat = (total * CREDIT_NOTE_VAT_RATE).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        return total, vat
    return total, Decimal("0")


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


def get_selected_list_value(values, index=0):
    cleaned_values = [
        str(value).strip()
        for value in (values or [])
        if str(value or "").strip()
    ]
    if not cleaned_values:
        return ""

    try:
        selected_index = int(index)
    except (TypeError, ValueError):
        selected_index = 0

    if 0 <= selected_index < len(cleaned_values):
        return cleaned_values[selected_index]

    return cleaned_values[0]


def build_business_partner_print_profile(partner, fallback_name="", include_procurement=False):
    if partner is None:
        return {
            "company_name": str(fallback_name or "").strip(),
            "taxpayer_id": "",
            "branch": "",
            "location": "",
            "shipping_address": "",
            "email": "",
            "tel": "",
            "procurement_name": "",
            "procurement_tel": "",
        }

    return {
        "company_name": partner.company_name or str(fallback_name or "").strip(),
        "taxpayer_id": partner.taxpayer_id or "",
        "branch": get_selected_list_value(
            partner.branches,
            getattr(partner, "selected_branch_index", 0),
        ),
        "location": get_selected_list_value(
            partner.locations,
            getattr(partner, "selected_location_index", 0),
        ),
        "shipping_address": get_selected_list_value(
            partner.shipping_addresses,
            getattr(partner, "selected_shipping_address_index", 0),
        ),
        "email": get_selected_list_value(
            partner.emails,
            getattr(partner, "selected_email_index", 0),
        ),
        "tel": get_selected_list_value(
            partner.tels,
            getattr(partner, "selected_tel_index", 0),
        ),
        "procurement_name": (
            getattr(partner, "procurement_name", "") if include_procurement else ""
        ),
        "procurement_tel": (
            getattr(partner, "procurement_tel", "") if include_procurement else ""
        ),
    }


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


def build_product_picture_url(request, picture):
    # DB-stored attachments are served by the product-pictures endpoint; older
    # file-based rows fall back to their media URL.
    if getattr(picture, "content", None):
        path = f"/api/product-pictures/{picture.id}/"
        return request.build_absolute_uri(path) if request else path
    if picture.file:
        return build_file_url(request, picture.file)
    return ""


def build_product_picture_payload(request, picture, selected_picture):
    file_name = (
        picture.filename
        or (picture.file.name.split("/")[-1] if picture.file else "")
        or "Product attachment"
    )
    return {
        "id": picture.id,
        "name": file_name,
        "url": build_product_picture_url(request, picture),
        "isSelected": picture.id == getattr(selected_picture, "id", None),
    }

__all__ = [
    "CREDIT_NOTE_VAT_RATE",
    "_add_business_days",
    "build_business_partner_print_profile",
    "build_document_payload",
    "build_file_url",
    "build_legacy_document_payload",
    "build_product_picture_payload",
    "build_product_picture_url",
    "clean_list",
    "compute_credit_note_vat",
    "decimal_or_none",
    "decimal_or_zero",
    "get_selected_list_value",
    "resolve_customer",
    "resolve_product",
    "resolve_supplier",
    "strip_existing_item_id",
    "validate_active_products_for_create",
    "validate_percentage_discount",
]
