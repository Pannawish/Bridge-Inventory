# Codebase Structure

This document shows the current source structure of the project.

Scope notes:

- Includes tracked source files and project docs
- Excludes generated or local-runtime directories such as `.git/`, `.venv/`, `backend/.venv/`, `frontend/node_modules/`, `frontend/dist/`, and `backend/media/`
- Intended as a navigation reference for contributors and maintainers

## Top Level

```text
.
├── AGENTS.md
├── HANDOUT.md
├── LICENSE
├── README.md
├── backend/
├── blackbook/
├── docs/
├── frontend/
└── netlify.toml
```

## Backend

```text
backend/
├── .env.example
├── README.md
├── config/
│   ├── __init__.py
│   ├── asgi.py
│   ├── settings.py
│   ├── urls.py
│   └── wsgi.py
├── inventory/
│   ├── __init__.py
│   ├── admin.py
│   ├── apps.py
│   ├── management/
│   │   ├── __init__.py
│   │   └── commands/
│   │       ├── __init__.py
│   │       ├── clear_operational_data.py
│   │       └── seed_operational_data.py
│   ├── migrations/
│   │   ├── __init__.py
│   │   ├── 0001_initial.py
│   │   ├── 0002_purchasedocument_saledocument.py
│   │   ├── 0003_quotation.py
│   │   ├── 0004_payment_terms.py
│   │   ├── 0005_billing_note_payment_batch.py
│   │   ├── 0006_billingnote_inv_bn_date_idx_and_more.py
│   │   ├── 0007_billingnote_customer_paymentbatch_supplier_and_more.py
│   │   ├── 0008_remove_quotation_items_quotationitem_base_quantity_and_more.py
│   │   ├── 0009_productpicture.py
│   │   ├── 0010_remove_product_picture_url.py
│   │   ├── 0011_purchase_sale_bill_discount.py
│   │   ├── 0012_supplier_procurement_contact.py
│   │   ├── 0013_creditnote_creditnoteline_creditnote_inv_cn_date_idx_and_more.py
│   │   ├── 0014_product_is_active.py
│   │   ├── 0015_sale_customer_po_reference.py
│   │   ├── 0016_saleitem_supplier_saleitem_supplier_name_and_more.py
│   │   ├── 0017_backfill_quotation_item_suppliers.py
│   │   ├── 0018_purchase_source_quotation_sale_source_quotation.py
│   │   ├── 0019_quotation_valid_until_days_type.py
│   │   ├── 0020_alter_sale_status_alter_saleitem_item_status.py
│   │   ├── 0021_purchase_payable_total.py
│   │   ├── 0022_productsupplier_saleitemallocation.py
│   │   ├── 0023_add_shipping_date_to_quotation.py
│   │   ├── 0024_rename_debit_term_to_cash.py
│   │   ├── 0025_add_payment_term_to_quotation.py
│   │   ├── 0026_creditnote_total_before_vat_creditnote_vat_amount_and_more.py
│   │   ├── 0027_recompute_creditnote_vat.py
│   │   ├── 0028_activitylog.py
│   │   └── 0029_productpicture_content_productpicture_content_type_and_more.py
│   ├── access_control.py
│   ├── ai_reports.py
│   ├── audit.py
│   ├── auth_views.py
│   ├── models.py
│   ├── pagination.py
│   ├── permissions.py
│   ├── serializers/
│   │   ├── __init__.py
│   │   ├── _legacy.py
│   │   ├── access.py
│   │   ├── common.py
│   │   ├── finance.py
│   │   ├── master_data.py
│   │   └── transactions.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── _legacy.py
│   │   ├── chat.py
│   │   ├── common.py
│   │   ├── dashboard.py
│   │   ├── stock.py
│   │   └── transactions.py
│   ├── tests.py
│   ├── urls.py
│   └── views/
│       ├── __init__.py
│       ├── _legacy.py
│       ├── access.py
│       ├── ai.py
│       ├── common.py
│       ├── dashboard.py
│       ├── finance.py
│       ├── master_data.py
│       └── transactions.py
├── manage.py
└── requirements.txt
```

### Backend Structure Notes

