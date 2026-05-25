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

export function getToday() {
  return formatDateInputValue(new Date());
}

export function formatDateInputValue(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function daysAgoInputValue(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return formatDateInputValue(date);
}

export function addDays(dateString, days) {
  const [year, month, day] = `${dateString}`.split("-").map(Number);
  const date = year && month && day ? new Date(year, month - 1, day) : new Date();

  date.setDate(date.getDate() + days);
  return formatDateInputValue(date);
}

export function addBusinessDays(dateString, days) {
  const [year, month, day] = `${dateString}`.split("-").map(Number);
  const date = year && month && day ? new Date(year, month - 1, day) : new Date();
  let added = 0;

  while (added < days) {
    date.setDate(date.getDate() + 1);
    const dayOfWeek = date.getDay();

    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      added += 1;
    }
  }

  return formatDateInputValue(date);
}

export function computeValidUntilDate(quotationDate, days, dayType) {
  const normalizedDays = Number(days);

  if (!quotationDate || !normalizedDays || normalizedDays < 1) {
    return "";
  }

  return dayType === "business"
    ? addBusinessDays(quotationDate, normalizedDays)
    : addDays(quotationDate, normalizedDays);
}

export function formatDisplayDate(dateString) {
  if (!dateString) {
    return "";
  }

  const [year, month, day] = `${dateString}`.split("-");
  return `${day}/${month}/${year.slice(2)}`;
}

export function getNextQuotationReference(quotations = []) {
  const referencePattern = /^QT-(\d{6})$/;
  const maxSerial = quotations.reduce((max, quotation) => {
    const match = `${quotation.reference_no || ""}`.match(referencePattern);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);

  return `QT-${String(maxSerial + 1).padStart(6, "0")}`;
}

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

export function normalizePartnerOptions(partners = [], currentName = "") {
  const normalizedPartners = partners
    .map((partner) => ({
      id: partner.id || partner.companyName,
      companyName: `${partner.companyName ?? partner.name ?? ""}`.trim(),
      termType: partner.termType,
      billingNoteDate: partner.billingNoteDate,
    }))
    .filter((partner) => partner.companyName);
  const normalizedCurrentName = currentName.trim();

  if (
    normalizedCurrentName &&
    !normalizedPartners.some(
      (partner) => partner.companyName.toLowerCase() === normalizedCurrentName.toLowerCase()
    )
  ) {
    return [
      { id: `current-${normalizedCurrentName}`, companyName: normalizedCurrentName },
      ...normalizedPartners,
    ];
  }

  return normalizedPartners;
}

export function findPartnerByCompanyName(partners = [], companyName = "") {
  const normalizedCompanyName = companyName.trim().toLowerCase();
  return normalizePartnerOptions(partners).find(
    (partner) => partner.companyName.toLowerCase() === normalizedCompanyName
  );
}

export function createInitialForm(referenceNo) {
  return {
    reference_no: referenceNo,
    quotation_date: getToday(),
    valid_until_days: 30,
    valid_until_day_type: "calendar",
    customer_name: "",
    vat_mode: "not_included",
    note: "",
  };
}

export function createEditForm(quotation) {
  return {
    reference_no: quotation.reference_no || "",
    quotation_date: quotation.quotation_date || getToday(),
    valid_until_days:
      quotation.valid_until_day_type === "no_valid_date"
        ? 0
        : quotation.valid_until_days || 30,
    valid_until_day_type: quotation.valid_until_day_type || "calendar",
    customer_name: quotation.customer_name || "",
    vat_mode: quotation.vat_mode || "not_included",
    note: quotation.note || "",
  };
}

export function normalizeSupplierOptions(item) {
  if (!Array.isArray(item?.supplier_options)) {
    return [];
  }

  return item.supplier_options.map((option) => ({
    option_id:
      option.option_id ||
      option.id ||
      `qopt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    supplier_name: option.supplier_name || "",
    cost_price: option.cost_price ?? "",
  }));
}

export function createEditItems(quotation) {
  const existingItems = Array.isArray(quotation?.items) ? quotation.items : [];

  if (!existingItems.length) {
    return [emptyItem()];
  }

  return existingItems.map((item) => ({
    ...emptyItem(),
    ...item,
    line_id:
      item.line_id || item.id || `quotation-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    product_id: item.product_id || item.product || "",
    product_query:
      item.sku && item.product_name ? `${item.product_name} (${item.sku})` : item.product_name || "",
    product_name: item.product_name || "",
    sku: item.sku || "",
    unit: item.unit || "pcs",
    quantity: item.quantity ?? 1,
    sale_price: item.sale_price ?? "",
    supplier_options: normalizeSupplierOptions(item),
    discounts: normalizeDiscounts(item),
  }));
}

export function getItemCount(items = []) {
  return Array.isArray(items) ? items.length : 0;
}

export function quotationMatchesQuery(quotation, query) {
  const searchableText = [
    quotation.reference_no,
    quotation.customer_name,
    quotation.quotation_date,
    quotation.valid_until_date,
    quotation.note,
    ...(quotation.items || []).flatMap((item) => [
      item.product_name,
      item.sku,
      item.unit,
      item.quantity,
      item.sale_price,
    ]),
  ]
    .map((value) => `${value ?? ""}`.toLowerCase())
    .join(" ");

  return searchableText.includes(query);
}

export function sortRecentQuotations(a, b) {
  const dateCompare = `${b.quotation_date || ""}`.localeCompare(`${a.quotation_date || ""}`);
  if (dateCompare !== 0) {
    return dateCompare;
  }

  return `${b.reference_no || ""}`.localeCompare(`${a.reference_no || ""}`);
}

export function getQuotationState(quotation) {
  if (!quotation?.valid_until_date) {
    return "Valid";
  }

  return quotation.valid_until_date >= getToday() ? "Valid" : "Expired";
}

export function quotationMatchesDateRange(quotationDate, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) {
    return true;
  }

  if (!quotationDate) {
    return false;
  }

  if (dateFrom && quotationDate < dateFrom) {
    return false;
  }

  if (dateTo && quotationDate > dateTo) {
    return false;
  }

  return true;
}

