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
  pagination = null,
  onPageRequest,
  t,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
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
        setStatusFilter((current) => (current === "issued" ? "all" : "issued")),
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
    amountMax,
    amountMin,
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
