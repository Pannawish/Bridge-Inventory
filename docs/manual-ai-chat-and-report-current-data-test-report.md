# Manual Test Report: AI Chat And AI Report With Current Data

This document records the manual validation I performed against the current Bridge Inventory database on 2026-06-22.

Unlike the automated tests, this check used the current local MySQL data instead of Django's temporary test database.

Related documents:

- [Manual Test Report: AI Chat And AI Report](./manual-ai-chat-and-report-user-test-report.md)
- [Manual Test Report: AI And Calculation Accuracy](./manual-ai-calculation-test-report.md)
- [Automated Test Functions Explained](./automated-test-functions-explained.md)

---

## 1. Test Objective

My objective was to check whether AI Chat and AI Report work correctly with the real current data in the project database.

I checked:

1. Whether AI Chat answers match current customer, supplier, finance, and scope data.
2. Whether AI Report can generate reports from current supplier, customer, and product data.
3. Whether AI Report uses the configured AI model when the API key is available.
4. Whether the generated report contains a printable HTML document.

---

## 2. Current Data Summary

Before testing, I checked the current database record counts.

| Data Type | Current Count |
| --- | ---: |
| Products | 52 |
| Suppliers | 16 |
| Customers | 19 |
| Purchases | 72 |
| Sales | 109 |

The AI API key was configured in the environment. I only checked whether it was present; I did not display or record the secret key.

| Setting | Result |
| --- | --- |
| AI API key configured | Yes |
| Configured model | `gpt-5.4-mini` |

---

## 3. Database Readiness Check

During the first AI Chat attempt, the system reported that the database schema was missing the `inventory_creditnote.vat_mode` column.

I checked pending migrations and found:

| Migration | Status Before Fix |
| --- | --- |
| `inventory.0026_creditnote_total_before_vat_creditnote_vat_amount_and_more` | Pending |
| `inventory.0027_recompute_creditnote_vat` | Pending |

I applied the pending migrations. After that, the real-data AI Chat and AI Report tests could run.

| Check | Result |
| --- | --- |
| Django system check | Pass |
| Pending migrations applied | Pass |
| AI Chat could read current data | Pass |
| AI Report could read current data | Pass |

---

## 4. Manual Test Case 1: AI Chat Customer Summary

### Test Data Selected

I selected the customer with strong current activity:

| Field | Value |
| --- | --- |
| Customer | Admissions Office |
| Date range | 2026-01-01 to 2026-06-22 |

### Question I Asked

```text
Summarize customer activity for Admissions Office from 2026-01-01 to 2026-06-22
```

### Source Database Values

I checked the same customer data directly from the database.

| Source Fact | Database Value |
| --- | ---: |
| Sales count | 9 |
| Sales total | 111,950.95 |
| Active sales count | 8 |
| Active sales total | 88,603.37 |
| Billing notes | 2 |
| Open AR | 31,852.02 |
| Quotations | 1 |

### AI Chat Result

| Check | Expected From Database | AI Chat Output | Status |
| --- | ---: | ---: | --- |
| Used model | `local-summary` | `local-summary` | Pass |
| Customer | Admissions Office | Admissions Office | Pass |
| Sales count | 9 | 9 | Pass |
| Sales total | 111,950.95 | 111,950.95 | Pass |
| Open AR | 31,852.02 | 31,852.02 | Pass |
| Quotations | 1 | 1 | Pass |

### My Conclusion

AI Chat passed this current-data customer summary test. The answer matched the current database totals for Admissions Office.

---

## 5. Manual Test Case 2: AI Chat Supplier Summary

### Test Data Selected

| Field | Value |
| --- | --- |
| Supplier | Smart Label Solutions |
| Date range | 2026-01-01 to 2026-06-22 |

### Question I Asked

```text
Summarize supplier activity for Smart Label Solutions from 2026-01-01 to 2026-06-22
```

### Source Database Values

