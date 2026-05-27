# Business Rules Reference

This document is the detailed business-logic reference for the inventory system.

Use it when you need exact behavior, not just training steps. It is intended for:

- supervisors
- process owners
- trainers
- implementation reviewers
- advanced end users

Use [HANDOUT.md](/Users/peto/Documents/Inventory-Management-frontend/HANDOUT.md) for step-by-step user training. Use this file when you need to understand why the system behaves the way it does.

When this file and the handout differ, this file should be treated as the more exact description of current system behavior.

## 1. Core Principles

These rules apply across the whole website.

### 1.1 Stock is derived, not typed in manually

- The system does not treat product stock as a manually maintained master-data field.
- Available stock is derived from received purchase quantities minus committed sale quantities.
- A purchase line affects stock only when it is `received`.
- A sale line affects stock only when it is `packed`, `shipped`, or `delivered`.
- Sale lines in `draft`, `pending`, `cancelled`, or `returned` do not reduce available stock.

### 1.2 Line-item status is the operational source of truth

- For purchases and sales, line-item status is what drives stock and partial-progress logic.
- Whole-document statuses such as `partially_received` or `partially_shipped` are aggregate results of line-item statuses.
- Partial statuses exist at the document level only. Line items never use `partial_*` statuses.

### 1.3 Historical snapshot fields are intentional

- Transaction records keep snapshots such as partner names, product names, SKU, prices, totals, and tax values.
- These snapshots are not redundant mistakes. They preserve the meaning of historical business documents even if master data changes later.

### 1.4 Backend rules are authoritative

- The frontend helps users, but the backend decides what is valid.
- Stock validation, eligibility filtering, and finance-link protection must be assumed to come from backend logic.

## 2. Master Data Rules

### 2.1 Categories

- Categories form a tree, not a flat list.
- A category cannot be deleted if it is still referenced by products.
- Parent-child relationships matter. A parent category should not be removed while child categories still depend on it.

### 2.2 Products

- A product with purchase, sale, or quotation history should be treated as historical business data.
- Such a product cannot be deleted once it has transaction history.
- The correct action is usually to disable the product instead of deleting it.
- Disabled products cannot be used in new quotations, purchases, or sales.
- Existing historical transactions that already reference the product remain valid.

### 2.3 Suppliers and Customers

- Supplier and customer records are the partner master data used for new transactions.
- Historical purchase, sale, quotation, billing, payment, and credit records keep their own name snapshots and remain readable even if partner master data changes later.

## 3. Quotation Rules

Quotations do not use a stored workflow status like purchases and sales do. Their visible state is derived from validity settings.

### 3.1 Validity logic

- If `valid_until_date` is blank, the quotation is treated as `Valid`.
- If `valid_until_date` is today or later, the quotation is `Valid`.
- If `valid_until_date` is before today, the quotation is `Expired`.

### 3.2 Valid-until calculation modes

- `calendar`: add calendar days to the quotation date
- `business`: add working days only, skipping Saturday and Sunday
- `no_valid_date`: no expiry date is stored, so the quotation remains `Valid` in the UI

### 3.3 Quotation line storage

- Quotation lines are stored as normalized line items, not as a single JSON blob.
- The API still exposes an `items` array for frontend compatibility, but the database source of truth is line-item based.

### 3.4 Operational meaning

- A quotation is a commercial proposal, not a stock-moving document.
- Creating a quotation does not reserve or deduct stock by itself.
- A quotation may be used as the starting point for later purchase or sale records, but the quotation itself remains part of history.

## 4. Purchase Rules

Purchases represent inbound stock from suppliers.

### 4.1 Purchase statuses

| Status | Meaning |
| --- | --- |
| `draft` | Internal draft only. No stock has been received. |
| `ordered` | Sent or considered placed with supplier, but no received quantity yet. |
| `partially_received` | At least one active line is received, but not all active lines are received. |
| `received` | All active lines are received. |
| `cancelled` | All lines are cancelled, or the whole purchase has been cancelled. |

### 4.2 Purchase item statuses

