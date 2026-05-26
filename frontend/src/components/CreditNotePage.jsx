import { useEffect, useMemo, useState } from "react";
import CreateCreditNoteModal from "./credits/CreateCreditNoteModal";
import CreditNoteDirectorySection from "./credits/CreditNoteDirectorySection";
import CreditNoteDetailModal from "./credits/CreditNoteDetailModal";
import {
  creditNoteInDateRange,
  creditNoteMatchesQuery,
  daysAgoString,
  formatCreditNoteStatus,
  getToday,
} from "./credits/creditNoteUtils";
import DocumentRefChip from "./DocumentRefChip";
import DocumentRefModal from "./DocumentRefModal";
import { withinRange } from "./FilterControls";
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
      <CreditNoteDirectorySection
        creditNotes={creditNotes}
        filteredCreditNotes={filtered}
        summary={summary}
        pagination={pagination}
        isServerPaginated={isServerPaginated}
        totalCreditNoteCount={totalCreditNoteCount}
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
        activeCreditNote={activeCreditNote}
        onSelectCreditNote={setActiveCreditNote}
        onCreateCreditNote={() => setCreating(true)}
        renderListRef={renderListRef}
        onPageChange={(page) => onPageRequest?.(getPageRequestParams(page))}
      />

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
