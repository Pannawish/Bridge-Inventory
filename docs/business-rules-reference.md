# ⚖️ Business Rules Reference

<p align="left">
  <img src="https://img.shields.io/badge/Document-Technical%20Reference-4a7b9c?style=flat-square" alt="Technical Reference" />
  <img src="https://img.shields.io/badge/Authority-Backend--Authoritative-b71c1c?style=flat-square" alt="Backend Authoritative" />
  <img src="https://img.shields.io/badge/Engine-FIFO%20Allocation-2e7d32?style=flat-square" alt="FIFO Engine" />
  <img src="https://img.shields.io/badge/Target-Supervisors%20%7C%20Maintainers-714b67?style=flat-square" alt="Audience" />
</p>

This document serves as the absolute, authoritative business-logic and validation reference for the inventory system.

> [!NOTE]
> **Scope & Purpose:**  
> Use this reference when you need to inspect exact database behaviors, status state-machines, or financial constraints. For training checklists or onboarding guides, refer to [HANDOUT.md](../HANDOUT.md). If this file and user training sheets differ, this document represents the authoritative description of system behavior.

---

## 1. Core Principles

These core principles are enforced authoritatively across all operations:

### 1.1 Stock is Derived, Not Manually Typed
*   The system does not treat product stock as a static, manually maintained master data field.
*   **Available Stock** is derived dynamically from **Received Purchase Quantities** minus **Committed Sale Quantities**.
*   A purchase line item increments stock only when it reaches the `received` status.
*   A sales line item decrements stock only when it reaches a committed fulfillment status (`packed`, `shipped`, or `delivered`).
*   Line items in `draft`, `pending`, `cancelled`, or `returned` statuses do not commit or reduce stock.

### 1.2 Line-Item Status is the Operational Source of Truth
*   For purchases and sales, the line-item status drives stock increments/decrements and partial-progress calculations.
*   Whole-document statuses (e.g. `partially_received`, `partially_shipped`) are aggregate calculations derived from individual line-item statuses.
*   Partial statuses exist strictly at the document level. Line items never use `partial_*` states.

### 1.3 Historical Snapshotting
*   Transaction records store explicit duplicates of master data (e.g., partner names, product names, SKUs, prices, tax totals).
*   These duplicates are intentional. They act as immutable historical business audit records so past documents remain accurate and readable even if master product registries are updated or partner records are edited.

### 1.4 Authoritative Backend Validation
*   While the React frontend provides validation guides to aid operations, all stock allocations, eligibility filtering, and financial status overrides are re-validated and enforced by the Django API backend.

---

## 2. Master Data Rules

### 2.1 Categories
*   Categories are structured as a relational tree, not a flat table.
*   A category **cannot be deleted** if it is referenced by any product master.
*   Parent categories cannot be removed if active child subcategories depend on them.

### 2.2 Products
*   A product with any purchase, sale, or quotation history represents durable business transaction data.
*   A product **cannot be deleted** once it has transaction history.
*   The standard action is to **disable** the product instead of deleting it.
*   Disabled products cannot be added to new quotations, purchases, or sales.
*   All existing historical records referencing disabled products remain fully readable and valid.

### 2.3 Suppliers and Customers
*   Partner master cards contain vendor/buyer defaults used to initialize new documents.
*   Historical transactions keep their own independent name and Tax ID snapshots, remaining fully accurate and unaffected by subsequent partner card updates.

---

## 3. Quotation Rules

Unlike purchases and sales, quotations do not use a saved workflow state. Their visual status is derived dynamically from date conditions.

### 3.1 Validity Logic
*   If `valid_until_date` is blank: status is `Valid`.
*   If `valid_until_date` is today or in the future: status is `Valid`.
*   If `valid_until_date` is in the past: status is `Expired`.

### 3.2 Validity Calculation Modes
*   **`calendar`**: Add literal calendar days to the quotation date.
*   **`business`**: Add working days only, automatically skipping Saturdays and Sundays.
*   **`no_valid_date`**: No expiration date is set; the quotation remains `Valid` in the UI indefinitely.

### 3.3 Quotation Line Storage
*   Quotation lines are stored as normalized relational items inside `QuotationItem` tables (practical 3NF).
*   The API exposes an `items` array to maintain frontend compatibility, but the database schema uses a fully normalized table structure.

### 3.4 Operational Role
*   A quotation is a commercial proposal and **does not reserve or deduct stock**.
*   A quotation can be converted into active purchase or sales orders, but the quotation itself remains intact as a historical document.

