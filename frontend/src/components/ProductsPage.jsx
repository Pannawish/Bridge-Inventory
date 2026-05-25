import { useEffect, useMemo, useState } from "react";
import ProductDetailModal from "./products/ProductDetailModal";
import ProductDirectorySection from "./products/ProductDirectorySection";
import ProductEditorModal from "./products/ProductEditorModal";
import { getCategoryOptions, getCategoryPathById } from "./CategoryPage";
import { getProductBaseUnit } from "../unitConversion";
import {
  getCategoryPathSkuCode,
  getNextSkuSerial,
  getProductPictures,
  getProductPreviousSkus,
  getSelectedProductPicture,
  isValidSku,
  isProductActive,
  normalizeProduct,
  normalizeSku,
  normalizeUniqueNames,
  resolveProductCategoryId,
} from "./products/productUtils";
import { useLanguage } from "../i18n/LanguageContext";
import {
  createDraftPicture,
  createProduct,
  getTranslatedProductDisplayName,
} from "./products/productEditorHelpers";
import {
  collectionsHaveProductTransactionHistory,
  createLocalPagination,
  getPaginatedRows,
  getProductPurchaseHistoryEntries,
  getProductSalesHistoryEntries,
  loadedProductHistoryHasTransactions,
} from "./products/productHistoryHelpers";
import { useProductDirectoryFilters } from "../hooks/useProductDirectoryFilters";