| Item status | Meaning | Stock effect |
| --- | --- | --- |
| `pending` | Not yet received | No stock increase |
| `received` | Physically received into stock | Increases stock |
| `cancelled` | Will not be received | No stock increase |

### 4.3 How purchase status is derived

- If all line items are `cancelled`, the purchase becomes `cancelled`.
- If all non-cancelled line items are `received`, the purchase becomes `received`.
- If some non-cancelled line items are `received` and others are still `pending`, the purchase becomes `partially_received`.
- If no active lines are received yet, the purchase remains `draft` or `ordered` depending on its fallback document state.

### 4.4 Whole-document status propagation

- If a user sets the purchase to a full document status such as `received` and there are no explicit line-item statuses provided, the system propagates that full status to every line.
- Once line-level statuses are explicitly present, the document status is recalculated from the lines.

### 4.5 Date behavior

- When a purchase line becomes `received`, `received_date` is automatically set if blank.
- When a purchase line becomes `pending` or `cancelled`, `received_date` is cleared.
- If a pending line has an `expected_delivery_date` earlier than today, the UI shows `delayed`.
- `delayed` is a display state only. It is not a stored backend status.

### 4.6 Financial amount behavior

- `grand_total` preserves the original document total for audit purposes.
- `payable_total` is derived separately.
- `payable_total` excludes the value of cancelled purchase lines.
- This means a purchase can keep its full historical total while still showing a lower current amount owed to the supplier.

## 5. Sales Rules

Sales represent outbound customer demand and fulfillment progress.

### 5.1 Sale statuses

| Status | Meaning |
| --- | --- |
| `draft` | No line has reached a stock-deducting fulfillment stage. |
| `partially_packed` | At least one active line is `packed`, but not all active lines are fully at the same highest stage. |
| `packed` | All active lines are `packed`. |
| `partially_shipped` | At least one active line is `shipped`, but not all active lines are shipped or delivered. |
| `shipped` | All active lines are `shipped`. |
| `partially_delivered` | At least one active line is `delivered`, but not all active lines are delivered. |
| `delivered` | All active lines are `delivered`. |
| `cancelled` | All lines are cancelled. |
| `returned` | All lines are inactive and at least one line is returned. |

### 5.2 Sale item statuses

| Item status | Meaning | Stock effect |
| --- | --- | --- |
| `pending` | Not yet committed to stock | No stock decrease |
| `packed` | Committed to fulfill | Decreases stock |
| `shipped` | Sent out | Decreases stock |
| `delivered` | Delivered to customer | Decreases stock |
| `cancelled` | Cancelled before completion | Releases or avoids stock commitment |
| `returned` | Returned after fulfillment | Releases stock commitment from active demand |

### 5.3 How sale status is derived

- If all active lines are `delivered`, the sale becomes `delivered`.
- If at least one active line is `delivered`, the sale becomes `partially_delivered`.
- Else if all active lines are `shipped`, the sale becomes `shipped`.
- Else if at least one active line is `shipped`, the sale becomes `partially_shipped`.
- Else if all active lines are `packed`, the sale becomes `packed`.
- Else if at least one active line is `packed`, the sale becomes `partially_packed`.
- Else the sale is `draft`.
- If all lines are inactive and at least one line is `returned`, the sale becomes `returned`.
- If all lines are inactive and no line is `returned`, the sale becomes `cancelled`.

### 5.4 Whole-document status propagation

- If a user sets the sale to a full document status such as `packed`, `shipped`, or `delivered` and there are no explicit line-item statuses provided, the system propagates the corresponding item status to every line.
- If explicit line-item statuses exist, the document status is recalculated from the lines.
- Partial document statuses are never pushed down as partial item statuses. They exist only as aggregate results.

### 5.5 Date behavior

- When a line becomes `shipped`, `shipped_date` is automatically set if blank.
- When a line becomes `delivered`, both `shipped_date` and `delivered_date` are automatically set if blank.
- When a line drops back to a non-shipped state, shipment and delivery dates are cleared.

### 5.6 Stock validation

