import { formatDate, formatMoney as fmt } from "../../format";
import { useLanguage } from "../../i18n/LanguageContext";
import UniversalFilter from "../filters/UniversalFilter";
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

  // WHO → WHEN → $ → STATUS, all in the always-visible row (no More needed).
  const filterFields = [
    {
      id: "customer",
      type: "combobox",
      section: "primary",
      label: t("creditNote.customerFilter"),
      value: customerFilter,
      onChange: onCustomerFilterChange,
      options: customerOptions,
      allValue: "",
      placeholder: t("creditNote.searchCustomerPlaceholder"),
      emptyMessage: t("creditNote.noCustomerFound"),
    },
    {
      id: "date",
      type: "daterange",
      section: "primary",
      span: 2,
      label: t("filterControls.dateRange"),
      from: dateFrom,
      to: dateTo,
      onFromChange: onDateFromChange,
      onToChange: onDateToChange,
    },
    {
      id: "amount",
      type: "numberRange",
      section: "primary",
      label: t("creditNote.creditAmountBaht"),
      prefix: "฿",
      min: amountMin,
      max: amountMax,
      onMinChange: onAmountMinChange,
      onMaxChange: onAmountMaxChange,
      placeholderMin: t("filterControls.min"),
      placeholderMax: t("filterControls.max"),
    },
    {
      id: "status",
      type: "select",
      section: "primary",
      label: t("common.status"),
      value: statusFilter,
      onChange: onStatusFilterChange,
      allValue: "all",
      allLabel: t("filterControls.allStatuses"),
      options: statusOptions,
    },
  ];

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

      <UniversalFilter
        className="uf-dense"
        search={{
          value: searchTerm,
          onChange: onSearchTermChange,
          placeholder: t("creditNote.searchPlaceholder"),
        }}
        meta={t(
          isServerPaginated ? "creditNote.pageCountServer" : "creditNote.pageCountLocal",
          {
            count: filteredCreditNotes.length,
            total: isServerPaginated ? totalCreditNoteCount : creditNotes.length,
          }
        )}
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
