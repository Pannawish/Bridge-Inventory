# AI Assistant Guide

This document explains how to use the Bridge Inventory AI Assistant and what it currently covers in the system.

Use this guide for day-to-day usage. For backend implementation details, see [backend/README.md](../backend/README.md). For core workflow rules, see [workflow-reference.md](./workflow-reference.md) and [business-rules-reference.md](./business-rules-reference.md).

---

## 1. What The AI Assistant Is

The AI Assistant is a **read-only operational helper** inside Bridge Inventory.

It is designed to answer short business questions using current system data such as:

- stock and restock signals
- products and SKU matches
- customer summaries within a date range
- supplier summaries within a date range
- sales summaries
- purchase summaries
- quotation summaries
- billing note summaries
- payment batch summaries
- credit note summaries
- AR / AP / net position summaries
- order coverage and backorder summaries
- product margin and profitability summaries
- supplier lead-time and delayed incoming performance summaries
- customer buying trend comparisons
- overdue and exception monitoring
- line-item detail by document reference

It does **not** create, edit, approve, cancel, or delete records.

---

## 2. Where To Open It

Open the assistant from the `AI Chat` tab in the sidebar under the `Workspace` group.

The assistant screen includes:

- a message thread
- a text box for your question
- example prompt chips
- compact summary cards with key figures, highlights, and recent records when the answer matches a supported business summary

---

## 3. How To Use It

Ask short, direct questions in normal business language.

Good patterns:

- ask about one topic at a time
- include a product name, SKU, customer name, supplier name, or document reference when possible
- ask for a summary before asking for detail

Examples:

- `Which items are low stock?`
- `Which product should I restock first?`
- `Summarize customer activity for Acme Co. from 2026-06-01 to 2026-06-14`
- `Summarize supplier activity for Apex Supply this month`
- `What are the latest sales transactions?`
- `Show product margin and profitability`
- `Show supplier performance and lead time for Paper Supply Co.`
- `Show buying trend for customer Finance Department`
- `Show overdue and exception issues`
- `Show line items for TI-6905-023`
- `Show recent quotations`
- `Summarize billing notes`
- `Summarize payment batches`
- `Show credit notes`
- `What is our net position?`
- `Which customer orders are backordered?`
- `Show PO-6905-001`
- `Show BN-6905-007`
- `Show CN-6905-001`

If you want a more specific answer, include:

- a `SKU`
- a `product name`
- a `customer name`
- a `supplier name`
- a `reference number` such as `PO-...`, `TI-...`, `QT-...`, `BN-...`, `PMT-...`, or `CN-...`
- a `date range` such as `2026-06-01 to 2026-06-14`, `this month`, or `last month`

---

## 4. What It Covers

### 4.1 Inventory And Restocking

The assistant can summarize:

- low-stock products
- available stock for matching products
- reorder levels
- suggested restock quantities

Best example questions:

- `Which items are low stock?`
- `Show stock for A4 Copy Paper 80gsm`
- `Which SKU needs reorder?`

### 4.2 Products

The assistant can match products by:

- SKU
- product name
- category text

Best example questions:

- `Show CHAT-1`
- `Show stock for whiteboard marker`

### 4.3 Sales

The assistant can summarize:

- recent sales
- matched sales by customer name
- matched sales by reference number
- sales totals and active totals

Best example questions:

- `What are the latest sales transactions?`
- `Show sales for Finance Department`
- `Show TI-6905-023`

### 4.3A Customer And Supplier Summaries

The assistant can summarize:

- a customer across sales, quotations, billing notes, and credit notes
- a supplier across purchases, payment batches, and supplier-side quotations
- totals and counts for the matched date range
- recent document references and top products in the matched activity

Best example questions:

- `Summarize customer activity for Finance Department from 2026-06-01 to 2026-06-14`
- `Summarize supplier activity for Siam Paper & Label Ltd. this month`
- `Show customer summary for Graduate School`

### 4.4 Purchases

The assistant can summarize:

- recent purchases
- matched purchases by supplier name
- matched purchases by reference number
- purchase totals and active totals

Best example questions:

- `Show recent purchases`
- `Show purchases for Siam Paper & Label Ltd.`
- `Show PO-6905-001`

### 4.5 Quotations

The assistant can summarize:

- recent quotations
- matched quotations by customer
- matched quotations by supplier
- quotation references and totals

Best example questions:

- `Show recent quotations`
- `Show quotations for Finance Department`
- `Show QT-000018`

### 4.6 Billing Notes

The assistant can summarize:

- billing note references
- statuses
- totals
- customer matches

Best example questions:

- `Summarize billing notes`
- `Show billing notes for Research Administration`
- `Show BN-6905-007`

### 4.7 Payment Batches

The assistant can summarize:

- payment batch references
- statuses
- totals
- supplier matches

Best example questions:

- `Summarize payment batches`
- `Show payment batches for Rapid Event Supply`
- `Show PMT-6905-006`

### 4.8 Credit Notes

The assistant can summarize:

- credit note references
- statuses
- totals
- customer matches
- linked sale references in context data

Best example questions:

- `Show credit notes`
- `Show credit notes for Graduate School`
- `Show CN-6905-001`

### 4.9 Finance Position

The assistant can summarize current dashboard-backed finance signals:

- receivables (`AR`)
- payables (`AP`)
- net position
- open AR/AP balances
- overdue AR/AP balances

Best example questions:

- `What is our net position?`
- `Show receivables`
- `Show payables`

### 4.10 Order Coverage And Backorders

The assistant can summarize current dashboard-backed order coverage:

- demand covered by available stock
- demand covered by incoming purchases
- uncovered gap
- overall coverage percentage

Best example questions:

- `Which customer orders are backordered?`
- `Show order coverage`

### 4.11 Margin And Product Profitability

The assistant can summarize:

- gross margin for the current dashboard period
- top products by estimated margin
- product-level revenue, cost, and margin from matched sales lines

Best example questions:

- `Show product margin and profitability`
- `Which products have the best margin this month?`
- `Show margin for CHAT-1`

### 4.12 Supplier Performance And Lead Time

The assistant can summarize:

- average received lead time for a matched supplier
- delayed incoming purchase lines
- open PO lines and scheduled payables

Best example questions:

- `Show supplier performance and lead time for Paper Supply Co.`
- `Which supplier has delayed incoming stock?`
- `Show delayed purchase lines`

### 4.13 Customer Buying Trends

The assistant can summarize:

- current versus previous sales window for a matched customer
- sales count trend
- recent sales and top products in the active window

Best example questions:

- `Show buying trend for customer Finance Department`
- `How is Graduate School buying this month compared with the previous period?`

### 4.14 Overdue And Exception Monitoring

The assistant can summarize:

- overdue billing notes
- overdue payment batches
- delayed purchase lines
- backordered sale lines and demand gaps

Best example questions:

- `Show overdue and exception issues`
- `Which billing notes are overdue?`
- `Show delayed purchase lines`

### 4.15 Line-Item Detail By Reference

The assistant can summarize:

- sale line items
- purchase line items
- quotation lines
- billing note lines
- payment batch lines
- credit note lines

Best example questions:

- `Show line items for TI-6905-023`
- `Show line items for PO-6905-001`
- `Show line items for CN-6905-001`

---

## 5. What It Does Not Do

The assistant does not:

- edit transactions
- create POs, SOs, quotations, billing notes, payment batches, or credit notes
- approve statuses
- override stock rules
- replace backend validation
- explain every line-item business rule in detail

If you need authoritative workflow behavior, use:

- [business-rules-reference.md](./business-rules-reference.md)
- [workflow-reference.md](./workflow-reference.md)

---

## 6. How Answers Are Generated

The assistant has two operating modes.

### 6.1 Local Summary Mode

If `OPENAI_API_KEY` is **not** configured, the backend returns a local read-only summary from current inventory data.

This mode is:

- deterministic
- fast
- limited to supported summary patterns

### 6.2 OpenAI-Backed Mode

If `OPENAI_API_KEY` **is** configured, the backend sends the current assistant context to the configured `OPENAI_MODEL`.

This mode is:

- more flexible with wording
- still read-only
- still limited to the data provided by the backend context

Important: even in OpenAI-backed mode, the assistant is **not** a system of record. The backend business logic and actual transaction screens remain authoritative.

---

## 7. Tips For Better Results

- Use the exact product name if the item is common.
- Use the exact partner name if you want customer- or supplier-specific results.
- Use a document reference for the fastest match.
- Ask one question at a time instead of combining many requests in one prompt.
- If the answer is too broad, ask again with a narrower target.

Examples:

- Instead of `show transactions`, ask `show sales for Admissions Office`
- Instead of `what is happening`, ask `which items are low stock?`
- Instead of `check document`, ask `show BN-6905-007`

---

## 8. Expected Limitations

The assistant works best for:

- operational summaries
- quick lookup questions
- lightweight finance snapshots
- stock and reorder questions

It is weaker for:

- multi-step analysis across many unrelated topics in one message
- vague requests with no entity names or references
- requests that imply actions instead of summaries

If a question is unclear, refine it with:

- the module name
- the partner name
- the product name
- the document reference

---

## 9. Recommended User Workflow

Use the assistant as a fast first pass:

1. Ask for a summary.
2. Identify the product, customer, supplier, or document reference.
3. Open the relevant module in the UI.
4. Confirm details in the actual transaction or dashboard screen.

Example:

1. Ask `Which customer orders are backordered?`
2. Review the returned coverage summary.
3. Open `Dashboard`, `Inventory`, or `Sales` to inspect the affected records.

---

## 10. Maintainer Note

This guide must stay aligned with:

- current assistant backend context in `backend/inventory/services.py`
- current chat endpoint behavior in `backend/inventory/views.py`
- current chat UI in `frontend/src/components/ChatPanel.jsx`

If assistant coverage changes, update this file in the same change.
