# Codebase Study Guide

This guide is for studying Bridge Inventory after the project is mostly
complete. Use it as a reading path, not as a replacement for reading the code.

For exact business behavior, read [Business Rules Reference](./business/business-rules-reference.md).
For the operational story, read [Workflow Reference](./business/workflow-reference.md).
For source ownership maps, use [Backend Map](./architecture/backend-map.md) and
[Frontend Map](./architecture/frontend-map.md).

## How To Study This Project

Do not read every file alphabetically. Follow one business workflow and trace it
through the backend, frontend, and tests.

Recommended order:

1. Master data: categories, products, suppliers, customers
2. Purchase workflow: incoming stock and payable totals
3. Sale workflow: stock validation and allocation
4. Quotation workflow: proposal lines and conversion into purchase/sale
5. Finance workflow: billing notes, payment batches, credit notes
6. Dashboard, AI chat, and AI reports
7. Login, permissions, and activity logs

## First Pass: Understand The System Shape

Start with these files:

- [backend/inventory/models.py](../backend/inventory/models.py): database shape
- [backend/inventory/urls.py](../backend/inventory/urls.py): API routes
- [frontend/src/api.js](../frontend/src/api.js): frontend API client
- [frontend/src/hooks/useInventoryData.js](../frontend/src/hooks/useInventoryData.js): data loading and mock fallback
- [frontend/src/app/useAppState.js](../frontend/src/app/useAppState.js): app-level orchestration

Goal for the first pass: understand what records exist and how the frontend
talks to the backend. Do not try to understand every field yet.

## Second Pass: Trace One Save Flow

Use sale creation because it touches the most important ideas.

Backend route:

1. [backend/inventory/urls.py](../backend/inventory/urls.py)
2. [backend/inventory/views/transactions.py](../backend/inventory/views/transactions.py)
3. [backend/inventory/serializers/transactions.py](../backend/inventory/serializers/transactions.py)
4. [backend/inventory/services/transactions.py](../backend/inventory/services/transactions.py)
5. [backend/inventory/services/stock.py](../backend/inventory/services/stock.py)

Frontend route:

1. [frontend/src/components/SalesForm.jsx](../frontend/src/components/SalesForm.jsx)
2. [frontend/src/components/sales/useSalesFormState.js](../frontend/src/components/sales/useSalesFormState.js)
3. [frontend/src/components/sales/salesFormStateHelpers.js](../frontend/src/components/sales/salesFormStateHelpers.js)
4. [frontend/src/saleStock.js](../frontend/src/saleStock.js)
5. [frontend/src/api.js](../frontend/src/api.js)

Question to answer while studying: what happens when a sale moves from `draft`
to `packed`?

## Third Pass: Study The Business Rules

Focus on these rules because they explain why the code is shaped this way:

- Stock is derived from purchase and sale line statuses.
- Backend validation is authoritative.
- Transaction records keep historical snapshot fields.
- Quotations do not reserve or deduct stock.
- Billing notes and payment batches use server-side eligibility endpoints.
- Paid payment batch lines are frozen as financial history.

Primary code references:

- [backend/inventory/services/stock.py](../backend/inventory/services/stock.py)
- [backend/inventory/services/transactions.py](../backend/inventory/services/transactions.py)
- [backend/inventory/serializers/finance.py](../backend/inventory/serializers/finance.py)
- [frontend/src/saleStock.js](../frontend/src/saleStock.js)

## Study Paths By Workflow

### Product And Master Data

- Backend: [models.py](../backend/inventory/models.py), [views/master_data.py](../backend/inventory/views/master_data.py), [serializers/master_data.py](../backend/inventory/serializers/master_data.py)
- Frontend: [ProductsPage.jsx](../frontend/src/components/ProductsPage.jsx), [useProductsPageState.js](../frontend/src/components/products/useProductsPageState.js), [useProductEditorState.js](../frontend/src/hooks/useProductEditorState.js)
- Key idea: products are master data, but stock is not a typed product field.

### Purchase

- Backend: [views/transactions.py](../backend/inventory/views/transactions.py), [serializers/transactions.py](../backend/inventory/serializers/transactions.py), [services/transactions.py](../backend/inventory/services/transactions.py)
- Frontend: [PurchaseForm.jsx](../frontend/src/components/PurchaseForm.jsx), [usePurchaseFormState.js](../frontend/src/components/purchases/usePurchaseFormState.js), [usePurchaseHistoryPageState.js](../frontend/src/components/purchases/usePurchaseHistoryPageState.js)
- Key idea: received purchase lines create stock layers and payable totals.

