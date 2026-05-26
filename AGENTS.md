# Inventory Management Project Standards

This file is for coding agents working in this repository. Follow these rules before changing code.

## Project Shape

- The system is built for a middle-man SME business: a small-to-medium enterprise that buys from suppliers and resells to customers, so purchasing, sales, and the margin between them are core concerns.
- Frontend: React + Vite in `frontend/`.
- Backend: Django + Django REST Framework in `backend/`.
- Database: MySQL.
- The app is an inventory management system with products, categories, suppliers, customers, purchases, sales, quotations, billing notes, payment batches, dashboard summaries, and AI inventory assistant.

## Engineering Standards

- Keep changes scoped to the requested feature or bug.
- Prefer existing project patterns over new abstractions.
- Do not break current mock-data fallback behavior unless the task explicitly asks for it.
- Preserve user-facing workflows: create/edit/delete, status changes, eligibility filtering, and transaction detail views.
- Keep backend validation authoritative. Frontend validation is helpful, but direct API calls must still be safe.
- Do not silently remove existing data fields from serializers, API payloads, or frontend state.
- Avoid unrelated formatting churn in large files.

## Readability And Maintainability Standards

- Write code that future developers can read without needing hidden context from prior agent conversations.
- Prefer clear names for functions, variables, components, hooks, serializers, and query helpers.
- Keep functions focused on one responsibility. If a function grows hard to scan, extract named helpers that explain the workflow.
- Keep page components responsible for composition and user flow; move reusable data loading, formatting, validation, and mapping logic into hooks or utility modules.
- Avoid duplicating business rules across frontend files. Shared rules should live in one named helper or, when authoritative, in the backend.
- Keep files reasonably sized. When adding new behavior to a large file, first look for an existing focused module or create one with clear ownership.
- Use comments only to explain non-obvious business rules, edge cases, or safety constraints. Do not comment obvious code.
- Preserve behavior during refactors. Split files and rename helpers separately from feature changes whenever possible.
- Make API payload builders, data normalizers, and eligibility/filter logic explicit and easy to test.
- Do not hide important behavior in clever one-liners, deeply nested conditionals, or broad catch-all helpers.

## Backend Standards

- Use Django ORM filters and serializers instead of ad hoc data handling.
- Keep database behavior compatible with MySQL.
- Add or update tests for backend behavior that affects validation, filtering, pagination, or financial/stock calculations.
- Stock-changing rules must be enforced server-side.
- Billing note and payment batch eligibility should be enforced server-side when possible.
- Dashboard stock metrics should stay backend-calculated; do not reintroduce full purchase/sales startup loading for dashboard stock details.
- Production safety settings should not break local development defaults.

## Database And Normalization Standards

- The database is MySQL and should remain a relational, migration-managed Django schema.
- Prefer normalized relational tables and foreign keys for new durable data instead of adding new JSON blobs or duplicated text fields.
- Keep the current practical 3NF direction: master data lives in `Category`, `Product`, `Supplier`, and `Customer`; transactions reference master data through foreign keys; line items reference their parent transaction and product.
- Preserve transaction snapshot fields such as `supplier_name`, `customer_name`, `product_name`, `sku`, prices, totals, and tax amounts when they represent historical business documents. These fields are intentional audit snapshots and should not be removed just because a foreign key exists.
- Do not remove compatibility fields from serializers, API payloads, or frontend state in the same change that introduces normalization. Migrate callers first, then remove old fields in a separate explicit cleanup.
- `QuotationItem` is the normalized quotation line table and the database source of truth. The quotation API still exposes an `items` array for frontend compatibility, but that array must be built from `QuotationItem`, not from a JSON column on `Quotation`.
- Use data migrations for schema changes that need existing records backfilled. Do not rely on one-off shell commands for durable data migrations.
- When adding a new foreign key to existing data, make it nullable first, backfill it, update serializers/views/tests, and only make it required later if the workflow can guarantee it.
- Keep delete behavior deliberate:
  - Use `PROTECT` where deleting a referenced record would corrupt financial or audit history.
  - Use `SET_NULL` where historical snapshot fields keep the record readable after master data is removed.
  - Use `CASCADE` for owned child rows such as transaction line items and documents.
- Add indexes for fields used by list search, status filters, date filters, partner filters, and stock calculations. Avoid adding indexes that do not match an actual query pattern.
- Keep stock availability derived from purchase/sale item statuses in backend services. Do not store a mutable product stock number unless there is a dedicated reconciliation design.
- Development/mock operational data may be cleared with `clear_operational_data`; this must not delete master data or migrations.
- Seed data should respect relational links and stock/status rules. Do not seed packed/shipped/delivered sales that exceed available stock unless a test explicitly covers oversold legacy data.

## Frontend Standards

