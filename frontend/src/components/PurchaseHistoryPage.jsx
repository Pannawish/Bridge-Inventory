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

  if (state.showNewPurchaseForm) {
    return (
      <div className="stack-layout">
        <PurchaseForm
          products={state.products}
          suppliers={state.suppliers}
          purchases={state.allPurchases}
          onSubmit={state.handleCreatePurchase}
          onCancel={() => state.setShowNewPurchaseForm(false)}
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
      totalPurchaseCount={state.totalPurchaseCount}
      searchTerm={state.searchTerm}
      onSearchTermChange={state.setSearchTerm}
      filterOpen={state.filterOpen}
      onToggleFilter={() => state.setFilterOpen((currentValue) => !currentValue)}
      activeFilterCount={state.activeFilterCount}
      onResetFilters={state.resetFilters}
      quickPresets={state.quickPresets}
      activeChips={state.activeChips}
      supplierFilterQuery={state.supplierFilterQuery}
      onSupplierFilterQueryChange={(value) => {
        state.setSupplierFilterQuery(value);
        state.setSelectedSupplier("");
        state.setSupplierFilterOpen(true);
      }}
      supplierFilterOpen={state.supplierFilterOpen}
      onSupplierFilterOpen={() => state.setSupplierFilterOpen(true)}
      onSupplierFilterClose={() => state.setSupplierFilterOpen(false)}
      filteredSupplierOptions={state.filteredSupplierOptions}
      selectedSupplier={state.selectedSupplier}
      onSelectSupplierFilter={state.selectSupplierFilter}
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
        state.setShowNewPurchaseForm(true);
      }}
      onPageChange={(page) => onPageRequest?.(state.getPageRequestParams(page))}
    />
  );
}

export default PurchaseHistoryPage;
