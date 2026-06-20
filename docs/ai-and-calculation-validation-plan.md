# AI Output And Calculation Validation Plan

This report answers a practical project question:

> Can we know whether the output from AI Chat, AI Report, and inventory calculations such as reorder point are accurate?

Short answer: **yes, for the factual parts, if validation is done against backend-controlled data and expected formulas.** The AI text itself should not be treated as the source of truth. The system should validate the data context, calculations, and required report facts before judging whether the AI output is acceptable.

Related references:

- [AI Assistant: How It Works](./ai-assistant-how-it-works.md)
- [AI Assistant Guide](./ai-assistant-guide.md)
- [Business Rules Reference](./business-rules-reference.md)
- [Backend inventory services](../backend/inventory/services.py)
- [Backend tests](../backend/inventory/tests.py)
- [AI Report backend module](../backend/inventory/ai_reports.py)

---

## 1. Improved Prompt

The original prompt is understandable, but it mixes several goals in one long sentence. A clearer version is:

> Create a markdown report for my Bridge Inventory project explaining how to validate the accuracy of AI Chat, AI Report, and backend inventory calculations such as reorder point. The report should propose the simplest practical validation path for a student project: what data to prepare, what formulas to check, what automated tests to add, and how to compare AI output against trusted backend results. Include limitations, acceptance criteria, and a small validation checklist.

This version is stronger because it states:

- the output format: markdown report
- the system scope: Bridge Inventory
- the features to validate: AI Chat, AI Report, calculations
- the expected method: simple practical validation path
- the required evidence: data, formulas, tests, checklist, limitations

---

## 2. Validation Principle

The simplest validation principle is:

> **The backend is the source of truth. AI is only a presentation layer.**

This means:

- stock, reorder, finance, and eligibility numbers must be calculated by Django services or serializers
- AI Chat should summarize backend-prepared facts
- AI Report should format and explain backend-prepared facts
- tests should compare outputs against known expected values, not against what the AI “sounds like”

This gives a realistic definition of accuracy:

| Area | What Accuracy Means | Best Validation Method |
| --- | --- | --- |
| Reorder point | Formula result matches expected value from known transactions | Unit test with fixed product, purchase, and sale data |
| Stock availability | Received stock minus allocated sales is correct | Backend API/test assertion |
| AI Chat | Answer/presentation contains the correct backend facts and rejects unsupported scope | Deterministic chat tests |
| AI Report | Report contains selected entity, period, required metrics, and no invented core values | Backend report tests with fixed data |
| AI wording | Explanation is readable and does not contradict the data | Human review checklist |

---

## 3. Calculation Validation

The most important calculations should be validated before validating AI, because AI outputs depend on these numbers.

### 3.1 Reorder And Stock Formulas

The stock report is built in [backend/inventory/services.py](../backend/inventory/services.py), mainly through `build_stock_report()`.

Core formula behavior:

```text
raw available stock = received purchase units - allocated sales units
available stock = max(0, raw available stock)
oversold units = max(0, -raw available stock)
average unit cost = received purchase value / received purchase units
average lead time = total received lead-time days / lead-time sample count
average daily demand = sales history units / sales history day span
lead-time demand = average daily demand * average lead time
safety stock = average daily demand * 7 days
calculated reorder level = ceil(lead-time demand + safety stock)
reorder level = calculated reorder level, or stored product reorder level if calculated value is 0
recommended restock = max(
  0,
  reorder level + pending sales + oversold units - available stock - pending purchase units
)
```

### 3.2 Minimum Calculation Test Dataset

Use a small fixed dataset that a human can calculate manually:

| Record | Value |
| --- | --- |
| Product | `TEST-PEN`, base unit `pcs` |
| Received purchase | 100 pcs, total cost 500 |
| Delivered/packed sales | 40 pcs |
| Pending sales | 20 pcs |
| Pending purchase | 10 pcs |
| Lead time samples | 4 days and 6 days |
| Sales history span | 10 days |
| Sales history units | 40 pcs |

Expected manual results:

```text
available stock = 100 - 40 = 60 pcs
average unit cost = 500 / 100 = 5
average lead time = (4 + 6) / 2 = 5 days
average daily demand = 40 / 10 = 4 pcs/day
lead-time demand = 4 * 5 = 20 pcs
safety stock = 4 * 7 = 28 pcs
reorder level = ceil(20 + 28) = 48 pcs
recommended restock = max(0, 48 + 20 - 60 - 10) = 0 pcs
```

The test passes only if the backend stock report returns the same values.

### 3.3 Calculation Acceptance Criteria

A calculation is valid when:

- the expected formula is written down
- the test dataset is small enough to calculate manually
- the backend API returns exactly the expected value
- edge cases are included, such as no sales history, oversold stock, delayed purchases, pending purchases, cancelled transactions, and returned sales

---

## 4. AI Chat Validation

AI Chat is easier to validate because the current design is backend-guided and deterministic. The existing assistant builds a structured local summary instead of letting the model freely decide business facts.

The validation target should be:

> Given a fixed database state and a fixed user question, the assistant returns the expected title, metrics, records, and scope behavior.

### 4.1 Example AI Chat Test Cases

| User Question | Expected Validation |
| --- | --- |
| `Which items are low stock?` | Response title is `Restock priorities`; product appears; recommended restock value is correct |
| `What is our net position?` | AR, AP, and net position match backend finance summary |
| `Summarize customer activity for X this month` | Customer sales, billing notes, credit notes, and top products match fixed records |
| `Show line items for TI-001` | Correct sale line items appear |
| Unsupported broad question | Assistant rejects the question instead of inventing an answer |

### 4.2 Simplest AI Chat Validation Method

1. Create fixed test records in Django tests.
2. Call `answer_inventory_question(question)`.
3. Assert the structured `presentation` fields:
   - `title`
   - `metrics`
   - `sections`
   - record targets such as product, sale, purchase, billing note
4. Assert the answer contains important facts.
5. Assert unsupported questions are rejected.

This is already the right style of testing because it checks facts, not writing style.

---

## 5. AI Report Validation

AI Report needs a slightly different approach because the final report is HTML and may be generated with AI wording.

The safest validation target is:

> The report must use only backend-prepared context and must contain the required facts for the selected entity and period.

### 5.1 What To Validate Automatically

For each report type, tests should validate:

| Report Type | Required Facts |
| --- | --- |
| Supplier report | supplier name, purchase count, purchase total, open AP, recent purchases |
| Customer report | customer name, sales count, sales total, open AR, billing notes, credit notes |
| Product report | product name, SKU, available stock, incoming stock, sales units, gross margin |

The test should also validate:

- selected date range is applied
- records outside the period do not appear
- missing AI API key still returns a local HTML report
- returned HTML includes a print button
- unsafe script tags are removed or not allowed

### 5.2 AI Report Accuracy Boundary

For AI Report, there are two levels of accuracy:

1. **Data accuracy**: numbers and records match backend context.
2. **Explanation accuracy**: AI interpretation does not contradict the data.

Data accuracy can be tested automatically. Explanation accuracy should be reviewed with a checklist because natural-language interpretation is not always fully provable by unit tests.

### 5.3 Simplest AI Report Validation Method

1. Run report tests with `OPENAI_API_KEY=""`.
2. Confirm the local fallback HTML contains the expected facts.
3. Stub or mock the AI call in one test to confirm AI HTML is wrapped and sanitized correctly.
4. Use a human checklist for one generated report per scope: supplier, customer, product.

This avoids depending on live AI responses during normal automated tests.

---

## 6. Recommended Validation Checklist

Use this checklist when reviewing a calculation, AI Chat answer, or AI Report:

| Question | Pass Criteria |
| --- | --- |
| Is the source data fixed and known? | The test creates exact products, purchases, sales, and finance records |
| Is the formula documented? | The report or test comments show the expected calculation |
| Is the backend checked first? | API/service output matches the manual expected result |
| Does AI output match backend facts? | Important numbers and records appear correctly |
| Does the AI invent unsupported facts? | No extra supplier, customer, product, amount, or date appears |
| Are date filters respected? | Records outside the selected period are excluded |
| Are unsupported requests handled safely? | AI Chat rejects them; AI Report only allows fixed scopes |
| Is there a human review sample? | At least one generated report per scope is reviewed manually |

---

## 7. Evidence To Include In The Project Report

