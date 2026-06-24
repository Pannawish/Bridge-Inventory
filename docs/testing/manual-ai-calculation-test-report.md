# Manual Test Report: AI And Calculation Accuracy

This document is written as a simple manual test report for presentation. It explains how the project proves that important calculations, AI Chat answers, and AI Report outputs are accurate enough to trust for operational use.

The tests are based on automated Django tests in [backend/inventory/tests.py](../../backend/inventory/tests.py), but the explanation below is written so non-developers can understand the validation process.

Related technical plan:

- [AI Output And Calculation Validation Plan](./ai-and-calculation-validation-plan.md)

---

## 1. Test Objective

The objective is to answer this question:

> Can we verify that the system calculations and AI outputs are correct?

The answer is:

> Yes. The system validates important numbers against backend formulas and fixed test data. AI output is checked by comparing it with backend-calculated facts.

The main idea is:

> **Backend data and formulas are the source of truth. AI is only used to summarize or present those facts.**

---

## 2. Validation Scope

This report covers three areas:

| Area | What We Validate |
| --- | --- |
| Inventory calculation | Stock, reorder point, safety stock, recommended restock |
| AI Chat | Whether AI Chat returns the correct backend facts |
| AI Report | Whether generated report HTML contains correct facts and stays safe |

---

## 3. Test Case 1: Reorder Point Calculation

### Purpose

To prove that the reorder point calculation matches a manual calculation.

Automated test name:

```text
LookupEligibilityTests.test_dashboard_stock_report_matches_manual_reorder_formula
```

### Test Data

The test creates one product:

| Field | Value |
| --- | --- |
| Product SKU | `TEST-PEN` |
| Product name | Manual Reorder Product |
| Base unit | pcs |

The test creates purchase and sales records:

| Data | Value |
| --- | --- |
| Received purchase units | 100 pcs |
| Received purchase value | 500 |
| Allocated sales units | 40 pcs |
| Pending sales units | 20 pcs |
| Pending purchase units | 10 pcs |
| Lead time sample 1 | 4 days |
| Lead time sample 2 | 6 days |
| Sales history units | 40 pcs |
| Sales history period | 10 days |

### Manual Calculation

```text
available stock = received purchase units - allocated sales units
available stock = 100 - 40
available stock = 60 pcs
```

```text
average unit cost = received purchase value / received purchase units
average unit cost = 500 / 100
average unit cost = 5
```

```text
average lead time = (4 + 6) / 2
average lead time = 5 days
```

```text
average daily demand = sales history units / sales history period
average daily demand = 40 / 10
average daily demand = 4 pcs per day
```

```text
lead-time demand = average daily demand * average lead time
lead-time demand = 4 * 5
lead-time demand = 20 pcs
```

```text
safety stock = average daily demand * 7 days
safety stock = 4 * 7
safety stock = 28 pcs
```

```text
reorder point = lead-time demand + safety stock
reorder point = 20 + 28
reorder point = 48 pcs
```

```text
recommended restock = reorder point + pending sales - available stock - pending purchase
recommended restock = 48 + 20 - 60 - 10
recommended restock = -2
recommended restock = 0 pcs, because the system never recommends a negative purchase quantity
```

### Expected Result

| Output | Expected Value |
| --- | --- |
| Available stock | 60 |
| Average unit cost | 5 |
| Average lead time | 5 |
| Average daily demand | 4 |
| Safety stock | 28 |
| Reorder point | 48 |
| Pending sales | 20 |
| Pending purchase | 10 |
| Recommended restock | 0 |
| Days until stockout | 15 |
| Stock value | 300 |

### Actual Result

The automated test confirmed that the backend returned the same values.

| Output | Expected | Actual | Status |
| --- | --- | --- | --- |
| Available stock | 60 | 60 | Pass |
| Average unit cost | 5 | 5 | Pass |
| Average lead time | 5 | 5 | Pass |
| Average daily demand | 4 | 4 | Pass |
| Safety stock | 28 | 28 | Pass |
| Reorder point | 48 | 48 | Pass |
| Recommended restock | 0 | 0 | Pass |
| Days until stockout | 15 | 15 | Pass |
| Stock value | 300 | 300 | Pass |

### Conclusion

The reorder point formula is validated because the backend result matches the manual calculation exactly.

---

## 4. Test Case 2: AI Chat Accuracy

### Purpose

To prove that AI Chat does not invent important values and instead summarizes backend-calculated facts.

Example automated tests:

