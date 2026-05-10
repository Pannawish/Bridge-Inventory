import { useEffect, useMemo, useState } from "react";
import PaginationControls from "./PaginationControls";
import {
  getCategoryLeafLabel,
  getCategoryOptions,
  getCategoryPathById,
  resolveLegacyCategoryId,
} from "./CategoryPage";
import {
  formatStatusLabel,
  getPurchaseItemDisplayStatus,
  getStoredPurchaseItemStatus,
} from "../purchaseStatus";
import { getStoredSaleItemStatus } from "../saleStatus";
import {
  getItemBaseQuantity,
  getProductBaseUnit,
  getProductDefaultPurchaseUnit,
  getProductDefaultSalesUnit,
  getItemQuantityDetails,
  getProductUnitConversions,
} from "../unitConversion";

const VAT_RATE = 0.07;
const SKU_PATTERN = /^\d+$/;
const CATEGORY_SKU_CODE_WIDTH = 2;
const PRODUCT_SKU_SERIAL_WIDTH = 4;

function createProduct(overrides = {}) {
  return {
    id: `product-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    productDisplayId: 1001,
    sku: "",
    previousSkus: [],
    productName: "",
    subNames: [],
    stockBaseUnit: "pcs",
    defaultPurchaseUnit: "pcs",
    defaultSalesUnit: "pcs",
    unitConversions: [
      { unit: "pcs", factorToBase: 1, allowPurchase: true, allowSale: true },
    ],
    categoryId: "",
    category: "",
    detail: "",
    pictureUrl: "",
    ...overrides,
  };
}

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
    pictureUrl: "",
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
    pictureUrl: "",
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
    pictureUrl: "",
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
    pictureUrl: "",
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
    pictureUrl: "",
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
    pictureUrl: "",
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
    pictureUrl: "",
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
    pictureUrl: "",
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
    pictureUrl: "",
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
    pictureUrl: "",
  }),
];

export function getDefaultProducts() {
  return defaultProducts.map((product) => normalizeProduct(product));
}

function normalizeUniqueNames(values) {
  const seen = new Set();

  return values.reduce((names, value) => {
    const nextName = `${value ?? ""}`.trim();
    const key = nextName.toLowerCase();

    if (!nextName || seen.has(key)) {
      return names;
    }

    seen.add(key);
    names.push(nextName);
    return names;
  }, []);
}

function getProductMainName(product) {
  return `${product?.productName ?? product?.name ?? product?.product_name ?? ""}`.trim();
}

function getProductSubNames(product) {
  return normalizeUniqueNames(
    Array.isArray(product?.subNames)
      ? product.subNames
      : Array.isArray(product?.aliases)
        ? product.aliases
        : []
  );
}

function getProductPreviousSkus(product) {
  return normalizeUniqueNames(
    Array.isArray(product?.previousSkus)
      ? product.previousSkus.map(normalizeSku)
      : Array.isArray(product?.previous_skus)
        ? product.previous_skus.map(normalizeSku)
        : []
  );
}

function getProductAllNames(product) {
  return normalizeUniqueNames([getProductMainName(product), ...getProductSubNames(product)]);
}

function getProductDisplayName(product) {
  return getProductAllNames(product)[0] || product?.sku || `Product ${product?.id || ""}`.trim();
}

function normalizeSku(value) {
  return `${value ?? ""}`.trim().toUpperCase().replace(/\s+/g, "-");
}

function isValidSku(value) {
  return SKU_PATTERN.test(value);
}

function getCategoryPathIds(categories = [], categoryId = "") {
  if (!categoryId) {
    return [];
  }

  const categoryLookup = new Map(categories.map((category) => [category.id, category]));
  const pathIds = [];
  let currentCategory = categoryLookup.get(categoryId);
  const visited = new Set();

  while (currentCategory && !visited.has(currentCategory.id)) {
    visited.add(currentCategory.id);
    pathIds.unshift(currentCategory.id);
    currentCategory = currentCategory.parentId
      ? categoryLookup.get(currentCategory.parentId)
      : null;
  }

  return pathIds;
}

function getCategoryPathSkuCode(categories = [], categoryId = "") {
  return getCategoryPathIds(categories, categoryId)
    .map((pathCategoryId) => {
      const category = categories.find((item) => item.id === pathCategoryId);
      const siblings = categories.filter(
        (item) => (item.parentId || null) === (category?.parentId || null)
      );
      const siblingIndex = Math.max(
        0,
        siblings.findIndex((item) => item.id === pathCategoryId)
      );

      return `${siblingIndex + 1}`.padStart(CATEGORY_SKU_CODE_WIDTH, "0");
    })
    .join("");
}

function getNextSkuSerial(baseSku, products, currentProductId = "") {
  const usedSerials = products.reduce((serials, product) => {
    if (`${product.id}` === `${currentProductId}`) {
      return serials;
    }

    const sku = normalizeSku(product.sku);
    const match = sku.match(new RegExp(`^${baseSku}(\\d{${PRODUCT_SKU_SERIAL_WIDTH}})$`));

    if (match) {
      serials.add(Number(match[1]));
    }

    return serials;
  }, new Set());
  let serial = 1;

  while (usedSerials.has(serial)) {
    serial += 1;
  }

  return `${serial}`.padStart(PRODUCT_SKU_SERIAL_WIDTH, "0");
}

function normalizeProduct(product) {
  const allNames = getProductAllNames(product);
  const [productName = "", ...subNames] = allNames;
  const stockBaseUnit = getProductBaseUnit(product);
  const unitConversions = getProductUnitConversions({
    ...product,
    stockBaseUnit,
  });

  return {
    id: product.id || `product-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    productDisplayId: Math.max(1, Math.round(Number(product.productDisplayId) || 1001)),
    sku: normalizeSku(product.sku),
    previousSkus: getProductPreviousSkus(product),
    productName,
    subNames,
    stockBaseUnit,
    defaultPurchaseUnit: getProductDefaultPurchaseUnit({ ...product, stockBaseUnit, unitConversions }),
    defaultSalesUnit: getProductDefaultSalesUnit({ ...product, stockBaseUnit, unitConversions }),
    unitConversions,
    categoryId: `${product.categoryId ?? ""}`,
    category: `${product.category ?? ""}`,
    detail: `${product.detail ?? ""}`,
    pictureUrl: `${product.pictureUrl ?? ""}`,
  };
}