| Source Fact | Database Value |
| --- | ---: |
| Purchase count | 5 |
| Purchase total | 60,563.90 |
| Active purchase count | 5 |
| Active purchase total | 60,563.90 |
| Payment batches | 2 |
| Scheduled AP | 10,660.04 |
| Supplier quotations | 1 |

### AI Chat Result

| Check | Expected From Database | AI Chat Output | Status |
| --- | ---: | ---: | --- |
| Used model | `local-summary` | `local-summary` | Pass |
| Supplier | Smart Label Solutions | Smart Label Solutions | Pass |
| Purchase count | 5 | 5 | Pass |
| Purchase total | 60,563.90 | 60,563.90 | Pass |
| Scheduled AP | 10,660.04 | 10,660.04 | Pass |
| Supplier quotations | 1 | 1 | Pass |

### My Conclusion

AI Chat passed the supplier summary test. The output matched the current purchase, payment batch, and quotation data.

---

## 6. Manual Test Case 3: AI Chat Finance Summary

### Question I Asked

```text
What is our net position?
```

### AI Chat Result

| Check | AI Chat Output | Status |
| --- | ---: | --- |
| Used model | `local-summary` | Pass |
| AR last month | 139.81 | Pass |
| AP last month | 0 | Pass |
| Net last month | 139.81 | Pass |
| Open net today | 384,575.97 | Pass |
| Open receivables today | 791,141.05 | Pass |
| Open payables today | 406,565.08 | Pass |
| Overdue AR | 380,356.04 | Pass |
| Overdue AP | 364,429.99 | Pass |

### My Conclusion

AI Chat returned a finance summary from backend-calculated values. The result was structured and did not require a live AI model call.

---

## 7. Manual Test Case 4: AI Chat Unsupported Question

### Question I Asked

```text
Show recent quotations
```

### Expected Result

AI Chat should not invent a broad quotation report if that workflow is outside its current supported scope.

### Actual Result

| Check | Actual Result | Status |
| --- | --- | --- |
| Used model | `local-summary` | Pass |
| Response title | Outside current assistant scope | Pass |
| Response behavior | Supported workflows only | Pass |
| Invented quotation report | No | Pass |

### My Conclusion

AI Chat passed the unsupported-question test. It gave a controlled refusal instead of inventing a report.

---

## 8. Manual Test Case 5: AI Report Supplier Report

### Test Data Selected

| Field | Value |
| --- | --- |
| Report type | Supplier |
| Supplier | Smart Label Solutions |
| Period | All time |

### Source Database Values

| Source Fact | Database Value |
| --- | ---: |
| Purchase count in selected test range | 5 |
| Purchase total in selected test range | THB 60,563.90 |
| Scheduled AP in selected test range | THB 10,660.04 |

### AI Report Result

The AI Report backend returned:

| Check | Actual Result | Status |
| --- | --- | --- |
| Used model | `gpt-5.4-mini` | Pass |
| Scope | Supplier: Smart Label Solutions | Pass |
| Period | All time | Pass |
| HTML document returned | Yes | Pass |
| Contains `<!doctype html>` | Yes | Pass |
| Contains print button script `window.print()` | Yes | Pass |
| Contains supplier name | Yes | Pass |
| Contains purchase reference `PO-6905-008` | Yes | Pass |
| Contains purchase total `THB 60,563.90` | Yes | Pass |
| Contains product `USB-C Cable 2m` | Yes | Pass |

### My Conclusion

AI Report passed the supplier report test with current data. Because the API key was configured, the report used the configured model and returned printable HTML that contained the expected supplier facts.

---

## 9. Manual Test Case 6: AI Report Customer Report

### Test Data Selected

| Field | Value |
| --- | --- |
| Report type | Customer |
| Customer | Admissions Office |
| Period | 2026-01-01 to 2026-06-22 |

### Source Database Values

| Source Fact | Database Value |
| --- | ---: |
| Sales records | 9 |
| Active sales records | 8 |
| Active sales total | THB 88,603.37 |
| Billing notes | 2 |
| Open AR | THB 31,852.02 |
| Quotations | 1 |
| Credit notes | 0 |

Recent customer records used for checking:

