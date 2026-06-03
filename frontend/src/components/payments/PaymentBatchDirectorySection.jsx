import { formatDate, formatMoney as fmt } from "../../format";
import { useLanguage } from "../../i18n/LanguageContext";
import {
  FilterPresets,
  ActiveFilterChips,
  FilterCombobox,
  RangeField,
} from "../FilterControls";
import PaginationControls from "../PaginationControls";
import PaymentBatchStatusPill from "./PaymentBatchStatusPill";

function PaymentBatchDirectorySection({
  paymentBatches = [],
  filteredPaymentBatches = [],
  summary,
  pagination = null,
  isServerPaginated = false,
  totalPaymentBatchCount = 0,
  searchTerm,
  onSearchTermChange,
  filterOpen,
  onToggleFilter,
  activeFilterCount = 0,
  onResetFilters,
  quickPresets = [],
  activeChips = [],
  statusFilter,
  onStatusFilterChange,
  statusOptions = [],
  supplierFilter,
  onSupplierFilterChange,
  supplierOptions = [],
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  amountMin,
  onAmountMinChange,
  amountMax,
  onAmountMaxChange,
  shouldShowViewAll = false,
  showAllRows = false,
  onToggleShowAllRows,
  isCompact = false,
  activeBatch,
  onSelectBatch,
  onCreatePaymentBatch,
  onPageChange,
}) {
  const { t } = useLanguage();

  return (
    <div className="stack-layout">
      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("paymentBatch.payablesEyebrow")}</p>
            <h3>{t("paymentBatch.payablesTitle")}</h3>
          </div>
        </div>

        <div className="dashboard-summary-grid">
          <article className="dashboard-kpi-card neutral">
            <p>{t("paymentBatch.outstanding")}</p>
            <strong>{fmt(summary.outstanding)}</strong>
            <span>{t("paymentBatch.outstandingDesc")}</span>
          </article>
          <article className="dashboard-kpi-card danger">
            <p>{t("paymentBatch.overdue")}</p>
            <strong>{fmt(summary.overdue)}</strong>
            <span>{t("paymentBatch.overdueDesc")}</span>
          </article>
          <article className="dashboard-kpi-card positive">
            <p>{t("paymentBatch.paid")}</p>
            <strong>{fmt(summary.paid)}</strong>
            <span>{t("paymentBatch.paidDesc")}</span>
          </article>
        </div>
      </section>

      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("paymentBatch.searchEyebrow")}</p>
            <h3>{t("paymentBatch.searchTitle")}</h3>
          </div>
        </div>

        <div className="supplier-directory-toolbar">
          <label className="stock-search supplier-search">
            <span className="stock-search-icon">S</span>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => onSearchTermChange(event.target.value)}
              placeholder={t("paymentBatch.searchPlaceholder")}
            />
          </label>
          <div className="stock-report-summary supplier-search-meta">
            <span>
              {isServerPaginated
                ? t("paymentBatch.pageCountServer", {
                    count: filteredPaymentBatches.length,
                    total: totalPaymentBatchCount,
                  })
                : t("paymentBatch.pageCountLocal", {
                    count: filteredPaymentBatches.length,
                    total: paymentBatches.length,
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
            {t("filterControls.filter")}
            {activeFilterCount ? <span>{activeFilterCount}</span> : null}
          </button>
          <button className="secondary-button" type="button" onClick={onResetFilters}>
            {t("filterControls.resetFilter")}
          </button>
        </div>

        <FilterPresets presets={quickPresets} />
        <ActiveFilterChips chips={activeChips} onClearAll={onResetFilters} />

        {filterOpen ? (
          <div className="history-filter-panel">
            <div className="history-filter-grid">
              <label className="history-filter-field">
                <span className="history-filter-title">{t("common.status")}</span>
                <select
                  value={statusFilter}
                  onChange={(event) => onStatusFilterChange(event.target.value)}
                >
                  <option value="all">{t("filterControls.allStatuses")}</option>
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <FilterCombobox
                id="payment-batch-supplier-filter"
                title={t("paymentBatch.supplierFilter")}
                value={supplierFilter}
                options={supplierOptions}
                placeholder={t("paymentBatch.searchSupplierPlaceholder")}
                emptyMessage={t("paymentBatch.noSupplierFound")}
                onChange={onSupplierFilterChange}
              />
              <label className="history-filter-field">
                <span className="history-filter-title">{t("filterControls.from")}</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => onDateFromChange(event.target.value)}
                />
              </label>
              <label className="history-filter-field">
                <span className="history-filter-title">{t("filterControls.to")}</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(event) => onDateToChange(event.target.value)}
                />
              </label>
              <RangeField
                title={t("filterControls.amountBaht")}
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
            <p className="eyebrow">{t("paymentBatch.historyEyebrow")}</p>
            <h3>{t("paymentBatch.historyTitle")}</h3>
          </div>
          <div className="transaction-table-actions">
            <button
              className="primary-button"
              type="button"
              onClick={onCreatePaymentBatch}
            >
              {t("paymentBatch.createButton")}
            </button>
            {shouldShowViewAll ? (
              <button
                className="secondary-button"
                type="button"
                onClick={onToggleShowAllRows}
              >
                {showAllRows ? t("common.showRecent") : t("common.viewMore")}
              </button>
            ) : null}
          </div>
        </div>

        {filteredPaymentBatches.length === 0 ? (
          <p className="empty-copy">{t("paymentBatch.noMatch")}</p>
        ) : (
          <div
            className={
              isCompact
                ? "transaction-table-window partner-table-window compact-history"
                : "transaction-table-window partner-table-window"
            }
          >
            <div className="table-scroll desktop-table">
              <table className="transaction-history-table">
                <thead>
                  <tr>
                    <th className="table-index-cell">#</th>
                    <th>{t("paymentBatch.colReference")}</th>
                    <th>{t("paymentBatch.colSupplier")}</th>
                    <th>{t("paymentBatch.colCreated")}</th>
                    <th>{t("paymentBatch.colPlanned")}</th>
                    <th>{t("paymentBatch.colActual")}</th>
                    <th>{t("paymentBatch.colStatus")}</th>
                    <th>{t("paymentBatch.colTotal")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filteredPaymentBatches.map((batch, index) => (
                    <tr
                      key={batch.id}
                      className={
                        activeBatch?.id === batch.id
                          ? "partner-table-row active"
                          : "partner-table-row"
                      }
                    >
                      <td className="table-index-cell">{index + 1}</td>
                      <td>{batch.reference_no || batch.id}</td>
                      <td>{batch.supplier_name}</td>
                      <td>{formatDate(batch.batch_date)}</td>
                      <td>{formatDate(batch.planned_payment_date)}</td>
                      <td>{formatDate(batch.actual_payment_date)}</td>
                      <td>
                        <PaymentBatchStatusPill status={batch.status} />
                      </td>
                      <td>{fmt(batch.total_amount)}</td>
                      <td>
                        <button
                          className="table-action-button"
                          type="button"
                          onClick={() => onSelectBatch(batch)}
                        >
                          {t("common.view")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mobile-record-list">
              {filteredPaymentBatches.map((batch, index) => (
                <article className="mobile-record-card" key={`mobile-pb-${batch.id}`}>
                  <div className="mobile-record-header">
                    <div className="mobile-record-title">
                      <span className="mobile-record-index">{index + 1}</span>
                      <div className="cell-stack">
                        <strong>{batch.reference_no || batch.id}</strong>
                        <span>{batch.supplier_name}</span>
                      </div>
                    </div>
                    <PaymentBatchStatusPill status={batch.status} />
                  </div>
                  <div className="mobile-record-grid">
                    <div>
                      <span>{t("paymentBatch.colCreated")}</span>
                      <strong>{formatDate(batch.batch_date)}</strong>
                    </div>
                    <div>
                      <span>{t("paymentBatch.colPlanned")}</span>
                      <strong>{formatDate(batch.planned_payment_date)}</strong>
                    </div>
                    <div>
                      <span>{t("paymentBatch.colActual")}</span>
                      <strong>{formatDate(batch.actual_payment_date)}</strong>
                    </div>
                    <div>
                      <span>{t("paymentBatch.colTotal")}</span>
                      <strong>{fmt(batch.total_amount)}</strong>
                    </div>
                  </div>
                  <button
                    className="secondary-button table-action-button mobile-record-button"
                    type="button"
                    onClick={() => onSelectBatch(batch)}
                  >
                    {t("common.view")}
                  </button>
                </article>
              ))}
            </div>
          </div>
        )}

        <PaginationControls
          pagination={pagination}
          itemLabel={t("paymentBatch.historyTitle")}
          onPageChange={onPageChange}
        />
      </section>
    </div>
  );
}

export default PaymentBatchDirectorySection;
