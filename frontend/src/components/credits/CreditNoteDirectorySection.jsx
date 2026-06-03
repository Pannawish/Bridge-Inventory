import { formatDate, formatMoney as fmt } from "../../format";
import { useLanguage } from "../../i18n/LanguageContext";
import {
  FilterPresets,
  ActiveFilterChips,
  FilterCombobox,
  RangeField,
} from "../FilterControls";
import PaginationControls from "../PaginationControls";
import CreditNoteStatusPill from "./CreditNoteStatusPill";

function CreditNoteDirectorySection({
  creditNotes = [],
  filteredCreditNotes = [],
  summary,
  pagination = null,
  isServerPaginated = false,
  totalCreditNoteCount = 0,
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
  activeCreditNote,
  onSelectCreditNote,
  onCreateCreditNote,
  renderListRef,
  onPageChange,
}) {
  const { t } = useLanguage();

  return (
    <div className="stack-layout">
      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("creditNote.receivablesEyebrow")}</p>
            <h3>{t("creditNote.pageTitle")}</h3>
          </div>
        </div>

        <div className="dashboard-summary-grid">
          <article className="dashboard-kpi-card neutral">
            <p>{t("creditNote.issuedCredits")}</p>
            <strong>{fmt(summary.issued)}</strong>
            <span>{t("creditNote.issuedCreditsDesc")}</span>
          </article>
          <article className="dashboard-kpi-card danger">
            <p>{t("creditNote.cancelledCredits")}</p>
            <strong>{fmt(summary.cancelled)}</strong>
            <span>{t("creditNote.cancelledCreditsDesc")}</span>
          </article>
          <article className="dashboard-kpi-card positive">
            <p>{t("creditNote.creditNotesCount")}</p>
            <strong>{summary.count}</strong>
            <span>{t("creditNote.creditNotesCountDesc")}</span>
          </article>
        </div>
      </section>

      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("creditNote.searchEyebrow")}</p>
            <h3>{t("creditNote.searchTitle")}</h3>
          </div>
        </div>

        <div className="supplier-directory-toolbar">
          <label className="stock-search supplier-search">
            <span className="stock-search-icon">S</span>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => onSearchTermChange(event.target.value)}
              placeholder={t("creditNote.searchPlaceholder")}
            />
          </label>
          <div className="stock-report-summary supplier-search-meta">
            <span>
              {isServerPaginated
                ? t("creditNote.pageCountServer", {
                    count: filteredCreditNotes.length,
                    total: totalCreditNoteCount,
                  })
                : t("creditNote.pageCountLocal", {
                    count: filteredCreditNotes.length,
                    total: creditNotes.length,
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
                id="credit-note-customer-filter"
                title={t("creditNote.customerFilter")}
                value={customerFilter}
                options={customerOptions}
                placeholder={t("creditNote.searchCustomerPlaceholder")}
                emptyMessage={t("creditNote.noCustomerFound")}
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
                title={t("creditNote.creditAmountBaht")}
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
            <p className="eyebrow">{t("creditNote.historyEyebrow")}</p>
            <h3>{t("creditNote.historyTitle")}</h3>
          </div>
          <div className="transaction-table-actions">
            <button
              className="primary-button"
              type="button"
              onClick={onCreateCreditNote}
            >
              {t("creditNote.createButton")}
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

        {filteredCreditNotes.length === 0 ? (
          <p className="empty-copy">{t("creditNote.noMatch")}</p>
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
                    <th>{t("creditNote.colReference")}</th>
                    <th>{t("creditNote.colCustomer")}</th>
                    <th>{t("creditNote.colSaleRef")}</th>
                    <th>{t("creditNote.colBillingNote")}</th>
                    <th>{t("creditNote.colDate")}</th>
                    <th>{t("creditNote.colStatus")}</th>
                    <th>{t("creditNote.colTotal")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filteredCreditNotes.map((note, index) => (
                    <tr
                      key={note.id}
                      className={
                        activeCreditNote?.id === note.id
                          ? "partner-table-row active"
                          : "partner-table-row"
                      }
                    >
                      <td className="table-index-cell">{index + 1}</td>
                      <td>{note.reference_no || note.id}</td>
                      <td>{note.customer_name}</td>
                      <td>{renderListRef("sale", note.sale, note.sale_reference_no)}</td>
                      <td>
                        {renderListRef(
                          "billing-note",
                          note.billing_note,
                          note.billing_note_reference_no
                        )}
                      </td>
                      <td>{formatDate(note.credit_note_date)}</td>
                      <td>
                        <CreditNoteStatusPill status={note.status} />
                      </td>
                      <td>{fmt(note.total_amount)}</td>
                      <td>
                        <button
                          className="table-action-button"
                          type="button"
                          onClick={() => onSelectCreditNote(note)}
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
              {filteredCreditNotes.map((note, index) => (
                <article className="mobile-record-card" key={`mobile-cn-${note.id}`}>
                  <div className="mobile-record-header">
                    <div className="mobile-record-title">
                      <span className="mobile-record-index">{index + 1}</span>
                      <div className="cell-stack">
                        <strong>{note.reference_no || note.id}</strong>
                        <span>{note.customer_name}</span>
                      </div>
                    </div>
                    <CreditNoteStatusPill status={note.status} />
                  </div>
                  <div className="mobile-record-grid">
                    <div>
                      <span>{t("creditNote.colSaleRef")}</span>
                      <strong>{renderListRef("sale", note.sale, note.sale_reference_no)}</strong>
                    </div>
                    <div>
                      <span>{t("creditNote.colBillingNote")}</span>
                      <strong>
                        {renderListRef(
                          "billing-note",
                          note.billing_note,
                          note.billing_note_reference_no
                        )}
                      </strong>
                    </div>
                    <div>
                      <span>{t("creditNote.colDate")}</span>
                      <strong>{formatDate(note.credit_note_date)}</strong>
                    </div>
                    <div>
                      <span>{t("creditNote.colTotal")}</span>
                      <strong>{fmt(note.total_amount)}</strong>
                    </div>
                  </div>
                  <button
                    className="secondary-button table-action-button mobile-record-button"
                    type="button"
                    onClick={() => onSelectCreditNote(note)}
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
          itemLabel={t("creditNote.historyTitle")}
          onPageChange={onPageChange}
        />
      </section>
    </div>
  );
}

export default CreditNoteDirectorySection;
