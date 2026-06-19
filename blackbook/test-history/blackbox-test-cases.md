# Black-Box Test Cases

This file rewrites the selected test coverage into a simpler black-box format for presentation.

## Result summary
- Total test cases: `30`
- Passed: `30`
- Failed: `0`
- Latest run record: `run-02`

## Result meaning
- `Pass` = the system behavior matched the expected result
- `Fail` = the system behavior did not match the expected result

| Test ID | Case type | Feature area | What the tester does | Input / action | Expected result | Actual result |
|---|---|---|---|---|---|---|
| BB-01 | Valid | Product pictures | Create a product with multiple pictures | Upload more than one image and choose the selected picture index | The product is saved with all pictures and the selected picture is kept correctly | Pass |
| BB-02 | Valid | Sale validation | Save a draft sale even though stock is not enough yet | Create a draft sale above available stock | The system still allows the draft | Pass |
| BB-03 | Valid | Sale stock movement | Pack a sale that should use stock | Change a sale status to packed | The item status updates and available stock decreases | Pass |
| BB-04 | Valid | Sale stock release | Move a committed sale item back to pending | Change a committed sale item from packed back to pending | The reserved stock is released correctly | Pass |
| BB-05 | Valid | Sales data | Save a sale with a customer purchase order reference | Create or update a sale with a customer PO reference | The reference is saved correctly in the sale record | Pass |
| BB-06 | Valid | Purchase | Create a purchase using product and supplier information | Save a purchase with a selected product and supplier | The purchase is saved and the sourcing link is updated correctly | Pass |
| BB-07 | Valid | Purchase status | Change a cancelled purchase item back to pending | Update one cancelled purchase item to pending | The item changes back to pending successfully | Pass |
| BB-08 | Valid | Purchase status | Change a cancelled purchase item back to received | Update one cancelled purchase item to received | The item changes back to received successfully | Pass |
| BB-09 | Valid | Quotation | Create a quotation with item lines and save it | Add item rows in a quotation and press save | The quotation is saved and the item list stays complete | Pass |
| BB-10 | Valid | Reference numbers | Save transactions using duplicate references | Create records with an already-used reference number | The system automatically moves to the next valid reference number | Pass |
| BB-11 | Valid | Product lookup | Check the product lookup list | Load the product lookup without asking for disabled products | Disabled products do not appear in the normal lookup list | Pass |
| BB-12 | Valid | Product maintenance | Delete a product that has no transaction history | Delete a product that has never been used in business records | The product is deleted successfully | Pass |
| BB-13 | Valid | Credit note | Create a credit note from cancelled sale items | Save a credit note using selected cancelled sale lines | The total credit amount is correct and the sale reference is kept | Pass |
| BB-14 | Valid | Credit note | Create a credit note from returned sale items | Use returned sale lines as credit-note input | The returned items can be credited correctly | Pass |
| BB-15 | Valid | Billing note with credit | Apply an active credit note to a billing note | Calculate a billing note with a linked credit note | The net payable amount is reduced correctly | Pass |
| BB-16 | Valid | Quotation | Add more than one supplier choice to the same quotation item | Enter multiple supplier options for one item | The system keeps all supplier choices for that item | Pass |
| BB-17 | Valid | Sale sourcing | Create a sale item from quotation sourcing data | Save a sale item with supplier and unit-cost information | The supplier and unit-cost details are kept correctly on the sale item | Pass |
| BB-18 | Valid | Purchase payable | Cancel one line in a purchase that already has totals | Mark one purchase item as cancelled | The payable total goes down, but the original grand total stays as a document record | Pass |
| BB-19 | Valid | Purchase payable | Edit the quantity in a purchase | Increase or reduce the quantity of a purchase item | The payable total is recalculated correctly | Pass |
| BB-20 | Valid | Payment batch | Create a payment batch from an eligible received purchase | Add a received purchase into a new payment batch | The payment amount starts with the correct payable total | Pass |
| BB-21 | Valid | Payment batch | Change a purchase after it has been added to an unpaid batch | Update a purchase that is linked to an unpaid batch line | The unpaid batch line updates correctly | Pass |
| BB-22 | Valid | Payment batch | Change a purchase after the batch line has already been paid | Update a purchase that is linked to a paid batch line | The paid batch line keeps its recorded amount | Pass |
| BB-23 | Invalid | Product pictures | Try to upload a file that is not an image as a product picture | Upload a non-image file during product creation | The system rejects the file and shows that it is not a valid image upload | Pass |
| BB-24 | Invalid | Sale validation | Try to save a packed sale with more quantity than available stock | Create a packed sale above available stock | The system rejects the save | Pass |
| BB-25 | Invalid | Product rules | Try to use a disabled product in a new transaction | Attempt to create a purchase, sale, or quotation using a disabled product | The system rejects the disabled product | Pass |
| BB-26 | Invalid | Product maintenance | Try to delete a product that already has transaction history | Delete a product already used in transactions | The system blocks the deletion | Pass |
| BB-27 | Invalid | Billing note | Try to reuse a sale that is already in an active billing note | Check billing note eligibility for that sale | The sale does not appear in the eligible list | Pass |
| BB-28 | Invalid | Payment batch | Try to reuse a purchase that is already in an active payment batch | Check payment batch eligibility for that purchase | The purchase does not appear in the eligible list | Pass |
| BB-29 | Invalid | Credit note | Try to credit the same cancelled item again | Check eligibility after a sale line was already credited | The already-credited item is excluded | Pass |
| BB-30 | Invalid | Credit note validation | Try to link a credit note to the wrong customer's billing note | Submit a credit note with a mismatched billing note | The system rejects the invalid link | Pass |

## Notes
- These black-box cases are a simpler version of the real automated backend test suite.
- The detailed run history is stored in `run-01/summary.md`, `run-01/raw-output.txt`, `run-02/summary.md`, and `run-02/raw-output.txt`.
- The current version uses both valid and invalid test cases.
- All 30 cases passed in the latest recorded run.
