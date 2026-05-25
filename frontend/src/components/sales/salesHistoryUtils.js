import { computePaymentDate, formatMoney as fmt } from "../../format";
import { getStatusLabel } from "../../i18n/statusLabels";
import {
  getStoredSaleItemStatus,
  saleStatuses,
} from "../../saleStatus";
import { getProductDefaultSalesUnit } from "../../unitConversion";

const VAT_RATE = 0.07;

export const statusOptions = saleStatuses;
export const saleStatusPresets = [
  { labelKey: "salesHistory.presetAll", statuses: statusOptions },
  {
    labelKey: "salesHistory.presetOpen",
    statuses: [
      "draft",
      "partially_packed",
      "packed",
      "partially_shipped",
      "shipped",
      "partially_delivered",
    ],
  },
  { labelKey: "salesHistory.filterDelivered", statuses: ["delivered"] },
  { labelKey: "salesHistory.presetCancelledReturned", statuses: ["cancelled", "returned"] },
];
export const vatOptionValues = ["included", "not_included"];
export const defaultCustomerOptions = [];

export function getToday() {
  return new Date().toISOString().split("T")[0];
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

export function getTransactionDocuments(sale, t = null) {
  if (Array.isArray(sale.documents) && sale.documents.length) {
    return sale.documents;
  }

  return sale.document_url
    ? [
        {
          id: "__legacy_document__",
          name: getDocumentName(sale.document_url, t),
          url: sale.document_url,
        },
      ]
    : [];
}

function normalize(value) {
  return `${value ?? ""}`.toLowerCase();
}

export function saleMatchesQuery(sale, query) {
  const searchableText = [
    sale.reference_no,
    sale.customer_name,
    sale.status,
    sale.transaction_date,
    sale.payment_date,
    sale.payment_term_type,
    sale.payment_term_days,
    sale.customer_po_reference,
    sale.note,
    ...(sale.items || []).flatMap((item) => [
      item.product_name,
      item.sku,
      item.unit,
      item.base_unit,
      item.category,
      item.item_status,
      item.shipped_date,
      item.delivered_date,
      item.quantity,
      item.unit_price,
    ]),
  ]
    .map(normalize)
    .join(" ");

  return searchableText.includes(query);
}

export function normalizeCustomerOptions(customers = [], currentCustomerName = "") {
  const normalizedCustomers = customers
    .map((customer) => ({
      id: customer.id || customer.companyName,
      companyName: `${customer.companyName ?? customer.name ?? ""}`.trim(),
    }))
    .filter((customer) => customer.companyName);
  const currentName = currentCustomerName.trim();

  if (
    currentName &&
    !normalizedCustomers.some(
      (customer) => customer.companyName.toLowerCase() === currentName.toLowerCase()
    )
  ) {
    return [{ id: `current-${currentName}`, companyName: currentName }, ...normalizedCustomers];
  }

  return normalizedCustomers;
}

export function buildCustomerFilterOptions(sales, customers = []) {
  const optionMap = new Map();

  normalizeCustomerOptions(customers).forEach((customer) => {
    optionMap.set(customer.companyName.toLowerCase(), customer);
  });

  sales.forEach((sale) => {
    const companyName = `${sale.customer_name ?? ""}`.trim();

    if (companyName) {
      optionMap.set(companyName.toLowerCase(), {
        id: `sale-customer-${companyName}`,
        companyName,
      });
    }
  });

  return [...optionMap.values()].sort((a, b) =>
    a.companyName.localeCompare(b.companyName)
  );
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
  const price = Number(item.unit_price) || 0;
  const multiplier = (item.discounts || []).reduce((acc, discount) => {
    const clamped = Math.min(100, Math.max(0, Number(discount) || 0));
    return acc * (1 - clamped / 100);
  }, 1);

  return qty * price * multiplier * (1 - getBillDiscountValue(transaction) / 100);
}

export function getSalesItemRemovalMessage(sale, item, itemIndex, t) {
  const itemStatus = getStoredSaleItemStatus(item, sale.status);
  const quantity = `${item.quantity || 0} ${item.unit || ""}`.trim();
  const baseQuantity = item.base_quantity
    ? ` (${item.base_quantity} ${item.base_unit || item.unit || t("salesForm.baseUnits")})`
    : "";
  const committedStatuses = new Set(["packed", "shipped", "delivered"]);
  const impact = committedStatuses.has(itemStatus)
    ? t("salesForm.removeImpactCommitted")
    : t("salesForm.removeImpactPending");

  return [
    t("salesForm.removeConfirmTitle", { index: itemIndex + 1, ref: sale.reference_no || t("salesForm.thisSale") }),
    "",
    `${t("salesForm.removeProduct")} ${item.product_name || t("salesForm.unnamedItem")}`,
    `${t("salesForm.removeSKU")} ${item.sku || "—"}`,
    `${t("salesForm.removeQuantity")} ${quantity || "—"}${baseQuantity}`,
    `${t("salesForm.removeStatus")} ${getStatusLabel(t, itemStatus)}`,
    `${t("salesForm.removeShippedDate")} ${item.shipped_date || "—"}`,
    `${t("salesForm.removeDeliveredDate")} ${item.delivered_date || "—"}`,
    `${t("salesForm.removeLineAmount")} ${fmt(computeAmount(item, sale))}`,
    "",
    impact,
    t("salesForm.removeCannotUndo"),
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
  return product.name || product.productName || product.product_name || product.sku || `${product?.id || ""}`.trim();
}

export function getProductSku(product) {
  return product.sku || product.SKU || "";
}

export function getProductUnit(product) {
  return getProductDefaultSalesUnit(product);
}

export function findProductForSaleItem(item, products = []) {
  if (item.product_id) {
    const matchedProduct = products.find(
      (product) => `${product.id}` === `${item.product_id}`
    );

    if (matchedProduct) {
      return matchedProduct;
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

export function createProductValueFromItem(item, products) {
  const matchedProduct = findProductForSaleItem(item, products);

  if (matchedProduct) {
    return `id:${matchedProduct.id}`;
  }

  return item.product_name ? `name:${item.product_name}` : "";
}

export function buildProductOptions(products, items) {
  const options = products.map((product) => ({
    value: `id:${product.id}`,
    id: product.id,
    name: getProductName(product),
    sku: getProductSku(product),
  }));

  items.forEach((item) => {
    const name = `${item.product_name ?? ""}`.trim();

    if (
      name &&
      !options.some((option) => option.name.toLowerCase() === name.toLowerCase())
    ) {
      options.push({
        value: `name:${name}`,
        id: "",
        name,
        sku: item.sku || "",
      });
    }
  });

  return options;
}

export function createEditItems(sale, products) {
  const sourceItems = sale.items?.length ? sale.items : [];

  if (!sourceItems.length) {
    return [
      {
        id: `sale-${sale.id}-item-new`,
        product_value: "",
        product_id: "",
        product_name: "",
        sku: "",
        unit: "pcs",
        base_unit: "pcs",
        conversion_factor: 1,
        base_quantity: 1,
        item_status: getStoredSaleItemStatus({}, sale.status),
        shipped_date: "",
        delivered_date: "",
        quantity: 1,
        unit_price: "",
        discounts: [0],
      },
    ];
  }

  return sourceItems.map((item, index) => {
    const selectedProduct = findProductForSaleItem(item, products);

    return {
      id: item.id || `sale-${sale.id}-item-${index}`,
      product_value: createProductValueFromItem(item, products),
      product_id: selectedProduct?.id || item.product_id || "",
      product_name: selectedProduct ? getProductName(selectedProduct) : item.product_name || "",
      sku: selectedProduct ? getProductSku(selectedProduct) : item.sku || "",
      unit: item.unit || item.base_unit || "pcs",
      base_unit: item.base_unit || item.unit || "pcs",
      conversion_factor: item.conversion_factor || 1,
      base_quantity: item.base_quantity ?? item.quantity ?? 1,
      item_status: getStoredSaleItemStatus(item, sale.status),
      shipped_date: item.shipped_date || "",
      delivered_date: item.delivered_date || "",
      quantity: item.quantity ?? 1,
      unit_price: item.unit_price ?? "",
      discounts: Array.isArray(item.discounts)
        ? item.discounts
        : Number(item.discount) > 0
          ? [item.discount]
          : [0],
    };
  });
}

export function createEditForm(sale) {
  return {
    reference_no: sale.reference_no || "",
    customer_name: sale.customer_name || "",
    customer_po_reference: sale.customer_po_reference || "",
    status: sale.status || "draft",
    payment_term_type: sale.payment_term_type || "",
    payment_term_days: sale.payment_term_days || "",
    transaction_date: sale.transaction_date || getToday(),
    note: sale.note || "",
    new_documents: [],
    remove_document_ids: [],
    remove_document: false,
  };
}

export function getComputedPaymentDate(form) {
  return computePaymentDate(
    form.transaction_date,
    form.payment_term_type,
    form.payment_term_days
  );
}
