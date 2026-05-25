import { getStoredPurchaseItemStatus } from "./purchaseStatus";
import { getStoredSaleItemStatus } from "./saleStatus";
import { getProductBaseUnit, getItemBaseQuantity } from "./unitConversion";
import { getCurrentLanguage } from "./format";
import { translations } from "./i18n/translations";

const STOCK_DEDUCTED_SALE_ITEM_STATUSES = new Set(["packed", "shipped", "delivered"]);

function normalizeText(value) {
  return `${value ?? ""}`.trim().toLowerCase();
}

function normalizeSku(value) {
  return `${value ?? ""}`.trim().toUpperCase();
}

function getProductNames(product) {
  const mainName = product?.productName ?? product?.name ?? product?.product_name ?? "";
  const subNames = Array.isArray(product?.subNames)
    ? product.subNames
    : Array.isArray(product?.sub_names)
      ? product.sub_names
      : Array.isArray(product?.aliases)
        ? product.aliases
        : [];

  return [mainName, ...subNames]
    .map(normalizeText)
    .filter((name, index, names) => name && names.indexOf(name) === index);
}

function getProductSkus(product) {
  const previousSkus = Array.isArray(product?.previousSkus)
    ? product.previousSkus
    : Array.isArray(product?.previous_skus)
      ? product.previous_skus
      : [];

  return [product?.sku, product?.SKU, ...previousSkus]
    .map(normalizeSku)
    .filter((sku, index, skus) => sku && skus.indexOf(sku) === index);
}

function getProductLabel(product) {
  const language = getCurrentLanguage();
  const fallbackTemplate =
    translations[language]?.products?.productFallback ||
    translations.en.products.productFallback ||
    "Product {id}";

  return (
    product?.productName ??
    product?.name ??
    product?.product_name ??
    product?.sku ??
    fallbackTemplate.replace("{id}", `${product?.id ?? ""}`).trim()
  );
}

function createProductResolver(products = []) {
  const byId = new Map();
  const bySku = new Map();
  const byName = new Map();

  products.forEach((product) => {
    const productId = `${product?.id ?? ""}`;

    if (productId) {
      byId.set(productId, product);
    }

    getProductSkus(product).forEach((sku) => {
      if (!bySku.has(sku)) {
        bySku.set(sku, product);
      }
    });

    getProductNames(product).forEach((name) => {
      if (!byName.has(name)) {
        byName.set(name, product);
      }
    });
  });

  return (item = {}) => {
    const productId = `${item.product_id ?? item.productId ?? ""}`;
    const sku = normalizeSku(item.sku);
    const name = normalizeText(item.product_name ?? item.productName ?? item.name);

    return byId.get(productId) || bySku.get(sku) || byName.get(name) || null;
  };
}

export function isSaleStockDeducted(status) {
  return STOCK_DEDUCTED_SALE_ITEM_STATUSES.has(normalizeText(status));
}

export function getAvailableStockByProductId(
  products = [],
  purchases = [],
  sales = [],
  options = {}
) {
  const receivedByProductId = new Map();
  const committedByProductId = new Map();
  const resolveProduct = createProductResolver(products);
  const excludeSaleId = options.excludeSaleId;

  purchases.forEach((purchase) => {
    (purchase.items || []).forEach((item) => {
      if (getStoredPurchaseItemStatus(item, purchase.status) !== "received") {
        return;
      }

      const product = resolveProduct(item);

      if (!product?.id) {
        return;
      }

      const productId = `${product.id}`;
      const quantity = getItemBaseQuantity(item);

      receivedByProductId.set(productId, (receivedByProductId.get(productId) || 0) + quantity);
    });
  });

  sales.forEach((sale) => {
    if (excludeSaleId !== undefined && `${sale.id}` === `${excludeSaleId}`) {
      return;
    }

    (sale.items || []).forEach((item) => {
      const itemStatus = getStoredSaleItemStatus(item, sale.status);

      if (!isSaleStockDeducted(itemStatus)) {
        return;
      }

      const product = resolveProduct(item);

      if (!product?.id) {
        return;
      }

      const productId = `${product.id}`;
      const quantity = getItemBaseQuantity(item);

      committedByProductId.set(productId, (committedByProductId.get(productId) || 0) + quantity);
    });
  });

  return new Map(
    products.map((product) => {
      const productId = `${product.id}`;
      const received = receivedByProductId.get(productId) || 0;
      const committed = committedByProductId.get(productId) || 0;

      return [productId, Math.max(0, received - committed)];
    })
  );
}