- Stock is checked server-side for quantities that would be committed by sale lines in `packed`, `shipped`, or `delivered`.
- A sale can remain `draft` without enough stock because draft lines do not commit stock yet.
- A sale cannot move active quantities into stock-deducting statuses if enough stock is not available.

## 6. FIFO Stock Allocation Rules

FIFO logic matters most for sales cost and margin tracking. The system supports both automatic FIFO allocation and manual stock-source selection.

### 6.1 What FIFO means in this system

- The system allocates stock from the oldest available received purchase layers first.
- Only purchase lines with `received` status can provide stock layers.
- A purchase layer is considered available only for its remaining unallocated quantity.
- Automatic FIFO is the default behavior when users do not choose layers manually.

### 6.2 FIFO order

When the system auto-allocates a sale line, it sorts candidate purchase layers by:

1. `received_date` ascending
2. purchase `transaction_date` ascending
3. purchase `created_at` ascending
4. line `id` ascending

This means the oldest received stock is consumed first.

### 6.3 Automatic allocation

- If a sale line is in a stock-deducting status and no manual allocation is supplied, the system allocates automatically using FIFO.
- If stock is insufficient after walking the available layers, the sale is rejected.
- Automatic allocation is the normal path for users who do not need to control the exact purchase layers used by a sale.

### 6.4 Manual allocation

- Users can manually choose specific purchase layers for a sale line.
- Manual selection overrides the default automatic FIFO choice for that sale line.
- Manual allocations must match the sale line quantity exactly.
- A selected purchase layer must:
  - belong to the same product
  - already be received
  - still have enough remaining quantity
- If manual allocations are missing, incomplete, or invalid, the backend rejects the sale update rather than silently guessing a different layer mix.

### 6.5 Cost snapshot behavior

- Once allocations are created, the system stores the sale line cost snapshot from those allocations.
- If the sale line uses stock from exactly one supplier layer set, that supplier can become the line's supplier snapshot.

## 7. Billing Note Rules

Billing notes group sales for customer collection follow-up.

### 7.1 Actual eligibility logic

A sale is eligible for billing-note creation only if all of the following are true:

- its sale status is one of:
  - `shipped`
  - `partially_delivered`
  - `delivered`
- it is not already linked to another active billing note
- if a previous billing note was `cancelled`, that link no longer blocks reuse

Important note:

- The training handout simplifies this rule as "shipped or delivered."
- The current backend logic also allows `partially_delivered`.

### 7.2 Customer rule

- All sales inside one billing note must belong to the same customer.

### 7.3 Billing note statuses

| Status | Meaning |
| --- | --- |
| `draft` | User-entered draft value, but line state may later recalculate status |
| `issued` | No billing-note lines are marked received |
| `partially_received` | Some lines are marked received |
| `fully_received` | All lines are marked received |
| `cancelled` | Billing note is cancelled and no longer blocks sale eligibility |

### 7.4 How billing-note status is derived

- If no lines are marked received, the status is `issued`.
- If some but not all lines are marked received, the status is `partially_received`.
- If all lines are marked received, the status is `fully_received`.

### 7.5 Payment-date rule

- `actual_payment_date` is set to the latest received date among received billing-note lines.

### 7.6 Credit-note effect on net receivable

- Active credit notes linked to the billing note reduce the net amount the customer is expected to pay.
- Cancelled credit notes do not reduce the net amount.

## 8. Payment Batch Rules

Payment batches group purchases for supplier payment follow-up.

### 8.1 Actual eligibility logic

A purchase is eligible for payment-batch creation only if all of the following are true:

- its purchase status is one of:
  - `received`
  - `partially_received`
- it is not already linked to another active payment batch
- if a previous payment batch was `cancelled`, that link no longer blocks reuse

Important note:

- The training handout simplifies this rule as "received."
- The current backend logic also allows `partially_received`.

### 8.2 Supplier rule

- All purchases inside one payment batch must belong to the same supplier.

### 8.3 Payment batch statuses

| Status | Meaning |
| --- | --- |
| `draft` | User-entered draft value, but line state may later recalculate status |
| `scheduled` | No lines are marked paid |
| `partially_paid` | Some lines are marked paid |
| `paid` | All lines are marked paid |
| `cancelled` | Batch is cancelled and no longer blocks purchase eligibility |

