# Automated Test Functions Explained

This document explains how the automated test functions used in [Manual Test Report: AI And Calculation Accuracy](./manual-ai-calculation-test-report.md) work.

It is technical, but written for beginners. The goal is to help you explain the tests in a project report or presentation without needing to understand every line of Django internals.

The test code is in:

- [backend/inventory/tests.py](../backend/inventory/tests.py)

---

## 1. What Is An Automated Test Function?

An automated test function is a Python function that checks whether one part of the system behaves correctly.

In this project, test functions usually follow this pattern:

```text
1. Create test data
2. Run the system function or API endpoint
3. Compare the actual result with the expected result
4. Pass if they match, fail if they do not match
```

In Django, a test function usually starts with `test_`.

Example:

```python
def test_dashboard_stock_report_matches_manual_reorder_formula(self):
    ...
```

Django finds this function automatically when running:

```bash
backend/.venv/bin/python backend/manage.py test inventory
```

---

## 2. The Test Framework Used

This project uses Django and Django REST Framework test tools.

Important classes:

| Class | Meaning |
| --- | --- |
| `TestCase` | Django test class for testing Python code and database behavior |
| `APITestCase` | Django REST Framework test class for testing API endpoints |
| `self.client` | A test HTTP client used to call backend API endpoints |
| `self.assertEqual()` | Checks that two values are equal |
| `self.assertIn()` | Checks that a value appears inside another value |
| `self.assertNotIn()` | Checks that a value does not appear |

The important idea:

> Tests run against a temporary test database, not the real user database.

So the test can safely create products, purchases, sales, and reports without affecting real data.

---

## 3. Test Setup: How Test Data Is Created

Most tests create records directly using Django models.

Example:

```python
product = Product.objects.create(
    sku="TEST-PEN",
    product_name="Manual Reorder Product",
    stock_base_unit="pcs",
)
```

This creates a product inside the temporary test database.

Another example:

```python
purchase = Purchase.objects.create(
    reference_no="PO-MANUAL-1",
    supplier_name="Manual Supplier",
    status=Purchase.STATUS_RECEIVED,
    transaction_date=self.today - timedelta(days=20),
)
```

This creates a purchase transaction.

Then a line item is added:

```python
PurchaseItem.objects.create(
    purchase=purchase,
    product=product,
    quantity=Decimal("50"),
    base_quantity=Decimal("50"),
    unit_cost=Decimal("5"),
    amount=Decimal("250"),
)
```

This is how the test builds a known business scenario.

---

## 4. Test Function 1: Reorder Formula Test

Test name:

```text
LookupEligibilityTests.test_dashboard_stock_report_matches_manual_reorder_formula
```

### 4.1 What This Test Checks

This test checks that the backend stock report calculates inventory values correctly.

It validates:

- received purchase units
- allocated sales units
- available stock
- average unit cost
- average lead time
- average daily demand
- safety stock
- reorder point
- pending sales
- pending purchases
- recommended restock
- days until stockout
- stock value

### 4.2 Why It Uses Fixed Data

The test creates simple fixed data:

| Data | Value |
| --- | --- |
| Received stock | 100 pcs |
| Sales already allocated | 40 pcs |
| Pending sales | 20 pcs |
| Pending purchase | 10 pcs |
| Average lead time | 5 days |
| Average daily demand | 4 pcs/day |

Because the numbers are simple, a human can manually calculate the expected result.

### 4.3 How The Test Calls The System

After creating test data, the test calls the dashboard API:

```python
response = self.client.get("/api/dashboard/")
```

This is similar to the frontend asking the backend:

> Give me the dashboard summary and stock report.

The backend then runs its normal stock calculation logic.

### 4.4 How The Test Finds The Product Row

The dashboard response contains many stock report rows. The test finds the row for the product it created:

```python
row = next(
    item for item in response.data["stock_report"] if item["product_id"] == product.id
)
```

Beginner interpretation:

> Look through the stock report and pick the row that belongs to `TEST-PEN`.

