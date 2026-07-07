// Section component for quotation workflow forms or detail views.

import PaginationControls from "../PaginationControls";
import UniversalFilter from "../filters/UniversalFilter";
import { formatDate, formatMoney as fmt } from "../../format";
import { useLanguage } from "../../i18n/LanguageContext";
import { getItemCount, getQuotationState } from "./quotationUtils";

function QuotationDirectorySection({
  quotations = [],
  filteredQuotations = [],
  paginatedQuotations = [],
  searchTerm,
  onSearchTermChange,
  activeFilterCount = 0,
  onResetFilters,
  quickPresets = [],
  activeChips = [],
  selectedCustomer,
  onSelectedCustomerChange,
  customerOptions = [],
  selectedProduct,
  onSelectedProductChange,
  productOptions = [],
  stateFilter,
  onStateFilterChange,
  vatFilter,
  onVatFilterChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  amountMin,
  onAmountMinChange,
  amountMax,
  onAmountMaxChange,
  currentHistoryPage = 1,
  historyPageSize = 0,
  pagination,
  onPageChange,
  onCreateQuotation,
  onViewQuotation,
}) {
  const { t } = useLanguage();

  // Config-driven filter definition. Re-ordering or moving a field between the
  // always-visible row and the "More filters" panel is a one-line change here.
  const filterFields = [
    {
      id: "customer",
      type: "combobox",
      section: "primary",
      label: t("quotation.filterCustomerTitle"),
      value: selectedCustomer,
      onChange: onSelectedCustomerChange,
      options: customerOptions.map((name) => ({ value: name, label: name })),
      allValue: "",
      placeholder: t("quotation.searchCustomerPlaceholder"),
      emptyMessage: t("quotation.noCustomerFound"),
    },
    {
      id: "date",
      type: "daterange",
      section: "primary",
      label: t("filterControls.dateRange"),
      from: dateFrom,
      to: dateTo,
      onFromChange: onDateFromChange,
      onToChange: onDateToChange,
    },
    {
      id: "state",
      type: "select",
      section: "primary",
      label: t("quotation.filterStateTitle"),
      value: stateFilter,
      onChange: onStateFilterChange,
      allValue: "all",
      allLabel: t("quotation.filterAllStates"),
      options: [
        { value: "valid", label: t("quotation.filterStateValid") },
        { value: "expired", label: t("quotation.filterStateExpired") },
      ],
    },
    {
      id: "amount",
      type: "numberRange",
      section: "advanced",
      label: t("quotation.filterAmountTitle"),
      prefix: "฿",
      min: amountMin,
      max: amountMax,
      onMinChange: onAmountMinChange,
      onMaxChange: onAmountMaxChange,
      placeholderMin: t("filterControls.min"),
      placeholderMax: t("filterControls.max"),
    },
    {
      id: "product",
      type: "select",
      section: "advanced",
      label: t("quotation.filterProductTitle"),
      value: selectedProduct,
      onChange: onSelectedProductChange,
      allValue: "",
      allLabel: t("quotation.filterAllProducts"),
      options: productOptions,
    },
    {
      id: "vat",
      type: "select",
      section: "advanced",
      label: t("quotation.filterVatTitle"),
      value: vatFilter,
      onChange: onVatFilterChange,
      allValue: "all",
      allLabel: t("quotation.filterAllVat"),
      options: [
        { value: "included", label: t("quotation.filterVatIncluded") },
        { value: "not_included", label: t("quotation.filterVatExcluded") },
        { value: "none", label: t("quotation.filterVatNone") },
      ],
    },
  ];

  return (
    <>
      <UniversalFilter
        search={{
          value: searchTerm,
          onChange: onSearchTermChange,
          placeholder: t("quotation.quotationSearchPlaceholder"),
        }}
        meta={t("quotation.shownCount", {
          shown: filteredQuotations.length,
          total: quotations.length,
        })}
        fields={filterFields}
        quickFilters={quickPresets}
        activeChips={activeChips}
        onReset={onResetFilters}
        labels={{
          more: t("filterControls.moreFilters"),
          reset: t("filterControls.resetFilter"),
          quick: t("filterControls.quickFilters"),
          clearAll: t("filterControls.clearAll"),
        }}
      />

      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("quotation.historyEyebrow")}</p>
            <h3>{t("quotation.historyTitle")}</h3>
          </div>
          <div className="transaction-table-actions">
            <button className="primary-button" type="button" onClick={onCreateQuotation}>
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
                    const quotationState = getQuotationState(quotation);

                    return (
                      <tr key={quotation.id || quotation.reference_no}>
                        <td className="table-index-cell">{rowNumber}</td>
                        <td>
                          <div className="transaction-reference-cell">
                            <strong>{quotation.reference_no || "—"}</strong>
                            <span className={`quotation-state-pill ${quotationState.toLowerCase()}`}>
                              {quotationState === "Valid"
                                ? t("quotation.stateValid")
                                : t("quotation.stateExpired")}
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
                              {formatDate(quotation.quotation_date)}
                            </span>
                            <span>
                              {t("quotation.validUntilRow", {
                                date: formatDate(quotation.valid_until_date),
                              })}
                            </span>
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
                            onClick={() => onViewQuotation(quotation)}
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
                const quotationState = getQuotationState(quotation);

                return (
                  <article
                    className="mobile-record-card"
                    key={`mobile-quotation-${quotation.id || quotation.reference_no}`}
                  >
                    <div className="mobile-record-header">
                      <div className="mobile-record-title">
                        <span className="mobile-record-index">{rowNumber}</span>
                        <div className="cell-stack">
                          <strong>{quotation.reference_no || "—"}</strong>
                          <span>{quotation.customer_name || "—"}</span>
                        </div>
                      </div>
                      <span className={`quotation-state-pill ${quotationState.toLowerCase()}`}>
                        {quotationState === "Valid"
                          ? t("quotation.stateValid")
                          : t("quotation.stateExpired")}
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
                      onClick={() => onViewQuotation(quotation)}
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
          pagination={pagination}
          itemLabel={t("quotation.paginationLabel")}
          onPageChange={onPageChange}
        />
      </section>
    </>
  );
}

export default QuotationDirectorySection;
