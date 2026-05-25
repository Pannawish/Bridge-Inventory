import { useEffect, useMemo, useState } from "react";
import MultiPurchaseWizard from "./MultiPurchaseWizard";
import DocumentRefModal from "./DocumentRefModal";
import QuotationFormCard from "./quotation/QuotationForm";
import QuotationConversionFlow from "./quotation/QuotationConversionFlow";
import QuotationDetailModal from "./quotation/QuotationDetailModal";
import QuotationDirectorySection from "./quotation/QuotationDirectorySection";
import { withinRange } from "./FilterControls";
import { useLanguage } from "../i18n/LanguageContext";
import { PAGE_SIZE } from "../app/appUtils";
import {
  buildPurchaseGroups,
  buildSalesPrefillFromRows,
  daysAgoInputValue,
  getQuotationPartnerOptions,
  getQuotationState,
  getQuotationStockCoverage,
  getShortQuotationItemKeys,
  quotationMatchesDateRange,
  quotationMatchesQuery,
  sortRecentQuotations,
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
}) {
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [vatFilter, setVatFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [viewingQuotation, setViewingQuotation] = useState(null);
  const [editingQuotation, setEditingQuotation] = useState(null);
  const [showNewQuotationForm, setShowNewQuotationForm] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [conversion, setConversion] = useState(null);
  const [docRefModal, setDocRefModal] = useState(null);
  const viewingQuotationStockCoverage = useMemo(
    () => getQuotationStockCoverage(viewingQuotation, products),
    [products, viewingQuotation]
  );
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const customerOptions = useMemo(
    () => getQuotationPartnerOptions(quotations, "customer_name", customers),
    [customers, quotations]
  );
  const activeFilterCount =
    (selectedCustomer ? 1 : 0) +
    (stateFilter === "all" ? 0 : 1) +
    (vatFilter === "all" ? 0 : 1) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0) +
    (amountMin ? 1 : 0) +
    (amountMax ? 1 : 0);
  const filteredQuotations = useMemo(
    () =>
      quotations
        .filter((quotation) => {
          const matchesSearch = normalizedSearch
            ? quotationMatchesQuery(quotation, normalizedSearch)
            : true;
          const matchesCustomer = selectedCustomer
            ? quotation.customer_name === selectedCustomer
            : true;
          const matchesState =
            stateFilter === "all" ||
            getQuotationState(quotation).toLowerCase() === stateFilter;
          const matchesVat = vatFilter === "all" || quotation.vat_mode === vatFilter;
          const matchesDateRange = quotationMatchesDateRange(
            quotation.quotation_date,
            dateFrom,
            dateTo
          );
          const matchesAmount = withinRange(
            quotation.grand_total,
            amountMin,
            amountMax
          );

          return (
            matchesSearch &&
            matchesCustomer &&
            matchesState &&
            matchesVat &&
            matchesDateRange &&
            matchesAmount
          );
        })
        .sort(sortRecentQuotations),
    [
      amountMin,
      amountMax,
      dateFrom,
      dateTo,
      normalizedSearch,
      quotations,
      selectedCustomer,
      stateFilter,
      vatFilter,
    ]
  );
  const historyPageSize = PAGE_SIZE;
  const historyTotalPages = Math.max(
    1,
    Math.ceil(filteredQuotations.length / historyPageSize)
  );
  const currentHistoryPage = Math.min(historyPage, historyTotalPages);
  const paginatedQuotations = useMemo(() => {
    const start = (currentHistoryPage - 1) * historyPageSize;
    return filteredQuotations.slice(start, start + historyPageSize);
  }, [currentHistoryPage, filteredQuotations, historyPageSize]);
  const quotationPagination = filteredQuotations.length
    ? {
        count: filteredQuotations.length,
        page: currentHistoryPage,
        page_size: historyPageSize,
        total_pages: historyTotalPages,
      }
    : null;

  useEffect(() => {
    setHistoryPage(1);
  }, [
    amountMax,
    amountMin,
    dateFrom,
    dateTo,
    normalizedSearch,
    quotations,
    selectedCustomer,
    stateFilter,
    vatFilter,
  ]);

  function resetFilters() {
    setSearchTerm("");
    setSelectedCustomer("");
    setStateFilter("all");
    setVatFilter("all");
    setDateFrom("");
    setDateTo("");
    setAmountMin("");
    setAmountMax("");
    setFilterOpen(false);
  }

  const vatLabels = {
    included: t("quotation.vatIncluded"),
    not_included: t("quotation.vatExcluded"),
    none: t("quotation.vatNone"),
  };
  const quickPresets = [
    {
      label: t("quotation.quickValidOnly"),
      active: stateFilter === "valid",
      onClick: () =>
        setStateFilter((current) => (current === "valid" ? "all" : "valid")),
    },
    {
      label: t("quotation.quickExpired"),
      active: stateFilter === "expired",
      onClick: () =>
        setStateFilter((current) =>
          current === "expired" ? "all" : "expired"
        ),
    },
    {
      label: t("quotation.quickLast30Days"),
      active: dateFrom === daysAgoInputValue(30) && !dateTo,
      onClick: () => {
        const last30 = dateFrom === daysAgoInputValue(30) && !dateTo;
        setDateFrom(last30 ? "" : daysAgoInputValue(30));
        setDateTo("");
      },
    },
  ];
  const activeChips = [
    selectedCustomer && {
      key: "customer",
      label: t("quotation.chipCustomer", { value: selectedCustomer }),
      onRemove: () => setSelectedCustomer(""),
    },
    stateFilter !== "all" && {
      key: "state",
      label: t("quotation.chipState", { value: stateFilter === "valid" ? t("quotation.stateValid") : t("quotation.stateExpired") }),
      onRemove: () => setStateFilter("all"),
    },
    vatFilter !== "all" && {
      key: "vat",
      label: t("quotation.chipVat", { value: vatLabels[vatFilter] || vatFilter }),
      onRemove: () => setVatFilter("all"),
    },
    dateFrom && {
      key: "dateFrom",
      label: t("quotation.chipDateFrom", { date: dateFrom }),
      onRemove: () => setDateFrom(""),
    },
    dateTo && {
      key: "dateTo",
      label: t("quotation.chipDateTo", { date: dateTo }),
      onRemove: () => setDateTo(""),
    },
    amountMin && {
      key: "amountMin",
      label: t("quotation.chipAmountMin", { value: amountMin }),
      onRemove: () => setAmountMin(""),
    },
    amountMax && {
      key: "amountMax",
      label: t("quotation.chipAmountMax", { value: amountMax }),
      onRemove: () => setAmountMax(""),
    },
  ].filter(Boolean);

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
    setEditingQuotation(null);
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
      <MultiPurchaseWizard
        key={`purchase-wizard-${conversion.quotation.id}`}
        groups={conversion.groups}
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
