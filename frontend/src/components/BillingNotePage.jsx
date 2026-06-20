import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import BillingNoteDetailModal from "./billing/BillingNoteDetailModal";
import BillingNoteDirectorySection from "./billing/BillingNoteDirectorySection";
import BillingNoteEditForm from "./billing/BillingNoteEditForm";
import CreateBillingNoteModal from "./billing/CreateBillingNoteModal";
import {
  filterLinkableCreditNotesForCustomer,
  getToday,
} from "./billing/billingNoteUtils";
import { useBillingNoteDirectoryFilters } from "../hooks/useBillingNoteDirectoryFilters";
import { useLanguage } from "../i18n/LanguageContext";
import { deepEqual } from "../equality";

function BillingNotePage({
  billingNotes = [],
  allBillingNotes = billingNotes,
  creditNotes = [],
  sales = [],
  summary: serverSummary = null,
  nextReferenceNo = "",
  pagination = null,
  onPageRequest,
  onCreateBillingNote,
  onUpdateBillingNote,
  onDeleteBillingNote,
  onLinkCreditNotesToBillingNote,
  usingMockCreditNotes = false,
  focusId = null,
  onIntentConsumed,
}) {
  const { t } = useLanguage();
  const [creating, setCreating] = useState(false);
  const [activeBillingNote, setActiveBillingNote] = useState(null);
  const [editingBillingNote, setEditingBillingNote] = useState(null);
  const [availableCreditNotes, setAvailableCreditNotes] = useState([]);
  const [availableCreditNotesLoading, setAvailableCreditNotesLoading] = useState(false);
  const [availableCreditNotesError, setAvailableCreditNotesError] = useState("");
  const activeBillingNoteId = activeBillingNote?.id || null;
  const activeBillingNoteCustomerName = activeBillingNote?.customer_name || "";
  const {
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
  } = useBillingNoteDirectoryFilters({
    billingNotes,
    allBillingNotes,
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

  // Deep-link from the Inventory AR drill-down: open the targeted note's detail
  // card straight away (the same view as its row "View" action), then clear the
  // one-shot intent so it doesn't re-open on the next render.
  useEffect(() => {
    if (!focusId) return;
    const target = (Array.isArray(allBillingNotes) ? allBillingNotes : []).find(
      (note) => `${note.id}` === `${focusId}`
    );
    if (target) setActiveBillingNote(target);
    onIntentConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, allBillingNotes]);

  useEffect(() => {
    if (!activeBillingNote) {
      return;
    }
    const nextActiveBillingNote = (Array.isArray(allBillingNotes) ? allBillingNotes : []).find(
      (note) => `${note.id}` === `${activeBillingNote.id}`
    );
    // Only adopt the list copy when its *data* actually differs. The directory
    // rows and the full list are separate arrays (and credit-note linking builds
    // fresh enriched objects), so the matching entry is frequently an equal-but-
    // new reference. Swapping on identity alone would re-point activeBillingNote
    // every render, which resets the open detail modal's draft and reverts an
    // in-progress "received" checkbox. Compare by value instead.
    if (nextActiveBillingNote && !deepEqual(nextActiveBillingNote, activeBillingNote)) {
      setActiveBillingNote(nextActiveBillingNote);
    }
  }, [activeBillingNote, allBillingNotes]);

  useEffect(() => {
    if (!activeBillingNote) {
      setAvailableCreditNotes([]);
      setAvailableCreditNotesError("");
      setAvailableCreditNotesLoading(false);
      return;
    }

    if (usingMockCreditNotes) {
      setAvailableCreditNotes(
        filterLinkableCreditNotesForCustomer(creditNotes, activeBillingNoteCustomerName)
      );
      setAvailableCreditNotesError("");
      setAvailableCreditNotesLoading(false);
      return;
    }

    let ignore = false;

    async function loadAvailableCreditNotes() {
      setAvailableCreditNotesLoading(true);
      setAvailableCreditNotesError("");

      try {
        let currentPage = 1;
        let totalPages = 1;
        const rows = [];

        do {
          const response = await api.getCreditNotes({
            customer: activeBillingNoteCustomerName,
            page: currentPage,
            page_size: 100,
          });
          const batch = Array.isArray(response?.results)
            ? response.results
            : Array.isArray(response)
              ? response
              : [];
          rows.push(...batch);
          totalPages = Math.max(1, Number(response?.total_pages) || 1);
          currentPage += 1;
        } while (currentPage <= totalPages);

        if (!ignore) {
          setAvailableCreditNotes(
            filterLinkableCreditNotesForCustomer(rows, activeBillingNoteCustomerName)
          );
        }
      } catch (requestError) {
        if (!ignore) {
          setAvailableCreditNotes([]);
          setAvailableCreditNotesError(requestError.message || "");
        }
      } finally {
        if (!ignore) {
          setAvailableCreditNotesLoading(false);
        }
      }
    }

    loadAvailableCreditNotes();

    return () => {
      ignore = true;
    };
  }, [
    activeBillingNoteId,
    activeBillingNoteCustomerName,
    creditNotes,
    usingMockCreditNotes,
  ]);

  async function handleCreate(payload) {
    const selectedCreditNotes = payload.selected_credit_notes || [];
    const billingNotePayload = {
      ...payload,
    };
    delete billingNotePayload.selected_credit_notes;

    const saved = await onCreateBillingNote?.(billingNotePayload);
    if (saved !== false) {
      if (selectedCreditNotes.length > 0) {
        await onLinkCreditNotesToBillingNote?.(selectedCreditNotes, saved);
      }
      setCreating(false);
    }
  }

  async function handleSaveLines(updated) {
    const saved = await onUpdateBillingNote?.(updated);
    if (saved === false) return false;
    setActiveBillingNote(saved && typeof saved === "object" ? saved : updated);
    return saved;
  }

  async function handleSaveEdit(updated) {
    const saved = await onUpdateBillingNote?.(updated);
    if (saved === false) return false;
    setEditingBillingNote(saved && typeof saved === "object" ? saved : updated);
    return saved;
  }

  async function handleDelete(note) {
    if (!window.confirm(t("billingNote.deleteBN", { ref: note.reference_no || note.id }))) {
      return;
    }
    const ok = await onDeleteBillingNote?.(note);
    if (ok !== false) {
      setActiveBillingNote(null);
      setEditingBillingNote(null);
    }
  }

  async function handleLinkCreditNote(creditNote) {
    if (!activeBillingNote) {
      return false;
    }

    const linkedCreditNotes = await onLinkCreditNotesToBillingNote?.(
      [creditNote],
      activeBillingNote
    );
    const saved = Array.isArray(linkedCreditNotes) ? linkedCreditNotes[0] : false;
    if (!saved) {
      return false;
    }

    setAvailableCreditNotes((current) =>
      current.filter((note) => `${note.id}` !== `${creditNote.id}`)
    );
    setActiveBillingNote((current) => {
      if (!current) {
        return current;
      }
      if ((current.credit_notes || []).some((note) => `${note.id}` === `${saved.id}`)) {
        return current;
      }
      return {
        ...current,
        credit_notes: [...(current.credit_notes || []), saved],
      };
    });

    return saved;
  }

  if (creating) {
    return (
      <div className="stack-layout">
        <CreateBillingNoteModal
          sales={sales}
          billingNotes={allBillingNotes}
          creditNotes={creditNotes}
          usingMockCreditNotes={usingMockCreditNotes}
          nextReferenceNo={nextReferenceNo}
          onClose={() => setCreating(false)}
          onCreate={handleCreate}
        />
      </div>
    );
  }

  if (editingBillingNote) {
    return (
      <div className="stack-layout">
        <BillingNoteEditForm
          key={editingBillingNote.id}
          billingNote={editingBillingNote}
          onCancel={() => setEditingBillingNote(null)}
          onSave={handleSaveEdit}
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
        customerFilter={customerFilter}
        onCustomerFilterChange={setCustomerFilter}
        customerOptions={customerOptions}
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
          availableCreditNotes={availableCreditNotes}
          availableCreditNotesLoading={availableCreditNotesLoading}
          availableCreditNotesError={availableCreditNotesError}
          onClose={() => setActiveBillingNote(null)}
          onEdit={setEditingBillingNote}
          onSave={handleSaveLines}
          onDelete={handleDelete}
          onLinkCreditNote={handleLinkCreditNote}
        />
      ) : null}
    </div>
  );
}

export default BillingNotePage;
