import { formatDate, formatMoney as fmt } from "../../format";
import { useLanguage } from "../../i18n/LanguageContext";
import PaginationControls from "../PaginationControls";
import BillingNoteStatusPill from "./BillingNoteStatusPill";
import {
  FilterPresets,
  ActiveFilterChips,
  FilterCombobox,
  RangeField,
} from "../FilterControls";

function BillingNoteDirectorySection({
  billingNotes = [],
  filteredBillingNotes = [],
  summary,
  pagination = null,
  isServerPaginated = false,
  totalBillingNoteCount = 0,
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
  customerFilter,
  onCustomerFilterChange,
  customerOptions = [],
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
  activeBillingNote,
  onSelectBillingNote,
  onCreateBillingNote,
  onPageChange,
}) {
  const { t } = useLanguage();

  return (
    <div className="stack-layout">
      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("billingNote.receivablesEyebrow")}</p>
            <h3>{t("billingNote.receivablesTitle")}</h3>
          </div>
        </div>

        <div className="dashboard-summary-grid">
          <article className="dashboard-kpi-card neutral">
            <p>{t("billingNote.outstanding")}</p>
            <strong>{fmt(summary.outstanding)}</strong>
            <span>{t("billingNote.outstandingDesc")}</span>
          </article>
          <article className="dashboard-kpi-card danger">
            <p>{t("billingNote.overdue")}</p>
            <strong>{fmt(summary.overdue)}</strong>
            <span>{t("billingNote.overdueDesc")}</span>
          </article>
          <article className="dashboard-kpi-card positive">
            <p>{t("billingNote.received")}</p>
            <strong>{fmt(summary.received)}</strong>
            <span>{t("billingNote.receivedDesc")}</span>
          </article>
        </div>
      </section>

      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("billingNote.searchEyebrow")}</p>
            <h3>{t("billingNote.searchTitle")}</h3>
          </div>
        </div>

        <div className="supplier-directory-toolbar">
          <label className="stock-search supplier-search">
            <span className="stock-search-icon">S</span>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => onSearchTermChange(event.target.value)}
              placeholder={t("billingNote.searchPlaceholder")}
            />
          </label>
          <div className="stock-report-summary supplier-search-meta">
            <span>
              {isServerPaginated
                ? t("billingNote.pageCountServer", {
                    count: filteredBillingNotes.length,
                    total: totalBillingNoteCount,
                  })
                : t("billingNote.pageCountLocal", {
                    count: filteredBillingNotes.length,
                    total: billingNotes.length,
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
                id="billing-note-customer-filter"
                title={t("billingNote.customerFilter")}
                value={customerFilter}
                options={customerOptions}
                placeholder={t("billingNote.searchCustomerPlaceholder")}
                emptyMessage={t("billingNote.noCustomerFound")}
                onChange={onCustomerFilterChange}
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
            <p className="eyebrow">{t("billingNote.historyEyebrow")}</p>
            <h3>{t("billingNote.historyTitle")}</h3>
          </div>
          <div className="transaction-table-actions">
            <button className="primary-button" type="button" onClick={onCreateBillingNote}>
              {t("billingNote.createButton")}
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

        {filteredBillingNotes.length === 0 ? (
          <p className="empty-copy">{t("billingNote.noMatch")}</p>
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
                    <th>{t("billingNote.colReference")}</th>
                    <th>{t("billingNote.colCustomer")}</th>
                    <th>{t("billingNote.colIssued")}</th>
                    <th>{t("billingNote.colExpected")}</th>
                    <th>{t("billingNote.colActual")}</th>
                    <th>{t("billingNote.colStatus")}</th>
                    <th>{t("billingNote.colTotal")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filteredBillingNotes.map((note, index) => (
                    <tr
                      key={note.id}
                      className={
                        activeBillingNote?.id === note.id
                          ? "partner-table-row active"
                          : "partner-table-row"
                      }
                    >
                      <td className="table-index-cell">{index + 1}</td>
                      <td>{note.reference_no || note.id}</td>
                      <td>{note.customer_name}</td>
                      <td>{formatDate(note.billing_note_date)}</td>
                      <td>{formatDate(note.expected_payment_date)}</td>
                      <td>{formatDate(note.actual_payment_date)}</td>
                      <td>
                        <BillingNoteStatusPill status={note.status} />
                      </td>
                      <td>{fmt(note.total_amount)}</td>
                      <td>
                        <button
                          className="table-action-button"
                          type="button"
                          onClick={() => onSelectBillingNote(note)}
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
              {filteredBillingNotes.map((note, index) => (
                <article className="mobile-record-card" key={`mobile-bn-${note.id}`}>
                  <div className="mobile-record-header">
                    <div className="mobile-record-title">
                      <span className="mobile-record-index">{index + 1}</span>
                      <div className="cell-stack">
                        <strong>{note.reference_no || note.id}</strong>
                        <span>{note.customer_name}</span>
                      </div>
                    </div>
                    <BillingNoteStatusPill status={note.status} />
                  </div>
                  <div className="mobile-record-grid">
                    <div>
                      <span>{t("billingNote.colIssued")}</span>
                      <strong>{formatDate(note.billing_note_date)}</strong>
                    </div>
                    <div>
                      <span>{t("billingNote.colExpected")}</span>
                      <strong>{formatDate(note.expected_payment_date)}</strong>
                    </div>
                    <div>
                      <span>{t("billingNote.colActual")}</span>
                      <strong>{formatDate(note.actual_payment_date)}</strong>
                    </div>
                    <div>
                      <span>{t("billingNote.colTotal")}</span>
                      <strong>{fmt(note.total_amount)}</strong>
                    </div>
                  </div>
                  <button
                    className="secondary-button table-action-button mobile-record-button"
                    type="button"
                    onClick={() => onSelectBillingNote(note)}
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
          itemLabel={t("billingNote.historyTitle")}
          onPageChange={onPageChange}
        />
      </section>
    </div>
  );
}

export default BillingNoteDirectorySection;