| Type | Reference | Date | Amount |
| --- | --- | --- | ---: |
| Sale | `TI-6905-023` | 2026-05-26 | THB 214.00 |
| Billing note | `BN-6904-001` | 2026-04-24 | THB 31,852.02 |
| Quotation | `QT-000002` | 2026-01-20 | THB 1,487.02 |

### AI Report Result

| Check | Actual Result | Status |
| --- | --- | --- |
| Used model | `gpt-5.4-mini` | Pass |
| Scope | Customer: Admissions Office | Pass |
| Period | 2026-01-01 to 2026-06-22 | Pass |
| HTML document returned | Yes | Pass |
| Contains `<!doctype html>` | Yes | Pass |
| Contains print button script `window.print()` | Yes | Pass |
| Contains customer name | Yes | Pass |
| Contains sale reference `TI-6905-023` | Yes | Pass |
| Contains billing note `BN-6904-001` | Yes | Pass |
| Contains quotation `QT-000002` | Yes | Pass |
| Contains active sales total `THB 88,603.37` | Yes | Pass |
| Contains open AR `THB 31,852.02` | Yes | Pass |

### My Conclusion

AI Report passed the customer report test with current data. The generated report used the configured AI model and included the expected customer, sale, billing note, quotation, active sales, and open AR details.

---

## 10. Manual Test Case 7: AI Report Product Report

### Test Data Selected

| Field | Value |
| --- | --- |
| Report type | Product |
| Product | USB-C Cable 2m |
| SKU | `USB-C-2M` |
| Period | 2026-01-01 to 2026-06-22 |

### Source Database Values

| Source Fact | Database Value |
| --- | ---: |
| Purchase item count | 8 |
| Purchase units | 476 pcs |
| Purchase amount | THB 43,007.50 |
| Sale item count | 10 |
| Sales units | 239 pcs |
| Sales amount | THB 41,250.06 |
| Available stock | 207 pcs |

Recent product records used for checking:

| Type | Reference | Date | Amount |
| --- | --- | --- | ---: |
| Purchase | `PO-6905-007` | 2026-05-13 | THB 2,565.55 |
| Sale | `TI-6905-008` | 2026-05-10 | THB 793.95 |

### AI Report Result

| Check | Actual Result | Status |
| --- | --- | --- |
| Used model | `gpt-5.4-mini` | Pass |
| Scope | Product: USB-C Cable 2m | Pass |
| Period | 2026-01-01 to 2026-06-22 | Pass |
| HTML document returned | Yes | Pass |
| Contains `<!doctype html>` | Yes | Pass |
| Contains print button script `window.print()` | Yes | Pass |
| Contains product name | Yes | Pass |
| Contains purchase reference `PO-6905-007` | Yes | Pass |
| Contains sale reference `TI-6905-008` | Yes | Pass |
| Contains purchase amount `THB 2,565.55` | Yes | Pass |
| Contains sale amount `THB 793.95` | Yes | Pass |

### My Conclusion

AI Report passed the product report test with current data. The generated report used the configured AI model and still included the expected product, purchase, sale, and print-report details.

---

## 11. Overall Result

| Feature | Current-Data Test | Result |
| --- | --- | --- |
| AI Chat customer summary | Admissions Office | Pass |
| AI Chat supplier summary | Smart Label Solutions | Pass |
| AI Chat finance summary | Net position | Pass |
| AI Chat unsupported question | Show recent quotations | Pass |
| AI Report supplier report | Smart Label Solutions, all time | Pass |
| AI Report customer report | Admissions Office, custom period | Pass |
| AI Report product report | USB-C Cable 2m, custom period | Pass |

---

## 12. Final Conclusion

I successfully performed a manual validation using the current real database data.

The result was:

> AI Chat correctly summarized current backend facts using local deterministic summaries, and AI Report successfully generated printable HTML reports using the configured AI model while still including the expected current database records.

One environment issue was found before testing: the database had pending migrations. After applying the pending migrations, both AI Chat and AI Report worked with the current data.