- Keep the UI consistent with the existing square, compact system style.
- Any new frontend update must match the current system UI: square 4px-radius controls/panels, compact spacing, restrained borders, and no decorative rounded-card or marketing-style treatment unless an existing shared component already uses it.
- Use existing shared classes before adding new CSS.
- Do not add marketing-style layouts or oversized decorative sections.
- Tables/directories should be readable, compact, and responsive.
- Category pages should show the full nested tree in one view; do not paginate the category tree.
- Flat directory/history pages can use pagination controls.
- Forms should preserve clear card boundaries and avoid overflowing content.
- Required form inputs must show the red required marker using the existing `required-label` pattern.
- The app is bilingual (English/Thai). Any new user-facing string must be added to both the `en` and `th` dictionaries in `frontend/src/i18n/translations.js` and rendered through the `t()` helper from `useLanguage()` — never hardcode display text in components. Thai strings must use standard inventory/accounting vocabulary.
- Do not add more feature logic into `App.jsx`, `ProductsPage.jsx`, or `styles.css` unless the task is explicitly to split or stabilize those files.
- Prefer extracting focused components/hooks/helpers before extending oversized page components.

## Pagination Conventions

- Backend pagination is opt-in. Existing unpaginated calls should still return arrays.
- Paginated responses use:
  - `count`
  - `next`
  - `previous`
  - `page`
  - `page_size`
  - `total_pages`
  - `results`
- Frontend keeps paginated display rows separate from full reference data when forms still need complete lists.
- Product, supplier, customer, purchase, sale, billing note, and payment batch pages may paginate.
- Category page should not paginate because the full hierarchy matters.

## API Filtering Conventions

- Common paginated params:
  - `page`
  - `page_size`
  - `search`
- Transaction and finance pages may use:
  - `status`
  - `date_from`
  - `date_to`
  - `supplier`
  - `customer`
- Product pages may use:
  - `category`
  - `stock_filter`
- Supplier/customer pages may use:
  - `profile_filter`

## Data Loading Conventions

- Avoid full startup loads for large transaction datasets.
- Use lookup endpoints for product, supplier, and customer form reference data.
- Use eligibility endpoints for billing note and payment batch create flows.
- Use paginated list endpoints for directory/history pages.
- Use on-demand product history loading when a user opens product transaction details.
- Keep backend stock validation authoritative. Frontend stock previews must not rely on partial paginated purchase/sales data as if it were complete.
- If a new page needs global totals, add a backend summary endpoint instead of loading all rows into the frontend.

## Verification Commands

Run relevant checks before finishing:

```bash
backend/.venv/bin/python backend/manage.py check
backend/.venv/bin/python backend/manage.py makemigrations --check --dry-run
backend/.venv/bin/python backend/manage.py test inventory
```

```bash
cd frontend
npm run build
npm audit --audit-level=moderate
```

If the frontend needs to be tried locally:

```bash
cd frontend
npm run dev -- --host 127.0.0.1
```

## Current Architecture Notes

- Backend pagination is implemented and opt-in.
- Backend lookup endpoints exist for products, suppliers, and customers.
- Backend eligibility endpoints exist for billing note sales and payment batch purchases.
- Search/filter database indexes exist for common product, transaction, finance, and partner filters.
- Dashboard stock report rows are calculated by the backend and include stock position, demand, purchase pipeline, and value fields.
- Product purchase/sales history is loaded on demand through the product history endpoint.
- Quotation line items are stored in `QuotationItem`; `Quotation` no longer has an `items` JSON database column. The quotation API still exposes an `items` array built from `QuotationItem`.
- `clear_operational_data` can clear purchases, sales, quotations, billing notes, payment batches, and transaction documents while preserving master data.
- Billing note and payment batch seed data are included in operational seed data.

## Current Improvement Direction

The maintainability refactor is progressing through oversized frontend files. Completed splits:

- `frontend/src/components/ProductsPage.jsx` — orchestration hook and validation helpers extracted
- `frontend/src/components/CategoryPage.jsx` — state hook and tree helpers extracted
- `frontend/src/components/CustomerPage.jsx` — state hook and filter helpers extracted
- `frontend/src/components/SupplierPage.jsx` — state hook and filter helpers extracted
- purchase/sales history edit forms & history pages (`PurchaseHistoryPage.jsx`) — state hooks and pure helpers extracted
- `frontend/src/components/quotation/QuotationForm.jsx` — state hook and helpers extracted
- `frontend/src/components/billing/BillingNoteDetailModal.jsx` — state hook (`useBillingNoteDetailState.js`) and pure calculations (`billingNoteDetailHelpers.js`) extracted
- `frontend/src/components/payments/PaymentBatchDetailModal.jsx` — state hook (`usePaymentBatchDetailState.js`) and pure calculations (`paymentBatchDetailHelpers.js`) extracted
- `frontend/src/components/suppliers/SupplierEditorModal.jsx` — section components extracted, reduced to composition shell
- `frontend/src/components/customers/CustomerEditorModal.jsx` — section components extracted, reduced to composition shell
- `frontend/src/App.jsx` — orchestration state hook (`useAppState.js`) extracted, reduced to layout composition shell

Remaining split targets by approximate size:

- `frontend/src/components/Dashboard.jsx` (367 lines)
- `frontend/src/styles.css`

Keep behavior unchanged while splitting. Extract small, named pieces with clear ownership instead of doing broad rewrites.