export function getSaleStockIssues(
  sale,
  products = [],
  purchases = [],
  sales = [],
  options = {}
) {
  const resolveProduct = createProductResolver(products);
  const stockOptions = options.currentSale
    ? { ...options, excludeSaleId: undefined }
    : options;
  const availableStockByProductId = getAvailableStockByProductId(
    products,
    purchases,
    sales,
    stockOptions
  );
  const requestedByProductId = new Map();
  const requestedProductById = new Map();
  const issues = [];

  function addCommittedItems(sourceSale, quantityByProductId, productById, reportUnknown = true) {
    (sourceSale?.items || []).forEach((item) => {
      const itemStatus = getStoredSaleItemStatus(item, sourceSale.status);

      if (!isSaleStockDeducted(itemStatus)) {
        return;
      }

      const quantity = getItemBaseQuantity(item);

      if (!(quantity > 0)) {
        return;
      }

      const product = resolveProduct(item);

      if (!product?.id) {
        if (reportUnknown) {
          issues.push({
            type: "unknown-product",
            label:
              item.product_name ||
              item.productName ||
              item.name ||
              item.sku ||
              "Unknown product",
          });
        }
        return;
      }

      const productId = `${product.id}`;
      quantityByProductId.set(productId, (quantityByProductId.get(productId) || 0) + quantity);
      productById.set(productId, product);
    });
  }

  addCommittedItems(sale, requestedByProductId, requestedProductById);

  if (options.currentSale) {
    const currentByProductId = new Map();
    addCommittedItems(options.currentSale, currentByProductId, requestedProductById, false);
    currentByProductId.forEach((currentQuantity, productId) => {
      const requestedQuantity = requestedByProductId.get(productId) || 0;
      requestedByProductId.set(productId, Math.max(0, requestedQuantity - currentQuantity));
    });
  }

  requestedByProductId.forEach((requestedQuantity, productId) => {
    if (!(requestedQuantity > 0)) {
      return;
    }

    const product = requestedProductById.get(productId);
    const availableQuantity = availableStockByProductId.get(productId) || 0;

    if (requestedQuantity <= availableQuantity) {
      return;
    }

    issues.push({
      type: "insufficient-stock",
      productId,
      productName: getProductLabel(product),
      availableQuantity,
      requestedQuantity,
      unit: getProductBaseUnit(product),
    });
  });

  return issues;
}

function formatQuantity(value, locale = "en-US") {
  return Number(value || 0).toLocaleString(locale, {
    maximumFractionDigits: 6,
  });
}

export function formatSaleStockIssueMessage(issues = [], options = {}) {
  if (!issues.length) {
    return "";
  }

  const translate = typeof options.t === "function" ? options.t : null;
  const locale = options.locale || "en-US";
  const parts = issues.map((issue) => {
    if (issue.type === "unknown-product") {
      return translate
        ? translate("stockIssues.invalidProduct", { label: issue.label })
        : `${issue.label} is not linked to a valid product`;
    }

    const values = {
      productName: issue.productName,
      requested: formatQuantity(issue.requestedQuantity, locale),
      unit: issue.unit,
      available: formatQuantity(issue.availableQuantity, locale),
    };

    return translate
      ? translate("stockIssues.insufficientLine", values)
      : `${issue.productName} needs ${values.requested} ${issue.unit}, available ${values.available} ${issue.unit}`;
  });

  return translate
    ? translate("stockIssues.summary", { parts: parts.join("; ") })
    : `Insufficient stock. Keep this sale in Draft until stock is received: ${parts.join("; ")}.`;
}
