// Page component for shared component workflows.

import { useEffect, useState } from "react";
import SalesForm from "./SalesForm";
import SalesEditForm from "./sales/SalesEditForm";
import SalesHistoryDirectorySection from "./sales/SalesHistoryDirectorySection";
import { useSalesHistoryDirectoryFilters } from "../hooks/useSalesHistoryDirectoryFilters";
import { useLanguage } from "../i18n/LanguageContext";
import {
  defaultCustomerOptions,
} from "./sales/salesHistoryUtils";

function SalesHistoryPage({
  sales,
  allSales = sales,
  products = [],
  suppliers = [],
  purchases = [],
  enableStockValidation = true,
  pagination = null,
  customers = defaultCustomerOptions,
  onPageRequest,
  onCreateSale,
  onSaleStatusChange,
  onSaleUpdate,
  onSaleDelete,
  onWarning,
  focusSaleId = null,
  statusFilter = null,
  onIntentConsumed,
}) {
  const { t } = useLanguage();
  const [editingSale, setEditingSale] = useState(null);
  const [showNewSaleForm, setShowNewSaleForm] = useState(false);

  // Deep-link from the dashboard's Delivery Planning widget: open the targeted
  // sales order's read-only detail popup (same as the list's "View"). Resolve the
  // target row *during render* and seed it as the table's initial detail state so
  // the popup is present in the first painted frame — no list-then-card flash. The
  // intent is one-shot; clearing it post-paint (below) doesn't affect the open
  // modal because the table holds the row in its own state once mounted.
  const initialDetailRow = focusSaleId
    ? (allSales || []).find((sale) => sale.id === focusSaleId) || null
    : null;
  useEffect(() => {
    if (!focusSaleId) {
      return;
    }
    setShowNewSaleForm(false);
    setEditingSale(null);
    onIntentConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusSaleId]);
  const {
    searchTerm,
    setSearchTerm,
    filterOpen,
    setFilterOpen,
    selectedStatuses,
    setSelectedStatuses,
    selectedCustomer,
    setSelectedCustomer,
    customerOptions,
    customerFilterQuery,
    customerFilterOpen,
    setCustomerFilterOpen,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    amountMin,
    setAmountMin,
    amountMax,
    setAmountMax,
    vatFilter,
    setVatFilter,
    filteredCustomerOptions,
    filteredSales,
    isServerPaginated,
    pagination: resolvedPagination,
    totalSalesCount,
    activeFilterCount,
    resetFilters,
    vatOptions,
    quickPresets,
    activeChips,
    selectCustomerFilter,
    handleCustomerFilterQueryChange,
    handlePageChange,
    usesPaginationControls,
    selectedProduct,
    setSelectedProduct,
    productOptions,
  } = useSalesHistoryDirectoryFilters({
    sales,
    allSales,
    customers,
    products,
    pagination,
    onPageRequest,
    t,
  });

  // Deep-link from the dashboard's Delivery-Planning Action Center: pre-filter
  // the list to a fulfilment stage (e.g. orders stuck in Packing) and reveal
  // the filter panel so the active state is visible, then clear the intent.
  useEffect(() => {
    if (!statusFilter || statusFilter.length === 0) {
      return;
    }
    setSelectedStatuses(statusFilter);
    setFilterOpen(true);
    onIntentConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  async function handleSave(updatedSale) {
    const saved = await onSaleUpdate?.(updatedSale);

    if (saved === false) {
      return false;
    }

    setEditingSale(saved && typeof saved === "object" ? saved : updatedSale);
    return saved;
  }

  async function handleCreateSale(formData) {
    const saved = await onCreateSale?.(formData);

    if (saved === false) {
      return false;
    }

    setShowNewSaleForm(false);
    return true;
  }

  async function handleDelete(deletedSale) {
    const deleted = await onSaleDelete?.(deletedSale);

    if (deleted === false) {
      return;
    }

    setEditingSale((currentSale) =>
      currentSale?.id === deletedSale.id ? null : currentSale
    );
  }

  if (showNewSaleForm) {
    return (
      <div className="stack-layout">
        <SalesForm
          products={products}
          customers={customers}
          suppliers={suppliers}
          purchases={purchases}
          sales={allSales}
          enableStockValidation={enableStockValidation}
          onSubmit={handleCreateSale}
          onCancel={() => setShowNewSaleForm(false)}
        />
      </div>
    );
  }

  if (editingSale) {
    return (
      <div className="stack-layout">
        <SalesEditForm
          key={editingSale.id}
          sale={editingSale}
          products={products}
          customers={customers}
          purchases={purchases}
          sales={allSales}
          enableStockValidation={enableStockValidation}
          onCancel={() => setEditingSale(null)}
          onSave={handleSave}
        />
      </div>
    );
  }

  return (
    <SalesHistoryDirectorySection
      sales={sales}
      filteredSales={filteredSales}
      products={products}
      purchases={purchases}
      allSales={allSales}
      enableStockValidation={enableStockValidation}
      pagination={resolvedPagination}
      isServerPaginated={isServerPaginated}
      isPaginated={usesPaginationControls}
      totalSalesCount={totalSalesCount}
      searchTerm={searchTerm}
      onSearchTermChange={setSearchTerm}
      filterOpen={filterOpen}
      onToggleFilter={() => setFilterOpen((currentValue) => !currentValue)}
      activeFilterCount={activeFilterCount}
      onResetFilters={resetFilters}
      quickPresets={quickPresets}
      activeChips={activeChips}
      customerOptions={customerOptions}
      selectedCustomer={selectedCustomer}
      onSelectedCustomerChange={setSelectedCustomer}
      selectedProduct={selectedProduct}
      onSelectedProductChange={setSelectedProduct}
      productOptions={productOptions}
      dateFrom={dateFrom}
      onDateFromChange={setDateFrom}
      dateTo={dateTo}
      onDateToChange={setDateTo}
      amountMin={amountMin}
      onAmountMinChange={setAmountMin}
      amountMax={amountMax}
      onAmountMaxChange={setAmountMax}
      vatFilter={vatFilter}
      onVatFilterChange={setVatFilter}
      vatOptions={vatOptions}
      selectedStatuses={selectedStatuses}
      onSelectedStatusesChange={setSelectedStatuses}
      onSaleStatusChange={onSaleStatusChange}
      onSaleUpdate={onSaleUpdate}
      onWarning={onWarning}
      onEditSale={setEditingSale}
      onDeleteSale={handleDelete}
      onCreateSale={() => {
        setEditingSale(null);
        setShowNewSaleForm(true);
      }}
      onPageChange={handlePageChange}
      initialDetailRow={initialDetailRow}
    />
  );
}

export default SalesHistoryPage;
