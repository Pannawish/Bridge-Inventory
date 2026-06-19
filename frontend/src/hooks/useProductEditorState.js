import { useMemo, useState } from "react";
import { getProductBaseUnit } from "../unitConversion";
import { getCategoryOptions, getCategoryPathById } from "../components/CategoryPage";
import {
  getCategoryPathSkuCode,
  getNextSkuSerial,
  getProductPictures,
  getSelectedProductPicture,
  normalizeProduct,
  resolveProductCategoryId,
} from "../components/products/productUtils";
import { createProduct } from "../components/products/productEditorHelpers";
import {
  collectionsHaveProductTransactionHistory,
  loadedProductHistoryHasTransactions,
} from "../components/products/productHistoryHelpers";
import {
  updateDraftFieldHelper,
  addDraftPicturesHelper,
  selectDraftPictureHelper,
  removeDraftPictureHelper,
  updateDraftSubNameHelper,
  addDraftSubNameHelper,
  removeDraftSubNameHelper,
  setDraftSubNameAsMainHelper,
  updateDraftUnitConversionHelper,
  toggleDraftUnitConversionHelper,
  addDraftUnitConversionHelper,
  removeDraftUnitConversionHelper,
} from "./productEditorStateHelpers";
import { getProductFieldError } from "../components/products/productsPageHelpers";

