# AI Assistant: How It Works

This file explains the AI Assistant in simple language for developers, reviewers, and future maintainers.

The goal is not to describe every line of code. The goal is to help someone quickly understand:

- what this feature is supposed to do
- what it is **not** supposed to do
- how a user question becomes an answer on screen

For user instructions, see [ai-assistant-guide.md](./ai-assistant-guide.md).

This document covers the `AI Chat` feature only. The separate `AI Report` page has its own backend flow in [backend/inventory/ai_reports.py](../backend/inventory/ai_reports.py), where the user selects supplier, customer, or product scope and receives printable HTML.

---

## 1. Big Picture

Think of the AI Assistant as a **read-only interpreter** for the existing system.

It does not own business truth.
It does not change inventory.
It does not create or update transactions.

It only does this:

1. take a user question
2. gather the relevant system data
3. choose one supported workflow
4. return a short structured explanation

So the assistant is closer to a **smart summary layer** than a free-form chatbot.

---

## 2. Why The Scope Is Intentionally Small

Earlier, the assistant started to grow into too many directions.

That creates 3 problems:

1. answers become less predictable
2. testing becomes harder
3. users stop knowing what the feature is really for

So the feature is intentionally scoped to only 4 core workflows:

1. stock, reorder, and fulfillment
2. customer or supplier summaries
3. receivables, payables, and exceptions
4. reference lookup and line-item detail

Anything outside that scope should be rejected clearly. If the user needs a structured printable supplier, customer, or product report, the correct workflow is `AI Report`, not AI Chat.

---

## 3. What Happens Behind The Scenes

### Step 1: The user asks a question

The frontend sends the question to:

- `POST /api/chat/`

The backend chat view lives in:

- [backend/inventory/views.py](../backend/inventory/views.py)

### Step 2: The backend builds a safe context

The backend does not give the model the whole database blindly.

Instead, it builds a controlled data package from current app data such as:

- stock report rows
- purchases
- sales
- quotations
- billing notes
- payment batches
- credit notes
- dashboard finance and order coverage summaries

This main context builder lives in:

- [backend/inventory/services.py](../backend/inventory/services.py)

In simple terms:

- the backend looks at the question
- finds useful matching products, customers, suppliers, and references
- filters by date if needed
- prepares compact rows for the assistant to work with

### Step 2A: How The System Classifies The Question

This is the most important idea:

> The system classifies the question with backend rules first. It does not wait for the AI model to guess the question type by itself.

The backend looks for a few specific signals in the question.

#### A. Keywords

The backend checks whether the question contains words related to:

- stock / reorder / fulfillment
- customer or supplier summaries
- receivables / payables / overdue / exception
- reference lookup / line items

Examples:

- `low stock`
- `restock`
- `backordered`
- `net position`
- `receivable`
- `payable`
- `overdue`
- `line items`

These signals help decide which supported workflow the question belongs to.

#### B. Date ranges

The backend also checks whether the user included a date range.

It supports explicit dates like:

- `2026-06-01 to 2026-06-14`

and relative periods like:

- `today`
- `this week`
- `last week`
- `this month`
- `last month`

If a date range exists, the backend uses it when building customer or supplier summaries.

#### C. Partner names

The backend tries to match customer names and supplier names that already exist in the database.

So if the user writes:

- `Summarize customer activity for Finance Department`

the backend tries to match `Finance Department` against the `Customer` table.

If the user writes:

- `Summarize supplier activity for Paper Supply Co.`

the backend tries to match `Paper Supply Co.` against the `Supplier` table.

This is how the system knows whether to build a customer summary or a supplier summary.

#### D. Reference prefixes

The system also checks document-style prefixes.

These prefixes map directly to business transaction types:

- `PO` → Purchase
- `TI` → Sale
- `QT` → Quotation
- `BN` → Billing Note
- `PMT` → Payment Batch
- `CN` → Credit Note

So if the question says:

- `Show TI-CHAT-BACKORDER`

the backend knows that this is a sales document question, not a purchase question.

If the question says:

- `Show line items for PO-CHAT-INCOMING`

the backend knows it should inspect purchase data and purchase line items.

---

### Step 2B: How The System Knows Which Tables To Query

After classification, the backend decides which models are relevant.

It does **not** query everything for every question blindly.

Here is the practical mapping:

#### 1. Stock / reorder / fulfillment questions

The backend mainly uses:

- `Product`
- backend stock report calculations
- `Purchase` / `PurchaseItem`
- `Sale` / `SaleItem`

These are used for:

- low stock
- reorder suggestions
- available stock
- order coverage
- backorder gaps

#### 2. Customer summary questions

The backend mainly uses:

