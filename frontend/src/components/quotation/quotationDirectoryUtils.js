import { getToday } from "./quotationDateUtils";
import {
  emptyItem,
  normalizeDiscounts,
} from "./quotationValueUtils";

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
    payment_term_type: "",
    payment_term_days: "",
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
    payment_term_type: quotation.payment_term_type || "",
    payment_term_days: quotation.payment_term_days || "",
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
