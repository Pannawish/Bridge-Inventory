// Helper utilities for quotation workflow behavior.

import {
  buildConvertedItemFields,
  getItemBaseQuantity,
  getProductBaseUnit,
  getProductDefaultSalesUnit,
} from "../../unitConversion";
import { formatMoney as fmt, formatNumber } from "../../format";
import { itemMatchesProduct } from "../products/productUtils";

const VAT_RATE = 0.07;

export const VAT_OPTION_VALUES = ["included", "not_included"];

export function emptySupplierOption() {
  return {
    option_id: `qopt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    supplier_name: "",
    cost_price: "",
  };
}

export function emptyItem() {
  return {
    line_id: `quotation-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    product_id: "",
    product_query: "",
    product_name: "",
    sku: "",
    unit: "pcs",
    quantity: 1,
    sale_price: "",
    supplier_options: [],
    discounts: [""],
  };
}

export function getProductName(product, fallbackLabel = "") {
  return (
    product?.name ||
    product?.productName ||
    product?.product_name ||
    product?.sku ||
    `${fallbackLabel}`.trim()
  );
}

export function getProductSearchNames(product) {
  const mainName = `${getProductName(product)}`.trim();
  const subNames = Array.isArray(product?.subNames) ? product.subNames : [];

  return [mainName, ...subNames]
    .map((name) => `${name ?? ""}`.trim())
    .filter(
      (name, index, names) =>
        name && names.findIndex((item) => item.toLowerCase() === name.toLowerCase()) === index
    );
}

export function getProductSku(product) {
  return product?.sku || product?.SKU || "";
}

export function findProductForItem(item, products = []) {
  return products.find((product) => itemMatchesProduct(item, product));
}

export function normalizeDiscounts(item) {
  if (Array.isArray(item.discounts) && item.discounts.length) {
    return item.discounts;
  }

  if (Number(item.discount) > 0) {
    return [item.discount];
  }

  return [""];
}

export function getDiscountMultiplier(item) {
  return normalizeDiscounts(item).reduce((acc, discount) => {
    const clamped = Math.min(100, Math.max(0, Number(discount) || 0));
    return acc * (1 - clamped / 100);
  }, 1);
}

export function computeAmount(item, priceKey = "sale_price") {
  const qty = Number(item.quantity) || 0;
  const price = Number(item[priceKey]) || 0;

  return qty * price * getDiscountMultiplier(item);
}

/**
 * Number of supplier sourcing options on a line that carry a usable (> 0) cost.
 */
export function countSupplierOptionsWithCost(item) {
  return (item?.supplier_options || []).filter((option) => {
    const cost = Number(option?.cost_price);
    return Number.isFinite(cost) && cost > 0;
  }).length;
}

/**
 * Lowest usable supplier cost across a line's sourcing options, or null when no
 * option has a cost yet. This is the cheapest price the middle-man can source at.
 */
export function getLowestSupplierCost(item) {
  const costs = (item?.supplier_options || [])
    .map((option) => Number(option?.cost_price))
    .filter((cost) => Number.isFinite(cost) && cost > 0);

  return costs.length ? Math.min(...costs) : null;
}

/**
 * Flags the cheapest sourcing option so the user can pick it at a glance.
 * Only meaningful when two or more options actually have a cost to compare.
 */
export function isLowestCostSupplierOption(item, option) {
  if (countSupplierOptionsWithCost(item) < 2) {
    return false;
  }

  const cost = Number(option?.cost_price);
  return Number.isFinite(cost) && cost > 0 && cost === getLowestSupplierCost(item);
}

/**
 * Per-unit margin of a quotation line: the discounted sale price minus the
 * cheapest sourcing cost, plus that margin as a percentage of cost.
 *
 * Percentage uses cost as the base (markup over cost), matching how product
 * price insights report margin elsewhere in the app. Both sale price and
 * supplier cost are entered in the same line unit, so this stays consistent.
 * Returns nulls when there is no cost to compare against or no sale price yet.
 */
