# Inventory Management Handout

This handout is for team members, evaluators, and future contributors who need to understand how the web app is meant to be used in day-to-day operations.

It focuses on workflow first:

- what each area of the app is for
- what order to use the screens in
- how stock, purchases, sales, and finance records connect
- what status changes mean

For local setup and development commands, use [README.md](/Users/peto/Documents/Inventory-Management-frontend/README.md) and [backend/README.md](/Users/peto/Documents/Inventory-Management-frontend/backend/README.md).

## 1. What This System Is For

This system is designed for a trading business that:

- buys from suppliers
- keeps inventory in stock
- sells to customers
- tracks margin, commitments, and operational follow-up

The app is not just a stock list. It connects master data, transactions, stock impact, and finance records in one flow.

## 2. Main App Areas

The sidebar is grouped by workflow.

`Workspace`

- `Dashboard`: high-level KPIs and recent operational visibility
- `Inventory`: stock health, reorder planning, and supplier/value insight
- `AI Chat`: ask operational questions about stock, sales, purchases, and trends

`Purchasing`

- `Quotation`: prepare customer quotation lines and supplier sourcing options
- `Purchases`: create and manage purchase orders, receiving, and supplier documents
- `Suppliers`: maintain supplier records

`Sales`

- `Sales`: create and manage sales transactions and delivery progress
- `Customers`: maintain customer records

`Records`

- `Billing Notes`: customer receivables batches from eligible sales
- `Payment Batches`: supplier payable batches from eligible purchases
- `Credit Notes`: issue reductions for cancelled or returned sale items
- `Products`: maintain product master data
- `Categories`: maintain the product category tree

`Settings`

- language switch between English and Thai

## 3. Recommended Business Workflow

For most teams, the cleanest operating order is:

1. Set up `Categories`
2. Set up `Products`
3. Set up `Suppliers`
4. Set up `Customers`
5. Create a `Quotation` if the sale starts from a quote
6. Convert or create a `Purchase` when stock is needed
7. Receive the purchase items
8. Create a `Sale`
9. Progress sale item statuses as goods move out
10. Create a `Billing Note` for eligible sales
11. Create a `Payment Batch` for eligible purchases
12. Create a `Credit Note` if cancelled or returned sale items require it

Not every business uses every step every time. For example:

- some sales may be created directly without a quotation
- some products may already be in stock, so no purchase is needed
- some cancelled or returned items will not require a credit note

## 4. First-Time Setup Inside The App

If you are using a fresh database, start here.

### Categories

Use `Categories` to build the product tree.

- Create top-level categories first
- Add child categories under the correct parent
- Keep the tree practical and readable for product filtering

### Products

Use `Products` to define stock items.

For each product, confirm:

- SKU
- product name
- category
- stock base unit
- default purchase unit
- default sales unit
- unit conversions when purchase and sales units differ from base unit
- reorder level if the team uses reorder planning
- images if needed

Important:

- stock is tracked in base units
- unit conversions matter for correct purchase, sale, and quotation quantities

### Suppliers

Use `Suppliers` to store:

- company name
- tax ID
- contact details
- procurement contact
- payment terms
- notes

### Customers

Use `Customers` to store:

- company name
- tax ID
- contact details
- billing/shipping details
- payment terms
- notes

## 5. How To Use Each Workflow

### A. Quotation Workflow

Use `Quotation` when a sale starts with a commercial quote.

Typical flow:

1. Create a quotation
2. Select the customer
3. Add line items
4. Set quantity and unit
5. Add sale price
6. Add supplier sourcing options if known
7. Review stock sufficiency
8. Save the quotation

What the quotation helps with:

- showing what can be fulfilled from stock
- showing what needs to be purchased
- recording sourcing options before committing to a purchase or sale

After a quotation is saved, it can be used as the starting point for:

- a purchase order
- a sales transaction

### B. Purchase Workflow

Use `Purchases` to manage buying from suppliers.

Typical flow:

1. Create a purchase order directly or from a quotation
2. Confirm supplier and transaction date
3. Add or review purchase lines
4. Check expected delivery dates
5. Save the purchase order
6. Update item receiving status as stock arrives
7. Attach supplier documents if needed

Purchase statuses:

- `draft`: not yet finalized
- `ordered`: placed with supplier
- `partially_received`: some items received
- `received`: all relevant items received
- `cancelled`: no longer active

Purchase item statuses:

- `pending`
- `received`
- `cancelled`

Operational note:

- receiving purchase items is what moves stock into available inventory
- stock impact is enforced on the backend, not just in the browser

### C. Sales Workflow

Use `Sales` to record customer orders and outbound fulfillment.

Typical flow:

1. Create a sale directly or from a quotation
2. Select the customer
3. Add line items
4. Confirm quantity, unit, and selling price
5. Save as draft if details are still changing
6. Move item statuses forward as goods are packed, shipped, or delivered

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

Operational note:

- the backend validates stock before allowing stock-deducting sale progress
- do not assume a sale is safe just because the form looks valid

### D. Billing Note Workflow

Use `Billing Notes` to group eligible sales into a receivable document for customers.

Typical flow:

1. Open `Billing Notes`
2. Start a new billing note
3. Choose from eligible sales
4. Confirm customer, amounts, and dates
5. Save the billing note
6. Update collection status over time

Billing note statuses:

- `draft`
- `issued`
- `partially_received`
- `fully_received`
- `cancelled`

Use this area when the team needs to track money expected from customers after sales are completed or ready for billing.

### E. Payment Batch Workflow

Use `Payment Batches` to group eligible purchases into a supplier payable batch.

Typical flow:

1. Open `Payment Batches`
2. Start a new batch
3. Choose from eligible purchases
4. Confirm supplier, amounts, and payment dates
5. Save the batch
6. Update payment status over time

Payment batch statuses:

- `draft`
- `scheduled`
- `partially_paid`
- `paid`
- `cancelled`

Use this area when the team needs to plan or confirm outgoing payments to suppliers.

### F. Credit Note Workflow

Use `Credit Notes` when cancelled or returned sale items require a formal value reduction.

Typical flow:

1. Open `Credit Notes`
2. Start a new credit note
3. Choose eligible sales with cancelled or returned lines
4. Confirm the affected lines and amounts
5. Save the credit note

Credit note statuses:

- `issued`
- `cancelled`

## 6. Inventory And Stock Understanding

The system derives stock from transaction history rather than trusting a casually edited stock number.

In practice:

- received purchase items increase stock availability
- packed, shipped, or delivered sale items consume stock according to the backend rules
- cancelled or returned flows change what remains active

Use `Inventory` for:

- reorder planning
- low-stock review
- stock value review
- supplier restock hints
- movement and demand visibility

Use `Products` when you need to inspect one product in detail, including history and master data.

## 7. How To Work Safely

Follow these habits to keep the data clean.

- Create master data first before creating transactions
- Keep SKUs unique and stable
- Use correct base units and unit conversions
- Do not mark purchase items as received before stock is actually in hand
- Do not move sale items to packed, shipped, or delivered casually; these statuses affect stock logic
- Use billing notes and payment batches only from eligible records
- Preserve historical transaction snapshots even if supplier, customer, or product master data later changes

## 8. Common End-To-End Example

Here is the simplest realistic example.

1. Create product `PVC Pipe 2m`
2. Add supplier `Alpha Plastics`
3. Add customer `North Build Co.`
4. Create quotation for `North Build Co.`
5. Check whether current stock is enough
6. If stock is short, convert or create purchase order to `Alpha Plastics`
7. Receive the purchased quantity
8. Create sale for the customer
9. Progress the sale lines as goods are packed, shipped, and delivered
10. Create a billing note for the eligible sale
11. Later, create a payment batch for the supplier purchase
12. If part of the sale is cancelled or returned, issue a credit note where needed

## 9. What Future Contributors Should Know

If you are reading this as a builder rather than an operator, the important architectural ideas are:

- backend validation is authoritative
- stock logic is derived from transaction item statuses
- quotation lines are normalized in `QuotationItem`
- finance workflows use eligibility-based creation, not free-form linking
- list pages may paginate, but category trees should remain whole
- the app preserves historical snapshot fields intentionally for audit readability

Before changing behavior, read [AGENTS.md](/Users/peto/Documents/Inventory-Management-frontend/AGENTS.md).

## 10. Quick Reference

Use this shortcut table when training a new user.

| If you want to... | Go to... |
| --- | --- |
| see KPIs and recent operational picture | `Dashboard` |
| review reorder pressure and stock health | `Inventory` |
| add or edit product master data | `Products` |
| manage the category tree | `Categories` |
| add or edit suppliers | `Suppliers` |
| add or edit customers | `Customers` |
| prepare a quote before purchase or sale | `Quotation` |
| buy from a supplier | `Purchases` |
| sell to a customer | `Sales` |
| group customer receivables | `Billing Notes` |
| group supplier payables | `Payment Batches` |
| issue value reductions for cancelled or returned sales | `Credit Notes` |
| ask the system operational questions | `AI Chat` |
| switch language | `Settings` |

## 11. Suggested Next Improvement

This handout is a strong starting point, but the next useful step would be to add screenshots or a short “day in the life” walkthrough with sample data.
