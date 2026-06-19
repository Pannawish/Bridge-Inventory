# Scenario Test Manual (English)

## Scenario name
Quotation to purchase, payment, sale, credit note, and billing note flow

## Purpose
This test checks one full business flow in the Inventory Management web app:

1. Create a quotation with 2 items
2. Create a purchase from that quotation
3. Mark the purchase items as received
4. Create a payment batch and mark it as paid
5. Create a sale from the same quotation
6. Cancel 1 sale item and deliver 1 sale item
7. Create a credit note from the popup
8. Create a billing note from the sale and link the credit note

## Before you start
Please make sure these records already exist in the system:

- 1 customer
- 1 supplier
- 2 products

Important:

- Both quotation items must have supplier information in the quotation. If an item has no supplier option, it cannot be turned into a purchase order.
- Use simple test values. Real accounting values are not required for this manual test.

## Suggested test data
- Customer: any existing customer
- Supplier: any existing supplier
- Product 1: any existing product
- Product 2: any existing product
- Quantity: 1 or more for each item

## Step-by-step test

### Part A: Create a quotation with 2 items
1. Open the **Quotations** page.
2. Click **New Quotation**.
3. Select one customer.
4. Add **2 quotation items**.
5. For each item:
   - choose a product
   - enter quantity
   - enter sale price
   - add or select a supplier option with a cost price
6. Click **Create Quotation**.

Expected result:
- The quotation is saved successfully.
- A quotation number appears.
- The quotation now shows 2 items.

### Part B: Create a purchase from the quotation
1. Open the quotation that was just created.
2. Click **Purchase** or **Create Purchase Orders**.
3. In **Select Products to Purchase**, keep both items selected.
4. Make sure a supplier is selected for each item.
5. Click **Continue**.
6. Review the purchase order form.
7. Click **Save Purchase**.

Expected result:
- A purchase order is created from the quotation.
- The purchase contains the selected items.

### Part C: Mark the purchase as received
1. Open the **Purchases** page.
2. Open the purchase order created in Part B.
3. For each purchase item, click **Mark Received**.
4. If the screen asks for a received date, use today’s date.
5. Save the change if a save button appears.

Expected result:
- All purchase items are marked as received.
- The purchase status becomes **Received** or fully received.

### Part D: Create a payment batch and mark it as paid
1. Open the **Payment Batches** page.
2. Click **Create Payment Batch**.
3. Select the same supplier used in the purchase.
4. Select the purchase order created earlier.
5. Click **Create Payment Batch**.
6. Open the new payment batch.
7. Click **Mark All Paid**.
8. If needed, set the paid date to today.
9. Click **Save payments** if the button appears.

Expected result:
- The payment batch is created successfully.
- The purchase is included in the batch.
- The batch status becomes **Paid** after saving.

### Part E: Create a sale from the same quotation
1. Go back to the same quotation.
2. Click **Sale** or **Convert to Sale**.
3. In **Select Products to Sell**, keep both items selected.
4. Click **Continue**.
5. Review the sales form.
6. Click **Save Sale**.

Expected result:
- A sale is created from the quotation.
- The sale contains both items.

### Part F: Cancel one sale item and deliver one sale item
1. Open the **Sales** page.
2. Open the sale created in Part E.
3. Edit the sale.
4. Change **Item 1** status to **Cancelled**.
5. Change **Item 2** status to **Delivered**.
6. If the system asks for a delivered date, use today’s date.
7. Save the sale by clicking **Save Sale Updates** or the available save button.

Expected result:
- One line is cancelled.
- One line is delivered.
- The sale is updated successfully.

### Part G: Create a credit note from the popup
1. After saving the sale, wait for the **Create a Credit Note?** popup.
2. Keep the cancelled item selected.
3. Leave **Apply to Billing Note** empty for now.
4. Click **Create Credit Note**.

Expected result:
- A credit note is created for the cancelled item.
- The credit note is saved successfully.

### Part H: Create a billing note and link the credit note during creation
1. Open the **Billing Notes** page.
2. Click **Create Billing Note**.
3. Select the same customer from the sale.
4. Select the sale created in Part E.
5. In **Choose Credit Notes**, find the credit note created in Part G.
6. Tick that credit note so it will be included.
7. Check that the net payable amount is reduced.
8. Click **Create Billing Note**.

Expected result:
- The billing note is created successfully.
- The sale is included in the billing note.
- The selected credit note is linked to the billing note during creation.
- The billing note total is reduced by the credit note amount.

## Final success check
At the end of the test, the user should be able to confirm all of these:

- The quotation was created with 2 items.
- A purchase was created from the quotation.
- The purchase was received.
- A payment batch was created and marked as paid.
- A sale was created from the same quotation.
- One sale item was cancelled and one was delivered.
- A credit note was created from the cancelled item.
- A billing note was created from the sale.
- The credit note was linked to the billing note during billing note creation.

## If the tester gets stuck
- If a product cannot be included in a purchase, go back to the quotation and add supplier information for that item.
- If the sale does not appear when creating a billing note, save the sale first and make sure the delivered item is really marked **Delivered**.
- If no credit note appears in the billing note screen, first check that the credit note was created successfully, is still issued, and belongs to the same customer.

## Tester record
- Tester name: ____________________
- Test date: ____________________
- Result: Pass / Fail
- Notes: ______________________________________________
