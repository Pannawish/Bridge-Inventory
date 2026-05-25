import { useMemo, useState } from "react";
import BillingNoteDetailModal from "./billing/BillingNoteDetailModal";
import BillingNoteDirectorySection from "./billing/BillingNoteDirectorySection";
import CreateBillingNoteModal from "./billing/CreateBillingNoteModal";
import { getToday } from "./billing/billingNoteUtils";
import { useBillingNoteDirectoryFilters } from "../hooks/useBillingNoteDirectoryFilters";
import { useLanguage } from "../i18n/LanguageContext";

function BillingNotePage({
  billingNotes = [],
  allBillingNotes = billingNotes,
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
  const [creating, setCreating] = useState(false);
  const [activeBillingNote, setActiveBillingNote] = useState(null);
  const {
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
  } = useBillingNoteDirectoryFilters({
    billingNotes,
    pagination,
    onPageRequest,
    t,
  });

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
      <BillingNoteDirectorySection
        billingNotes={billingNotes}
        filteredBillingNotes={filteredBillingNotes}
        summary={summary}
        pagination={pagination}
        isServerPaginated={isServerPaginated}
        totalBillingNoteCount={totalBillingNoteCount}
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
        statusOptions={statusOptions}
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
        activeBillingNote={activeBillingNote}
        onSelectBillingNote={setActiveBillingNote}
        onCreateBillingNote={() => setCreating(true)}
        onPageChange={handlePageChange}
      />

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
