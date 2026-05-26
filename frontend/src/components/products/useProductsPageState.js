import { useEffect } from "react";
import { normalizeProduct } from "./productUtils";
import { getCategoryPathById } from "../CategoryPage";
import { getTranslatedProductDisplayName } from "./productEditorHelpers";
import { defaultProducts } from "./defaultProducts";
import { useProductDirectoryFilters } from "../../hooks/useProductDirectoryFilters";
import useProductEditorState from "../../hooks/useProductEditorState";
import useProductDetailState from "../../hooks/useProductDetailState";
import { useLanguage } from "../../i18n/LanguageContext";
import {
  validateProductForSave,
  buildSavePayload,
  getDeleteGuard,
  getDisableGuard,
  getEnableGuard,
  getDraftActionStates,
} from "./productsPageHelpers";

function useProductsPageState({
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
    stockLayers,
    stockLayersLoading,
    stockLayersError,
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

  // Lock body scroll when any modal is open
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

    const rawNormalized = normalizeProduct(draftProduct);
    const categoryLabel = getCategoryPathById(categories, rawNormalized.categoryId);
    const existingProduct = getExistingProduct(rawNormalized);
    const existingProductHasHistory = await productHasTransactionHistory(existingProduct);

    const { error, normalizedDraft } = validateProductForSave(rawNormalized, {
      allProducts,
      productCategoryOptions,
      existingProduct,
      existingProductHasHistory,
      skuChangeUnlocked,
      generateStructuredSku,
      t,
    });

    if (error) {
      setProductFormError(error);
      return;
    }

    const nextProduct = buildSavePayload(normalizedDraft, existingProduct, categoryLabel);
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
    const hasTransactionHistory = await productHasTransactionHistory(existingProduct);
    const guardError = getDeleteGuard(existingProduct, hasTransactionHistory, t);

    if (guardError) {
      setProductFormError(guardError);
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
    const guardError = getDisableGuard(existingProduct, t);

    if (guardError) {
      setProductFormError(guardError);
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
    const guardError = getEnableGuard(existingProduct, t);

    if (guardError) {
      setProductFormError(guardError);
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

  const actionStates = getDraftActionStates({
    draftProduct,
    draftExistingProduct,
    draftProductHasHistory,
    skuChangeUnlocked,
    productHistoryLoadingId,
    t,
  });

  return {
    // Directory section props
    searchTerm,
    setSearchTerm,
    isServerPaginated,
    filteredProductsWithMetrics,
    totalProductCount,
    productsWithMetrics,
    showProductFilters,
    setShowProductFilters,
    activeFilterCount,
    resetProductFilters,
    quickPresets,
    activeChips,
    categoryFilter,
    setCategoryFilter,
    categoryOptions,
    stockFilter,
    setStockFilter,
    shouldShowViewAll,
    showAllRows,
    setShowAllRows,
    isCompact,
    pagination,
    handlePageChange,
    handleStartCreateProduct,
    openProductDetail,

    // Detail modal props
    viewingProduct,
    viewingTransaction,
    viewingPictureId,
    setViewingPictureId,
    categories,
    viewingProductMetrics,
    productHistoryLoadingId,
    productHistoryError,
    paginatedPurchaseHistory,
    purchaseHistoryPagination,
    setPurchaseHistoryPage,
    paginatedSalesHistory,
    salesHistoryPagination,
    setSalesHistoryPage,
    openTransactionDetail,
    handleOpenProductEditor,
    backToProduct,
    closeAll,
    stockLayers,
    stockLayersLoading,
    stockLayersError,

    // Editor modal props
    draftProduct,
    allProducts,
    productFormError,
    categoryQuery,
    categoryComboboxOpen,
    setCategoryComboboxOpen,
    productCategoryOptions,
    filteredProductCategoryOptions,
    draftExistingProduct,
    draftProductHasHistory,
    draftProductPictures,
    selectedDraftPicture,
    closeProductEditor,
    handleSaveProduct,
    updateDraftField,
    handleCategoryQueryChange,
    handleCategoryBlur,
    selectDraftCategory,
    handleGenerateSku,
    handleUnlockSkuChange,
    addDraftSubName,
    updateDraftSubName,
    setDraftSubNameAsMain,
    removeDraftSubName,
    addDraftUnitConversion,
    updateDraftUnitConversion,
    toggleDraftUnitConversion,
    removeDraftUnitConversion,
    addDraftPictures,
    selectDraftPicture,
    removeDraftPicture,
    handleEnableProduct,
    handleDisableProduct,
    handleDeleteProduct,

    // Derived action states
    ...actionStates,
  };
}

export default useProductsPageState;
