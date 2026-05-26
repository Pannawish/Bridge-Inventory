import {
  computeDiscountedAmount,
  getEffectiveDiscounts,
} from "../transactionDiscounts";
import { getProductDefaultSalesUnit } from "../../unitConversion";

const VAT_RATE = 0.07;

export const vatOptionValues = ["included", "not_included"];
export const defaultCustomerOptions = [];

export function getToday() {
  return new Date().toISOString().split("T")[0];
}

function getSalesReferencePrefix(date = new Date()) {
  const buddhistYear = date.getFullYear() + 543;
  const yearSuffix = `${buddhistYear}`.slice(-2);
  const month = `${date.getMonth() + 1}`.padStart(2, "0");

  return `TI-${yearSuffix}${month}`;
}

export function getNextSalesReference(sales = [], date = new Date()) {
  const prefix = getSalesReferencePrefix(date);
  const referencePattern = new RegExp(`^${prefix}-(\\d+)$`);
  const maxSerial = sales.reduce((max, sale) => {
    const match = `${sale.reference_no || ""}`.match(referencePattern);

    if (!match) {
      return max;
    }

    return Math.max(max, Number(match[1]));
  }, 0);
  const nextSerial = maxSerial + 1;

  return `${prefix}-${`${nextSerial}`.padStart(3, "0")}`;
}

export function getNextSalesReferenceAfter(referenceNo, date = new Date()) {
  const prefix = getSalesReferencePrefix(date);
  const match = `${referenceNo || ""}`.match(new RegExp(`^${prefix}-(\\d+)$`));

  if (!match) {
    return getNextSalesReference([], date);
  }

  const nextSerial = Number(match[1]) + 1;
  return `${prefix}-${`${nextSerial}`.padStart(3, "0")}`;
}

export function createInitialForm(referenceNo, prefill = {}) {
  return {
    reference_no: referenceNo,
    customer_name: prefill.customer_name || "",
    customer_po_reference: prefill.customer_po_reference || "",
    status: "draft",
    transaction_date: prefill.transaction_date || prefill.quotation_date || getToday(),
    note: prefill.note || "",
    documents: [],
    payment_term_type: prefill.payment_term_type || "",
    payment_term_days: prefill.payment_term_days || "",
  };
}

export function emptyItem() {
  return {
    line_id: `sales-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    product_id: "",
    product_query: "",
    product_name: "",
    sku: "",
    item_status: "pending",
    shipped_date: "",
    delivered_date: "",
    unit: "pcs",
    quantity: 1,
    unit_price: "",
    supplier_name: "",
    unit_cost: "",
    allocation_purchase_item_id: "",
    discounts: [""],
  };
}

export function createInitialItems(prefill = {}) {
  const sourceItems = Array.isArray(prefill.items) ? prefill.items : [];

  if (!sourceItems.length) {
    return [emptyItem()];
  }

  return sourceItems.map((item, index) => ({
    ...emptyItem(),
    line_id: `sales-prefill-${Date.now()}-${index}`,
    product_id: item.product_id || item.productId || "",
    product_query: item.sku
      ? `${item.product_name || item.productName || item.name || ""} (${item.sku || item.SKU})`
      : item.product_name || item.productName || item.name || "",
    product_name: item.product_name || item.productName || item.name || "",
    sku: item.sku || item.SKU || "",
    unit: item.unit || "pcs",
    quantity: item.quantity ?? 1,
    unit_price: item.unit_price ?? item.sale_price ?? "",
    supplier_name: item.supplier_name || "",
    unit_cost: item.unit_cost ?? item.cost_price ?? "",
    allocation_purchase_item_id:
      item.allocation_purchase_item_id ||
      item.allocationPurchaseItemId ||
      (Array.isArray(item.allocations) && item.allocations.length === 1
        ? item.allocations[0].purchase_item_id
        : ""),
    discounts: Array.isArray(item.discounts)
      ? item.discounts
      : Number(item.discount) > 0
        ? [item.discount]
        : [""],
  }));
}

export function computeAmount(item, transactionDiscount = null) {
  return computeDiscountedAmount(
    item.quantity,
    item.unit_price,
    getEffectiveDiscounts(item.discounts, transactionDiscount)
  );
}

export function getLatestSupplierCost(purchases, productId, supplierName) {
  if (!productId || !supplierName) {
    return null;
  }

  const wantSupplier = `${supplierName}`.trim().toLowerCase();
  let best = null;
  (purchases || []).forEach((purchase) => {
    if (purchase.status === "cancelled") {
      return;
    }
    if (`${purchase.supplier_name ?? ""}`.trim().toLowerCase() !== wantSupplier) {
      return;
    }

    const date = `${purchase.transaction_date ?? ""}`;
    (purchase.items || []).forEach((purchaseItem) => {
      const pid = `${purchaseItem.product_id ?? purchaseItem.productId ?? ""}`;
      if (pid !== `${productId}`) {
        return;
      }

      const cost = Number(purchaseItem.unit_cost);
      if (!Number.isFinite(cost) || cost <= 0) {
        return;
      }

      if (!best || date > best.date) {
        best = { date, cost };
      }
    });
  });

  return best ? best.cost : null;
}

export function getLineLoss(item, transactionDiscount = null) {
  const quantity = Number(item.quantity) || 0;
  const unitCost = Number(item.unit_cost) || 0;

  if (quantity <= 0 || unitCost <= 0 || !item.unit_price) {
    return 0;
  }

  const amount = computeAmount(item, transactionDiscount);
  const lineCost = unitCost * quantity;
  return amount < lineCost ? lineCost - amount : 0;
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
  return getProductDefaultSalesUnit(product);
}

export function getCustomerPaymentTerms(customer) {
  const paymentTermType = customer?.termType || "";
  const paymentTermDays =
    paymentTermType === "credit" ? customer?.billingNoteDate || "" : "";

  return {
    payment_term_type: paymentTermType,
    payment_term_days: paymentTermDays,
  };
}

export function showStockAlert(message) {
  if (message && typeof window !== "undefined") {
    window.alert(message);
  }
}

export function getFilteredCustomers(customers, customerQuery) {
  const normalizedQuery = customerQuery.trim().toLowerCase();

  if (!normalizedQuery) {
    return customers;
  }

  return customers.filter((customer) =>
    customer.companyName.toLowerCase().includes(normalizedQuery)
  );
}

export function getSupplierNameOptions(suppliers = []) {
  return Array.from(
    new Set(
      (suppliers || [])
        .map((supplier) => `${supplier.companyName ?? supplier.name ?? ""}`.trim())
        .filter(Boolean)
    )
  ).sort((left, right) => left.localeCompare(right));
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