export function getQuotationPartnerOptions(quotations, key, partners = []) {
  const optionMap = new Map();

  normalizePartnerOptions(partners).forEach((partner) => {
    optionMap.set(partner.companyName.toLowerCase(), partner.companyName);
  });

  quotations.forEach((quotation) => {
    const value = `${quotation[key] ?? ""}`.trim();
    if (value) {
      optionMap.set(value.toLowerCase(), value);
    }
  });

  return [...optionMap.values()].sort((left, right) => left.localeCompare(right));
}

export function getQuotationItemKey(item, index) {
  return item.line_id || item.id || `${item.product_id || item.product || "quotation-item"}-${index}`;
}

export function getShortQuotationItemKeys(quotation, stockCoverage) {
  return (quotation.items || [])
    .map((item, index) => ({ item, index, coverage: stockCoverage.lines[index] }))
    .filter(({ coverage }) => coverage?.status === "short")
    .map(({ item, index }) => getQuotationItemKey(item, index));
}

export function buildConversionItemBase(item) {
  return {
    product_id: item.product_id || item.product || "",
    product_name: item.product_name || "",
    sku: item.sku || "",
    unit: item.unit || "pcs",
    quantity: item.quantity ?? 0,
    base_unit: item.base_unit || item.baseUnit || "",
    base_quantity: item.base_quantity ?? item.baseQuantity ?? 0,
    conversion_factor: item.conversion_factor ?? item.conversionFactor ?? 1,
    discounts: normalizeDiscounts(item),
  };
}

export function buildPurchaseGroups(quotation, rows, suppliers = []) {
  const groupsBySupplier = new Map();

  rows.forEach(({ item, option }) => {
    const supplierName = option?.supplier_name || "";
    const supplier = findPartnerByCompanyName(suppliers, supplierName);
    const key = supplierName || "__unassigned__";

    if (!groupsBySupplier.has(key)) {
      groupsBySupplier.set(key, {
        supplierName,
        supplier,
        items: [],
      });
    }

    groupsBySupplier.get(key).items.push({
      ...buildConversionItemBase(item),
      supplier_name: supplierName,
      unit_cost: option?.cost_price ?? "",
    });
  });

  return [...groupsBySupplier.values()].map((group) => ({
    supplier_name: group.supplierName,
    supplier: group.supplier,
    referenceLabel: quotation.reference_no || "",
    transaction_date: quotation.quotation_date || getToday(),
    note: "",
    items: group.items,
  }));
}

export function buildSalesPrefillFromRows(quotation, rows, customers = []) {
  const customer = findPartnerByCompanyName(customers, quotation.customer_name || "");
  const paymentTermType = customer?.termType || "";
  const paymentTermDays =
    paymentTermType === "credit" ? customer?.billingNoteDate || "" : "";

  return {
    customer_name: quotation.customer_name || "",
    transaction_date: quotation.quotation_date || getToday(),
    vat_mode: quotation.vat_mode || "not_included",
    payment_term_type: paymentTermType,
    payment_term_days: paymentTermDays,
    note: "",
    items: rows.map(({ item, option }) => ({
      ...buildConversionItemBase(item),
      unit_price: item.sale_price ?? "",
      supplier_name: option?.supplier_name || "",
      unit_cost: option?.cost_price ?? "",
    })),
  };
}
