# Frontend Refactor Handoff

## Goal
Reduce oversized frontend files for maintainability without changing behavior.

## Scope And Guardrails
- Keep existing create/edit/delete workflows unchanged.
- Keep backend-driven validation and eligibility behavior intact.
- Preserve mock-data fallback behavior.
- Keep all user-facing strings on `t()` and add new strings to both language dictionaries if needed.
- Prefer extracting focused hooks, helpers, and child components over adding more logic into large containers.
- Do not mix style rewrites into maintainability refactors.
- Preserve the current compact square UI system.

## Preferred Refactor Pattern
1. Inspect the target file and identify clear responsibility clusters.
2. Extract pure helpers first when possible.
3. Extract state/workflow logic into a focused hook if the container still owns too much.
4. Keep the main page or form as a composition/orchestration layer.
5. Preserve existing imports and public behavior where practical.
6. Run verification after each step.

## Verification
- `cd frontend && npm run build`

Optional broader checks from repo standards:
- `backend/.venv/bin/python backend/manage.py check`
- `backend/.venv/bin/python backend/manage.py makemigrations --check --dry-run`
- `backend/.venv/bin/python backend/manage.py test inventory`
- `cd frontend && npm audit --audit-level=moderate`

## Completed Refactor Areas
- `frontend/src/components/ProductsPage.jsx`
  - split into product-specific components, hooks, and helpers
  - default product seed data moved out
  - second-pass: orchestration extracted to `frontend/src/components/products/useProductsPageState.js` (402 lines)
  - save/delete/enable/disable validation extracted to `frontend/src/components/products/productsPageHelpers.js` (231 lines)
  - page reduced to 133-line composition shell
- `frontend/src/App.jsx`
  - action clusters moved into focused hooks
  - shell/layout and active-tab rendering extracted
  - chat and app message helpers extracted
- `frontend/src/components/QuotationPage.jsx`
  - form, detail modal, directory section, conversion flow, purchase wizard wrapper extracted
  - directory state moved into a dedicated hook
- `frontend/src/components/quotation/QuotationForm.jsx`
  - state/workflow extracted to `frontend/src/components/quotation/useQuotationFormState.js` (385 lines)
  - form reduced to 136-line composition shell
- `frontend/src/hooks/useAppTransactionActions.js`
  - split into domain-specific sub-hooks
  - now a 12-line barrel re-export orchestrator
- `frontend/src/hooks/useProductEditorState.js`
  - pure draft mutation helpers extracted to `frontend/src/hooks/productEditorStateHelpers.js` (265 lines)
  - hook stabilized at 310 lines
- `frontend/src/components/PurchaseHistoryPage.jsx`
  - edit form, directory section, helpers extracted
  - edit form state extracted to `frontend/src/components/purchases/usePurchaseEditFormState.js` (353 lines)
  - pure helpers extracted to `frontend/src/components/purchases/purchaseHistoryUtils.js` (385 lines)
- `frontend/src/components/SalesHistoryPage.jsx`
  - edit form, directory section, helpers extracted
  - directory state moved into a dedicated hook
  - edit form state extracted to `frontend/src/components/sales/useSalesEditFormState.js` (422 lines)
  - pure helpers extracted to `frontend/src/components/sales/salesHistoryUtils.js` (407 lines)
- `frontend/src/components/BillingNotePage.jsx`
  - create/detail flows, directory section, helpers, and directory state extracted
- `frontend/src/components/PaymentBatchPage.jsx`
  - create/detail flows, directory section, helpers, and directory state extracted
- `frontend/src/components/CreditNotePage.jsx`
  - create/detail flows, directory section, helpers, and directory state extracted
- `frontend/src/components/InventoryPage.jsx`
  - overview/reference UI extracted
  - directory state and directory section extracted
- `frontend/src/components/SalesForm.jsx`
  - split into section components
  - remaining state/workflow extracted to `frontend/src/components/sales/useSalesFormState.js`
  - second-pass pure helper extraction into `frontend/src/components/sales/salesFormStateHelpers.js`