---

## 4. Purchase Rules

Purchases record incoming inventory layers from suppliers.

### 4.1 Purchase Document Statuses

| Document Status | Operational Meaning |
| :--- | :--- |
| **`draft`** | Internal draft only. No stock is received or registered. |
| **`ordered`** | PO has been placed with the vendor, but no quantities have been received yet. |
| **`partially_received`** | At least one active line item has arrived, but other active lines are still pending. |
| **`received`** | All active line items have been successfully received at the warehouse. |
| **`cancelled`** | The whole purchase order, or all individual line items within it, have been cancelled. |

### 4.2 Purchase Line-Item Statuses

| Line Status | Operational Meaning | Available Stock Impact |
| :--- | :--- | :--- |
| **`pending`** | Not yet arrived. | No stock increase. |
| **`received`** | Physically arrived and shelved. | **Increases available stock immediately.** |
| **`cancelled`** | Will not arrive. | No stock increase. |

### 4.3 Purchase Status Derivation
*   If all lines are `cancelled`, the PO status becomes `cancelled`.
*   If all non-cancelled lines are `received`, the PO status becomes `received`.
*   If some non-cancelled lines are `received` and others remain `pending`, the PO status becomes `partially_received`.
*   If no active lines are received yet, the PO remains in `draft` or `ordered` based on the document-level switch.

### 4.4 Document Status Propagation
*   If a user sets the overall PO status to `received` and no explicit line statuses are provided in the payload, the backend automatically propagates that status to all line items.
*   Once explicit line-level statuses are present, the PO status is derived strictly from line-level calculations.

### 4.5 Date Rules
*   When a line becomes `received`, `received_date` is automatically set to the current date if it was blank.
*   If a line drops back to `pending` or is `cancelled`, the `received_date` is cleared.
*   If a pending line has an `expected_delivery_date` before today, the UI flags it as `delayed` (this is a visual prompt only and is not a stored database status).

### 4.6 Financial Grand Totals vs. Payables
*   `grand_total` preserves the original PO total for billing audits.
*   `payable_total` is calculated dynamically and **excludes** the value of cancelled purchase lines. This ensures a PO retains its full historical total while showing the exact current payable amount owed to the vendor.

---

## 5. Sales Rules

Sales represent customer orders and outbound fulfillment.

### 5.1 Sales Document Statuses

| Document Status | Operational Meaning |
| :--- | :--- |
| **`draft`** | Standard draft. No stock has reached a committed, stock-deducting stage. |
| **`partially_packed`** | At least one active line has reached the `packed` stage, but others remain pending. |
| **`packed`** | All active line items have been packed and are committed to this order. |
| **`partially_shipped`** | At least one line has been shipped, but others are packed or pending. |
| **`shipped`** | All active line items have been shipped out. |
| **`partially_delivered`** | At least one line has been delivered, but others are in transit. |
| **`delivered`** | All active line items have been successfully delivered to the customer. |
| **`cancelled`** | All line items in the order have been cancelled. |
| **`returned`** | All lines are inactive and at least one line has been returned by the customer. |

### 5.2 Sales Line-Item Statuses

| Line Status | Operational Meaning | Available Stock Impact |
| :--- | :--- | :--- |
| **`pending`** | Order recorded but not yet committed. | No stock decrease. |
| **`packed`** | Goods are packed and committed. | **Decreases available stock immediately.** |
| **`shipped`** | In transit to customer. | **Decreases available stock immediately.** |
| **`delivered`** | Handed over to customer. | **Decreases available stock immediately.** |
| **`cancelled`** | Cancelled before fulfillment. | Releases/avoids stock commitment. |
| **`returned`** | Returned after delivery. | **Releases stock back to available inventory.** |

### 5.3 Sales Status Derivation
*   If all active lines are `delivered`, the sale status is `delivered`.
*   If at least one active line is `delivered`, the sale status is `partially_delivered`.
*   Else if all active lines are `shipped`, the sale status is `shipped`.
*   Else if at least one active line is `shipped`, the sale status is `partially_shipped`.
*   Else if all active lines are `packed`, the sale status is `packed`.
*   Else if at least one active line is `packed`, the sale status is `partially_packed`.
*   Else the sale status is `draft`.
*   If all lines are inactive and at least one line is `returned`, the sale status is `returned`.
*   If all lines are inactive and no line is `returned`, the sale status is `cancelled`.

