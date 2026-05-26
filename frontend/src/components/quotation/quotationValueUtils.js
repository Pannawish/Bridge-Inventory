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
  const stock = Number(product?.stock || product?.currentStock || product?.totalStock);
  return Number.isFinite(stock) ? stock : 0;
}

export function getQuotationStockCoverage(quotation, products = []) {
  const lines = (quotation?.items || []).map((item) => {
    const product = findProductForItem(item, products);

    if (!product) {
      return {
        status: "unknown",
        metaKey: "quotationDetail.stockUnknownMeta",
        metaValues: {},
      };
    }

    const availableBaseQuantity = getProductStockQuantity(product);
    const baseUnit = getQuotationItemBaseUnit(item, product);
    const requestedBaseQuantity = getQuotationItemBaseQuantity(item, product);
    const shortageBaseQuantity = Math.max(0, requestedBaseQuantity - availableBaseQuantity);
    const isCovered = availableBaseQuantity >= requestedBaseQuantity;

    return isCovered
      ? {
          status: "covered",
          metaKey: "quotationDetail.stockCoveredMeta",
          metaValues: {
            available: formatStockQuantity(availableBaseQuantity),
            unit: baseUnit,
          },
        }
      : {
          status: "short",
          metaKey: "quotationDetail.stockShortMeta",
          metaValues: {
            available: formatStockQuantity(availableBaseQuantity),
            shortage: formatStockQuantity(shortageBaseQuantity),
            unit: baseUnit,
          },
        };
  });

  return {
    lines,
    allSufficient: lines.every((line) => line.status === "covered"),
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
