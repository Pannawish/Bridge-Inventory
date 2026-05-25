import PaginationControls from "../PaginationControls";
import { FilterPresets, ActiveFilterChips, RangeField } from "../FilterControls";
import { formatDate, formatMoney as fmt } from "../../format";
import { useLanguage } from "../../i18n/LanguageContext";
import { getItemCount, getQuotationState } from "./quotationUtils";

function QuotationDirectorySection({
  quotations = [],
  filteredQuotations = [],
  paginatedQuotations = [],
  searchTerm,
  onSearchTermChange,
  filterOpen,
  onToggleFilter,
  activeFilterCount = 0,
  onResetFilters,
  quickPresets = [],
  activeChips = [],
  selectedCustomer,
  onSelectedCustomerChange,
  customerOptions = [],
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

  return (
    <>
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
              onChange={(event) => onSearchTermChange(event.target.value)}
              placeholder={t("quotation.quotationSearchPlaceholder")}
            />
          </label>
          <div className="stock-report-summary supplier-search-meta">
            <span>
              {t("quotation.shownCount", {
                shown: filteredQuotations.length,
                total: quotations.length,
              })}
            </span>
          </div>
        </div>

        <div className="history-filter-actions">
          <button
            className="secondary-button product-filter-toggle"
            type="button"
            aria-expanded={filterOpen}
            onClick={onToggleFilter}
          >
            {t("quotation.filterButton")}
            {activeFilterCount ? <span>{activeFilterCount}</span> : null}
          </button>
          <button className="secondary-button" type="button" onClick={onResetFilters}>
            {t("quotation.resetFilterButton")}
          </button>
        </div>

        <FilterPresets presets={quickPresets} />
        <ActiveFilterChips chips={activeChips} onClearAll={onResetFilters} />

        {filterOpen ? (
          <div className="history-filter-panel">
            <div className="history-filter-grid">
              <label className="history-filter-field">
                <span className="history-filter-title">
                  {t("quotation.filterCustomerTitle")}
                </span>
                <select
                  value={selectedCustomer}
                  onChange={(event) => onSelectedCustomerChange(event.target.value)}
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
                  onChange={(event) => onStateFilterChange(event.target.value)}
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
                  onChange={(event) => onVatFilterChange(event.target.value)}
                >
                  <option value="all">{t("quotation.filterAllVat")}</option>
                  <option value="included">{t("quotation.filterVatIncluded")}</option>
                  <option value="not_included">{t("quotation.filterVatExcluded")}</option>
                  <option value="none">{t("quotation.filterVatNone")}</option>
                </select>
              </label>

              <label className="history-filter-field">
                <span className="history-filter-title">
                  {t("quotation.filterDateFromTitle")}
                </span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => onDateFromChange(event.target.value)}
                />
              </label>

              <label className="history-filter-field">
                <span className="history-filter-title">{t("quotation.filterDateToTitle")}</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(event) => onDateToChange(event.target.value)}
                />
              </label>

              <RangeField
                title={t("quotation.filterAmountTitle")}
                prefix="฿"
                minValue={amountMin}
                maxValue={amountMax}
                onMinChange={onAmountMinChange}
                onMaxChange={onAmountMaxChange}
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
                              {quotation.quotation_date || "—"}
                            </span>
                            <span>
                              {t("quotation.validUntilRow", {
                                date: quotation.valid_until_date || "—",
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
