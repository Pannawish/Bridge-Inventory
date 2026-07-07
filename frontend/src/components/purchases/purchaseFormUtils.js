// Helper utilities for purchase workflow behavior.

import { getTodayString } from "../../purchaseStatus";
import { getProductDefaultPurchaseUnit } from "../../unitConversion";
import {
  computeDiscountedAmount,
  getEffectiveDiscounts,
} from "../transactionDiscounts";

const VAT_RATE = 0.07;

export const today = getTodayString();
export const vatOptionValues = ["included", "not_included"];
export const defaultSupplierOptions = [];

function getPurchaseReferencePrefix(date = new Date()) {
  const buddhistYear = date.getFullYear() + 543;
  const yearSuffix = `${buddhistYear}`.slice(-2);
  const month = `${date.getMonth() + 1}`.padStart(2, "0");

  return `PO-${yearSuffix}${month}`;
}

export function getNextPurchaseReference(purchases = [], date = new Date()) {
  const prefix = getPurchaseReferencePrefix(date);
  const referencePattern = new RegExp(`^${prefix}-(\\d+)$`);
  const maxSerial = purchases.reduce((max, purchase) => {
    const match = `${purchase.reference_no || ""}`.match(referencePattern);

    if (!match) {
      return max;
    }

    return Math.max(max, Number(match[1]));
  }, 0);
  const nextSerial = maxSerial + 1;

  return `${prefix}-${`${nextSerial}`.padStart(3, "0")}`;
}

export function getNextPurchaseReferenceAfter(referenceNo, date = new Date()) {
  const prefix = getPurchaseReferencePrefix(date);
  const match = `${referenceNo || ""}`.match(new RegExp(`^${prefix}-(\\d+)$`));

  if (!match) {
    return getNextPurchaseReference([], date);
  }

  const nextSerial = Number(match[1]) + 1;
  return `${prefix}-${`${nextSerial}`.padStart(3, "0")}`;
}

export function emptyItem() {
  return {
    line_id: `purchase-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    product_id: "",
    product_query: "",
    product_name: "",
    sku: "",
    unit: "pcs",
    expected_delivery_date: "",
    item_status: "pending",
    received_date: "",
    quantity: 1,
    unit_cost: "",
    discounts: [""],
  };
}

export function getProductName(product) {
  return product.name || product.productName || product.product_name || product.sku || `${product?.id || ""}`.trim();
}

export function getProductSearchNames(product) {
  const mainName = `${getProductName(product)}`.trim();
  const subNames = Array.isArray(product.subNames) ? product.subNames : [];

  return [mainName, ...subNames]
    .map((name) => `${name ?? ""}`.trim())
    .filter(
      (name, index, names) =>
        name && names.findIndex((item) => item.toLowerCase() === name.toLowerCase()) === index
    );
}

export function getProductSku(product) {
  return product.sku || product.SKU || "";
}

export function getProductUnit(product) {
  return getProductDefaultPurchaseUnit(product);
}

export function computeAmount(item, transactionDiscount = null) {
  return computeDiscountedAmount(
    item.quantity,
    item.unit_cost,
    getEffectiveDiscounts(item.discounts, transactionDiscount)
  );
}

export function computeLeadTimeDays(transactionDate, expectedDeliveryDate) {
  if (!transactionDate || !expectedDeliveryDate) {
    return "";
  }

  const start = new Date(`${transactionDate}T00:00:00`);
  const end = new Date(`${expectedDeliveryDate}T00:00:00`);
  const diffMs = end.getTime() - start.getTime();

  if (!Number.isFinite(diffMs)) {
    return "";
  }

  return Math.max(0, Math.round(diffMs / 86400000));
}

export function computeVatSummary(itemTotal, vatMode) {
  if (vatMode === "included") {
    const totalBeforeVat = itemTotal / (1 + VAT_RATE);
    const vat = itemTotal - totalBeforeVat;
    return {
      total: totalBeforeVat,
      vat,
      grandTotal: itemTotal,
    };
  }

  if (vatMode === "not_included") {
    const vat = itemTotal * VAT_RATE;
    return {
      total: itemTotal,
      vat,
      grandTotal: itemTotal + vat,
    };
  }

  return {
    total: itemTotal,
    vat: 0,
    grandTotal: itemTotal,
  };
}

export function isVatEnabled(vatMode) {
  return vatMode !== "none";
}

export function getSupplierPaymentTerms(supplier) {
  const paymentTermType = supplier?.termType || "";
  const paymentTermDays =
    paymentTermType === "credit" ? supplier?.billingNoteDate || "" : "";

  return {
    payment_term_type: paymentTermType,
    payment_term_days: paymentTermDays,
  };
}

export function createInitialForm(referenceNo, prefill = {}) {
  return {
    reference_no: referenceNo,
    supplier_name: prefill.supplier_name || "",
    supplier_tax_invoice: prefill.supplier_tax_invoice || "",
    status: "ordered",
    transaction_date: prefill.transaction_date || prefill.quotation_date || today,
    note: prefill.note || "",
    documents: [],
    payment_term_type: prefill.payment_term_type || "",
    payment_term_days: prefill.payment_term_days || "",
  };
}

export function getProductQuery(productName, sku) {
  return sku ? `${productName} (${sku})` : productName;
}

export function createInitialItems(prefill = {}) {
  const sourceItems = Array.isArray(prefill.items) ? prefill.items : [];

  if (!sourceItems.length) {
    return [emptyItem()];
  }

  return sourceItems.map((item, index) => {
    const productName = item.product_name || item.productName || item.name || "";
    const sku = item.sku || item.SKU || "";

    return {
      ...emptyItem(),
      line_id: `purchase-prefill-${Date.now()}-${index}`,
      product_id: item.product_id || item.productId || "",
      product_query: getProductQuery(productName, sku),
      product_name: productName,
      sku,
      unit: item.unit || "pcs",
      quantity: item.quantity ?? 1,
      unit_cost: item.unit_cost ?? item.cost_price ?? "",
      discounts: Array.isArray(item.discounts)
        ? item.discounts
        : Number(item.discount) > 0
          ? [item.discount]
          : [""],
    };
  });
}

export function getFilteredSuppliers(suppliers, supplierQuery) {
  const normalizedQuery = supplierQuery.trim().toLowerCase();

  if (!normalizedQuery) {
    return suppliers;
  }

  return suppliers.filter((supplier) =>
    supplier.companyName.toLowerCase().includes(normalizedQuery)
  );
}

export function getFilteredProducts(products, query) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return products;
  }

  return products.filter((product) => {
    const matchesName = getProductSearchNames(product).some((name) =>
      name.toLowerCase().includes(normalizedQuery)
    );
    const sku = getProductSku(product).toLowerCase();
    const displayId = `${product.productDisplayId || product.id || ""}`.toLowerCase();

    return matchesName || sku.includes(normalizedQuery) || displayId.includes(normalizedQuery);
  });
}
