# Codebase Analysis Summary

This summary was prepared from the current repository implementation before writing the report chapters.

## Frontend structure

- The frontend is a React 18 and Vite single-page application under [`../frontend/`](../frontend/).
- The application entry points are [`../frontend/src/main.jsx`](../frontend/src/main.jsx), [`../frontend/src/App.jsx`](../frontend/src/App.jsx), and the tab composition shell in [`../frontend/src/app/ActiveTabContent.jsx`](../frontend/src/app/ActiveTabContent.jsx).
- Main user-facing pages include Dashboard, Inventory, AI Chat, Purchases, Sales, Quotations, Billing Notes, Payment Batches, Credit Notes, Products, Categories, Suppliers, Customers, and Settings.
- Frontend data access is centralized in [`../frontend/src/api.js`](../frontend/src/api.js), which builds REST requests, attaches JWT bearer tokens when present, and retries requests after token refresh.
- Authentication state is managed in [`../frontend/src/auth/AuthContext.jsx`](../frontend/src/auth/AuthContext.jsx). The UI supports login, token refresh, logout, and a guest mode for frontend exploration.
- The application includes mock-data fallback behavior through [`../frontend/src/mockData.js`](../frontend/src/mockData.js) and data-loading helpers in [`../frontend/src/hooks/useInventoryData.js`](../frontend/src/hooks/useInventoryData.js).
- Bilingual English/Thai UI strings are stored in [`../frontend/src/i18n/translations.js`](../frontend/src/i18n/translations.js).

## Backend structure

- The backend is a Django and Django REST Framework application under [`../backend/`](../backend/).
- Django project settings are in [`../backend/config/settings.py`](../backend/config/settings.py), with MySQL configured as the database backend.
- API routes are registered in [`../backend/config/urls.py`](../backend/config/urls.py) and [`../backend/inventory/urls.py`](../backend/inventory/urls.py).
- Domain models are in [`../backend/inventory/models.py`](../backend/inventory/models.py), serializers and validation logic are in [`../backend/inventory/serializers.py`](../backend/inventory/serializers.py), API viewsets and function endpoints are in [`../backend/inventory/views.py`](../backend/inventory/views.py), and business calculations are in [`../backend/inventory/services.py`](../backend/inventory/services.py).
- Backend tests are located in [`../backend/inventory/tests.py`](../backend/inventory/tests.py).

## Database models

- Master data models: `Category`, `Supplier`, `Customer`, `Product`, `ProductPicture`, `ProductUnitConversion`, and `ProductSupplier`.
- Purchase workflow models: `Purchase`, `PurchaseItem`, and `PurchaseDocument`.
- Sales workflow models: `Sale`, `SaleItem`, `SaleItemAllocation`, and `SaleDocument`.
- Quotation models: `Quotation`, `QuotationItem`, and `QuotationItemSupplier`.
- Finance models: `BillingNote`, `BillingNoteLine`, `PaymentBatch`, `PaymentBatchLine`, `CreditNote`, and `CreditNoteLine`.
- The schema uses relational foreign keys for durable business links and snapshot fields such as partner names, product names, SKUs, prices, totals, and tax amounts for historical audit readability.

## API endpoints

- Authentication endpoints: `/api/auth/login/`, `/api/auth/refresh/`, and `/api/auth/me/`.
- Dashboard endpoints: `/api/dashboard/` and `/api/dashboard/segment/`.
- Lookup endpoints: `/api/lookups/products/`, `/api/lookups/suppliers/`, and `/api/lookups/customers/`.
- Product detail endpoints: `/api/products/<product_id>/history/` and `/api/products/<product_id>/stock-layers/`.
- Eligibility endpoints: `/api/eligibility/billing-note-sales/`, `/api/eligibility/payment-batch-purchases/`, and `/api/eligibility/credit-note-sales/`.
- AI chat endpoint: `/api/chat/`.
- REST viewset endpoints are registered for categories, suppliers, product-suppliers, customers, products, purchases, sales, quotations, billing-notes, payment-batches, and credit-notes.

## Main business workflows

- Master data is maintained through category, product, supplier, and customer screens.
- Purchases record supplier orders and received purchase line items. Received purchase items become available stock layers.
- Sales record customer orders and fulfillment statuses. Stock is deducted only when sale items reach packed, shipped, or delivered statuses.
- FIFO stock allocation is performed server-side from received purchase layers. Manual allocation is also supported through sale item allocation payloads.
- Quotations can store line items, supplier options, validity dates, and links to derived purchases or sales.
- Billing notes group eligible shipped or delivered sales for receivables tracking.
- Payment batches group eligible received purchases for payables tracking.
- Credit notes are generated from cancelled or returned sale lines that have not already been credited.
- Dashboard and inventory pages summarize stock position, demand, purchase pipeline, receivables, payables, cashflow, product trends, and order coverage.
- The AI inventory assistant is a read-only text helper for a limited set of workflows: stock and fulfillment, customer or supplier summaries, receivables/payables and exceptions, and reference or line-item lookup.

## Implemented features

- React tabbed SPA with compact inventory UI.
- English/Thai translation infrastructure.
- Login, JWT refresh, and guest exploration mode.
- Master-data CRUD for products, categories, suppliers, and customers.
- Product media uploads, selected product picture support, unit conversions, active/disabled products, and product supplier links.
- Purchase and sales transaction creation, editing, deletion, document uploads, status updates, and line item status behavior.
- Server-side stock validation and FIFO stock layer allocation for stock-deducting sales.
- Quotation storage through normalized quotation line item tables and supplier option rows.
- Billing note, payment batch, and credit note workflows with eligibility endpoints.
- Opt-in backend pagination for list endpoints while preserving unpaginated array responses when no page parameter is supplied.
- Dashboard, segmented dashboard data, product history, and stock layer endpoints.
- Backend tests for pagination, uploads, stock validation, allocation, status synchronization, relational normalization, reference numbering, eligibility, credit notes, seed/reset commands, payable syncing, quotation supplier options, and chat alignment.

## Missing or unclear parts

- The codebase does not show implemented Economic Order Quantity, Z-score, or full P-system calculation modules. Reorder-level and stock health behavior are implemented, but formulas beyond the implemented stock and dashboard logic should be verified before claiming them as finished.
- The codebase does not show a complete audit log model for every document status change. Status history may be visible through current records and links, but a dedicated activity log was not identified.
- The report should not claim live production performance, high-volume concurrency validation, or user-study results unless those experiments are added later.
- Screenshots exist in [`../docs/screenshots/`](../docs/screenshots/), but the final report should confirm which screenshots are approved for inclusion.
- Supervisor, committee, university-specific details, final timeline dates, and final objective wording should be reviewed by the project authors.
