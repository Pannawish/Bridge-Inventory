# Frontend Map

This document explains where frontend behavior lives and how the React app talks
to the backend.

Related docs:

- [Codebase Study Guide](../codebase-study-guide.md)
- [Backend Map](./backend-map.md)
- [Frontend Refactor Handoff](./frontend-refactor-handoff.md)

## Frontend Layers

The frontend is a React + Vite app under [frontend/src/](../../frontend/src/).

Runtime path:

1. [main.jsx](../../frontend/src/main.jsx) mounts the React app.
2. [App.jsx](../../frontend/src/App.jsx) wires top-level providers and shell state.
3. [app/AppShell.jsx](../../frontend/src/app/AppShell.jsx) renders navigation, layout, and active content.
4. [app/ActiveTabContent.jsx](../../frontend/src/app/ActiveTabContent.jsx) chooses the current page component.
5. Page components compose focused section components and hooks.
6. Hooks call [api.js](../../frontend/src/api.js), which talks to the Django API.

## App Shell And State

- [app/useAppState.js](../../frontend/src/app/useAppState.js): top-level orchestration for tabs, data refresh, cross-page actions, chat, reports, and notices
- [hooks/useInventoryData.js](../../frontend/src/hooks/useInventoryData.js): initial data loading, paginated loaders, eligibility loaders, and mock fallback
- [app/tabs.js](../../frontend/src/app/tabs.js): navigation tab definitions
- [auth/AuthContext.jsx](../../frontend/src/auth/AuthContext.jsx): login state and current user profile
- [auth/permissions.js](../../frontend/src/auth/permissions.js): frontend permission checks for navigation and actions

Keep page-specific rules out of `useAppState.js` when possible. A page hook or
domain helper is easier to study and test mentally.

## API And Data Loading

- [api.js](../../frontend/src/api.js) owns base URL handling, token attachment, token refresh, query string serialization, and HTTP errors.
- [hooks/useInventoryData.js](../../frontend/src/hooks/useInventoryData.js) owns the app's main collections and paginated row state.
- [hooks/inventoryDataHelpers.js](../../frontend/src/hooks/inventoryDataHelpers.js) owns initial load, mock fallback, and local filtering helpers.
- [hooks/inventoryDataSetters.js](../../frontend/src/hooks/inventoryDataSetters.js) keeps setter wiring out of the main hook.

Important idea: paginated rows and complete lookup collections are separate.
Directory pages can use paginated data, while forms need complete product,
supplier, or customer lookup lists.

## Page Pattern

Most major pages follow this shape:

1. A top-level page component composes the screen.
2. A `use...State` hook owns user interaction and derived state.
3. Helper modules contain payload building, filtering, validation, and mapping.
4. Section components render compact parts of the form or directory.
5. API save/load functions come from app-level action hooks or props.

Example sale create flow:

- [components/SalesForm.jsx](../../frontend/src/components/SalesForm.jsx)
- [components/sales/useSalesFormState.js](../../frontend/src/components/sales/useSalesFormState.js)
- [components/sales/salesFormStateHelpers.js](../../frontend/src/components/sales/salesFormStateHelpers.js)
- [components/sales/SalesLineItemsSection.jsx](../../frontend/src/components/sales/SalesLineItemsSection.jsx)
- [saleStock.js](../../frontend/src/saleStock.js)
- [api.js](../../frontend/src/api.js)

## Domain Map

### Master Data

- Products: [ProductsPage.jsx](../../frontend/src/components/ProductsPage.jsx), [components/products/](../../frontend/src/components/products/)
- Categories: [CategoryPage.jsx](../../frontend/src/components/CategoryPage.jsx), [components/categories/](../../frontend/src/components/categories/)
- Suppliers: [SupplierPage.jsx](../../frontend/src/components/SupplierPage.jsx), [components/suppliers/](../../frontend/src/components/suppliers/)
- Customers: [CustomerPage.jsx](../../frontend/src/components/CustomerPage.jsx), [components/customers/](../../frontend/src/components/customers/)
- Shared partner layout: [components/partners/](../../frontend/src/components/partners/)

### Transactions

