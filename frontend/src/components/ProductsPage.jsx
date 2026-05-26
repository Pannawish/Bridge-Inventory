import { useEffect } from "react";
import ProductDetailModal from "./products/ProductDetailModal";
import ProductDirectorySection from "./products/ProductDirectorySection";
import ProductEditorModal from "./products/ProductEditorModal";
import {
  getProductPreviousSkus,
  isValidSku,
  isProductActive,
  normalizeProduct,
  normalizeSku,
  normalizeUniqueNames,
} from "./products/productUtils";
import { getCategoryPathById } from "./CategoryPage";
import { useLanguage } from "../i18n/LanguageContext";
import { getTranslatedProductDisplayName } from "./products/productEditorHelpers";
import { defaultProducts, getDefaultProducts } from "./products/defaultProducts";
import { useProductDirectoryFilters } from "../hooks/useProductDirectoryFilters";
import useProductEditorState from "../hooks/useProductEditorState";
import useProductDetailState from "../hooks/useProductDetailState";

export { getDefaultProducts } from "./products/defaultProducts";

function ProductsPage({
  products = defaultProducts,
  allProducts = products,
  categories = [],
  purchases = [],
  sales = [],
  pagination = null,
  onPageRequest,
  onLoadProductHistory,
  onSaveProduct,
  onDeleteProduct,
}) {
  const { t } = useLanguage();
  const {
    viewingProduct,
    viewingTransaction,
    viewingPictureId,
    productHistoryById,
    productHistoryLoadingId,
    productHistoryError,
    purchaseHistoryPagination,
    salesHistoryPagination,
    paginatedPurchaseHistory,
    paginatedSalesHistory,
    viewingProductMetrics,
    loadProductHistory,
    openProductDetail,
    closeProductDetail,
    openTransactionDetail,
    backToProduct,
    setViewingPictureId,
    setPurchaseHistoryPage,
    setSalesHistoryPage,
  } = useProductDetailState({
    purchases,
    sales,
    onLoadProductHistory,
  });
  const {
    draftProduct,
    productFormError,
    skuChangeUnlocked,
    categoryQuery,
    categoryComboboxOpen,
    productCategoryOptions,
    filteredProductCategoryOptions,
    draftExistingProduct,
    draftProductHasHistory,
    draftProductPictures,
    selectedDraftPicture,
    setDraftProduct,
    setProductFormError,
    setSkuChangeUnlocked,
    setCategoryComboboxOpen,
    getExistingProduct,
    getCachedProductHasTransactionHistory,
    productHasTransactionHistory,
    generateStructuredSku,
    openProductEditor,
    closeProductEditor,
    updateDraftField,
    addDraftPictures,
    selectDraftPicture,
    removeDraftPicture,
    updateDraftSubName,
    addDraftSubName,
    removeDraftSubName,
    setDraftSubNameAsMain,
    updateDraftUnitConversion,
    toggleDraftUnitConversion,
    addDraftUnitConversion,
    removeDraftUnitConversion,
    handleGenerateSku,
    selectDraftCategory,
    handleCategoryQueryChange,
    handleCategoryBlur,
    handleUnlockSkuChange,
    handleCreateProduct,
  } = useProductEditorState({
    allProducts,
    categories,
    purchases,
    sales,
    productHistoryById,
    loadProductHistory,
    t,
  });

  useEffect(() => {
    const isOpen = !!(viewingProduct || viewingTransaction || draftProduct);

    if (typeof document === "undefined" || !isOpen) {
      return undefined;
    }

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prev;
    };
  }, [viewingProduct, viewingTransaction, draftProduct]);

  const {
    searchTerm,
    setSearchTerm,
    stockFilter,
    setStockFilter,
    categoryFilter,
    setCategoryFilter,
    showProductFilters,
    setShowProductFilters,
    showAllRows,
    setShowAllRows,
    isServerPaginated,
    productsWithMetrics,
    categoryOptions,
    filteredProductsWithMetrics,
    activeFilterCount,
    shouldShowViewAll,
    isCompact,
    totalProductCount,
    resetProductFilters,
    quickPresets,
    activeChips,
    handlePageChange,
  } = useProductDirectoryFilters({
    products,
    allProducts,
    categories,
    purchases,
    sales,
    pagination,
    onPageRequest,
    t,
  });

  function closeAll() {
    closeProductDetail();
    setDraftProduct(null);
    setProductFormError("");
    setCategoryComboboxOpen(false);
  }

  function handleOpenProductEditor(product) {
    closeProductDetail();
    openProductEditor(product);
  }

  function handleStartCreateProduct() {
    closeProductDetail();
    handleCreateProduct();
  }

  async function handleSaveProduct() {
    if (!draftProduct) {
      return;
    }

    let normalizedDraft = normalizeProduct(draftProduct);
    const categoryLabel = getCategoryPathById(categories, normalizedDraft.categoryId);
    const existingProduct = getExistingProduct(normalizedDraft);
    const existingProductHasHistory = await productHasTransactionHistory(existingProduct);

    if (!normalizedDraft.categoryId) {
      setProductFormError(t("products.errorSelectCategory"));
      return;
    }

    if (!productCategoryOptions.some((category) => category.id === normalizedDraft.categoryId)) {
      setProductFormError(t("products.errorInvalidCategory"));
      return;
    }

    if (!normalizedDraft.sku) {
      normalizedDraft = {
        ...normalizedDraft,
        sku: generateStructuredSku(normalizedDraft),
      };
    }

    const skuChanged =
      existingProduct && normalizeSku(existingProduct.sku) !== normalizedDraft.sku;
    const hasUnchangedExistingSku = Boolean(existingProduct && !skuChanged);

    if (!normalizedDraft.sku) {
      setProductFormError(t("products.errorSkuRequired"));
      return;
    }

    if (!isValidSku(normalizedDraft.sku) && !hasUnchangedExistingSku) {
      setProductFormError(t("products.errorSkuInvalid"));
      return;
    }

    const duplicateProduct = allProducts.find(
      (product) =>
        `${product.id}` !== `${normalizedDraft.id}` &&
        (normalizeSku(product.sku) === normalizedDraft.sku ||
          getProductPreviousSkus(product).some((sku) => normalizeSku(sku) === normalizedDraft.sku))
    );

    if (duplicateProduct) {
      setProductFormError(
        t("products.errorSkuDuplicate", {
          sku: normalizedDraft.sku,
          name: getTranslatedProductDisplayName(duplicateProduct, t),
        })
      );
      return;
    }

    if (existingProductHasHistory && skuChanged && !skuChangeUnlocked) {
      setProductFormError(t("products.errorSkuLocked"));
      return;
    }

    if (!normalizedDraft.stockBaseUnit) {
      setProductFormError(t("products.errorNoBaseUnit"));
      return;
    }

    const purchaseUnit = normalizedDraft.unitConversions.find(
      (conversion) =>
        conversion.unit.toLowerCase() === normalizedDraft.defaultPurchaseUnit.toLowerCase()
    );
    const salesUnit = normalizedDraft.unitConversions.find(
      (conversion) =>
        conversion.unit.toLowerCase() === normalizedDraft.defaultSalesUnit.toLowerCase()
    );

    if (!purchaseUnit?.allowPurchase) {
      setProductFormError(t("products.errorPurchaseUnit"));
      return;
    }

    if (!salesUnit?.allowSale) {
      setProductFormError(t("products.errorSalesUnit"));
      return;
    }

    const nextPreviousSkus =
      existingProduct && skuChanged
        ? normalizeUniqueNames([
            ...(normalizedDraft.previousSkus || []),
            normalizeSku(existingProduct.sku),
          ])
        : normalizedDraft.previousSkus;
    const nextProduct = {
      ...normalizedDraft,
      previousSkus: nextPreviousSkus,
      category: categoryLabel,
    };
    const savedProduct = await onSaveProduct?.(nextProduct);

    if (savedProduct === false) {
      return;
    }

    closeProductEditor();
  }

  async function handleDeleteProduct() {
    if (!draftProduct) {
      return;
    }

    const existingProduct = getExistingProduct(draftProduct);
    if (!existingProduct) {
      setProductFormError(t("products.errorOnlySavedCanDelete"));
      return;
    }

    const hasTransactionHistory = await productHasTransactionHistory(existingProduct);
    if (hasTransactionHistory) {
      setProductFormError(t("products.hasHistoryDeleteDisabled"));
      return;
    }

    const confirmed = window.confirm(
      t("products.deleteConfirm", {
        name: getTranslatedProductDisplayName(draftProduct, t) || t("products.unnamedProduct"),
      })
    );

    if (!confirmed) {
      return;
    }

    const deleted = await onDeleteProduct?.(draftProduct);

    if (deleted === false) {
      return;
    }

    closeProductEditor();
  }

  async function handleDisableProduct() {
    if (!draftProduct) {
      return;
    }

    const existingProduct = getExistingProduct(draftProduct);
    if (!existingProduct) {
      setProductFormError(t("products.errorOnlySavedCanDisable"));
      return;
    }

    if (!isProductActive(existingProduct)) {
      setProductFormError(t("products.errorAlreadyDisabled"));
      return;
    }

    const confirmed = window.confirm(
      t("products.disableConfirm", {
        name: getTranslatedProductDisplayName(draftProduct, t) || t("products.unnamedProduct"),
      })
    );

    if (!confirmed) {
      return;
    }

    const savedProduct = await onSaveProduct?.({
      ...normalizeProduct(draftProduct),
      isActive: false,
    });

    if (savedProduct === false) {
      return;
    }

    closeProductEditor();
  }

  async function handleEnableProduct() {
    if (!draftProduct) {
      return;
    }

    const existingProduct = getExistingProduct(draftProduct);
    if (!existingProduct) {
      setProductFormError(t("products.errorOnlySavedCanEnable"));
      return;
    }

    if (isProductActive(existingProduct)) {
      setProductFormError(t("products.errorAlreadyEnabled"));
      return;
    }

    const savedProduct = await onSaveProduct?.({
      ...normalizeProduct(draftProduct),
      isActive: true,
    });

    if (savedProduct === false) {
      return;
    }

    closeProductEditor();
  }

  const isDraftProductActive = isProductActive(draftExistingProduct || draftProduct);
  const isDraftHistoryLoading =
    Boolean(draftExistingProduct) &&
    productHistoryLoadingId === `${draftExistingProduct.id}`;
  const isSkuLocked = Boolean(draftExistingProduct && draftProductHasHistory && !skuChangeUnlocked);
  const productDeleteDisabledReason = !draftProduct
    ? ""
    : !draftExistingProduct
      ? t("products.errorOnlySavedCanDelete")
      : isDraftHistoryLoading
        ? t("products.checkingHistoryDelete")
        : "";
  const isProductDeleteDisabled = Boolean(productDeleteDisabledReason);
  const productDisableDisabledReason = !draftProduct
    ? ""
    : !draftExistingProduct
      ? t("products.errorOnlySavedCanDisable")
      : isDraftHistoryLoading
        ? t("products.checkingHistoryDisable")
        : !isDraftProductActive
          ? t("products.errorAlreadyDisabled")
          : "";
  const isProductDisableDisabled = Boolean(productDisableDisabledReason);
  const productEnableDisabledReason = !draftProduct
    ? ""
    : !draftExistingProduct
      ? t("products.errorOnlySavedCanEnable")
      : isDraftProductActive
        ? t("products.errorAlreadyEnabled")
        : "";
  const isProductEnableDisabled = Boolean(productEnableDisabledReason);
  return (
    <div className="stack-layout">
      <ProductDirectorySection
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        isServerPaginated={isServerPaginated}
        filteredCount={filteredProductsWithMetrics.length}
        totalProductCount={totalProductCount}
        localProductCount={productsWithMetrics.length}
        showProductFilters={showProductFilters}
        activeFilterCount={activeFilterCount}
        onToggleFilters={() => setShowProductFilters((isVisible) => !isVisible)}
        onResetFilters={resetProductFilters}
        quickPresets={quickPresets}
        activeChips={activeChips}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={setCategoryFilter}
        categoryOptions={categoryOptions}
        stockFilter={stockFilter}
        onStockFilterChange={setStockFilter}
        filteredProductsWithMetrics={filteredProductsWithMetrics}
        onCreateProduct={handleStartCreateProduct}
        shouldShowViewAll={shouldShowViewAll}
        showAllRows={showAllRows}
        onToggleShowAllRows={() => setShowAllRows((currentValue) => !currentValue)}
        isCompact={isCompact}
        pagination={pagination}
        onPageChange={handlePageChange}
        onOpenProductDetail={openProductDetail}
      />

      <ProductDetailModal
        viewingProduct={viewingProduct}
        viewingTransaction={viewingTransaction}
        viewingPictureId={viewingPictureId}
        onViewingPictureChange={setViewingPictureId}
        categories={categories}
        viewingProductMetrics={viewingProductMetrics}
        productHistoryLoadingId={productHistoryLoadingId}
        productHistoryError={productHistoryError}
        viewPurchaseHistory={paginatedPurchaseHistory}
        purchaseHistoryPagination={purchaseHistoryPagination}
        onPurchaseHistoryPageChange={setPurchaseHistoryPage}
        viewSalesHistory={paginatedSalesHistory}
        salesHistoryPagination={salesHistoryPagination}
        onSalesHistoryPageChange={setSalesHistoryPage}
        onOpenTransactionDetail={openTransactionDetail}
        onOpenProductEditor={handleOpenProductEditor}
        onBackToProduct={backToProduct}
        onClose={closeAll}
      />

      <ProductEditorModal
        draftProduct={draftProduct}
        allProducts={allProducts}
        productFormError={productFormError}
        categoryQuery={categoryQuery}
        categoryComboboxOpen={categoryComboboxOpen}
        productCategoryOptions={productCategoryOptions}
        filteredProductCategoryOptions={filteredProductCategoryOptions}
        isSkuLocked={isSkuLocked}
        draftProductPictures={draftProductPictures}
        selectedDraftPicture={selectedDraftPicture}
        draftExistingProduct={draftExistingProduct}
        draftProductHasHistory={draftProductHasHistory}
        isDraftProductActive={isDraftProductActive}
        isProductEnableDisabled={isProductEnableDisabled}
        productEnableDisabledReason={productEnableDisabledReason}
        isProductDisableDisabled={isProductDisableDisabled}
        productDisableDisabledReason={productDisableDisabledReason}
        isProductDeleteDisabled={isProductDeleteDisabled}
        productDeleteDisabledReason={productDeleteDisabledReason}
        onClose={closeProductEditor}
        onSave={handleSaveProduct}
        onUpdateDraftField={updateDraftField}
        onCategoryQueryChange={handleCategoryQueryChange}
        onCategoryFocus={() => setCategoryComboboxOpen(true)}
        onCategoryBlur={handleCategoryBlur}
        onSelectDraftCategory={selectDraftCategory}
        onGenerateSku={handleGenerateSku}
        onUnlockSkuChange={handleUnlockSkuChange}
        onAddDraftSubName={addDraftSubName}
        onUpdateDraftSubName={updateDraftSubName}
        onSetDraftSubNameAsMain={setDraftSubNameAsMain}
        onRemoveDraftSubName={removeDraftSubName}
        onAddDraftUnitConversion={addDraftUnitConversion}
        onUpdateDraftUnitConversion={updateDraftUnitConversion}
        onToggleDraftUnitConversion={toggleDraftUnitConversion}
        onRemoveDraftUnitConversion={removeDraftUnitConversion}
        onAddDraftPictures={addDraftPictures}
        onSelectDraftPicture={selectDraftPicture}
        onRemoveDraftPicture={removeDraftPicture}
        onEnableProduct={handleEnableProduct}
        onDisableProduct={handleDisableProduct}
        onDeleteProduct={handleDeleteProduct}
      />
    </div>
  );
}

export default ProductsPage;