function formatCurrency(value) {
  return `฿${Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatStockQuantity(value, product) {
  const unit = getProductBaseUnit(product);
  return `${Number(value || 0).toLocaleString()} ${unit}`;
}

function getDocumentName(documentUrl = "") {
  const [path = ""] = `${documentUrl}`.split("?");
  const name = path.split("/").filter(Boolean).pop();
  return name ? decodeURIComponent(name) : "Attached document";
}

function getTransactionDocuments(transaction = {}) {
  if (Array.isArray(transaction.documents) && transaction.documents.length) {
    return transaction.documents;
  }

  return transaction.document_url
    ? [
        {
          id: "__legacy_document__",
          name: getDocumentName(transaction.document_url),
          url: transaction.document_url,
        },
      ]
    : [];
}

function computeItemAmount(item) {
  const qty = Number(item.quantity) || 0;
  const price = Number(item.unit_price ?? item.unit_cost) || 0;

  if (item.amount !== undefined && item.amount !== null) {
    return Number(item.amount) || 0;
  }

  if (Array.isArray(item.discounts)) {
    const multiplier = item.discounts.reduce((acc, discount) => {
      const clamped = Math.min(100, Math.max(0, Number(discount) || 0));
      return acc * (1 - clamped / 100);
    }, 1);
    return qty * price * multiplier;
  }

  const discount = Math.min(100, Math.max(0, Number(item.discount) || 0));
  return qty * price * (1 - discount / 100);
}

function renderDiscounts(item) {
  if (Array.isArray(item.discounts)) {
    const activeDiscounts = item.discounts.filter((discount) => Number(discount) > 0);

    if (activeDiscounts.length) {
      return activeDiscounts.map((discount) => `${Number(discount)}%`).join(" → ");
    }
  }

  if (Number(item.discount) > 0) {
    return `${Number(item.discount)}%`;
  }

  return "—";
}

function computeVatSummary(items, vatMode) {
  const itemTotal = items.reduce((sum, item) => sum + computeItemAmount(item), 0);

  if (vatMode === "included") {
    const subtotal = itemTotal / (1 + VAT_RATE);
    const vat = itemTotal - subtotal;
    return { subtotal, vat, grandTotal: itemTotal };
  }

  if (vatMode === "none") {
    return { subtotal: itemTotal, vat: 0, grandTotal: itemTotal };
  }

  const vat = itemTotal * VAT_RATE;
  return { subtotal: itemTotal, vat, grandTotal: itemTotal + vat };
}

function matchesSku(item, sku) {
  const normalizedSku = normalizeSku(sku);

  if (!normalizedSku) {
    return false;
  }

  return normalizeSku(item.sku) === normalizedSku;
}

function itemMatchesProduct(item, product) {
  if (!item || !product) {
    return false;
  }

  const itemProductId = `${item.product_id ?? item.productId ?? ""}`;
  const productId = `${product.id ?? ""}`;

  if (itemProductId && productId && itemProductId === productId) {
    return true;
  }

  return matchesSku(item, product.sku) || getProductPreviousSkus(product).some((sku) => matchesSku(item, sku));
}

function getProductCurrentStock(product) {
  return Number(product?.current_stock ?? product?.currentStock ?? product?.available_stock ?? 0) || 0;
}

function resolveProductCategoryId(product, categories) {
  if (product.categoryId && categories.some((category) => category.id === product.categoryId)) {
    return product.categoryId;
  }

  return resolveLegacyCategoryId(categories, product.category);
}

function getProductCategoryLabel(product, categories) {
  const categoryId = resolveProductCategoryId(product, categories);

  if (categoryId) {
    return getCategoryPathById(categories, categoryId) || product.category || "";
  }

  return product.category || "";
}

function getProductMetrics(product, purchases, sales) {
  if (!purchases.length && !sales.length) {
    return {
      totalUnits: getProductCurrentStock(product),
      avgPrice: Number(product?.average_unit_cost ?? product?.avgPrice ?? 0) || 0,
      receivedPurchaseCount: Number(product?.received_purchase_count ?? 0) || 0,
      activeSalesCount: Number(product?.active_sales_count ?? 0) || 0,
      purchaseItems: [],
      salesItems: [],
    };
  }

  const purchaseItems = purchases.flatMap((purchase) =>
    (purchase.items || [])
      .filter((item) => itemMatchesProduct(item, product))
      .map((item) => ({ transaction: purchase, item }))
  );
  const salesItems = sales.flatMap((sale) =>
    (sale.items || [])
      .filter((item) => itemMatchesProduct(item, product))
      .map((item) => ({ transaction: sale, item }))
  );
  const receivedPurchaseItems = purchaseItems.filter(
    ({ transaction, item }) =>
      getStoredPurchaseItemStatus(item, transaction.status) === "received"
  );
  const activeSalesItems = salesItems.filter(({ transaction, item }) =>
    ["packed", "shipped", "delivered"].includes(
      getStoredSaleItemStatus(item, transaction.status)
    )
  );

  const purchasedUnits = receivedPurchaseItems.reduce(
    (sum, { item }) => sum + getItemBaseQuantity(item),
    0
  );
  const soldUnits = activeSalesItems.reduce(
    (sum, { item }) => sum + getItemBaseQuantity(item),
    0
  );
  const priceRows = [...receivedPurchaseItems, ...activeSalesItems];
  const totalPricedUnits = priceRows.reduce(
    (sum, { item }) => sum + getItemBaseQuantity(item),
    0
  );
  const totalPriceAmount = priceRows.reduce(
    (sum, { item }) => sum + computeItemAmount(item),
    0
  );
  const totalUnits = Math.max(0, purchasedUnits - soldUnits);

  return {
    totalUnits,
    avgPrice: totalPricedUnits > 0 ? totalPriceAmount / totalPricedUnits : 0,
    receivedPurchaseCount: receivedPurchaseItems.length,
    activeSalesCount: activeSalesItems.length,
    purchaseItems,
    salesItems,
  };
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
  const [categoryQuery, setCategoryQuery] = useState("");
  const [categoryComboboxOpen, setCategoryComboboxOpen] = useState(false);

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
    setViewingProduct(product);
    setViewingTransaction(null);
    setDraftProduct(null);
    loadProductHistory(product);
  }

  function closeAll() {
    setViewingProduct(null);
    setViewingTransaction(null);
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
      return cachedHistory.hasTransactionHistory ||
        cachedHistory.purchases.length > 0 ||
        cachedHistory.sales.length > 0;
    }

    return (
      purchases.some((purchase) =>
        (purchase.items || []).some((item) => itemMatchesProduct(item, product))
      ) ||
      sales.some((sale) =>
        (sale.items || []).some((item) => itemMatchesProduct(item, product))
      )
    );
  }

  async function productHasTransactionHistory(product) {
    if (!product) {
      return false;
    }

    const cachedHistory = productHistoryById[`${product.id}`];
    if (cachedHistory) {
      return cachedHistory.hasTransactionHistory ||
        cachedHistory.purchases.length > 0 ||
        cachedHistory.sales.length > 0;
    }

    const loadedHistory = await loadProductHistory(product);
    if (loadedHistory) {
      return loadedHistory.hasTransactionHistory ||
        loadedHistory.purchases.length > 0 ||
        loadedHistory.sales.length > 0;
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

    const confirmed = window.confirm(
      "This product already has purchase or sales history. Changing SKU will only affect the product master; old transaction rows keep their original SKU snapshot. Continue?"
    );

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
      setProductFormError("Select a category for this product.");
      return;
    }

    if (!productCategoryOptions.some((category) => category.id === normalizedDraft.categoryId)) {
      setProductFormError("Select an existing category for this product.");
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
      setProductFormError("SKU is required for every product.");
      return;
    }

    if (!isValidSku(normalizedDraft.sku) && !hasUnchangedExistingSku) {
      setProductFormError("SKU must be numeric. Use Generate to create one from the category path.");
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
        `SKU ${normalizedDraft.sku} is already used by ${getProductDisplayName(duplicateProduct)}.`
      );
      return;
    }

    if (existingProductHasHistory && skuChanged && !skuChangeUnlocked) {
      setProductFormError("SKU is locked because this product has purchase or sales history.");
      return;
    }

    if (!normalizedDraft.stockBaseUnit) {
      setProductFormError("Set a base stock unit for this product.");
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
      setProductFormError("Default purchase unit must be listed and allowed for purchases.");
      return;
    }

    if (!salesUnit?.allowSale) {
      setProductFormError("Default sales unit must be listed and allowed for sales.");
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

    const confirmed = window.confirm(
      `Delete product ${getProductDisplayName(draftProduct) || "this product"}?`
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

  function getPurchaseHistory(product) {
    return purchases.flatMap((purchase) =>
      (purchase.items || [])
        .filter((item) => itemMatchesProduct(item, product))
        .map((item) => ({ purchase, item }))
    );
  }

  function getSalesHistory(product) {
    return sales.flatMap((sale) =>
      (sale.items || [])
        .filter((item) => itemMatchesProduct(item, product))
        .map((item) => ({ sale, item }))
    );
  }

  const viewingHistory = viewingProduct ? productHistoryById[`${viewingProduct.id}`] : null;
  const viewPurchaseHistory = viewingProduct
    ? viewingHistory
      ? viewingHistory.purchases.flatMap((purchase) =>
          (purchase.items || [])
            .filter((item) => itemMatchesProduct(item, viewingProduct))
            .map((item) => ({ purchase, item }))
        )
      : getPurchaseHistory(viewingProduct)
    : [];
  const viewSalesHistory = viewingProduct
    ? viewingHistory
      ? viewingHistory.sales.flatMap((sale) =>
          (sale.items || [])
            .filter((item) => itemMatchesProduct(item, viewingProduct))
            .map((item) => ({ sale, item }))
        )
      : getSalesHistory(viewingProduct)
    : [];
  const viewingProductMetrics = viewingProduct
    ? getProductMetrics(
        viewingProduct,
        viewingHistory?.purchases || purchases,
        viewingHistory?.sales || sales
      )
    : null;
  const draftExistingProduct = draftProduct ? getExistingProduct(draftProduct) : null;
  const draftProductHasHistory = getCachedProductHasTransactionHistory(draftExistingProduct);
  const isSkuLocked = Boolean(draftExistingProduct && draftProductHasHistory && !skuChangeUnlocked);

  return (
    <div className="stack-layout">
      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Products</p>
            <h3>Find Products</h3>
          </div>
        </div>

        <div className="supplier-directory-toolbar">
          <label className="stock-search supplier-search">
            <span className="stock-search-icon">S</span>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by main name, subname, category, SKU, or ID"
            />
          </label>
          <div className="stock-report-summary supplier-search-meta">
            <span>
              {isServerPaginated
                ? `${filteredProductsWithMetrics.length} on this page of ${totalProductCount} products`
                : `${filteredProductsWithMetrics.length} of ${productsWithMetrics.length} products shown`}
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
            Filter
            {activeFilterCount ? <span>{activeFilterCount}</span> : null}
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={resetProductFilters}
          >
            Reset Filter
          </button>
        </div>

        {showProductFilters ? (
          <div className="history-filter-panel">
            <div className="history-filter-grid">
              <label className="history-filter-field">
                <span className="history-filter-title">Category</span>
                <select
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                >
                  <option value="all">All categories</option>
                  {categoryOptions.map((categoryLabel) => (
                    <option key={categoryLabel} value={categoryLabel}>
                      {categoryLabel}
                    </option>
                  ))}
                </select>
              </label>

              <label className="history-filter-field">
                <span className="history-filter-title">Inventory</span>
                <select
                  value={stockFilter}
                  onChange={(event) => setStockFilter(event.target.value)}
                >
                  <option value="all">All products</option>
                  <option value="in-stock">In stock</option>
                  <option value="out-of-stock">Out of stock</option>
                  <option value="selling">Has sales</option>
                  <option value="no-sales">No sales yet</option>
                  <option value="no-purchases">No received purchases</option>
                </select>
              </label>
            </div>
          </div>
        ) : null}
      </section>

      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">History</p>
            <h3>Products</h3>
          </div>
          <div className="transaction-table-actions">
            <button className="primary-button" type="button" onClick={handleCreateProduct}>
              New Product
            </button>
            {shouldShowViewAll ? (
              <button
                className="secondary-button"
                type="button"
                onClick={() => setShowAllRows((currentValue) => !currentValue)}
              >
                {showAllRows ? "Show Recent" : "View More"}
              </button>
            ) : null}
          </div>
        </div>

        {filteredProductsWithMetrics.length === 0 ? (
          <p className="empty-copy">No products match the current search or filters.</p>
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
                    <th className="product-col-index">#</th>
                    <th className="product-col-name">Product</th>
                    <th className="product-col-category">Category</th>
                    <th className="product-col-stock">Stock</th>
                    <th className="product-col-cost">Avg Cost</th>
                    <th className="product-col-action">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProductsWithMetrics.map(({ product, metrics, categoryLabel }, index) => (
                    <tr key={product.id}>
                      <td>{index + 1}</td>
                      <td>
                        <div className="transaction-reference-cell">
                          <strong>{getProductDisplayName(product)}</strong>
                          <span>{product.sku ? `SKU ${product.sku}` : "SKU not set"}</span>
                        </div>
                      </td>
                      <td>
                        <div className="cell-stack">
                          <strong>{getCategoryLeafLabel(categoryLabel) || "Unassigned"}</strong>
                          <span>{product.detail || "No product detail"}</span>
                        </div>
                      </td>
                      <td>
                        <div className="cell-stack">
                          <strong>{formatStockQuantity(metrics.totalUnits, product)}</strong>
                          <span>
                            Buy {getProductDefaultPurchaseUnit(product)} · Sell{" "}
                            {getProductDefaultSalesUnit(product)}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="cell-stack">
                          <strong>{formatCurrency(metrics.avgPrice)}</strong>
                          <span>ID {product.productDisplayId}</span>
                        </div>
                      </td>
                      <td>
                        <button
                          className="table-action-button"
                          type="button"
                          onClick={() => openProductDetail(product)}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mobile-record-list">
              {filteredProductsWithMetrics.map(({ product, metrics, categoryLabel }, index) => (
                <article className="mobile-record-card" key={`mobile-product-${product.id}`}>
                  <div className="mobile-record-header">
                    <div className="mobile-record-title">
                      <span className="mobile-record-index">{index + 1}</span>
                      <div className="cell-stack">
                        <strong>{getProductDisplayName(product)}</strong>
                        <span>{product.sku ? `SKU ${product.sku}` : "SKU not set"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mobile-record-grid">
                    <div>
                      <span>Category</span>
                      <strong>{getCategoryLeafLabel(categoryLabel) || "Unassigned"}</strong>
                    </div>
                    <div>
                      <span>Stock</span>
                      <strong>{formatStockQuantity(metrics.totalUnits, product)}</strong>
                    </div>
                    <div>
                      <span>Avg Cost</span>
                      <strong>{formatCurrency(metrics.avgPrice)}</strong>
                    </div>
                    <div>
                      <span>ID</span>
                      <strong>{product.productDisplayId}</strong>
                    </div>
                  </div>

                  <button
                    className="secondary-button table-action-button mobile-record-button"
                    type="button"
                    onClick={() => openProductDetail(product)}
                  >
                    View
                  </button>
                </article>
              ))}
            </div>
          </div>
        )}
        <PaginationControls
          pagination={pagination}
          itemLabel="products"
          onPageChange={(page) => onPageRequest?.(getPageRequestParams(page))}
        />
      </section>

      {(viewingProduct || viewingTransaction) ? (
        <div className="modal-backdrop">
          {viewingTransaction ? (
            <div
              className="detail-modal product-detail-modal section-card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="transaction-detail-title"
            >
              <div className="section-heading supplier-modal-header">
                <div>
                  <p className="eyebrow">
                    {viewingTransaction.type === "purchase" ? "Purchase Transaction" : "Sales Transaction"}
                  </p>
                  <h3 id="transaction-detail-title">
                    {viewingTransaction.type === "purchase"
                      ? viewingTransaction.data.reference_no
                      : viewingTransaction.data.reference_no}
                  </h3>
                </div>
                <div className="product-detail-header-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={backToProduct}
                  >
                    ← Back
                  </button>
                  <button
                    className="icon-button subtle"
                    type="button"
                    aria-label="Close"
                    onClick={closeAll}
                  >
                    X
                  </button>
                </div>
              </div>

              <div className="product-detail-body">
                {(() => {
                  const isPurchase = viewingTransaction.type === "purchase";
                  const transaction = viewingTransaction.data;
                  const summary = computeVatSummary(transaction.items || [], transaction.vat_mode);
                  const showVat = transaction.vat_mode !== "none";

                  return (
                    <>
                      <div className="detail-grid">
                        <div>
                          <p className="detail-label">{isPurchase ? "Supplier" : "Customer"}</p>
                          <strong>
                            {isPurchase
                              ? transaction.supplier_name || "—"
                              : transaction.customer_name || "—"}
                          </strong>
                        </div>
                        <div>
                          <p className="detail-label">Status</p>
                          <strong>
                            <span className={`status-badge status-${transaction.status}`}>
                              {formatStatusLabel(transaction.status)}
                            </span>
                          </strong>
                        </div>
                        <div>
                          <p className="detail-label">Transaction Date</p>
                          <strong>{transaction.transaction_date || "—"}</strong>
                        </div>
                        <div>
                          <p className="detail-label">Payment Term</p>
                          <strong>
                            {transaction.payment_term_type === "credit"
                              ? `Credit (${transaction.payment_term_days || "—"})`
                              : transaction.payment_term_type === "debit"
                                ? "Debit"
                                : "—"}
                          </strong>
                        </div>
                        <div>
                          <p className="detail-label">Payment Date</p>
                          <strong>{transaction.payment_date || "—"}</strong>
                        </div>
                        <div>
                          <p className="detail-label">Documents</p>
                          {getTransactionDocuments(transaction).length ? (
                            <div className="transaction-document-list">
                              {getTransactionDocuments(transaction).map((document) => (
                                <a key={document.id} href={document.url} target="_blank" rel="noreferrer">
                                  {document.name || getDocumentName(document.url)}
                                </a>
                              ))}
                            </div>
                          ) : (
                            <strong>—</strong>
                          )}
                        </div>
                        <div className="full-width">
                          <p className="detail-label">Notes</p>
                          <strong>{transaction.note || "—"}</strong>
                        </div>
                      </div>

                      <div className="product-detail-section detail-items">
                        <p className="detail-label">Items</p>
                        <div className="table-scroll">
                          {isPurchase ? (
                            <table>
                              <thead>
                                <tr>
                                  <th className="table-index-cell">#</th>
                                  <th>Product</th>
                                  <th>SKU</th>
                                  <th>Expected Delivery</th>
                                  <th>Lead Time</th>
                                  <th>Item Status</th>
                                  <th>Received Date</th>
                                  <th>Qty</th>
                                  <th>Base Qty</th>
                                  <th>Unit Cost</th>
                                  <th>Discounts</th>
                                  <th>Amount</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(transaction.items || []).map((item, itemIndex) => {
                                  const isHighlighted =
                                    viewingProduct &&
                                    itemMatchesProduct(item, viewingProduct);
                                  const amount = computeItemAmount(item);
                                  const quantityDetails = getItemQuantityDetails(
                                    item,
                                    viewingProduct,
                                    "purchase"
                                  );

                                  return (
                                    <tr
                                      key={item.id}
                                      className={isHighlighted ? "transaction-row-highlight" : ""}
                                    >
                                      <td className="table-index-cell">{itemIndex + 1}</td>
                                      <td>{item.product_name}</td>
                                      <td>{item.sku || "—"}</td>
                                      <td>{item.expected_delivery_date || "—"}</td>
                                      <td>
                                        {item.lead_time_days !== undefined && item.lead_time_days !== ""
                                          ? `${item.lead_time_days} days`
                                          : "—"}
                                      </td>
                                      <td>
                                        <span
                                          className={`status-badge item-status-badge status-${getPurchaseItemDisplayStatus(
                                            item,
                                            transaction.status
                                          )}`}
                                        >
                                          {formatStatusLabel(
                                            getPurchaseItemDisplayStatus(item, transaction.status)
                                          )}
                                        </span>
                                      </td>
                                      <td>{item.received_date || "—"}</td>
                                      <td>{quantityDetails.enteredLabel}</td>
                                      <td>{quantityDetails.baseLabel}</td>
                                      <td>
                                        {item.unit_cost !== undefined && item.unit_cost !== null
                                          ? formatCurrency(item.unit_cost)
                                          : "—"}
                                      </td>
                                      <td>
                                        <span className="tx-discount-label">
                                          {renderDiscounts(item)}
                                        </span>
                                      </td>
                                      <td>{formatCurrency(amount)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          ) : (
                            <table>
                              <thead>
                                <tr>
                                  <th className="table-index-cell">#</th>
                                  <th>Product</th>
                                  <th>Qty</th>
                                  <th>Base Qty</th>
                                  <th>Unit Price</th>
                                  <th>Discounts</th>
                                  <th>Amount</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(transaction.items || []).map((item, itemIndex) => {
                                  const isHighlighted =
                                    viewingProduct &&
                                    itemMatchesProduct(item, viewingProduct);
                                  const amount = computeItemAmount(item);
                                  const quantityDetails = getItemQuantityDetails(
                                    item,
                                    viewingProduct,
                                    "sale"
                                  );

                                  return (
                                    <tr
                                      key={item.id}
                                      className={isHighlighted ? "transaction-row-highlight" : ""}
                                    >
                                      <td className="table-index-cell">{itemIndex + 1}</td>
                                      <td>{item.product_name}</td>
                                      <td>{quantityDetails.enteredLabel}</td>
                                      <td>{quantityDetails.baseLabel}</td>
                                      <td>
                                        {item.unit_price !== undefined && item.unit_price !== null
                                          ? formatCurrency(item.unit_price)
                                          : "—"}
                                      </td>
                                      <td>
                                        <span className="tx-discount-label">
                                          {renderDiscounts(item)}
                                        </span>
                                      </td>
                                      <td>{formatCurrency(amount)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </div>

                      <div className="tx-sales-summary">
                        {showVat ? (
                          <>
                            <div className="tx-summary-row">
                              <span>{isPurchase ? "Total" : "Subtotal"}</span>
                              <span>{formatCurrency(summary.subtotal)}</span>
                            </div>
                            <div className="tx-summary-row">
                              <span>VAT (7%)</span>
                              <span>{formatCurrency(summary.vat)}</span>
                            </div>
                          </>
                        ) : null}
                        <div className="tx-summary-row tx-summary-grand">
                          <strong>Grand Total</strong>
                          <strong>{formatCurrency(summary.grandTotal)}</strong>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          ) : (
            <div
              className="detail-modal product-detail-modal section-card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="product-history-title"
            >
              <div className="section-heading supplier-modal-header">
                <div>
                  <p className="eyebrow">Product History</p>
                  <h3 id="product-history-title">
                    {getProductDisplayName(viewingProduct)}
                  </h3>
                </div>
                <div className="product-detail-header-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => openProductEditor(viewingProduct)}
                  >
                    Edit
                  </button>
                  <button
                    className="icon-button subtle"
                    type="button"
                    aria-label="Close"
                    onClick={closeAll}
                  >
                    X
                  </button>
                </div>
              </div>

              <div className="product-history-info-strip">
                <div className="product-history-stat">
                  <span>SKU</span>
                  <strong>{viewingProduct.sku || "—"}</strong>
                </div>
                <div className="product-history-stat">
                  <span>Category</span>
                  <strong>{getProductCategoryLabel(viewingProduct, categories) || "—"}</strong>
                </div>
                <div className="product-history-stat">
                  <span>Total Units</span>
                  <strong>
                    {formatStockQuantity(viewingProductMetrics?.totalUnits ?? 0, viewingProduct)}
                  </strong>
                </div>
                <div className="product-history-stat">
                  <span>Avg Price</span>
                  <strong>
                    {formatCurrency(viewingProductMetrics?.avgPrice ?? 0)}
                  </strong>
                </div>
              </div>

              <div className="product-detail-body">
                <div className="product-profile-panel">
                  {viewingProduct.pictureUrl ? (
                    <img
                      src={viewingProduct.pictureUrl}
                      alt={getProductDisplayName(viewingProduct)}
                      className="product-profile-image"
                      onError={(event) => {
                        event.target.style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="product-profile-placeholder">No Image</div>
                  )}
                  <div className="product-profile-copy">
                    <div>
                      <p className="detail-label">Main Product Name</p>
                      <strong>{getProductDisplayName(viewingProduct)}</strong>
                    </div>
                    <div>
                      <p className="detail-label">Sub Names</p>
                      {getProductSubNames(viewingProduct).length ? (
                        <div className="item-pill-list">
                          {getProductSubNames(viewingProduct).map((subName) => (
                            <span key={subName} className="item-pill">
                              {subName}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <strong>—</strong>
                      )}
                    </div>
                    <div>
                      <p className="detail-label">Product ID</p>
                      <strong>{viewingProduct.productDisplayId}</strong>
                    </div>
                    <div>
                      <p className="detail-label">Category</p>
                      <strong>{getProductCategoryLabel(viewingProduct, categories) || "—"}</strong>
                    </div>
                    <div>
                      <p className="detail-label">Base Stock Unit</p>
                      <strong>{getProductBaseUnit(viewingProduct)}</strong>
                    </div>
                    <div>
                      <p className="detail-label">Product Detail</p>
                      <p className="product-detail-text">
                        {viewingProduct.detail || "—"}
                      </p>
                    </div>
                  </div>
                </div>

                {productHistoryLoadingId === `${viewingProduct.id}` ? (
                  <div className="notice-banner">Loading product transaction history...</div>
                ) : null}
                {productHistoryError ? (
                  <div className="error-banner">{productHistoryError}</div>
                ) : null}

                <div className="product-detail-section">
                  <p className="detail-label">Purchase History</p>
                  {viewPurchaseHistory.length === 0 ? (
                    <p className="empty-copy">No purchase history found for this product.</p>
                  ) : (
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th className="table-index-cell">#</th>
                            <th>Reference</th>
                            <th>Supplier</th>
                            <th>Date</th>
                            <th>Qty</th>
                            <th>Base Qty</th>
                            <th>Unit Cost</th>
                            <th>Discounts</th>
                            <th>Amount</th>
                            <th>Status</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {viewPurchaseHistory.map(({ purchase, item }, itemIndex) => {
                            const quantityDetails = getItemQuantityDetails(
                              item,
                              viewingProduct,
                              "purchase"
                            );

                            return (
                            <tr key={`${purchase.id}-${item.id}`}>
                              <td className="table-index-cell">{itemIndex + 1}</td>
                              <td>{purchase.reference_no}</td>
                              <td>{purchase.supplier_name}</td>
                              <td>{purchase.transaction_date}</td>
                              <td>{quantityDetails.enteredLabel}</td>
                              <td>{quantityDetails.baseLabel}</td>
                              <td>
                                {item.unit_cost !== undefined && item.unit_cost !== null
                                  ? formatCurrency(item.unit_cost)
                                  : "—"}
                              </td>
                              <td>
                                <span className="tx-discount-label">
                                  {renderDiscounts(item)}
                                </span>
                              </td>
                              <td>{formatCurrency(computeItemAmount(item))}</td>
                              <td>
                                <span
                                  className={`status-badge status-${getPurchaseItemDisplayStatus(
                                    item,
                                    purchase.status
                                  )}`}
                                >
                                  {formatStatusLabel(
                                    getPurchaseItemDisplayStatus(item, purchase.status)
                                  )}
                                </span>
                              </td>
                              <td>
                                <button
                                  className="table-action-button"
                                  type="button"
                                  onClick={() => openTransactionDetail("purchase", purchase)}
                                >
                                  Details
                                </button>
                              </td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="product-detail-section">
                  <p className="detail-label">Sales History</p>
                  {viewSalesHistory.length === 0 ? (
                    <p className="empty-copy">No sales history found for this product.</p>
                  ) : (
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th className="table-index-cell">#</th>
                            <th>Reference</th>
                            <th>Customer</th>
                            <th>Date</th>
                            <th>Qty</th>
                            <th>Base Qty</th>
                            <th>Unit Price</th>
                            <th>Discounts</th>
                            <th>Amount</th>
                            <th>Status</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {viewSalesHistory.map(({ sale, item }, itemIndex) => {
                            const quantityDetails = getItemQuantityDetails(
                              item,
                              viewingProduct,
                              "sale"
                            );

                            return (
                            <tr key={`${sale.id}-${item.id}`}>
                              <td className="table-index-cell">{itemIndex + 1}</td>
                              <td>{sale.reference_no}</td>
                              <td>{sale.customer_name}</td>
                              <td>{sale.transaction_date}</td>
                              <td>{quantityDetails.enteredLabel}</td>
                              <td>{quantityDetails.baseLabel}</td>
                              <td>
                                {item.unit_price !== undefined && item.unit_price !== null
                                  ? formatCurrency(item.unit_price)
                                  : "—"}
                              </td>
                              <td>
                                <span className="tx-discount-label">
                                  {renderDiscounts(item)}
                                </span>
                              </td>
                              <td>{formatCurrency(computeItemAmount(item))}</td>
                              <td>
                                <span className={`status-badge status-${sale.status}`}>
                                  {formatStatusLabel(sale.status)}
                                </span>
                              </td>
                              <td>
                                <button
                                  className="table-action-button"
                                  type="button"
                                  onClick={() => openTransactionDetail("sale", sale)}
                                >
                                  Details
                                </button>
                              </td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}

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
                  {allProducts.some((p) => p.id === draftProduct.id) ? "Edit Product" : "New Product"}
                </p>
                <h3 id="product-modal-title">
                  {getProductDisplayName(draftProduct) || "New Product"}
                </h3>
              </div>
              <button
                className="icon-button subtle"
                type="button"
                aria-label="Close"
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
                      <p className="eyebrow">Identity</p>
                      <h4>Name, SKU, and Product ID</h4>
                    </div>
                    <span>Start here</span>
                  </div>

                  <div className="product-editor-grid">
                    <label className="full-width">
                      <span className="required-label">Main Product Name</span>
                      <input
                        autoFocus
                        value={draftProduct.productName}
                        onChange={(event) => updateDraftField("productName", event.target.value)}
                        placeholder="Name used across the system"
                      />
                    </label>

                    <label className="supplier-option-field product-editor-wide-field">
                      <span className="required-label">SKU</span>
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
                          placeholder="e.g. 0102030001"
                          disabled={isSkuLocked}
                        />
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={handleGenerateSku}
                          disabled={isSkuLocked}
                        >
                          Generate
                        </button>
                        {isSkuLocked ? (
                          <button
                            className="table-action-button"
                            type="button"
                            onClick={handleUnlockSkuChange}
                          >
                            Change SKU
                          </button>
                        ) : null}
                      </div>
                      <span className="field-helper-text">
                        {isSkuLocked
                          ? "Locked because this product has purchase or sales history."
                          : "Required and unique. Generate uses category path codes plus a 4-digit serial."}
                      </span>
                    </label>

                    <label>
                      <span className="required-label">Product ID</span>
                      <input
                        type="number"
                        value={draftProduct.productDisplayId}
                        onChange={(event) =>
                          updateDraftField("productDisplayId", event.target.value)
                        }
                        placeholder="e.g. 1232"
                        min="1"
                      />
                    </label>
                  </div>

                  <div className="supplier-option-field product-editor-subsection">
                    <div className="product-name-editor-header">
                      <div>
                        <p className="detail-label">Sub Names</p>
                        <p className="inventory-note product-name-editor-note">
                          Add alternate names and promote any one of them to the main name.
                        </p>
                      </div>
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={addDraftSubName}
                      >
                        Add Sub Name
                      </button>
                    </div>

                    {(draftProduct.subNames || []).length === 0 ? (
                      <p className="empty-copy">No sub names added yet.</p>
                    ) : (
                      (draftProduct.subNames || []).map((subName, index) => (
                        <div className="supplier-option-edit-row" key={`product-sub-name-${index}`}>
                          <input
                            value={subName}
                            onChange={(event) => updateDraftSubName(index, event.target.value)}
                            placeholder={`Sub name ${index + 1}`}
                          />
                          <div className="supplier-option-edit-actions">
                            <button
                              className="table-action-button"
                              type="button"
                              onClick={() => setDraftSubNameAsMain(index)}
                            >
                              Use as Main
                            </button>
                            <button
                              className="icon-button subtle"
                              type="button"
                              aria-label={`Remove sub name ${index + 1}`}
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
                      <p className="eyebrow">Stock Units</p>
                      <h4>Base Unit and Conversions</h4>
                    </div>
                    <span>Inventory logic</span>
                  </div>

                  <div className="product-editor-grid product-editor-unit-grid">
                    <label>
                      <span className="required-label">Base Stock Unit</span>
                      <input
                        value={draftProduct.stockBaseUnit}
                        onChange={(event) => updateDraftField("stockBaseUnit", event.target.value)}
                        placeholder="pcs, m, kg, L, set"
                      />
                    </label>

                    <label>
                      <span className="required-label">Default Purchase Unit</span>
                      <input
                        value={draftProduct.defaultPurchaseUnit}
                        onChange={(event) =>
                          updateDraftField("defaultPurchaseUnit", event.target.value)
                        }
                        placeholder="e.g. box"
                      />
                    </label>

                    <label>
                      <span className="required-label">Default Sales Unit</span>
                      <input
                        value={draftProduct.defaultSalesUnit}
                        onChange={(event) => updateDraftField("defaultSalesUnit", event.target.value)}
                        placeholder="e.g. pcs"
                      />
                    </label>
                  </div>

                  <div className="supplier-option-field product-editor-subsection">
                    <div className="product-name-editor-header">
                      <div>
                        <p className="detail-label">Unit Conversions</p>
                        <p className="inventory-note product-name-editor-note">
                          Factor means how many base units are inside one selected unit.
                        </p>
                      </div>
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={addDraftUnitConversion}
                      >
                        Add Unit
                      </button>
                    </div>

                    {(draftProduct.unitConversions || []).map((conversion, index) => (
                      <div className="unit-conversion-row" key={`unit-conversion-${index}`}>
                        <label>
                          <span className="required-label">Unit</span>
                          <input
                            value={conversion.unit}
                            onChange={(event) =>
                              updateDraftUnitConversion(index, "unit", event.target.value)
                            }
                            placeholder="box"
                          />
                        </label>
                        <label>
                          <span className="required-label">Factor to Base</span>
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
                          Purchase
                        </label>
                        <label className="unit-conversion-check">
                          <input
                            type="checkbox"
                            checked={!!conversion.allowSale}
                            onChange={() => toggleDraftUnitConversion(index, "allowSale")}
                          />
                          Sale
                        </label>
                        <button
                          className="icon-button subtle"
                          type="button"
                          aria-label={`Remove unit conversion ${index + 1}`}
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
                      <p className="eyebrow">Classification</p>
                      <h4>Category, Image, and Notes</h4>
                    </div>
                    <span>Optional detail</span>
                  </div>

                  <div className="product-editor-grid">
                    <label className="supplier-combobox-field">
                      <span className="required-label">Category</span>
                      <div className="supplier-combobox">
                        <input
                          type="search"
                          value={categoryQuery}
                          onChange={(event) => handleCategoryQueryChange(event.target.value)}
                          onFocus={() => setCategoryComboboxOpen(true)}
                          onBlur={handleCategoryBlur}
                          placeholder={
                            productCategoryOptions.length
                              ? "Search category"
                              : "Create a category first"
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
                                No category found.
                              </div>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </label>

                    <label>
                      Picture URL
                      <input
                        value={draftProduct.pictureUrl}
                        onChange={(event) => updateDraftField("pictureUrl", event.target.value)}
                        placeholder="https://example.com/image.jpg"
                      />
                    </label>

                    {draftProduct.pictureUrl ? (
                      <div className="full-width">
                        <img
                          src={draftProduct.pictureUrl}
                          alt="Product preview"
                          className="product-picture-preview"
                          onError={(event) => {
                            event.target.style.display = "none";
                          }}
                        />
                      </div>
                    ) : null}

                    <label className="full-width">
                      Product Detail
                      <textarea
                        rows="4"
                        value={draftProduct.detail}
                        onChange={(event) => updateDraftField("detail", event.target.value)}
                        placeholder="Product description, specifications, or notes"
                      />
                    </label>
                  </div>
                </section>
              </div>

              <div className="supplier-modal-actions">
                <button className="danger-button" type="button" onClick={handleDeleteProduct}>
                  Delete Product
                </button>
                <button className="secondary-button" type="button" onClick={closeProductEditor}>
                  Cancel
                </button>
                <button className="primary-button" type="submit">
                  Save Product
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
