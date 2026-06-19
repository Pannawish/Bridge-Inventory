# Run 01 Summary

## Run information
- Run ID: `run-01`
- Date: `2026-06-19`
- Type: `backend unit/integration test run`
- Scope: `selected 20 workflow-critical cases`
- Command mode: `Django test runner with verbose output`

## Command used

```bash
backend/.venv/bin/python backend/manage.py test \
  inventory.tests.RelationalNormalizationTests.test_quotation_items_are_normalized_without_changing_api_shape \
  inventory.tests.QuotationSupplierTests.test_quotation_item_records_multiple_supplier_options \
  inventory.tests.SaleItemAllocationTests.test_purchase_create_syncs_product_supplier_catalog_link \
  inventory.tests.PurchaseItemStatusTests.test_cancelled_purchase_item_can_be_restored_to_pending \
  inventory.tests.PurchaseItemStatusTests.test_cancelled_purchase_item_can_be_restored_to_received \
  inventory.tests.PurchasePayableSyncTests.test_cancelling_item_reduces_payable_but_keeps_grand_total \
  inventory.tests.PurchasePayableSyncTests.test_editing_quantity_changes_payable_total \
  inventory.tests.PurchasePayableSyncTests.test_payment_batch_line_defaults_to_payable_total \
  inventory.tests.PurchasePayableSyncTests.test_unpaid_payment_line_resyncs_when_purchase_is_cancelled \
  inventory.tests.PurchasePayableSyncTests.test_paid_payment_line_is_frozen_when_purchase_changes \
  inventory.tests.SaleStockValidationTests.test_packed_sale_rejects_quantity_above_available_stock \
  inventory.tests.SaleStockValidationTests.test_draft_sale_allows_quantity_above_available_stock \
  inventory.tests.SaleStockValidationTests.test_status_patch_to_packed_updates_items_and_reduces_available_stock \
  inventory.tests.SaleStockValidationTests.test_item_status_pending_releases_available_stock \
  inventory.tests.LookupEligibilityTests.test_billing_note_eligibility_excludes_sales_already_on_active_note \
  inventory.tests.LookupEligibilityTests.test_payment_batch_eligibility_excludes_purchases_already_on_active_batch \
  inventory.tests.CreditNoteTests.test_credit_note_create_totals_lines_and_snapshots_sale_reference \
  inventory.tests.CreditNoteTests.test_credit_note_eligibility_excludes_already_credited_items \
  inventory.tests.CreditNoteTests.test_billing_note_net_amount_subtracts_active_credit_notes \
  inventory.tests.CreditNoteTests.test_credit_note_rejects_billing_note_of_different_customer \
  -v 2
```

## Overall result
- Tests found: `20`
- Tests passed: `20`
- Tests failed: `0`
- Errors: `0`
- Final status: `PASS`
- Runtime reported by Django: `0.237s`

## Notes from this run
- No code fixes were required after the first run.
- The suite executed against a fresh test database.
- One validation message appeared during `TC-20`, but it was the expected behavior for an invalid customer-to-billing-note match, and the test still passed.

## Per-case result table

| ID | Result | Notes |
|---|---|---|
| TC-01 | Pass | Quotation item normalization behavior correct. |
| TC-02 | Pass | Multiple supplier options preserved on quotation items. |
| TC-03 | Pass | Product-supplier link synchronized during purchase creation. |
| TC-04 | Pass | Cancelled purchase item restored to pending successfully. |
| TC-05 | Pass | Cancelled purchase item restored to received successfully. |
| TC-06 | Pass | Payable total reduced correctly when item cancelled. |
| TC-07 | Pass | Payable total updated correctly after quantity edit. |
| TC-08 | Pass | Payment batch line default amount matches payable total. |
| TC-09 | Pass | Unpaid payment line resynchronized correctly after purchase change. |
| TC-10 | Pass | Paid payment line remained frozen as expected. |
| TC-11 | Pass | Packed sale above available stock rejected correctly. |
| TC-12 | Pass | Draft sale above available stock allowed correctly. |
| TC-13 | Pass | Packing sale reduced stock and updated item state correctly. |
| TC-14 | Pass | Returning item to pending released stock correctly. |
| TC-15 | Pass | Billing note eligibility excluded already-linked sales. |
| TC-16 | Pass | Payment batch eligibility excluded already-linked purchases. |
| TC-17 | Pass | Credit note totals and source snapshot saved correctly. |
| TC-18 | Pass | Already-credited items excluded from new credit-note eligibility. |
| TC-19 | Pass | Billing note net amount correctly subtracts active credit notes. |
| TC-20 | Pass | Different-customer billing-note link rejected correctly. |

## Follow-up decision
Because all 20 cases passed on the first run, there was no `run-02` rerun and no production code fix was required for this selected suite.