const defaultProducts = [
  createProduct({
    id: "product-1",
    productDisplayId: 1001,
    sku: "NB-A5-001",
    productName: "Notebook A5",
    subNames: ["A5 Notebook", "Spiral Notebook A5"],
    stockBaseUnit: "pcs",
    defaultPurchaseUnit: "pack",
    defaultSalesUnit: "pcs",
    unitConversions: [
      { unit: "pcs", factorToBase: 1, allowPurchase: true, allowSale: true },
      { unit: "pack", factorToBase: 12, allowPurchase: true, allowSale: false },
      { unit: "carton", factorToBase: 120, allowPurchase: true, allowSale: false },
    ],
    categoryId: "category-notebooks",
    category: "Stationery / Notebooks",
    detail: "Standard A5 spiral notebook, 80 pages, ruled. Suitable for students and office use.",
  }),
  createProduct({
    id: "product-2",
    productDisplayId: 1002,
    sku: "PEN-BL-014",
    productName: "Blue Ballpoint Pen",
    subNames: ["Blue Pen", "Ball Pen Blue"],
    stockBaseUnit: "pcs",
    defaultPurchaseUnit: "box",
    defaultSalesUnit: "pcs",
    unitConversions: [
      { unit: "pcs", factorToBase: 1, allowPurchase: true, allowSale: true },
      { unit: "box", factorToBase: 50, allowPurchase: true, allowSale: true },
    ],
    categoryId: "category-pens",
    category: "Writing Tools / Pens",
    detail: "Medium tip blue ballpoint pen. Smooth writing, long-lasting ink.",
  }),
  createProduct({
    id: "product-3",
    productDisplayId: 1003,
    sku: "STP-MN-009",
    productName: "Mini Stapler",
    subNames: ["Small Stapler"],
    stockBaseUnit: "pcs",
    defaultPurchaseUnit: "pcs",
    defaultSalesUnit: "pcs",
    unitConversions: [
      { unit: "pcs", factorToBase: 1, allowPurchase: true, allowSale: true },
    ],
    categoryId: "category-staplers",
    category: "Desk Accessories / Staplers",
    detail: "Compact desktop stapler. Accepts standard 26/6 staples. Capacity up to 20 sheets.",
  }),
  createProduct({
    id: "product-4",
    productDisplayId: 1004,
    sku: "STK-NT-022",
    productName: "Sticky Notes Set",
    subNames: ["Memo Notes Set", "Sticky Memo Pads"],
    stockBaseUnit: "set",
    defaultPurchaseUnit: "box",
    defaultSalesUnit: "set",
    unitConversions: [
      { unit: "set", factorToBase: 1, allowPurchase: true, allowSale: true },
      { unit: "box", factorToBase: 24, allowPurchase: true, allowSale: false },
    ],
    categoryId: "category-sticky-notes",
    category: "Paper Goods / Sticky Notes",
    detail: "Pack of 4 sticky note pads, 100 sheets each. Assorted colors.",
  }),
  createProduct({
    id: "product-5",
    productDisplayId: 1005,
    sku: "WBM-001",
    productName: "Whiteboard Marker",
    subNames: ["Dry Erase Marker", "Board Marker"],
    stockBaseUnit: "pcs",
    defaultPurchaseUnit: "box",
    defaultSalesUnit: "pcs",
    unitConversions: [
      { unit: "pcs", factorToBase: 1, allowPurchase: true, allowSale: true },
      { unit: "box", factorToBase: 12, allowPurchase: true, allowSale: true },
    ],
    categoryId: "category-markers",
    category: "Presentation Supplies / Markers",
    detail: "Low-odor whiteboard marker with chisel tip. Suitable for classrooms and meeting rooms.",
  }),
  createProduct({
    id: "product-6",
    productDisplayId: 1006,
    sku: "FLD-A4-010",
    productName: "File Folder",
    subNames: ["A4 File Folder", "Document Folder"],
    stockBaseUnit: "pcs",
    defaultPurchaseUnit: "pack",
    defaultSalesUnit: "pcs",
    unitConversions: [
      { unit: "pcs", factorToBase: 1, allowPurchase: true, allowSale: true },
      { unit: "pack", factorToBase: 10, allowPurchase: true, allowSale: true },
      { unit: "carton", factorToBase: 100, allowPurchase: true, allowSale: false },
    ],
    categoryId: "category-filing",
    category: "Desk Accessories / Filing",
    detail: "Durable A4 file folder for daily document handling and archiving.",
  }),
  createProduct({
    id: "product-7",
    productDisplayId: 1007,
    sku: "STP-26-006",
    productName: "Staples Pack",
    subNames: ["26/6 Staples", "Stapler Refills"],
    stockBaseUnit: "pack",
    defaultPurchaseUnit: "box",
    defaultSalesUnit: "pack",
    unitConversions: [
      { unit: "pack", factorToBase: 1, allowPurchase: true, allowSale: true },
      { unit: "box", factorToBase: 10, allowPurchase: true, allowSale: false },
    ],
    categoryId: "category-staplers",
    category: "Desk Accessories / Staplers",
    detail: "Standard 26/6 staples refill pack for office staplers.",
  }),
  createProduct({
    id: "product-8",
    productDisplayId: 1008,
    sku: "HLT-SET-008",
    productName: "Highlighter Set",
    subNames: ["Fluorescent Marker Set"],
    stockBaseUnit: "set",
    defaultPurchaseUnit: "box",
    defaultSalesUnit: "set",
    unitConversions: [
      { unit: "set", factorToBase: 1, allowPurchase: true, allowSale: true },
      { unit: "box", factorToBase: 12, allowPurchase: true, allowSale: false },
    ],
    categoryId: "category-markers",
    category: "Presentation Supplies / Markers",
    detail: "Set of assorted-color highlighters for review and study marking.",
  }),
  createProduct({
    id: "product-9",
    productDisplayId: 1009,
    sku: "BND-PVC-002",
    productName: "PVC Binder 2 Inch",
    subNames: ["2 Inch Binder", "Ring Binder"],
    stockBaseUnit: "pcs",
    defaultPurchaseUnit: "carton",
    defaultSalesUnit: "pcs",
    unitConversions: [
      { unit: "pcs", factorToBase: 1, allowPurchase: true, allowSale: true },
      { unit: "carton", factorToBase: 12, allowPurchase: true, allowSale: false },
    ],
    categoryId: "category-filing",
    category: "Desk Accessories / Filing",
    detail: "Heavy-duty PVC ring binder for document storage and archive workflows.",
  }),
  createProduct({
    id: "product-10",
    productDisplayId: 1010,
    sku: "CRT-005",
    productName: "Correction Tape",
    subNames: ["White Correction Tape"],
    stockBaseUnit: "pcs",
    defaultPurchaseUnit: "box",
    defaultSalesUnit: "pcs",
    unitConversions: [
      { unit: "pcs", factorToBase: 1, allowPurchase: true, allowSale: true },
      { unit: "box", factorToBase: 24, allowPurchase: true, allowSale: false },
    ],
    categoryId: "category-correction",
    category: "Writing Tools / Correction",
    detail: "Quick-dry correction tape for forms, notes, and printed worksheets.",
  }),
];