export function computeQuotationLineMargin(item) {
  const cost = getLowestSupplierCost(item);

  if (cost === null || !hasValue(item?.sale_price)) {
    return { cost, unitMargin: null, percent: null };
  }

  const salePrice = Number(item?.sale_price);
  if (!Number.isFinite(salePrice)) {
    return { cost, unitMargin: null, percent: null };
  }

  const netUnitPrice = salePrice * getDiscountMultiplier(item);
  const unitMargin = netUnitPrice - cost;
  const percent = cost > 0 ? (unitMargin / cost) * 100 : null;

  return { cost, unitMargin, percent };
}

/**
 * Suggested sale price that preserves this product's typical historical markup
 * on the line's cheapest current sourcing cost:
 *
 *   suggested = lowestSupplierCost x (averageRecentSalePrice / averageUnitCost)
 *
 * Both historical averages must come from the same selected unit so the ratio
 * (the typical markup) is unit-independent. Returns null when there is no
 * sourcing cost yet or no usable price history to anchor the markup.
 */
export function computeSuggestedSalePrice(item, averageUnitCost, averageRecentSalePrice) {
  const cost = getLowestSupplierCost(item);
  if (cost === null) {
    return null;
  }

  const avgCost = Number(averageUnitCost);
  const avgSale = Number(averageRecentSalePrice);
  if (!Number.isFinite(avgCost) || avgCost <= 0 || !Number.isFinite(avgSale) || avgSale <= 0) {
    return null;
  }

  return cost * (avgSale / avgCost);
}

export function formatStockQuantity(value) {
  return formatNumber(value, null, {
    maximumFractionDigits: 6,
  });
}

export function hasValue(value) {
  return value !== undefined && value !== null && `${value}`.trim() !== "";
}

export function getQuotationItemBaseQuantity(item, product) {
  if (hasValue(item?.base_quantity) || hasValue(item?.conversion_factor)) {
    return getItemBaseQuantity(item);
  }

  if (!product) {
    return Number(item?.quantity) || 0;
  }

  return buildConvertedItemFields(
    product,
    item?.quantity,
    item?.unit || getProductDefaultSalesUnit(product),
    "sale"
  ).base_quantity;
}

export function getQuotationItemBaseUnit(item, product) {
  return item?.base_unit || item?.baseUnit || getProductBaseUnit(product);
}

export function getQuotationItemConversionFactor(item, product) {
  const storedFactor = Number(item?.conversion_factor ?? item?.conversionFactor);
  if (Number.isFinite(storedFactor) && storedFactor > 0) {
    return storedFactor;
  }

  const quantity = Number(item?.quantity) || 0;
  const baseQuantity = Number(item?.base_quantity ?? item?.baseQuantity);
  if (quantity > 0 && Number.isFinite(baseQuantity) && baseQuantity > 0) {
    return baseQuantity / quantity;
  }

  if (!product) {
    return 1;
  }

  const unitConversions = product?.unitConversions || product?.unit_conversions || [];
  const selectedUnit = `${item?.unit || getProductDefaultSalesUnit(product)}`.toLowerCase();
  const conversion = unitConversions.find(
    (option) => `${option.unit || ""}`.toLowerCase() === selectedUnit
  );

  return Number(conversion?.factorToBase ?? conversion?.factor_to_base ?? 1) || 1;
}

export function getQuotationBaseSalePrice(item, product, afterDiscount = false) {
  const salePrice = Number(item?.sale_price);
  if (!Number.isFinite(salePrice)) {
    return null;
  }

  const conversionFactor = getQuotationItemConversionFactor(item, product);
  if (!Number.isFinite(conversionFactor) || conversionFactor <= 0) {
    return null;
  }

  const normalizedPrice = afterDiscount
    ? salePrice * getDiscountMultiplier(item)
    : salePrice;

  return normalizedPrice / conversionFactor;
}

export function formatQuantityWithUnit(quantity, unit) {
  if (quantity === "" || quantity === null || quantity === undefined) {
    return "—";
  }

  return `${formatStockQuantity(quantity)} ${unit || ""}`.trim();
}

export function formatOptionalMoney(value) {
  return Number.isFinite(Number(value)) ? fmt(value) : "—";
}

export function getProductStockQuantity(product) {
  // Match the rest of the app's stock reader (see getProductCurrentStock in
  // products/productUtils): the API sends on-hand as `current_stock`.
  const stock = Number(
    product?.current_stock ??
      product?.currentStock ??
      product?.available_stock ??
      product?.stock ??
      product?.totalStock
  );
  return Number.isFinite(stock) ? stock : 0;
}