### 4.5 How The Test Checks Results

The test uses assertions:

```python
self.assertEqual(row["available_stock"], 60)
self.assertEqual(row["reorder_level"], 48)
self.assertEqual(row["recommended_restock"], 0)
```

Each assertion means:

> I expect this backend value to equal this manual expected value.

If `row["reorder_level"]` is `48`, the test passes.

If it is `47` or `49`, the test fails.

### 4.6 Why This Proves The Calculation

The test proves the calculation because:

1. the input data is controlled
2. the expected result is known manually
3. the backend calculation is run normally
4. the actual result must exactly match the expected result

This is stronger than only checking the UI, because it validates the backend source of truth directly.

---

## 5. Test Function 2: AI Chat Tests

Example test names:

```text
ChatAssistantAlignmentTests.test_chat_reports_low_stock_and_restock_scope
ChatAssistantAlignmentTests.test_chat_reports_net_position
ChatAssistantAlignmentTests.test_chat_summarizes_customer_with_date_range
ChatAssistantAlignmentTests.test_chat_summarizes_supplier_this_month
ChatAssistantAlignmentTests.test_chat_rejects_generic_transaction_summary_as_out_of_scope
```

### 5.1 What These Tests Check

These tests check that AI Chat answers are based on backend data.

They validate that AI Chat:

- reports low-stock products correctly
- reports AR/AP/net position correctly
- summarizes customer activity correctly
- summarizes supplier activity correctly
- rejects unsupported questions

### 5.2 How AI Chat Is Tested

Instead of opening the browser and typing a question, the test calls the backend chat function directly:

```python
response = answer_inventory_question("Which items are low stock?")
```

Beginner interpretation:

> Send a question to the same backend logic used by AI Chat.

The response contains structured data, such as:

- `used_model`
- `answer`
- `presentation`
- `metrics`
- `sections`
- `records`

### 5.3 Example Assertion

```python
self.assertEqual(response["used_model"], "local-summary")
self.assertEqual(response["presentation"]["title"], "Restock priorities")
self.assertIn("Low-stock items: 1", response["answer"])
```

This checks:

1. the answer came from the deterministic backend summary
2. the title is correct
3. the answer includes the expected low-stock count

### 5.4 Why It Does Not Only Check Text

AI text can change slightly, so the tests also check structured presentation fields.

This is important because:

- checking only full paragraphs can be fragile
- checking structured fields is more reliable
- numbers, titles, and record targets are easier to verify

Example:

```python
self.assertEqual(product_record["target"], {"type": "product", "id": self.product.id})
```

This checks that the answer is connected to the correct product record.

### 5.5 Unsupported Question Test

The assistant should not answer everything.

Example test:

```python
response = answer_inventory_question("Show recent quotations")
self.assertEqual(response["presentation"]["title"], "Outside current assistant scope")
```

This proves the assistant can refuse unsupported broad reporting questions instead of inventing an answer.

---

## 6. Test Function 3: AI Report Correctness

Example test names:

```text
AiReportApiTests.test_supplier_report_returns_printable_local_html_without_ai_key
AiReportApiTests.test_product_report_respects_custom_date_range
```

### 6.1 What These Tests Check

These tests check that AI Report:

- returns an HTML report
- includes a print button
- includes selected supplier or product data
- respects selected date ranges
- excludes records outside the selected period
- works even when no OpenAI API key is configured

### 6.2 How The Report API Is Called

The test sends a POST request to the report endpoint:

```python
response = self.client.post(
    "/api/ai-reports/",
    {
        "scope_type": "supplier",
        "entity_id": self.supplier.id,
        "period_type": "all",
        "language": "en",
    },
    format="json",
)
```

Beginner interpretation:

> Ask the backend to generate a supplier report for this selected supplier.

### 6.3 How The Test Checks The HTML

The response contains HTML:

```python
html = response.data["html"]
```

Then the test checks that important text appears:

