# Bridge Inventory Training Manual

This document is written for end users of the web app: operations staff, purchasing staff, sales staff, finance staff, supervisors, and new team members.

Use it as a step-by-step training guide, not as a developer document.

For setup and local environment instructions, use [README.md](/Users/peto/Documents/Inventory-Management-frontend/README.md) and [backend/README.md](/Users/peto/Documents/Inventory-Management-frontend/backend/README.md).

For exact business-rule details such as status logic, FIFO allocation, and eligibility rules, use [docs/business-rules-reference.md](/Users/peto/Documents/Inventory-Management-frontend/docs/business-rules-reference.md).

## 1. What This System Does

This system is for a business that:

- buys products from suppliers
- keeps stock in inventory
- sells products to customers
- tracks what has been purchased, received, sold, billed, paid, cancelled, or returned

The app connects these workflows:

- master data: categories, products, suppliers, customers
- operations: quotations, purchases, sales
- finance follow-up: billing notes, payment batches, credit notes
- stock visibility: dashboard, inventory, product history

## 2. Who Should Use Which Screen

| Role | Main screens |
| --- | --- |
| Admin / supervisor | `Dashboard`, `Inventory`, `Settings` |
| Product or stock controller | `Products`, `Categories`, `Inventory` |
| Purchasing staff | `Quotation`, `Purchases`, `Suppliers` |
| Sales staff | `Quotation`, `Sales`, `Customers` |
| Finance staff | `Billing Notes`, `Payment Batches`, `Credit Notes` |

## 3. Sidebar Navigation

The sidebar is grouped by business function.

`Workspace`

- `Dashboard`
- `Inventory`
- `AI Chat`

`Purchasing`

- `Quotation`
- `Purchases`
- `Suppliers`

`Sales`

- `Sales`
- `Customers`

`Records`

- `Billing Notes`
- `Payment Batches`
- `Credit Notes`
- `Products`
- `Categories`

`Settings`

- language switch between English and Thai

Screenshot:

<img src="docs/screenshots/sidebar-navigation.png" alt="Sidebar navigation" width="1100" />

*Sidebar navigation showing the Workspace, Purchasing, Sales, Records, and Settings groups.*

## 4. Training Sequence For New Users

Train new users in this order:

1. Learn the sidebar and screen names
2. Review categories and products
3. Review suppliers and customers
4. Create a quotation
5. Create a purchase
6. Receive purchase items
7. Create a sale
8. Update sale delivery statuses
9. Create a billing note
10. Create a payment batch
11. Create a credit note when needed
12. Review stock and history from inventory and product pages

## 5. Before You Start Checklist

Before entering transactions, confirm all of the following:

- [ ] Categories have been created
- [ ] Products have valid SKUs
- [ ] Products have the correct base unit
- [ ] Products have the correct purchase and sales units
- [ ] Unit conversions are set for products that use different units
- [ ] Suppliers exist and have correct company names
- [ ] Customers exist and have correct company names
- [ ] You understand whether your team starts from quotation first or sale first

## 6. Core Rules Users Must Understand

These are the most important operating rules in the system.

- Stock is not a free-text number. It is derived from transaction history.
- Receiving purchase items increases available stock.
- Sale progress can reduce stock according to backend rules.
- Stock allocation and cost movement follow FIFO (first in, first out) by default, so older received stock is used before newer stock.
- Sales can use automatic FIFO allocation or a manual stock-source choice when the user needs to choose specific purchase layers.
- Product base units matter. Incorrect units create incorrect stock.
- Purchase, sale, billing note, and payment batch records keep historical snapshots on purpose.
- Use eligible records when creating billing notes, payment batches, and credit notes.

## 7. First-Time Master Data Setup

### 7.1 Categories

Use `Categories` to create the product tree.

Do this:

1. Open `Categories`
2. Create the top-level category
3. Create child categories under the correct parent
4. Confirm the tree is readable in one screen

Checklist:

- [ ] Top-level groups are correct
- [ ] Child categories are attached to the correct parent
- [ ] No duplicate category names were created by mistake

Screenshot:

<img src="docs/screenshots/categories-tree.png" alt="Category tree" width="1100" />

*Category tree with parent and child rows visible in one screen.*

### 7.2 Products

Use `Products` to define the item master.

Enter or confirm:

- SKU
- product name
- category
- stock base unit
- default purchase unit
- default sales unit
- unit conversions
- reorder level
- pictures if used by the team

Checklist:

- [ ] SKU is unique
- [ ] Product name is correct
- [ ] Category is assigned
- [ ] Base unit is correct
- [ ] Purchase unit is correct
- [ ] Sales unit is correct
- [ ] Unit conversion has been added when needed
- [ ] Reorder level is set if the team uses restock planning

