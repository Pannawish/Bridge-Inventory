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
- `frontend/src/App.jsx`
  - action clusters moved into focused hooks
  - shell/layout and active-tab rendering extracted
  - chat and app message helpers extracted
- `frontend/src/components/QuotationPage.jsx`
  - form, detail modal, directory section, conversion flow, purchase wizard wrapper extracted
  - directory state moved into a dedicated hook
- `frontend/src/components/PurchaseHistoryPage.jsx`
  - edit form, directory section, helpers extracted
- `frontend/src/components/SalesHistoryPage.jsx`
  - edit form, directory section, helpers extracted
  - directory state moved into a dedicated hook
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
- `frontend/src/components/quotation/QuotationForm.jsx`: 484 lines
- `frontend/src/hooks/useAppTransactionActions.js`: 483 lines
- `frontend/src/hooks/useProductEditorState.js`: 471 lines

Recommended order:
1. `frontend/src/components/quotation/QuotationForm.jsx`
2. `frontend/src/hooks/useAppTransactionActions.js`
3. `frontend/src/hooks/useProductEditorState.js`

## Target Notes

### 1. `frontend/src/components/quotation/QuotationForm.jsx`
Recommended outcome:
- keep `QuotationForm.jsx` as a thin composition component
- extract remaining state/workflow into `frontend/src/components/quotation/useQuotationFormState.js`
- if needed, extract pure mutation/payload logic into `frontend/src/components/quotation/quotationFormStateHelpers.js`

Likely clusters:
- quotation form state and validation
- valid-until day logic
- product filtering/search helpers
- supplier option mutations
- item mutation handlers
- submit/payload building

Behavior to preserve:
- edit/create flow
- product filtering behavior
- supplier option management
- VAT calculations
- valid-until date behavior

### 2. `frontend/src/hooks/useAppTransactionActions.js`
Recommended outcome:
- split purchase flow helpers from sales flow helpers
- move pure payload/status/normalization logic into helper modules
- keep the hook as orchestration for app-level callbacks and prompt triggers

Likely clusters:
- purchase create/update/delete/status behavior
- sale create/update/delete/status behavior
- stock-draft normalization
- credit-note prompt triggering

### 3. `frontend/src/hooks/useProductEditorState.js`
Recommended outcome:
- keep the hook public API stable
- extract pure draft mutation helpers into a sibling helper module

Likely clusters:
- draft picture state
- sub-name mutations
- unit conversion mutations
- category combobox/query state helpers
- SKU lock/unlock behavior

## Working Rules For Future Agents
- Favor low-risk extraction over broad rewrites.
- Keep file ownership clear: page/form as composition, hook as workflow, helper as pure logic.
- When splitting a utility file, prefer a barrel export if many existing imports already point to the original module.
- Do not remove compatibility exports in the same change unless all local consumers are updated and verified.
- Report resulting file sizes after each refactor step.