```text
ChatAssistantAlignmentTests.test_chat_reports_low_stock_and_restock_scope
ChatAssistantAlignmentTests.test_chat_reports_net_position
ChatAssistantAlignmentTests.test_chat_summarizes_customer_with_date_range
ChatAssistantAlignmentTests.test_chat_summarizes_supplier_this_month
ChatAssistantAlignmentTests.test_chat_rejects_generic_transaction_summary_as_out_of_scope
```

### Manual Test Steps

| Step | Action |
| --- | --- |
| 1 | Prepare fixed product, purchase, sale, billing note, payment batch, and credit note data |
| 2 | Ask AI Chat a supported question |
| 3 | Compare the AI Chat answer with backend records |
| 4 | Ask AI Chat an unsupported broad question |
| 5 | Confirm the assistant refuses to invent an answer |

### Example Questions And Expected Results

| Question | Expected Result |
| --- | --- |
| `Which items are low stock?` | The low-stock product appears with a restock recommendation |
| `What is our net position?` | AR, AP, and net position match backend finance values |
| `Summarize customer activity for Finance Department this month` | Customer sales, billing notes, credit notes, and recent records match backend data |
| `Summarize supplier activity for Paper Supply Co. this month` | Supplier purchases, payment batches, and payables match backend data |
| `Show recent quotations` | The assistant rejects the request if it is outside the supported scope |

### Actual Result

The automated tests confirmed:

| Check | Status |
| --- | --- |
| Low-stock answer uses backend stock data | Pass |
| Net position uses backend AR/AP data | Pass |
| Customer summary uses selected customer data | Pass |
| Supplier summary uses selected supplier data | Pass |
| Unsupported questions are rejected | Pass |

### Conclusion

AI Chat is validated by checking its structured answer against backend-prepared facts. The system does not depend on free-form AI guessing for core business values.

---

## 5. Test Case 3: AI Report Correctness

### Purpose

To prove that AI Report contains the selected business data and respects the selected time period.

Example automated tests:

```text
AiReportApiTests.test_supplier_report_returns_printable_local_html_without_ai_key
AiReportApiTests.test_product_report_respects_custom_date_range
```

### Manual Test Steps

| Step | Action |
| --- | --- |
| 1 | Select report type: supplier, customer, or product |
| 2 | Select a specific record |
| 3 | Select all time or a custom period |
| 4 | Generate the report |
| 5 | Check that the report contains the correct selected record and metrics |
| 6 | Check that records outside the selected period are excluded |
| 7 | Check that the report has a print button |

### Expected Result

| Check | Expected Result |
| --- | --- |
| Supplier report | Shows selected supplier name and purchase information |
| Product report | Shows selected product sales and purchase records |
| Custom date period | Includes records inside the date range only |
| Old/outside-period record | Does not appear |
| Print button | Appears in the generated HTML report |

### Actual Result

The automated tests confirmed:

| Check | Status |
| --- | --- |
| Report returns printable HTML | Pass |
| Supplier name appears | Pass |
| Purchase reference appears | Pass |
| Product report respects custom period | Pass |
| Old record outside the period is excluded | Pass |
| Print button is included | Pass |

### Conclusion

AI Report is validated because the generated report contains the correct backend data for the selected scope and period.

---

## 6. Test Case 4: AI Report Safety

### Purpose

To prove that even if model-generated HTML contains unsafe content, the system removes unsafe parts before showing the report.

Automated test name:

```text
AiReportApiTests.test_ai_report_wraps_and_sanitizes_model_html
```

### Manual Test Idea

The test simulates unsafe AI output that contains:

| Unsafe Content | Risk |
| --- | --- |
| `<script>` tag | Could run unwanted JavaScript |
| `onclick` event | Could run unwanted JavaScript when clicked |
| `<iframe>` tag | Could load external unsafe content |
| `javascript:` URL | Could execute unsafe code |

### Expected Result

The final report should:

- keep safe report content
- keep the print button
- remove script tags
- remove unsafe event handlers
- remove iframes
- remove `javascript:` links

### Actual Result

| Check | Status |
| --- | --- |
| Safe report heading remains | Pass |
| Print button remains | Pass |
| Script tag removed | Pass |
| Unsafe event handler removed | Pass |
| Iframe removed | Pass |
| `javascript:` URL removed | Pass |

### Conclusion

The AI Report output is safer because the backend sanitizes model HTML before returning it to the browser.

---

## 7. Test Case 5: API Key Configured With Real Mock Data

### Purpose

To prove how AI Chat and AI Report behave when an AI API key is configured, while still using controlled mock business records in the test database.