- `config/` contains Django project settings and URL bootstrap
- `inventory/` is the main Django app for domain logic
- `inventory/services/` holds stock, allocation, transaction, dashboard, and AI chat context logic
- `inventory/ai_reports.py` builds supplier, customer, and product report contexts and printable AI report HTML
- `inventory/access_control.py`, `inventory/permissions.py`, `inventory/auth_views.py`, and `inventory/audit.py` implement JWT login support, role permissions, user-access authorization, and activity logging
- `inventory/serializers/` validates API payloads and maps compatibility fields to normalized models
- `inventory/views/` defines HTTP endpoints, list filters, eligibility endpoints, and admin access APIs
- `inventory/*/_legacy.py` files preserve older import paths after the backend was split into focused modules
- `inventory/management/commands/` contains seed/reset operational commands
- `inventory/tests.py` is the backend test suite

## Frontend

```text
frontend/
├── .env.example
├── index.html
├── package-lock.json
├── package.json
├── vite.config.js
├── src/
│   ├── App.jsx
│   ├── api.js
│   ├── equality.js
│   ├── format.js
│   ├── main.jsx
│   ├── mockData.js
│   ├── purchaseStatus.js
│   ├── saleStatus.js
│   ├── saleStock.js
│   ├── styles.css
│   ├── unitConversion.js
│   ├── app/
│   │   ├── ActiveTabContent.jsx
│   │   ├── AppShell.jsx
│   │   ├── appMessageUtils.js
│   │   ├── appUtils.js
│   │   ├── mockGuestHandlers.js
│   │   ├── productPayload.js
│   │   ├── tabs.js
│   │   └── useAppState.js
│   ├── assets/
│   ├── auth/
│   │   ├── AuthContext.jsx
│   │   └── permissions.js
│   ├── components/
│   │   ├── AllItemsDiscountControl.jsx
│   │   ├── AiReportPage.jsx
│   │   ├── BillingNotePage.jsx
│   │   ├── CategoryPage.jsx
│   │   ├── ChatPanel.jsx
│   │   ├── ContactOptionField.jsx
│   │   ├── CreditNotePage.jsx
│   │   ├── CreditNotePrompt.jsx
│   │   ├── CustomerPage.jsx
│   │   ├── Dashboard.jsx
│   │   ├── DocumentRefChip.jsx
│   │   ├── DocumentRefModal.jsx
│   │   ├── EligiblePartyCombobox.jsx
│   │   ├── FilterControls.jsx
│   │   ├── InventoryPage.jsx
│   │   ├── LoginPage.jsx
│   │   ├── MultiPurchaseWizard.jsx
│   │   ├── PaginationControls.jsx
│   │   ├── PaymentBatchPage.jsx
│   │   ├── PaymentLineAmount.jsx
│   │   ├── ProductsPage.jsx
│   │   ├── PurchaseForm.jsx
│   │   ├── PurchaseHistoryPage.jsx
│   │   ├── QuotationConvertSelect.jsx
│   │   ├── QuotationPage.jsx
│   │   ├── SalesForm.jsx
│   │   ├── SalesHistoryPage.jsx
│   │   ├── SettingsPage.jsx
│   │   ├── StatusFilterGroup.jsx
│   │   ├── SupplierPage.jsx
│   │   ├── TabIcon.jsx
│   │   ├── TransactionTable.jsx
│   │   ├── contactValidation.js
│   │   ├── formBlurValidation.js
│   │   ├── productPriceMetrics.js
│   │   ├── transactionDiscounts.js
│   │   ├── admin/
│   │   │   ├── ActivityLogPage.jsx
│   │   │   ├── EditRoleModal.jsx
│   │   │   ├── EditUserModal.jsx
│   │   │   ├── ManageRolesModal.jsx
│   │   │   ├── adminPreviewData.js
│   │   │   └── UserAccessPage.jsx
│   │   ├── billing/
│   │   │   ├── BillingNoteDetailModal.jsx
│   │   │   ├── BillingNoteDirectorySection.jsx
│   │   │   ├── BillingNoteEditForm.jsx
│   │   │   ├── BillingNoteStatusPill.jsx
│   │   │   ├── CreateBillingNoteModal.jsx
│   │   │   ├── billingNoteDetailHelpers.js
│   │   │   ├── billingNoteUtils.js
│   │   │   ├── useBillingNoteEditFormState.js
│   │   │   └── useBillingNoteDetailState.js
│   │   ├── categories/
│   │   │   ├── CategoryDirectorySection.jsx
│   │   │   ├── CategoryEditorModal.jsx
│   │   │   ├── categoryPageHelpers.js
│   │   │   ├── categoryUtils.js
│   │   │   └── useCategoryPageState.js
│   │   ├── charts/
│   │   │   └── ReorderProjection.jsx
│   │   ├── chat/
│   │   │   ├── ChatMessageBody.jsx
│   │   │   └── ChatRecordDetailModal.jsx
│   │   ├── credits/
│   │   │   ├── CreateCreditNoteModal.jsx
│   │   │   ├── CreditNoteDetailModal.jsx
│   │   │   ├── CreditNoteDirectorySection.jsx
│   │   │   ├── CreditNoteEditForm.jsx
│   │   │   ├── CreditNoteStatusPill.jsx
│   │   │   ├── creditNoteUtils.js
│   │   │   └── useCreditNoteEditFormState.js
│   │   ├── customers/
│   │   │   ├── CustomerContactSection.jsx
│   │   │   ├── CustomerDeliverySection.jsx
│   │   │   ├── CustomerDirectorySection.jsx
│   │   │   ├── CustomerEditorModal.jsx
│   │   │   ├── CustomerIdentitySection.jsx
│   │   │   ├── customerPageHelpers.js
│   │   │   ├── customerUtils.js
│   │   │   └── useCustomerPageState.js
│   │   ├── documentRefs/
│   │   │   ├── DocumentRefBody.jsx
│   │   │   ├── DocumentRefContent.jsx
│   │   │   ├── PrintableTransactionDocument.jsx
│   │   │   ├── documentRefConfig.jsx
│   │   │   └── printTransactionDocument.jsx
│   │   ├── filters/
│   │   │   ├── DirectoryFilterBar.jsx
│   │   │   └── UniversalFilter.jsx
│   │   ├── inventory/
│   │   │   ├── InventoryControlBoard.jsx
│   │   │   ├── InventoryDetailModal.jsx
│   │   │   ├── InventoryDirectorySection.jsx
│   │   │   ├── InventoryMetricModal.jsx
│   │   │   ├── InventoryProductStockRow.jsx
│   │   │   ├── InventoryReferenceModal.jsx
│   │   │   ├── inventoryUtils.js
│   │   │   └── reorderHistory.js
│   │   ├── payments/
│   │   │   ├── CreatePaymentBatchModal.jsx
│   │   │   ├── PaymentBatchDetailModal.jsx
│   │   │   ├── PaymentBatchDirectorySection.jsx
│   │   │   ├── PaymentBatchEditForm.jsx
│   │   │   ├── PaymentBatchStatusPill.jsx
│   │   │   ├── paymentBatchDetailHelpers.js
│   │   │   ├── paymentBatchUtils.js
│   │   │   ├── usePaymentBatchEditFormState.js
│   │   │   └── usePaymentBatchDetailState.js
│   │   ├── partners/
│   │   │   ├── PartnerDirectorySection.jsx
│   │   │   └── PartnerPageShell.jsx
│   │   ├── products/
│   │   │   ├── ProductDetailModal.jsx
│   │   │   ├── ProductDirectorySection.jsx
│   │   │   ├── ProductEditorModal.jsx
│   │   │   ├── ProductHistoryProfilePanel.jsx
│   │   │   ├── ProductPriceInsightsSection.jsx
│   │   │   ├── ProductHistoryTableSection.jsx
│   │   │   ├── ProductIdentityFields.jsx
│   │   │   ├── ProductMediaFields.jsx
│   │   │   ├── ProductStockSourcesSection.jsx
│   │   │   ├── ProductTransactionDetailModal.jsx
│   │   │   ├── ProductUnitsFields.jsx
│   │   │   ├── defaultProducts.js
│   │   │   ├── productEditorHelpers.js
│   │   │   ├── productHistoryHelpers.js
│   │   │   ├── productPriceInsights.js
│   │   │   ├── productUtils.js
│   │   │   ├── productsPageHelpers.js
│   │   │   └── useProductsPageState.js
│   │   ├── purchase/
│   │   │   └── QuickPoDrawer.jsx
│   │   ├── purchases/
│   │   │   ├── PurchaseEditDetailsSection.jsx
│   │   │   ├── PurchaseEditForm.jsx
│   │   │   ├── PurchaseEditLineItemsSection.jsx
│   │   │   ├── PurchaseEditTotalsSection.jsx
│   │   │   ├── PurchaseFormDetailsSection.jsx
│   │   │   ├── PurchaseFormTotalsSection.jsx
│   │   │   ├── PurchaseHistoryDirectorySection.jsx
│   │   │   ├── PurchaseLineItemsSection.jsx
│   │   │   ├── purchaseEditFormStateHelpers.js
│   │   │   ├── purchaseFormStateHelpers.js
│   │   │   ├── purchaseFormUtils.js
│   │   │   ├── purchaseHistoryUtils.js
│   │   │   ├── usePurchaseEditFormState.js
│   │   │   ├── usePurchaseFormState.js
│   │   │   └── usePurchaseHistoryPageState.js
│   │   ├── quotation/
│   │   │   ├── QuotationConversionFlow.jsx
│   │   │   ├── QuotationDetailModal.jsx
│   │   │   ├── QuotationDirectorySection.jsx
│   │   │   ├── QuotationForm.jsx
│   │   │   ├── QuotationFormDetailsSection.jsx
│   │   │   ├── QuotationFormTotalsSection.jsx
│   │   │   ├── QuotationLineItemsSection.jsx
│   │   │   ├── QuotationPurchaseWizardFlow.jsx
│   │   │   ├── quotationConversionUtils.js
│   │   │   ├── quotationDateUtils.js
│   │   │   ├── quotationDirectoryUtils.js
│   │   │   ├── quotationFormStateHelpers.js
│   │   │   ├── quotationUtils.js
│   │   │   ├── quotationValueUtils.js
│   │   │   └── useQuotationFormState.js
│   │   ├── sales/
│   │   │   ├── SalesEditDetailsSection.jsx
│   │   │   ├── SalesEditForm.jsx
│   │   │   ├── SalesEditLineItemsSection.jsx
│   │   │   ├── SalesEditTotalsSection.jsx
│   │   │   ├── SalesFormDetailsSection.jsx
│   │   │   ├── SalesFormTotalsSection.jsx
│   │   │   ├── SalesHistoryDirectorySection.jsx
│   │   │   ├── SalesItemAllocationSection.jsx
│   │   │   ├── SalesLineItemsSection.jsx
│   │   │   ├── salesAllocationUtils.js
│   │   │   ├── salesEditFormStateHelpers.js
│   │   │   ├── salesFormStateHelpers.js
│   │   │   ├── salesFormUtils.js
│   │   │   ├── salesHistoryUtils.js
│   │   │   ├── useSalesEditFormState.js
│   │   │   └── useSalesFormState.js
│   │   ├── suppliers/
│   │   │   ├── SupplierContactSection.jsx
│   │   │   ├── SupplierDeliverySection.jsx
│   │   │   ├── SupplierDirectorySection.jsx
│   │   │   ├── SupplierEditorModal.jsx
│   │   │   ├── SupplierIdentitySection.jsx
│   │   │   ├── SupplierProcurementSection.jsx
│   │   │   ├── supplierPageHelpers.js
│   │   │   ├── supplierUtils.js
│   │   │   └── useSupplierPageState.js
│   │   └── transactions/
│   │       ├── TransactionDetailFields.jsx
│   │       ├── TransactionDetailItemsSection.jsx
│   │       ├── TransactionDetailModal.jsx
│   │       ├── TransactionDocumentsPanel.jsx
│   │       ├── TransactionDetailSummary.jsx
│   │       ├── TransactionTableDirectorySection.jsx
│   │       └── transactionTableUtils.js
│   ├── hooks/
│   │   ├── inventoryDataHelpers.js
│   │   ├── inventoryDataSetters.js
│   │   ├── productEditorStateHelpers.js
│   │   ├── useAppChat.js
│   │   ├── useAppFinancialActions.js
│   │   ├── useAppMasterDataActions.js
│   │   ├── useAppTransactionActions.js
│   │   ├── useBillingNoteDirectoryFilters.js
│   │   ├── useCreditNoteDirectoryFilters.js
│   │   ├── useInventoryData.js
│   │   ├── useInventoryDirectoryFilters.js
│   │   ├── usePaymentBatchDirectoryFilters.js
│   │   ├── useProductDetailState.js
│   │   ├── useProductDirectoryFilters.js
│   │   ├── useProductEditorState.js
│   │   ├── usePurchaseActions.js
│   │   ├── useQuotationDirectoryFilters.js
│   │   ├── useSalesActions.js
│   │   └── useSalesHistoryDirectoryFilters.js
│   ├── i18n/
│   │   ├── LanguageContext.jsx
│   │   ├── statusLabels.js
│   │   └── translations.js
│   └── styles/
│       ├── admin.css
│       ├── ai-report.css
│       ├── base-layout.css
│       ├── charts.css
│       ├── dashboard.css
│       ├── directories.css
│       ├── finance.css
│       ├── forms-tables.css
│       ├── inventory.css
│       ├── login.css
│       ├── products.css
│       ├── quotations-categories.css
│       └── responsive-overrides.css
└── vite.config.js
```

