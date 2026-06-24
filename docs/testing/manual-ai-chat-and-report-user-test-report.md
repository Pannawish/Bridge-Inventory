# Manual Test Report: AI Chat And AI Report

This document is written as a manual test report from my point of view as the tester. It explains how I tested the AI Chat and AI Report features in Bridge Inventory and how I checked whether the output matched the system data.

Related documents:

- [Manual Test Report: AI And Calculation Accuracy](./manual-ai-calculation-test-report.md)
- [Automated Test Functions Explained](./automated-test-functions-explained.md)
- [AI Output And Calculation Validation Plan](./ai-and-calculation-validation-plan.md)

---

## 1. Test Objective

My objective was to confirm that:

1. AI Chat answers are based on real backend inventory, sales, purchase, customer, supplier, AR, and AP data.
2. AI Chat does not invent unsupported business answers.
3. AI Report generates a readable HTML report for the selected supplier, customer, or product.
4. AI Report respects the selected time period.
5. AI Report output includes a print button and can be used for presentation or business review.

The main validation rule I used was:

> I treat backend records and backend calculations as the source of truth. AI output is correct only if it matches those backend facts.

---

## 2. Test Environment

| Item | Value |
| --- | --- |
| System | Bridge Inventory |
| Features tested | AI Chat, AI Report |
| Test style | Manual user-flow test |
| Data style | Controlled mock business data |
| Report language | English |
| API key condition | AI API key configured for system behavior, but validation still checks backend facts |

---

## 3. Test Data Used

I used simple mock business data so that the expected results were easy to check manually.

### AI Chat Test Data

| Field | Value |
| --- | --- |
| Customer | Configured Chat Customer |
| Sale reference | `TI-AI-CHAT-KEY` |
| Sale date | Today |
| Sale status | Delivered |
| Sale total | 275 |

Expected AI Chat facts:

| Expected Fact | Expected Value |
| --- | --- |
| Customer summary should show customer | Configured Chat Customer |
| Sales count | 1 |
| Sales total | 275 |
| Recent sale reference | `TI-AI-CHAT-KEY` |

### AI Report Test Data

| Field | Value |
| --- | --- |
| Supplier | Configured Key Supplier |
| Product | Configured Key Product |
| SKU | `AI-KEY-1` |
| Purchase reference | `PO-AI-KEY-001` |
| Purchase date | Today |
| Purchase status | Received |
| Purchase quantity | 30 pcs |
| Unit cost | 15 |
| Purchase total | THB 450.00 |

Expected AI Report facts:

| Expected Fact | Expected Value |
| --- | --- |
| Supplier name should appear | Configured Key Supplier |
| Purchase reference should appear | `PO-AI-KEY-001` |
| Purchase amount should appear | THB 450.00 |
| Report should be printable | Print button is included |

---

## 4. Manual Test Case 1: AI Chat Customer Summary

### Purpose

I tested AI Chat to confirm that it can summarize customer activity using system data instead of guessing.

### Steps I Performed

| Step | My Action |
| --- | --- |
| 1 | I opened the Bridge Inventory system. |
| 2 | I prepared or selected the mock customer `Configured Chat Customer`. |
| 3 | I confirmed that this customer had one sale: `TI-AI-CHAT-KEY`. |
| 4 | I opened the AI Chat page. |
| 5 | I entered the question: `Summarize customer activity for Configured Chat Customer from today to today`. |
| 6 | I submitted the question. |
| 7 | I reviewed the AI Chat answer. |
| 8 | I compared the answer with the known backend data. |

### Expected Result

| Check | Expected Result |
| --- | --- |
| AI Chat should identify the correct customer | Configured Chat Customer |
| AI Chat should show one sale | Sales count: 1 |
| AI Chat should show the correct sales total | Sales total: 275 |
| AI Chat should show the sale reference | `TI-AI-CHAT-KEY` |
| AI Chat should link the answer to the correct sale record | Sale target points to the created sale |

### Actual Result

| Check | Expected | Actual | Status |
| --- | --- | --- | --- |
| Customer name | Configured Chat Customer | Configured Chat Customer | Pass |
| Sales count | 1 | 1 | Pass |
| Sales total | 275 | 275 | Pass |
| Sale reference | `TI-AI-CHAT-KEY` | `TI-AI-CHAT-KEY` | Pass |
| Backend source | System records | System records | Pass |

### My Conclusion

The AI Chat customer summary passed the manual test. The answer matched the known customer sale data, so I can explain that AI Chat is using system records rather than inventing the result.

---

## 5. Manual Test Case 2: AI Chat Unsupported Question

### Purpose

I tested whether AI Chat refuses unsupported broad questions instead of producing an unreliable answer.

### Steps I Performed

| Step | My Action |
| --- | --- |
| 1 | I opened the AI Chat page. |
| 2 | I entered an unsupported question: `Show recent quotations`. |
| 3 | I submitted the question. |
| 4 | I checked whether the assistant gave a controlled refusal instead of inventing a report. |

### Expected Result

| Check | Expected Result |
| --- | --- |
| Unsupported request | The assistant should not invent a quotation summary |
| Response title | Outside current assistant scope |
| Explanation | The assistant should explain that only supported workflows are available |

### Actual Result

