import { useEffect, useMemo, useState } from "react";
import { formatDate, formatMoney as fmt } from "../format";
import CreatePaymentBatchModal from "./payments/CreatePaymentBatchModal";
import PaymentBatchDetailModal from "./payments/PaymentBatchDetailModal";
import PaymentBatchStatusPill from "./payments/PaymentBatchStatusPill";
import {
  daysAgoString,
  formatPaymentBatchStatus,
  getToday,
  paymentBatchInDateRange,
  paymentBatchMatchesQuery,
} from "./payments/paymentBatchUtils";
import PaginationControls from "./PaginationControls";
import {
  FilterPresets,
  ActiveFilterChips,
  RangeField,
  withinRange,
} from "./FilterControls";
import { useLanguage } from "../i18n/LanguageContext";

function PaymentBatchPage({
  paymentBatches = [],
  allPaymentBatches = paymentBatches,
  purchases = [],
  summary: serverSummary = null,
  nextReferenceNo = "",
  pagination = null,
  onPageRequest,
  onCreatePaymentBatch,
  onUpdatePaymentBatch,
  onDeletePaymentBatch,
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
  const [activeBatch, setActiveBatch] = useState(null);
  const STATUS_OPTIONS = [
    { value: "scheduled", label: t("paymentBatch.statusScheduled") },
    { value: "partially_paid", label: t("paymentBatch.statusPartiallyPaid") },
    { value: "paid", label: t("paymentBatch.statusPaid") },
    { value: "cancelled", label: t("paymentBatch.statusCancelled") },
  ];

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const isServerPaginated = Boolean(pagination && onPageRequest);
  const filtered = useMemo(() => {
    if (isServerPaginated) {
      return paymentBatches;
    }

    return paymentBatches.filter((batch) => {
      if (normalizedSearch && !paymentBatchMatchesQuery(batch, normalizedSearch, t)) {
        return false;
      }
      if (statusFilter !== "all" && batch.status !== statusFilter) {
        return false;
      }
      if (!paymentBatchInDateRange(batch, dateFrom, dateTo)) {
        return false;
      }
      if (!withinRange(batch.total_amount, amountMin, amountMax)) {
        return false;
      }
      return true;
    });
  }, [
    amountMin,
    amountMax,
    dateFrom,
    dateTo,
    isServerPaginated,
    normalizedSearch,
    paymentBatches,
    statusFilter,
  ]);

  const compactRows = 5;
  const shouldShowViewAll = !isServerPaginated && filtered.length > compactRows;
  const isCompact = shouldShowViewAll && !showAllRows;
  const totalPaymentBatchCount = pagination?.count ?? paymentBatches.length;

  const computedSummary = useMemo(() => {
    const today = getToday();
    let outstanding = 0;
    let overdue = 0;
    let paid = 0;
    allPaymentBatches.forEach((batch) => {
      if (batch.status === "paid") {
        paid += Number(batch.total_amount) || 0;
      } else if (batch.status !== "cancelled") {
        outstanding += Number(batch.total_amount) || 0;
        if (batch.planned_payment_date && batch.planned_payment_date < today) {
          overdue += Number(batch.total_amount) || 0;
        }
      }
    });
    return { outstanding, overdue, paid };
  }, [allPaymentBatches]);
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
      label: t("paymentBatch.filterLastDays"),
      active: last30Active,
      onClick: () => {
        setDateFrom(last30Active ? "" : daysAgoString(30));
        setDateTo("");
      },
    },
    {
      label: t("paymentBatch.filterScheduled"),
      active: statusFilter === "scheduled",
      onClick: () =>
        setStatusFilter((current) =>
          current === "scheduled" ? "all" : "scheduled"
        ),
    },
    {
      label: t("paymentBatch.filterPaid"),
      active: statusFilter === "paid",
      onClick: () =>
        setStatusFilter((current) => (current === "paid" ? "all" : "paid")),
    },
  ];
  const activeChips = [
    statusFilter !== "all" && {
      key: "status",
      label: t("filterControls.statusChip", {
        label: formatPaymentBatchStatus(statusFilter, t),
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
    const saved = await onCreatePaymentBatch?.(payload);
    if (saved !== false) {
      setCreating(false);
    }
  }

  async function handleSave(updated) {
    const saved = await onUpdatePaymentBatch?.(updated);
    if (saved !== false) {
      setActiveBatch(null);
    }
  }

  async function handleDelete(batch) {
    if (!window.confirm(t("paymentBatch.deleteConfirm", { ref: batch.reference_no || batch.id }))) {
      return;
    }
    const ok = await onDeletePaymentBatch?.(batch);
    if (ok !== false) {
      setActiveBatch(null);
    }
  }

  if (creating) {
    return (
      <div className="stack-layout">
        <CreatePaymentBatchModal
          purchases={purchases}
          paymentBatches={allPaymentBatches}
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
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={t("paymentBatch.searchPlaceholder")}
            />
          </label>
          <div className="stock-report-summary supplier-search-meta">
            <span>
              {isServerPaginated
                ? t("paymentBatch.pageCountServer", { count: filtered.length, total: totalPaymentBatchCount })
                : t("paymentBatch.pageCountLocal", { count: filtered.length, total: paymentBatches.length })}
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
            <p className="eyebrow">{t("paymentBatch.historyEyebrow")}</p>
            <h3>{t("paymentBatch.historyTitle")}</h3>
          </div>
          <div className="transaction-table-actions">
            <button
              className="primary-button"
              type="button"
              onClick={() => setCreating(true)}
            >
              {t("paymentBatch.createButton")}
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
                  {filtered.map((batch, index) => (
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
                          onClick={() => setActiveBatch(batch)}
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
              {filtered.map((batch, index) => (
                <article
                  className="mobile-record-card"
                  key={`mobile-pb-${batch.id}`}
                >
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
                    onClick={() => setActiveBatch(batch)}
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
          onPageChange={(page) => onPageRequest?.(getPageRequestParams(page))}
        />
      </section>

      {activeBatch ? (
        <PaymentBatchDetailModal
          key={activeBatch.id}
          paymentBatch={activeBatch}
          onClose={() => setActiveBatch(null)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      ) : null}
    </div>
  );
}

export default PaymentBatchPage;
