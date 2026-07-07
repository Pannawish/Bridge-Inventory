// React hook for shared application hook state and actions.

import { useEffect, useMemo, useState } from "react";
import { withinRange } from "../components/FilterControls";
import {
  billingNoteInDateRange,
  billingNoteMatchesQuery,
  daysAgoString,
  formatBillingNoteStatus,
} from "../components/billing/billingNoteUtils";

export function useBillingNoteDirectoryFilters({
  billingNotes = [],
  allBillingNotes = billingNotes,
  pagination = null,
  onPageRequest,
  t,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [showAllRows, setShowAllRows] = useState(false);

  const statusOptions = [
    { value: "issued", label: t("billingNote.statusIssued") },
    {
      value: "partially_received",
      label: t("billingNote.statusPartiallyReceived"),
    },
    { value: "fully_received", label: t("billingNote.statusFullyReceived") },
    { value: "cancelled", label: t("billingNote.statusCancelled") },
  ];

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const isServerPaginated = Boolean(pagination && onPageRequest);

  const customerOptions = useMemo(() => {
    const names = new Set();
    allBillingNotes.forEach((note) => {
      const name = `${note.customer_name ?? ""}`.trim();
      if (name) {
        names.add(name);
      }
    });
    return Array.from(names)
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ value: name, label: name }));
  }, [allBillingNotes]);

  const filteredBillingNotes = useMemo(() => {
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
      if (customerFilter && note.customer_name !== customerFilter) {
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
    amountMax,
    amountMin,
    billingNotes,
    customerFilter,
    dateFrom,
    dateTo,
    isServerPaginated,
    normalizedSearch,
    statusFilter,
    t,
  ]);

  const compactRows = 5;
  const shouldShowViewAll =
    !isServerPaginated && filteredBillingNotes.length > compactRows;
  const isCompact = shouldShowViewAll && !showAllRows;
  const totalBillingNoteCount = pagination?.count ?? billingNotes.length;

  const activeFilterCount =
    (statusFilter !== "all" ? 1 : 0) +
    (customerFilter ? 1 : 0) +
    (dateFrom || dateTo ? 1 : 0) +
    (amountMin ? 1 : 0) +
    (amountMax ? 1 : 0);

  function resetFilters() {
    setStatusFilter("all");
    setCustomerFilter("");
    setDateFrom("");
    setDateTo("");
    setAmountMin("");
    setAmountMax("");
  }

  const last30Active = dateFrom === daysAgoString(30) && !dateTo;
  // Only the date shortcut survives — the status presets duplicated the
  // always-visible Status field.
  const quickPresets = [
    {
      key: "last30",
      label: t("billingNote.filterLastDays"),
      active: last30Active,
      onClick: () => {
        setDateFrom(last30Active ? "" : daysAgoString(30));
        setDateTo("");
      },
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
    customerFilter && {
      key: "customer",
      label: t("billingNote.customerChip", { name: customerFilter }),
      onRemove: () => setCustomerFilter(""),
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
      customer: customerFilter,
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
    customerFilter,
    dateFrom,
    dateTo,
    isServerPaginated,
    onPageRequest,
    searchTerm,
    statusFilter,
  ]);

  function handlePageChange(page) {
    onPageRequest?.(getPageRequestParams(page));
  }

  return {
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    customerFilter,
    setCustomerFilter,
    customerOptions,
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
    filteredBillingNotes,
    isServerPaginated,
    shouldShowViewAll,
    isCompact,
    totalBillingNoteCount,
    activeFilterCount,
    resetFilters,
    quickPresets,
    activeChips,
    handlePageChange,
  };
}