function useProductEditorState({
  allProducts,
  categories,
  purchases,
  sales,
  productHistoryById,
  loadProductHistory,
  t,
}) {
  const [draftProduct, setDraftProduct] = useState(null);
  const [isDraftProductDirty, setIsDraftProductDirty] = useState(false);
  const [productFormError, setProductFormError] = useState("");
  const [productFieldErrors, setProductFieldErrors] = useState({});
  const [skuChangeUnlocked, setSkuChangeUnlocked] = useState(false);
  const [categoryQuery, setCategoryQuery] = useState("");
  const [categoryComboboxOpen, setCategoryComboboxOpen] = useState(false);

  const productCategoryOptions = useMemo(
    () => getCategoryOptions(categories),
    [categories]
  );
  const filteredProductCategoryOptions = useMemo(() => {
    const normalizedQuery = categoryQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return productCategoryOptions;
    }

    return productCategoryOptions.filter((category) =>
      category.label.toLowerCase().includes(normalizedQuery)
    );
  }, [categoryQuery, productCategoryOptions]);

  function getExistingProduct(product) {
    return allProducts.find((item) => `${item.id}` === `${product?.id}`);
  }

  function getCachedProductHasTransactionHistory(product) {
    if (!product) {
      return false;
    }

    const cachedHistory = productHistoryById[`${product.id}`];
    if (cachedHistory) {
      return loadedProductHistoryHasTransactions(cachedHistory);
    }

    return collectionsHaveProductTransactionHistory(product, purchases, sales);
  }

  async function productHasTransactionHistory(product) {
    if (!product) {
      return false;
    }

    const cachedHistory = productHistoryById[`${product.id}`];
    if (cachedHistory) {
      return loadedProductHistoryHasTransactions(cachedHistory);
    }

    const loadedHistory = await loadProductHistory(product);
    if (loadedHistory) {
      return loadedProductHistoryHasTransactions(loadedHistory);
    }

    return getCachedProductHasTransactionHistory(product);
  }

  function generateStructuredSku(product) {
    const baseSku = getCategoryPathSkuCode(categories, product.categoryId);

    if (!baseSku) {
      return "";
    }

    const serial = getNextSkuSerial(baseSku, allProducts, product.id);
    return `${baseSku}${serial}`;
  }

  function getFieldValidationContext(nextDraft) {
    const existingProduct = getExistingProduct(nextDraft);
    return {
      allProducts,
      productCategoryOptions,
      existingProduct,
      existingProductHasHistory: getCachedProductHasTransactionHistory(existingProduct),
      skuChangeUnlocked,
      t,
    };
  }

  function openProductEditor(product) {
    const normalizedProduct = normalizeProduct(product);
    const categoryId = resolveProductCategoryId(product, categories);

    loadProductHistory(product);
    setProductFormError("");
    setProductFieldErrors({});
    setSkuChangeUnlocked(false);
    setCategoryComboboxOpen(false);
    setCategoryQuery(getCategoryPathById(categories, categoryId));
    setIsDraftProductDirty(false);
    setDraftProduct({
      ...normalizedProduct,
      categoryId,
    });
  }

  function closeProductEditor() {
    setDraftProduct(null);
    setProductFormError("");
    setProductFieldErrors({});
    setSkuChangeUnlocked(false);
    setCategoryQuery("");
    setCategoryComboboxOpen(false);
    setIsDraftProductDirty(false);
  }

  function updateDraftField(key, value) {
    let nextDraftSnapshot = draftProduct;
    setIsDraftProductDirty(true);
    setDraftProduct((prev) => {
      nextDraftSnapshot = updateDraftFieldHelper(
        prev,
        key,
        value,
        allProducts,
        categories,
        generateStructuredSku
      );
      return nextDraftSnapshot;
    });
    setProductFieldErrors((currentErrors) => ({
      ...currentErrors,
      [key]: getProductFieldError(key, nextDraftSnapshot, getFieldValidationContext(nextDraftSnapshot)),
    }));
    setProductFormError("");
  }

  function addDraftPictures(files) {
    setIsDraftProductDirty(true);
    setDraftProduct((prev) => addDraftPicturesHelper(prev, files));
    setProductFormError("");
  }

  function selectDraftPicture(pictureId) {
    setDraftProduct((prev) => selectDraftPictureHelper(prev, pictureId));
    setProductFormError("");
  }

  function removeDraftPicture(pictureId) {
    setIsDraftProductDirty(true);
    setDraftProduct((prev) => removeDraftPictureHelper(prev, pictureId));
    setProductFormError("");
  }

  function updateDraftSubName(index, value) {
    setIsDraftProductDirty(true);
    setDraftProduct((prev) => updateDraftSubNameHelper(prev, index, value));
    setProductFormError("");
  }

  function addDraftSubName() {
    setIsDraftProductDirty(true);
    setDraftProduct((prev) => addDraftSubNameHelper(prev));
    setProductFormError("");
  }

  function removeDraftSubName(index) {
    setIsDraftProductDirty(true);
    setDraftProduct((prev) => removeDraftSubNameHelper(prev, index));
    setProductFormError("");
  }

  function setDraftSubNameAsMain(index) {
    setIsDraftProductDirty(true);
    setDraftProduct((prev) => setDraftSubNameAsMainHelper(prev)(index));
    setProductFormError("");
  }

  function updateDraftUnitConversion(index, key, value) {
    setIsDraftProductDirty(true);
    setDraftProduct((prev) => updateDraftUnitConversionHelper(prev, index, key, value));
    setProductFormError("");
  }

  function toggleDraftUnitConversion(index, key) {
    setIsDraftProductDirty(true);
    setDraftProduct((prev) => toggleDraftUnitConversionHelper(prev, index, key));
    setProductFormError("");
  }

  function addDraftUnitConversion() {
    setIsDraftProductDirty(true);
    setDraftProduct((prev) => addDraftUnitConversionHelper(prev));
    setProductFormError("");
  }

  function removeDraftUnitConversion(index) {
    setIsDraftProductDirty(true);
    setDraftProduct((prev) => {
      const stockBaseUnit = getProductBaseUnit(prev);
      return removeDraftUnitConversionHelper(prev, index, stockBaseUnit);
    });
    setProductFormError("");
  }

  function handleGenerateSku() {
    if (!draftProduct) {
      return;
    }

    setIsDraftProductDirty(true);
    setDraftProduct((prev) => (prev ? { ...prev, sku: generateStructuredSku(prev) } : prev));
    setProductFormError("");
  }

  function selectDraftCategory(category) {
    setCategoryQuery(category.label);
    setCategoryComboboxOpen(false);
    updateDraftField("categoryId", category.id);
  }

  function handleCategoryQueryChange(value) {
    const exactCategory = productCategoryOptions.find(
      (category) => category.label.toLowerCase() === value.trim().toLowerCase()
    );

    setCategoryQuery(value);
    setCategoryComboboxOpen(true);
    updateDraftField("categoryId", exactCategory?.id || "");
  }

  function handleCategoryBlur() {
    window.setTimeout(() => {
      setCategoryComboboxOpen(false);
      setCategoryQuery(
        productCategoryOptions.find((category) => category.id === draftProduct?.categoryId)
          ?.label || ""
      );
      setProductFieldErrors((currentErrors) => ({
        ...currentErrors,
        categoryId: getProductFieldError(
          "categoryId",
          draftProduct,
          getFieldValidationContext(draftProduct)
        ),
      }));
    }, 120);
  }

  function validateDraftField(key) {
    setProductFieldErrors((currentErrors) => ({
      ...currentErrors,
      [key]: getProductFieldError(key, draftProduct, getFieldValidationContext(draftProduct)),
    }));
  }

  function handleUnlockSkuChange() {
    if (!draftProduct) {
      return;
    }

    const confirmed = window.confirm(t("products.unlockSkuConfirm"));

    if (!confirmed) {
      return;
    }

    setSkuChangeUnlocked(true);
    setProductFormError("");
  }

  function handleCreateProduct() {
    const nextDisplayId =
      allProducts.length === 0
        ? 1001
        : Math.max(...allProducts.map((product) => product.productDisplayId)) + 1;

    setProductFormError("");
    setProductFieldErrors({});
    setSkuChangeUnlocked(false);
    setCategoryQuery("");
    setCategoryComboboxOpen(false);
    setIsDraftProductDirty(false);
    setDraftProduct(createProduct({ productDisplayId: nextDisplayId }));
  }

  const draftExistingProduct = draftProduct ? getExistingProduct(draftProduct) : null;
  const draftProductHasHistory = getCachedProductHasTransactionHistory(draftExistingProduct);
  const draftProductPictures = draftProduct ? getProductPictures(draftProduct) : [];
  const selectedDraftPicture =
    draftProductPictures.find((picture) => picture.id === draftProduct?.selectedPictureId) ||
    getSelectedProductPicture(draftProduct);

  return {
    draftProduct,
    isDraftProductDirty,
    productFormError,
    productFieldErrors,
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
    setProductFieldErrors,
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
    validateDraftField,
    handleUnlockSkuChange,
    handleCreateProduct,
  };
}

export default useProductEditorState;
