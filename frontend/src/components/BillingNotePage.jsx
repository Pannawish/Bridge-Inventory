import { useEffect, useMemo, useState } from "react";
import { formatDate, formatMoney as fmt } from "../format";
import BillingNoteDetailModal from "./billing/BillingNoteDetailModal";
import CreateBillingNoteModal from "./billing/CreateBillingNoteModal";
import BillingNoteStatusPill from "./billing/BillingNoteStatusPill";
import {
  billingNoteInDateRange,
  billingNoteMatchesQuery,
  daysAgoString,
  formatBillingNoteStatus,
  getToday,
} from "./billing/billingNoteUtils";
import PaginationControls from "./PaginationControls";
import {
  FilterPresets,
  ActiveFilterChips,
  RangeField,
  withinRange,
} from "./FilterControls";
import { useLanguage } from "../i18n/LanguageContext";

function BillingNotePage({
  billingNotes = [],
  allBillingNotes = billingNotes,
  customers = [],
  sales = [],
  summary: serverSummary = null,
  nextReferenceNo = "",
  pagination = null,
  onPageRequest,
  onCreateBillingNote,
  onUpdateBillingNote,
  onDeleteBillingNote,
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
  const [activeBillingNote, setActiveBillingNote] = useState(null);
  const STATUS_OPTIONS = [
    { value: "issued", label: t("billingNote.statusIssued") },
    { value: "partially_received", label: t("billingNote.statusPartiallyReceived") },
    { value: "fully_received", label: t("billingNote.statusFullyReceived") },
    { value: "cancelled", label: t("billingNote.statusCancelled") },
  ];

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const isServerPaginated = Boolean(pagination && onPageRequest);
  const filtered = useMemo(() => {
    if (isServerPaginated) {
      return billingNotes;
    }

    return billingNotes.filter((note) => {
      if (normalizedSearch && !billingNoteMatchesQuery(note, normalizedSearch, t)) {
        return false;
      }
      if (statusFilter !== "all" && note.status !== statusFilter) {
        return false;
      }
      if (!billingNoteInDateRange(note, dateFrom, dateTo)) {
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
    billingNotes,
    dateFrom,
    dateTo,
    isServerPaginated,
    normalizedSearch,
    statusFilter,
  ]);

  const compactRows = 5;
  const shouldShowViewAll = !isServerPaginated && filtered.length > compactRows;
  const isCompact = shouldShowViewAll && !showAllRows;
  const totalBillingNoteCount = pagination?.count ?? billingNotes.length;

  const computedSummary = useMemo(() => {
    const today = getToday();
    let outstanding = 0;
    let overdue = 0;
    let received = 0;
    allBillingNotes.forEach((note) => {
      if (note.status === "fully_received") {
        received += Number(note.total_amount) || 0;
      } else if (note.status !== "cancelled") {
        outstanding += Number(note.total_amount) || 0;
        if (note.expected_payment_date && note.expected_payment_date < today) {
          overdue += Number(note.total_amount) || 0;
        }
      }
    });
    return { outstanding, overdue, received };
  }, [allBillingNotes]);
  const summary = serverSummary || computedSummary;

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
      label: t("billingNote.filterLastDays"),
      active: last30Active,
      onClick: () => {
        setDateFrom(last30Active ? "" : daysAgoString(30));
        setDateTo("");
      },
    },
    {
      label: t("billingNote.filterAwaiting"),
      active: statusFilter === "issued",
      onClick: () =>
        setStatusFilter((current) =>
          current === "issued" ? "all" : "issued"
        ),
    },
    {
      label: t("billingNote.filterFullyReceived"),
      active: statusFilter === "fully_received",
      onClick: () =>
        setStatusFilter((current) =>
          current === "fully_received" ? "all" : "fully_received"
        ),
    },
  ];
  const activeChips = [
    statusFilter !== "all" && {
      key: "status",
      label: t("filterControls.statusChip", {
        label: formatBillingNoteStatus(statusFilter, t),
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
    const saved = await onCreateBillingNote?.(payload);
    if (saved !== false) {
      setCreating(false);
    }
  }

  async function handleSave(updated) {
    const saved = await onUpdateBillingNote?.(updated);
    if (saved !== false) {
      setActiveBillingNote(null);
    }
  }

  async function handleDelete(note) {
    if (!window.confirm(t("billingNote.deleteBN", { ref: note.reference_no || note.id }))) {
      return;
    }
    const ok = await onDeleteBillingNote?.(note);
    if (ok !== false) {
      setActiveBillingNote(null);
    }
  }

  if (creating) {
    return (
      <div className="stack-layout">
        <CreateBillingNoteModal
          sales={sales}
          billingNotes={allBillingNotes}
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
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={t("billingNote.searchPlaceholder")}
            />
          </label>
          <div className="stock-report-summary supplier-search-meta">
            <span>
              {isServerPaginated
                ? t("billingNote.pageCountServer", { count: filtered.length, total: totalBillingNoteCount })
                : t("billingNote.pageCountLocal", { count: filtered.length, total: billingNotes.length })}
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
                title={t("filterControls.amountBaht")}
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
            <p className="eyebrow">{t("billingNote.historyEyebrow")}</p>
            <h3>{t("billingNote.historyTitle")}</h3>
          </div>
          <div className="transaction-table-actions">
            <button
              className="primary-button"
              type="button"
              onClick={() => setCreating(true)}
            >
              {t("billingNote.createButton")}
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
                  {filtered.map((note, index) => (
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
                          onClick={() => setActiveBillingNote(note)}
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
                <article
                  className="mobile-record-card"
                  key={`mobile-bn-${note.id}`}
                >
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
                    onClick={() => setActiveBillingNote(note)}
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
          onPageChange={(page) => onPageRequest?.(getPageRequestParams(page))}
        />
      </section>

      {activeBillingNote ? (
        <BillingNoteDetailModal
          key={activeBillingNote.id}
          billingNote={activeBillingNote}
          onClose={() => setActiveBillingNote(null)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      ) : null}
    </div>
  );
}

export default BillingNotePage;
