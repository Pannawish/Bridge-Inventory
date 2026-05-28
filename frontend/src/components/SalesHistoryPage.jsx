import { useState } from "react";
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
}) {
  const { t } = useLanguage();
  const [editingSale, setEditingSale] = useState(null);
  const [showNewSaleForm, setShowNewSaleForm] = useState(false);
  const {
    searchTerm,
    setSearchTerm,
    filterOpen,
    setFilterOpen,
    selectedStatuses,
    setSelectedStatuses,
    selectedCustomer,
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
  } = useSalesHistoryDirectoryFilters({
    sales,
    allSales,
    customers,
    pagination,
    onPageRequest,
    t,
  });

  async function handleSave(updatedSale) {
    const saved = await onSaleUpdate?.(updatedSale);

    if (saved === false) {
      return;
    }

    setEditingSale(null);
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
      customerFilterQuery={customerFilterQuery}
      onCustomerFilterQueryChange={handleCustomerFilterQueryChange}
      customerFilterOpen={customerFilterOpen}
      onCustomerFilterOpen={() => setCustomerFilterOpen(true)}
      onCustomerFilterClose={() => setCustomerFilterOpen(false)}
      filteredCustomerOptions={filteredCustomerOptions}
      selectedCustomer={selectedCustomer}
      onSelectCustomerFilter={selectCustomerFilter}
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
    />
  );
}

export default SalesHistoryPage;
