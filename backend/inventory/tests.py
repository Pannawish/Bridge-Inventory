from decimal import Decimal

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import Product, Purchase, PurchaseItem, Sale, SaleItem
from .serializers import SaleSerializer


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


class SaleStockValidationTests(TestCase):
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
