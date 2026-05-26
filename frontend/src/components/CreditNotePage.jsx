import { useMemo, useState } from "react";
import CreateCreditNoteModal from "./credits/CreateCreditNoteModal";
import CreditNoteDirectorySection from "./credits/CreditNoteDirectorySection";
import CreditNoteDetailModal from "./credits/CreditNoteDetailModal";
import {
  getToday,
} from "./credits/creditNoteUtils";
import DocumentRefChip from "./DocumentRefChip";
import DocumentRefModal from "./DocumentRefModal";
import { useCreditNoteDirectoryFilters } from "../hooks/useCreditNoteDirectoryFilters";
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
  const [creating, setCreating] = useState(false);
  const [activeCreditNote, setActiveCreditNote] = useState(null);
  const [docRefModal, setDocRefModal] = useState(null);
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
    filteredCreditNotes,
    isServerPaginated,
    shouldShowViewAll,
    isCompact,
    totalCreditNoteCount,
    activeFilterCount,
    resetFilters,
    quickPresets,
    activeChips,
    handlePageChange,
  } = useCreditNoteDirectoryFilters({
    creditNotes,
    pagination,
    onPageRequest,
    t,
  });

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
        filteredCreditNotes={filteredCreditNotes}
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
        activeCreditNote={activeCreditNote}
        onSelectCreditNote={setActiveCreditNote}
        onCreateCreditNote={() => setCreating(true)}
        renderListRef={renderListRef}
        onPageChange={handlePageChange}
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
