# Inventory Management Project Standards

This file is for coding agents working in this repository. Follow these rules before changing code.

## Project Shape

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

## Frontend Standards

- Keep the UI consistent with the existing square, compact system style.
- Use existing shared classes before adding new CSS.
- Do not add marketing-style layouts or oversized decorative sections.
- Tables/directories should be readable, compact, and responsive.
- Category pages should show the full nested tree in one view; do not paginate the category tree.
- Flat directory/history pages can use pagination controls.
- Forms should preserve clear card boundaries and avoid overflowing content.
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
- Billing note and payment batch seed data are included in operational seed data.

## Current Improvement Direction

The next major maintainability step is splitting oversized frontend files. Start with:

- `frontend/src/components/ProductsPage.jsx`
- `frontend/src/App.jsx`
- `frontend/src/styles.css`
- purchase/sales history forms and shared transaction-detail UI

Keep behavior unchanged while splitting. Extract small, named pieces with clear ownership instead of doing broad rewrites.
