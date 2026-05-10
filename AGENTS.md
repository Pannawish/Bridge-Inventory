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

## Backend Standards

- Use Django ORM filters and serializers instead of ad hoc data handling.
- Keep database behavior compatible with MySQL.
- Add or update tests for backend behavior that affects validation, filtering, pagination, or financial/stock calculations.
- Stock-changing rules must be enforced server-side.
- Billing note and payment batch eligibility should be enforced server-side when possible.
- Production safety settings should not break local development defaults.

## Frontend Standards

- Keep the UI consistent with the existing square, compact system style.
- Use existing shared classes before adding new CSS.
- Do not add marketing-style layouts or oversized decorative sections.
- Tables/directories should be readable, compact, and responsive.
- Category pages should show the full nested tree in one view; do not paginate the category tree.
- Flat directory/history pages can use pagination controls.
- Forms should preserve clear card boundaries and avoid overflowing content.

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

## Current Improvement Direction

After pagination, the next performance step is replacing full startup reference loads with smaller lookup and eligibility endpoints, especially for product/customer/supplier lookup and billing note/payment batch eligibility.
