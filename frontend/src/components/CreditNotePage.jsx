import { useEffect, useMemo, useState } from "react";
import { formatDate, formatMoney as fmt } from "../format";
import CreateCreditNoteModal from "./credits/CreateCreditNoteModal";
import CreditNoteDetailModal from "./credits/CreditNoteDetailModal";
import CreditNoteStatusPill from "./credits/CreditNoteStatusPill";
import {
  creditNoteInDateRange,
  creditNoteMatchesQuery,
  daysAgoString,
  formatCreditNoteStatus,
  getToday,
} from "./credits/creditNoteUtils";
import DocumentRefChip from "./DocumentRefChip";
import DocumentRefModal from "./DocumentRefModal";
import PaginationControls from "./PaginationControls";
import {
  FilterPresets,
  ActiveFilterChips,
  RangeField,
  withinRange,
} from "./FilterControls";
import { useLanguage } from "../i18n/LanguageContext";

function CreditNotePage({
  creditNotes = [],
  allCreditNotes = creditNotes,
  billingNotes = [],
  sales = [],
  nextReferenceNo = "",
  pagination = null,
  onPageRequest,
  onCreateCreditNote,
  onUpdateCreditNote,
  onDeleteCreditNote,
}) {
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [showAllRows, setShowAllRows] = useState(false);
  const [creating, setCreating] = useState(false);
  const [activeCreditNote, setActiveCreditNote] = useState(null);
  const [docRefModal, setDocRefModal] = useState(null);
  const STATUS_OPTIONS = [
    { value: "issued", label: t("creditNote.statusIssued") },
    { value: "cancelled", label: t("creditNote.statusCancelled") },
  ];

  function renderListRef(docType, docId, referenceNo) {
    if (!docId) return "—";
    return (
      <DocumentRefChip
        label={referenceNo || docId}
        docType={docType}
        onClick={() =>
          setDocRefModal({ docType, docId, referenceNo: referenceNo || docId })
        }
      />
    );
  }

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const isServerPaginated = Boolean(pagination && onPageRequest);

  const filtered = useMemo(() => {
    if (isServerPaginated) {
      return creditNotes;
    }
    return creditNotes.filter((note) => {
      if (normalizedSearch && !creditNoteMatchesQuery(note, normalizedSearch, t)) {
        return false;
      }
      if (statusFilter !== "all" && note.status !== statusFilter) {
        return false;
      }
      if (!creditNoteInDateRange(note, dateFrom, dateTo)) {
        return false;
      }
      if (!withinRange(note.total_amount, amountMin, amountMax)) {
        return false;
      }
      return true;
    });
  }, [
    amountMin,
    amountMax,
    creditNotes,
    dateFrom,
    dateTo,
    isServerPaginated,
    normalizedSearch,
    statusFilter,
  ]);

  const compactRows = 5;
  const shouldShowViewAll = !isServerPaginated && filtered.length > compactRows;
  const isCompact = shouldShowViewAll && !showAllRows;
  const totalCreditNoteCount = pagination?.count ?? creditNotes.length;

  const summary = useMemo(() => {
    let issued = 0;
    let cancelled = 0;
    allCreditNotes.forEach((note) => {
      if (note.status === "cancelled") {
        cancelled += Number(note.total_amount) || 0;
      } else {
        issued += Number(note.total_amount) || 0;
      }
    });
    return { issued, cancelled, count: allCreditNotes.length };
  }, [allCreditNotes]);

  const activeFilterCount =
    (statusFilter !== "all" ? 1 : 0) +
    (dateFrom || dateTo ? 1 : 0) +
    (amountMin ? 1 : 0) +
    (amountMax ? 1 : 0);

  function resetFilters() {
    setSearchTerm("");
    setStatusFilter("all");
    setDateFrom("");
    setDateTo("");
    setAmountMin("");
    setAmountMax("");
    setFilterOpen(false);
  }

  const last30Active = dateFrom === daysAgoString(30) && !dateTo;
  const quickPresets = [
    {
      label: t("creditNote.filterLastDays"),
      active: last30Active,
      onClick: () => {
        setDateFrom(last30Active ? "" : daysAgoString(30));
        setDateTo("");
      },
    },
    {
      label: t("creditNote.filterIssued"),
      active: statusFilter === "issued",
      onClick: () =>
        setStatusFilter((current) =>
          current === "issued" ? "all" : "issued"
        ),
    },
    {
      label: t("creditNote.filterCancelled"),
      active: statusFilter === "cancelled",
      onClick: () =>
        setStatusFilter((current) =>
          current === "cancelled" ? "all" : "cancelled"
        ),
    },
  ];
  const activeChips = [
    statusFilter !== "all" && {
      key: "status",
      label: t("filterControls.statusChip", {
        label: formatCreditNoteStatus(statusFilter, t),
      }),
      onRemove: () => setStatusFilter("all"),
    },
    dateFrom && {
      key: "dateFrom",
      label: t("filterControls.fromChip", { date: dateFrom }),
      onRemove: () => setDateFrom(""),
    },
    dateTo && {
      key: "dateTo",
      label: t("filterControls.toChip", { date: dateTo }),
      onRemove: () => setDateTo(""),
    },
    amountMin && {
      key: "amountMin",
      label: t("filterControls.minChip", { value: amountMin }),
      onRemove: () => setAmountMin(""),
    },
    amountMax && {
      key: "amountMax",
      label: t("filterControls.maxChip", { value: amountMax }),
      onRemove: () => setAmountMax(""),
    },
  ].filter(Boolean);

  function getPageRequestParams(page = 1) {
    return {
      page,
      search: searchTerm,
      status: statusFilter === "all" ? "" : statusFilter,
      dateFrom,
      dateTo,
      amountMin,
      amountMax,
    };
  }

  useEffect(() => {
    if (!isServerPaginated) {
      return undefined;
    }
    const timeoutId = window.setTimeout(() => {
      onPageRequest(getPageRequestParams(1));
    }, 250);
    return () => window.clearTimeout(timeoutId);
  }, [
    amountMin,
    amountMax,
    dateFrom,
    dateTo,
    isServerPaginated,
    onPageRequest,
    searchTerm,
    statusFilter,
  ]);

  async function handleCreate(payload) {
    const saved = await onCreateCreditNote?.(payload);
    if (saved !== false) {
      setCreating(false);
    }
  }

  async function handleSave(updated) {
    const saved = await onUpdateCreditNote?.(updated);
    if (saved !== false) {
      setActiveCreditNote(null);
    }
  }

  async function handleDelete(note) {
    if (!window.confirm(t("creditNote.deleteConfirm", { ref: note.reference_no || note.id }))) {
      return;
    }
    const ok = await onDeleteCreditNote?.(note);
    if (ok !== false) {
      setActiveCreditNote(null);
    }
  }

  if (creating) {
    return (
      <div className="stack-layout">
        <CreateCreditNoteModal
          sales={sales}
          billingNotes={billingNotes}
          creditNotes={allCreditNotes}
          nextReferenceNo={nextReferenceNo}
          onClose={() => setCreating(false)}
          onCreate={handleCreate}
        />
      </div>
    );
  }

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
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={t("creditNote.searchPlaceholder")}
            />
          </label>
          <div className="stock-report-summary supplier-search-meta">
            <span>
              {isServerPaginated
                ? t("creditNote.pageCountServer", { count: filtered.length, total: totalCreditNoteCount })
                : t("creditNote.pageCountLocal", { count: filtered.length, total: creditNotes.length })}
            </span>
          </div>
        </div>

        <div className="history-filter-actions">
          <button
            className="secondary-button product-filter-toggle"
            type="button"
            aria-expanded={filterOpen}
            onClick={() => setFilterOpen((value) => !value)}
          >
            {t("filterControls.filter")}
            {activeFilterCount ? <span>{activeFilterCount}</span> : null}
          </button>
          <button className="secondary-button" type="button" onClick={resetFilters}>
            {t("filterControls.resetFilter")}
          </button>
        </div>

        <FilterPresets presets={quickPresets} />
        <ActiveFilterChips chips={activeChips} onClearAll={resetFilters} />

        {filterOpen ? (
          <div className="history-filter-panel">
            <div className="history-filter-grid">
              <label className="history-filter-field">
                <span className="history-filter-title">{t("common.status")}</span>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="all">{t("filterControls.allStatuses")}</option>
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="history-filter-field">
                <span className="history-filter-title">{t("filterControls.from")}</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                />
              </label>
              <label className="history-filter-field">
                <span className="history-filter-title">{t("filterControls.to")}</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                />
              </label>
              <RangeField
                title={t("creditNote.creditAmountBaht")}
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
            <p className="eyebrow">{t("creditNote.historyEyebrow")}</p>
            <h3>{t("creditNote.historyTitle")}</h3>
          </div>
          <div className="transaction-table-actions">
            <button
              className="primary-button"
              type="button"
              onClick={() => setCreating(true)}
            >
              {t("creditNote.createButton")}
            </button>
            {shouldShowViewAll ? (
              <button
                className="secondary-button"
                type="button"
                onClick={() => setShowAllRows((value) => !value)}
              >
                {showAllRows ? t("common.showRecent") : t("common.viewMore")}
              </button>
            ) : null}
          </div>
        </div>

        {filtered.length === 0 ? (
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
                  {filtered.map((note, index) => (
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
                          onClick={() => setActiveCreditNote(note)}
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
              {filtered.map((note, index) => (
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
                      <strong>
                        {renderListRef("sale", note.sale, note.sale_reference_no)}
                      </strong>
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
                    onClick={() => setActiveCreditNote(note)}
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
          onPageChange={(page) => onPageRequest?.(getPageRequestParams(page))}
        />
      </section>

      {activeCreditNote ? (
        <CreditNoteDetailModal
          key={activeCreditNote.id}
          creditNote={activeCreditNote}
          billingNotes={billingNotes}
          onClose={() => setActiveCreditNote(null)}
          onSave={handleSave}
          onDelete={handleDelete}
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

export default CreditNotePage;
