import { useEffect, useMemo, useState } from "react";
import DocumentRefModal from "./DocumentRefModal";
import QuotationFormCard from "./quotation/QuotationForm";
import QuotationConversionFlow from "./quotation/QuotationConversionFlow";
import QuotationDetailModal from "./quotation/QuotationDetailModal";
import QuotationDirectorySection from "./quotation/QuotationDirectorySection";
import QuotationPurchaseWizardFlow from "./quotation/QuotationPurchaseWizardFlow";
import { useQuotationDirectoryFilters } from "../hooks/useQuotationDirectoryFilters";
import { useLanguage } from "../i18n/LanguageContext";
import {
  buildPurchaseGroups,
  buildSalesPrefillFromRows,
  getQuotationStockCoverage,
  getShortQuotationItemKeys,
} from "./quotation/quotationUtils";

function QuotationPage({
  quotations = [],
  products = [],
  suppliers = [],
  customers = [],
  purchases = [],
  sales = [],
  enableSaleStockValidation = true,
  onSaveQuotation,
  onDeleteQuotation,
  onCreatePurchaseFromQuotation,
  onViewPurchases,
  onCreateSale,
  openNewSignal = null,
  onIntentConsumed,
}) {
  const { t } = useLanguage();
  const [viewingQuotation, setViewingQuotation] = useState(null);
  const [editingQuotation, setEditingQuotation] = useState(null);
  const [showNewQuotationForm, setShowNewQuotationForm] = useState(false);

  // Deep-link from the dashboard's Popular Products "Create quotation" action:
  // jump straight into a new quotation form, then clear the one-shot intent.
  useEffect(() => {
    if (!openNewSignal) {
      return;
    }
    setEditingQuotation(null);
    setViewingQuotation(null);
    setShowNewQuotationForm(true);
    onIntentConsumed?.();
  }, [openNewSignal]);
  const [conversion, setConversion] = useState(null);
  const [docRefModal, setDocRefModal] = useState(null);
  const {
    searchTerm,
    setSearchTerm,
    filterOpen,
    setFilterOpen,
    selectedCustomer,
    setSelectedCustomer,
    selectedProduct,
    setSelectedProduct,
    productOptions,
    stateFilter,
    setStateFilter,
    vatFilter,
    setVatFilter,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    amountMin,
    setAmountMin,
    amountMax,
    setAmountMax,
    setHistoryPage,
    currentHistoryPage,
    historyPageSize,
    customerOptions,
    activeFilterCount,
    filteredQuotations,
    paginatedQuotations,
    quotationPagination,
    resetFilters,
    quickPresets,
    activeChips,
  } = useQuotationDirectoryFilters({
    quotations,
    customers,
    t,
  });
  const viewingQuotationStockCoverage = useMemo(
    () => getQuotationStockCoverage(viewingQuotation, products),
    [products, viewingQuotation]
  );

  async function handleDelete(quotation) {
    const confirmed = window.confirm(
      t("quotation.deleteButton") + " " + (quotation.reference_no || quotation.id) + "?"
    );

    if (!confirmed) {
      return;
    }

    const deleted = await onDeleteQuotation?.(quotation);

    if (deleted === false) {
      return;
    }

    setViewingQuotation((current) => (current?.id === quotation.id ? null : current));
    setEditingQuotation((currentQuotation) =>
      currentQuotation?.id === quotation.id ? null : currentQuotation
    );
  }

  function handleConvertContinue(rows) {
    setConversion((current) => {
      if (!current) {
        return current;
      }
      if (current.type === "purchase") {
        return {
          ...current,
          step: "purchase-wizard",
          groups: buildPurchaseGroups(current.quotation, rows, suppliers),
        };
      }
      return {
        ...current,
        step: "sale-form",
        salePrefill: buildSalesPrefillFromRows(current.quotation, rows, customers),
      };
    });
  }

  async function handlePurchaseCreate(formData) {
    if (conversion?.quotation?.id && formData instanceof FormData) {
      formData.append("source_quotation_id", conversion.quotation.id);
    }
    return onCreatePurchaseFromQuotation?.(formData);
  }

  async function handleSaleCreate(formData) {
    if (conversion?.quotation?.id && formData instanceof FormData) {
      formData.append("source_quotation_id", conversion.quotation.id);
    }
    const saved = await onCreateSale?.(formData);

    if (saved === false) {
      return false;
    }

    setConversion(null);
    return true;
  }

  async function handleSaveQuotation(quotation) {
    const saved = await onSaveQuotation?.(quotation);

    if (saved === false) {
      return false;
    }

    setShowNewQuotationForm(false);
    if (editingQuotation) {
      setEditingQuotation(saved && typeof saved === "object" ? saved : quotation);
    } else {
      setEditingQuotation(null);
    }
    return saved;
  }

  if (showNewQuotationForm) {
    return (
      <div className="stack-layout">
        <QuotationFormCard
          key="new-quotation"
          quotations={quotations}
          products={products}
          suppliers={suppliers}
          customers={customers}
          onSave={handleSaveQuotation}
          onCancel={() => setShowNewQuotationForm(false)}
        />
      </div>
    );
  }

  if (editingQuotation) {
    return (
      <div className="stack-layout">
        <QuotationFormCard
          key={editingQuotation.id}
          quotation={editingQuotation}
          quotations={quotations}
          products={products}
          suppliers={suppliers}
          customers={customers}
          onSave={handleSaveQuotation}
          onCancel={() => setEditingQuotation(null)}
        />
      </div>
    );
  }

  if (conversion && conversion.step === "purchase-wizard") {
    return (
      <QuotationPurchaseWizardFlow
        conversion={conversion}
        products={products}
        suppliers={suppliers}
        purchases={purchases}
        onCreatePurchase={handlePurchaseCreate}
        onCancel={() => setConversion(null)}
        onViewPurchases={() => {
          setConversion(null);
          onViewPurchases?.();
        }}
      />
    );
  }

  if (conversion) {
    return (
      <QuotationConversionFlow
        conversion={conversion}
        products={products}
        customers={customers}
        suppliers={suppliers}
        purchases={purchases}
        sales={sales}
        enableSaleStockValidation={enableSaleStockValidation}
        onBack={() => setConversion(null)}
        onContinue={handleConvertContinue}
        onSubmitSale={handleSaleCreate}
      />
    );
  }

  return (
    <div className="stack-layout">
      <QuotationDirectorySection
        quotations={quotations}
        filteredQuotations={filteredQuotations}
        paginatedQuotations={paginatedQuotations}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        filterOpen={filterOpen}
        onToggleFilter={() => setFilterOpen((currentValue) => !currentValue)}
        activeFilterCount={activeFilterCount}
        onResetFilters={resetFilters}
        quickPresets={quickPresets}
        activeChips={activeChips}
        selectedCustomer={selectedCustomer}
        onSelectedCustomerChange={setSelectedCustomer}
        customerOptions={customerOptions}
        selectedProduct={selectedProduct}
        onSelectedProductChange={setSelectedProduct}
        productOptions={productOptions}
        stateFilter={stateFilter}
        onStateFilterChange={setStateFilter}
        vatFilter={vatFilter}
        onVatFilterChange={setVatFilter}
        dateFrom={dateFrom}
        onDateFromChange={setDateFrom}
        dateTo={dateTo}
        onDateToChange={setDateTo}
        amountMin={amountMin}
        onAmountMinChange={setAmountMin}
        amountMax={amountMax}
        onAmountMaxChange={setAmountMax}
        currentHistoryPage={currentHistoryPage}
        historyPageSize={historyPageSize}
        pagination={quotationPagination}
        onPageChange={setHistoryPage}
        onCreateQuotation={() => {
          setEditingQuotation(null);
          setConversion(null);
          setShowNewQuotationForm(true);
        }}
        onViewQuotation={setViewingQuotation}
      />

      {viewingQuotation ? (
        <QuotationDetailModal
          quotation={viewingQuotation}
          products={products}
          stockCoverage={viewingQuotationStockCoverage}
          onClose={() => setViewingQuotation(null)}
          onEdit={() => {
            setViewingQuotation(null);
            setEditingQuotation(viewingQuotation);
            setShowNewQuotationForm(false);
            setConversion(null);
          }}
          onDelete={() => handleDelete(viewingQuotation)}
          onStartPurchase={() => {
            setViewingQuotation(null);
            setEditingQuotation(null);
            setShowNewQuotationForm(false);
            setConversion({
              type: "purchase",
              quotation: viewingQuotation,
              initialSelectedItemKeys: getShortQuotationItemKeys(
                viewingQuotation,
                viewingQuotationStockCoverage
              ),
              stockCoverageLines: viewingQuotationStockCoverage.lines,
            });
          }}
          onStartSale={() => {
            setViewingQuotation(null);
            setEditingQuotation(null);
            setShowNewQuotationForm(false);
            setConversion({
              type: "sale",
              quotation: viewingQuotation,
              stockCoverageLines: viewingQuotationStockCoverage.lines,
            });
          }}
          onOpenDocRef={(docType, docId, referenceNo) =>
            setDocRefModal({ docType, docId, referenceNo })
          }
        />
      ) : null}

      {docRefModal && (
        <DocumentRefModal
          docType={docRefModal.docType}
          docId={docRefModal.docId}
          referenceNo={docRefModal.referenceNo}
          onClose={() => setDocRefModal(null)}
        />
      )}
    </div>
  );
}

export default QuotationPage;
