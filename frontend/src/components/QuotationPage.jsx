import { useEffect, useMemo, useState } from "react";
import SalesForm from "./SalesForm";
import QuotationConvertSelect from "./QuotationConvertSelect";
import MultiPurchaseWizard from "./MultiPurchaseWizard";
import DocumentRefModal from "./DocumentRefModal";
import PaginationControls from "./PaginationControls";
import QuotationFormCard from "./quotation/QuotationForm";
import QuotationDetailModal from "./quotation/QuotationDetailModal";
import { FilterPresets, ActiveFilterChips, RangeField, withinRange } from "./FilterControls";
import { formatDate, formatMoney as fmt } from "../format";
import { useLanguage } from "../i18n/LanguageContext";
import { PAGE_SIZE } from "../app/appUtils";
import {
  buildPurchaseGroups,
  buildSalesPrefillFromRows,
  daysAgoInputValue,
  getItemCount,
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

  if (conversion && conversion.step === "sale-form") {
    return (
      <div className="stack-layout">
        <section className="section-card quotation-link-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{t("quotation.quotationLinkEyebrow")}</p>
              <h3>{t("quotation.quotationLinkTitle", { ref: conversion.quotation.reference_no })}</h3>
            </div>
            <button
              className="secondary-button"
              type="button"
              onClick={() => setConversion(null)}
            >
              {t("quotation.quotationLinkBack")}
            </button>
          </div>
        </section>
        <SalesForm
          key={`sale-from-${conversion.quotation.id}`}
          products={products}
          customers={customers}
          suppliers={suppliers}
          purchases={purchases}
          sales={sales}
          enableStockValidation={enableSaleStockValidation}
          prefill={conversion.salePrefill}
          onSubmit={handleSaleCreate}
          onCancel={() => setConversion(null)}
        />
      </div>
    );
  }

  if (conversion) {
    return (
      <div className="stack-layout">
        <QuotationConvertSelect
          key={`convert-${conversion.type}-${conversion.quotation.id}`}
          quotation={conversion.quotation}
          type={conversion.type}
          initialSelectedItemKeys={conversion.initialSelectedItemKeys}
          stockCoverageLines={conversion.stockCoverageLines}
          onBack={() => setConversion(null)}
          onContinue={handleConvertContinue}
        />
      </div>
    );
  }

  return (
    <div className="stack-layout">
      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("quotation.searchEyebrow")}</p>
            <h3>{t("quotation.searchTitle")}</h3>
          </div>
        </div>

        <div className="supplier-directory-toolbar">
          <label className="stock-search supplier-search">
            <span className="stock-search-icon">Q</span>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={t("quotation.quotationSearchPlaceholder")}
            />
          </label>
          <div className="stock-report-summary supplier-search-meta">
            <span>
              {t("quotation.shownCount", { shown: filteredQuotations.length, total: quotations.length })}
            </span>
          </div>
        </div>

        <div className="history-filter-actions">
          <button
            className="secondary-button product-filter-toggle"
            type="button"
            aria-expanded={filterOpen}
            onClick={() => setFilterOpen((currentValue) => !currentValue)}
          >
            {t("quotation.filterButton")}
            {activeFilterCount ? <span>{activeFilterCount}</span> : null}
          </button>
          <button className="secondary-button" type="button" onClick={resetFilters}>
            {t("quotation.resetFilterButton")}
          </button>
        </div>

        <FilterPresets presets={quickPresets} />
        <ActiveFilterChips chips={activeChips} onClearAll={resetFilters} />

        {filterOpen ? (
          <div className="history-filter-panel">
            <div className="history-filter-grid">
              <label className="history-filter-field">
                <span className="history-filter-title">{t("quotation.filterCustomerTitle")}</span>
                <select
                  value={selectedCustomer}
                  onChange={(event) => setSelectedCustomer(event.target.value)}
                >
                  <option value="">{t("quotation.filterAllCustomers")}</option>
                  {customerOptions.map((customerName) => (
                    <option key={customerName} value={customerName}>
                      {customerName}
                    </option>
                  ))}
                </select>
              </label>

              <label className="history-filter-field">
                <span className="history-filter-title">{t("quotation.filterStateTitle")}</span>
                <select
                  value={stateFilter}
                  onChange={(event) => setStateFilter(event.target.value)}
                >
                  <option value="all">{t("quotation.filterAllStates")}</option>
                  <option value="valid">{t("quotation.filterStateValid")}</option>
                  <option value="expired">{t("quotation.filterStateExpired")}</option>
                </select>
              </label>

              <label className="history-filter-field">
                <span className="history-filter-title">{t("quotation.filterVatTitle")}</span>
                <select
                  value={vatFilter}
                  onChange={(event) => setVatFilter(event.target.value)}
                >
                  <option value="all">{t("quotation.filterAllVat")}</option>
                  <option value="included">{t("quotation.filterVatIncluded")}</option>
                  <option value="not_included">{t("quotation.filterVatExcluded")}</option>
                  <option value="none">{t("quotation.filterVatNone")}</option>
                </select>
              </label>

              <label className="history-filter-field">
                <span className="history-filter-title">{t("quotation.filterDateFromTitle")}</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                />
              </label>

              <label className="history-filter-field">
                <span className="history-filter-title">{t("quotation.filterDateToTitle")}</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                />
              </label>

              <RangeField
                title={t("quotation.filterAmountTitle")}
                prefix="฿"
                minValue={amountMin}
                maxValue={amountMax}
                onMinChange={setAmountMin}
                onMaxChange={setAmountMax}
              />
            </div>
          </div>
        ) : null}
      </section>

      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("quotation.historyEyebrow")}</p>
            <h3>{t("quotation.historyTitle")}</h3>
          </div>
          <div className="transaction-table-actions">
            <button
              className="primary-button"
              type="button"
              onClick={() => {
                setEditingQuotation(null);
                setConversion(null);
                setShowNewQuotationForm(true);
              }}
            >
              {t("quotation.createButton")}
            </button>
          </div>
        </div>

        {filteredQuotations.length ? (
          <div className="transaction-table-window partner-table-window quotation-table-window">
            <div className="table-scroll desktop-table">
              <table className="transaction-history-table transaction-history-table-quotation">
                <colgroup>
                  <col className="quotation-col-index" />
                  <col className="quotation-col-reference" />
                  <col className="quotation-col-party" />
                  <col className="quotation-col-dates" />
                  <col className="quotation-col-items" />
                  <col className="quotation-col-total" />
                  <col className="quotation-col-actions" />
                </colgroup>
                <thead>
                  <tr>
                    <th className="table-index-cell">{t("quotation.colIndex")}</th>
                    <th>{t("quotation.colQuotation")}</th>
                    <th>{t("quotation.colCustomer")}</th>
                    <th>{t("quotation.colDates")}</th>
                    <th>{t("quotation.colItems")}</th>
                    <th>{t("quotation.colTotal")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {paginatedQuotations.map((quotation, index) => {
                    const itemCount = getItemCount(quotation.items || []);
                    const rowNumber = (currentHistoryPage - 1) * historyPageSize + index + 1;

                    return (
                      <tr key={quotation.id || quotation.reference_no}>
                        <td className="table-index-cell">{rowNumber}</td>
                        <td>
                          <div className="transaction-reference-cell">
                            <strong>{quotation.reference_no || "—"}</strong>
                            <span className={`quotation-state-pill ${getQuotationState(quotation).toLowerCase()}`}>
                              {getQuotationState(quotation) === "Valid" ? t("quotation.stateValid") : t("quotation.stateExpired")}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="cell-stack">
                            <strong>{quotation.customer_name || "—"}</strong>
                            <span>{t("quotation.filterCustomerTitle")}</span>
                          </div>
                        </td>
                        <td>
                          <div className="cell-stack">
                            <span className="quotation-date-value">
                              {quotation.quotation_date || "—"}
                            </span>
                            <span>{t("quotation.validUntilRow", { date: quotation.valid_until_date || "—" })}</span>
                          </div>
                        </td>
                        <td>
                          <div className="history-item-summary history-item-quantity-only">
                            <span className="history-item-count">{itemCount}</span>
                          </div>
                        </td>
                        <td>
                          <strong>{fmt(quotation.grand_total)}</strong>
                        </td>
                        <td>
                          <button
                            className="table-action-button"
                            type="button"
                            onClick={() => setViewingQuotation(quotation)}
                          >
                            {t("quotation.detailButton")}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mobile-record-list">
              {paginatedQuotations.map((quotation, index) => {
                const itemCount = getItemCount(quotation.items || []);
                const rowNumber = (currentHistoryPage - 1) * historyPageSize + index + 1;

                return (
                  <article className="mobile-record-card" key={`mobile-quotation-${quotation.id || quotation.reference_no}`}>
                    <div className="mobile-record-header">
                      <div className="mobile-record-title">
                        <span className="mobile-record-index">{rowNumber}</span>
                        <div className="cell-stack">
                          <strong>{quotation.reference_no || "—"}</strong>
                          <span>{quotation.customer_name || "—"}</span>
                        </div>
                      </div>
                      <span className={`quotation-state-pill ${getQuotationState(quotation).toLowerCase()}`}>
                        {getQuotationState(quotation) === "Valid" ? t("quotation.stateValid") : t("quotation.stateExpired")}
                      </span>
                    </div>

                    <div className="mobile-record-grid">
                      <div>
                        <span>{t("quotation.mobileDate")}</span>
                        <strong>{formatDate(quotation.quotation_date)}</strong>
                      </div>
                      <div>
                        <span>{t("quotation.mobileValidUntil")}</span>
                        <strong>{formatDate(quotation.valid_until_date)}</strong>
                      </div>
                      <div>
                        <span>{t("quotation.mobileTotal")}</span>
                        <strong>{fmt(quotation.grand_total)}</strong>
                      </div>
                      <div className="full-width-mobile">
                        <span>{t("quotation.mobileItems")}</span>
                        <div className="history-item-summary mobile-history-item-summary history-item-quantity-only">
                          <span className="history-item-count">{itemCount}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      className="secondary-button table-action-button mobile-record-button"
                      type="button"
                      onClick={() => setViewingQuotation(quotation)}
                    >
                      {t("quotation.detailButton")}
                    </button>
                  </article>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="empty-copy">{t("quotation.noSavedYet")}</p>
        )}
        <PaginationControls
          pagination={quotationPagination}
          itemLabel={t("quotation.paginationLabel")}
          onPageChange={setHistoryPage}
        />
      </section>

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