### Sale

- Backend: [serializers/transactions.py](../backend/inventory/serializers/transactions.py), [services/stock.py](../backend/inventory/services/stock.py)
- Frontend: [SalesForm.jsx](../frontend/src/components/SalesForm.jsx), [useSalesFormState.js](../frontend/src/components/sales/useSalesFormState.js), [useSalesEditFormState.js](../frontend/src/components/sales/useSalesEditFormState.js)
- Key idea: packed, shipped, and delivered sale lines commit stock.

### Quotation

- Backend: [serializers/transactions.py](../backend/inventory/serializers/transactions.py)
- Frontend: [QuotationPage.jsx](../frontend/src/components/QuotationPage.jsx), [QuotationForm.jsx](../frontend/src/components/quotation/QuotationForm.jsx), [useQuotationFormState.js](../frontend/src/components/quotation/useQuotationFormState.js)
- Key idea: quotations expose an `items` array but persist normalized line rows.

### Billing Notes And Payment Batches

- Backend: [views/finance.py](../backend/inventory/views/finance.py), [serializers/finance.py](../backend/inventory/serializers/finance.py)
- Frontend: [BillingNotePage.jsx](../frontend/src/components/BillingNotePage.jsx), [PaymentBatchPage.jsx](../frontend/src/components/PaymentBatchPage.jsx), [useInventoryData.js](../frontend/src/hooks/useInventoryData.js)
- Key idea: create flows use eligibility endpoints instead of loading and filtering every transaction in the browser.

### Dashboard, AI Chat, And AI Reports

- Backend: [services/dashboard.py](../backend/inventory/services/dashboard.py), [services/chat.py](../backend/inventory/services/chat.py), [ai_reports.py](../backend/inventory/ai_reports.py)
- Frontend: [Dashboard.jsx](../frontend/src/components/Dashboard.jsx), [ChatPanel.jsx](../frontend/src/components/ChatPanel.jsx), [AiReportPage.jsx](../frontend/src/components/AiReportPage.jsx)
- Key idea: dashboard and AI outputs should be based on backend-prepared facts.

### Access Control

- Backend: [auth_views.py](../backend/inventory/auth_views.py), [permissions.py](../backend/inventory/permissions.py), [access_control.py](../backend/inventory/access_control.py), [views/access.py](../backend/inventory/views/access.py)
- Frontend: [AuthContext.jsx](../frontend/src/auth/AuthContext.jsx), [permissions.js](../frontend/src/auth/permissions.js), [UserAccessPage.jsx](../frontend/src/components/admin/UserAccessPage.jsx), [ActivityLogPage.jsx](../frontend/src/components/admin/ActivityLogPage.jsx)
- Key idea: frontend navigation hiding is only usability. Backend permissions are the safety layer.

## Hardest Parts

Study these slowly:

- FIFO/manual sale allocation in [services/stock.py](../backend/inventory/services/stock.py)
- Sale create/edit state in [useSalesFormState.js](../frontend/src/components/sales/useSalesFormState.js) and [useSalesEditFormState.js](../frontend/src/components/sales/useSalesEditFormState.js)
- Purchase payable syncing in [services/transactions.py](../backend/inventory/services/transactions.py)
- Billing/payment grouping in [serializers/finance.py](../backend/inventory/serializers/finance.py)
- Dashboard stock metrics in [services/dashboard.py](../backend/inventory/services/dashboard.py)
- App data orchestration in [useInventoryData.js](../frontend/src/hooks/useInventoryData.js) and [useAppState.js](../frontend/src/app/useAppState.js)

## How To Read A Feature Change

When you want to understand or modify a feature, use this checklist:

1. Find the route in [backend/inventory/urls.py](../backend/inventory/urls.py).
2. Find the view module under [backend/inventory/views/](../backend/inventory/views/).
3. Find the serializer module under [backend/inventory/serializers/](../backend/inventory/serializers/).
4. Check whether shared rules live under [backend/inventory/services/](../backend/inventory/services/).
5. Find the frontend API call in [frontend/src/api.js](../frontend/src/api.js).
6. Find the page hook or form hook that builds the payload.
7. Check [backend/inventory/tests.py](../backend/inventory/tests.py) for expected behavior.

This path keeps you from guessing where a rule lives.
