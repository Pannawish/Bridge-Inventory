from io import StringIO
import json
import shutil
import tempfile
from datetime import timedelta
from decimal import Decimal

from django.core.management import call_command
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db.models import Q
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

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
    ProductSupplier,
    Purchase,
    PurchaseItem,
    Quotation,
    QuotationItem,
    Sale,
    SaleItemAllocation,
    SaleItem,
    Supplier,
)
from .serializers import SaleSerializer
from .services import (
    SALE_STOCK_DEDUCTED_STATUSES,
    answer_inventory_question,
    build_finance_segment,
    get_available_stock_layers,
)


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

    def test_purchase_product_filter_returns_only_matching_orders(self):
        target = Product.objects.get(sku="PAGE-0")
        other = Product.objects.get(sku="PAGE-1")
        for product, ref in ((target, "PO-PROD-A"), (other, "PO-PROD-B")):
            purchase = Purchase.objects.create(
                reference_no=ref,
                supplier_name="Filter Supplier",
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
                quantity=Decimal("1"),
                base_quantity=Decimal("1"),
                unit_cost=Decimal("1"),
                amount=Decimal("1"),
            )

        response = self.client.get(
            "/api/purchases/",
            {"page": 1, "page_size": 10, "product": target.id},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["reference_no"], "PO-PROD-A")

    def test_sale_product_filter_returns_only_matching_orders(self):
        target = Product.objects.get(sku="PAGE-0")
        other = Product.objects.get(sku="PAGE-1")
        for product, ref in ((target, "SO-PROD-A"), (other, "SO-PROD-B")):
            sale = Sale.objects.create(
                reference_no=ref,
                customer_name="Filter Customer",
                status=Sale.STATUS_PACKED,
                transaction_date="2026-05-01",
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
                quantity=Decimal("1"),
                base_quantity=Decimal("1"),
                unit_price=Decimal("8"),
                unit_cost=Decimal("4"),
                amount=Decimal("8"),
            )

        response = self.client.get(
            "/api/sales/",
            {"page": 1, "page_size": 10, "product": target.id},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["reference_no"], "SO-PROD-A")

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

    def test_product_list_includes_average_cost_metrics_from_last_three_received_purchases(self):
        product = Product.objects.get(sku="PAGE-0")
        purchase_specs = (
            (Decimal("1"), Decimal("1"), Decimal("10")),
            (Decimal("1"), Decimal("5"), Decimal("100")),
            (Decimal("2"), Decimal("10"), Decimal("300")),
            (Decimal("1"), Decimal("20"), Decimal("800")),
        )
        for index, (quantity, conversion_factor, unit_cost) in enumerate(purchase_specs, start=1):
            purchase = Purchase.objects.create(
                reference_no=f"PO-AVG-COST-{index}",
                supplier_name="Cost Supplier",
                status=Purchase.STATUS_RECEIVED,
                transaction_date=f"2026-05-0{index}",
            )
            PurchaseItem.objects.create(
                purchase=purchase,
                product=product,
                product_name=product.product_name,
                sku=product.sku,
                item_status=PurchaseItem.ITEM_RECEIVED,
                unit="pcs",
                base_unit="pcs",
                conversion_factor=conversion_factor,
                quantity=quantity,
                base_quantity=quantity * conversion_factor,
                unit_cost=unit_cost,
                amount=quantity * unit_cost,
            )
        sale = Sale.objects.create(
            reference_no="SO-AVG-COST",
            customer_name="Cost Customer",
            status=Sale.STATUS_PACKED,
            transaction_date="2026-05-02",
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
            quantity=Decimal("2"),
            base_quantity=Decimal("2"),
            unit_price=Decimal("8"),
            unit_cost=Decimal("4"),
            amount=Decimal("16"),
        )

        response = self.client.get(
            "/api/products/",
            {"page": 1, "page_size": 10, "search": "PAGE-0"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        row = response.data["results"][0]
        self.assertEqual(row["sku"], "PAGE-0")
        self.assertEqual(Decimal(row["average_unit_cost"]), Decimal("30"))
        self.assertEqual(Decimal(row["current_stock"]), Decimal("44"))
        self.assertEqual(row["received_purchase_count"], 4)
        self.assertEqual(row["active_sales_count"], 1)

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


@override_settings(MEDIA_ROOT=TEST_MEDIA_ROOT)
class ClearOperationalDataCommandTests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TEST_MEDIA_ROOT, ignore_errors=True)

    def setUp(self):
        self.command_stdout = StringIO()
        self.today = timezone.localdate()
        self.parent_category = Category.objects.create(name="Command Parent")
        self.child_category = Category.objects.create(
            name="Command Child",
            parent=self.parent_category,
        )
        self.supplier = Supplier.objects.create(company_name="Command Supplier")
        self.customer = Customer.objects.create(company_name="Command Customer")
        self.product = Product.objects.create(
            sku="CMD-CLEAR-1",
            product_name="Command Product",
            category=self.child_category,
            category_name=self.child_category.name,
        )
        ProductPicture.objects.create(
            product=self.product,
            file=SimpleUploadedFile(
                "command-product.png",
                b"command-product-picture",
                content_type="image/png",
            ),
        )
        Quotation.objects.create(
            reference_no="QT-CLEAR-CMD",
            quotation_date=self.today,
            customer=self.customer,
            customer_name=self.customer.company_name,
            supplier=self.supplier,
            supplier_name=self.supplier.company_name,
        )
        Purchase.objects.create(
            reference_no="PO-CLEAR-CMD",
            supplier=self.supplier,
            supplier_name=self.supplier.company_name,
            transaction_date=self.today,
        )
        Sale.objects.create(
            reference_no="SO-CLEAR-CMD",
            customer=self.customer,
            customer_name=self.customer.company_name,
            transaction_date=self.today,
        )

    def test_clear_operational_data_keeps_master_data_by_default(self):
        call_command(
            "clear_operational_data",
            verbosity=0,
            stdout=self.command_stdout,
        )

        self.assertEqual(Quotation.objects.count(), 0)
        self.assertEqual(Purchase.objects.count(), 0)
        self.assertEqual(Sale.objects.count(), 0)
        self.assertEqual(Category.objects.count(), 2)
        self.assertEqual(Product.objects.count(), 1)
        self.assertEqual(ProductPicture.objects.count(), 1)
        self.assertEqual(Supplier.objects.count(), 1)
        self.assertEqual(Customer.objects.count(), 1)
        self.assertIn(
            "Operational data cleared. Master data was kept unchanged.",
            self.command_stdout.getvalue(),
        )

    def test_include_master_data_clears_master_records_too(self):
        call_command(
            "clear_operational_data",
            include_master_data=True,
            verbosity=0,
            stdout=self.command_stdout,
        )

        self.assertEqual(Quotation.objects.count(), 0)
        self.assertEqual(Purchase.objects.count(), 0)
        self.assertEqual(Sale.objects.count(), 0)
        self.assertEqual(Category.objects.count(), 0)
        self.assertEqual(Product.objects.count(), 0)
        self.assertEqual(ProductPicture.objects.count(), 0)
        self.assertEqual(Supplier.objects.count(), 0)
        self.assertEqual(Customer.objects.count(), 0)
        self.assertIn(
            "Operational data cleared. Master data was also cleared.",
            self.command_stdout.getvalue(),
        )


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

    def test_status_patch_to_returned_releases_available_stock(self):
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
            {"status": Sale.STATUS_RETURNED},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], Sale.STATUS_RETURNED)
        self.assertEqual(response.data["items"][0]["item_status"], SaleItem.ITEM_RETURNED)

        product_response = self.client.get(f"/api/products/{self.product.id}/")

        self.assertEqual(product_response.status_code, 200)
        self.assertEqual(product_response.data["current_stock"], Decimal("10"))

    def test_cancelled_sale_item_can_be_restored_to_pending(self):
        sale = Sale.objects.create(
            customer_name="Stock Customer",
            status=Sale.STATUS_CANCELLED,
            transaction_date=self.today,
        )

        payload = self.sale_payload(Sale.STATUS_CANCELLED, 4)
        payload["items"][0]["item_status"] = SaleItem.ITEM_PENDING

        response = self.client.patch(
            f"/api/sales/{sale.id}/",
            payload,
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], Sale.STATUS_DRAFT)
        self.assertEqual(response.data["items"][0]["item_status"], SaleItem.ITEM_PENDING)

    def test_sale_accepts_customer_po_reference(self):
        payload = self.sale_payload(Sale.STATUS_DRAFT, 4)
        payload["customer_po_reference"] = "CPO-12345"

        response = self.client.post("/api/sales/", payload, format="json")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["customer_po_reference"], "CPO-12345")

    def test_stock_filter_insufficient_stock(self):
        # 1. Draft sale with insufficient stock
        sale_insufficient = Sale.objects.create(
            customer_name="Insufficient Customer",
            status=Sale.STATUS_DRAFT,
            transaction_date=self.today,
        )
        SaleItem.objects.create(
            sale=sale_insufficient,
            product=self.product,
            product_name=self.product.product_name,
            sku=self.product.sku,
            item_status=SaleItem.ITEM_PENDING,
            unit="pcs",
            base_unit="pcs",
            conversion_factor=Decimal("1"),
            quantity=Decimal("11"),
            base_quantity=Decimal("11"),
            unit_price=Decimal("1"),
            amount=Decimal("11"),
        )

        # 2. Draft sale with sufficient stock
        sale_sufficient = Sale.objects.create(
            customer_name="Sufficient Customer",
            status=Sale.STATUS_DRAFT,
            transaction_date=self.today,
        )
        SaleItem.objects.create(
            sale=sale_sufficient,
            product=self.product,
            product_name=self.product.product_name,
            sku=self.product.sku,
            item_status=SaleItem.ITEM_PENDING,
            unit="pcs",
            base_unit="pcs",
            conversion_factor=Decimal("1"),
            quantity=Decimal("5"),
            base_quantity=Decimal("5"),
            unit_price=Decimal("1"),
            amount=Decimal("5"),
        )

        # 3. Non-draft sale (partially packed) with an insufficient pending item
        sale_insufficient_nondraft = Sale.objects.create(
            customer_name="Nondraft Insufficient Customer",
            status=Sale.STATUS_PARTIALLY_PACKED,
            transaction_date=self.today,
        )
        SaleItem.objects.create(
            sale=sale_insufficient_nondraft,
            product=self.product,
            product_name=self.product.product_name,
            sku=self.product.sku,
            item_status=SaleItem.ITEM_PENDING,
            unit="pcs",
            base_unit="pcs",
            conversion_factor=Decimal("1"),
            quantity=Decimal("15"),
            base_quantity=Decimal("15"),
            unit_price=Decimal("1"),
            amount=Decimal("15"),
        )

        # 4. Non-draft sale (partially packed) where items are sufficient
        sale_sufficient_nondraft = Sale.objects.create(
            customer_name="Nondraft Sufficient Customer",
            status=Sale.STATUS_PARTIALLY_PACKED,
            transaction_date=self.today,
        )
        SaleItem.objects.create(
            sale=sale_sufficient_nondraft,
            product=self.product,
            product_name=self.product.product_name,
            sku=self.product.sku,
            item_status=SaleItem.ITEM_PENDING,
            unit="pcs",
            base_unit="pcs",
            conversion_factor=Decimal("1"),
            quantity=Decimal("2"),
            base_quantity=Decimal("2"),
            unit_price=Decimal("1"),
            amount=Decimal("2"),
        )

        response = self.client.get("/api/sales/", {"stock_filter": "insufficient_stock"})
        self.assertEqual(response.status_code, 200)

        if isinstance(response.data, list):
            sales_data = response.data
        else:
            sales_data = response.data.get("results", [])

        sale_ids = [s["id"] for s in sales_data]
        self.assertIn(sale_insufficient.id, sale_ids)
        self.assertIn(sale_insufficient_nondraft.id, sale_ids)
        self.assertNotIn(sale_sufficient.id, sale_ids)
        self.assertNotIn(sale_sufficient_nondraft.id, sale_ids)



