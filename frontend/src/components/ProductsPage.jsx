import { useEffect, useMemo, useState } from "react";
import PaginationControls from "./PaginationControls";
import { FilterPresets, ActiveFilterChips } from "./FilterControls";
import ProductDetailModal from "./products/ProductDetailModal";
import {
  getCategoryLeafLabel,
  getCategoryOptions,
  getCategoryPathById,
} from "./CategoryPage";
import {
  getProductBaseUnit,
  getProductDefaultPurchaseUnit,
  getProductDefaultSalesUnit,
} from "../unitConversion";
import {
  formatCurrency,
  formatStockQuantity,
  getCategoryPathSkuCode,
  getDocumentName,
  getNextSkuSerial,
  getProductAllNames,
  getProductCategoryLabel,
  getProductMetrics,
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
  const [searchTerm, setSearchTerm] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showProductFilters, setShowProductFilters] = useState(false);
  const [showAllRows, setShowAllRows] = useState(false);
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

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const isServerPaginated = Boolean(pagination && onPageRequest);
  const productCategoryOptions = useMemo(
    () => getCategoryOptions(categories),
    [categories]
  );

  const productsWithMetrics = useMemo(
    () =>
      products.map((product) => ({
        product,
        metrics: getProductMetrics(product, purchases, sales),
        categoryLabel: getProductCategoryLabel(product, categories),
      })),
    [categories, products, purchases, sales]
  );

  const categoryOptions = useMemo(
    () =>
      [
        ...new Set(
          allProducts
            .map((product) => getProductCategoryLabel(product, categories))
            .filter(Boolean)
        ),
      ]
        .sort((left, right) => left.localeCompare(right)),
    [allProducts, categories]
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

  const filteredProductsWithMetrics = useMemo(() => {
    if (isServerPaginated) {
      return productsWithMetrics;
    }

    return productsWithMetrics.filter(({ product, metrics, categoryLabel }) => {
      const searchableNames = getProductAllNames(product);
      const matchesSearch =
        !normalizedSearch ||
        searchableNames.some((name) => name.toLowerCase().includes(normalizedSearch)) ||
        categoryLabel.toLowerCase().includes(normalizedSearch) ||
        `${product.sku ?? ""}`.toLowerCase().includes(normalizedSearch) ||
        getProductPreviousSkus(product).some((sku) =>
          sku.toLowerCase().includes(normalizedSearch)
        ) ||
        `${product.productDisplayId}`.includes(normalizedSearch);

      if (!matchesSearch) {
        return false;
      }

      if (categoryFilter !== "all" && categoryLabel !== categoryFilter) {
        return false;
      }

      if (stockFilter === "in-stock") {
        return metrics.totalUnits > 0;
      }

      if (stockFilter === "out-of-stock") {
        return metrics.totalUnits <= 0;
      }

      if (stockFilter === "low-stock") {
        const reorderLevel =
          Number(product.reorderLevel ?? product.reorder_level ?? 0) || 0;
        return (
          metrics.totalUnits > 0 &&
          reorderLevel > 0 &&
          metrics.totalUnits <= reorderLevel
        );
      }

      if (stockFilter === "selling") {
        return metrics.activeSalesCount > 0;
      }

      if (stockFilter === "no-sales") {
        return metrics.activeSalesCount === 0;
      }

      if (stockFilter === "no-purchases") {
        return metrics.receivedPurchaseCount === 0;
      }

      return true;
    });
  }, [categoryFilter, isServerPaginated, normalizedSearch, productsWithMetrics, stockFilter]);
  const activeFilterCount =
    (categoryFilter === "all" ? 0 : 1) + (stockFilter === "all" ? 0 : 1);
  const compactRows = 5;
  const shouldShowViewAll =
    !isServerPaginated && filteredProductsWithMetrics.length > compactRows;
  const isCompact = shouldShowViewAll && !showAllRows;
  const totalProductCount = pagination?.count ?? products.length;

  function getPageRequestParams(page = 1) {
    return {
      page,
      search: searchTerm,
      category: categoryFilter === "all" ? "" : categoryFilter,
      stockFilter: stockFilter === "all" ? "" : stockFilter,
    };
  }

  useEffect(() => {
    if (!isServerPaginated) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      onPageRequest(getPageRequestParams(1));
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [categoryFilter, isServerPaginated, onPageRequest, searchTerm, stockFilter]);

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

  function resetProductFilters() {
    setCategoryFilter("all");
    setStockFilter("all");
  }

  const stockLabels = {
    "in-stock": t("products.inStock"),
    "low-stock": t("products.lowStock"),
    "out-of-stock": t("products.outOfStock"),
    selling: t("products.hasSales"),
    "no-sales": t("products.noSalesYet"),
    "no-purchases": t("products.noReceivedPurchases"),
  };
  const toggleStock = (value) =>
    setStockFilter((current) => (current === value ? "all" : value));
  const quickPresets = [
    {
      label: t("products.inStock"),
      active: stockFilter === "in-stock",
      onClick: () => toggleStock("in-stock"),
    },
    {
      label: t("products.lowStock"),
      active: stockFilter === "low-stock",
      onClick: () => toggleStock("low-stock"),
    },
    {
      label: t("products.outOfStock"),
      active: stockFilter === "out-of-stock",
      onClick: () => toggleStock("out-of-stock"),
    },
    {
      label: t("products.noSalesYet"),
      active: stockFilter === "no-sales",
      onClick: () => toggleStock("no-sales"),
    },
  ];
  const activeChips = [
    categoryFilter !== "all" && {
      key: "category",
      label: t("products.categoryChip", { label: categoryFilter }),
      onRemove: () => setCategoryFilter("all"),
    },
    stockFilter !== "all" && {
      key: "stock",
      label: stockLabels[stockFilter] || stockFilter,
      onRemove: () => setStockFilter("all"),
    },
  ].filter(Boolean);

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
      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("products.eyebrow")}</p>
            <h3>{t("products.findTitle")}</h3>
          </div>
        </div>

        <div className="supplier-directory-toolbar">
          <label className="stock-search supplier-search">
            <span className="stock-search-icon">S</span>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={t("products.searchPlaceholder")}
            />
          </label>
          <div className="stock-report-summary supplier-search-meta">
            <span>
              {isServerPaginated
                ? t("products.pageCountServer", { count: filteredProductsWithMetrics.length, total: totalProductCount })
                : t("products.pageCountLocal", { count: filteredProductsWithMetrics.length, total: productsWithMetrics.length })}
            </span>
          </div>
        </div>

        <div className="history-filter-actions">
          <button
            className="secondary-button product-filter-toggle"
            type="button"
            aria-expanded={showProductFilters}
            onClick={() => setShowProductFilters((isVisible) => !isVisible)}
          >
            {t("filterControls.filter")}
            {activeFilterCount ? <span>{activeFilterCount}</span> : null}
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={resetProductFilters}
          >
            {t("filterControls.resetFilter")}
          </button>
        </div>

        <FilterPresets presets={quickPresets} />
        <ActiveFilterChips chips={activeChips} onClearAll={resetProductFilters} />

        {showProductFilters ? (
          <div className="history-filter-panel">
            <div className="history-filter-grid">
              <label className="history-filter-field">
                <span className="history-filter-title">{t("products.categoryFilter")}</span>
                <select
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                >
                  <option value="all">{t("products.allCategories")}</option>
                  {categoryOptions.map((categoryLabel) => (
                    <option key={categoryLabel} value={categoryLabel}>
                      {categoryLabel}
                    </option>
                  ))}
                </select>
              </label>

              <label className="history-filter-field">
                <span className="history-filter-title">{t("products.inventoryFilter")}</span>
                <select
                  value={stockFilter}
                  onChange={(event) => setStockFilter(event.target.value)}
                >
                  <option value="all">{t("products.allStock")}</option>
                  <option value="in-stock">{t("products.inStock")}</option>
                  <option value="low-stock">{t("products.lowStock")}</option>
                  <option value="out-of-stock">{t("products.outOfStock")}</option>
                  <option value="selling">{t("products.hasSales")}</option>
                  <option value="no-sales">{t("products.noSalesYet")}</option>
                  <option value="no-purchases">{t("products.noReceivedPurchases")}</option>
                </select>
              </label>
            </div>
          </div>
        ) : null}
      </section>

      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("products.historyEyebrow")}</p>
            <h3>{t("products.historyTitle")}</h3>
          </div>
          <div className="transaction-table-actions">
            <button className="primary-button" type="button" onClick={handleCreateProduct}>
              {t("products.newProduct")}
            </button>
            {shouldShowViewAll ? (
              <button
                className="secondary-button"
                type="button"
                onClick={() => setShowAllRows((currentValue) => !currentValue)}
              >
                {showAllRows ? t("common.showRecent") : t("common.viewMore")}
              </button>
            ) : null}
          </div>
        </div>

        {filteredProductsWithMetrics.length === 0 ? (
          <p className="empty-copy">{t("products.noMatch")}</p>
        ) : (
          <div
            className={
              isCompact
                ? "transaction-table-window product-table-window compact-history"
                : "transaction-table-window product-table-window"
            }
          >
            <div className="table-scroll desktop-table">
              <table className="transaction-history-table">
                <thead>
                  <tr>
                    <th className="product-col-index">{t("products.colIndex")}</th>
                    <th className="product-col-name">{t("products.colProduct")}</th>
                    <th className="product-col-category">{t("products.colCategory")}</th>
                    <th className="product-col-stock">{t("products.colStock")}</th>
                    <th className="product-col-cost">{t("products.colAvgCost")}</th>
                    <th className="product-col-action">{t("products.colAction")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProductsWithMetrics.map(({ product, metrics, categoryLabel }, index) => (
                    <tr
                      key={product.id}
                      className={!isProductActive(product) ? "product-row-disabled" : undefined}
                    >
                      <td>{index + 1}</td>
                      <td>
                        <div className="transaction-reference-cell">
                          <strong>{getTranslatedProductDisplayName(product, t)}</strong>
                          <span>
                            {product.sku ? t("products.skuDisplay", { sku: product.sku }) : t("products.skuNotSet")}
                            {!isProductActive(product) ? ` · ${t("products.disabledBadge")}` : ""}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="cell-stack">
                          <strong>{getCategoryLeafLabel(categoryLabel) || t("products.unassigned")}</strong>
                          <span>{product.detail || t("products.noDetail")}</span>
                        </div>
                      </td>
                      <td>
                        <div className="cell-stack">
                          <strong>{formatStockQuantity(metrics.totalUnits, product)}</strong>
                          <span>
                            {t("products.buyAndSell", {
                              purchaseUnit: getProductDefaultPurchaseUnit(product),
                              salesUnit: getProductDefaultSalesUnit(product),
                            })}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="cell-stack">
                          <strong>{formatCurrency(metrics.avgPrice)}</strong>
                        </div>
                      </td>
                      <td>
                        <button
                          className="table-action-button"
                          type="button"
                          onClick={() => openProductDetail(product)}
                        >
                          {t("products.viewButton")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mobile-record-list">
              {filteredProductsWithMetrics.map(({ product, metrics, categoryLabel }, index) => (
                <article
                  className={
                    isProductActive(product)
                      ? "mobile-record-card"
                      : "mobile-record-card product-row-disabled"
                  }
                  key={`mobile-product-${product.id}`}
                >
                  <div className="mobile-record-header">
                    <div className="mobile-record-title">
                      <span className="mobile-record-index">{index + 1}</span>
                      <div className="cell-stack">
                        <strong>{getTranslatedProductDisplayName(product, t)}</strong>
                        <span>
                          {product.sku ? t("products.skuDisplay", { sku: product.sku }) : t("products.skuNotSet")}
                          {!isProductActive(product) ? ` · ${t("products.disabledBadge")}` : ""}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mobile-record-grid">
                    <div>
                      <span>{t("products.colCategory")}</span>
                      <strong>{getCategoryLeafLabel(categoryLabel) || t("products.unassigned")}</strong>
                    </div>
                    <div>
                      <span>{t("products.colStock")}</span>
                      <strong>{formatStockQuantity(metrics.totalUnits, product)}</strong>
                    </div>
                    <div>
                      <span>{t("products.colAvgCost")}</span>
                      <strong>{formatCurrency(metrics.avgPrice)}</strong>
                    </div>
                  </div>

                  <button
                    className="secondary-button table-action-button mobile-record-button"
                    type="button"
                    onClick={() => openProductDetail(product)}
                  >
                    {t("products.viewButton")}
                  </button>
                </article>
              ))}
            </div>
          </div>
        )}
        <PaginationControls
          pagination={pagination}
          itemLabel={t("products.paginationLabel")}
          onPageChange={(page) => onPageRequest?.(getPageRequestParams(page))}
        />
      </section>

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

      {draftProduct ? (
        <div className="modal-backdrop">
          <div
            className="detail-modal supplier-modal product-editor-modal section-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-modal-title"
          >
            <div className="section-heading supplier-modal-header">
              <div>
                <p className="eyebrow">
                  {allProducts.some((p) => p.id === draftProduct.id) ? t("products.editEyebrow") : t("products.newEyebrow")}
                </p>
                <h3 id="product-modal-title">
                  {getTranslatedProductDisplayName(draftProduct, t) || t("products.newEyebrow")}
                </h3>
              </div>
              <button
                className="icon-button subtle"
                type="button"
                aria-label={t("common.close")}
                onClick={closeProductEditor}
              >
                X
              </button>
            </div>

            {productFormError ? <div className="error-banner">{productFormError}</div> : null}

            <form
              className="form-layout"
              onSubmit={(event) => {
                event.preventDefault();
                handleSaveProduct();
              }}
            >
              <div className="product-editor-layout">
                <section className="product-editor-section">
                  <div className="product-editor-section-heading">
                    <div>
                      <p className="eyebrow">{t("products.identityEyebrow")}</p>
                      <h4>{t("products.identityTitle")}</h4>
                    </div>
                    <span>{t("products.identityHint")}</span>
                  </div>

                  <div className="product-editor-grid">
                    <label className="full-width">
                      <span className="required-label">{t("products.mainNameLabel")}</span>
                      <input
                        autoFocus
                        value={draftProduct.productName}
                        onChange={(event) => updateDraftField("productName", event.target.value)}
                        placeholder={t("products.mainNamePlaceholder")}
                      />
                    </label>

                    <label className="supplier-combobox-field full-width">
                      <span className="required-label">{t("products.categoryLabel")}</span>
                      <div className="supplier-combobox">
                        <input
                          type="search"
                          value={categoryQuery}
                          onChange={(event) => handleCategoryQueryChange(event.target.value)}
                          onFocus={() => setCategoryComboboxOpen(true)}
                          onBlur={handleCategoryBlur}
                          placeholder={
                            productCategoryOptions.length
                              ? t("products.searchCategoryPlaceholder")
                              : t("products.noCategoryPlaceholder")
                          }
                          autoComplete="off"
                          aria-expanded={categoryComboboxOpen}
                          aria-controls="product-editor-category-list"
                        />

                        {categoryComboboxOpen ? (
                          <div
                            className="supplier-combobox-menu"
                            id="product-editor-category-list"
                            role="listbox"
                          >
                            {filteredProductCategoryOptions.length ? (
                              filteredProductCategoryOptions.map((category) => (
                                <button
                                  key={category.id}
                                  type="button"
                                  className={
                                    category.id === draftProduct.categoryId
                                      ? "supplier-combobox-option active"
                                      : "supplier-combobox-option"
                                  }
                                  onMouseDown={(event) => {
                                    event.preventDefault();
                                    selectDraftCategory(category);
                                  }}
                                  role="option"
                                  aria-selected={category.id === draftProduct.categoryId}
                                >
                                  {category.label}
                                </button>
                              ))
                            ) : (
                              <div className="supplier-combobox-empty">
                                {t("products.noCategoryFound")}
                              </div>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </label>

                    <label className="supplier-option-field product-editor-wide-field">
                      <span className="required-label">{t("products.skuLabel")}</span>
                      <div className="product-sku-edit-row">
                        <input
                          value={draftProduct.sku}
                          onChange={(event) => updateDraftField("sku", event.target.value)}
                          onBlur={() => {
                            if (!isSkuLocked) {
                              updateDraftField("sku", `${draftProduct.sku ?? ""}`.trim());
                            }
                          }}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          placeholder={t("products.skuPlaceholder")}
                          disabled={isSkuLocked}
                        />
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={handleGenerateSku}
                          disabled={isSkuLocked}
                        >
                          {t("products.generateButton")}
                        </button>
                        {isSkuLocked ? (
                          <button
                            className="table-action-button"
                            type="button"
                            onClick={handleUnlockSkuChange}
                          >
                            {t("products.changeSkuButton")}
                          </button>
                        ) : null}
                      </div>
                      <span className="field-helper-text">
                        {isSkuLocked
                          ? t("products.skuHelperLocked")
                          : t("products.skuHelperUnlocked")}
                      </span>
                    </label>

                  </div>

                  <div className="supplier-option-field product-editor-subsection">
                    <div className="product-name-editor-header">
                      <div>
                        <p className="detail-label">{t("products.subNamesLabel")}</p>
                        <p className="inventory-note product-name-editor-note">
                          {t("products.subNamesNote")}
                        </p>
                      </div>
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={addDraftSubName}
                      >
                        {t("products.addSubNameButton")}
                      </button>
                    </div>

                    {(draftProduct.subNames || []).length === 0 ? (
                      <p className="empty-copy">{t("products.noSubNamesYet")}</p>
                    ) : (
                      (draftProduct.subNames || []).map((subName, index) => (
                        <div className="supplier-option-edit-row" key={`product-sub-name-${index}`}>
                          <input
                            value={subName}
                            onChange={(event) => updateDraftSubName(index, event.target.value)}
                            placeholder={t("products.subNamePlaceholder", { n: index + 1 })}
                          />
                          <div className="supplier-option-edit-actions">
                            <button
                              className="table-action-button"
                              type="button"
                              onClick={() => setDraftSubNameAsMain(index)}
                            >
                              {t("products.useAsMainButton")}
                            </button>
                            <button
                              className="icon-button subtle"
                              type="button"
                              aria-label={t("products.removeSubNameAriaLabel", { n: index + 1 })}
                              onClick={() => removeDraftSubName(index)}
                            >
                              X
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <section className="product-editor-section">
                  <div className="product-editor-section-heading">
                    <div>
                      <p className="eyebrow">{t("products.stockUnitsEyebrow")}</p>
                      <h4>{t("products.stockUnitsTitle")}</h4>
                    </div>
                    <span>{t("products.stockUnitsHint")}</span>
                  </div>

                  <div className="product-editor-grid product-editor-unit-grid">
                    <label>
                      <span className="required-label">{t("products.baseStockUnitLabel")}</span>
                      <input
                        value={draftProduct.stockBaseUnit}
                        onChange={(event) => updateDraftField("stockBaseUnit", event.target.value)}
                        placeholder={t("products.baseStockUnitPlaceholder")}
                      />
                    </label>

                    <label>
                      <span className="required-label">{t("products.defaultPurchaseUnitLabel")}</span>
                      <input
                        value={draftProduct.defaultPurchaseUnit}
                        onChange={(event) =>
                          updateDraftField("defaultPurchaseUnit", event.target.value)
                        }
                        placeholder={t("products.defaultPurchaseUnitPlaceholder")}
                      />
                    </label>

                    <label>
                      <span className="required-label">{t("products.defaultSalesUnitLabel")}</span>
                      <input
                        value={draftProduct.defaultSalesUnit}
                        onChange={(event) => updateDraftField("defaultSalesUnit", event.target.value)}
                        placeholder={t("products.defaultSalesUnitPlaceholder")}
                      />
                    </label>
                  </div>

                  <div className="supplier-option-field product-editor-subsection">
                    <div className="product-name-editor-header">
                      <div>
                        <p className="detail-label">{t("products.unitConversionsLabel")}</p>
                        <p className="inventory-note product-name-editor-note">
                          {t("products.unitConversionsNote")}
                        </p>
                      </div>
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={addDraftUnitConversion}
                      >
                        {t("products.addUnitButton")}
                      </button>
                    </div>

                    {(draftProduct.unitConversions || []).map((conversion, index) => (
                      <div className="unit-conversion-row" key={`unit-conversion-${index}`}>
                        <label>
                          <span className="required-label">{t("products.unitLabel")}</span>
                          <input
                            value={conversion.unit}
                            onChange={(event) =>
                              updateDraftUnitConversion(index, "unit", event.target.value)
                            }
                            placeholder={t("products.unitPlaceholder")}
                          />
                        </label>
                        <label>
                          <span className="required-label">{t("products.factorToBaseLabel")}</span>
                          <input
                            type="number"
                            min="0.000001"
                            step="0.000001"
                            value={conversion.factorToBase}
                            onChange={(event) =>
                              updateDraftUnitConversion(index, "factorToBase", event.target.value)
                            }
                            placeholder="1"
                          />
                        </label>
                        <label className="unit-conversion-check">
                          <input
                            type="checkbox"
                            checked={!!conversion.allowPurchase}
                            onChange={() => toggleDraftUnitConversion(index, "allowPurchase")}
                          />
                          {t("products.allowPurchaseLabel")}
                        </label>
                        <label className="unit-conversion-check">
                          <input
                            type="checkbox"
                            checked={!!conversion.allowSale}
                            onChange={() => toggleDraftUnitConversion(index, "allowSale")}
                          />
                          {t("products.allowSaleLabel")}
                        </label>
                        <button
                          className="icon-button subtle"
                          type="button"
                          aria-label={t("products.removeUnitAriaLabel", { n: index + 1 })}
                          onClick={() => removeDraftUnitConversion(index)}
                        >
                          X
                        </button>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="product-editor-section">
                  <div className="product-editor-section-heading">
                    <div>
                      <p className="eyebrow">{t("products.detailSectionEyebrow")}</p>
                      <h4>{t("products.detailSectionTitle")}</h4>
                    </div>
                    <span>{t("products.detailSectionHint")}</span>
                  </div>

                  <div className="product-editor-grid">
                    <div className="transaction-document-panel product-picture-upload-panel full-width">
                      <div className="transaction-document-panel-header">
                        <div>
                          <strong>{t("products.pictureLabel")}</strong>
                          <span>
                            {draftProductPictures.length
                              ? t("products.picturesAttached", { count: draftProductPictures.length, plural: draftProductPictures.length === 1 ? "" : "s" })
                              : t("products.noPicturesAttached")}
                          </span>
                        </div>
                        <label className="document-upload-button">
                          {t("products.addPicturesButton")}
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={(event) => {
                              addDraftPictures(event.target.files);
                              event.target.value = "";
                            }}
                          />
                        </label>
                      </div>

                      {selectedDraftPicture?.url ? (
                        <img
                          src={selectedDraftPicture.url}
                          alt={t("products.pictureLabel")}
                          className="product-picture-preview"
                          onError={(event) => {
                            event.target.style.display = "none";
                          }}
                        />
                      ) : (
                        <p className="transaction-document-empty">{t("products.noPictureSelected")}</p>
                      )}

                      {draftProductPictures.length ? (
                        <div className="product-picture-list">
                          {draftProductPictures.map((picture) => (
                            <span className="product-picture-row" key={picture.id}>
                              <button
                                className={
                                  selectedDraftPicture?.id === picture.id
                                    ? "product-picture-link active"
                                    : "product-picture-link"
                                }
                                type="button"
                                onClick={() => selectDraftPicture(picture.id)}
                              >
                                {picture.name || getDocumentName(picture.url, t)}
                              </button>
                              <button
                                className="text-danger-button"
                                type="button"
                                onClick={() => removeDraftPicture(picture.id)}
                              >
                                {t("products.removeButton")}
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <label className="full-width">
                      {t("products.productDetailLabel")}
                      <textarea
                        rows="4"
                        value={draftProduct.detail}
                        onChange={(event) => updateDraftField("detail", event.target.value)}
                        placeholder={t("products.productDetailPlaceholder")}
                      />
                    </label>
                  </div>
                </section>
              </div>

              <div className="supplier-modal-actions">
                {draftExistingProduct ? (
                  <div className="product-delete-action">
                    {!isDraftProductActive ? (
                      <>
                        <button
                          className="primary-button"
                          type="button"
                          onClick={handleEnableProduct}
                          disabled={isProductEnableDisabled}
                          title={productEnableDisabledReason || undefined}
                        >
                          {t("products.enableProductButton")}
                        </button>
                        <span className="field-helper-text product-delete-helper">
                          {productEnableDisabledReason || t("products.enableProductHelper")}
                        </span>
                      </>
                    ) : draftProductHasHistory ? (
                      <>
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={handleDisableProduct}
                          disabled={isProductDisableDisabled}
                          title={productDisableDisabledReason || undefined}
                        >
                          {t("products.disableProductButton")}
                        </button>
                        <span className="field-helper-text product-delete-helper">
                          {productDisableDisabledReason || t("products.disableProductHelper")}
                        </span>
                      </>
                    ) : (
                      <>
                        <button
                          className="danger-button"
                          type="button"
                          onClick={handleDeleteProduct}
                          disabled={isProductDeleteDisabled}
                          title={productDeleteDisabledReason || undefined}
                        >
                          {t("products.deleteButton")}
                        </button>
                        {productDeleteDisabledReason ? (
                          <span className="field-helper-text product-delete-helper">
                            {productDeleteDisabledReason}
                          </span>
                        ) : null}
                      </>
                    )}
                  </div>
                ) : null}
                <button className="secondary-button" type="button" onClick={closeProductEditor}>
                  {t("products.cancelButton")}
                </button>
                <button className="primary-button" type="submit">
                  {t("products.saveButton")}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default ProductsPage;
