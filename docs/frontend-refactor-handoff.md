# Frontend Refactor Handoff

## Purpose

This document is the working handoff for future frontend maintainability refactoring in this repository. It defines the current architectural baseline, the rules for safe refactors, the preferred extraction patterns, and the practical backlog for the next rounds of work.

The goal is not broad redesign. The goal is to keep the inventory system behavior stable while continuing to reduce file complexity, clarify ownership, and make future feature work safer.

## Scope

This handoff applies to maintainability refactors in `frontend/` only.

It does not authorize:

- product behavior changes
- API contract changes
- visual redesign
- translation rewrites
- CSS system replacement
- mock-data fallback removal

## Current Baseline

The frontend has already moved away from a monolithic page structure.

Current architecture patterns in active use:

- Thin composition shells for major pages and modals
- Focused orchestration hooks for state, effects, and async workflows
- Pure helper modules for calculations, formatting, filtering, and payload shaping
- Section-level components for large forms and directory tables
- Split CSS entrypoint, with `frontend/src/styles.css` now limited to stylesheet imports

Examples of refactors already completed:

- `frontend/src/App.jsx` now delegates orchestration to `frontend/src/app/useAppState.js`
- `frontend/src/components/ProductsPage.jsx` delegates state and helper logic to `frontend/src/components/products/`
- `frontend/src/components/CategoryPage.jsx`, `CustomerPage.jsx`, and `SupplierPage.jsx` follow the same split pattern
- purchase, sales, and quotation forms now use dedicated state hooks plus section components
- billing note and payment batch detail modals already extract state and helper logic into dedicated files

This means future refactors should extend the existing modular structure, not introduce a new architecture.

## Refactor Objectives

Every future frontend refactor should improve at least one of these outcomes:

- reduce file size and cognitive load in oversized components or hooks
- separate rendering from workflow orchestration
- isolate reusable business rules into named helpers
- make forms and directory pages easier to test and extend
- reduce duplication across adjacent inventory, finance, and transaction flows

If a proposed refactor does not materially improve one of those outcomes, it should probably not be done.

## Non-Negotiable Guardrails

- Preserve existing create, edit, delete, status-change, filtering, and detail-view workflows.
- Keep backend validation authoritative.
- Do not break mock-data fallback behavior unless the task explicitly requires it.
- Keep all user-facing strings in `frontend/src/i18n/translations.js` and render them through `t()`.
- Keep the current compact UI system: square controls, restrained spacing, and existing shared classes.
- Do not add new feature logic into `frontend/src/App.jsx`, `frontend/src/components/ProductsPage.jsx`, or `frontend/src/styles.css` unless the task is explicitly to stabilize or split those files.
- Avoid mixing maintainability refactors with unrelated visual, behavioral, or API changes.

## Preferred Frontend Shape

Use the existing three-part separation pattern when a file is large enough to justify extraction.

### 1. Composition Shell

Typical file: `Component.jsx`

Responsibilities:

- render layout and structure
- connect props to section components
- consume a custom state hook

Should avoid:

- large inline calculations
- complex async logic
- multi-branch workflow handlers
- direct data normalization logic

### 2. Orchestration Hook

Typical file: `useComponentState.js`

Responsibilities:

- own React state and effects
- coordinate API calls
- prepare view-ready values
- expose action handlers to the shell

Should avoid:

- large JSX fragments
- buried pure utility logic that should live in helpers
- unrelated cross-domain behavior

### 3. Pure Helpers or Utilities

Typical file: `componentHelpers.js`, `componentUtils.js`, `componentStateHelpers.js`

Responsibilities:

- calculations
- filtering
- normalization
- payload shaping
- validation helpers
- presentational formatting that does not require React

Rules:

- no React imports
- no side effects
- no hidden mutation unless the helper name makes mutation explicit

## How To Choose The Next Refactor Target

Prioritize files using this order:

1. High-complexity state hooks that now carry too many workflows
2. Large components that still mix rendering and business logic
3. Repeated utility logic that exists in multiple transaction domains
4. Large directory or modal components that would benefit from section extraction
5. Large CSS modules only when there is clear ownership to split, not cosmetic churn

Do not prioritize a file only because it has a high line count. Some large files are data-heavy by nature and may not benefit from decomposition without a clear ownership boundary.

## Current Priority Backlog

This backlog reflects the frontend structure as of May 26, 2026.

### Priority 1: Remaining Mixed Dashboard Component

- `frontend/src/components/Dashboard.jsx`

Why it is next:

- It still combines rendering, formatting helpers, async segment loading, and dashboard-specific subcomponents in one file.
- It is the clearest remaining example of a page-level component that has not fully adopted the established shell and hook pattern.

Recommended direction:

- extract `useDashboardState.js` for period state, loading flags, and segment-fetch orchestration
- extract `dashboardHelpers.js` for formatting, metrics shaping, and chart-ready transforms
- keep `Dashboard.jsx` focused on composition of cards, trend sections, and summary layout

### Priority 2: High-Complexity Orchestration Hooks

- `frontend/src/app/useAppState.js`
- `frontend/src/components/sales/useSalesFormState.js`
- `frontend/src/components/sales/useSalesEditFormState.js`
- `frontend/src/components/products/useProductsPageState.js`
- `frontend/src/components/categories/useCategoryPageState.js`
- `frontend/src/components/quotation/useQuotationFormState.js`
- `frontend/src/components/purchases/usePurchaseEditFormState.js`
- `frontend/src/components/purchases/usePurchaseFormState.js`
- `frontend/src/components/purchases/usePurchaseHistoryPageState.js`

Why these matter:

- They already follow the right direction, but several are becoming orchestration hubs with too many responsibilities.
- The risk is not that they are "wrong". The risk is that future features will pile into them and recreate monoliths one layer deeper.

Recommended direction:

- split workflow-specific logic into smaller local helpers
- extract repeated line-item operations, status transforms, and draft builders into dedicated modules
- keep each hook as the coordinator, not the implementation site for every rule

### Priority 3: Large Section and Directory Components

- `frontend/src/components/transactions/TransactionDetailItemsSection.jsx`
- `frontend/src/components/quotation/QuotationDirectorySection.jsx`
- `frontend/src/components/sales/SalesLineItemsSection.jsx`
- `frontend/src/components/credits/CreditNoteDirectorySection.jsx`
- `frontend/src/components/payments/CreatePaymentBatchModal.jsx`
- `frontend/src/components/payments/PaymentBatchDirectorySection.jsx`

Why these matter:

- These files are likely to attract incremental UI conditions, formatting rules, and eligibility display logic.
- They are good candidates for subcomponent extraction if future feature work lands there.

Recommended direction:

- extract table row renderers, summary blocks, filter controls, or repeated field groups only when a real boundary exists
- avoid premature fragmentation when the file is still readable end to end

## Files That Are Not Good Generic Refactor Targets

Refactor these only with explicit justification:

- `frontend/src/i18n/translations.js`
- `frontend/src/mockData.js`
- stylesheet modules that are large because they intentionally own a visual domain

These files are large for structural reasons. They should not be split casually during routine maintainability work.

## Standard Refactor Workflow

### 1. Inspect Before Editing

- map current responsibilities in the target file
- identify render logic, state orchestration, and pure business logic
- note any coupling to translations, mock fallbacks, pagination, or transaction status rules

### 2. Define The Smallest Safe Extraction

- choose one clear ownership boundary
- prefer one focused extraction over a broad rewrite
- keep names literal and domain-specific

Good examples:

- `useDashboardState.js`
- `salesLineItemHelpers.js`
- `transactionDetailFormatting.js`

Avoid vague names such as:

- `utils.js`
- `helpers.js`
- `common.js`

### 3. Move Pure Logic First

- extract calculations, filters, payload builders, and formatting helpers before moving React workflow code
- keep helper inputs and outputs explicit
- do not bury business rules inside inline array chains if a named helper would be clearer

### 4. Extract Orchestration Second

- move state, effects, and async flows into a hook only when that hook has a clear owner
- return a predictable, documented surface to the component
- avoid returning a grab-bag of loosely related values if a small nested domain object improves clarity

### 5. Reduce The Shell Last

- keep the component as a readable composition layer
- remove dead imports and dead handlers
- make prop names line up with the vocabulary already used in adjacent modules

## Refactor Acceptance Criteria

A frontend maintainability refactor is acceptable only if all of the following are true:

- user-visible behavior is unchanged unless the task explicitly includes a behavior fix
- translations still resolve through `t()`
- mock fallback flows still work where they worked before
- the new file boundaries are easier to understand than the old one
- no important business rule is duplicated across multiple new files without reason
- the target file is meaningfully simpler after the change

## Verification Requirements

Run relevant checks after completing refactor work:

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

If the refactor touches behavior that is hard to validate from build output alone, also run the frontend locally and exercise the affected workflow.

```bash
cd frontend
npm run dev -- --host 127.0.0.1
```

## Expected Deliverable For Future Refactor PRs

Each future refactor should leave behind:

- a smaller, clearer primary file
- well-named extracted modules with obvious ownership
- no hidden behavior changes
- concise notes on what moved and why
- verification results or a clear statement of what could not be run

## Handoff Summary

The frontend no longer needs a broad architectural reset. The remaining work is targeted decomposition: finish the Dashboard split, prevent large state hooks from turning into new monoliths, and keep extracting repeated transaction logic into explicit local modules as new changes arrive.

That is the standard for future refactoring in this codebase.