### 8.4 How payment-batch status is derived

- If no lines are marked paid, the status is `scheduled`.
- If some but not all lines are marked paid, the status is `partially_paid`.
- If all lines are marked paid, the status is `paid`.

### 8.5 Payment-date rule

- `actual_payment_date` is set to the latest paid date among paid lines.

### 8.6 Amount-sync behavior

- Unpaid payment-batch lines always reflect the current `payable_total` of their purchase.
- If a purchase later has cancelled items and its payable amount drops, unpaid payment-batch lines resync automatically.
- Paid payment-batch lines are frozen as financial history and do not auto-rewrite after payment is marked complete.

## 9. Credit Note Rules

Credit notes reduce receivable value for cancelled or returned sale items.

### 9.1 Credit-note source logic

- Credit notes are driven by sale items, not just by sale headers.
- A sale becomes credit-note eligible when it has at least one line in `cancelled` or `returned` status.

### 9.2 Eligibility logic

A sale item is eligible for a new credit note only if:

- its status is `cancelled` or `returned`
- it is not already included in another active credit note

If the earlier credit note is cancelled, the line becomes eligible again.

### 9.3 Credit note statuses

| Status | Meaning |
| --- | --- |
| `issued` | Active credit note |
| `cancelled` | Cancelled credit note that no longer blocks eligibility |

### 9.4 Customer consistency

- The credit note customer must match the selected sale customer.
- If a billing note is linked, it must belong to the same customer as the credit note.

### 9.5 Line requirements

- A credit note must contain at least one cancelled or returned line.
- Credit-note totals are the sum of the selected credit-note line amounts.

## 10. Dashboard And Inventory Logic

### 10.1 Backend-calculated stock metrics

- Dashboard and inventory stock metrics are backend-calculated.
- The frontend should not be treated as independently calculating full stock truth from partial page data.

### 10.2 Current stock formula

At a business level:

- current stock = received purchase quantity - committed sale quantity

Where committed sale quantity means sale lines already at:

- `packed`
- `shipped`
- `delivered`

### 10.3 Why this matters operationally

- Moving sale items too early into stock-deducting statuses makes stock look lower than the physical warehouse reality.
- Leaving received purchase items in `pending` makes stock look lower than reality.
- Status discipline is therefore part of stock discipline.

## 11. Operational Consequence Matrix

| Action | Stock | Billing eligibility | Payment eligibility | Credit-note eligibility |
| --- | --- | --- | --- | --- |
| Mark purchase item `received` | Increases stock | No direct effect | Can help purchase become eligible | No direct effect |
| Mark purchase item `cancelled` | Prevents stock increase | No direct effect | Can reduce payable amount | No direct effect |
| Mark sale item `packed` | Decreases stock | Not yet eligible by itself | No effect | No direct effect |
| Mark sale item `shipped` | Decreases stock | Can make sale eligible | No effect | No direct effect |
| Mark sale item `delivered` | Decreases stock | Can make sale eligible | No effect | No direct effect |
| Mark sale item `cancelled` | Releases active demand | No improvement toward billing | No effect | Makes line eligible |
| Mark sale item `returned` | Releases active demand | Sale is no longer an active fulfilled line for that item | No effect | Makes line eligible |

## 12. Practical Interpretation Notes

- `draft` means the transaction exists, but core operational progress has not started.
- `partial_*` means the document has mixed line states.
- `cancelled` means the line or document should stop driving active workflow.
- `returned` is distinct from `cancelled`: it indicates the item had progressed far enough to require a return treatment, not just a pre-fulfillment cancellation.
- Billing notes and payment batches are not just labels. Their statuses are recomputed from line-level received or paid flags.

## 13. Suggested Maintenance Rule

When business rules change:

1. update backend logic first
2. update tests
3. update this file
4. then update [HANDOUT.md](/Users/peto/Documents/Inventory-Management-frontend/HANDOUT.md) if the end-user explanation should also change

That order keeps the detailed reference aligned with the real system behavior.
