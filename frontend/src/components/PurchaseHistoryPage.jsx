// Page component for shared component workflows.

import { useEffect, useState } from "react";
import PurchaseForm from "./PurchaseForm";
import PurchaseEditForm from "./purchases/PurchaseEditForm";
import PurchaseHistoryDirectorySection from "./purchases/PurchaseHistoryDirectorySection";
import usePurchaseHistoryPageState from "./purchases/usePurchaseHistoryPageState";

function PurchaseHistoryPage({
  products,
  suppliers,
  purchases,
  allPurchases,
  pagination,
  onPageRequest,
  onCreatePurchase,
  onPurchaseStatusChange,
  onPurchaseItemStatusChange,
  onPurchaseUpdate,
  onPurchaseDelete,
  prefillDraft = null,
  focusPurchaseId = null,
  statusFilter = null,
  onIntentConsumed,
}) {
  const state = usePurchaseHistoryPageState({
    products,
    suppliers,
    purchases,
    allPurchases,
    pagination,
    onPageRequest,
    onCreatePurchase,
    onPurchaseStatusChange,
    onPurchaseItemStatusChange,
    onPurchaseUpdate,
    onPurchaseDelete,
  });

  // Deep-link from the dashboard (Urgent Reorder / Order Coverage gap): open a
  // new PO seeded with the chosen items, then clear the one-shot intent.
  const [pendingPrefill, setPendingPrefill] = useState(null);
  useEffect(() => {
    if (!prefillDraft) {
      return;
    }
    setPendingPrefill(prefillDraft);
    state.setEditingPurchase(null);
    state.setShowNewPurchaseForm(true);
    onIntentConsumed?.();
  }, [prefillDraft]);

  // Deep-link from the dashboard's Order Planning widget: open the targeted PO's
  // read-only detail popup (same as the list's "View"). Resolve the target row
  // *during render* and seed it as the table's initial detail state so the popup
  // is present in the first painted frame — no list-then-card flash. The intent
  // is one-shot; clearing it post-paint (below) doesn't affect the open modal
  // because the table holds the row in its own state once mounted.
  const initialDetailRow = focusPurchaseId
    ? (allPurchases || []).find((purchase) => purchase.id === focusPurchaseId) || null
    : null;
  useEffect(() => {
    if (!focusPurchaseId) {
      return;
    }
    state.setShowNewPurchaseForm(false);
    state.setEditingPurchase(null);
    onIntentConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusPurchaseId]);

  // Deep-link from Order Planning's stage chips / purchasing center: pre-filter
  // the list to a stage (e.g. POs still in Draft) and reveal the filter panel.
  useEffect(() => {
    if (!statusFilter || statusFilter.length === 0) {
      return;
    }
    state.setSelectedStatuses(statusFilter);
    state.setFilterOpen(true);
    onIntentConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  if (state.showNewPurchaseForm) {
    return (
      <div className="stack-layout">
        <PurchaseForm
          products={state.products}
          suppliers={state.suppliers}
          purchases={state.allPurchases}
          prefill={pendingPrefill}
          onSubmit={state.handleCreatePurchase}
          onCancel={() => {
            state.setShowNewPurchaseForm(false);
            setPendingPrefill(null);
          }}
        />
      </div>
    );
  }

  if (state.editingPurchase) {
    return (
      <div className="stack-layout">
        <PurchaseEditForm
          key={state.editingPurchase.id}
          purchase={state.editingPurchase}
          products={state.products}
          suppliers={state.suppliers}
          onCancel={() => state.setEditingPurchase(null)}
          onSave={state.handleSave}
        />
      </div>
    );
  }

  return (
    <PurchaseHistoryDirectorySection
      purchases={state.purchases}
      filteredPurchases={state.filteredPurchases}
      products={state.products}
      pagination={state.pagination}
      isServerPaginated={state.isServerPaginated}
      isPaginated={state.usesPaginationControls}
      totalPurchaseCount={state.totalPurchaseCount}
      searchTerm={state.searchTerm}
      onSearchTermChange={state.setSearchTerm}
      filterOpen={state.filterOpen}
      onToggleFilter={() => state.setFilterOpen((currentValue) => !currentValue)}
      activeFilterCount={state.activeFilterCount}
      onResetFilters={state.resetFilters}
      quickPresets={state.quickPresets}
      activeChips={state.activeChips}
      supplierOptions={state.supplierOptions}
      selectedSupplier={state.selectedSupplier}
      onSelectedSupplierChange={state.setSelectedSupplier}
      productOptions={state.productOptions}
      selectedProduct={state.selectedProduct}
      onSelectedProductChange={state.setSelectedProduct}
      dateFrom={state.dateFrom}
      onDateFromChange={state.setDateFrom}
      dateTo={state.dateTo}
      onDateToChange={state.setDateTo}
      amountMin={state.amountMin}
      onAmountMinChange={state.setAmountMin}
      amountMax={state.amountMax}
      onAmountMaxChange={state.setAmountMax}
      vatFilter={state.vatFilter}
      onVatFilterChange={state.setVatFilter}
      vatOptions={state.vatOptions}
      selectedStatuses={state.selectedStatuses}
      onSelectedStatusesChange={state.setSelectedStatuses}
      onPurchaseStatusChange={state.onPurchaseStatusChange}
      onPurchaseItemStatusChange={state.onPurchaseItemStatusChange}
      onEditPurchase={state.setEditingPurchase}
      onDeletePurchase={state.handleDelete}
      onCreatePurchase={() => {
        state.setEditingPurchase(null);
        setPendingPrefill(null);
        state.setShowNewPurchaseForm(true);
      }}
      onPageChange={state.handlePageChange}
      initialDetailRow={initialDetailRow}
    />
  );
}

export default PurchaseHistoryPage;