Common mistake:

- Do not skip unit conversion when buying and selling in different units.

Screenshot:

<img src="docs/screenshots/product-form-unit-conversions.png" alt="Product form with unit conversions" width="1100" />

*Product form showing base unit, default purchase and sales units, and unit conversions.*

### 7.3 Suppliers

Use `Suppliers` to maintain vendor records.

Recommended fields to fill:

- company name
- tax ID
- procurement contact
- phone
- email
- payment terms
- notes

Checklist:

- [ ] Company name is correct
- [ ] Tax ID is entered if available
- [ ] Procurement contact is entered
- [ ] Payment terms are reviewed

Screenshot:

<img src="docs/screenshots/suppliers-form.png" alt="Supplier form" width="1100" />

*Supplier form for entering company, procurement, contact, and delivery details.*

### 7.4 Customers

Use `Customers` to maintain customer records.

Recommended fields to fill:

- company name
- tax ID
- phone
- email
- billing details
- shipping details
- payment terms
- notes

Checklist:

- [ ] Company name is correct
- [ ] Tax ID is entered if available
- [ ] Billing or shipping details are reviewed
- [ ] Payment terms are reviewed

Screenshot:

<img src="docs/screenshots/customers-form.png" alt="Customer form" width="1100" />

*Customer form for entering company, billing, shipping, and payment details.*

## 8. Daily Workflow Training

### 8.1 Quotation Workflow

Use `Quotation` when a customer request starts with a quote.

Purpose:

- prepare an offer for the customer
- compare stock against demand
- record supplier sourcing before purchase or sale

Steps:

1. Open `Quotation`
2. Start a new quotation
3. Select the customer
4. Add product lines
5. Enter quantity and unit
6. Enter sale price
7. Add supplier sourcing options if known
8. Review the stock sufficiency column
9. Save the quotation

Checklist before saving:

- [ ] Customer is correct
- [ ] All product lines are correct
- [ ] Quantities and units are correct
- [ ] Sale prices are correct
- [ ] Stock sufficiency has been reviewed

What to watch:

- `Sufficient` means stock can cover the line
- `Need Purchase` means additional buying is likely required

Screenshot:

<img src="docs/screenshots/quotation-entry.png" alt="Quotation entry screen" width="1100" />

*Quotation entry screen with customer selection, line items, pricing, and supplier sourcing fields.*

### 8.2 Purchase Workflow

Use `Purchases` to create and track purchase orders.

Purpose:

- place orders with suppliers
- track expected delivery
- receive stock into the system

Steps:

1. Open `Purchases`
2. Start a new purchase
3. Select the supplier
4. Confirm the transaction date
5. Add purchase lines or review converted lines
6. Confirm quantity, unit, and unit cost
7. Enter expected delivery dates if needed
8. Save the purchase
9. Update line item receiving status when goods arrive
10. Attach documents if required

Checklist before saving:

- [ ] Supplier is correct
- [ ] Purchase lines are correct
- [ ] Costs are correct
- [ ] Units match the supplier order
- [ ] Expected delivery dates are filled if used by the team

Checklist when receiving:

- [ ] Only received items are marked `received`
- [ ] Partial receipts remain partial
- [ ] Cancelled items are marked `cancelled` if they will never arrive

Purchase statuses:

- `draft`
- `ordered`
- `partially_received`
- `received`
- `cancelled`

Purchase item statuses:

- `pending`
- `received`
- `cancelled`

Common mistake:

- Do not mark items as `received` before physical stock is in hand.

Screenshot:

<img src="docs/screenshots/purchase-form-receiving-status.png" alt="Purchase detail with receiving statuses" width="1100" />

*Purchase detail showing line items and item receiving statuses.*

### 8.3 Sales Workflow

Use `Sales` to create customer sales and track fulfillment.

Purpose:

- record customer demand
- track outbound progress
- protect stock through backend validation

Steps:

1. Open `Sales`
2. Start a new sale
3. Select the customer
4. Add product lines
5. Confirm quantity, unit, and selling price
6. Save the sale
7. Move line items through fulfillment statuses as work happens

Checklist before saving:

- [ ] Customer is correct
- [ ] Product lines are correct
- [ ] Selling prices are correct
- [ ] Quantities and units are correct

Checklist before changing status:

- [ ] Stock has been reviewed
- [ ] The physical operation really happened
- [ ] The next status matches the real delivery stage

Sale statuses:

- `draft`
- `partially_packed`
- `packed`
- `partially_shipped`
- `shipped`
- `partially_delivered`
- `delivered`
- `cancelled`
- `returned`