For a simple academic project report, include this evidence:

1. **Formula table**
   - list each formula, such as reorder point and stock availability
   - show one manual example with expected result

2. **Automated test evidence**
   - mention Django tests for stock report, AI Chat, and AI Report
   - include test command:

```bash
backend/.venv/bin/python backend/manage.py test inventory
```

3. **Output comparison table**

| Feature | Input | Expected Result | Actual Result | Status |
| --- | --- | --- | --- | --- |
| Reorder point | Fixed product dataset | 48 pcs | 48 pcs | Pass |
| AI Chat low stock | `Which items are low stock?` | Product appears with restock value | Matches | Pass |
| Supplier AI Report | Supplier + all time | Purchase total and open AP shown | Matches | Pass |

4. **Limitation statement**
   - AI text can be checked for factual consistency, but not mathematically proven in the same way as backend formulas
   - therefore, critical values must come from backend calculations and tests

---

## 8. Simplest Path Summary

The simplest reliable path is:

1. Choose 3 fixed datasets:
   - one product/reorder dataset
   - one customer dataset
   - one supplier dataset
2. Manually calculate expected results in a table.
3. Add or maintain backend tests that assert exact API/service outputs.
4. Validate AI Chat against its structured presentation, not only text.
5. Validate AI Report HTML against required backend facts.
6. Add a short human review checklist for generated prose.

This is enough to support the claim:

> The system validates factual accuracy by comparing AI-visible outputs and calculation results against backend source-of-truth formulas and fixed test data.

---

## 9. Implemented Validation Evidence

The validation plan is now backed by focused Django tests in [backend/inventory/tests.py](../backend/inventory/tests.py).

### 9.1 Calculation Evidence

Test:

```text
LookupEligibilityTests.test_dashboard_stock_report_matches_manual_reorder_formula
```

What it validates:

- fixed product dataset from this report
- received purchase units = `100`
- allocated sales units = `40`
- available stock = `60`
- average unit cost = `5`
- average lead time = `5`
- average daily demand = `4`
- safety stock = `28`
- reorder level = `48`
- pending sales = `20`
- pending purchase = `10`
- recommended restock = `0`
- days until stockout = `15`
- stock value = `300`

This test proves the reorder-point example is not only theoretical; the backend stock report returns the same result as the manual formula.

### 9.2 AI Chat Evidence

Existing tests in `ChatAssistantAlignmentTests` validate that AI Chat:

- returns deterministic backend summaries
- reports low-stock products
- reports net position from backend finance values
- summarizes customer and supplier activity by period
- shows document line-item detail
- rejects unsupported reporting scopes instead of inventing answers

Important examples:

```text
ChatAssistantAlignmentTests.test_chat_reports_low_stock_and_restock_scope
ChatAssistantAlignmentTests.test_chat_reports_net_position
ChatAssistantAlignmentTests.test_chat_summarizes_customer_with_date_range
ChatAssistantAlignmentTests.test_chat_summarizes_supplier_this_month
ChatAssistantAlignmentTests.test_chat_rejects_generic_transaction_summary_as_out_of_scope
```

### 9.3 AI Report Evidence

Tests in `AiReportApiTests` validate that AI Report:

- returns printable local HTML when `OPENAI_API_KEY` is empty
- includes selected supplier/product facts
- respects custom date ranges
- rejects missing selected entities
- rejects incomplete custom date ranges
- wraps model HTML in a printable page
- removes unsafe model output such as script tags, unsafe event handlers, iframes, and `javascript:` URLs

Important examples:

```text
AiReportApiTests.test_supplier_report_returns_printable_local_html_without_ai_key
AiReportApiTests.test_product_report_respects_custom_date_range
AiReportApiTests.test_ai_report_wraps_and_sanitizes_model_html
```

### 9.4 Verification Command

Run the targeted validation tests:

```bash
backend/.venv/bin/python backend/manage.py test inventory.tests.LookupEligibilityTests.test_dashboard_stock_report_matches_manual_reorder_formula inventory.tests.AiReportApiTests.test_ai_report_wraps_and_sanitizes_model_html
```

Run the full inventory test suite:

```bash
backend/.venv/bin/python backend/manage.py test inventory
```