// Open purchase orders (Ordered / Partially received) that still have unreceived
// units of this product on the way. Powers the "On the way" coverage state and
// the incoming-stock table in the quotation detail.
function getIncomingPurchasesForProduct(productId, purchases = []) {
  if (productId == null) {
    return [];
  }
  const rows = [];
  (Array.isArray(purchases) ? purchases : []).forEach((purchase) => {
    if (purchase?.status !== "ordered" && purchase?.status !== "partially_received") {
      return;
    }
    (purchase.items || []).forEach((item) => {
      if (`${item.product_id}` !== `${productId}` || item.item_status !== "pending") {
        return;
      }
      const baseQuantity = Number(item.base_quantity) || 0;
      if (baseQuantity <= 0) {
        return;
      }
      rows.push({
        id: purchase.id,
        reference_no: purchase.reference_no || purchase.id,
        status: purchase.status,
        expected_delivery_date: item.expected_delivery_date || null,
        quantity: item.quantity,
        unit: item.unit,
        baseQuantity,
      });
    });
  });
  return rows;
}

export function getQuotationStockCoverage(quotation, products = [], purchases = []) {
  const lines = (quotation?.items || []).map((item) => {
    const product = findProductForItem(item, products);

    if (!product) {
      return {
        status: "unknown",
        metaKey: "quotationDetail.stockUnknownMeta",
        metaValues: {},
        incomingPOs: [],
      };
    }

    const availableBaseQuantity = getProductStockQuantity(product);
    const baseUnit = getQuotationItemBaseUnit(item, product);
    const requestedBaseQuantity = getQuotationItemBaseQuantity(item, product);
    const shortageBaseQuantity = Math.max(0, requestedBaseQuantity - availableBaseQuantity);

    if (availableBaseQuantity >= requestedBaseQuantity) {
      return {
        status: "covered",
        metaKey: "quotationDetail.stockAvailableMeta",
        metaValues: {
          available: formatStockQuantity(availableBaseQuantity),
          unit: baseUnit,
        },
        incomingPOs: [],
      };
    }

    // On hand isn't enough — see whether ordered-but-not-yet-received POs close
    // the gap. If they do, it's "on the way" rather than "need purchase".
    const incomingPOs = getIncomingPurchasesForProduct(product.id, purchases);
    const incomingBaseQuantity = incomingPOs.reduce((sum, po) => sum + po.baseQuantity, 0);

    if (
      incomingPOs.length > 0 &&
      availableBaseQuantity + incomingBaseQuantity >= requestedBaseQuantity
    ) {
      return {
        status: "incoming",
        metaKey: "quotationDetail.stockIncomingMeta",
        metaValues: {
          incoming: formatStockQuantity(incomingBaseQuantity),
          unit: baseUnit,
        },
        incomingPOs,
      };
    }

    return {
      status: "short",
      metaKey: "quotationDetail.stockShortageMeta",
      metaValues: {
        available: formatStockQuantity(availableBaseQuantity),
        shortage: formatStockQuantity(shortageBaseQuantity),
        unit: baseUnit,
      },
      incomingPOs,
    };
  });

  return {
    lines,
    // Nothing needs a fresh PO when every line is either in stock or already on
    // the way; the "Purchase" action stays disabled in that case.
    allSufficient: lines.every(
      (line) => line.status === "covered" || line.status === "incoming"
    ),
  };
}

export function computeVatSummary(itemTotal, vatMode) {
  const total = Number(itemTotal) || 0;

  if (vatMode === "included") {
    const beforeVat = total / (1 + VAT_RATE);
    const vat = total - beforeVat;
    return {
      total: beforeVat,
      subtotal: beforeVat,
      vat,
      grandTotal: total,
    };
  }

  if (vatMode === "not_included") {
    const vat = total * VAT_RATE;
    return {
      total,
      subtotal: total,
      vat,
      grandTotal: total + vat,
    };
  }

  return {
    total,
    subtotal: total,
    vat: 0,
    grandTotal: total,
  };
}

export function isVatEnabled(vatMode) {
  return vatMode === "included" || vatMode === "not_included";
}