### Frontend Structure Notes

- `src/app/` contains app shell composition, tab routing, and top-level app state orchestration
- `src/auth/` contains authentication context and permission helpers for tab visibility
- `src/components/` contains page components plus domain-focused subfolders
- `src/components/admin/` contains the User Access and Activity Log pages
- `src/components/AiReportPage.jsx` contains the printable AI report request workflow
- `src/components/documentRefs/` centralizes saved-document viewing plus printable business-document rendering
- `src/hooks/` contains shared data loading, actions, directory filters, and UI state hooks
- `src/i18n/` contains bilingual translation support
- `src/styles/` contains split CSS domains after the stylesheet refactor
- `src/purchaseStatus.js`, `src/saleStatus.js`, `src/saleStock.js`, and `src/unitConversion.js` hold cross-feature business utilities used by multiple screens

## Docs

```text
docs/
├── README.md
├── ai/
│   ├── ai-assistant-guide.md
│   └── ai-assistant-how-it-works.md
├── architecture/
│   ├── codebase-structure.md
│   ├── database-schema.md
│   └── frontend-refactor-handoff.md
├── business/
│   ├── business-rules-reference.md
│   └── workflow-reference.md
├── security/
│   └── login-system.md
├── testing/
│   ├── ai-and-calculation-validation-plan.md
│   ├── automated-test-functions-explained.md
│   ├── manual-ai-calculation-test-report.md
│   ├── manual-ai-chat-and-report-current-data-test-report.md
│   └── manual-ai-chat-and-report-user-test-report.md
├── screenshots/
└── ...
```

### Docs Notes

- `docs/README.md` is the entry point for grouped documentation
- `docs/ai/` covers AI Chat and AI Report behavior from user and developer perspectives
- `docs/testing/` contains calculation, AI Chat, and AI Report validation plans and test reports
- `docs/business/` contains workflow and business-rule references
- `docs/architecture/` contains source structure, database schema, and frontend refactor notes
- `docs/security/` documents Django + React JWT login, role permission, user-access, and activity-log architecture

## Recommended Reading Order

For a new contributor, this is the fastest reading order:

1. [README.md](../../README.md)
2. [AGENTS.md](../../AGENTS.md)
3. [HANDOUT.md](../../HANDOUT.md)
4. [docs/business/business-rules-reference.md](../business/business-rules-reference.md)
5. [backend/README.md](../../backend/README.md)
6. `backend/inventory/`
7. `frontend/src/app/`, `frontend/src/hooks/`, and the domain folders under `frontend/src/components/`