| Check | Expected | Actual | Status |
| --- | --- | --- | --- |
| Unsupported request rejected | Yes | Yes | Pass |
| No invented quotation report | Yes | Yes | Pass |
| Controlled response shown | Yes | Yes | Pass |

### My Conclusion

This test passed because AI Chat did not try to answer outside its supported scope. This is important because it reduces the risk of misleading AI output.

---

## 6. Manual Test Case 3: AI Report Supplier Report

### Purpose

I tested AI Report to confirm that it generates a readable supplier report using the selected supplier and correct purchase data.

### Steps I Performed

| Step | My Action |
| --- | --- |
| 1 | I opened the AI Report page. |
| 2 | I selected `Supplier` as the report type. |
| 3 | I selected `Configured Key Supplier`. |
| 4 | I selected `All time` as the period. |
| 5 | I clicked `Generate`. |
| 6 | I confirmed that a new browser tab opened. |
| 7 | I reviewed the generated report page. |
| 8 | I checked the supplier name, purchase reference, purchase amount, and print button. |

### Expected Result

| Check | Expected Result |
| --- | --- |
| New tab opens | Yes |
| Report format | HTML report with CSS styling |
| Supplier name | Configured Key Supplier |
| Purchase reference | `PO-AI-KEY-001` |
| Purchase amount | THB 450.00 |
| Print button | Included |

### Actual Result

| Check | Expected | Actual | Status |
| --- | --- | --- | --- |
| New report tab | Opens | Opens | Pass |
| Supplier name | Configured Key Supplier | Configured Key Supplier | Pass |
| Purchase reference | `PO-AI-KEY-001` | `PO-AI-KEY-001` | Pass |
| Purchase amount | THB 450.00 | THB 450.00 | Pass |
| Print button | Included | Included | Pass |

### My Conclusion

The AI Report supplier report passed the manual test. The report showed the correct supplier and purchase data, and the report page was printable.

---

## 7. Manual Test Case 4: AI Report Custom Period Filtering

### Purpose

I tested whether AI Report respects the selected time period and excludes records outside the date range.

### Steps I Performed

| Step | My Action |
| --- | --- |
| 1 | I opened the AI Report page. |
| 2 | I selected `Product` as the report type. |
| 3 | I selected the test product. |
| 4 | I selected `Custom` period. |
| 5 | I entered today's date as both the start date and end date. |
| 6 | I clicked `Generate`. |
| 7 | I checked whether today's purchase and sale records appeared. |
| 8 | I checked whether older records outside the selected date range were excluded. |

### Expected Result

| Check | Expected Result |
| --- | --- |
| Records inside selected date | Included |
| Records outside selected date | Excluded |
| Report period label | Shows selected custom period |
| Report remains printable | Print button is included |

### Actual Result

| Check | Expected | Actual | Status |
| --- | --- | --- | --- |
| Current purchase record | Included | Included | Pass |
| Current sale record | Included | Included | Pass |
| Old outside-period record | Excluded | Excluded | Pass |
| Print button | Included | Included | Pass |

### My Conclusion

The custom period filter passed the manual test. The report used the selected date range correctly, so the generated report can be trusted for period-based review.

---

## 8. Manual Test Case 5: AI Report Safety Review

### Purpose

I tested whether the AI Report output remains safe when model-style HTML is used.

### Steps I Performed

| Step | My Action |
| --- | --- |
| 1 | I generated an AI Report using controlled test data. |
| 2 | I checked the final report HTML output. |
| 3 | I confirmed that the report kept safe content such as headings, tables, charts, and the print button. |
| 4 | I confirmed that unsafe content such as script tags, unsafe click handlers, iframe tags, and `javascript:` links were not present. |

### Expected Result

| Check | Expected Result |
| --- | --- |
| Safe report content | Remains visible |
| Print button | Remains visible |
| Script tags | Removed |
| Unsafe event handlers | Removed |
| Iframe tags | Removed |
| `javascript:` links | Removed |

### Actual Result

| Check | Expected | Actual | Status |
| --- | --- | --- | --- |
| Safe report content | Present | Present | Pass |
| Print button | Present | Present | Pass |
| Script tags | Removed | Removed | Pass |
| Unsafe event handlers | Removed | Removed | Pass |
| Iframe tags | Removed | Removed | Pass |
| `javascript:` links | Removed | Removed | Pass |

### My Conclusion

The AI Report safety review passed. This means the backend does not blindly trust model HTML before showing the report in the browser.

---

## 9. Overall Test Result

| Feature | Test Result | My Decision |
| --- | --- | --- |
| AI Chat customer summary | Pass | Output matched backend customer and sale data |
| AI Chat unsupported request | Pass | Assistant did not invent unsupported output |
| AI Report supplier report | Pass | Report contained correct supplier and purchase data |
| AI Report custom period | Pass | Report respected selected date range |
| AI Report safety | Pass | Unsafe HTML content was removed |

---

## 10. Final Conclusion

After performing these manual test steps, I concluded that AI Chat and AI Report can be validated using controlled business data.

My final conclusion is:

> AI Chat and AI Report are acceptable for operational support because their important numbers are checked against backend records. AI is used to present and summarize data, but backend data remains the source of truth.

This test is useful for presentation because it shows the validation process from a user's point of view: I selected records, asked questions, generated reports, checked the output, and compared the result with known system data.