- `Customer`
- `Sale`
- `Quotation`
- `BillingNote`
- `CreditNote`

These are used to answer:

- total customer activity in a date range
- recent sales
- billing note exposure
- credit note activity

#### 3. Supplier summary questions

The backend mainly uses:

- `Supplier`
- `Purchase`
- `Quotation`
- `PaymentBatch`

These are used to answer:

- total supplier activity in a date range
- recent purchases
- payment follow-up
- supplier-side quotation activity

#### 4. Receivables / payables / exception questions

The backend mainly uses:

- `BillingNote`
- `PaymentBatch`
- `PurchaseItem`
- `SaleItem`
- dashboard finance and order-coverage calculations

These are used to answer:

- AR
- AP
- net position
- overdue billing notes
- overdue payment batches
- delayed purchase lines
- backorder gaps

#### 5. Reference lookup / line-item detail questions

The backend uses the prefix to choose the right model:

- `PO` → `Purchase`
- `TI` → `Sale`
- `QT` → `Quotation`
- `BN` → `BillingNote`
- `PMT` → `PaymentBatch`
- `CN` → `CreditNote`

Then it pulls the matched transaction plus its line items.

That is why a line-item lookup is fast and accurate: the backend already knows which document family to inspect before the answer is built.

### Step 3: The backend chooses one supported workflow

The backend then decides which kind of answer this question should become.

It does **not** let every question go to a broad open-ended answer path.

Instead, it maps the question into one of these answer types:

- stock / reorder / fulfillment
- partner summary
- AR / AP / overdue / exception summary
- reference summary or line-item detail

If the question is outside the supported scope, the backend returns a structured “outside current assistant scope” response.

This routing logic is handled in the chat presentation builder in:

- [backend/inventory/services.py](../backend/inventory/services.py)

If you want the simplest product explanation, it is this:

- first classify the question
- then choose the relevant tables
- then build a safe summary
- then optionally let OpenAI improve the wording

### Step 4: The backend creates a structured answer

The assistant answer is not just plain text.

The backend creates a structured payload called `presentation`.

That payload contains things like:

- `title`
- `subtitle`
- `metrics`
- `sections`
- `records`

This is important because the frontend can display the answer as readable cards instead of one long paragraph.

### Step 5: Optional OpenAI polish

If `OPENAI_API_KEY` exists in `backend/.env`, the backend also sends:

- the original question
- the prepared local summary
- the controlled inventory context

to the configured OpenAI model.

The model is there to improve wording and readability.

It is **not** supposed to invent new data or go beyond the 4 supported workflows.

If OpenAI is unavailable, the system still works by using the local backend-built summary.

---

## 4. Why The Backend Builds So Much First

This feature is safer because the backend does most of the real work before the model writes the final answer.

That means:

- stock truth still comes from backend rules
- date filtering still comes from backend queries
- AR/AP values still come from backend calculations
- document references still come from backend matches

The model mainly helps with language.

That is the correct design for this project.

---

## 5. What The Frontend Does

The frontend chat panel:

1. sends the user question
2. receives `answer`, `used_model`, and `presentation`
3. renders the response as compact summary cards

The main files are:

- [frontend/src/components/ChatPanel.jsx](../frontend/src/components/ChatPanel.jsx)
- [frontend/src/components/chat/ChatMessageBody.jsx](../frontend/src/components/chat/ChatMessageBody.jsx)
- [frontend/src/hooks/useAppChat.js](../frontend/src/hooks/useAppChat.js)

In simple words:

- backend decides the answer type
- frontend decides how to display it nicely

---

## 6. What We Removed On Purpose

These were moved out of the core assistant scope:

- deep margin analysis
- customer trend analysis
- supplier performance analytics
- broad generic reporting

Why remove them:

- they are less operationally urgent
- they are easier to misread
- they weaken the assistant’s product identity

If the business wants those later, they should come back as a separate deliberate scope expansion, not as random extra intents.

---

## 7. What A Good Future Change Looks Like

A good change should do one of these:

- make one of the 4 core workflows more accurate
- make one of the 4 core workflows easier to ask
- make one of the 4 core workflows easier to read
- improve tests for one of the 4 core workflows

Examples of good future work:

- stronger product / partner name matching
- clearer overdue exception summaries
- better reference lookup detail
- better fulfillment-gap explanations

Examples of bad future work:

- adding more vague “ask anything” behavior
- reintroducing unsupported analytics without a clear product decision
- letting the model answer beyond backend-supported business truth

---

## 8. Mental Model For Developers

If you need one short explanation, use this:

> The AI Assistant is a read-only, backend-guided summary tool for 4 operational workflows, with optional OpenAI wording improvement on top.

That is the feature.
