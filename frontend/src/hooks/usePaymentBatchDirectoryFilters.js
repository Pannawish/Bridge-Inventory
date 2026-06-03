import { useEffect, useMemo, useState } from "react";
import { withinRange } from "../components/FilterControls";
import {
  daysAgoString,
  formatPaymentBatchStatus,
  paymentBatchInDateRange,
  paymentBatchMatchesQuery,
} from "../components/payments/paymentBatchUtils";

export function usePaymentBatchDirectoryFilters({
  paymentBatches = [],
  allPaymentBatches = paymentBatches,
  pagination = null,
  onPageRequest,
  t,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [showAllRows, setShowAllRows] = useState(false);

  const statusOptions = [
    { value: "scheduled", label: t("paymentBatch.statusScheduled") },
    { value: "partially_paid", label: t("paymentBatch.statusPartiallyPaid") },
    { value: "paid", label: t("paymentBatch.statusPaid") },
    { value: "cancelled", label: t("paymentBatch.statusCancelled") },
  ];

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const isServerPaginated = Boolean(pagination && onPageRequest);

  const supplierOptions = useMemo(() => {
    const names = new Set();
    allPaymentBatches.forEach((batch) => {
      const name = `${batch.supplier_name ?? ""}`.trim();
      if (name) {
        names.add(name);
      }
    });
    return Array.from(names)
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ value: name, label: name }));
  }, [allPaymentBatches]);

  const filteredPaymentBatches = useMemo(() => {
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
      if (supplierFilter && batch.supplier_name !== supplierFilter) {
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
    amountMax,
    amountMin,
    dateFrom,
    dateTo,
    isServerPaginated,
    normalizedSearch,
    paymentBatches,
    statusFilter,
    supplierFilter,
    t,
  ]);

  const compactRows = 5;
  const shouldShowViewAll =
    !isServerPaginated && filteredPaymentBatches.length > compactRows;
  const isCompact = shouldShowViewAll && !showAllRows;
  const totalPaymentBatchCount = pagination?.count ?? paymentBatches.length;

  const activeFilterCount =
    (statusFilter !== "all" ? 1 : 0) +
    (supplierFilter ? 1 : 0) +
    (dateFrom || dateTo ? 1 : 0) +
    (amountMin ? 1 : 0) +
    (amountMax ? 1 : 0);

  function resetFilters() {
    setStatusFilter("all");
    setSupplierFilter("");
    setDateFrom("");
    setDateTo("");
    setAmountMin("");
    setAmountMax("");
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
        setStatusFilter((current) => (current === "scheduled" ? "all" : "scheduled")),
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
    supplierFilter && {
      key: "supplier",
      label: t("paymentBatch.supplierChip", { name: supplierFilter }),
      onRemove: () => setSupplierFilter(""),
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
      supplier: supplierFilter,
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
    amountMax,
    amountMin,
    dateFrom,
    dateTo,
    isServerPaginated,
    onPageRequest,
    searchTerm,
    statusFilter,
    supplierFilter,
  ]);

  function handlePageChange(page) {
    onPageRequest?.(getPageRequestParams(page));
  }

  return {
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    supplierFilter,
    setSupplierFilter,
    supplierOptions,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    amountMin,
    setAmountMin,
    amountMax,
    setAmountMax,
    filterOpen,
    setFilterOpen,
    showAllRows,
    setShowAllRows,
    statusOptions,
    filteredPaymentBatches,
    isServerPaginated,
    shouldShowViewAll,
    isCompact,
    totalPaymentBatchCount,
    activeFilterCount,
    resetFilters,
    quickPresets,
    activeChips,
    handlePageChange,
  };
}
