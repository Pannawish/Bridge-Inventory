import { useEffect, useMemo, useState } from "react";
import {
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
const SKU_PATTERN = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;
const SKU_PREFIX_BY_KEYWORD = [
  ["bolt", "BLT"],
  ["nut", "NUT"],
  ["screw", "SCR"],
  ["pipe", "PIP"],
  ["pvc", "PVC"],
  ["cable", "CBL"],
  ["wire", "WIR"],
  ["drill", "DRL"],
  ["bit", "BIT"],
  ["glove", "GLV"],
  ["paint", "PNT"],
  ["chemical", "CHM"],
  ["electrical", "ELC"],
  ["marker", "MRK"],
  ["pen", "PEN"],
  ["notebook", "NB"],
  ["stapler", "STP"],
  ["sticky", "STK"],
  ["folder", "FLD"],
];
const SKU_STOP_WORDS = new Set([
  "THE",
  "AND",
  "FOR",
  "WITH",
  "SET",
  "PCS",
  "PC",
  "PACK",
  "BOX",
  "CARTON",
]);

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

function normalizeSkuToken(value) {
  return `${value ?? ""}`.toUpperCase().replace(/[^A-Z0-9]+/g, "");
}

function getCategoryLeafName(categoryLabel = "") {
  const parts = `${categoryLabel}`.split("/").map((part) => part.trim()).filter(Boolean);
  return parts[parts.length - 1] || "";
}

function getSkuPrefix(categoryLabel = "", productName = "") {
  const source = `${categoryLabel} ${productName}`.toLowerCase();
  const matchedPrefix = SKU_PREFIX_BY_KEYWORD.find(([keyword]) => source.includes(keyword));

  if (matchedPrefix) {
    return matchedPrefix[1];
  }

  const leafName = getCategoryLeafName(categoryLabel) || productName || "PRODUCT";
  const words = leafName.match(/[a-z0-9]+/gi) || [];
  const acronym = words.map((word) => word[0]).join("").toUpperCase().slice(0, 3);

  return acronym || "PRD";
}

function getSkuDescriptor(product) {
  const rawText = [
    product?.productName,
    ...(Array.isArray(product?.subNames) ? product.subNames : []),
    product?.detail,
  ].join(" ");
  const rawTokens = rawText.match(/[A-Za-z]*\d+(?:\.\d+)?(?:X\d+(?:\.\d+)?)?[A-Za-z]*|[A-Za-z]+/g) || [];
  const tokens = rawTokens
    .map(normalizeSkuToken)
    .filter((token) => token && !SKU_STOP_WORDS.has(token));
  const specTokens = tokens.filter((token) => /\d/.test(token)).slice(0, 2);
  const wordTokens = tokens.filter((token) => !/\d/.test(token)).slice(0, 2);
  const descriptor = [...specTokens, ...wordTokens].slice(0, 3).join("-");

  return descriptor || "ITEM";
}

function getNextSkuSerial(baseSku, products, currentProductId = "") {
  const usedSerials = products.reduce((serials, product) => {
    if (`${product.id}` === `${currentProductId}`) {
      return serials;
    }

    const sku = normalizeSku(product.sku);
    const match = sku.match(new RegExp(`^${baseSku}-(\\d{3})$`));

    if (match) {
      serials.add(Number(match[1]));
    }

    return serials;
  }, new Set());
  let serial = 1;

  while (usedSerials.has(serial)) {
    serial += 1;
  }

  return `${serial}`.padStart(3, "0");
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
  categories = [],
  purchases = [],
  sales = [],
  onSaveProduct,
  onDeleteProduct,
}) {
  const [viewingProduct, setViewingProduct] = useState(null);
  const [viewingTransaction, setViewingTransaction] = useState(null);
  const [draftProduct, setDraftProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [productFormError, setProductFormError] = useState("");
  const [skuChangeUnlocked, setSkuChangeUnlocked] = useState(false);

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
      [...new Set(productsWithMetrics.map(({ categoryLabel }) => categoryLabel).filter(Boolean))]
        .sort((left, right) => left.localeCompare(right)),
    [productsWithMetrics]
  );

  const filteredProductsWithMetrics = useMemo(
    () =>
      productsWithMetrics.filter(({ product, metrics, categoryLabel }) => {
        const searchableNames = getProductAllNames(product);
        const matchesSearch =
          !normalizedSearch ||
          searchableNames.some((name) => name.toLowerCase().includes(normalizedSearch)) ||
          categoryLabel.toLowerCase().includes(normalizedSearch) ||
          `${product.sku ?? ""}`.toLowerCase().includes(normalizedSearch) ||
          getProductPreviousSkus(product).some((sku) => sku.toLowerCase().includes(normalizedSearch)) ||
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
      }),
    [categoryFilter, normalizedSearch, productsWithMetrics, stockFilter]
  );
  const stockFilterLabel =
    stockFilter === "all"
      ? "All inventory states"
      : stockFilter === "in-stock"
        ? "In stock"
        : stockFilter === "out-of-stock"
          ? "Out of stock"
          : stockFilter === "selling"
            ? "Has sales"
            : stockFilter === "no-sales"
              ? "No sales yet"
              : "No received purchases";

  function openProductDetail(product) {
    setViewingProduct(product);
    setViewingTransaction(null);
    setDraftProduct(null);
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

    setViewingProduct(null);
    setViewingTransaction(null);
    setProductFormError("");
    setSkuChangeUnlocked(false);
    setDraftProduct({
      ...normalizedProduct,
      categoryId: resolveProductCategoryId(product, categories),
    });
  }

  function closeProductEditor() {
    setDraftProduct(null);
    setProductFormError("");
    setSkuChangeUnlocked(false);
  }

  function updateDraftField(key, value) {
    setDraftProduct((prev) => (prev ? { ...prev, [key]: value } : prev));
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
    return products.find((item) => `${item.id}` === `${product?.id}`);
  }

  function productHasTransactionHistory(product) {
    if (!product) {
      return false;
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

  function generateStructuredSku(product) {
    const categoryLabel = getCategoryPathById(categories, product.categoryId) || product.category;
    const prefix = getSkuPrefix(categoryLabel, product.productName);
    const descriptor = getSkuDescriptor(product);
    const baseSku = normalizeSku(`${prefix}-${descriptor}`);
    const serial = getNextSkuSerial(baseSku, products, product.id);

    return `${baseSku}-${serial}`;
  }

  function handleGenerateSku() {
    if (!draftProduct) {
      return;
    }

    setDraftProduct((prev) => (prev ? { ...prev, sku: generateStructuredSku(prev) } : prev));
    setProductFormError("");
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
      products.length === 0
        ? 1001
        : Math.max(...products.map((p) => p.productDisplayId)) + 1;

    setViewingProduct(null);
    setViewingTransaction(null);
    setProductFormError("");
    setSkuChangeUnlocked(false);
    setDraftProduct(createProduct({ productDisplayId: nextDisplayId }));
  }

  async function handleSaveProduct() {
    if (!draftProduct) {
      return;
    }

    const normalizedDraft = normalizeProduct(draftProduct);
    const categoryLabel = getCategoryPathById(categories, normalizedDraft.categoryId);
    const existingProduct = getExistingProduct(normalizedDraft);
    const existingProductHasHistory = productHasTransactionHistory(existingProduct);
    const skuChanged =
      existingProduct && normalizeSku(existingProduct.sku) !== normalizedDraft.sku;

    if (!normalizedDraft.sku) {
      setProductFormError("SKU is required for every product.");
      return;
    }

    if (!isValidSku(normalizedDraft.sku)) {
      setProductFormError("SKU can only use A-Z, 0-9, and single hyphens between parts.");
      return;
    }

    const duplicateProduct = products.find(
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

    if (!normalizedDraft.categoryId) {
      setProductFormError("Select a category for this product.");
      return;
    }

    if (!productCategoryOptions.some((category) => category.id === normalizedDraft.categoryId)) {
      setProductFormError("Select an existing category for this product.");
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

  const allProductMetrics = products.map((product) =>
    getProductMetrics(product, purchases, sales)
  );
  const summary = {
    totalProducts: products.length,
    totalUnits: allProductMetrics.reduce((sum, metrics) => sum + metrics.totalUnits, 0),
    totalValue: products.reduce(
      (sum, product, index) =>
        sum + allProductMetrics[index].avgPrice * allProductMetrics[index].totalUnits,
      0
    ),
    outOfStock: allProductMetrics.filter((metrics) => metrics.totalUnits <= 0).length,
  };

  const viewPurchaseHistory = viewingProduct
    ? getPurchaseHistory(viewingProduct)
    : [];
  const viewSalesHistory = viewingProduct
    ? getSalesHistory(viewingProduct)
    : [];
  const viewingProductMetrics = viewingProduct
    ? getProductMetrics(viewingProduct, purchases, sales)
    : null;
  const draftExistingProduct = draftProduct ? getExistingProduct(draftProduct) : null;
  const draftProductHasHistory = productHasTransactionHistory(draftExistingProduct);
  const isSkuLocked = Boolean(draftExistingProduct && draftProductHasHistory && !skuChangeUnlocked);

  return (
    <div className="stack-layout">
      <section className="inventory-summary-grid">
        <article className="inventory-summary-card">
          <span>Total products</span>
          <strong>{summary.totalProducts}</strong>
        </article>
        <article className="inventory-summary-card">
          <span>Total stock units</span>
          <strong>{summary.totalUnits}</strong>
        </article>
        <article className="inventory-summary-card">
          <span>Total inventory value</span>
          <strong>{formatCurrency(summary.totalValue)}</strong>
        </article>
        <article className="inventory-summary-card">
          <span>Out of stock</span>
          <strong>{summary.outOfStock}</strong>
        </article>
      </section>

      <div className="supplier-layout">
        <section className="section-card supplier-directory-card">
          <div className="section-heading supplier-directory-heading">
            <div>
              <p className="eyebrow">Products</p>
              <h3>Product List</h3>
            </div>
            <button className="primary-button" type="button" onClick={handleCreateProduct}>
              New Product
            </button>
          </div>

          <p className="inventory-note">
            Click a product to view its purchase and sales history.
          </p>

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

            <div className="stock-report-actions">
              <label className="stock-control">
                <span>Category</span>
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

              <label className="stock-control">
                <span>Inventory</span>
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

          <div className="stock-report-summary">
            <span>
              {filteredProductsWithMetrics.length} of {productsWithMetrics.length} products shown
            </span>
            <span>
              {categoryFilter === "all" ? "All categories" : categoryFilter}
              {" · "}
              {stockFilterLabel}
            </span>
          </div>

          <div className="supplier-directory-table" role="table" aria-label="Product list">
            {filteredProductsWithMetrics.length === 0 ? (
              <p className="empty-copy">No products match the current search or filters.</p>
            ) : (
              <>
                <div className="supplier-directory-head product-directory-grid" role="row">
                  <span className="supplier-directory-column supplier-directory-index" role="columnheader">
                    #
                  </span>
                  <span className="supplier-directory-column" role="columnheader">
                    Product
                  </span>
                  <span className="supplier-directory-column" role="columnheader">
                    Category
                  </span>
                  <span className="supplier-directory-column" role="columnheader">
                    Stock
                  </span>
                  <span className="supplier-directory-column" role="columnheader">
                    Avg Cost
                  </span>
                  <span className="supplier-directory-column" role="columnheader">
                    Setup
                  </span>
                </div>

                <div className="supplier-directory-body" role="rowgroup">
                  {filteredProductsWithMetrics.map(({ product, metrics, categoryLabel }, index) => (
                    <button
                      key={product.id}
                      type="button"
                      className="supplier-directory-row product-directory-grid"
                      onClick={() => openProductDetail(product)}
                      role="row"
                    >
                      <span className="supplier-directory-cell supplier-directory-index" role="cell">
                        <span className="supplier-directory-cell-label">#</span>
                        <strong className="supplier-directory-cell-value">{index + 1}</strong>
                      </span>

                      <span className="supplier-directory-cell" role="cell">
                        <span className="supplier-directory-cell-label">Product</span>
                        <span className="directory-entity">
                          <strong className="supplier-directory-cell-value directory-primary-text">
                            {getProductDisplayName(product)}
                          </strong>
                          <span className="directory-secondary-text">
                            {product.sku ? `SKU ${product.sku}` : "SKU not set"}
                          </span>
                          <span className="directory-chip-row">
                            <span className="directory-chip">{getProductBaseUnit(product)} base</span>
                            <span className="directory-chip subtle">
                              {product.subNames.length} aliases
                            </span>
                          </span>
                        </span>
                      </span>

                      <span className="supplier-directory-cell" role="cell">
                        <span className="supplier-directory-cell-label">Category</span>
                        <span className="directory-entity">
                          <strong className="supplier-directory-cell-value directory-primary-text">
                            {categoryLabel || "Unassigned"}
                          </strong>
                          <span className="directory-secondary-text">
                            {product.detail || "No product detail"}
                          </span>
                        </span>
                      </span>

                      <span className="supplier-directory-cell" role="cell">
                        <span className="supplier-directory-cell-label">Stock</span>
                        <span className="directory-entity">
                          <strong className="supplier-directory-cell-value directory-primary-text">
                            {formatStockQuantity(metrics.totalUnits, product)}
                          </strong>
                          <span className="directory-secondary-text">
                            Purchase in {getProductDefaultPurchaseUnit(product)} · Sales in{" "}
                            {getProductDefaultSalesUnit(product)}
                          </span>
                        </span>
                      </span>

                      <span className="supplier-directory-cell" role="cell">
                        <span className="supplier-directory-cell-label">Avg Cost</span>
                        <span className="directory-entity">
                          <strong className="supplier-directory-cell-value directory-primary-text">
                            {formatCurrency(metrics.avgPrice)}
                          </strong>
                          <span className="directory-secondary-text">
                            Product ID {product.productDisplayId}
                          </span>
                        </span>
                      </span>

                      <span className="supplier-directory-cell" role="cell">
                        <span className="supplier-directory-cell-label">Setup</span>
                        <span className="directory-entity">
                          <strong className="supplier-directory-cell-value directory-primary-text">
                            {product.unitConversions.length} unit mappings
                          </strong>
                          <span className="directory-secondary-text">
                            {product.pictureUrl ? "Image linked" : "No image linked"}
                          </span>
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
      </div>

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
                        {!isPurchase ? (
                          <div>
                            <p className="detail-label">Payment Receive Date</p>
                            <strong>{transaction.payment_received_date || "—"}</strong>
                          </div>
                        ) : null}
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
                        <div className="tx-summary-row">
                          <span>{isPurchase ? "Total" : "Subtotal"}</span>
                          <span>{formatCurrency(summary.subtotal)}</span>
                        </div>
                        <div className="tx-summary-row">
                          <span>VAT (7%)</span>
                          <span>{formatCurrency(summary.vat)}</span>
                        </div>
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
                  {products.some((p) => p.id === draftProduct.id) ? "Edit Product" : "New Product"}
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
                      Main Product Name
                      <input
                        autoFocus
                        value={draftProduct.productName}
                        onChange={(event) => updateDraftField("productName", event.target.value)}
                        placeholder="Name used across the system"
                      />
                    </label>

                    <label className="supplier-option-field product-editor-wide-field">
                      <span>SKU</span>
                      <div className="product-sku-edit-row">
                        <input
                          value={draftProduct.sku}
                          onChange={(event) => updateDraftField("sku", event.target.value)}
                          onBlur={() => {
                            if (!isSkuLocked) {
                              updateDraftField("sku", normalizeSku(draftProduct.sku));
                            }
                          }}
                          placeholder="e.g. PVC-PIPE-20MM-4M-001"
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
                          : "Required and unique. Use A-Z, 0-9, and hyphens only."}
                      </span>
                    </label>

                    <label>
                      Product ID
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
                      Base Stock Unit
                      <input
                        value={draftProduct.stockBaseUnit}
                        onChange={(event) => updateDraftField("stockBaseUnit", event.target.value)}
                        placeholder="pcs, m, kg, L, set"
                      />
                    </label>

                    <label>
                      Default Purchase Unit
                      <input
                        value={draftProduct.defaultPurchaseUnit}
                        onChange={(event) =>
                          updateDraftField("defaultPurchaseUnit", event.target.value)
                        }
                        placeholder="e.g. box"
                      />
                    </label>

                    <label>
                      Default Sales Unit
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
                          Unit
                          <input
                            value={conversion.unit}
                            onChange={(event) =>
                              updateDraftUnitConversion(index, "unit", event.target.value)
                            }
                            placeholder="box"
                          />
                        </label>
                        <label>
                          Factor to Base
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
                    <label>
                      Category
                      <select
                        value={draftProduct.categoryId || ""}
                        onChange={(event) => updateDraftField("categoryId", event.target.value)}
                      >
                        <option value="">
                          {productCategoryOptions.length
                            ? "Select category"
                            : "Create a category first"}
                        </option>
                        {productCategoryOptions.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.label}
                          </option>
                        ))}
                      </select>
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