export function getDefaultProducts() {
  return defaultProducts.map((product) => normalizeProduct(product));
}

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
  const [viewingProduct, setViewingProduct] = useState(null);
  const [viewingTransaction, setViewingTransaction] = useState(null);
  const [viewingPictureId, setViewingPictureId] = useState("");
  const [productHistoryById, setProductHistoryById] = useState({});
  const [productHistoryLoadingId, setProductHistoryLoadingId] = useState("");
  const [productHistoryError, setProductHistoryError] = useState("");
  const [draftProduct, setDraftProduct] = useState(null);
  const [productFormError, setProductFormError] = useState("");
  const [skuChangeUnlocked, setSkuChangeUnlocked] = useState(false);
  const [purchaseHistoryPage, setPurchaseHistoryPage] = useState(1);
  const [salesHistoryPage, setSalesHistoryPage] = useState(1);
  const [categoryQuery, setCategoryQuery] = useState("");
  const [categoryComboboxOpen, setCategoryComboboxOpen] = useState(false);
  const { t } = useLanguage();

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

  useEffect(() => {
    setPurchaseHistoryPage(1);
    setSalesHistoryPage(1);
  }, [viewingProduct?.id]);

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

  async function loadProductHistory(product) {
    const productId = `${product?.id ?? ""}`;

    if (!productId || productHistoryById[productId]) {
      return productHistoryById[productId] || null;
    }

    if (!onLoadProductHistory) {
      return null;
    }

    setProductHistoryLoadingId(productId);
    setProductHistoryError("");

    try {
      const history = await onLoadProductHistory(productId);
      const normalizedHistory = {
        purchases: Array.isArray(history?.purchases) ? history.purchases : [],
        sales: Array.isArray(history?.sales) ? history.sales : [],
        hasTransactionHistory: Boolean(history?.has_transaction_history),
      };

      setProductHistoryById((current) => ({
        ...current,
        [productId]: normalizedHistory,
      }));
      return normalizedHistory;
    } catch (requestError) {
      setProductHistoryError(requestError.message);
      return null;
    } finally {
      setProductHistoryLoadingId("");
    }
  }

  function openProductDetail(product) {
    const selectedPicture = getSelectedProductPicture(product);

    setViewingProduct(product);
    setViewingPictureId(selectedPicture?.id || "");
    setViewingTransaction(null);
    setDraftProduct(null);
    loadProductHistory(product);
  }

  function closeAll() {
    setViewingProduct(null);
    setViewingTransaction(null);
    setViewingPictureId("");
  }

  function openTransactionDetail(type, data) {
    setViewingTransaction({ type, data });
  }

  function backToProduct() {
    setViewingTransaction(null);
  }

  function openProductEditor(product) {
    const normalizedProduct = normalizeProduct(product);
    const categoryId = resolveProductCategoryId(product, categories);

    loadProductHistory(product);
    setViewingProduct(null);
    setViewingTransaction(null);
    setViewingPictureId("");
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
        : Math.max(...allProducts.map((p) => p.productDisplayId)) + 1;

    setViewingProduct(null);
    setViewingTransaction(null);
    setViewingPictureId("");
    setProductFormError("");
    setSkuChangeUnlocked(false);
    setCategoryQuery("");
    setCategoryComboboxOpen(false);
    setDraftProduct(createProduct({ productDisplayId: nextDisplayId }));
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

    setDraftProduct(null);
    setSkuChangeUnlocked(false);
    setProductFormError("");
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

    setDraftProduct(null);
    setCategoryQuery("");
    setCategoryComboboxOpen(false);
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

    setDraftProduct(null);
    setCategoryQuery("");
    setCategoryComboboxOpen(false);
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

    setDraftProduct(null);
    setCategoryQuery("");
    setCategoryComboboxOpen(false);
  }

  const viewingHistory = viewingProduct ? productHistoryById[`${viewingProduct.id}`] : null;
  const viewPurchaseHistory = viewingProduct
    ? viewingHistory
      ? getProductPurchaseHistoryEntries(viewingProduct, viewingHistory.purchases)
      : getProductPurchaseHistoryEntries(viewingProduct, purchases)
    : [];
  const viewSalesHistory = viewingProduct
    ? viewingHistory
      ? getProductSalesHistoryEntries(viewingProduct, viewingHistory.sales)
      : getProductSalesHistoryEntries(viewingProduct, sales)
    : [];
  const purchaseHistoryPagination = createLocalPagination(
    viewPurchaseHistory.length,
    purchaseHistoryPage
  );
  const salesHistoryPagination = createLocalPagination(
    viewSalesHistory.length,
    salesHistoryPage
  );
  const paginatedPurchaseHistory = getPaginatedRows(
    viewPurchaseHistory,
    purchaseHistoryPagination
  );
  const paginatedSalesHistory = getPaginatedRows(
    viewSalesHistory,
    salesHistoryPagination
  );
  const viewingProductMetrics = viewingProduct
    ? getProductMetrics(
        viewingProduct,
        viewingHistory?.purchases || purchases,
        viewingHistory?.sales || sales
      )
    : null;
  const draftExistingProduct = draftProduct ? getExistingProduct(draftProduct) : null;
  const draftProductHasHistory = getCachedProductHasTransactionHistory(draftExistingProduct);
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
  const draftProductPictures = draftProduct ? getProductPictures(draftProduct) : [];
  const selectedDraftPicture =
    draftProductPictures.find((picture) => picture.id === draftProduct.selectedPictureId) ||
    getSelectedProductPicture(draftProduct);

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
        onCreateProduct={handleCreateProduct}
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
        onOpenProductEditor={openProductEditor}
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