- `frontend/src/components/PurchaseForm.jsx`
  - split into section components
  - remaining state/workflow extracted to `frontend/src/components/purchases/usePurchaseFormState.js`
  - second-pass pure helper extraction into `frontend/src/components/purchases/purchaseFormStateHelpers.js`
- `frontend/src/components/CategoryPage.jsx`
  - state/workflow extracted to `frontend/src/components/categories/useCategoryPageState.js` (388 lines)
  - tree/filter helpers extracted to `frontend/src/components/categories/categoryPageHelpers.js` (210 lines)
- `frontend/src/components/CustomerPage.jsx`
  - state/workflow extracted to `frontend/src/components/customers/useCustomerPageState.js` (347 lines)
  - filter helpers extracted to `frontend/src/components/customers/customerPageHelpers.js` (44 lines)
  - page reduced to 151-line composition shell
- `frontend/src/components/SupplierPage.jsx`
  - state/workflow extracted to `frontend/src/components/suppliers/useSupplierPageState.js` (343 lines)
  - filter helpers extracted to `frontend/src/components/suppliers/supplierPageHelpers.js` (46 lines)
  - page reduced to 146-line composition shell
- `frontend/src/components/quotation/quotationUtils.js`
  - decomposed into:
    - `frontend/src/components/quotation/quotationDateUtils.js`
    - `frontend/src/components/quotation/quotationValueUtils.js`
    - `frontend/src/components/quotation/quotationDirectoryUtils.js`
    - `frontend/src/components/quotation/quotationConversionUtils.js`
  - `quotationUtils.js` now acts as a thin barrel export
- Shared transaction/document components
  - `DocumentRefModal.jsx` reduced by extracting document body/config helpers
  - `TransactionDetailModal.jsx` reduced by extracting detail subcomponents
  - `ProductDetailModal.jsx` reduced by extracting profile/history/transaction subcomponents

## Current Best Next Targets
Current approximate sizes:
- `frontend/src/components/billing/BillingNoteDetailModal.jsx`: 413 lines
- `frontend/src/components/suppliers/SupplierEditorModal.jsx`: 398 lines
- `frontend/src/App.jsx`: 391 lines
- `frontend/src/components/Dashboard.jsx`: 367 lines
- `frontend/src/components/PurchaseHistoryPage.jsx`: 362 lines
- `frontend/src/components/customers/CustomerEditorModal.jsx`: 357 lines
- `frontend/src/components/payments/PaymentBatchDetailModal.jsx`: 346 lines

Recommended order:
1. `frontend/src/components/billing/BillingNoteDetailModal.jsx`
2. `frontend/src/components/suppliers/SupplierEditorModal.jsx` and `CustomerEditorModal.jsx` (symmetric pair)
3. `frontend/src/App.jsx`
4. `frontend/src/components/Dashboard.jsx`

## Target Notes

### 1. `frontend/src/components/billing/BillingNoteDetailModal.jsx`
Recommended outcome:
- extract billing note detail state into a dedicated hook
- extract pure calculation/formatting helpers if present
- keep the modal as a composition shell

### 2. `frontend/src/components/suppliers/SupplierEditorModal.jsx` / `CustomerEditorModal.jsx`
Recommended outcome:
- extract editor form state into hooks (symmetric pattern)
- extract contact validation helpers if not already shared through `contactValidation.js`
- keep modals as composition shells

### 3. `frontend/src/App.jsx`
Recommended outcome:
- identify remaining logic clusters beyond existing hook delegations
- extract any residual state management or side-effect logic
- keep App.jsx as a routing/layout orchestrator

### 4. `frontend/src/components/Dashboard.jsx`
Recommended outcome:
- extract dashboard data fetching/processing into a hook
- extract chart configuration or metric calculations into helpers
- keep the component as a layout shell

## Working Rules For Future Agents
- Favor low-risk extraction over broad rewrites.
- Keep file ownership clear: page/form as composition, hook as workflow, helper as pure logic.
- When splitting a utility file, prefer a barrel export if many existing imports already point to the original module.
- Do not remove compatibility exports in the same change unless all local consumers are updated and verified.
- Report resulting file sizes after each refactor step.
