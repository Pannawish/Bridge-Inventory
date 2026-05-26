import { getItemBaseQuantity } from "../../unitConversion";
import { formatMoney as fmt, formatNumber } from "../../format";
import { getStoredPurchaseItemStatus } from "../../purchaseStatus";

const VAT_RATE = 0.07;

export function formatCurrency(value) {
  return fmt(value);
}

function applyBillDiscount(amount, transaction) {
  const billDiscount = Math.min(
    100,
    Math.max(0, Number(transaction?.bill_discount ?? transaction?.billDiscount ?? 0) || 0)
  );

  return amount * (1 - billDiscount / 100);
}

export function computeItemAmount(item, transaction = null) {
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
    return applyBillDiscount(qty * price * multiplier, transaction);
  }

  const discount = Math.min(100, Math.max(0, Number(item.discount) || 0));
  return applyBillDiscount(qty * price * (1 - discount / 100), transaction);
}

export function computePurchaseBaseUnitCostBeforeDiscount(item) {
  const unitCost = Number(item.unit_cost);
  if (!Number.isFinite(unitCost)) {
    return null;
  }

  const quantity = Number(item.quantity) || 0;
  const baseQuantity = getItemBaseQuantity(item);
  const conversionFactor = Number(item.conversion_factor ?? item.conversionFactor);
  const resolvedFactor =
    Number.isFinite(conversionFactor) && conversionFactor > 0
      ? conversionFactor
      : quantity > 0 && baseQuantity > 0
        ? baseQuantity / quantity
        : 1;

  return unitCost / resolvedFactor;
}

export function computePurchaseBaseUnitCostAfterDiscount(item, transaction = null) {
  const baseQuantity = getItemBaseQuantity(item);
  if (baseQuantity <= 0) {
    return null;
  }

  return computeItemAmount(item, transaction) / baseQuantity;
}

export function formatOptionalCurrency(value) {
  return value === null || value === undefined || !Number.isFinite(Number(value))
    ? "—"
    : formatCurrency(value);
}

export function renderDiscounts(item) {
  if (Array.isArray(item.discounts)) {
    const active = item.discounts.filter((discount) => Number(discount) > 0);
    if (active.length > 0) {
      return active.map((discount) => `${Number(discount)}%`).join("|");
    }
    return "—";
  }

  if (Number(item.discount) > 0) {
    return `${Number(item.discount)}%`;
  }

  return "—";
}

export function renderBillDiscount(transaction) {
  const discount = Number(transaction?.bill_discount ?? transaction?.billDiscount ?? 0);

  if (discount > 0) {
    return `${discount}%`;
  }

  return "—";
}

function normalizeLookupValue(value) {
  return `${value ?? ""}`.trim().toLowerCase();
}

function getProductSearchNames(product) {
  const mainName = `${
    product?.name ?? product?.productName ?? product?.product_name ?? ""
  }`.trim();
  const subNames = Array.isArray(product?.subNames)
    ? product.subNames
    : Array.isArray(product?.sub_names)
      ? product.sub_names
      : [];

  return [mainName, ...subNames]
    .map((name) => `${name ?? ""}`.trim())
    .filter(
      (name, index, names) =>
        name && names.findIndex((item) => item.toLowerCase() === name.toLowerCase()) === index
    );
}

export function findProductForItem(products = [], item = {}) {
  const itemProductId = normalizeLookupValue(item.product_id ?? item.productId);
  const itemSku = normalizeLookupValue(item.sku);
  const itemName = normalizeLookupValue(item.product_name ?? item.productName ?? item.name);

  return (
    products.find((product) => {
      const productId = normalizeLookupValue(product.id);
      const productSku = normalizeLookupValue(product.sku ?? product.SKU);
      const productNames = getProductSearchNames(product).map(normalizeLookupValue);

      return (
        (itemProductId && productId === itemProductId) ||
        (itemSku && productSku === itemSku) ||
        (itemName && productNames.includes(itemName))
      );
    }) || null
  );
}

export function getItemStatusOptions(editableStatuses, currentStatus) {
  if (!currentStatus || editableStatuses.includes(currentStatus)) {
    return editableStatuses;
  }

  return [currentStatus, ...editableStatuses];
}

export function getItemCount(items = []) {
  return formatNumber(items.length);
}

export function getDocumentName(documentUrl = "", t = null) {
  const [path = ""] = `${documentUrl}`.split("?");
  const name = path.split("/").filter(Boolean).pop();
  const fallback = t ? t("transactionTable.attachedDocument") : "Attached document";
  return name ? decodeURIComponent(name) : fallback;
}

export function getTransactionDocuments(row = {}, t = null) {
  if (Array.isArray(row.documents) && row.documents.length) {
    return row.documents;
  }

  return row.document_url
    ? [
        {
          id: "__legacy_document__",
          name: getDocumentName(row.document_url, t),
          url: row.document_url,
        },
      ]
    : [];
}

export function getVatSummary(row) {
  const itemTotal = (row.items || []).reduce(
    (sum, item) => sum + computeItemAmount(item, row),
    0
  );

  if (row.vat_mode === "included") {
    const subtotal = itemTotal / (1 + VAT_RATE);
    const vat = itemTotal - subtotal;
    return { subtotal, vat, grandTotal: itemTotal };
  }

  if (row.vat_mode === "none") {
    return { subtotal: itemTotal, vat: 0, grandTotal: itemTotal };
  }

  const vat = itemTotal * VAT_RATE;
  return { subtotal: itemTotal, vat, grandTotal: itemTotal + vat };
}

export function getPurchasePayableSummary(row) {
  const { grandTotal } = getVatSummary(row);
  const items = row.items || [];

  let fullBase = 0;
  let payableBase = 0;
  let cancelledCount = 0;
  items.forEach((item) => {
    const amount = computeItemAmount(item, row);
    fullBase += amount;
    if (getStoredPurchaseItemStatus(item, row.status) === "cancelled") {
      cancelledCount += 1;
    } else {
      payableBase += amount;
    }
  });

  const payable = fullBase > 0 ? grandTotal * (payableBase / fullBase) : grandTotal;
  const cancelled = grandTotal - payable;

  return {
    grandTotal,
    payable,
    cancelled,
    cancelledCount,
    hasCancelledValue: cancelledCount > 0 && cancelled > 0.005,
  };
}

export function getRowGrandTotal(row, type) {
  const storedGrandTotal = Number(row.grand_total);

  if (Number.isFinite(storedGrandTotal) && storedGrandTotal > 0) {
    return storedGrandTotal;
  }

  if (type === "purchase") {
    const totalAmount = Number(row.total_amount);

    if (Number.isFinite(totalAmount) && totalAmount > 0) {
      return totalAmount;
    }
  }

  return getVatSummary(row).grandTotal;
}