Automated test names:

```text
ChatAssistantAlignmentTests.test_chat_with_configured_key_answers_from_real_mock_data
AiReportApiTests.test_ai_report_with_configured_key_uses_real_mock_data_context
```

### Important Note

The test configures an API key setting, but it does not make a live internet call to the AI provider.

This is intentional because automated tests should be:

- repeatable
- fast
- safe to run without spending API credits
- independent from internet availability

For AI Report, the model response is simulated with `patch()`. This allows the test to validate how our system uses model output without depending on a real external response.

### AI Chat Mock Data

| Field | Value |
| --- | --- |
| Customer | Configured Chat Customer |
| Sale reference | `TI-AI-CHAT-KEY` |
| Sale total | 275 |
| Period | Today only |
| API key setting | Configured during the test |

### AI Chat Expected Result

| Check | Expected Result |
| --- | --- |
| Model used | `local-summary` |
| Customer name | Appears in the answer |
| Sales count | 1 |
| Sales total | 275 |
| Record target | Points to the created sale record |

### AI Chat Actual Result

| Check | Expected | Actual | Status |
| --- | --- | --- | --- |
| Model used | `local-summary` | `local-summary` | Pass |
| Sales count | 1 | 1 | Pass |
| Sales total | 275 | 275 | Pass |
| Sale reference | `TI-AI-CHAT-KEY` | `TI-AI-CHAT-KEY` | Pass |

### AI Report Mock Data

| Field | Value |
| --- | --- |
| Supplier | Configured Key Supplier |
| Product | Configured Key Product |
| SKU | `AI-KEY-1` |
| Purchase reference | `PO-AI-KEY-001` |
| Purchase total | THB 450.00 |
| API key setting | Configured during the test |
| Simulated model | `gpt-test` |

### AI Report Expected Result

| Check | Expected Result |
| --- | --- |
| Model used | `gpt-test` |
| Report context | Contains Configured Key Supplier |
| Purchase table | Contains `PO-AI-KEY-001` |
| Purchase amount | THB 450.00 |
| Final HTML | Contains simulated model summary |
| Print button | Included |

### AI Report Actual Result

| Check | Expected | Actual | Status |
| --- | --- | --- | --- |
| Model used | `gpt-test` | `gpt-test` | Pass |
| Supplier context | Configured Key Supplier | Configured Key Supplier | Pass |
| Purchase reference | `PO-AI-KEY-001` | `PO-AI-KEY-001` | Pass |
| Purchase amount | THB 450.00 | THB 450.00 | Pass |
| Print button | Included | Included | Pass |

### Conclusion

When an API key is configured, AI Chat still uses backend facts through the deterministic local summary. AI Report can use model-style HTML, but the backend first builds the report context from real database records and then wraps the result into a printable report page.

---

## 8. Presentation Summary

For presentation, the validation can be explained in three simple points:

1. **We validate calculations with manual examples.**
   - Example: reorder point is manually calculated as `48 pcs`.
   - The backend test returns the same value.

2. **We validate AI Chat against backend facts.**
   - AI Chat is not allowed to freely invent important business numbers.
   - Tests check that its summaries match backend data.

3. **We validate AI Report output and safety.**
   - Tests check selected data, date filtering, print output, and HTML safety.
   - Configured-key tests confirm the report context still comes from backend records.

---

## 9. Test Evidence

Targeted validation command:

```bash
backend/.venv/bin/python backend/manage.py test inventory.tests.LookupEligibilityTests.test_dashboard_stock_report_matches_manual_reorder_formula inventory.tests.AiReportApiTests.test_ai_report_wraps_and_sanitizes_model_html inventory.tests.AiReportApiTests.test_ai_report_with_configured_key_uses_real_mock_data_context inventory.tests.ChatAssistantAlignmentTests.test_chat_with_configured_key_answers_from_real_mock_data
```

Full backend test command:

```bash
backend/.venv/bin/python backend/manage.py test inventory
```

Latest result:

```text
Configured-key AI tests: 2 tests OK
Targeted validation tests: 4 tests OK
Backend system check: OK
Migration check: OK
Full backend inventory test run: 95 tests run, 1 seed-data workflow failure observed
Isolated seed-data workflow test: OK
```

---

## 10. Final Conclusion

The project can show that calculation and AI outputs are accurate by using a clear source-of-truth method:

> Backend formulas calculate the facts. AI Chat and AI Report present those facts. Tests compare both calculations and AI-visible outputs against fixed expected results.

This makes the validation understandable for both technical and non-technical audiences.