Sale item statuses:

- `pending`
- `packed`
- `shipped`
- `delivered`
- `cancelled`
- `returned`

Common mistake:

- Do not move sale items forward just to make the screen look complete. These statuses affect stock and downstream finance eligibility.
- If stock sources are chosen manually, make sure the selected purchase layers match the intended shipment. Otherwise, leave allocation to automatic FIFO.

Screenshot:

<img src="docs/screenshots/sales-form-delivery-statuses.png" alt="Sales detail with delivery statuses" width="1100" />

*Sales detail showing sale lines and delivery progress statuses.*

### 8.4 Billing Note Workflow

Use `Billing Notes` to group eligible sales for customer collection.

Purpose:

- track what customers should pay
- organize receivable follow-up

Steps:

1. Open `Billing Notes`
2. Start a new billing note
3. Choose eligible sales
4. Confirm customer and amounts
5. Save the billing note
6. Update payment status later

What `eligible sales` means:

- the sale is in a billing-note-eligible status
- in this app, that means the sale must already be `shipped`, `partially_delivered`, or `delivered`
- the sale must not already be linked to another active billing note
- if a billing note was cancelled, its sales become available again

In simple terms:

- eligible sales are sales that are ready to bill and are not already being billed elsewhere

Checklist:

- [ ] Only eligible sales were selected
- [ ] Customer is correct
- [ ] Expected payment date is reviewed
- [ ] Total amount is reviewed

Billing note statuses:

- `draft`
- `issued`
- `partially_received`
- `fully_received`
- `cancelled`

Screenshot:

<img src="docs/screenshots/billing-note-eligible-sales.png" alt="Billing note eligible sales selector" width="1100" />

*Billing note creation screen with eligible sales available for selection.*

### 8.5 Payment Batch Workflow

Use `Payment Batches` to group eligible purchases for supplier payment.

Purpose:

- plan outgoing payments
- record supplier payable follow-up

Steps:

1. Open `Payment Batches`
2. Start a new payment batch
3. Choose eligible purchases
4. Confirm supplier and amounts
5. Save the payment batch
6. Update payment status later

What `eligible purchases` means:

- the purchase is in a payment-batch-eligible status
- in this app, that means the purchase order must already be `partially_received` or `received`
- the purchase must not already be linked to another active payment batch
- if a payment batch was cancelled, its purchases become available again

In simple terms:

- eligible purchases are purchase orders that are ready to pay and are not already included in another active supplier payment batch

Checklist:

- [ ] Only eligible purchases were selected
- [ ] Supplier is correct
- [ ] Planned payment date is reviewed
- [ ] Total amount is reviewed

Payment batch statuses:

- `draft`
- `scheduled`
- `partially_paid`
- `paid`
- `cancelled`

Screenshot:

<img src="docs/screenshots/payment-batch-eligible-purchases.png" alt="Payment batch eligible purchases selector" width="1100" />

*Payment batch creation screen with eligible purchase orders available for selection.*

### 8.6 Credit Note Workflow

Use `Credit Notes` when cancelled or returned sale items require a formal value reduction.

Purpose:

- reduce receivable value correctly
- record customer credit based on cancelled or returned items

Main flow:

- the main flow starts from the `Sales` screen
- when a sale item status is changed to `cancelled` or `returned`, the app automatically opens the credit note creation prompt
- that prompt lets the user issue the credit note immediately for the newly cancelled or returned items
- this is the normal and fastest way to create the credit note while the sale change is still fresh
- if the user clicks `Create Later`, the sale remains available in the `Credit Notes` page and the credit note can be created there later

Steps:

1. In `Sales`, change the affected sale item status to `cancelled` or `returned`
2. Review the credit note prompt that opens automatically
3. Create the credit note immediately, or choose `Create Later`
4. If creating later, open `Credit Notes`
5. Start a new credit note
6. Choose eligible sales
7. Review the cancelled or returned lines
8. Confirm the amount
9. Save the credit note

What `eligible sales` means for credit notes:

- the sale has at least one line item with status `cancelled` or `returned`
- that cancelled or returned line has not already been used in another active credit note
- cancelled credit notes release those lines again, so they can be credited properly later if needed

In simple terms:

- eligible credit note sales are sales that still have cancelled or returned items left to credit

Checklist:

- [ ] The sale item was actually changed to `cancelled` or `returned`
- [ ] The credit note prompt was reviewed before closing it
- [ ] The source sale is correct
- [ ] The cancelled or returned lines are correct
- [ ] The amount is correct

Credit note statuses:

- `issued`
- `cancelled`

Screenshot:

<img src="docs/screenshots/credit-note-eligible-sales.png" alt="Credit note eligible sales selector" width="1100" />

*Credit note creation screen showing cancelled or returned items selected for credit.*

## 9. Inventory Review Training

### 9.1 Dashboard

Use `Dashboard` for a quick management summary.

Review:

- overall stock visibility
- recent transaction activity
- summary indicators that need follow-up

Daily checklist:

- [ ] Check whether any stock issue needs attention
- [ ] Check whether recent activity looks correct
- [ ] Check whether the numbers match current operations

Screenshot:

<img src="docs/screenshots/dashboard-overview.png" alt="Dashboard overview" width="1100" />

*Dashboard overview with KPI cards, trend chart, and top products summary.*

### 9.2 Inventory

Use `Inventory` for operational stock review.

Look here for:

- low stock
- reorder pressure
- stock value
- movement
- suggested supplier restock context
- FIFO stock layers when reviewing how current stock and cost are built

Daily checklist:

- [ ] Review products near or below reorder point
- [ ] Review fast-moving products
- [ ] Review dead stock or no-sales products
- [ ] Review products that need purchase follow-up

Screenshot:

<img src="docs/screenshots/inventory-stock-review.png" alt="Inventory stock review table" width="1100" />

*Inventory stock review table with filters and stock health metrics.*

### 9.3 Product History

Use `Products` when you need to inspect one product in detail.

Review:

- current stock
- purchase history
- sales history
- units and conversions

Checklist:

- [ ] Product identity is correct
- [ ] Stock position makes sense
- [ ] Recent purchases and sales explain current stock

Screenshot:

<img src="docs/screenshots/product-history-detail.png" alt="Product detail and history" width="1100" />

*Product detail view with stock context and transaction history.*

## 10. Daily End-To-End Example

Use this scenario during training.

Scenario:

- Product: `PVC Pipe 2m`
- Supplier: `Alpha Plastics`
- Customer: `North Build Co.`

Training run:

1. Confirm the product exists and has correct units
2. Confirm supplier and customer records exist
3. Create a quotation for `North Build Co.`
4. Review stock sufficiency
5. Create a purchase if stock is short
6. Receive the purchased items
7. Create the sale
8. Move sale lines through packing, shipping, and delivery
9. Create a billing note from the eligible sale
10. Create a payment batch from the eligible purchase
11. If some sold quantity is cancelled or returned, create a credit note

Trainer checklist:

- [ ] Trainee can find each screen without help
- [ ] Trainee understands the difference between master data and transactions
- [ ] Trainee understands which statuses affect stock
- [ ] Trainee understands which finance documents require eligibility

## 11. Common Mistakes To Avoid

- Entering the wrong base unit on a product
- Forgetting to add unit conversions
- Marking purchase items as received too early
- Advancing sale statuses before physical movement happened
- Creating billing notes or payment batches from the wrong records
- Treating historical snapshot fields like temporary duplicates

## 12. Quick Reference

| If you want to... | Go to... |
| --- | --- |
| see high-level business status | `Dashboard` |
| review stock health and reorder pressure | `Inventory` |
| create or edit products | `Products` |
| manage the category tree | `Categories` |
| create or edit suppliers | `Suppliers` |
| create or edit customers | `Customers` |
| prepare a quote | `Quotation` |
| create or receive a purchase | `Purchases` |
| create or fulfill a sale | `Sales` |
| track customer collections | `Billing Notes` |
| track supplier payments | `Payment Batches` |
| record cancelled or returned sale value reductions | `Credit Notes` |
| ask operations questions in natural language | `AI Chat` |
| switch between English and Thai | `Settings` |

## 13. Screenshot Capture Plan

If you want to turn this into a polished handout or PDF, capture these screenshots and place them under matching sections:

- [ ] Sidebar navigation
- [ ] Category tree
- [ ] Product form with unit conversions
- [ ] Supplier form
- [ ] Customer form
- [ ] Quotation entry screen
- [ ] Purchase form and receiving status
- [ ] Sales form and delivery statuses
- [ ] Billing note eligible sales selector
- [ ] Payment batch eligible purchases selector
- [ ] Credit note eligible sales selector
- [ ] Dashboard overview
- [ ] Inventory stock review table
- [ ] Product history or product detail view

## 14. Notes For Future Maintainers

This file is now positioned as an end-user manual. Keep it aligned with real UI labels and real workflow behavior.

Before updating workflow instructions, confirm behavior against:

- [README.md](/Users/peto/Documents/Inventory-Management-frontend/README.md)
- [AGENTS.md](/Users/peto/Documents/Inventory-Management-frontend/AGENTS.md)
- the actual page labels in `frontend/src`
