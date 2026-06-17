import { useEffect, useMemo, useState } from "react";
import CreatePaymentBatchModal from "./payments/CreatePaymentBatchModal";
import PaymentBatchDirectorySection from "./payments/PaymentBatchDirectorySection";
import PaymentBatchDetailModal from "./payments/PaymentBatchDetailModal";
import PaymentBatchEditForm from "./payments/PaymentBatchEditForm";
import { getToday } from "./payments/paymentBatchUtils";
import { usePaymentBatchDirectoryFilters } from "../hooks/usePaymentBatchDirectoryFilters";
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
  focusId = null,
  onIntentConsumed,
}) {
  const { t } = useLanguage();
  const [creating, setCreating] = useState(false);
  const [activeBatch, setActiveBatch] = useState(null);
  const [editingBatch, setEditingBatch] = useState(null);
  const {
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
  } = usePaymentBatchDirectoryFilters({
    paymentBatches,
    allPaymentBatches,
    pagination,
    onPageRequest,
    t,
  });

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

  // Deep-link from the Inventory AP drill-down: open the targeted batch's detail
  // card straight away (the same view as its row "View" action), then clear the
  // one-shot intent so it doesn't re-open on the next render.
  useEffect(() => {
    if (!focusId) return;
    const target = (Array.isArray(allPaymentBatches) ? allPaymentBatches : []).find(
      (batch) => `${batch.id}` === `${focusId}`
    );
    if (target) setActiveBatch(target);
    onIntentConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, allPaymentBatches]);

  async function handleCreate(payload) {
    const saved = await onCreatePaymentBatch?.(payload);
    if (saved !== false) {
      setCreating(false);
    }
  }

  async function handleSaveLines(updated) {
    const saved = await onUpdatePaymentBatch?.(updated);
    if (saved === false) return false;
    setActiveBatch(saved && typeof saved === "object" ? saved : updated);
    return saved;
  }

  async function handleSaveEdit(updated) {
    const saved = await onUpdatePaymentBatch?.(updated);
    if (saved === false) return false;
    setEditingBatch(saved && typeof saved === "object" ? saved : updated);
    return saved;
  }

  async function handleDelete(batch) {
    if (!window.confirm(t("paymentBatch.deleteConfirm", { ref: batch.reference_no || batch.id }))) {
      return;
    }
    const ok = await onDeletePaymentBatch?.(batch);
    if (ok !== false) {
      setActiveBatch(null);
      setEditingBatch(null);
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

  if (editingBatch) {
    return (
      <div className="stack-layout">
        <PaymentBatchEditForm
          key={editingBatch.id}
          paymentBatch={editingBatch}
          onCancel={() => setEditingBatch(null)}
          onSave={handleSaveEdit}
        />
      </div>
    );
  }

  return (
    <div className="stack-layout">
      <PaymentBatchDirectorySection
        paymentBatches={paymentBatches}
        filteredPaymentBatches={filteredPaymentBatches}
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
        statusOptions={statusOptions}
        supplierFilter={supplierFilter}
        onSupplierFilterChange={setSupplierFilter}
        supplierOptions={supplierOptions}
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
        onPageChange={handlePageChange}
      />

      {activeBatch ? (
        <PaymentBatchDetailModal
          key={activeBatch.id}
          paymentBatch={activeBatch}
          onClose={() => setActiveBatch(null)}
          onEdit={setEditingBatch}
          onSave={handleSaveLines}
          onDelete={handleDelete}
        />
      ) : null}
    </div>
  );
}

export default PaymentBatchPage;