### 5.4 Document Status Propagation
*   If a user sets the overall sale status to `packed`, `shipped`, or `delivered` and no explicit line statuses are provided in the payload, the backend automatically propagates that status to all line items.
*   Once explicit line-level statuses are present, the sale status is derived strictly from line-level calculations.

### 5.5 Date Rules
*   When a line becomes `shipped`, `shipped_date` is automatically set if it was blank.
*   When a line becomes `delivered`, both `shipped_date` and `delivered_date` are automatically set if blank.
*   When a line drops back below a shipped state, the shipment and delivery dates are cleared.

### 5.6 Server-Side Stock Validation
*   Stock is checked server-side for quantities that would be committed by sale lines in `packed`, `shipped`, or `delivered`.
*   A sale can remain `draft` without sufficient stock because draft lines do not commit stock.
*   A sale **cannot move active quantities** into stock-deducting statuses if sufficient stock is not available in your received FIFO layers.

---

## 6. FIFO Stock Allocation Rules

First-In, First-Out (FIFO) logic governs inventory costing, margins, and stock layer consumptions.

### 6.1 What FIFO Means in This System
*   The system allocates stock from your **oldest available received purchase layers first**.
*   Only purchase lines with the `received` status can provide stock layers.
*   A purchase layer is available only up to its remaining unallocated quantity.
*   Automatic FIFO is the default behavior when users do not choose layers manually.

### 6.2 FIFO Priority Ordering
When auto-allocating a sale line, the backend sorts candidate purchase layers by:
1.  `received_date` ascending (Oldest physical stock arrival first)
2.  Purchase `transaction_date` ascending
3.  Purchase `created_at` ascending
4.  Purchase Line `id` ascending

This sorting ensures that older stock is mathematically consumed first.

### 6.3 Automatic Allocation
*   If a sale line enters a stock-deducting status and no manual allocation is supplied, the system allocates automatically using FIFO.
*   If available stock is insufficient after walking the active layers, the update is rejected.

### 6.4 Manual Allocation (Layer Overrides)
*   Users can manually choose specific purchase layers for a sale line in the UI.
*   Manual selection overrides the default automatic FIFO choice for that sale line.
*   Manual allocations must match the sale line quantity exactly.
*   A selected purchase layer must:
    *   Belong to the exact same product.
    *   Already be received.
    *   Have sufficient remaining quantity.
*   If manual allocations are incomplete, missing, or invalid, the backend rejects the update instead of silently guessing or substituting layers.

### 6.5 Cost Snapshot Behavior
*   Once allocations are locked, the system computes the exact cost of goods sold (COGS) based on the cost of the allocated layers and saves it on the sale line.
*   If a sale line uses stock from exactly one supplier layer, that supplier's name is snapshotted as the line's supplier reference.

---

## 7. Billing Note Rules

Billing Notes organize completed customer shipments for collections tracking.

### 7.1 Invoice Eligibility Rules
A sales order is eligible for inclusion in a new Billing Note only if all of the following conditions are met:
1.  The sales order belongs to the target customer.
2.  The sales order is in an eligible document status: `shipped`, `partially_delivered`, or `delivered`.
3.  The sales order is not already linked to another active (non-cancelled) Billing Note.
4.  If a Billing Note is `cancelled`, all associated sales orders are instantly released and become eligible for billing notes again.

### 7.2 Billing Note Document Statuses

| Document Status | Meaning |
| :--- | :--- |
| **`draft`** | Internal draft only. |
| **`issued`** | Sent to the customer. Expected payment tracking begins. |
| **`partially_received`** | At least one sales order inside has been paid, but others remain outstanding. |
| **`fully_received`** | All associated sales orders have been fully paid. |
| **`cancelled`** | Cancelled. All associated sales orders are released back to billing eligibility. |

### 7.3 Billing Note Payment Recalculations
*   A Billing Note does not rely on a simple status toggle for payments. 
*   Its status is derived dynamically based on the payment status of the sales orders grouped within it.
*   When a sales order's payment date is set or cleared, the Billing Note status is recomputed dynamically.

---

## 8. Payment Batch Rules

Payment Batches manage supplier payables (AP) for received warehouse inventory.

