import { useEffect } from "react";
import ProductDetailModal from "./products/ProductDetailModal";
import ProductDirectorySection from "./products/ProductDirectorySection";
import ProductEditorModal from "./products/ProductEditorModal";
import useProductsPageState from "./products/useProductsPageState";

export { getDefaultProducts } from "./products/defaultProducts";

function ProductsPage({
  products,
  allProducts,
  categories,
  purchases,
  sales,
  pagination,
  onPageRequest,
  onLoadProductHistory,
  onSaveProduct,
  onDeleteProduct,
  focusProductId = null,
  onIntentConsumed,
}) {
  const state = useProductsPageState({
    products,
    allProducts,
    categories,
    purchases,
    sales,
    pagination,
    onPageRequest,
    onLoadProductHistory,
    onSaveProduct,
    onDeleteProduct,
  });

  // Deep-link from the dashboard's Stock-Cycling / popular widgets: open the
  // targeted product straight into its detail + transaction-history view, then
  // clear the one-shot intent.
  const { openProductDetail } = state;
  useEffect(() => {
    if (!focusProductId) {
      return;
    }
    const target = (allProducts || []).find(
      (product) => `${product.id}` === `${focusProductId}`
    );
    if (target) {
      openProductDetail(target);
    }
    onIntentConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusProductId, allProducts]);

  return (
    <div className="stack-layout">
      <ProductDirectorySection
        searchTerm={state.searchTerm}
        onSearchTermChange={state.setSearchTerm}
        isServerPaginated={state.isServerPaginated}
        filteredCount={state.filteredProductsWithMetrics.length}
        totalProductCount={state.totalProductCount}
        localProductCount={state.productsWithMetrics.length}
        showProductFilters={state.showProductFilters}
        activeFilterCount={state.activeFilterCount}
        onToggleFilters={() => state.setShowProductFilters((isVisible) => !isVisible)}
        onResetFilters={state.resetProductFilters}
        quickPresets={state.quickPresets}
        activeChips={state.activeChips}
        categoryFilter={state.categoryFilter}
        onCategoryFilterChange={state.setCategoryFilter}
        categoryOptions={state.categoryOptions}
        stockFilter={state.stockFilter}
        onStockFilterChange={state.setStockFilter}
        filteredProductsWithMetrics={state.filteredProductsWithMetrics}
        onCreateProduct={state.handleStartCreateProduct}
        shouldShowViewAll={state.shouldShowViewAll}
        showAllRows={state.showAllRows}
        onToggleShowAllRows={() => state.setShowAllRows((currentValue) => !currentValue)}
        isCompact={state.isCompact}
        pagination={state.pagination}
        onPageChange={state.handlePageChange}
        onOpenProductDetail={state.openProductDetail}
      />

      <ProductDetailModal
        viewingProduct={state.viewingProduct}
        viewingTransaction={state.viewingTransaction}
        viewingPictureId={state.viewingPictureId}
        onViewingPictureChange={state.setViewingPictureId}
        categories={state.categories}
        viewingProductMetrics={state.viewingProductMetrics}
        priceInsights={state.priceInsights}
        purchasePartyOptions={state.purchasePartyOptions}
        salesPartyOptions={state.salesPartyOptions}
        historySupplierFilter={state.historySupplierFilter}
        onHistorySupplierFilterChange={state.setHistorySupplierFilter}
        historyCustomerFilter={state.historyCustomerFilter}
        onHistoryCustomerFilterChange={state.setHistoryCustomerFilter}
        historyDateFrom={state.historyDateFrom}
        onHistoryDateFromChange={state.setHistoryDateFrom}
        historyDateTo={state.historyDateTo}
        onHistoryDateToChange={state.setHistoryDateTo}
        historyFilterActive={state.historyFilterActive}
        onResetHistoryFilters={state.resetHistoryFilters}
        productHistoryLoadingId={state.productHistoryLoadingId}
        productHistoryError={state.productHistoryError}
        stockLayers={state.stockLayers}
        stockLayersLoading={state.stockLayersLoading}
        stockLayersError={state.stockLayersError}
        viewPurchaseHistory={state.paginatedPurchaseHistory}
        purchaseHistoryPagination={state.purchaseHistoryPagination}
        onPurchaseHistoryPageChange={state.setPurchaseHistoryPage}
        viewSalesHistory={state.paginatedSalesHistory}
        salesHistoryPagination={state.salesHistoryPagination}
        onSalesHistoryPageChange={state.setSalesHistoryPage}
        onOpenTransactionDetail={state.openTransactionDetail}
        onOpenProductEditor={state.handleOpenProductEditor}
        onBackToProduct={state.backToProduct}
        onClose={state.closeAll}
      />

      <ProductEditorModal
        draftProduct={state.draftProduct}
        allProducts={state.allProducts}
        isDirty={state.isDraftProductDirty}
        productFormError={state.productFormError}
        productFieldErrors={state.productFieldErrors}
        categoryQuery={state.categoryQuery}
        categoryComboboxOpen={state.categoryComboboxOpen}
        productCategoryOptions={state.productCategoryOptions}
        filteredProductCategoryOptions={state.filteredProductCategoryOptions}
        isSkuLocked={state.isSkuLocked}
        draftProductPictures={state.draftProductPictures}
        selectedDraftPicture={state.selectedDraftPicture}
        draftExistingProduct={state.draftExistingProduct}
        draftProductHasHistory={state.draftProductHasHistory}
        isDraftProductActive={state.isDraftProductActive}
        isProductEnableDisabled={state.isProductEnableDisabled}
        productEnableDisabledReason={state.productEnableDisabledReason}
        isProductDisableDisabled={state.isProductDisableDisabled}
        productDisableDisabledReason={state.productDisableDisabledReason}
        isProductDeleteDisabled={state.isProductDeleteDisabled}
        productDeleteDisabledReason={state.productDeleteDisabledReason}
        onClose={state.closeProductEditor}
        onSave={state.handleSaveProduct}
        onUpdateDraftField={state.updateDraftField}
        onCategoryQueryChange={state.handleCategoryQueryChange}
        onCategoryFocus={() => state.setCategoryComboboxOpen(true)}
        onCategoryBlur={state.handleCategoryBlur}
        onValidateDraftField={state.validateDraftField}
        onSelectDraftCategory={state.selectDraftCategory}
        onGenerateSku={state.handleGenerateSku}
        onUnlockSkuChange={state.handleUnlockSkuChange}
        onAddDraftSubName={state.addDraftSubName}
        onUpdateDraftSubName={state.updateDraftSubName}
        onSetDraftSubNameAsMain={state.setDraftSubNameAsMain}
        onRemoveDraftSubName={state.removeDraftSubName}
        onAddDraftUnitConversion={state.addDraftUnitConversion}
        onUpdateDraftUnitConversion={state.updateDraftUnitConversion}
        onToggleDraftUnitConversion={state.toggleDraftUnitConversion}
        onRemoveDraftUnitConversion={state.removeDraftUnitConversion}
        onAddDraftPictures={state.addDraftPictures}
        onSelectDraftPicture={state.selectDraftPicture}
        onRemoveDraftPicture={state.removeDraftPicture}
        onEnableProduct={state.handleEnableProduct}
        onDisableProduct={state.handleDisableProduct}
        onDeleteProduct={state.handleDeleteProduct}
      />
    </div>
  );
}

export default ProductsPage;
