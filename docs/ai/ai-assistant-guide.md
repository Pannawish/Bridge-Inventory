# AI Assistant Guide

This guide explains what the Bridge Inventory AI Assistant is for, what it can answer now, and how users should use it well.

For the simple developer explainer, see [ai-assistant-how-it-works.md](./ai-assistant-how-it-works.md). For backend setup details, see [backend/README.md](../../backend/README.md).

---

## 1. What This Feature Is

The AI Assistant is a **read-only operational helper**.

It is not meant to answer every possible question in the system. It is intentionally focused on a small set of high-value daily workflows.

It does **not**:

- create records
- edit records
- approve or cancel transactions
- override stock rules
- replace the normal transaction screens

---

## 2. The 4 Core Things It Can Do

### 2.1 Stock, Reorder, And Fulfillment

Use the assistant when you want to know:

- which items are low stock
- what should be restocked first
- whether a product has enough stock
- whether customer demand is covered or backordered

Good questions:

- `Which items are low stock?`
- `Which product should I restock first?`
- `Show stock for CHAT-1`
- `Which customer orders are backordered?`

### 2.2 Customer Or Supplier Summaries

Use the assistant when you want one summary for one partner across a date range.

It can summarize:

- customer activity
- supplier activity
- totals and counts in the selected period
- recent related documents

Good questions:

- `Summarize customer activity for Finance Department from 2026-06-01 to 2026-06-14`
- `Summarize supplier activity for Paper Supply Co. this month`

### 2.3 Receivables, Payables, And Exceptions

Use the assistant when you want to monitor finance follow-up and operational issues.

It can summarize:

- receivables (`AR`)
- payables (`AP`)
- net position
- overdue billing notes
- overdue payment batches
- delayed incoming purchase lines
- order coverage gaps

Good questions:

- `What is our net position?`
- `Show receivables`
- `Show payables`
- `Show overdue and exception issues`

### 2.4 Reference Lookup And Line-Item Detail

Use the assistant when you already know the document reference and want a quick explanation.

It can summarize or inspect:

- `PO-...`
- `TI-...`
- `QT-...`
- `BN-...`
- `PMT-...`
- `CN-...`

Good questions:

- `Show TI-CHAT-BACKORDER`
- `Show PO-CHAT-INCOMING`
- `Show line items for TI-CHAT-BACKORDER`
- `Show line items for CN-CHAT-001`

---

## 3. What Is Out Of Scope On Purpose

The assistant is **not** the place for:

- deep margin or profitability analysis
- customer buying trend analysis
- supplier performance analytics
- broad open-ended reporting inside chat
- “tell me everything about the business” style questions

If a user asks for those in AI Chat, the assistant should guide them back to the supported core workflows. For a structured printable supplier, customer, or product report, use the separate `AI Report` page instead.

---

## 4. Best Way To Ask Questions

Use short, direct questions.

Best practice:

- ask about one topic at a time
- include a product, customer, supplier, or reference number when possible
- include a date range when asking for a partner summary
- ask for a summary first, then ask for detail

Helpful inputs:

- a `SKU`
- a `product name`
- a `customer name`
- a `supplier name`
- a `reference number`
- a `date range`

Supported date examples:

- `2026-06-01 to 2026-06-14`
- `this month`
- `last month`
- `this week`
- `today`

---

## 5. What Users Should Expect Back

The assistant usually answers in compact summary cards.

These cards may include:

- a short title
- a few key figures
- a few highlight lines
- recent related records
- line-item detail for a matched document

The goal is fast understanding, not long chat conversation.

---

## 6. Where To Use It

Open the feature from the `AI Chat` tab in the `Workspace` group.

Use it when you want to:

- check stock risk quickly
- summarize one customer or supplier quickly
- check overdue issues quickly
- inspect one document quickly

Do **not** use it as a replacement for normal transaction entry screens.

For printable analysis, open `AI Report` instead of using AI Chat. AI Report has fixed report scopes and date filters, while AI Chat is for short operational Q&A.

---

## 7. Short User Examples

### Inventory

- `Which items are low stock?`
- `Show stock for CHAT-1`
- `Which product should I restock first?`

### Partner Summary

- `Summarize customer activity for Finance Department this month`
- `Summarize supplier activity for Paper Supply Co. from 2026-06-01 to 2026-06-14`

### Finance And Exceptions

- `What is our net position?`
- `Show overdue and exception issues`

### Reference Lookup

- `Show BN-CHAT-001`
- `Show line items for TI-CHAT-BACKORDER`

---

## 8. Practical Rule

If the question does not fit one of these 4 workflows:

1. stock and fulfillment
2. partner summary
3. receivables/payables and exceptions
4. reference lookup and line items

then the assistant should not try to fake an answer. It should tell the user that the question is outside the current assistant scope.