### 8.1 Payable Eligibility Rules
A purchase order (PO) is eligible for inclusion in a new Payment Batch only if all of the following conditions are met:
1.  The PO belongs to the target supplier.
2.  The PO is in an eligible received status: `partially_received` or `received`.
3.  The PO is not already linked to another active (non-cancelled) Payment Batch.
4.  If a Payment Batch is `cancelled`, all associated POs are instantly released and become eligible for payment batches again.

### 8.2 Payment Batch Document Statuses

| Document Status | Meaning |
| :--- | :--- |
| **`draft`** | Internal draft only. |
| **`scheduled`** | Payment scheduled. Planned payment tracking begins. |
| **`partially_paid`** | At least one PO inside has been paid, but others remain outstanding. |
| **`paid`** | All associated POs have been fully paid. |
| **`cancelled`** | Cancelled. All associated POs are released back to payment eligibility. |

### 8.3 Payment Batch Status Recalculations
*   A Payment Batch status is derived dynamically based on the payment status of the POs grouped within it.
*   When a PO's payment date is set or cleared, the Payment Batch status is recomputed dynamically.

---

## 9. Credit Note Rules

Credit Notes adjust customer accounts for returned or cancelled sales.

### 9.1 Credit Note Eligibility Rules
A sales order is eligible for a new Credit Note only if all of the following conditions are met:
1.  The sales order has at least one line item in `cancelled` or `returned` status.
2.  The cancelled or returned quantity has not already been credited by another active Credit Note.
3.  If a Credit Note is `cancelled`, its credited sales lines are released back to credit note eligibility.

### 9.2 Auto-Prompt Workflow
*   When a sales line status is updated to `cancelled` or `returned`, the system automatically opens the credit note prompt.
*   This prompt allows immediate generation of a Credit Note for the newly adjusted quantities.
*   If the user selects `Create Later`, the quantities are saved as eligible lines and can be processed via the **Credit Notes** directory at a later time.

### 9.3 Credit Note Document Statuses
*   **`issued`**: Approved credit note. Customer credit balances are adjusted.
*   **`cancelled`**: Cancelled. Released credited sales lines back to eligibility.

---

## 10. Financial Totals & Tax Calculations

All financial documents (Quotations, Purchases, Sales, Billing Notes, Payment Batches, Credit Notes) must adhere to exact calculation rules.

### 10.1 Mathematical Formulas

$$\text{Line Subtotal} = \text{Quantity} \times \text{Unit Price}$$

$$\text{Line Net Amount} = \text{Line Subtotal} - \text{Line Discounts}$$

$$\text{Document Subtotal} = \sum \text{Line Net Amounts}$$

$$\text{Document Discounted Subtotal} = \text{Document Subtotal} - \text{All-Items Discount}$$

$$\text{Document Tax (VAT 7\%)} = \text{Document Discounted Subtotal} \times 0.07 \quad (\text{if Tax Category is VAT})$$

$$\text{Document Grand Total} = \text{Document Discounted Subtotal} + \text{Document Tax}$$

### 10.2 Tax Rules
*   **`included`**: Line amounts already include VAT. The backend backs VAT out of the discounted subtotal, stores the tax portion in `vat_amount`, and keeps `grand_total` equal to the already VAT-inclusive value.
*   **`not_included`**: VAT is calculated at exactly 7% of the discounted subtotal and added on top to produce `grand_total`.
*   **`none`**: Tax is set to `0.00`. `grand_total` equals the discounted subtotal.

---

## 11. Practical Interpretation Notes

*   **`draft`**: The record exists, but no core operational or stock progress has started.
*   **`partial_*`**: The document has mixed line-item statuses (e.g. some shipped, others pending).
*   **`cancelled`**: The document is stopped. Cancelled lines stop driving active workflows.
*   **`returned`**: Distinct from cancelled. Indicates the item had progressed to delivery before being returned, requiring return treatment rather than pre-fulfillment cancellation.
*   Billing Notes and Payment Batches recalculate their statuses dynamically based on line-level payment and received dates.

---

## 12. Maintenance Workflow Rules

> [!CAUTION]
> **When Business Logic Changes:**
> Always follow this exact order of operations to prevent system divergence:
> 1.  **Backend First**: Update backend validation, serializers, and eligibility views.
> 2.  **Verify Tests**: Update and run all unit tests (`python manage.py test inventory`).
> 3.  **Document Rules**: Update this file (`docs/business-rules-reference.md`) to reflect the exact new schema behaviors.
> 4.  **Update Handout**: Update [HANDOUT.md](../HANDOUT.md) only if the end-user instructions should change.