```python
self.assertIn("AI Report Supplier", html)
self.assertIn("PO-AI-REPORT", html)
self.assertIn("THB 120.00", html)
```

This means:

- the selected supplier appears
- the related purchase reference appears
- the expected amount appears

### 6.4 Custom Date Range Test

The product report test creates:

- one record inside the selected period
- one older record outside the selected period

Then it generates a custom-period report:

```python
"date_from": self.today.isoformat(),
"date_to": self.today.isoformat(),
```

The test checks:

```python
self.assertIn("PO-AI-REPORT", html)
self.assertNotIn("PO-AI-OLD", html)
```

This means:

> The report includes current records and excludes old records outside the selected date range.

---

## 7. Test Function 4: AI Report Safety

Test name:

```text
AiReportApiTests.test_ai_report_wraps_and_sanitizes_model_html
```

### 7.1 What This Test Checks

This test checks whether unsafe HTML from a model is removed before the report is returned.

The test simulates unsafe output containing:

```html
<script>alert("bad")</script>
<p onclick="bad()">AI Report Supplier</p>
<iframe src="https://example.invalid"></iframe>
<a href="javascript:bad()">bad link</a>
```

### 7.2 Why Mocking Is Used

The test uses:

```python
with patch(
    "inventory.ai_reports.generate_ai_report_body",
    return_value=(unsafe_fragment, "gpt-test"),
):
```

`patch()` temporarily replaces the real AI report generator with a fake one.

Beginner interpretation:

> Instead of calling a real AI model, the test pretends the model returned unsafe HTML.

This makes the test:

- fast
- predictable
- independent from internet/API availability
- safe to run repeatedly

### 7.3 What The Test Expects

The test expects safe content to remain:

```python
self.assertIn("Model Summary", html)
self.assertIn("window.print()", html)
```

It expects unsafe content to be removed:

```python
self.assertNotIn("<script", html.lower())
self.assertNotIn("bad()", html)
self.assertNotIn("<iframe", html.lower())
self.assertNotIn("javascript:", html.lower())
```

### 7.4 Why This Matters

AI Report returns HTML. If unsafe HTML were not removed, it could become a browser security problem.

This test proves that the backend does not blindly trust model output.

---

## 8. How Assertions Work

Assertions are the pass/fail checks inside tests.

Common assertions in these tests:

| Assertion | Meaning |
| --- | --- |
| `assertEqual(a, b)` | `a` must equal `b` |
| `assertIn(a, b)` | `a` must appear inside `b` |
| `assertNotIn(a, b)` | `a` must not appear inside `b` |
| `assertTrue(a)` | `a` must be true |

Example:

```python
self.assertEqual(row["reorder_level"], 48)
```

If the backend returns `48`, the test passes.

If the backend returns anything else, the test fails and Django reports the mismatch.

---

## 9. How To Run The Tests

Run the targeted validation tests:

```bash
backend/.venv/bin/python backend/manage.py test inventory.tests.LookupEligibilityTests.test_dashboard_stock_report_matches_manual_reorder_formula inventory.tests.AiReportApiTests.test_ai_report_wraps_and_sanitizes_model_html
```

Run the full inventory test suite:

```bash
backend/.venv/bin/python backend/manage.py test inventory
```

Expected successful output includes:

```text
OK
```

If a test fails, Django shows:

- which test failed
- which assertion failed
- expected value
- actual value

---

## 10. How To Explain This In A Presentation

A simple explanation:

> We create fixed test data in a temporary database, run the same backend APIs that the real system uses, and compare the actual output with expected values. For calculations, expected values are manually calculated. For AI Chat and AI Report, expected values come from backend facts. This proves the AI is not the source of truth; it only presents verified system data.

Short version:

> The tests work by comparing backend output against known expected results.

---

## 11. Summary

The automated test functions work by:

1. building controlled test data
2. calling backend services or API endpoints
3. reading the response
4. checking exact values with assertions
5. failing automatically if actual results do not match expected results

This makes the validation repeatable, understandable, and useful for both development and presentation.

