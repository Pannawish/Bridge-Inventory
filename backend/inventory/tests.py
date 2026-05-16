import json
import shutil
import tempfile
from decimal import Decimal

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import (
    BillingNote,
    BillingNoteLine,
    Customer,
    PaymentBatch,
    PaymentBatchLine,
    Product,
    ProductPicture,
    Purchase,
    PurchaseItem,
    Quotation,
    QuotationItem,
    Sale,
    SaleItem,
    Supplier,
)
from .serializers import SaleSerializer


TEST_MEDIA_ROOT = tempfile.mkdtemp()


@override_settings(INVENTORY_DEFAULT_PAGE_SIZE=2, INVENTORY_MAX_PAGE_SIZE=3)
class InventoryPaginationTests(APITestCase):
    def setUp(self):
        for index in range(5):
            Product.objects.create(
                product_display_id=1000 + index,
                sku=f"PAGE-{index}",
                product_name=f"Pagination Product {index}",
            )

    def test_list_without_page_query_keeps_array_response(self):
        response = self.client.get("/api/products/")

        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(response.data, list)
        self.assertEqual(len(response.data), 5)

    def test_page_query_returns_paginated_response(self):
        response = self.client.get("/api/products/", {"page": 2})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 5)
        self.assertEqual(response.data["page"], 2)
        self.assertEqual(response.data["page_size"], 2)
        self.assertEqual(response.data["total_pages"], 3)
        self.assertEqual(
            [item["sku"] for item in response.data["results"]],
            ["PAGE-2", "PAGE-3"],
        )

    def test_requested_page_size_is_capped(self):
        response = self.client.get("/api/products/", {"page": 1, "page_size": 10})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["page_size"], 3)
        self.assertEqual(response.data["total_pages"], 2)
        self.assertEqual(len(response.data["results"]), 3)

    def test_purchase_filters_apply_before_pagination(self):
        Purchase.objects.create(
            reference_no="PO-SEARCH-1",
            supplier_name="Alpha Supplier",
            status=Purchase.STATUS_RECEIVED,
            transaction_date="2026-05-01",
        )
        Purchase.objects.create(
            reference_no="PO-SEARCH-2",
            supplier_name="Beta Supplier",
            status=Purchase.STATUS_ORDERED,
            transaction_date="2026-06-01",
        )

        response = self.client.get(
            "/api/purchases/",
            {
                "page": 1,
                "page_size": 10,
                "search": "alpha",
                "status": Purchase.STATUS_RECEIVED,
                "date_from": "2026-05-01",
                "date_to": "2026-05-31",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["reference_no"], "PO-SEARCH-1")

    def test_product_stock_filter_applies_before_pagination(self):
        product = Product.objects.get(sku="PAGE-0")
        purchase = Purchase.objects.create(
            reference_no="PO-PRODUCT-STOCK",
            supplier_name="Stock Supplier",
            status=Purchase.STATUS_RECEIVED,
            transaction_date="2026-05-01",
        )
        PurchaseItem.objects.create(
            purchase=purchase,
            product=product,
            product_name=product.product_name,
            sku=product.sku,
            item_status=PurchaseItem.ITEM_RECEIVED,
            unit="pcs",
            base_unit="pcs",
            conversion_factor=Decimal("1"),
            quantity=Decimal("5"),
            base_quantity=Decimal("5"),
            unit_cost=Decimal("1"),
            amount=Decimal("5"),
        )

        response = self.client.get(
            "/api/products/",
            {"page": 1, "page_size": 10, "stock_filter": "in-stock"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["sku"], "PAGE-0")

    def test_product_search_matches_display_id_before_pagination(self):
        response = self.client.get(
            "/api/products/",
            {"page": 1, "page_size": 10, "search": "1000"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["sku"], "PAGE-0")

    def test_supplier_search_and_profile_filter_apply_before_pagination(self):
        from .models import Supplier

        Supplier.objects.create(
            company_name="Alpha Supplies",
            taxpayer_id="",
            emails=["alpha@example.com"],
            tels=[],
        )
        Supplier.objects.create(
            company_name="Beta Supplies",
            taxpayer_id="123",
            emails=[],
            tels=["02-000-0000"],
        )

        response = self.client.get(
            "/api/suppliers/",
            {
                "page": 1,
                "page_size": 10,
                "search": "alpha",
                "profile_filter": "missing-tax-id",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["companyName"], "Alpha Supplies")


@override_settings(MEDIA_ROOT=TEST_MEDIA_ROOT)
class ProductPictureUploadTests(APITestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TEST_MEDIA_ROOT, ignore_errors=True)

    def picture_file(self, name):
        return SimpleUploadedFile(name, b"product-picture", content_type="image/png")

    def test_product_picture_upload_rejects_non_image_files(self):
        response = self.client.post(
            "/api/products/",
            {
                "sku": "PIC-BAD",
                "productName": "Bad Picture Product",
                "pictures": [
                    SimpleUploadedFile(
                        "notes.txt",
                        b"not an image",
                        content_type="text/plain",
                    )
                ],
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("Product pictures must be image files", response.data["error"])

    def test_product_create_accepts_multiple_pictures_and_selected_index(self):
        response = self.client.post(
            "/api/products/",
            {
                "sku": "PIC-1",
                "productName": "Picture Product",
                "selected_picture_index": "1",
                "pictures": [
                    self.picture_file("front.png"),
                    self.picture_file("side.png"),
                ],
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(response.data["productPictures"]), 2)
        self.assertEqual(response.data["productPictures"][1]["name"], "side.png")
        self.assertTrue(response.data["productPictures"][1]["isSelected"])
        self.assertEqual(ProductPicture.objects.count(), 2)

    def test_product_update_selects_and_removes_pictures(self):
        product = Product.objects.create(sku="PIC-2", product_name="Picture Product")
        front = ProductPicture.objects.create(
            product=product,
            file=self.picture_file("front.png"),
            is_selected=True,
        )
        side = ProductPicture.objects.create(
            product=product,
            file=self.picture_file("side.png"),
        )

        select_response = self.client.patch(
            f"/api/products/{product.id}/",
            {"selected_picture_id": side.id},
            format="multipart",
        )

        self.assertEqual(select_response.status_code, 200)
        self.assertEqual(select_response.data["selectedPictureId"], side.id)
        self.assertTrue(
            next(
                picture
                for picture in select_response.data["productPictures"]
                if picture["id"] == side.id
            )["isSelected"]
        )

        remove_response = self.client.patch(
            f"/api/products/{product.id}/",
            {"remove_picture_ids": json.dumps([side.id])},
            format="multipart",
        )

        self.assertEqual(remove_response.status_code, 200)
        self.assertEqual(len(remove_response.data["productPictures"]), 1)
        self.assertEqual(remove_response.data["selectedPictureId"], front.id)
        self.assertFalse(ProductPicture.objects.filter(id=side.id).exists())


class SaleStockValidationTests(APITestCase):
    def setUp(self):
        self.product = Product.objects.create(
            sku="STOCK-API-1",
            product_name="Stock API Product",
            stock_base_unit="pcs",
            default_purchase_unit="pcs",
            default_sales_unit="pcs",
        )
        self.today = timezone.localdate()

        purchase = Purchase.objects.create(
            reference_no="PO-STOCK-API",
            supplier_name="Stock Supplier",
            status=Purchase.STATUS_RECEIVED,
            transaction_date=self.today,
        )
        PurchaseItem.objects.create(
            purchase=purchase,
            product=self.product,
            product_name=self.product.product_name,
            sku=self.product.sku,
            item_status=PurchaseItem.ITEM_RECEIVED,
            unit="pcs",
            base_unit="pcs",
            conversion_factor=Decimal("1"),
            quantity=Decimal("10"),
            base_quantity=Decimal("10"),
            unit_cost=Decimal("1"),
            amount=Decimal("10"),
        )

    def sale_payload(self, status, quantity):
        return {
            "customer_name": "Stock Customer",
            "status": status,
            "transaction_date": self.today.isoformat(),
            "items": [
                {
                    "product_id": self.product.id,
                    "product_name": self.product.product_name,
                    "sku": self.product.sku,
                    "unit": "pcs",
                    "base_unit": "pcs",
                    "conversion_factor": "1",
                    "quantity": str(quantity),
                    "base_quantity": str(quantity),
                    "unit_price": "1",
                    "amount": str(quantity),
                }
            ],
        }

    def test_packed_sale_rejects_quantity_above_available_stock(self):
        serializer = SaleSerializer(data=self.sale_payload(Sale.STATUS_PACKED, 11))

        self.assertFalse(serializer.is_valid())
        self.assertIn("Insufficient stock", str(serializer.errors["items"][0]))

    def test_draft_sale_allows_quantity_above_available_stock(self):
        serializer = SaleSerializer(data=self.sale_payload(Sale.STATUS_DRAFT, 11))

        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_existing_packed_sale_update_excludes_its_current_stock_commitment(self):
        sale = Sale.objects.create(
            customer_name="Stock Customer",
            status=Sale.STATUS_PACKED,
            transaction_date=self.today,
        )
        SaleItem.objects.create(
            sale=sale,
            product=self.product,
            product_name=self.product.product_name,
            sku=self.product.sku,
            item_status=SaleItem.ITEM_PACKED,
            unit="pcs",
            base_unit="pcs",
            conversion_factor=Decimal("1"),
            quantity=Decimal("8"),
            base_quantity=Decimal("8"),
            unit_price=Decimal("1"),
            amount=Decimal("8"),
        )

        serializer = SaleSerializer(
            sale,
            data={"status": Sale.STATUS_PACKED},
            partial=True,
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_status_patch_to_packed_updates_items_and_reduces_available_stock(self):
        sale = Sale.objects.create(
            customer_name="Stock Customer",
            status=Sale.STATUS_DRAFT,
            transaction_date=self.today,
        )
        SaleItem.objects.create(
            sale=sale,
            product=self.product,
            product_name=self.product.product_name,
            sku=self.product.sku,
            item_status=SaleItem.ITEM_PENDING,
            unit="pcs",
            base_unit="pcs",
            conversion_factor=Decimal("1"),
            quantity=Decimal("4"),
            base_quantity=Decimal("4"),
            unit_price=Decimal("1"),
            amount=Decimal("4"),
        )

        response = self.client.patch(
            f"/api/sales/{sale.id}/",
            {"status": Sale.STATUS_PACKED},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], Sale.STATUS_PACKED)
        self.assertEqual(response.data["items"][0]["item_status"], SaleItem.ITEM_PACKED)

        product_response = self.client.get(f"/api/products/{self.product.id}/")

        self.assertEqual(product_response.status_code, 200)
        self.assertEqual(product_response.data["current_stock"], Decimal("6"))

    def test_item_status_to_packed_rejects_quantity_above_available_stock(self):
        sale = Sale.objects.create(
            customer_name="Stock Customer",
            status=Sale.STATUS_DRAFT,
            transaction_date=self.today,
        )

        payload = self.sale_payload(Sale.STATUS_PARTIALLY_PACKED, 11)
        payload["items"][0]["item_status"] = SaleItem.ITEM_PACKED

        response = self.client.patch(
            f"/api/sales/{sale.id}/",
            payload,
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("Insufficient stock", response.data["error"])

    def test_existing_packed_sale_can_ship_when_seed_data_is_oversold(self):
        other_sale = Sale.objects.create(
            customer_name="Other Stock Customer",
            status=Sale.STATUS_PACKED,
            transaction_date=self.today,
        )
        SaleItem.objects.create(
            sale=other_sale,
            product=self.product,
            product_name=self.product.product_name,
            sku=self.product.sku,
            item_status=SaleItem.ITEM_PACKED,
            unit="pcs",
            base_unit="pcs",
            conversion_factor=Decimal("1"),
            quantity=Decimal("10"),
            base_quantity=Decimal("10"),
            unit_price=Decimal("1"),
            amount=Decimal("10"),
        )
        sale = Sale.objects.create(
            customer_name="Stock Customer",
            status=Sale.STATUS_PACKED,
            transaction_date=self.today,
        )
        SaleItem.objects.create(
            sale=sale,
            product=self.product,
            product_name=self.product.product_name,
            sku=self.product.sku,
            item_status=SaleItem.ITEM_PACKED,
            unit="pcs",
            base_unit="pcs",
            conversion_factor=Decimal("1"),
            quantity=Decimal("5"),
            base_quantity=Decimal("5"),
            unit_price=Decimal("1"),
            amount=Decimal("5"),
        )

        response = self.client.patch(
            f"/api/sales/{sale.id}/",
            {"status": Sale.STATUS_SHIPPED},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], Sale.STATUS_SHIPPED)
        self.assertEqual(response.data["items"][0]["item_status"], SaleItem.ITEM_SHIPPED)

    def test_item_status_pending_releases_available_stock(self):
        sale = Sale.objects.create(
            customer_name="Stock Customer",
            status=Sale.STATUS_PACKED,
            transaction_date=self.today,
        )
        SaleItem.objects.create(
            sale=sale,
            product=self.product,
            product_name=self.product.product_name,
            sku=self.product.sku,
            item_status=SaleItem.ITEM_PACKED,
            unit="pcs",
            base_unit="pcs",
            conversion_factor=Decimal("1"),
            quantity=Decimal("4"),
            base_quantity=Decimal("4"),
            unit_price=Decimal("1"),
            amount=Decimal("4"),
        )

        response = self.client.patch(
            f"/api/sales/{sale.id}/",
            self.sale_payload(Sale.STATUS_DRAFT, 4),
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], Sale.STATUS_DRAFT)
        self.assertEqual(response.data["items"][0]["item_status"], SaleItem.ITEM_PENDING)

        product_response = self.client.get(f"/api/products/{self.product.id}/")

        self.assertEqual(product_response.status_code, 200)
        self.assertEqual(product_response.data["current_stock"], Decimal("10"))

    def test_draft_sale_update_preserves_cancelled_item_status(self):
        sale = Sale.objects.create(
            customer_name="Stock Customer",
            status=Sale.STATUS_DRAFT,
            transaction_date=self.today,
        )

        payload = self.sale_payload(Sale.STATUS_DRAFT, 4)
        payload["items"].append(
            {
                **payload["items"][0],
                "quantity": "2",
                "base_quantity": "2",
                "amount": "2",
                "item_status": SaleItem.ITEM_PENDING,
            }
        )
        payload["items"][0]["item_status"] = SaleItem.ITEM_CANCELLED

        response = self.client.patch(
            f"/api/sales/{sale.id}/",
            payload,
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], Sale.STATUS_DRAFT)
        self.assertCountEqual(
            [item["item_status"] for item in response.data["items"]],
            [SaleItem.ITEM_CANCELLED, SaleItem.ITEM_PENDING],
        )

    def test_packed_sale_update_preserves_cancelled_item_status(self):
        sale = Sale.objects.create(
            customer_name="Stock Customer",
            status=Sale.STATUS_PACKED,
            transaction_date=self.today,
        )

        payload = self.sale_payload(Sale.STATUS_PACKED, 4)
        payload["items"][0]["item_status"] = SaleItem.ITEM_CANCELLED
        payload["items"].append(
            {
                **payload["items"][0],
                "quantity": "2",
                "base_quantity": "2",
                "amount": "2",
                "item_status": SaleItem.ITEM_PACKED,
            }
        )

        response = self.client.patch(
            f"/api/sales/{sale.id}/",
            payload,
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], Sale.STATUS_PACKED)
        self.assertCountEqual(
            [item["item_status"] for item in response.data["items"]],
            [SaleItem.ITEM_CANCELLED, SaleItem.ITEM_PACKED],
        )

    def test_status_patch_to_cancelled_releases_available_stock(self):
        sale = Sale.objects.create(
            customer_name="Stock Customer",
            status=Sale.STATUS_PACKED,
            transaction_date=self.today,
        )
        SaleItem.objects.create(
            sale=sale,
            product=self.product,
            product_name=self.product.product_name,
            sku=self.product.sku,
            item_status=SaleItem.ITEM_PACKED,
            unit="pcs",
            base_unit="pcs",
            conversion_factor=Decimal("1"),
            quantity=Decimal("4"),
            base_quantity=Decimal("4"),
            unit_price=Decimal("1"),
            amount=Decimal("4"),
        )

        response = self.client.patch(
            f"/api/sales/{sale.id}/",
            {"status": Sale.STATUS_CANCELLED},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], Sale.STATUS_CANCELLED)
        self.assertEqual(response.data["items"][0]["item_status"], SaleItem.ITEM_CANCELLED)

        product_response = self.client.get(f"/api/products/{self.product.id}/")

        self.assertEqual(product_response.status_code, 200)
        self.assertEqual(product_response.data["current_stock"], Decimal("10"))


class RelationalNormalizationTests(APITestCase):
    def setUp(self):
        self.today = timezone.localdate()
        self.supplier = Supplier.objects.create(company_name="Normalized Supplier")
        self.customer = Customer.objects.create(company_name="Normalized Customer")
        self.product = Product.objects.create(
            sku="NORM-1",
            product_name="Normalized Product",
        )

    def test_purchase_and_sale_resolve_partner_foreign_keys_from_names(self):
        purchase_response = self.client.post(
            "/api/purchases/",
            {
                "reference_no": "PO-NORM",
                "supplier_name": self.supplier.company_name,
                "transaction_date": self.today.isoformat(),
            },
            format="json",
        )
        sale_response = self.client.post(
            "/api/sales/",
            {
                "reference_no": "SO-NORM",
                "customer_name": self.customer.company_name,
                "status": Sale.STATUS_DRAFT,
                "transaction_date": self.today.isoformat(),
            },
            format="json",
        )

        self.assertEqual(purchase_response.status_code, 201)
        self.assertEqual(sale_response.status_code, 201)
        self.assertEqual(purchase_response.data["supplier_id"], self.supplier.id)
        self.assertEqual(sale_response.data["customer_id"], self.customer.id)
        self.assertEqual(
            Purchase.objects.get(id=purchase_response.data["id"]).supplier_id,
            self.supplier.id,
        )
        self.assertEqual(
            Sale.objects.get(id=sale_response.data["id"]).customer_id,
            self.customer.id,
        )

    def test_quotation_items_are_normalized_without_changing_api_shape(self):
        response = self.client.post(
            "/api/quotations/",
            {
                "reference_no": "QT-NORM",
                "quotation_date": self.today.isoformat(),
                "valid_until_date": self.today.isoformat(),
                "customer_name": self.customer.company_name,
                "supplier_name": self.supplier.company_name,
                "items": [
                    {
                        "line_id": "line-1",
                        "product_id": self.product.id,
                        "product_name": self.product.product_name,
                        "sku": self.product.sku,
                        "unit": "pcs",
                        "quantity": "2",
                        "sale_price": "10",
                        "cost_price": "7",
                        "discounts": ["5"],
                    }
                ],
                "total_before_vat": "19",
                "vat_amount": "1.33",
                "grand_total": "20.33",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        quotation = Quotation.objects.get(id=response.data["id"])
        quotation_item = QuotationItem.objects.get(quotation=quotation)

        self.assertEqual(response.data["customer_id"], self.customer.id)
        self.assertEqual(response.data["supplier_id"], self.supplier.id)
        self.assertEqual(len(response.data["items"]), 1)
        self.assertEqual(response.data["items"][0]["line_id"], quotation_item.id)
        self.assertEqual(response.data["items"][0]["product_id"], self.product.id)
        self.assertEqual(response.data["items"][0]["base_unit"], self.product.stock_base_unit)
        self.assertEqual(quotation.customer_id, self.customer.id)
        self.assertEqual(quotation.supplier_id, self.supplier.id)
        self.assertEqual(quotation_item.product_id, self.product.id)
        self.assertEqual(quotation_item.quantity, Decimal("2.000"))
        self.assertEqual(quotation_item.base_quantity, Decimal("2.000"))


class ReferenceNumberTests(APITestCase):
    def setUp(self):
        self.today = timezone.localdate()
        self.year_month = f"{self.today.year + 543}"[-2:] + f"{self.today.month:02d}"
        self.supplier = Supplier.objects.create(company_name="Reference Supplier")
        self.customer = Customer.objects.create(company_name="Reference Customer")
        self.product = Product.objects.create(
            sku="REF-1",
            product_name="Reference Product",
        )

    def reference(self, prefix, serial):
        return f"{prefix}-{self.year_month}-{serial:03d}"

    def test_purchase_sale_and_quotation_duplicate_references_are_advanced(self):
        Purchase.objects.create(
            reference_no=self.reference("PO", 3),
            supplier_name=self.supplier.company_name,
            transaction_date=self.today,
        )
        Sale.objects.create(
            reference_no=self.reference("TI", 3),
            customer_name=self.customer.company_name,
            status=Sale.STATUS_DRAFT,
            transaction_date=self.today,
        )
        Quotation.objects.create(
            reference_no=self.reference("QT", 3),
            quotation_date=self.today,
            valid_until_date=self.today,
            customer_name=self.customer.company_name,
        )

        purchase_response = self.client.post(
            "/api/purchases/",
            {
                "reference_no": self.reference("PO", 3),
                "supplier_name": self.supplier.company_name,
                "transaction_date": self.today.isoformat(),
            },
            format="json",
        )
        sale_response = self.client.post(
            "/api/sales/",
            {
                "reference_no": self.reference("TI", 3),
                "customer_name": self.customer.company_name,
                "status": Sale.STATUS_DRAFT,
                "transaction_date": self.today.isoformat(),
            },
            format="json",
        )
        quotation_response = self.client.post(
            "/api/quotations/",
            {
                "reference_no": self.reference("QT", 3),
                "quotation_date": self.today.isoformat(),
                "valid_until_date": self.today.isoformat(),
                "customer_name": self.customer.company_name,
                "items": [
                    {
                        "product_id": self.product.id,
                        "product_name": self.product.product_name,
                        "sku": self.product.sku,
                        "unit": "pcs",
                        "quantity": "1",
                        "sale_price": "10",
                        "cost_price": "7",
                        "discounts": ["0"],
                    }
                ],
            },
            format="json",
        )

        self.assertEqual(purchase_response.status_code, 201)
        self.assertEqual(sale_response.status_code, 201)
        self.assertEqual(quotation_response.status_code, 201)
        self.assertEqual(purchase_response.data["reference_no"], self.reference("PO", 4))
        self.assertEqual(sale_response.data["reference_no"], self.reference("TI", 4))
        self.assertEqual(quotation_response.data["reference_no"], self.reference("QT", 4))


class LookupEligibilityTests(APITestCase):
    def setUp(self):
        self.today = timezone.localdate()

    def test_product_lookup_returns_current_stock_without_transaction_detail(self):
        product = Product.objects.create(
            sku="LOOKUP-1",
            product_name="Lookup Product",
            stock_base_unit="pcs",
            default_purchase_unit="pcs",
            default_sales_unit="pcs",
        )
        purchase = Purchase.objects.create(
            reference_no="PO-LOOKUP",
            supplier_name="Lookup Supplier",
            status=Purchase.STATUS_RECEIVED,
            transaction_date=self.today,
        )
        PurchaseItem.objects.create(
            purchase=purchase,
            product=product,
            product_name=product.product_name,
            sku=product.sku,
            item_status=PurchaseItem.ITEM_RECEIVED,
            unit="pcs",
            base_unit="pcs",
            conversion_factor=Decimal("1"),
            quantity=Decimal("7"),
            base_quantity=Decimal("7"),
            unit_cost=Decimal("2"),
            amount=Decimal("14"),
        )

        response = self.client.get("/api/lookups/products/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["sku"], "LOOKUP-1")
        self.assertEqual(response.data[0]["current_stock"], Decimal("7"))

    def test_dashboard_stock_report_includes_backend_transaction_metrics(self):
        product = Product.objects.create(
            sku="DASH-STOCK",
            product_name="Dashboard Stock Product",
            reorder_level=Decimal("2"),
        )
        purchase = Purchase.objects.create(
            reference_no="PO-DASH",
            supplier_name="Dashboard Supplier",
            status=Purchase.STATUS_RECEIVED,
            transaction_date=self.today,
        )
        PurchaseItem.objects.create(
            purchase=purchase,
            product=product,
            product_name=product.product_name,
            sku=product.sku,
            item_status=PurchaseItem.ITEM_RECEIVED,
            received_date=self.today,
            unit="pcs",
            base_unit="pcs",
            conversion_factor=Decimal("1"),
            quantity=Decimal("10"),
            base_quantity=Decimal("10"),
            unit_cost=Decimal("2"),
            amount=Decimal("20"),
        )
        sale = Sale.objects.create(
            reference_no="SO-DASH",
            customer_name="Dashboard Customer",
            status=Sale.STATUS_PACKED,
            transaction_date=self.today,
        )
        SaleItem.objects.create(
            sale=sale,
            product=product,
            product_name=product.product_name,
            sku=product.sku,
            item_status=SaleItem.ITEM_PACKED,
            unit="pcs",
            base_unit="pcs",
            conversion_factor=Decimal("1"),
            quantity=Decimal("4"),
            base_quantity=Decimal("4"),
            unit_price=Decimal("5"),
            amount=Decimal("20"),
        )

        response = self.client.get("/api/dashboard/")

        self.assertEqual(response.status_code, 200)
        row = next(
            item for item in response.data["stock_report"] if item["product_id"] == product.id
        )
        self.assertEqual(row["received_purchase_units"], 10)
        self.assertEqual(row["allocated_sales_units"], 4)
        self.assertEqual(row["available_stock"], 6)
        self.assertEqual(row["committed_sales_value"], 20)
        self.assertTrue(row["backend_calculated"])

    def test_product_history_endpoint_returns_only_matching_transactions(self):
        product = Product.objects.create(
            sku="HISTORY-1",
            product_name="History Product",
        )
        other_product = Product.objects.create(
            sku="HISTORY-2",
            product_name="Other History Product",
        )
        matching_purchase = Purchase.objects.create(
            reference_no="PO-HISTORY",
            supplier_name="History Supplier",
            status=Purchase.STATUS_RECEIVED,
            transaction_date=self.today,
        )
        PurchaseItem.objects.create(
            purchase=matching_purchase,
            product=product,
            product_name=product.product_name,
            sku=product.sku,
            item_status=PurchaseItem.ITEM_RECEIVED,
            unit="pcs",
            base_unit="pcs",
            conversion_factor=Decimal("1"),
            quantity=Decimal("3"),
            base_quantity=Decimal("3"),
            unit_cost=Decimal("2"),
            amount=Decimal("6"),
        )
        other_purchase = Purchase.objects.create(
            reference_no="PO-OTHER-HISTORY",
            supplier_name="History Supplier",
            status=Purchase.STATUS_RECEIVED,
            transaction_date=self.today,
        )
        PurchaseItem.objects.create(
            purchase=other_purchase,
            product=other_product,
            product_name=other_product.product_name,
            sku=other_product.sku,
            item_status=PurchaseItem.ITEM_RECEIVED,
            unit="pcs",
            base_unit="pcs",
            conversion_factor=Decimal("1"),
            quantity=Decimal("5"),
            base_quantity=Decimal("5"),
            unit_cost=Decimal("2"),
            amount=Decimal("10"),
        )
        matching_sale = Sale.objects.create(
            reference_no="SO-HISTORY",
            customer_name="History Customer",
            status=Sale.STATUS_PACKED,
            transaction_date=self.today,
        )
        SaleItem.objects.create(
            sale=matching_sale,
            product=product,
            product_name=product.product_name,
            sku=product.sku,
            item_status=SaleItem.ITEM_PACKED,
            unit="pcs",
            base_unit="pcs",
            conversion_factor=Decimal("1"),
            quantity=Decimal("1"),
            base_quantity=Decimal("1"),
            unit_price=Decimal("4"),
            amount=Decimal("4"),
        )

        response = self.client.get(f"/api/products/{product.id}/history/")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["has_transaction_history"])
        self.assertEqual([row["reference_no"] for row in response.data["purchases"]], ["PO-HISTORY"])
        self.assertEqual([row["reference_no"] for row in response.data["sales"]], ["SO-HISTORY"])

    def test_product_history_endpoint_counts_quotation_lines_as_history(self):
        product = Product.objects.create(
            sku="HISTORY-QUOTE",
            product_name="Quoted History Product",
        )
        quotation = Quotation.objects.create(
            reference_no="QT-HISTORY",
            customer_name="History Customer",
            quotation_date=self.today,
        )
        QuotationItem.objects.create(
            quotation=quotation,
            product=product,
            product_name=product.product_name,
            sku=product.sku,
            unit="pcs",
            base_unit="pcs",
            conversion_factor=Decimal("1"),
            quantity=Decimal("1"),
            base_quantity=Decimal("1"),
            sale_price=Decimal("4"),
        )

        response = self.client.get(f"/api/products/{product.id}/history/")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["has_transaction_history"])

    def test_product_delete_without_transaction_history_succeeds(self):
        product = Product.objects.create(
            sku="DELETE-AVAILABLE",
            product_name="Deletable Product",
        )

        response = self.client.delete(f"/api/products/{product.id}/")

        self.assertEqual(response.status_code, 204)
        self.assertFalse(Product.objects.filter(pk=product.id).exists())

    def test_product_delete_with_transaction_history_is_blocked(self):
        product = Product.objects.create(
            sku="DELETE-BLOCKED",
            product_name="Blocked Product",
        )
        purchase = Purchase.objects.create(
            reference_no="PO-DELETE-BLOCKED",
            supplier_name="History Supplier",
            status=Purchase.STATUS_RECEIVED,
            transaction_date=self.today,
        )
        PurchaseItem.objects.create(
            purchase=purchase,
            product=product,
            product_name=product.product_name,
            sku=product.sku,
            item_status=PurchaseItem.ITEM_RECEIVED,
            unit="pcs",
            base_unit="pcs",
            conversion_factor=Decimal("1"),
            quantity=Decimal("3"),
            base_quantity=Decimal("3"),
            unit_cost=Decimal("2"),
            amount=Decimal("6"),
        )

        response = self.client.delete(f"/api/products/{product.id}/")

        self.assertEqual(response.status_code, 400)
        self.assertIn("purchase, sales, or quotation history", response.data["error"])
        self.assertTrue(Product.objects.filter(pk=product.id).exists())

    def test_billing_note_eligibility_excludes_sales_already_on_active_note(self):
        Customer.objects.create(company_name="Alpha Customer")
        available = Sale.objects.create(
            reference_no="SO-ELIGIBLE",
            customer_name="Alpha Customer",
            status=Sale.STATUS_DELIVERED,
            transaction_date=self.today,
            grand_total=Decimal("100"),
        )
        used = Sale.objects.create(
            reference_no="SO-USED",
            customer_name="Alpha Customer",
            status=Sale.STATUS_DELIVERED,
            transaction_date=self.today,
            grand_total=Decimal("200"),
        )
        cancelled_link = Sale.objects.create(
            reference_no="SO-CANCELLED-LINK",
            customer_name="Alpha Customer",
            status=Sale.STATUS_SHIPPED,
            transaction_date=self.today,
            grand_total=Decimal("300"),
        )
        draft_sale = Sale.objects.create(
            reference_no="SO-DRAFT",
            customer_name="Alpha Customer",
            status=Sale.STATUS_DRAFT,
            transaction_date=self.today,
            grand_total=Decimal("400"),
        )

        active_note = BillingNote.objects.create(
            reference_no="BN-ACTIVE",
            customer_name="Alpha Customer",
            billing_note_date=self.today,
            status=BillingNote.STATUS_ISSUED,
            total_amount=Decimal("200"),
        )
        BillingNoteLine.objects.create(
            billing_note=active_note,
            sale=used,
            amount=Decimal("200"),
        )
        cancelled_note = BillingNote.objects.create(
            reference_no="BN-CANCELLED",
            customer_name="Alpha Customer",
            billing_note_date=self.today,
            status=BillingNote.STATUS_CANCELLED,
            total_amount=Decimal("300"),
        )
        BillingNoteLine.objects.create(
            billing_note=cancelled_note,
            sale=cancelled_link,
            amount=Decimal("300"),
        )

        response = self.client.get("/api/eligibility/billing-note-sales/")

        self.assertEqual(response.status_code, 200)
        sale_ids = {sale["id"] for sale in response.data["sales"]}
        self.assertIn(available.id, sale_ids)
        self.assertIn(cancelled_link.id, sale_ids)
        self.assertNotIn(used.id, sale_ids)
        self.assertNotIn(draft_sale.id, sale_ids)
        self.assertEqual(response.data["customers"][0]["companyName"], "Alpha Customer")
        self.assertIn("summary", response.data)
        self.assertTrue(response.data["next_reference_no"].startswith("BN-"))

    def test_payment_batch_eligibility_excludes_purchases_already_on_active_batch(self):
        Supplier.objects.create(company_name="Alpha Supplier")
        available = Purchase.objects.create(
            reference_no="PO-ELIGIBLE",
            supplier_name="Alpha Supplier",
            status=Purchase.STATUS_RECEIVED,
            transaction_date=self.today,
            grand_total=Decimal("100"),
        )
        used = Purchase.objects.create(
            reference_no="PO-USED",
            supplier_name="Alpha Supplier",
            status=Purchase.STATUS_RECEIVED,
            transaction_date=self.today,
            grand_total=Decimal("200"),
        )
        cancelled_link = Purchase.objects.create(
            reference_no="PO-CANCELLED-LINK",
            supplier_name="Alpha Supplier",
            status=Purchase.STATUS_PARTIALLY_RECEIVED,
            transaction_date=self.today,
            grand_total=Decimal("300"),
        )
        ordered_purchase = Purchase.objects.create(
            reference_no="PO-ORDERED",
            supplier_name="Alpha Supplier",
            status=Purchase.STATUS_ORDERED,
            transaction_date=self.today,
            grand_total=Decimal("400"),
        )

        active_batch = PaymentBatch.objects.create(
            reference_no="PMT-ACTIVE",
            supplier_name="Alpha Supplier",
            batch_date=self.today,
            status=PaymentBatch.STATUS_SCHEDULED,
            total_amount=Decimal("200"),
        )
        PaymentBatchLine.objects.create(
            payment_batch=active_batch,
            purchase=used,
            amount=Decimal("200"),
        )
        cancelled_batch = PaymentBatch.objects.create(
            reference_no="PMT-CANCELLED",
            supplier_name="Alpha Supplier",
            batch_date=self.today,
            status=PaymentBatch.STATUS_CANCELLED,
            total_amount=Decimal("300"),
        )
        PaymentBatchLine.objects.create(
            payment_batch=cancelled_batch,
            purchase=cancelled_link,
            amount=Decimal("300"),
        )

        response = self.client.get("/api/eligibility/payment-batch-purchases/")

        self.assertEqual(response.status_code, 200)
        purchase_ids = {purchase["id"] for purchase in response.data["purchases"]}
        self.assertIn(available.id, purchase_ids)
        self.assertIn(cancelled_link.id, purchase_ids)
        self.assertNotIn(used.id, purchase_ids)
        self.assertNotIn(ordered_purchase.id, purchase_ids)
        self.assertEqual(response.data["suppliers"][0]["companyName"], "Alpha Supplier")
        self.assertIn("summary", response.data)
        self.assertTrue(response.data["next_reference_no"].startswith("PMT-"))
