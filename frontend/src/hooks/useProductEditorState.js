import { useMemo, useState } from "react";
import { getProductBaseUnit } from "../unitConversion";
import { getCategoryOptions, getCategoryPathById } from "../components/CategoryPage";
import {
  getCategoryPathSkuCode,
  getNextSkuSerial,
  getProductPictures,
  getSelectedProductPicture,
  normalizeProduct,
  normalizeUniqueNames,
  normalizeSku,
  resolveProductCategoryId,
} from "../components/products/productUtils";
import { createDraftPicture, createProduct } from "../components/products/productEditorHelpers";
import {
  collectionsHaveProductTransactionHistory,
  loadedProductHistoryHasTransactions,
} from "../components/products/productHistoryHelpers";

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
  const [productFormError, setProductFormError] = useState("");
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

  function openProductEditor(product) {
    const normalizedProduct = normalizeProduct(product);
    const categoryId = resolveProductCategoryId(product, categories);

    loadProductHistory(product);
    setProductFormError("");
    setSkuChangeUnlocked(false);
    setCategoryComboboxOpen(false);
    setCategoryQuery(getCategoryPathById(categories, categoryId));
    setDraftProduct({
      ...normalizedProduct,
      categoryId,
    });
  }

  function closeProductEditor() {
    setDraftProduct(null);
    setProductFormError("");
    setSkuChangeUnlocked(false);
    setCategoryQuery("");
    setCategoryComboboxOpen(false);
  }

  function updateDraftField(key, value) {
    setDraftProduct((prev) => {
      if (!prev) {
        return prev;
      }

      const nextProduct = { ...prev, [key]: value };

      if (key === "categoryId" && !value) {
        const isExistingProduct = allProducts.some((product) => `${product.id}` === `${prev.id}`);

        return {
          ...nextProduct,
          sku: isExistingProduct ? nextProduct.sku : "",
        };
      }

      if (key === "categoryId" && getCategoryPathSkuCode(categories, value)) {
        const isExistingProduct = allProducts.some((product) => `${product.id}` === `${prev.id}`);
        const shouldRegenerateSku = !isExistingProduct || !normalizeSku(nextProduct.sku);

        if (!shouldRegenerateSku) {
          return nextProduct;
        }

        return {
          ...nextProduct,
          sku: generateStructuredSku(nextProduct),
        };
      }

      return nextProduct;
    });
    setProductFormError("");
  }

  function addDraftPictures(files) {
    const nextPictures = Array.from(files || [])
      .filter((file) => file?.type?.startsWith("image/"))
      .map(createDraftPicture);

    if (!nextPictures.length) {
      return;
    }

    setDraftProduct((prev) => {
      if (!prev) {
        return prev;
      }

      const currentPictures = getProductPictures(prev);
      const selectedPictureId = prev.selectedPictureId || nextPictures[0].id;

      return {
        ...prev,
        productPictures: [...currentPictures, ...nextPictures].map((picture) => ({
          ...picture,
          isSelected: picture.id === selectedPictureId,
        })),
        selectedPictureId,
      };
    });
    setProductFormError("");
  }

  function selectDraftPicture(pictureId) {
    setDraftProduct((prev) => {
      if (!prev) {
        return prev;
      }

      return {
        ...prev,
        selectedPictureId: pictureId,
        productPictures: getProductPictures(prev).map((picture) => ({
          ...picture,
          isSelected: picture.id === pictureId,
        })),
      };
    });
    setProductFormError("");
  }

  function removeDraftPicture(pictureId) {
    setDraftProduct((prev) => {
      if (!prev) {
        return prev;
      }

      const currentPictures = getProductPictures(prev);
      const removedPicture = currentPictures.find((picture) => picture.id === pictureId);
      const nextPictures = currentPictures.filter((picture) => picture.id !== pictureId);
      const currentSelectedRemoved = prev.selectedPictureId === pictureId;
      const selectedPictureId = currentSelectedRemoved
        ? nextPictures[0]?.id || ""
        : prev.selectedPictureId;
      const removePictureIds =
        removedPicture && !removedPicture.isNew
          ? [...(prev.removePictureIds || []), removedPicture.id]
          : prev.removePictureIds || [];

      return {
        ...prev,
        productPictures: nextPictures.map((picture) => ({
          ...picture,
          isSelected: picture.id === selectedPictureId,
        })),
        selectedPictureId,
        removePictureIds,
      };
    });
    setProductFormError("");
  }

  function updateDraftSubName(index, value) {
    setDraftProduct((prev) => {
      if (!prev) {
        return prev;
      }

      const nextSubNames = [...(prev.subNames || [])];
      nextSubNames[index] = value;
      return { ...prev, subNames: nextSubNames };
    });
    setProductFormError("");
  }

  function addDraftSubName() {
    setDraftProduct((prev) =>
      prev ? { ...prev, subNames: [...(prev.subNames || []), ""] } : prev
    );
    setProductFormError("");
  }

  function removeDraftSubName(index) {
    setDraftProduct((prev) =>
      prev
        ? { ...prev, subNames: (prev.subNames || []).filter((_, itemIndex) => itemIndex !== index) }
        : prev
    );
    setProductFormError("");
  }

  function setDraftSubNameAsMain(index) {
    setDraftProduct((prev) => {
      if (!prev) {
        return prev;
      }

      const currentSubNames = [...(prev.subNames || [])];
      const selectedSubName = `${currentSubNames[index] ?? ""}`.trim();

      if (!selectedSubName) {
        return prev;
      }

      const currentMainName = `${prev.productName ?? ""}`.trim();
      const nextSubNames = currentSubNames.filter((_, itemIndex) => itemIndex !== index);

      if (currentMainName) {
        nextSubNames.unshift(currentMainName);
      }

      return {
        ...prev,
        productName: selectedSubName,
        subNames: normalizeUniqueNames(nextSubNames),
      };
    });
    setProductFormError("");
  }

  function updateDraftUnitConversion(index, key, value) {
    setDraftProduct((prev) => {
      if (!prev) {
        return prev;
      }

      const nextConversions = [...(prev.unitConversions || [])];
      nextConversions[index] = {
        ...nextConversions[index],
        [key]: value,
      };

      return { ...prev, unitConversions: nextConversions };
    });
    setProductFormError("");
  }

  function toggleDraftUnitConversion(index, key) {
    setDraftProduct((prev) => {
      if (!prev) {
        return prev;
      }

      const nextConversions = [...(prev.unitConversions || [])];
      nextConversions[index] = {
        ...nextConversions[index],
        [key]: !nextConversions[index]?.[key],
      };

      return { ...prev, unitConversions: nextConversions };
    });
    setProductFormError("");
  }

  function addDraftUnitConversion() {
    setDraftProduct((prev) =>
      prev
        ? {
            ...prev,
            unitConversions: [
              ...(prev.unitConversions || []),
              { unit: "", factorToBase: 1, allowPurchase: true, allowSale: true },
            ],
          }
        : prev
    );
    setProductFormError("");
  }

  function removeDraftUnitConversion(index) {
    setDraftProduct((prev) => {
      if (!prev) {
        return prev;
      }

      const stockBaseUnit = getProductBaseUnit(prev);
      const nextConversions = (prev.unitConversions || []).filter((conversion, itemIndex) =>
        itemIndex !== index ||
        `${conversion.unit}`.toLowerCase() === stockBaseUnit.toLowerCase()
      );

      return { ...prev, unitConversions: nextConversions };
    });
    setProductFormError("");
  }

  function handleGenerateSku() {
    if (!draftProduct) {
      return;
    }

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
    }, 120);
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
    setSkuChangeUnlocked(false);
    setCategoryQuery("");
    setCategoryComboboxOpen(false);
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
  };
}

export default useProductEditorState;
