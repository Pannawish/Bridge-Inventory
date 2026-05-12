import {
  getCategoryPathById,
  resolveLegacyCategoryId,
} from "../CategoryPage";
import { getStoredPurchaseItemStatus } from "../../purchaseStatus";
import { getStoredSaleItemStatus } from "../../saleStatus";
import {
  getItemBaseQuantity,
  getProductBaseUnit,
  getProductDefaultPurchaseUnit,
  getProductDefaultSalesUnit,
  getProductUnitConversions,
} from "../../unitConversion";

const VAT_RATE = 0.07;
const SKU_PATTERN = /^\d+$/;
const CATEGORY_SKU_CODE_WIDTH = 2;
const PRODUCT_SKU_SERIAL_WIDTH = 4;

export function normalizeUniqueNames(values) {
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

export function getProductSubNames(product) {
  return normalizeUniqueNames(
    Array.isArray(product?.subNames)
      ? product.subNames
      : Array.isArray(product?.aliases)
        ? product.aliases
        : []
  );
}

export function getProductPreviousSkus(product) {
  return normalizeUniqueNames(
    Array.isArray(product?.previousSkus)
      ? product.previousSkus.map(normalizeSku)
      : Array.isArray(product?.previous_skus)
        ? product.previous_skus.map(normalizeSku)
        : []
  );
}

export function getProductAllNames(product) {
  return normalizeUniqueNames([getProductMainName(product), ...getProductSubNames(product)]);
}

export function getProductDisplayName(product) {
  return getProductAllNames(product)[0] || product?.sku || `Product ${product?.id || ""}`.trim();
}

export function getProductPictures(product) {
  const sourcePictures = Array.isArray(product?.productPictures)
    ? product.productPictures
    : Array.isArray(product?.pictures)
      ? product.pictures
      : [];
  const pictureUrl = `${product?.pictureUrl ?? ""}`.trim();

  const productPictures = sourcePictures
    .map((picture, index) => {
      const url = `${picture?.url ?? picture?.pictureUrl ?? ""}`.trim();
      const file =
        typeof File !== "undefined" && picture?.file instanceof File ? picture.file : null;

      return {
        id: `${picture?.id || url || `product-picture-${index}`}`,
        name: `${picture?.name ?? (file ? file.name : "") ?? ""}`.trim(),
        url,
        file,
        isNew: Boolean(picture?.isNew),
        isSelected: Boolean(
          picture?.isSelected ?? picture?.is_selected ?? picture?.selected
        ),
      };
    })
    .filter((picture) => picture.url || picture.file);

  if (
    pictureUrl &&
    !productPictures.some((picture) => picture.url && picture.url === pictureUrl)
  ) {
    productPictures.push({
      id: "__legacy_picture__",
      name: getDocumentName(pictureUrl),
      url: pictureUrl,
      file: null,
      isNew: false,
      isSelected: !productPictures.some((picture) => picture.isSelected),
    });
  }

  return productPictures;
}

export function getSelectedProductPicture(product) {
  const pictures = getProductPictures(product);
  const selectedPictureId = `${product?.selectedPictureId ?? ""}`;
  const selectedPicture =
    pictures.find((picture) => picture.id === selectedPictureId) ||
    pictures.find((picture) => picture.isSelected) ||
    pictures[0];

  if (selectedPicture) {
    return selectedPicture;
  }

  return null;
}

export function normalizeSku(value) {
  return `${value ?? ""}`.trim().toUpperCase().replace(/\s+/g, "-");
}

export function isValidSku(value) {
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

export function getCategoryPathSkuCode(categories = [], categoryId = "") {
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

export function getNextSkuSerial(baseSku, products, currentProductId = "") {
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

export function normalizeProduct(product) {
  const allNames = getProductAllNames(product);
  const [productName = "", ...subNames] = allNames;
  const stockBaseUnit = getProductBaseUnit(product);
  const unitConversions = getProductUnitConversions({
    ...product,
    stockBaseUnit,
  });
  const productPictures = getProductPictures(product);
  const selectedPicture = getSelectedProductPicture({ ...product, productPictures });

  return {
    id: product.id || `product-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    productDisplayId: Math.max(1, Math.round(Number(product.productDisplayId) || 1001)),
    sku: normalizeSku(product.sku),
    previousSkus: getProductPreviousSkus(product),
    productName,
    subNames,
    stockBaseUnit,
    defaultPurchaseUnit: getProductDefaultPurchaseUnit({
      ...product,
      stockBaseUnit,
      unitConversions,
    }),
    defaultSalesUnit: getProductDefaultSalesUnit({
      ...product,
      stockBaseUnit,
      unitConversions,
    }),
    unitConversions,
    categoryId: `${product.categoryId ?? ""}`,
    category: `${product.category ?? ""}`,
    detail: `${product.detail ?? ""}`,
    pictureUrl: `${product.pictureUrl ?? ""}`,
    productPictures,
    selectedPictureId: selectedPicture?.id || "",
    removePictureIds: Array.isArray(product.removePictureIds) ? product.removePictureIds : [],
  };
}

export function formatCurrency(value) {
  return `฿${Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatStockQuantity(value, product) {
  const unit = getProductBaseUnit(product);
  return `${Number(value || 0).toLocaleString()} ${unit}`;
}

export function getDocumentName(documentUrl = "") {
  const [path = ""] = `${documentUrl}`.split("?");
  const name = path.split("/").filter(Boolean).pop();
  return name ? decodeURIComponent(name) : "Attached document";
}

export function getTransactionDocuments(transaction = {}) {
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

export function computeItemAmount(item) {
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

export function renderDiscounts(item) {
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

export function computeVatSummary(items, vatMode) {
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

export function itemMatchesProduct(item, product) {
  if (!item || !product) {
    return false;
  }

  const itemProductId = `${item.product_id ?? item.productId ?? ""}`;
  const productId = `${product.id ?? ""}`;

  if (itemProductId && productId && itemProductId === productId) {
    return true;
  }

  return matchesSku(item, product.sku) ||
    getProductPreviousSkus(product).some((sku) => matchesSku(item, sku));
}

function getProductCurrentStock(product) {
  return Number(product?.current_stock ?? product?.currentStock ?? product?.available_stock ?? 0) || 0;
}

export function resolveProductCategoryId(product, categories) {
  if (product.categoryId && categories.some((category) => category.id === product.categoryId)) {
    return product.categoryId;
  }

  return resolveLegacyCategoryId(categories, product.category);
}

export function getProductCategoryLabel(product, categories) {
  const categoryId = resolveProductCategoryId(product, categories);

  if (categoryId) {
    return getCategoryPathById(categories, categoryId) || product.category || "";
  }

  return product.category || "";
}

export function getProductMetrics(product, purchases, sales) {
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
