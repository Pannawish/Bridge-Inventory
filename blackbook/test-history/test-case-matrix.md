# Test Case Matrix

The following 30 cases were selected from the real backend automated suite in `backend/inventory/tests.py`.

| ID | Type | Area | Test case purpose | Automated test label | Expected result |
|---|---|---|---|---|---|
| TC-01 | Invalid | Product pictures | Reject non-image files during product-picture upload. | `inventory.tests.ProductPictureUploadTests.test_product_picture_upload_rejects_non_image_files` | Pass |
| TC-02 | Valid | Product pictures | Accept multiple product pictures and keep the selected picture index. | `inventory.tests.ProductPictureUploadTests.test_product_create_accepts_multiple_pictures_and_selected_index` | Pass |
| TC-03 | Invalid | Sale Validation | Reject a packed sale when requested quantity is above available stock. | `inventory.tests.SaleStockValidationTests.test_packed_sale_rejects_quantity_above_available_stock` | Pass |
| TC-04 | Valid | Sale Validation | Allow a draft sale even when quantity is above available stock. | `inventory.tests.SaleStockValidationTests.test_draft_sale_allows_quantity_above_available_stock` | Pass |
| TC-05 | Valid | Sale Stock Commit | Changing sale status to packed updates line status and reduces available stock. | `inventory.tests.SaleStockValidationTests.test_status_patch_to_packed_updates_items_and_reduces_available_stock` | Pass |
| TC-06 | Valid | Sale Stock Release | Returning a committed sale item back to pending releases stock correctly. | `inventory.tests.SaleStockValidationTests.test_item_status_pending_releases_available_stock` | Pass |
| TC-07 | Valid | Sale Data | Save a customer purchase-order reference on a sale correctly. | `inventory.tests.SaleStockValidationTests.test_sale_accepts_customer_po_reference` | Pass |
| TC-08 | Valid | Purchase | Creating a purchase synchronizes the product-supplier catalog relationship. | `inventory.tests.SaleItemAllocationTests.test_purchase_create_syncs_product_supplier_catalog_link` | Pass |
| TC-09 | Valid | Purchase Status | A cancelled purchase item can be restored back to pending. | `inventory.tests.PurchaseItemStatusTests.test_cancelled_purchase_item_can_be_restored_to_pending` | Pass |
| TC-10 | Valid | Purchase Status | A cancelled purchase item can be restored back to received. | `inventory.tests.PurchaseItemStatusTests.test_cancelled_purchase_item_can_be_restored_to_received` | Pass |
| TC-11 | Valid | Quotation | Quotation items are stored in normalized relational rows while the API still returns the expected `items` array shape. | `inventory.tests.RelationalNormalizationTests.test_quotation_items_are_normalized_without_changing_api_shape` | Pass |
| TC-12 | Valid | Reference Numbers | Duplicate purchase, sale, and quotation references are advanced automatically. | `inventory.tests.ReferenceNumberTests.test_purchase_sale_and_quotation_duplicate_references_are_advanced` | Pass |
| TC-13 | Valid | Product Lookup | Disabled products are excluded from the normal lookup response by default. | `inventory.tests.LookupEligibilityTests.test_product_lookup_excludes_disabled_products_by_default` | Pass |
| TC-14 | Invalid | Product Rules | Disabled products cannot be used in new purchase, sale, or quotation transactions. | `inventory.tests.LookupEligibilityTests.test_disabled_product_cannot_be_used_in_new_transactions` | Pass |
| TC-15 | Valid | Product Maintenance | A product without transaction history can be deleted successfully. | `inventory.tests.LookupEligibilityTests.test_product_delete_without_transaction_history_succeeds` | Pass |
| TC-16 | Invalid | Product Maintenance | A product with transaction history cannot be deleted. | `inventory.tests.LookupEligibilityTests.test_product_delete_with_transaction_history_is_blocked` | Pass |
| TC-17 | Invalid | Billing Note Eligibility | A sale already linked to an active billing note is excluded from new billing note eligibility. | `inventory.tests.LookupEligibilityTests.test_billing_note_eligibility_excludes_sales_already_on_active_note` | Pass |
| TC-18 | Invalid | Payment Batch Eligibility | A purchase already linked to an active payment batch is excluded from new payment batch eligibility. | `inventory.tests.LookupEligibilityTests.test_payment_batch_eligibility_excludes_purchases_already_on_active_batch` | Pass |
| TC-19 | Valid | Credit Note | Creating a credit note totals its lines correctly and snapshots the source sale reference. | `inventory.tests.CreditNoteTests.test_credit_note_create_totals_lines_and_snapshots_sale_reference` | Pass |
| TC-20 | Invalid | Credit Note Eligibility | Sale items that are already credited do not appear again in credit note eligibility. | `inventory.tests.CreditNoteTests.test_credit_note_eligibility_excludes_already_credited_items` | Pass |
| TC-21 | Valid | Credit Note Eligibility | Returned items are included in credit note eligibility. | `inventory.tests.CreditNoteTests.test_credit_note_eligibility_includes_returned_items` | Pass |
| TC-22 | Valid | Billing Net Amount | Billing note net payable subtracts active credit note amounts correctly. | `inventory.tests.CreditNoteTests.test_billing_note_net_amount_subtracts_active_credit_notes` | Pass |
| TC-23 | Invalid | Credit Note Validation | A credit note cannot be attached to a billing note belonging to a different customer. | `inventory.tests.CreditNoteTests.test_credit_note_rejects_billing_note_of_different_customer` | Pass |
| TC-24 | Valid | Quotation | One quotation item can store multiple supplier options for sourcing comparison. | `inventory.tests.QuotationSupplierTests.test_quotation_item_records_multiple_supplier_options` | Pass |
| TC-25 | Valid | Sale Sourcing | A sale item stores supplier and unit-cost information correctly. | `inventory.tests.QuotationSupplierTests.test_sale_item_stores_supplier_and_unit_cost` | Pass |
| TC-26 | Valid | Payable Logic | Cancelling a purchase item reduces payable total without changing the original grand total snapshot. | `inventory.tests.PurchasePayableSyncTests.test_cancelling_item_reduces_payable_but_keeps_grand_total` | Pass |
| TC-27 | Valid | Payable Logic | Editing purchase quantity updates payable total correctly. | `inventory.tests.PurchasePayableSyncTests.test_editing_quantity_changes_payable_total` | Pass |
| TC-28 | Valid | Payment Batch | A new payment batch line uses the purchase payable total by default. | `inventory.tests.PurchasePayableSyncTests.test_payment_batch_line_defaults_to_payable_total` | Pass |
| TC-29 | Valid | Payment Batch | An unpaid payment batch line resynchronizes when the related purchase is cancelled. | `inventory.tests.PurchasePayableSyncTests.test_unpaid_payment_line_resyncs_when_purchase_is_cancelled` | Pass |
| TC-30 | Valid | Payment Batch | A paid payment batch line remains frozen even if the related purchase changes later. | `inventory.tests.PurchasePayableSyncTests.test_paid_payment_line_is_frozen_when_purchase_changes` | Pass |
