// Helper utilities for purchase workflow behavior.

import { formatDate, formatMoney as fmt } from "../../format";
import { getStatusLabel } from "../../i18n/statusLabels";
import {
  getInitialPurchaseItemStatus,
  getPurchaseItemDisplayStatus,
  getStoredPurchaseItemStatus,
  getTodayString,
  purchaseStatuses,
} from "../../purchaseStatus";

const VAT_RATE = 0.07;

export const statusOptions = purchaseStatuses;
export const purchaseStatusPresets = [
  { labelKey: "purchaseHistory.presetAll", statuses: statusOptions },
  { labelKey: "purchaseHistory.presetOpen", statuses: ["draft", "ordered", "partially_received"] },
  { labelKey: "purchaseHistory.filterReceived", statuses: ["received"] },
  { labelKey: "purchaseHistory.presetCancelled", statuses: ["cancelled"] },
];
export const defaultSupplierOptions = [];

export function getToday() {
  return getTodayString();
}

export function daysAgoString(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getDocumentName(documentUrl = "", t = null) {
  const [path = ""] = `${documentUrl}`.split("?");
  const name = path.split("/").filter(Boolean).pop();
  const fallback = t ? t("transactionTable.attachedDocument") : "Attached document";
  return name ? decodeURIComponent(name) : fallback;
}

export function getTransactionDocuments(purchase, t = null) {
  if (Array.isArray(purchase.documents) && purchase.documents.length) {
    return purchase.documents;
  }

  return purchase.document_url
    ? [
        {
          id: "__legacy_document__",
          name: getDocumentName(purchase.document_url, t),
          url: purchase.document_url,
        },
      ]
    : [];
}

function normalize(value) {
  return `${value ?? ""}`.toLowerCase();
}

export function purchaseMatchesQuery(purchase, query) {
  const searchableText = [
    purchase.reference_no,
    purchase.supplier_name,
    purchase.status,
    purchase.transaction_date,
    purchase.note,
    purchase.supplier_tax_invoice,
    ...(purchase.items || []).flatMap((item) => [
      item.product_name,
      item.sku,
      item.unit,
      item.base_unit,
      item.expected_delivery_date,
      item.received_date,
      getPurchaseItemDisplayStatus(item, purchase.status),
      item.lead_time_days,
      item.quantity,
      item.unit_cost,
    ]),
  ]
    .map(normalize)
    .join(" ");

  return searchableText.includes(query);
}

export function normalizeSupplierOptions(suppliers = [], currentSupplierName = "") {
  const normalizedSuppliers = suppliers
    .map((supplier) => ({
      id: supplier.id || supplier.companyName,
      companyName: `${supplier.companyName ?? supplier.name ?? ""}`.trim(),
    }))
    .filter((supplier) => supplier.companyName);
  const currentName = currentSupplierName.trim();

  if (
    currentName &&
    !normalizedSuppliers.some(
      (supplier) => supplier.companyName.toLowerCase() === currentName.toLowerCase()
    )
  ) {
    return [{ id: `current-${currentName}`, companyName: currentName }, ...normalizedSuppliers];
  }

  return normalizedSuppliers;
}

export function buildSupplierFilterOptions(purchases, suppliers = []) {
  const optionMap = new Map();

  normalizeSupplierOptions(suppliers).forEach((supplier) => {
    optionMap.set(supplier.companyName.toLowerCase(), supplier);
  });

  purchases.forEach((purchase) => {
    const companyName = `${purchase.supplier_name ?? ""}`.trim();

    if (companyName) {
      optionMap.set(companyName.toLowerCase(), {
        id: `purchase-supplier-${companyName}`,
        companyName,
      });
    }
  });

  return [...optionMap.values()].sort((a, b) =>
    a.companyName.localeCompare(b.companyName)
  );
}

export function buildProductFilterOptions(products = []) {
  return products
    .map((product) => {
      const name = `${product.product_name ?? product.productName ?? ""}`.trim();
      const sku = `${product.sku ?? ""}`.trim();
      const label = sku ? `${name || sku} (${sku})` : name || `${product.id ?? ""}`;

      return { id: `${product.id ?? ""}`, label };
    })
    .filter((option) => option.id && option.label)
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function transactionMatchesDateRange(transactionDate, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) {
    return true;
  }

  if (!transactionDate) {
    return false;
  }

  if (dateFrom && transactionDate < dateFrom) {
    return false;
  }

  if (dateTo && transactionDate > dateTo) {
    return false;
  }

  return true;
}

export function sortRecentTransactions(a, b) {
  const dateCompare = `${b.transaction_date || ""}`.localeCompare(`${a.transaction_date || ""}`);

  if (dateCompare !== 0) {
    return dateCompare;
  }

  return (Number(b.id) || 0) - (Number(a.id) || 0);
}

export function getBillDiscountValue(transaction) {
  return Math.min(
    100,
    Math.max(0, Number(transaction?.bill_discount ?? transaction?.billDiscount ?? 0) || 0)
  );
}

export function renderBillDiscount(transaction) {
  const discount = getBillDiscountValue(transaction);
  return discount > 0 ? `${discount}%` : "—";
}

export function computeAmount(item, transaction = null) {
  const qty = Number(item.quantity) || 0;
  const cost = Number(item.unit_cost) || 0;
  const multiplier = (item.discounts || []).reduce((acc, discount) => {
    const clamped = Math.min(100, Math.max(0, Number(discount) || 0));
    return acc * (1 - clamped / 100);
  }, 1);

  return qty * cost * multiplier * (1 - getBillDiscountValue(transaction) / 100);
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

export function getPurchaseItemRemovalMessage(purchase, item, itemIndex, t) {
  const displayStatus = getPurchaseItemDisplayStatus(item, purchase.status);
  const quantity = `${item.quantity || 0} ${item.unit || ""}`.trim();
  const baseQuantity = item.base_quantity
    ? ` (${item.base_quantity} ${item.base_unit || item.unit || t("purchaseForm.baseUnits")})`
    : "";
  const impact =
    displayStatus === "received"
      ? t("purchaseForm.removeImpactReceived")
      : t("purchaseForm.removeImpactPending");

  return [
    t("purchaseForm.removeConfirmTitle", {
      index: itemIndex + 1,
      ref: purchase.reference_no || t("purchaseForm.thisPurchase"),
    }),
    "",
    `${t("purchaseForm.removeProduct")} ${item.product_name || t("purchaseForm.unnamedItem")}`,
    `${t("purchaseForm.removeSKU")} ${item.sku || "—"}`,
    `${t("purchaseForm.removeQuantity")} ${quantity || "—"}${baseQuantity}`,
    `${t("purchaseForm.removeStatus")} ${getStatusLabel(t, displayStatus)}`,
    `${t("purchaseForm.removeExpectedDelivery")} ${formatDate(item.expected_delivery_date)}`,
    `${t("purchaseForm.removeReceivedDate")} ${formatDate(item.received_date)}`,
    `${t("purchaseForm.removeLineAmount")} ${fmt(computeAmount(item, purchase))}`,
    "",
    impact,
    t("purchaseForm.removeCannotUndo"),
  ].join("\n");
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

export function getProductName(product) {
  return (
    product.name ||
    product.productName ||
    product.product_name ||
    product.sku ||
    `${product?.id || ""}`.trim()
  );
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

export function findProductForItem(item, products = []) {
  if (item.product_id) {
    const matchedById = products.find((product) => `${product.id}` === `${item.product_id}`);

    if (matchedById) {
      return matchedById;
    }
  }

  const sku = `${item.sku ?? ""}`.trim().toLowerCase();

  if (sku) {
    const matchedBySku = products.find(
      (product) => getProductSku(product).toLowerCase() === sku
    );

    if (matchedBySku) {
      return matchedBySku;
    }
  }

  const productName = `${item.product_name ?? ""}`.trim().toLowerCase();

  return products.find((product) => getProductName(product).toLowerCase() === productName);
}

export function getPurchaseProductQuery(productName, sku) {
  return sku ? `${productName} (${sku})` : productName;
}

export function createEditItems(purchase, products = []) {
  const sourceItems = purchase.items?.length ? purchase.items : [];

  if (!sourceItems.length) {
    return [
      {
        id: `purchase-${purchase.id}-item-new`,
        product_id: "",
        product_query: "",
        product_name: "",
        sku: "",
        unit: "pcs",
        base_unit: "pcs",
        conversion_factor: 1,
        base_quantity: 1,
        expected_delivery_date: "",
        item_status: getInitialPurchaseItemStatus(purchase.status),
        received_date: "",
        quantity: 1,
        unit_cost: "",
        discounts: [0],
      },
    ];
  }

  return sourceItems.map((item, index) => {
    const selectedProduct = findProductForItem(item, products);
    const productName = selectedProduct ? getProductName(selectedProduct) : item.product_name || "";
    const sku = selectedProduct ? getProductSku(selectedProduct) : item.sku || "";

    return {
      id: item.id || `purchase-${purchase.id}-item-${index}`,
      product_id: selectedProduct?.id || item.product_id || "",
      product_query: getPurchaseProductQuery(productName, sku),
      product_name: productName,
      sku,
      unit: item.unit || "pcs",
      expected_delivery_date: item.expected_delivery_date || "",
      item_status: getStoredPurchaseItemStatus(item, purchase.status),
      received_date: item.received_date || "",
      quantity: item.quantity ?? 1,
      unit_cost: item.unit_cost ?? "",
      base_unit: item.base_unit || item.unit || "pcs",
      conversion_factor: item.conversion_factor || 1,
      base_quantity: item.base_quantity ?? item.quantity ?? 1,
      discounts: Array.isArray(item.discounts)
        ? item.discounts
        : Number(item.discount) > 0
          ? [item.discount]
          : [0],
    };
  });
}

export function createEditForm(purchase) {
  return {
    reference_no: purchase.reference_no || "",
    supplier_name: purchase.supplier_name || "",
    supplier_tax_invoice: purchase.supplier_tax_invoice || "",
    status: purchase.status || "ordered",
    transaction_date: purchase.transaction_date || getToday(),
    note: purchase.note || "",
    new_documents: [],
    remove_document_ids: [],
    remove_document: false,
  };
}