class SaleItemAllocationTests(APITestCase):
    def setUp(self):
        self.today = timezone.localdate()
        self.product = Product.objects.create(
            sku="ALLOC-1",
            product_name="Allocated Product",
            stock_base_unit="pcs",
            default_purchase_unit="pcs",
            default_sales_unit="pcs",
        )
        self.supplier_a = Supplier.objects.create(company_name="Allocation Supplier A")
        self.supplier_b = Supplier.objects.create(company_name="Allocation Supplier B")
        self.layer_a = self._purchase_item(
            supplier=self.supplier_a,
            reference_no="PO-ALLOC-A",
            quantity="5",
            unit_cost="2",
        )
        self.layer_b = self._purchase_item(
            supplier=self.supplier_b,
            reference_no="PO-ALLOC-B",
            quantity="5",
            unit_cost="3",
        )

    def _purchase_item(self, supplier, reference_no, quantity, unit_cost):
        purchase = Purchase.objects.create(
            reference_no=reference_no,
            supplier=supplier,
            supplier_name=supplier.company_name,
            status=Purchase.STATUS_RECEIVED,
            transaction_date=self.today,
        )
        return PurchaseItem.objects.create(
            purchase=purchase,
            product=self.product,
            product_name=self.product.product_name,
            sku=self.product.sku,
            item_status=PurchaseItem.ITEM_RECEIVED,
            received_date=self.today,
            unit="pcs",
            base_unit="pcs",
            conversion_factor=Decimal("1"),
            quantity=Decimal(quantity),
            base_quantity=Decimal(quantity),
            unit_cost=Decimal(unit_cost),
            amount=Decimal(quantity) * Decimal(unit_cost),
        )

    def _sale_payload(self, quantity, allocations=None, unit_price="10"):
        amount = Decimal(str(quantity)) * Decimal(unit_price)
        item = {
            "product_id": self.product.id,
            "product_name": self.product.product_name,
            "sku": self.product.sku,
            "item_status": SaleItem.ITEM_PACKED,
            "unit": "pcs",
            "base_unit": "pcs",
            "conversion_factor": "1",
            "quantity": str(quantity),
            "base_quantity": str(quantity),
            "unit_price": unit_price,
            "amount": str(amount),
        }
        if allocations is not None:
            item["allocations"] = allocations

        return {
            "customer_name": "Allocation Customer",
            "status": Sale.STATUS_PACKED,
            "transaction_date": self.today.isoformat(),
            "grand_total": str(amount),
            "items": [item],
        }

    def test_packed_sale_allocates_fifo_layers_and_updates_remaining_stock_layers(self):
        serializer = SaleSerializer(data=self._sale_payload("7"))
        self.assertTrue(serializer.is_valid(), serializer.errors)
        sale = serializer.save()

        sale_item = sale.items.first()
        self.assertEqual(sale_item.allocations.count(), 2)
        self.assertEqual(
            SaleItemAllocation.objects.filter(purchase_item=self.layer_a).get().base_quantity,
            Decimal("5.000"),
        )
        self.assertEqual(
            SaleItemAllocation.objects.filter(purchase_item=self.layer_b).get().base_quantity,
            Decimal("2.000"),
        )

        layers = get_available_stock_layers(self.product.id)
        remaining_by_layer = {
            layer["purchase_item_id"]: layer["available_quantity"]
            for layer in layers
        }
        self.assertNotIn(self.layer_a.id, remaining_by_layer)
        self.assertEqual(remaining_by_layer[self.layer_b.id], Decimal("3.000"))

    def test_manual_allocation_uses_selected_supplier_layer_for_margin(self):
        serializer = SaleSerializer(
            data=self._sale_payload(
                "4",
                allocations=[
                    {
                        "purchase_item_id": self.layer_b.id,
                        "base_quantity": "4",
                    }
                ],
            )
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()

        allocation = SaleItemAllocation.objects.get()
        self.assertEqual(allocation.purchase_item_id, self.layer_b.id)
        self.assertEqual(allocation.supplier_name, self.supplier_b.company_name)
        self.assertEqual(allocation.total_cost, Decimal("12.00"))

        finance = build_finance_segment("1w", today=self.today)
        self.assertEqual(Decimal(str(finance["gross_margin"])), Decimal("28"))

    def test_manual_allocation_rejects_quantity_above_selected_layer(self):
        serializer = SaleSerializer(
            data=self._sale_payload(
                "6",
                allocations=[
                    {
                        "purchase_item_id": self.layer_a.id,
                        "base_quantity": "6",
                    }
                ],
            )
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)

        with self.assertRaisesMessage(Exception, "Insufficient stock"):
            serializer.save()

    def test_stock_layers_endpoint_can_exclude_current_sale_item_allocation(self):
        serializer = SaleSerializer(
            data=self._sale_payload(
                "4",
                allocations=[
                    {
                        "purchase_item_id": self.layer_a.id,
                        "base_quantity": "4",
                    }
                ],
            )
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        sale = serializer.save()
        sale_item = sale.items.get()

        response = self.client.get(f"/api/products/{self.product.id}/stock-layers/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            Decimal(str(response.data["layers"][0]["available_quantity"])),
            Decimal("1"),
        )

        exclude_response = self.client.get(
            f"/api/products/{self.product.id}/stock-layers/",
            {"exclude_sale_item_id": sale_item.id},
        )
        self.assertEqual(exclude_response.status_code, 200)
        self.assertEqual(
            Decimal(str(exclude_response.data["layers"][0]["available_quantity"])),
            Decimal("5"),
        )

    def test_purchase_create_syncs_product_supplier_catalog_link(self):
        product = Product.objects.create(
            sku="ALLOC-CATALOG",
            product_name="Catalog Product",
            stock_base_unit="pcs",
            default_purchase_unit="box",
            default_sales_unit="pcs",
        )
        payload = {
            "supplier_id": self.supplier_a.id,
            "supplier_name": self.supplier_a.company_name,
            "status": Purchase.STATUS_RECEIVED,
            "transaction_date": self.today.isoformat(),
            "items": [
                {
                    "product_id": product.id,
                    "product_name": product.product_name,
                    "sku": product.sku,
                    "item_status": PurchaseItem.ITEM_RECEIVED,
                    "unit": "box",
                    "base_unit": "pcs",
                    "conversion_factor": "10",
                    "quantity": "2",
                    "base_quantity": "20",
                    "unit_cost": "50",
                    "amount": "100",
                }
            ],
        }

        response = self.client.post("/api/purchases/", payload, format="json")

        self.assertEqual(response.status_code, 201)
        link = ProductSupplier.objects.get(product=product, supplier=self.supplier_a)
        self.assertEqual(link.default_purchase_unit, "box")
        self.assertEqual(link.default_unit_cost, Decimal("50.00"))


class PurchaseItemStatusTests(APITestCase):
    def setUp(self):
        self.product = Product.objects.create(
            sku="PURCH-STATUS-1",
            product_name="Purchase Status Product",
            stock_base_unit="pcs",
            default_purchase_unit="pcs",
        )
        self.today = timezone.localdate()

    def purchase_payload(self, status, quantity):
        return {
            "supplier_name": "Purchase Status Supplier",
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
                    "unit_cost": "1",
                    "amount": str(quantity),
                }
            ],
        }

    def test_cancelled_purchase_item_can_be_restored_to_pending(self):
        purchase = Purchase.objects.create(
            supplier_name="Purchase Status Supplier",
            status=Purchase.STATUS_CANCELLED,
            transaction_date=self.today,
        )

        payload = self.purchase_payload(Purchase.STATUS_CANCELLED, 4)
        payload["items"][0]["item_status"] = PurchaseItem.ITEM_PENDING

        response = self.client.patch(
            f"/api/purchases/{purchase.id}/",
            payload,
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], Purchase.STATUS_ORDERED)
        self.assertEqual(response.data["items"][0]["item_status"], PurchaseItem.ITEM_PENDING)

    def test_cancelled_purchase_item_can_be_restored_to_received(self):
        purchase = Purchase.objects.create(
            supplier_name="Purchase Status Supplier",
            status=Purchase.STATUS_CANCELLED,
            transaction_date=self.today,
        )

        payload = self.purchase_payload(Purchase.STATUS_CANCELLED, 4)
        payload["items"][0]["item_status"] = PurchaseItem.ITEM_RECEIVED

        response = self.client.patch(
            f"/api/purchases/{purchase.id}/",
            payload,
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], Purchase.STATUS_RECEIVED)
        self.assertEqual(response.data["items"][0]["item_status"], PurchaseItem.ITEM_RECEIVED)
        self.assertIsNotNone(response.data["items"][0]["received_date"])


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

    def sequential_reference(self, prefix, serial):
        return f"{prefix}-{serial:06d}"

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
            reference_no=self.sequential_reference("QT", 3),
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
                "reference_no": self.sequential_reference("QT", 3),
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
        self.assertEqual(
            quotation_response.data["reference_no"],
            self.sequential_reference("QT", 4),
        )


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

    def test_product_lookup_returns_average_recent_sale_price_from_latest_three_sales(self):
        product = Product.objects.create(
            sku="LOOKUP-SALES-1",
            product_name="Lookup Sales Product",
            stock_base_unit="pcs",
            default_sales_unit="pcs",
        )
        sale_specs = (
            ("2026-05-01", Sale.STATUS_PACKED, SaleItem.ITEM_PACKED, "pcs", Decimal("1"), Decimal("10")),
            ("2026-05-02", Sale.STATUS_PACKED, SaleItem.ITEM_PACKED, "box", Decimal("10"), Decimal("200")),
            ("2026-05-03", Sale.STATUS_PACKED, SaleItem.ITEM_PACKED, "pcs", Decimal("1"), Decimal("30")),
            ("2026-05-04", Sale.STATUS_PACKED, SaleItem.ITEM_PACKED, "box", Decimal("10"), Decimal("400")),
            ("2026-05-05", Sale.STATUS_CANCELLED, SaleItem.ITEM_CANCELLED, "box", Decimal("10"), Decimal("900")),
        )

        for index, (
            transaction_date,
            sale_status,
            item_status,
            unit,
            conversion_factor,
            unit_price,
        ) in enumerate(sale_specs, start=1):
            sale = Sale.objects.create(
                reference_no=f"SO-LOOKUP-{index}",
                customer_name="Lookup Customer",
                status=sale_status,
                transaction_date=transaction_date,
            )
            SaleItem.objects.create(
                sale=sale,
                product=product,
                product_name=product.product_name,
                sku=product.sku,
                item_status=item_status,
                unit=unit,
                base_unit="pcs",
                conversion_factor=conversion_factor,
                quantity=Decimal("1"),
                base_quantity=conversion_factor,
                unit_price=unit_price,
                amount=unit_price,
            )

        response = self.client.get("/api/lookups/products/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["sku"], "LOOKUP-SALES-1")
        self.assertEqual(response.data[0]["average_recent_sale_price"], Decimal("30"))

    def test_product_lookup_excludes_disabled_products_by_default(self):
        active = Product.objects.create(
            sku="LOOKUP-ACTIVE",
            product_name="Active Lookup Product",
        )
        disabled = Product.objects.create(
            sku="LOOKUP-DISABLED",
            product_name="Disabled Lookup Product",
            is_active=False,
        )

        response = self.client.get("/api/lookups/products/")
        include_disabled_response = self.client.get(
            "/api/lookups/products/",
            {"include_disabled": "true"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual([row["id"] for row in response.data], [active.id])
        self.assertEqual(include_disabled_response.status_code, 200)
        self.assertCountEqual(
            [row["id"] for row in include_disabled_response.data],
            [active.id, disabled.id],
        )

    def test_disabled_product_cannot_be_used_in_new_transactions(self):
        product = Product.objects.create(
            sku="DISABLED-TX",
            product_name="Disabled Transaction Product",
            is_active=False,
        )
        purchase_payload = {
            "supplier_name": "Disabled Supplier",
            "transaction_date": self.today.isoformat(),
            "items": [
                {
                    "product_id": product.id,
                    "product_name": product.product_name,
                    "sku": product.sku,
                    "unit": "pcs",
                    "base_unit": "pcs",
                    "conversion_factor": "1",
                    "quantity": "1",
                    "base_quantity": "1",
                    "unit_cost": "2",
                    "amount": "2",
                }
            ],
        }
        sale_payload = {
            "customer_name": "Disabled Customer",
            "transaction_date": self.today.isoformat(),
            "items": [
                {
                    "product_id": product.id,
                    "product_name": product.product_name,
                    "sku": product.sku,
                    "unit": "pcs",
                    "base_unit": "pcs",
                    "conversion_factor": "1",
                    "quantity": "1",
                    "base_quantity": "1",
                    "unit_price": "3",
                    "amount": "3",
                }
            ],
        }
        quotation_payload = {
            "customer_name": "Disabled Customer",
            "supplier_name": "Disabled Supplier",
            "quotation_date": self.today.isoformat(),
            "items": [
                {
                    "product_id": product.id,
                    "product_name": product.product_name,
                    "sku": product.sku,
                    "unit": "pcs",
                    "quantity": "1",
                    "sale_price": "3",
                    "cost_price": "2",
                    "discounts": ["0"],
                }
            ],
        }

        purchase_response = self.client.post("/api/purchases/", purchase_payload, format="json")
        sale_response = self.client.post("/api/sales/", sale_payload, format="json")
        quotation_response = self.client.post(
            "/api/quotations/",
            quotation_payload,
            format="json",
        )

        self.assertEqual(purchase_response.status_code, 400)
        self.assertEqual(sale_response.status_code, 400)
        self.assertEqual(quotation_response.status_code, 400)
        self.assertIn("Disabled products cannot be used", str(purchase_response.data))
        self.assertIn("Disabled products cannot be used", str(sale_response.data))
        self.assertIn("Disabled products cannot be used", str(quotation_response.data))

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

    def test_dashboard_stock_report_recommends_cheapest_supplier(self):
        product = Product.objects.create(
            sku="DASH-SUPPLIER",
            product_name="Multi Supplier Product",
        )
        cheap_purchase = Purchase.objects.create(
            reference_no="PO-CHEAP",
            supplier_name="Cheap Supplier",
            status=Purchase.STATUS_RECEIVED,
            transaction_date=self.today,
        )
        PurchaseItem.objects.create(
            purchase=cheap_purchase,
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
        pricey_purchase = Purchase.objects.create(
            reference_no="PO-PRICEY",
            supplier_name="Pricey Supplier",
            status=Purchase.STATUS_RECEIVED,
            transaction_date=self.today,
        )
        PurchaseItem.objects.create(
            purchase=pricey_purchase,
            product=product,
            product_name=product.product_name,
            sku=product.sku,
            item_status=PurchaseItem.ITEM_RECEIVED,
            received_date=self.today,
            unit="pcs",
            base_unit="pcs",
            conversion_factor=Decimal("1"),
            quantity=Decimal("5"),
            base_quantity=Decimal("5"),
            unit_cost=Decimal("3"),
            amount=Decimal("15"),
        )

        response = self.client.get("/api/dashboard/")

        self.assertEqual(response.status_code, 200)
        row = next(
            item for item in response.data["stock_report"] if item["product_id"] == product.id
        )
        self.assertEqual(row["supplier_count"], 2)
        self.assertEqual(
            [option["supplier_name"] for option in row["supplier_options"]],
            ["Cheap Supplier", "Pricey Supplier"],
        )
        self.assertEqual(row["best_supplier_name"], "Cheap Supplier")
        self.assertEqual(row["best_supplier_cost"], 2)

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

    def test_product_with_transaction_history_can_be_disabled(self):
        product = Product.objects.create(
            sku="DISABLE-BLOCKED",
            product_name="Disable Product",
        )
        purchase = Purchase.objects.create(
            reference_no="PO-DISABLE-BLOCKED",
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

        response = self.client.patch(
            f"/api/products/{product.id}/",
            {"isActive": False},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["isActive"])
        product.refresh_from_db()
        self.assertFalse(product.is_active)

    def test_disabled_product_can_be_enabled_again(self):
        product = Product.objects.create(
            sku="ENABLE-AGAIN",
            product_name="Enable Product",
            is_active=False,
        )

        response = self.client.patch(
            f"/api/products/{product.id}/",
            {"isActive": True},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["isActive"])
        product.refresh_from_db()
        self.assertTrue(product.is_active)

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


class CreditNoteTests(APITestCase):
    def setUp(self):
        self.today = timezone.localdate()
        Customer.objects.create(company_name="Alpha Customer")

    def _sale_with_cancelled_item(self, reference_no, customer_name="Alpha Customer"):
        sale = Sale.objects.create(
            reference_no=reference_no,
            customer_name=customer_name,
            status=Sale.STATUS_PARTIALLY_DELIVERED,
            transaction_date=self.today,
            grand_total=Decimal("300"),
        )
        SaleItem.objects.create(
            sale=sale,
            product_name="Delivered Item",
            item_status=SaleItem.ITEM_DELIVERED,
            quantity=Decimal("2"),
            unit_price=Decimal("100"),
            amount=Decimal("200"),
        )
        cancelled = SaleItem.objects.create(
            sale=sale,
            product_name="Cancelled Item",
            sku="CN-SKU-1",
            item_status=SaleItem.ITEM_CANCELLED,
            quantity=Decimal("1"),
            unit_price=Decimal("100"),
            amount=Decimal("100"),
        )
        return sale, cancelled

    def test_credit_note_create_totals_lines_and_snapshots_sale_reference(self):
        sale, cancelled = self._sale_with_cancelled_item("SO-CN-1")

        payload = {
            "customer_name": "Alpha Customer",
            "sale": sale.id,
            "credit_note_date": str(self.today),
            "lines": [
                {
                    "sale_item": cancelled.id,
                    "product_name": cancelled.product_name,
                    "sku": cancelled.sku,
                    "quantity": "1",
                    "unit_price": "100",
                    "amount": "100",
                }
            ],
        }
        response = self.client.post("/api/credit-notes/", payload, format="json")

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(Decimal(response.data["total_amount"]), Decimal("100"))
        self.assertEqual(response.data["status"], CreditNote.STATUS_ISSUED)
        self.assertEqual(response.data["sale_reference_no"], "SO-CN-1")
        self.assertTrue(response.data["reference_no"].startswith("CN-"))

    def test_credit_note_eligibility_excludes_already_credited_items(self):
        sale, cancelled = self._sale_with_cancelled_item("SO-CN-2")
        second_cancelled = SaleItem.objects.create(
            sale=sale,
            product_name="Second Cancelled Item",
            item_status=SaleItem.ITEM_CANCELLED,
            quantity=Decimal("1"),
            unit_price=Decimal("50"),
            amount=Decimal("50"),
        )
        credit_note = CreditNote.objects.create(
            reference_no="CN-EXISTING",
            customer_name="Alpha Customer",
            sale=sale,
            sale_reference_no=sale.reference_no,
            credit_note_date=self.today,
            total_amount=Decimal("100"),
        )
        CreditNoteLine.objects.create(
            credit_note=credit_note,
            sale_item=cancelled,
            product_name=cancelled.product_name,
            amount=Decimal("100"),
        )

        response = self.client.get("/api/eligibility/credit-note-sales/")

        self.assertEqual(response.status_code, 200)
        sales = {row["id"]: row for row in response.data["sales"]}
        self.assertIn(sale.id, sales)
        line_item_ids = {line["sale_item"] for line in sales[sale.id]["cancelled_lines"]}
        self.assertEqual(line_item_ids, {second_cancelled.id})
        self.assertTrue(response.data["next_reference_no"].startswith("CN-"))

    def test_credit_note_eligibility_includes_returned_items(self):
        sale, _ = self._sale_with_cancelled_item("SO-CN-RETURNED")
        returned = SaleItem.objects.create(
            sale=sale,
            product_name="Returned Item",
            item_status=SaleItem.ITEM_RETURNED,
            quantity=Decimal("1"),
            unit_price=Decimal("75"),
            amount=Decimal("75"),
        )

        response = self.client.get("/api/eligibility/credit-note-sales/")

        self.assertEqual(response.status_code, 200)
        sales = {row["id"]: row for row in response.data["sales"]}
        line_item_ids = {line["sale_item"] for line in sales[sale.id]["cancelled_lines"]}
        self.assertIn(returned.id, line_item_ids)

    def test_billing_note_net_amount_subtracts_active_credit_notes(self):
        sale, cancelled = self._sale_with_cancelled_item("SO-CN-3")
        billing_note = BillingNote.objects.create(
            reference_no="BN-CN-3",
            customer_name="Alpha Customer",
            billing_note_date=self.today,
            status=BillingNote.STATUS_ISSUED,
            total_amount=Decimal("300"),
        )
        BillingNoteLine.objects.create(
            billing_note=billing_note,
            sale=sale,
            amount=Decimal("300"),
        )
        active_credit = CreditNote.objects.create(
            reference_no="CN-ACTIVE-3",
            customer_name="Alpha Customer",
            sale=sale,
            billing_note=billing_note,
            credit_note_date=self.today,
            status=CreditNote.STATUS_ISSUED,
            total_amount=Decimal("100"),
        )
        CreditNote.objects.create(
            reference_no="CN-CANCELLED-3",
            customer_name="Alpha Customer",
            sale=sale,
            billing_note=billing_note,
            credit_note_date=self.today,
            status=CreditNote.STATUS_CANCELLED,
            total_amount=Decimal("75"),
        )

        response = self.client.get(f"/api/billing-notes/{billing_note.id}/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(Decimal(response.data["net_amount"]), Decimal("200"))
        credit_ids = {row["id"] for row in response.data["credit_notes"]}
        self.assertIn(active_credit.id, credit_ids)

    def test_credit_note_rejects_billing_note_of_different_customer(self):
        sale, cancelled = self._sale_with_cancelled_item("SO-CN-4")
        Customer.objects.create(company_name="Beta Customer")
        other_billing_note = BillingNote.objects.create(
            reference_no="BN-OTHER",
            customer_name="Beta Customer",
            billing_note_date=self.today,
            status=BillingNote.STATUS_ISSUED,
            total_amount=Decimal("500"),
        )

        payload = {
            "customer_name": "Alpha Customer",
            "sale": sale.id,
            "billing_note": other_billing_note.id,
            "credit_note_date": str(self.today),
            "lines": [
                {
                    "sale_item": cancelled.id,
                    "product_name": cancelled.product_name,
                    "quantity": "1",
                    "unit_price": "100",
                    "amount": "100",
                }
            ],
        }
        response = self.client.post("/api/credit-notes/", payload, format="json")

        self.assertEqual(response.status_code, 400)
        self.assertIn("billing note", str(response.data.get("error", "")).lower())


class SeedOperationalDataCommandTests(TestCase):
    def setUp(self):
        self.today = timezone.localdate()
        self.year_month = f"{self.today.year + 543}"[-2:] + f"{self.today.month:02d}"
        self.command_stdout = StringIO()

    def create_real_transactions(self):
        product = Product.objects.create(
            id="real-product-1",
            sku="REAL-SEED-1",
            product_name="Real Seed Product",
            stock_base_unit="pcs",
            default_purchase_unit="pcs",
            default_sales_unit="pcs",
        )
        supplier = Supplier.objects.create(
            id="real-supplier-1",
            company_name="Real Seed Supplier",
        )
        customer = Customer.objects.create(
            id="real-customer-1",
            company_name="Real Seed Customer",
        )
        purchase = Purchase.objects.create(
            id="real-po-1",
            reference_no=f"PO-{self.year_month}-001",
            supplier=supplier,
            supplier_name=supplier.company_name,
            status=Purchase.STATUS_RECEIVED,
            transaction_date=self.today,
        )
        sale = Sale.objects.create(
            id="real-sale-1",
            reference_no=f"TI-{self.year_month}-001",
            customer=customer,
            customer_name=customer.company_name,
            status=Sale.STATUS_DELIVERED,
            transaction_date=self.today,
        )
        quotation = Quotation.objects.create(
            id="real-qt-1",
            reference_no="QT-000321",
            quotation_date=self.today,
            customer=customer,
            customer_name=customer.company_name,
        )
        billing_note = BillingNote.objects.create(
            id="real-bn-1",
            reference_no=f"BN-{self.year_month}-001",
            customer=customer,
            customer_name=customer.company_name,
            billing_note_date=self.today,
            status=BillingNote.STATUS_ISSUED,
        )
        payment_batch = PaymentBatch.objects.create(
            id="real-pmt-1",
            reference_no=f"PMT-{self.year_month}-001",
            supplier=supplier,
            supplier_name=supplier.company_name,
            batch_date=self.today,
            status=PaymentBatch.STATUS_SCHEDULED,
        )
        credit_note = CreditNote.objects.create(
            id="real-cn-1",
            reference_no=f"CN-{self.year_month}-001",
            customer=customer,
            customer_name=customer.company_name,
            sale=sale,
            sale_reference_no=sale.reference_no,
            credit_note_date=self.today,
            status=CreditNote.STATUS_ISSUED,
        )
        return {
            "product": product,
            "supplier": supplier,
            "customer": customer,
            "purchase": purchase,
            "sale": sale,
            "quotation": quotation,
            "billing_note": billing_note,
            "payment_batch": payment_batch,
            "credit_note": credit_note,
        }

    def test_seed_preserves_non_demo_records(self):
        real_records = self.create_real_transactions()

        call_command(
            "seed_operational_data",
            skip_documents=True,
            verbosity=0,
            stdout=self.command_stdout,
        )

        self.assertTrue(Purchase.objects.filter(id=real_records["purchase"].id).exists())
        self.assertTrue(Sale.objects.filter(id=real_records["sale"].id).exists())
        self.assertTrue(Quotation.objects.filter(id=real_records["quotation"].id).exists())
        self.assertTrue(
            BillingNote.objects.filter(id=real_records["billing_note"].id).exists()
        )
        self.assertTrue(
            PaymentBatch.objects.filter(id=real_records["payment_batch"].id).exists()
        )
        self.assertTrue(CreditNote.objects.filter(id=real_records["credit_note"].id).exists())
        self.assertTrue(Purchase.objects.filter(id__startswith="demo-po-").exists())
        self.assertTrue(Sale.objects.filter(id__startswith="demo-sale-").exists())

    def test_seeded_operational_data_matches_current_workflows(self):
        call_command(
            "seed_operational_data",
            skip_documents=True,
            verbosity=0,
            stdout=self.command_stdout,
        )

        received_by_product_id = {}
        for item in PurchaseItem.objects.filter(
            purchase__id__startswith="demo-po-",
            item_status=PurchaseItem.ITEM_RECEIVED,
        ):
            received_by_product_id[item.product_id] = (
                received_by_product_id.get(item.product_id, Decimal("0"))
                + item.base_quantity
            )

        committed_by_product_id = {}
        for item in SaleItem.objects.filter(
            sale__id__startswith="demo-sale-",
            item_status__in=SALE_STOCK_DEDUCTED_STATUSES,
        ):
            committed_by_product_id[item.product_id] = (
                committed_by_product_id.get(item.product_id, Decimal("0"))
                + item.base_quantity
            )

        self.assertTrue(committed_by_product_id)
        for product_id, committed_quantity in committed_by_product_id.items():
            self.assertLessEqual(
                committed_quantity,
                received_by_product_id.get(product_id, Decimal("0")),
            )

        self.assertTrue(
            Quotation.objects.filter(
                id__startswith="demo-qt-",
                valid_until_day_type="business",
                valid_until_days__gt=0,
                valid_until_date__isnull=False,
            ).exists()
        )
        self.assertTrue(
            Quotation.objects.filter(
                id__startswith="demo-qt-",
                valid_until_day_type="no_valid_date",
                valid_until_days=0,
                valid_until_date__isnull=True,
            ).exists()
        )
        self.assertTrue(
            SaleItem.objects.filter(
                sale__id__startswith="demo-sale-",
                item_status=SaleItem.ITEM_RETURNED,
            ).exists()
        )
        self.assertTrue(
            CreditNote.objects.filter(
                id__startswith="demo-cn-",
                billing_note__isnull=False,
            ).exists()
        )
        for credit_note in CreditNote.objects.filter(
            id__startswith="demo-cn-",
            billing_note__isnull=False,
        ).select_related("billing_note", "sale"):
            self.assertTrue(
                BillingNoteLine.objects.filter(
                    billing_note=credit_note.billing_note,
                    sale=credit_note.sale,
                ).exists()
            )
        self.assertFalse(
            Supplier.objects.filter(
                id__startswith="demo-",
            ).filter(
                Q(procurement_name="") | Q(procurement_tel="")
            ).exists()
        )

    def test_keep_previous_demo_appends_another_seed_set(self):
        call_command(
            "seed_operational_data",
            skip_documents=True,
            verbosity=0,
            stdout=self.command_stdout,
        )
        purchase_count = Purchase.objects.filter(id__startswith="demo-po-").count()
        sale_count = Sale.objects.filter(id__startswith="demo-sale-").count()
        quotation_count = Quotation.objects.filter(id__startswith="demo-qt-").count()

        call_command(
            "seed_operational_data",
            skip_documents=True,
            keep_previous_demo=True,
            verbosity=0,
            stdout=self.command_stdout,
        )

        self.assertGreater(
            Purchase.objects.filter(id__startswith="demo-po-").count(),
            purchase_count,
        )
        self.assertGreater(
            Sale.objects.filter(id__startswith="demo-sale-").count(),
            sale_count,
        )
        self.assertGreater(
            Quotation.objects.filter(id__startswith="demo-qt-").count(),
            quotation_count,
        )


class QuotationSupplierTests(APITestCase):
    def setUp(self):
        self.today = timezone.localdate()
        self.product = Product.objects.create(
            sku="QT-SUP-1",
            product_name="Sourced Product",
            stock_base_unit="pcs",
            default_purchase_unit="pcs",
            default_sales_unit="pcs",
        )
        self.customer = Customer.objects.create(company_name="Sourcing Customer")
        self.supplier_a = Supplier.objects.create(company_name="Supplier A")
        self.supplier_b = Supplier.objects.create(company_name="Supplier B")

    def test_quotation_item_records_multiple_supplier_options(self):
        payload = {
            "reference_no": "QT-SUP-TEST",
            "quotation_date": self.today.isoformat(),
            "valid_until_date": self.today.isoformat(),
            "customer_name": self.customer.company_name,
            "vat_mode": "not_included",
            "items": [
                {
                    "product_id": self.product.id,
                    "product_name": self.product.product_name,
                    "sku": self.product.sku,
                    "unit": "pcs",
                    "quantity": "10",
                    "sale_price": "100",
                    "discounts": ["0"],
                    "supplier_options": [
                        {
                            "supplier_id": self.supplier_a.id,
                            "supplier_name": "Supplier A",
                            "cost_price": "70",
                        },
                        {
                            "supplier_id": self.supplier_b.id,
                            "supplier_name": "Supplier B",
                            "cost_price": "60",
                        },
                    ],
                }
            ],
        }
        response = self.client.post("/api/quotations/", payload, format="json")

        self.assertEqual(response.status_code, 201, response.data)
        item = response.data["items"][0]
        self.assertEqual(len(item["supplier_options"]), 2)
        self.assertEqual(
            {option["supplier_name"] for option in item["supplier_options"]},
            {"Supplier A", "Supplier B"},
        )
        # Headline cost_price falls back to the cheapest recorded supplier.
        self.assertEqual(Decimal(item["cost_price"]), Decimal("60"))

        quotation_item = QuotationItem.objects.get(quotation_id=response.data["id"])
        self.assertEqual(quotation_item.supplier_options.count(), 2)
        self.assertEqual(
            quotation_item.supplier_options.first().supplier_id,
            self.supplier_a.id,
        )

    def test_sale_item_stores_supplier_and_unit_cost(self):
        payload = {
            "reference_no": "TI-SUP-TEST",
            "customer_name": self.customer.company_name,
            "status": Sale.STATUS_DRAFT,
            "transaction_date": self.today.isoformat(),
            "vat_mode": "not_included",
            "items": [
                {
                    "product_id": self.product.id,
                    "product_name": self.product.product_name,
                    "sku": self.product.sku,
                    "unit": "pcs",
                    "quantity": "5",
                    "unit_price": "100",
                    "supplier_id": self.supplier_a.id,
                    "supplier_name": "Supplier A",
                    "unit_cost": "70",
                    "discounts": ["0"],
                }
            ],
        }
        response = self.client.post("/api/sales/", payload, format="json")

        self.assertEqual(response.status_code, 201, response.data)
        item = response.data["items"][0]
        self.assertEqual(item["supplier_name"], "Supplier A")
        self.assertEqual(item["supplier_id"], self.supplier_a.id)
        self.assertEqual(Decimal(item["unit_cost"]), Decimal("70"))

        sale_item = SaleItem.objects.get(sale_id=response.data["id"])
        self.assertEqual(sale_item.supplier_id, self.supplier_a.id)
        self.assertEqual(sale_item.unit_cost, Decimal("70"))


class PurchasePayableSyncTests(APITestCase):
    """A purchase's payable amount excludes cancelled items, and linked supplier
    payment batches stay in sync with it (syncing unpaid lines, freezing paid ones)."""

    def setUp(self):
        self.today = timezone.localdate()
        self.supplier = Supplier.objects.create(company_name="Payable Supplier")
        self.product_a = Product.objects.create(
            sku="PAY-A", product_name="Payable Product A"
        )
        self.product_b = Product.objects.create(
            sku="PAY-B", product_name="Payable Product B"
        )

    def _item(self, product, quantity, unit_cost, item_status="received"):
        amount = Decimal(quantity) * Decimal(unit_cost)
        return {
            "product_id": product.id,
            "product_name": product.product_name,
            "sku": product.sku,
            "unit": "pcs",
            "base_unit": "pcs",
            "conversion_factor": "1",
            "quantity": str(quantity),
            "base_quantity": str(quantity),
            "unit_cost": str(unit_cost),
            "amount": str(amount),
            "item_status": item_status,
        }

    def _create_purchase(self, items, status=Purchase.STATUS_RECEIVED):
        grand_total = sum(Decimal(item["amount"]) for item in items)
        payload = {
            "supplier_name": self.supplier.company_name,
            "status": status,
            "transaction_date": self.today.isoformat(),
            "vat_mode": "none",
            "total_before_vat": str(grand_total),
            "vat_amount": "0",
            "grand_total": str(grand_total),
            "items": items,
        }
        response = self.client.post("/api/purchases/", payload, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        return response.data

    def _create_payment_batch(self, purchase_id, paid=False, amount=None):
        line = {"purchase": purchase_id, "paid": paid}
        if paid:
            line["paid_date"] = self.today.isoformat()
        if amount is not None:
            line["amount"] = str(amount)
        payload = {
            "supplier_name": self.supplier.company_name,
            "batch_date": self.today.isoformat(),
            "status": PaymentBatch.STATUS_SCHEDULED,
            "lines": [line],
        }
        response = self.client.post("/api/payment-batches/", payload, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        return response.data

    def _cancel_first_item(self, purchase):
        items = [
            self._item(self.product_a, 4, 100, item_status="cancelled"),
            self._item(self.product_b, 1, 100, item_status="received"),
        ]
        response = self.client.patch(
            f"/api/purchases/{purchase['id']}/",
            {
                "vat_mode": "none",
                "total_before_vat": "500",
                "vat_amount": "0",
                "grand_total": "500",
                "items": items,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        return response.data

    def test_cancelling_item_reduces_payable_but_keeps_grand_total(self):
        purchase = self._create_purchase(
            [
                self._item(self.product_a, 4, 100),  # 400
                self._item(self.product_b, 1, 100),  # 100
            ]
        )
        self.assertEqual(Decimal(purchase["grand_total"]), Decimal("500"))
        self.assertEqual(Decimal(purchase["payable_total"]), Decimal("500"))

        updated = self._cancel_first_item(purchase)
        # The original document total stays for audit; payable drops by the
        # cancelled 400.
        self.assertEqual(Decimal(updated["grand_total"]), Decimal("500"))
        self.assertEqual(Decimal(updated["payable_total"]), Decimal("100"))

    def test_editing_quantity_changes_payable_total(self):
        purchase = self._create_purchase([self._item(self.product_a, 10, 100)])
        self.assertEqual(Decimal(purchase["payable_total"]), Decimal("1000"))

        response = self.client.patch(
            f"/api/purchases/{purchase['id']}/",
            {
                "vat_mode": "none",
                "total_before_vat": "700",
                "vat_amount": "0",
                "grand_total": "700",
                "items": [self._item(self.product_a, 7, 100)],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(Decimal(response.data["payable_total"]), Decimal("700"))

    def test_payment_batch_line_defaults_to_payable_total(self):
        purchase = self._create_purchase(
            [
                self._item(self.product_a, 4, 100, item_status="cancelled"),
                self._item(self.product_b, 1, 100, item_status="received"),
            ],
            status=Purchase.STATUS_RECEIVED,
        )
        self.assertEqual(Decimal(purchase["payable_total"]), Decimal("100"))

        batch = self._create_payment_batch(purchase["id"])
        self.assertEqual(Decimal(batch["total_amount"]), Decimal("100"))
        self.assertEqual(Decimal(batch["lines"][0]["amount"]), Decimal("100"))
        self.assertEqual(
            Decimal(batch["lines"][0]["purchase_grand_total"]), Decimal("500")
        )

    def test_unpaid_payment_line_resyncs_when_purchase_is_cancelled(self):
        purchase = self._create_purchase(
            [
                self._item(self.product_a, 4, 100),
                self._item(self.product_b, 1, 100),
            ]
        )
        batch = self._create_payment_batch(purchase["id"], paid=False)
        self.assertEqual(Decimal(batch["lines"][0]["amount"]), Decimal("500"))

        self._cancel_first_item(purchase)

        line = PaymentBatchLine.objects.get(payment_batch_id=batch["id"])
        self.assertEqual(line.amount, Decimal("100"))
        batch_obj = PaymentBatch.objects.get(id=batch["id"])
        self.assertEqual(batch_obj.total_amount, Decimal("100"))

    def test_paid_payment_line_is_frozen_when_purchase_changes(self):
        purchase = self._create_purchase(
            [
                self._item(self.product_a, 4, 100),
                self._item(self.product_b, 1, 100),
            ]
        )
        batch = self._create_payment_batch(
            purchase["id"], paid=True, amount=Decimal("500")
        )
        self.assertEqual(Decimal(batch["lines"][0]["amount"]), Decimal("500"))

        self._cancel_first_item(purchase)

        # Paid line keeps its committed amount; the discrepancy is visible via the
        # current payable exposed on the line.
        line = PaymentBatchLine.objects.get(payment_batch_id=batch["id"])
        self.assertEqual(line.amount, Decimal("500"))

        response = self.client.get(f"/api/payment-batches/{batch['id']}/")
        self.assertEqual(response.status_code, 200)
        line_data = response.data["lines"][0]
        self.assertEqual(Decimal(line_data["amount"]), Decimal("500"))
        self.assertEqual(Decimal(line_data["purchase_payable_total"]), Decimal("100"))
        self.assertEqual(len(line_data["purchase_cancelled_items"]), 1)


@override_settings(OPENAI_API_KEY="")
class ChatAssistantAlignmentTests(TestCase):
    def setUp(self):
        self.today = timezone.localdate()
        self.customer = Customer.objects.create(company_name="Finance Department")
        self.supplier = Supplier.objects.create(company_name="Paper Supply Co.")
        self.product = Product.objects.create(
            sku="CHAT-1",
            product_name="Chat Product",
            stock_base_unit="pcs",
            default_purchase_unit="pcs",
            default_sales_unit="pcs",
            reorder_level=Decimal("5"),
        )

        self.received_purchase = Purchase.objects.create(
            reference_no="PO-CHAT-READY",
            supplier=self.supplier,
            supplier_name=self.supplier.company_name,
            transaction_date=self.today - timedelta(days=3),
            status=Purchase.STATUS_RECEIVED,
            grand_total=Decimal("10"),
        )
        PurchaseItem.objects.create(
            purchase=self.received_purchase,
            product=self.product,
            product_name=self.product.product_name,
            sku=self.product.sku,
            item_status=PurchaseItem.ITEM_RECEIVED,
            received_date=self.today - timedelta(days=1),
            lead_time_days=2,
            unit="pcs",
            base_unit="pcs",
            conversion_factor=Decimal("1"),
            quantity=Decimal("1"),
            base_quantity=Decimal("1"),
            unit_cost=Decimal("10"),
            amount=Decimal("10"),
        )

        self.pending_purchase = Purchase.objects.create(
            reference_no="PO-CHAT-INCOMING",
            supplier=self.supplier,
            supplier_name=self.supplier.company_name,
            transaction_date=self.today,
            status=Purchase.STATUS_ORDERED,
            grand_total=Decimal("20"),
        )
        PurchaseItem.objects.create(
            purchase=self.pending_purchase,
            product=self.product,
            product_name=self.product.product_name,
            sku=self.product.sku,
            item_status=PurchaseItem.ITEM_PENDING,
            expected_delivery_date=self.today - timedelta(days=2),
            unit="pcs",
            base_unit="pcs",
            conversion_factor=Decimal("1"),
            quantity=Decimal("2"),
            base_quantity=Decimal("2"),
            unit_cost=Decimal("10"),
            amount=Decimal("20"),
        )

        self.pending_sale = Sale.objects.create(
            reference_no="TI-CHAT-BACKORDER",
            customer=self.customer,
            customer_name=self.customer.company_name,
            transaction_date=self.today,
            status=Sale.STATUS_DRAFT,
            grand_total=Decimal("50"),
        )
        sale_item = SaleItem.objects.create(
            sale=self.pending_sale,
            product=self.product,
            product_name=self.product.product_name,
            sku=self.product.sku,
            item_status=SaleItem.ITEM_PENDING,
            unit="pcs",
            base_unit="pcs",
            conversion_factor=Decimal("1"),
            quantity=Decimal("5"),
            base_quantity=Decimal("5"),
            unit_price=Decimal("10"),
            unit_cost=Decimal("6"),
            amount=Decimal("50"),
        )

        self.previous_sale = Sale.objects.create(
            reference_no="TI-CHAT-PREVIOUS",
            customer=self.customer,
            customer_name=self.customer.company_name,
            transaction_date=self.today - timedelta(days=40),
            status=Sale.STATUS_DELIVERED,
            grand_total=Decimal("20"),
        )
        SaleItem.objects.create(
            sale=self.previous_sale,
            product_name="Previous Trend Service",
            sku="",
            item_status=SaleItem.ITEM_DELIVERED,
            unit="job",
            base_unit="job",
            conversion_factor=Decimal("1"),
            quantity=Decimal("2"),
            base_quantity=Decimal("2"),
            unit_price=Decimal("10"),
            unit_cost=Decimal("5"),
            amount=Decimal("20"),
        )

        self.quotation = Quotation.objects.create(
            reference_no="QT-CHAT-001",
            quotation_date=self.today,
            customer=self.customer,
            customer_name=self.customer.company_name,
            grand_total=Decimal("50"),
        )
        QuotationItem.objects.create(
            quotation=self.quotation,
            product=self.product,
            position=1,
            product_name=self.product.product_name,
            sku=self.product.sku,
            unit="pcs",
            base_unit="pcs",
            conversion_factor=Decimal("1"),
            quantity=Decimal("5"),
            base_quantity=Decimal("5"),
            sale_price=Decimal("10"),
            cost_price=Decimal("6"),
        )

        self.billing_note = BillingNote.objects.create(
            reference_no="BN-CHAT-001",
            customer=self.customer,
            customer_name=self.customer.company_name,
            billing_note_date=self.today,
            expected_payment_date=self.today - timedelta(days=1),
            status=BillingNote.STATUS_ISSUED,
            total_amount=Decimal("300"),
        )
        BillingNoteLine.objects.create(
            billing_note=self.billing_note,
            sale=self.pending_sale,
            amount=Decimal("300"),
        )

        self.payment_batch = PaymentBatch.objects.create(
            reference_no="PMT-CHAT-001",
            supplier=self.supplier,
            supplier_name=self.supplier.company_name,
            batch_date=self.today,
            planned_payment_date=self.today + timedelta(days=3),
            status=PaymentBatch.STATUS_SCHEDULED,
            total_amount=Decimal("120"),
        )
        PaymentBatchLine.objects.create(
            payment_batch=self.payment_batch,
            purchase=self.pending_purchase,
            amount=Decimal("120"),
        )

        self.credit_note = CreditNote.objects.create(
            reference_no="CN-CHAT-001",
            customer=self.customer,
            customer_name=self.customer.company_name,
            sale=self.pending_sale,
            sale_reference_no=self.pending_sale.reference_no,
            billing_note=self.billing_note,
            credit_note_date=self.today,
            status=CreditNote.STATUS_ISSUED,
            total_amount=Decimal("25"),
        )
        CreditNoteLine.objects.create(
            credit_note=self.credit_note,
            sale_item=sale_item,
            product_name=self.product.product_name,
            sku=self.product.sku,
            quantity=Decimal("1"),
            unit_price=Decimal("25"),
            amount=Decimal("25"),
        )

    def test_chat_summarizes_recent_quotations(self):
        response = answer_inventory_question("Show recent quotations")

        self.assertEqual(response["used_model"], "local-summary")
        self.assertEqual(response["presentation"]["title"], "Quotation summary")
        self.assertIn("Quotation summary", response["answer"])
        self.assertIn("QT-CHAT-001", response["answer"])

    def test_chat_summarizes_credit_notes(self):
        response = answer_inventory_question("Show credit notes")

        self.assertEqual(response["used_model"], "local-summary")
        self.assertEqual(response["presentation"]["title"], "Credit note summary")
        self.assertIn("Credit note summary", response["answer"])
        self.assertIn("CN-CHAT-001", response["answer"])

    def test_chat_reports_net_position(self):
        response = answer_inventory_question("What is our net position?")

        self.assertEqual(response["used_model"], "local-summary")
        self.assertEqual(response["presentation"]["title"], "Net position")
        self.assertIn("Net position", response["answer"])
        self.assertIn("AR: 300", response["answer"])
        self.assertIn("AP: 120", response["answer"])

    def test_chat_reports_order_coverage_and_gap(self):
        response = answer_inventory_question("Which customer orders are backordered?")

        self.assertEqual(response["used_model"], "local-summary")
        self.assertEqual(response["presentation"]["title"], "Order coverage")
        self.assertIn("Order coverage", response["answer"])
        self.assertIn("Gap units: 2", response["answer"])

    def test_chat_summarizes_customer_with_date_range(self):
        question = (
            f"Summarize customer activity for {self.customer.company_name} "
            f"from {self.today.isoformat()} to {self.today.isoformat()}"
        )

        response = answer_inventory_question(question)

        self.assertEqual(response["used_model"], "local-summary")
        self.assertEqual(response["presentation"]["title"], f"Customer summary: {self.customer.company_name}")
        self.assertEqual(response["presentation"]["subtitle"], self.today.isoformat())
        self.assertIn(f"Customer summary: {self.customer.company_name}", response["answer"])
        self.assertIn("Sales count: 1", response["answer"])
        self.assertIn("Open AR: 300", response["answer"])

    def test_chat_summarizes_supplier_this_month(self):
        response = answer_inventory_question(
            f"Summarize supplier activity for {self.supplier.company_name} this month"
        )

        self.assertEqual(response["used_model"], "local-summary")
        self.assertEqual(response["presentation"]["title"], f"Supplier summary: {self.supplier.company_name}")
        self.assertIn("Supplier summary", response["answer"])
        self.assertIn("Purchase count: 2", response["answer"])
        self.assertIn("Scheduled AP: 120", response["answer"])

    def test_chat_reports_margin_and_profitability(self):
        response = answer_inventory_question("Show product margin and profitability")

        self.assertEqual(response["used_model"], "local-summary")
        self.assertEqual(response["presentation"]["title"], "Margin and profitability")
        self.assertIn("Gross margin", response["answer"])
        self.assertIn("Chat Product (CHAT-1)", response["answer"])

    def test_chat_reports_supplier_performance_and_lead_time(self):
        response = answer_inventory_question(
            f"Show supplier performance and lead time for {self.supplier.company_name}"
        )

        self.assertEqual(response["used_model"], "local-summary")
        self.assertEqual(response["presentation"]["title"], f"Supplier performance: {self.supplier.company_name}")
        self.assertIn("Avg lead days: 2", response["answer"])
        self.assertIn("Delayed units: 2", response["answer"])

    def test_chat_reports_customer_buying_trend(self):
        response = answer_inventory_question(
            f"Show buying trend for customer {self.customer.company_name}"
        )

        self.assertEqual(response["used_model"], "local-summary")
        self.assertEqual(response["presentation"]["title"], f"Customer buying trend: {self.customer.company_name}")
        self.assertIn("Current sales: 50", response["answer"])
        self.assertIn("Previous sales: 20", response["answer"])

    def test_chat_reports_overdue_and_exception_monitor(self):
        response = answer_inventory_question("Show overdue and exception issues")

        self.assertEqual(response["used_model"], "local-summary")
        self.assertEqual(response["presentation"]["title"], "Overdue and exception monitor")
        self.assertIn("Overdue AR: 300", response["answer"])
        self.assertIn("PO-CHAT-INCOMING", response["answer"])

    def test_chat_shows_reference_line_item_details(self):
        response = answer_inventory_question("Show line items for TI-CHAT-BACKORDER")

        self.assertEqual(response["used_model"], "local-summary")
        self.assertEqual(response["presentation"]["title"], "Sales line items")
        self.assertIn("Chat Product (CHAT-1)", response["answer"])
        self.assertIn("qty 5 pcs", response["answer"])
