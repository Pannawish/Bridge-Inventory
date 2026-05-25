import { useEffect, useMemo, useState } from "react";
import CreatePaymentBatchModal from "./payments/CreatePaymentBatchModal";
import PaymentBatchDirectorySection from "./payments/PaymentBatchDirectorySection";
import PaymentBatchDetailModal from "./payments/PaymentBatchDetailModal";
import {
  daysAgoString,
  formatPaymentBatchStatus,
  getToday,
  paymentBatchInDateRange,
  paymentBatchMatchesQuery,
} from "./payments/paymentBatchUtils";
import { withinRange } from "./FilterControls";
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
      <PaymentBatchDirectorySection
        paymentBatches={paymentBatches}
        filteredPaymentBatches={filtered}
        summary={summary}
        pagination={pagination}
        isServerPaginated={isServerPaginated}
        totalPaymentBatchCount={totalPaymentBatchCount}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        filterOpen={filterOpen}
        onToggleFilter={() => setFilterOpen((value) => !value)}
        activeFilterCount={activeFilterCount}
        onResetFilters={resetFilters}
        quickPresets={quickPresets}
        activeChips={activeChips}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        statusOptions={STATUS_OPTIONS}
        dateFrom={dateFrom}
        onDateFromChange={setDateFrom}
        dateTo={dateTo}
        onDateToChange={setDateTo}
        amountMin={amountMin}
        onAmountMinChange={setAmountMin}
        amountMax={amountMax}
        onAmountMaxChange={setAmountMax}
        shouldShowViewAll={shouldShowViewAll}
        showAllRows={showAllRows}
        onToggleShowAllRows={() => setShowAllRows((value) => !value)}
        isCompact={isCompact}
        activeBatch={activeBatch}
        onSelectBatch={setActiveBatch}
        onCreatePaymentBatch={() => setCreating(true)}
        onPageChange={(page) => onPageRequest?.(getPageRequestParams(page))}
      />

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