- Purchases: [PurchaseForm.jsx](../../frontend/src/components/PurchaseForm.jsx), [PurchaseHistoryPage.jsx](../../frontend/src/components/PurchaseHistoryPage.jsx), [components/purchases/](../../frontend/src/components/purchases/)
- Sales: [SalesForm.jsx](../../frontend/src/components/SalesForm.jsx), [SalesHistoryPage.jsx](../../frontend/src/components/SalesHistoryPage.jsx), [components/sales/](../../frontend/src/components/sales/)
- Quotations: [QuotationPage.jsx](../../frontend/src/components/QuotationPage.jsx), [components/quotation/](../../frontend/src/components/quotation/)
- Shared transaction display: [components/transactions/](../../frontend/src/components/transactions/)
- Printable documents: [components/documentRefs/](../../frontend/src/components/documentRefs/)

### Finance

- Billing notes: [BillingNotePage.jsx](../../frontend/src/components/BillingNotePage.jsx), [components/billing/](../../frontend/src/components/billing/)
- Payment batches: [PaymentBatchPage.jsx](../../frontend/src/components/PaymentBatchPage.jsx), [components/payments/](../../frontend/src/components/payments/)
- Credit notes: [CreditNotePage.jsx](../../frontend/src/components/CreditNotePage.jsx), [components/credits/](../../frontend/src/components/credits/)

### Dashboard, Inventory, AI, And Admin

- Dashboard: [Dashboard.jsx](../../frontend/src/components/Dashboard.jsx)
- Inventory control: [InventoryPage.jsx](../../frontend/src/components/InventoryPage.jsx), [components/inventory/](../../frontend/src/components/inventory/)
- AI chat: [ChatPanel.jsx](../../frontend/src/components/ChatPanel.jsx), [components/chat/](../../frontend/src/components/chat/)
- AI reports: [AiReportPage.jsx](../../frontend/src/components/AiReportPage.jsx)
- User access: [components/admin/](../../frontend/src/components/admin/)

## Shared Helpers

- [format.js](../../frontend/src/format.js): dates, money, locale, payment date formatting
- [unitConversion.js](../../frontend/src/unitConversion.js): product units and base quantity calculations
- [purchaseStatus.js](../../frontend/src/purchaseStatus.js): purchase status derivation
- [saleStatus.js](../../frontend/src/saleStatus.js): sale status derivation
- [saleStock.js](../../frontend/src/saleStock.js): frontend stock preview calculations
- [components/transactionDiscounts.js](../../frontend/src/components/transactionDiscounts.js): item and bill discount helpers
- [components/contactValidation.js](../../frontend/src/components/contactValidation.js): partner contact validation

Frontend stock calculations are previews for user feedback. The backend repeats
stock validation and remains authoritative.

## Mock Fallback

Mock fallback exists so the app can still be explored without a fully available
backend.

Important files:

- [mockData.js](../../frontend/src/mockData.js)
- [hooks/inventoryDataHelpers.js](../../frontend/src/hooks/inventoryDataHelpers.js)
- [app/mockGuestHandlers.js](../../frontend/src/app/mockGuestHandlers.js)

When studying a page, check whether it reads paginated backend rows, complete
lookup data, or mock fallback rows. That explains why some hooks keep both
`products` and `productRows`, or both `sales` and `saleRows`.

## Internationalization

- [i18n/LanguageContext.jsx](../../frontend/src/i18n/LanguageContext.jsx) provides `useLanguage()`.
- [i18n/translations.js](../../frontend/src/i18n/translations.js) stores English and Thai strings.
- [i18n/statusLabels.js](../../frontend/src/i18n/statusLabels.js) centralizes translated status labels.

New user-facing strings should go through `t()` and be added to both language
dictionaries.

## How To Trace A Button Click

Use this process when studying a frontend action:

1. Start at the visible page component.
2. Find the section component that renders the button.
3. Find the handler passed into that section.
4. Follow the handler into the page hook or app action hook.
5. Find the payload builder helper.
6. Find the matching method in [api.js](../../frontend/src/api.js).
7. Jump to the matching backend route in [backend/inventory/urls.py](../../backend/inventory/urls.py).

This path keeps UI layout, frontend state, API payloads, and backend validation
connected in your head.
