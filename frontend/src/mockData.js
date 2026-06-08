import { getDefaultProducts } from "./components/products/defaultProducts";
import { getDefaultSuppliers } from "./components/suppliers/supplierUtils";
import { getDefaultCustomers } from "./components/customers/customerUtils";

const DAY_MS = 24 * 60 * 60 * 1000;
const VAT_RATE = 0.07;
const TODAY = parseDate("2026-05-28");

const products = getDefaultProducts();
const suppliers = getDefaultSuppliers();
const customers = getDefaultCustomers();

const PRODUCT_CONFIG = {
  "product-1": { baseCost: 18, salePrice: 28, reorderLevel: 160, weeklyDemand: 16 },
  "product-2": { baseCost: 5.5, salePrice: 7.8, reorderLevel: 120, weeklyDemand: 22 },
  "product-3": { baseCost: 48, salePrice: 70, reorderLevel: 12, weeklyDemand: 4 },
  "product-4": { baseCost: 20, salePrice: 35, reorderLevel: 48, weeklyDemand: 10 },
  "product-5": { baseCost: 14, salePrice: 22, reorderLevel: 36, weeklyDemand: 8 },
  "product-6": { baseCost: 8.1, salePrice: 16, reorderLevel: 90, weeklyDemand: 12 },
  "product-7": { baseCost: 9.5, salePrice: 22, reorderLevel: 35, weeklyDemand: 6 },
  "product-8": { baseCost: 38.3, salePrice: 42, reorderLevel: 20, weeklyDemand: 5 },
  "product-9": { baseCost: 60, salePrice: 118, reorderLevel: 18, weeklyDemand: 3 },
  "product-10": { baseCost: 17.5, salePrice: 25, reorderLevel: 40, weeklyDemand: 7 },
};

const SALE_ACTIVE_STOCK_STATUSES = new Set(["packed", "shipped", "delivered"]);
const SALE_CANCELLED_OR_RETURNED_STATUSES = new Set(["cancelled", "returned"]);
const DASHBOARD_STOCK_DEDUCT_STATUSES = new Set(["packed", "shipped", "delivered", "returned"]);

function parseDate(value) {
  const [year, month, day] = `${value}`.split("-").map(Number);
  return new Date(Date.UTC(year, (month || 1) - 1, day || 1));
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function diffDays(fromDate, toDate) {
  return Math.max(0, Math.round((toDate.getTime() - fromDate.getTime()) / DAY_MS));
}

function clampDate(date, latestDate = TODAY) {
  return date.getTime() > latestDate.getTime() ? latestDate : date;
}

function money(value) {
  return Number(Number(value || 0).toFixed(2));
}

function sum(values = []) {
  return values.reduce((total, value) => total + Number(value || 0), 0);
}

function applyDiscounts(amount, discounts = []) {
  return discounts.reduce(
    (total, discount) => total * (1 - Number(discount || 0) / 100),
    Number(amount || 0)
  );
}

function computeAmount(quantity, unitPrice, discounts = []) {
  return money(applyDiscounts(Number(quantity || 0) * Number(unitPrice || 0), discounts));
}

function computeTotals(lineAmounts, vatMode, billDiscount = 0) {
  const discountedSubtotal = applyDiscounts(sum(lineAmounts), billDiscount ? [billDiscount] : []);

  if (vatMode === "included") {
    const grandTotal = money(discountedSubtotal);
    const totalBeforeVat = money(grandTotal / (1 + VAT_RATE));
    const vatAmount = money(grandTotal - totalBeforeVat);
    return {
      total_before_vat: totalBeforeVat,
      vat_amount: vatAmount,
      grand_total: grandTotal,
    };
  }

  if (vatMode === "none") {
    const totalBeforeVat = money(discountedSubtotal);
    return {
      total_before_vat: totalBeforeVat,
      vat_amount: 0,
      grand_total: totalBeforeVat,
    };
  }

  const totalBeforeVat = money(discountedSubtotal);
  const vatAmount = money(totalBeforeVat * VAT_RATE);
  return {
    total_before_vat: totalBeforeVat,
    vat_amount: vatAmount,
    grand_total: money(totalBeforeVat + vatAmount),
  };
}

function createRng(seed) {
  let state = seed >>> 0;
  return function rng() {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

function maybe(rng, probability = 0.5) {
  return rng() < probability;
}

function shuffle(rng, list) {
  const rows = [...list];
  for (let index = rows.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [rows[index], rows[swapIndex]] = [rows[swapIndex], rows[index]];
  }
  return rows;
}

function sample(rng, list, count, excludedIds = new Set()) {
  const filtered = list.filter((entry) => !excludedIds.has(entry.id));
  const source = filtered.length >= count ? filtered : list;
  return shuffle(rng, source).slice(0, count);
}

function parseCreditDays(value) {
  const digits = `${value || ""}`.replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}

function getThaiYearMonth(date) {
  return `${date.getUTCFullYear() + 543}`.slice(-2) + String(date.getUTCMonth() + 1).padStart(2, "0");
}

function createReferenceBuilder() {
  const counters = new Map();

  return function buildReference(prefix, date) {
    const yearMonth = getThaiYearMonth(date);
    const key = `${prefix}-${yearMonth}`;
    const nextValue = (counters.get(key) || 0) + 1;
    counters.set(key, nextValue);
    return `${prefix}-${yearMonth}-${String(nextValue).padStart(3, "0")}`;
  };
}

function buildNextReferenceNo(rows, prefix) {
  const currentYearMonth = getThaiYearMonth(TODAY);
  const pattern = new RegExp(`^${prefix}-${currentYearMonth}-(\\d+)$`);
  const maxSerial = (rows || []).reduce((largest, row) => {
    const match = `${row.reference_no || ""}`.match(pattern);
    return match ? Math.max(largest, Number(match[1])) : largest;
  }, 0);
  return `${prefix}-${currentYearMonth}-${String(maxSerial + 1).padStart(3, "0")}`;
}

function sortByDateDescending(rows, dateKey) {
  return [...rows].sort((left, right) => {
    const leftKey = `${left[dateKey] || ""}|${left.reference_no || ""}`;
    const rightKey = `${right[dateKey] || ""}|${right.reference_no || ""}`;
    return rightKey.localeCompare(leftKey);
  });
}

function getProductName(product) {
  return product.productName || product.product_name || product.name || product.sku || "";
}

function getProductConfig(productId) {
  return PRODUCT_CONFIG[productId] || {
    baseCost: 10,
    salePrice: 15,
    reorderLevel: 24,
    weeklyDemand: 4,
  };
}

function chooseUnit(rng, product, forPurchase) {
  const allowedConversions = (product.unitConversions || []).filter((conversion) =>
    forPurchase ? conversion.allowPurchase : conversion.allowSale
  );
  const conversions = allowedConversions.length ? allowedConversions : product.unitConversions || [];
  const preferredUnit = forPurchase ? product.defaultPurchaseUnit : product.defaultSalesUnit;
  const preferred = conversions.find((conversion) => conversion.unit === preferredUnit);

  if (preferred && maybe(rng, 0.55)) {
    return preferred;
  }

  return pick(rng, conversions);
}

function getPurchaseQuantities(conversion) {
  return conversion.factorToBase > 50
    ? [1, 2, 3, 4, 5, 6]
    : [1, 2, 3, 4, 5, 6, 8, 10, 12];
}

function getSaleQuantities(conversion) {
  return conversion.factorToBase > 10
    ? [1, 2, 3, 4, 5, 6]
    : [1, 2, 3, 4, 5, 8, 10, 12, 20, 30];
}

function chooseDiscounts(rng, allowMultiple = true) {
  const roll = rng();
  if (roll < 0.5) {
    return [];
  }
  if (roll < 0.78) {
    return [pick(rng, [2, 3, 5, 7, 10, 12])];
  }
  if (allowMultiple) {
    return [pick(rng, [3, 5, 8]), pick(rng, [2, 4, 5])];
  }
  return [pick(rng, [5, 10])];
}

function getPaymentDate(transactionDate, termType, termDays) {
  if (termType === "cash") {
    return formatDate(transactionDate);
  }
  if (termType === "credit") {
    const days = parseCreditDays(termDays);
    return days ? formatDate(addDays(transactionDate, days)) : "";
  }
  return "";
}

function buildPurchaseNote(status, supplierName, index) {
  const noteByStatus = {
    draft: `Awaiting final confirmation from ${supplierName}.`,
    ordered: "Supplier confirmed the order; receiving is still pending.",
    partially_received: "First shipment received; remaining items are still open.",
    received: "Received and checked by warehouse team.",
    cancelled: "Cancelled after supplier could not meet delivery schedule.",
  };
  const suffixes = [
    "Includes converted units.",
    "Tax invoice to be reconciled.",
    "Price includes tier discount.",
    "Urgent replenishment.",
  ];
  return `${noteByStatus[status] || "Purchase in progress."} ${suffixes[index % suffixes.length]}`;
}

function buildSaleNote(status, customerName, index) {
  const noteByStatus = {
    draft: `Pending stock or customer approval from ${customerName}.`,
    partially_packed: "Warehouse has packed some lines; remaining lines are still pending.",
    packed: "Packed and ready for pickup or dispatch.",
    partially_shipped: "Some lines shipped while other lines remain packed.",
    shipped: "Shipment has left the warehouse.",
    partially_delivered: "One or more shipped lines are still waiting for proof of delivery.",
    delivered: "Delivered with completed delivery confirmation.",
    cancelled: "Cancelled before final delivery.",
    returned: "Returned after delivery and removed from active stock.",
  };
  const suffixes = [
    "Billing follows customer cycle.",
    "Includes line discounts.",
    "Mixed unit quantities.",
    "Urgent department request.",
  ];
  return `${noteByStatus[status] || "Sale in progress."} ${suffixes[index % suffixes.length]}`;
}

function buildBillingNoteNote(status, customerName) {
  const noteByStatus = {
    draft: "Draft billing note prepared for review.",
    issued: `Issued to ${customerName}; waiting for finance confirmation.`,
    partially_received: "Some invoices in this billing note have been received.",
    fully_received: "All invoices in this billing note have been received.",
    cancelled: "Cancelled after customer requested revised billing.",
  };
  return noteByStatus[status] || "";
}

function buildPaymentBatchNote(status, supplierName) {
  const noteByStatus = {
    draft: "Draft payment batch prepared for review.",
    scheduled: `Scheduled payment batch for ${supplierName}.`,
    partially_paid: "Some purchase invoices in this batch have been paid.",
    paid: "All purchase invoices in this batch have been paid.",
    cancelled: "Cancelled after supplier credit note review.",
  };
  return noteByStatus[status] || "";
}

function buildCreditNoteNote(status, customerName, saleReferenceNo) {
  if (status === "cancelled") {
    return `Cancelled credit note for ${customerName} on ${saleReferenceNo} after review.`;
  }
  return `Issued to align cancelled or returned sale lines for ${customerName} on ${saleReferenceNo}.`;
}

function getSaleItemStatuses(status, count) {
  if (status === "packed") {
    return Array.from({ length: count }, () => "packed");
  }
  if (status === "shipped") {
    return Array.from({ length: count }, () => "shipped");
  }
  if (status === "delivered") {
    return Array.from({ length: count }, () => "delivered");
  }
  if (status === "cancelled") {
    return Array.from({ length: count }, () => "cancelled");
  }
  if (status === "returned") {
    return Array.from({ length: count }, () => "returned");
  }
  if (status === "partially_packed") {
    return Array.from({ length: count }, (_, index) => (index % 2 === 0 ? "packed" : "pending"));
  }
  if (status === "partially_shipped") {
    return Array.from({ length: count }, (_, index) => (index % 3 === 0 ? "shipped" : "packed"));
  }
  if (status === "partially_delivered") {
    return Array.from({ length: count }, (_, index) =>
      index % 2 === 0 ? "delivered" : "shipped"
    );
  }
  return Array.from({ length: count }, () => "pending");
}

function maybeAddInactiveSaleLine(rng, saleStatus, itemStatuses) {
  if (
    itemStatuses.length < 2 ||
    saleStatus === "cancelled" ||
    saleStatus === "returned" ||
    !maybe(rng, 0.18)
  ) {
    return itemStatuses;
  }

  const nextStatuses = [...itemStatuses];
  const eligibleIndexes = nextStatuses
    .map((status, index) => ({ status, index }))
    .filter(({ status }) => !SALE_CANCELLED_OR_RETURNED_STATUSES.has(status))
    .map(({ index }) => index);

  if (!eligibleIndexes.length) {
    return nextStatuses;
  }

  const replaceIndex = pick(rng, eligibleIndexes);
  const useReturned =
    ["shipped", "partially_shipped", "delivered", "partially_delivered"].includes(saleStatus) &&
    maybe(rng, 0.6);
  nextStatuses[replaceIndex] = useReturned ? "returned" : "cancelled";
  return nextStatuses;
}

function getSaleStatusFromItemStatuses(itemStatuses, fallbackStatus = "draft") {
  if (!itemStatuses.length) {
    return fallbackStatus;
  }

  const activeStatuses = itemStatuses.filter((status) => !SALE_CANCELLED_OR_RETURNED_STATUSES.has(status));

  if (!activeStatuses.length) {
    return itemStatuses.includes("returned") ? "returned" : "cancelled";
  }

  if (activeStatuses.every((status) => status === "delivered")) {
    return "delivered";
  }
  if (activeStatuses.some((status) => status === "delivered")) {
    return "partially_delivered";
  }
  if (activeStatuses.every((status) => status === "shipped")) {
    return "shipped";
  }
  if (activeStatuses.some((status) => status === "shipped")) {
    return "partially_shipped";
  }
  if (activeStatuses.every((status) => status === "packed")) {
    return "packed";
  }
  if (activeStatuses.some((status) => status === "packed")) {
    return "partially_packed";
  }

  return "draft";
}

function buildPurchases(rng, buildReference) {
  const startDate = parseDate("2026-01-06");
  const statuses = shuffle(rng, [
    ...Array.from({ length: 34 }, () => "received"),
    ...Array.from({ length: 10 }, () => "partially_received"),
    ...Array.from({ length: 14 }, () => "ordered"),
    ...Array.from({ length: 8 }, () => "draft"),
    ...Array.from({ length: 6 }, () => "cancelled"),
  ]);
  const vatModes = ["not_included", "included", "none", "not_included", "not_included"];
  const daySpan = diffDays(startDate, TODAY);

  return statuses.map((status, index) => {
    const transactionDate = clampDate(
      addDays(startDate, Math.round((index * daySpan) / Math.max(1, statuses.length - 1)))
    );
    const supplier = suppliers[index % suppliers.length];
    const vatMode = vatModes[index % vatModes.length];
    const itemCount = pick(rng, [1, 2, 2, 3, 3, 4, 5]);
    const billDiscount = pick(rng, [0, 0, 0, 2, 3, 5]);
    const selectedProducts = sample(rng, products, itemCount);
    const referenceNo = buildReference("PO", transactionDate);
    const paymentTermType = supplier.termType || "";
    const paymentTermDays = paymentTermType === "credit" ? supplier.billingNoteDate || "" : "";

    const items = selectedProducts.map((product, lineIndex) => {
      const config = getProductConfig(product.id);
      const conversion = chooseUnit(rng, product, true);
      const quantity = pick(rng, getPurchaseQuantities(conversion));
      const unitCost = money(config.baseCost * conversion.factorToBase * (0.92 + rng() * 0.16));
      const discounts = chooseDiscounts(rng, true);
      const amount = computeAmount(quantity, unitCost, discounts);
      const expectedDeliveryDate = clampDate(
        addDays(transactionDate, pick(rng, [2, 3, 5, 7, 10, 14, 21]))
      );

      let itemStatus = "pending";
      let receivedDate = "";

      if (status === "received") {
        itemStatus = "received";
        receivedDate = formatDate(
          clampDate(addDays(expectedDeliveryDate, pick(rng, [-1, 0, 1, 2])))
        );
      } else if (status === "partially_received") {
        itemStatus = lineIndex <= Math.floor(itemCount / 2) ? "received" : "pending";
        receivedDate = itemStatus === "received" ? formatDate(expectedDeliveryDate) : "";
      } else if (status === "cancelled") {
        itemStatus = "cancelled";
      }

      return {
        id: (index + 1) * 100 + lineIndex + 1,
        product_id: product.id,
        product_name: getProductName(product),
        sku: product.sku,
        unit: conversion.unit,
        base_unit: product.stockBaseUnit,
        conversion_factor: conversion.factorToBase,
        quantity,
        base_quantity: quantity * conversion.factorToBase,
        unit_cost: unitCost,
        discounts,
        amount,
        expected_delivery_date: formatDate(expectedDeliveryDate),
        item_status: itemStatus,
        received_date: receivedDate,
        lead_time_days: diffDays(transactionDate, expectedDeliveryDate),
      };
    });

    const totals = computeTotals(
      items.map((item) => item.amount),
      vatMode,
      billDiscount
    );
    const payableBase = sum(
      items.filter((item) => item.item_status !== "cancelled").map((item) => item.amount)
    );
    const fullBase = sum(items.map((item) => item.amount));

    return {
      id: index + 1,
      reference_no: referenceNo,
      supplier_id: supplier.id,
      supplier_name: supplier.companyName,
      supplier_tax_invoice:
        status === "draft" || index % 11 === 0
          ? ""
          : `${supplier.taxpayerId.slice(-4)}-${formatDate(transactionDate).slice(2, 7).replace("-", "")}-${String(index + 1).padStart(4, "0")}`,
      status,
      transaction_date: formatDate(transactionDate),
      payment_term_type: paymentTermType,
      payment_term_days: paymentTermDays,
      payment_date: getPaymentDate(transactionDate, paymentTermType, paymentTermDays),
      note: buildPurchaseNote(status, supplier.companyName, index),
      vat_mode: vatMode,
      bill_discount: billDiscount,
      total_before_vat: totals.total_before_vat,
      vat_amount: totals.vat_amount,
      grand_total: totals.grand_total,
      total_amount: totals.grand_total,
      payable_total:
        fullBase <= 0 ? totals.grand_total : money(totals.grand_total * (payableBase / fullBase)),
      items,
      payment_batch_links: [],
      source_quotation_id: "",
      source_quotation_reference_no: "",
    };
  });
}

function buildInitialAvailableStock(purchases) {
  const stockByProductId = new Map(products.map((product) => [product.id, 0]));
  purchases.forEach((purchase) => {
    (purchase.items || []).forEach((item) => {
      if (item.item_status === "received") {
        stockByProductId.set(
          item.product_id,
          Number(stockByProductId.get(item.product_id) || 0) + Number(item.base_quantity || 0)
        );
      }
    });
  });
  return stockByProductId;
}

function buildSales(rng, buildReference, purchases) {
  const startDate = parseDate("2026-01-10");
  const statuses = shuffle(rng, [
    ...Array.from({ length: 38 }, () => "delivered"),
    ...Array.from({ length: 12 }, () => "shipped"),
    ...Array.from({ length: 12 }, () => "packed"),
    ...Array.from({ length: 8 }, () => "partially_delivered"),
    ...Array.from({ length: 8 }, () => "partially_shipped"),
    ...Array.from({ length: 6 }, () => "partially_packed"),
    ...Array.from({ length: 10 }, () => "draft"),
    ...Array.from({ length: 8 }, () => "cancelled"),
    ...Array.from({ length: 4 }, () => "returned"),
  ]);
  const vatModes = ["not_included", "included", "none", "not_included"];
  const daySpan = diffDays(startDate, TODAY);
  const availableStockByProductId = buildInitialAvailableStock(purchases);

  return statuses.map((status, index) => {
    const transactionDate = clampDate(
      addDays(startDate, Math.round((index * daySpan) / Math.max(1, statuses.length - 1)))
    );
    const customer = customers[index % customers.length];
    const vatMode = vatModes[index % vatModes.length];
    const itemCount = pick(rng, [1, 2, 2, 3, 3, 4]);
    const initialItemStatuses = getSaleItemStatuses(status, itemCount);
    const itemStatuses = maybeAddInactiveSaleLine(rng, status, initialItemStatuses);
    const paymentTermType = customer.termType || "";
    const paymentTermDays = paymentTermType === "credit" ? customer.billingNoteDate || "" : "";
    const billDiscount = pick(rng, [0, 0, 0, 2, 3, 5]);
    const usedProductIds = new Set();

    const items = itemStatuses.map((itemStatus, lineIndex) => {
      let resolvedStatus = itemStatus;
      let candidateProducts = products;

      if (SALE_ACTIVE_STOCK_STATUSES.has(resolvedStatus)) {
        candidateProducts = products.filter(
          (product) => Number(availableStockByProductId.get(product.id) || 0) > 0
        );
        if (usedProductIds.size && candidateProducts.length > 1) {
          const unusedCandidates = candidateProducts.filter(
            (product) => !usedProductIds.has(product.id)
          );
          if (unusedCandidates.length) {
            candidateProducts = unusedCandidates;
          }
        }
        if (!candidateProducts.length) {
          resolvedStatus = "pending";
          candidateProducts = products;
        }
      } else if (usedProductIds.size && products.length > 1) {
        const unusedProducts = products.filter((product) => !usedProductIds.has(product.id));
        if (unusedProducts.length) {
          candidateProducts = unusedProducts;
        }
      }

      const product = pick(rng, candidateProducts);
      const conversion = chooseUnit(rng, product, false);
      const quantityOptions = getSaleQuantities(conversion);
      let quantity = pick(rng, quantityOptions);

      if (SALE_ACTIVE_STOCK_STATUSES.has(resolvedStatus)) {
        const availableBaseQuantity = Number(availableStockByProductId.get(product.id) || 0);
        const maxQuantity = Math.floor(availableBaseQuantity / Number(conversion.factorToBase || 1));
        const allowedQuantities = quantityOptions.filter((value) => value <= maxQuantity);
        if (!allowedQuantities.length) {
          resolvedStatus = "pending";
          quantity = pick(rng, quantityOptions);
        } else {
          quantity = pick(rng, allowedQuantities);
        }
      }

      const config = getProductConfig(product.id);
      const unitPrice = money(config.salePrice * conversion.factorToBase * (0.96 + rng() * 0.16));
      const discounts = chooseDiscounts(rng, true);
      const amount = computeAmount(quantity, unitPrice, discounts);
      const supplier = pick(rng, suppliers);
      const effectiveUnitPrice = quantity ? amount / quantity : unitPrice;
      const unitCost =
        !SALE_CANCELLED_OR_RETURNED_STATUSES.has(resolvedStatus) && maybe(rng, 0.12)
          ? money(effectiveUnitPrice * (1.05 + rng() * 0.25))
          : money(config.baseCost * conversion.factorToBase * (0.8 + rng() * 0.17));

      let shippedDate = "";
      let deliveredDate = "";

      if (["shipped", "delivered", "returned"].includes(resolvedStatus)) {
        shippedDate = formatDate(addDays(transactionDate, pick(rng, [0, 1, 2])));
      }
      if (["delivered", "returned"].includes(resolvedStatus)) {
        deliveredDate = formatDate(addDays(parseDate(shippedDate || formatDate(transactionDate)), pick(rng, [0, 1, 2, 3])));
      }

      if (SALE_ACTIVE_STOCK_STATUSES.has(resolvedStatus)) {
        availableStockByProductId.set(
          product.id,
          Math.max(
            0,
            Number(availableStockByProductId.get(product.id) || 0) -
              quantity * Number(conversion.factorToBase || 1)
          )
        );
      }

      usedProductIds.add(product.id);

      return {
        id: (index + 1) * 100 + lineIndex + 1,
        product_id: product.id,
        product_name: getProductName(product),
        sku: product.sku,
        supplier_name: supplier.companyName,
        unit_cost: unitCost,
        item_status: resolvedStatus,
        shipped_date: shippedDate,
        delivered_date: deliveredDate,
        unit: conversion.unit,
        base_unit: product.stockBaseUnit,
        conversion_factor: conversion.factorToBase,
        quantity,
        base_quantity: quantity * conversion.factorToBase,
        unit_price: unitPrice,
        discounts,
        amount,
      };
    });

    const totals = computeTotals(
      items.map((item) => item.amount),
      vatMode,
      billDiscount
    );
    const finalStatus = getSaleStatusFromItemStatuses(
      items.map((item) => item.item_status),
      status
    );

    return {
      id: index + 1,
      reference_no: buildReference("TI", transactionDate),
      customer_id: customer.id,
      customer_name: customer.companyName,
      customer_po_reference:
        index % 3 === 0
          ? `CPO-${formatDate(transactionDate).slice(2, 7).replace("-", "")}-${String(index + 1).padStart(3, "0")}`
          : "",
      status: finalStatus,
      transaction_date: formatDate(transactionDate),
      payment_term_type: paymentTermType,
      payment_term_days: paymentTermDays,
      payment_date: getPaymentDate(transactionDate, paymentTermType, paymentTermDays),
      note: buildSaleNote(finalStatus, customer.companyName, index),
      vat_mode: vatMode,
      bill_discount: billDiscount,
      total_before_vat: totals.total_before_vat,
      vat_amount: totals.vat_amount,
      grand_total: totals.grand_total,
      total_amount: totals.grand_total,
      items,
      billing_note_links: [],
      credit_note_links: [],
      source_quotation_id: "",
      source_quotation_reference_no: "",
    };
  });
}

function buildQuotations(rng, buildReference) {
  const startDate = parseDate("2026-01-12");
  const quotationCount = 18;
  const daySpan = diffDays(startDate, TODAY);
  const vatModes = ["not_included", "included", "none", "not_included"];
  const validityPatterns = [
    { kind: "calendar", days: 30 },
    { kind: "business", days: 21 },
    { kind: "calendar", days: 45 },
    { kind: "none", days: 0 },
  ];

  return Array.from({ length: quotationCount }, (_, index) => {
    const quotationDate = clampDate(
      addDays(startDate, Math.round((index * daySpan) / Math.max(1, quotationCount - 1)))
    );
    const customer = customers[index % customers.length];
    const rootSupplier = maybe(rng, 0.72) ? suppliers[(index * 2) % suppliers.length] : null;
    const vatMode = vatModes[index % vatModes.length];
    const validityPattern = validityPatterns[index % validityPatterns.length];
    const itemCount = pick(rng, [1, 2, 2, 3, 3, 4]);
    const selectedProducts = sample(rng, products, itemCount);
    const referenceNo = buildReference("QT", quotationDate);

    const items = selectedProducts.map((product, itemIndex) => {
      const config = getProductConfig(product.id);
      const conversion = chooseUnit(rng, product, false);
      const quantity = pick(rng, getSaleQuantities(conversion));
      const salePrice = money(config.salePrice * conversion.factorToBase * (0.97 + rng() * 0.12));
      const discounts = chooseDiscounts(rng, true);
      const optionCount = rootSupplier
        ? pick(rng, [1, 2, 2, 3])
        : pick(rng, [0, 1, 1, 2, 3]);
      const selectedSuppliers = optionCount
        ? sample(rng, suppliers, Math.min(optionCount, suppliers.length))
        : [];
      if (rootSupplier && !selectedSuppliers.some((supplier) => supplier.id === rootSupplier.id)) {
        selectedSuppliers[0] = rootSupplier;
      }

      const supplierOptions = selectedSuppliers.map((supplier, supplierIndex) => ({
        id: `${referenceNo}-item-${itemIndex + 1}-supplier-${supplierIndex + 1}`,
        supplier_name: supplier.companyName,
        cost_price: money(config.baseCost * conversion.factorToBase * (0.88 + rng() * 0.18)),
      }));
      const primaryCost = supplierOptions.length ? supplierOptions[0].cost_price : "";

      return {
        line_id: `${referenceNo}-item-${itemIndex + 1}`,
        product_id: product.id,
        product_name: getProductName(product),
        sku: product.sku,
        unit: conversion.unit,
        base_unit: product.stockBaseUnit,
        conversion_factor: conversion.factorToBase,
        quantity,
        base_quantity: quantity * conversion.factorToBase,
        sale_price: salePrice,
        cost_price: primaryCost,
        discounts,
        supplier_options: supplierOptions,
        sale_amount: computeAmount(quantity, salePrice, discounts),
        cost_amount: primaryCost === "" ? 0 : money(quantity * primaryCost),
      };
    });

    const totals = computeTotals(
      items.map((item) => item.sale_amount),
      vatMode,
      0
    );

    return {
      id: `quotation-${index + 1}`,
      reference_no: referenceNo,
      quotation_date: formatDate(quotationDate),
      valid_until_date:
        validityPattern.kind === "none"
          ? ""
          : formatDate(addDays(quotationDate, validityPattern.days)),
      customer_name: customer.companyName,
      supplier_name: rootSupplier?.companyName || "",
      vat_mode: vatMode,
      note:
        rootSupplier?.companyName
          ? `Prepared for ${customer.companyName} with supplier comparisons and margin checks.`
          : `Prepared for ${customer.companyName}; supplier costing is still being collected.`,
      total_before_vat: totals.total_before_vat,
      vat_amount: totals.vat_amount,
      grand_total: totals.grand_total,
      items,
    };
  });
}

function buildBillingNotes(rng, buildReference, sales) {
  const eligibleStatuses = new Set(["delivered", "partially_delivered", "shipped"]);
  const groupedSales = new Map();

  sales.forEach((sale) => {
    if (!eligibleStatuses.has(sale.status)) {
      return;
    }
    const existing = groupedSales.get(sale.customer_name) || [];
    existing.push(sale);
    groupedSales.set(sale.customer_name, existing);
  });

  const statusCycle = [
    "fully_received",
    "issued",
    "partially_received",
    "draft",
    "fully_received",
    "cancelled",
  ];
  const billingNotes = [];
  let serial = 1;

  [...groupedSales.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .forEach(([customerName, customerSales]) => {
      let cursor = 0;
      const orderedSales = [...customerSales].sort((left, right) =>
        `${left.transaction_date}|${left.reference_no}`.localeCompare(
          `${right.transaction_date}|${right.reference_no}`
        )
      );

      while (cursor < orderedSales.length && serial <= 28) {
        const lineCount = Math.min(
          orderedSales.length - cursor,
          pick(rng, [1, 1, 2, 2, 3])
        );
        const selectedSales = orderedSales.slice(cursor, cursor + lineCount);
        cursor += lineCount;

        const latestSaleDate = parseDate(
          selectedSales.reduce((latest, sale) =>
            sale.transaction_date > latest ? sale.transaction_date : latest, selectedSales[0].transaction_date)
        );
        const billingNoteDate = clampDate(addDays(latestSaleDate, pick(rng, [2, 4, 7, 10])));
        const paymentDates = selectedSales
          .map((sale) => sale.payment_date)
          .filter(Boolean)
          .sort();
        const expectedPaymentDate = paymentDates.length
          ? paymentDates[paymentDates.length - 1]
          : formatDate(addDays(billingNoteDate, 30));
        const status = statusCycle[(serial - 1) % statusCycle.length];
        const referenceNo = buildReference("BN", billingNoteDate);

        const lines = selectedSales.map((sale, lineIndex) => {
          const received = status === "fully_received" || (status === "partially_received" && lineIndex === 0);
          const receivedDate = received
            ? formatDate(
                clampDate(
                  addDays(
                    parseDate(sale.payment_date || expectedPaymentDate),
                    pick(rng, [-1, 0, 1, 2])
                  )
                )
              )
            : null;

          return {
            id: `${referenceNo}-line-${lineIndex + 1}`,
            sale: sale.id,
            sale_id: sale.id,
            sale_reference_no: sale.reference_no,
            sale_transaction_date: sale.transaction_date,
            sale_status: sale.status,
            sale_grand_total: sale.grand_total,
            sale_payment_term_type: sale.payment_term_type,
            sale_payment_term_days: sale.payment_term_days,
            sale_payment_date: sale.payment_date,
            received,
            received_date: receivedDate,
            amount: Number(sale.grand_total) || 0,
          };
        });

        const receivedDates = lines
          .filter((line) => line.received && line.received_date)
          .map((line) => line.received_date)
          .sort();

        billingNotes.push({
          id: `billing-note-mock-${serial}`,
          reference_no: referenceNo,
          customer_id: selectedSales[0].customer_id || "",
          customer_name: customerName,
          billing_note_date: formatDate(billingNoteDate),
          expected_payment_date: expectedPaymentDate,
          actual_payment_date: receivedDates.length ? receivedDates[receivedDates.length - 1] : null,
          status,
          bank_reference: status === "fully_received" ? `KB-BN-${getThaiYearMonth(billingNoteDate)}-${String(serial).padStart(3, "0")}` : "",
          note: buildBillingNoteNote(status, customerName),
          total_amount: money(sum(lines.map((line) => line.amount))),
          lines,
        });
        serial += 1;
      }
    });

  return billingNotes;
}

function buildPaymentBatches(rng, buildReference, purchases) {
  const eligibleStatuses = new Set(["received", "partially_received"]);
  const groupedPurchases = new Map();

  purchases.forEach((purchase) => {
    if (!eligibleStatuses.has(purchase.status)) {
      return;
    }
    const existing = groupedPurchases.get(purchase.supplier_name) || [];
    existing.push(purchase);
    groupedPurchases.set(purchase.supplier_name, existing);
  });

  const statusCycle = ["paid", "scheduled", "partially_paid", "draft", "paid", "cancelled"];
  const paymentBatches = [];
  let serial = 1;

  [...groupedPurchases.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .forEach(([supplierName, supplierPurchases]) => {
      let cursor = 0;
      const orderedPurchases = [...supplierPurchases].sort((left, right) =>
        `${left.transaction_date}|${left.reference_no}`.localeCompare(
          `${right.transaction_date}|${right.reference_no}`
        )
      );

      while (cursor < orderedPurchases.length && serial <= 24) {
        const lineCount = Math.min(
          orderedPurchases.length - cursor,
          pick(rng, [1, 1, 2, 2, 3])
        );
        const selectedPurchases = orderedPurchases.slice(cursor, cursor + lineCount);
        cursor += lineCount;

        const latestPurchaseDate = parseDate(
          selectedPurchases.reduce((latest, purchase) =>
            purchase.transaction_date > latest ? purchase.transaction_date : latest,
          selectedPurchases[0].transaction_date)
        );
        const batchDate = clampDate(addDays(latestPurchaseDate, pick(rng, [2, 5, 8, 12])));
        const paymentDates = selectedPurchases
          .map((purchase) => purchase.payment_date)
          .filter(Boolean)
          .sort();
        const plannedPaymentDate = paymentDates.length
          ? paymentDates[paymentDates.length - 1]
          : formatDate(addDays(batchDate, 30));
        const status = statusCycle[(serial - 1) % statusCycle.length];
        const referenceNo = buildReference("PMT", batchDate);

        const lines = selectedPurchases.map((purchase, lineIndex) => {
          const paid = status === "paid" || (status === "partially_paid" && lineIndex === 0);
          const paidDate = paid
            ? formatDate(
                clampDate(
                  addDays(
                    parseDate(purchase.payment_date || plannedPaymentDate),
                    pick(rng, [-1, 0, 1, 2])
                  )
                )
              )
            : null;

          return {
            id: `${referenceNo}-line-${lineIndex + 1}`,
            purchase: purchase.id,
            purchase_id: purchase.id,
            purchase_reference_no: purchase.reference_no,
            purchase_transaction_date: purchase.transaction_date,
            purchase_status: purchase.status,
            purchase_grand_total: purchase.grand_total,
            purchase_payable_total: purchase.payable_total,
            purchase_payment_term_type: purchase.payment_term_type,
            purchase_payment_term_days: purchase.payment_term_days,
            purchase_payment_date: purchase.payment_date,
            paid,
            paid_date: paidDate,
            amount: Number(purchase.payable_total || purchase.grand_total) || 0,
          };
        });

        const paidDates = lines
          .filter((line) => line.paid && line.paid_date)
          .map((line) => line.paid_date)
          .sort();

        paymentBatches.push({
          id: `payment-batch-mock-${serial}`,
          reference_no: referenceNo,
          supplier_id: selectedPurchases[0].supplier_id || "",
          supplier_name: supplierName,
          batch_date: formatDate(batchDate),
          planned_payment_date: plannedPaymentDate,
          actual_payment_date: paidDates.length ? paidDates[paidDates.length - 1] : null,
          status,
          bank_reference: status === "paid" ? `SCB-PMT-${getThaiYearMonth(batchDate)}-${String(serial).padStart(3, "0")}` : "",
          note: buildPaymentBatchNote(status, supplierName),
          total_amount: money(sum(lines.map((line) => line.amount))),
          lines,
        });
        serial += 1;
      }
    });

  return paymentBatches;
}

function buildCreditNotes(rng, buildReference, sales, billingNotes) {
  const activeBillingNotesBySaleId = new Map();
  billingNotes.forEach((note) => {
    if (note.status === "cancelled") {
      return;
    }
    (note.lines || []).forEach((line) => {
      const rows = activeBillingNotesBySaleId.get(line.sale_id) || [];
      rows.push(note);
      activeBillingNotesBySaleId.set(line.sale_id, rows);
    });
  });

  const candidateSales = sales
    .map((sale) => ({
      sale,
      items: (sale.items || []).filter((item) =>
        SALE_CANCELLED_OR_RETURNED_STATUSES.has(item.item_status)
      ),
    }))
    .filter((entry) => entry.items.length)
    .sort((left, right) => {
      const leftPriority = activeBillingNotesBySaleId.has(left.sale.id) ? 0 : 1;
      const rightPriority = activeBillingNotesBySaleId.has(right.sale.id) ? 0 : 1;
      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }
      return `${left.sale.transaction_date}|${left.sale.reference_no}`.localeCompare(
        `${right.sale.transaction_date}|${right.sale.reference_no}`
      );
    })
    .slice(0, 8);

  return candidateSales.map(({ sale, items }, index) => {
    const serial = index + 1;
    const creditNoteDate = clampDate(
      addDays(parseDate(sale.transaction_date), pick(rng, [3, 5, 9]))
    );
    const billingNoteOptions = activeBillingNotesBySaleId.get(sale.id) || [];
    const linkedBillingNote = billingNoteOptions.length ? pick(rng, billingNoteOptions) : null;
    const status = serial % 4 === 0 ? "cancelled" : "issued";
    const referenceNo = buildReference("CN", creditNoteDate);
    const lines = items.map((item, lineIndex) => ({
      id: `${referenceNo}-line-${lineIndex + 1}`,
      sale_item: item.id,
      product_name: item.product_name,
      sku: item.sku,
      quantity: item.quantity,
      unit_price: item.unit_price,
      amount: item.amount,
    }));

    return {
      id: `credit-note-mock-${serial}`,
      reference_no: referenceNo,
      customer_id: sale.customer_id || "",
      customer_name: sale.customer_name,
      sale: sale.id,
      sale_reference_no: sale.reference_no,
      billing_note: linkedBillingNote?.id || null,
      billing_note_reference_no: linkedBillingNote?.reference_no || "",
      credit_note_date: formatDate(creditNoteDate),
      status,
      note: buildCreditNoteNote(status, sale.customer_name, sale.reference_no),
      total_amount: money(sum(lines.map((line) => line.amount))),
      lines,
    };
  });
}

function attachSourceQuotationLinks(quotations, purchases, sales) {
  const orderedQuotations = [...quotations].sort((left, right) =>
    `${left.quotation_date}|${left.reference_no}`.localeCompare(
      `${right.quotation_date}|${right.reference_no}`
    )
  );

  orderedQuotations.forEach((quotation, index) => {
    if (index % 2 === 0) {
      const sale = sales.find(
        (row) =>
          !row.source_quotation_id &&
          row.customer_name === quotation.customer_name &&
          row.transaction_date >= quotation.quotation_date
      );
      if (sale) {
        sale.source_quotation_id = quotation.id;
        sale.source_quotation_reference_no = quotation.reference_no;
      }
    }

    if (index % 3 === 0 && quotation.supplier_name) {
      const purchase = purchases.find(
        (row) =>
          !row.source_quotation_id &&
          row.supplier_name === quotation.supplier_name &&
          row.transaction_date >= quotation.quotation_date
      );
      if (purchase) {
        purchase.source_quotation_id = quotation.id;
        purchase.source_quotation_reference_no = quotation.reference_no;
      }
    }
  });
}

function attachFinancialLinks(purchases, sales, billingNotes, paymentBatches, creditNotes) {
  const purchaseById = new Map(purchases.map((purchase) => [String(purchase.id), purchase]));
  const saleById = new Map(sales.map((sale) => [String(sale.id), sale]));

  billingNotes.forEach((note) => {
    (note.lines || []).forEach((line) => {
      const sale = saleById.get(String(line.sale));
      if (!sale) {
        return;
      }
      sale.billing_note_links = sale.billing_note_links || [];
      if (!sale.billing_note_links.some((entry) => entry.id === note.id)) {
        sale.billing_note_links.push({ id: note.id, reference_no: note.reference_no });
      }
    });
  });

  paymentBatches.forEach((batch) => {
    (batch.lines || []).forEach((line) => {
      if (batch.status === "cancelled") {
        return;
      }
      const purchase = purchaseById.get(String(line.purchase));
      if (!purchase) {
        return;
      }
      purchase.payment_batch_links = purchase.payment_batch_links || [];
      if (!purchase.payment_batch_links.some((entry) => entry.id === batch.id)) {
        purchase.payment_batch_links.push({ id: batch.id, reference_no: batch.reference_no });
      }
    });
  });

  creditNotes.forEach((note) => {
    if (note.status === "cancelled") {
      return;
    }
    const sale = saleById.get(String(note.sale));
    if (!sale) {
      return;
    }
    sale.credit_note_links = sale.credit_note_links || [];
    if (!sale.credit_note_links.some((entry) => entry.id === note.id)) {
      sale.credit_note_links.push({ id: note.id, reference_no: note.reference_no });
    }
  });
}

function buildEligibleBillingNoteSales(sales, billingNotes) {
  const activeSaleIds = new Set(
    billingNotes
      .filter((note) => note.status !== "cancelled")
      .flatMap((note) => (note.lines || []).map((line) => String(line.sale)))
  );
  const eligibleStatuses = new Set(["delivered", "partially_delivered", "shipped"]);

  return sales.filter(
    (sale) => eligibleStatuses.has(sale.status) && !activeSaleIds.has(String(sale.id))
  );
}

function buildEligiblePaymentBatchPurchases(purchases, paymentBatches) {
  const activePurchaseIds = new Set(
    paymentBatches
      .filter((batch) => batch.status !== "cancelled")
      .flatMap((batch) => (batch.lines || []).map((line) => String(line.purchase)))
  );
  const eligibleStatuses = new Set(["received", "partially_received"]);

  return purchases.filter(
    (purchase) => eligibleStatuses.has(purchase.status) && !activePurchaseIds.has(String(purchase.id))
  );
}

function buildEligibleCreditNoteSales(sales, creditNotes) {
  const creditedItemIds = new Set(
    creditNotes
      .filter((note) => note.status !== "cancelled")
      .flatMap((note) => (note.lines || []).map((line) => String(line.sale_item)))
  );

  return sales
    .map((sale) => {
      const cancelledLines = (sale.items || [])
        .filter(
          (item) =>
            SALE_CANCELLED_OR_RETURNED_STATUSES.has(item.item_status) &&
            !creditedItemIds.has(String(item.id))
        )
        .map((item) => ({
          sale_item: item.id,
          product_name: item.product_name,
          sku: item.sku,
          quantity: item.quantity,
          unit_price: item.unit_price,
          amount: item.amount,
        }));

      if (!cancelledLines.length) {
        return null;
      }

      return {
        id: sale.id,
        reference_no: sale.reference_no,
        customer_name: sale.customer_name,
        status: sale.status,
        transaction_date: sale.transaction_date,
        payment_term_type: sale.payment_term_type,
        payment_term_days: sale.payment_term_days,
        payment_date: sale.payment_date,
        grand_total: sale.grand_total,
        cancelled_lines: cancelledLines,
      };
    })
    .filter(Boolean);
}

function buildBillingNoteSummary(billingNotes) {
  const outstanding = money(
    sum(
      billingNotes
        .filter((note) => !["fully_received", "cancelled"].includes(note.status))
        .map((note) => note.total_amount)
    )
  );
  const overdue = money(
    sum(
      billingNotes
        .filter(
          (note) =>
            !["fully_received", "cancelled"].includes(note.status) &&
            (note.expected_payment_date || "") < formatDate(TODAY)
        )
        .map((note) => note.total_amount)
    )
  );
  const received = money(
    sum(
      billingNotes
        .filter((note) => note.status === "fully_received")
        .map((note) => note.total_amount)
    )
  );

  return { outstanding, overdue, received };
}

function buildPaymentBatchSummary(paymentBatches) {
  const outstanding = money(
    sum(
      paymentBatches
        .filter((batch) => !["paid", "cancelled"].includes(batch.status))
        .map((batch) => batch.total_amount)
    )
  );
  const overdue = money(
    sum(
      paymentBatches
        .filter(
          (batch) =>
            !["paid", "cancelled"].includes(batch.status) &&
            (batch.planned_payment_date || "") < formatDate(TODAY)
        )
        .map((batch) => batch.total_amount)
    )
  );
  const paid = money(
    sum(
      paymentBatches
        .filter((batch) => batch.status === "paid")
        .map((batch) => batch.total_amount)
    )
  );

  return { outstanding, overdue, paid };
}

function buildMockCashflow(billingNotes, paymentBatches) {
  const HORIZON_WEEKS = 6;
  const openAR = billingNotes.filter(
    (note) => !["fully_received", "cancelled"].includes(note.status)
  );
  const openAP = paymentBatches.filter(
    (batch) => !["paid", "cancelled"].includes(batch.status)
  );
  const arTotal = money(sum(openAR.map((note) => note.total_amount)));
  const apTotal = money(sum(openAP.map((batch) => batch.total_amount)));

  const bucketSum = (items, dateKey, start, end) =>
    money(
      sum(
        items
          .filter((item) => {
            const due = item[dateKey];
            if (!due) return false;
            if (start && due < start) return false;
            return due <= end;
          })
          .map((item) => item.total_amount)
      )
    );

  const yesterday = formatDate(addDays(TODAY, -1));
  const overdueAr = bucketSum(openAR, "expected_payment_date", null, yesterday);
  const overdueAp = bucketSum(openAP, "planned_payment_date", null, yesterday);
  const buckets = [
    {
      key: "overdue",
      label: "Overdue",
      is_overdue: true,
      ar_in: overdueAr,
      ap_out: overdueAp,
      net: money(overdueAr - overdueAp),
    },
  ];
  for (let week = 0; week < HORIZON_WEEKS; week += 1) {
    const start = addDays(TODAY, 7 * week);
    const end = addDays(TODAY, 7 * week + 6);
    const arIn = bucketSum(openAR, "expected_payment_date", formatDate(start), formatDate(end));
    const apOut = bucketSum(openAP, "planned_payment_date", formatDate(start), formatDate(end));
    buckets.push({
      key: formatDate(start),
      label: `${start.getUTCDate()}/${start.getUTCMonth() + 1}`,
      is_overdue: false,
      ar_in: arIn,
      ap_out: apOut,
      net: money(arIn - apOut),
    });
  }

  return {
    today: formatDate(TODAY),
    horizon_weeks: HORIZON_WEEKS,
    buckets,
    ar_total_open: arTotal,
    ap_total_open: apTotal,
    net_open: money(arTotal - apTotal),
    overdue_ar: overdueAr,
    overdue_ap: overdueAp,
  };
}

function buildDashboard(purchases, sales, billingNotes = [], paymentBatches = []) {
  const stockByProductId = new Map(products.map((product) => [product.id, 0]));

  purchases.forEach((purchase) => {
    (purchase.items || []).forEach((item) => {
      if (item.item_status === "received") {
        stockByProductId.set(
          item.product_id,
          Number(stockByProductId.get(item.product_id) || 0) + Number(item.base_quantity || 0)
        );
      }
    });
  });

  sales.forEach((sale) => {
    (sale.items || []).forEach((item) => {
      if (DASHBOARD_STOCK_DEDUCT_STATUSES.has(item.item_status)) {
        stockByProductId.set(
          item.product_id,
          Math.max(
            0,
            Number(stockByProductId.get(item.product_id) || 0) - Number(item.base_quantity || 0)
          )
        );
      }
    });
  });

  // Per-product order history → drives the dashboard's stock-cycling and
  // delivery-planning widgets in offline/mock mode (mirrors the backend's
  // build_stock_report fields).
  const salesAgg = new Map();
  sales.forEach((sale) => {
    (sale.items || []).forEach((item) => {
      if (!item.product_id) return;
      let agg = salesAgg.get(item.product_id);
      if (!agg) {
        agg = { orderIds: new Set(), dates: [], pendingUnits: 0, soldUnits: 0 };
        salesAgg.set(item.product_id, agg);
      }
      if (DASHBOARD_STOCK_DEDUCT_STATUSES.has(item.item_status)) {
        agg.orderIds.add(sale.id);
        if (sale.transaction_date) agg.dates.push(sale.transaction_date);
        agg.soldUnits += Number(item.base_quantity || 0);
      } else if (item.item_status === "pending") {
        agg.pendingUnits += Number(item.base_quantity || 0);
      }
    });
  });

  const todayStr = formatDate(TODAY);
  const purchaseAgg = new Map();
  purchases.forEach((purchase) => {
    (purchase.items || []).forEach((item) => {
      if (!item.product_id || item.item_status !== "pending") return;
      let agg = purchaseAgg.get(item.product_id);
      if (!agg) {
        agg = { incoming: 0, delayed: 0 };
        purchaseAgg.set(item.product_id, agg);
      }
      const qty = Number(item.base_quantity || 0);
      agg.incoming += qty;
      if (item.expected_delivery_date && item.expected_delivery_date < todayStr) {
        agg.delayed += qty;
      }
    });
  });

  const stockReport = products.map((product) => {
    const config = getProductConfig(product.id);
    const currentStock = Number(stockByProductId.get(product.id) || 0);
    const sAgg = salesAgg.get(product.id);
    const pAgg = purchaseAgg.get(product.id);
    const saleDates = sAgg ? [...sAgg.dates].sort() : [];
    const weeklyDemand = Number(config.weeklyDemand || 0);
    const daysUntilStockout = weeklyDemand > 0 ? Math.round((currentStock / weeklyDemand) * 7) : 0;
    const recommendedRestock =
      currentStock <= config.reorderLevel
        ? Math.max(config.reorderLevel * 2 - currentStock, weeklyDemand * 4)
        : 0;

    return {
      product_id: product.id,
      product_name: getProductName(product),
      sku: product.sku,
      category: product.category,
      unit_cost: config.baseCost,
      current_stock: currentStock,
      available_stock: currentStock,
      oversold_units: 0,
      predicted_7_day_demand: weeklyDemand,
      days_until_stockout: currentStock <= 0 ? 0 : daysUntilStockout,
      recommended_restock: Math.max(0, Math.round(recommendedRestock)),
      reorder_level: config.reorderLevel,
      unit: product.stock_base_unit || product.base_unit || "pcs",
      pending_sales_units: money(sAgg ? sAgg.pendingUnits : 0),
      incoming_purchase_units: money(pAgg ? pAgg.incoming : 0),
      delayed_purchase_units: money(pAgg ? pAgg.delayed : 0),
      sales_history_units: money(sAgg ? sAgg.soldUnits : 0),
      cycle_count: sAgg ? sAgg.orderIds.size : 0,
      first_sale_date: saleDates[0] || null,
      last_sale_date: saleDates[saleDates.length - 1] || null,
    };
  });

  const lowStockItems = stockReport
    .filter((item) => item.current_stock <= item.reorder_level)
    .sort((left, right) => left.current_stock - right.current_stock)
    .slice(0, 6)
    .map((item) => ({
      product_id: item.product_id,
      product_name: item.product_name,
      current_stock: item.current_stock,
      reorder_level: item.reorder_level,
    }));

  return {
    overview: {
      cashflow: buildMockCashflow(billingNotes, paymentBatches),
    },
    metrics: {
      total_products: products.length,
      total_stock_units: money(sum(stockReport.map((item) => item.current_stock))),
      total_stock_value: money(
        sum(stockReport.map((item) => item.current_stock * Number(item.unit_cost || 0)))
      ),
      low_stock_count: lowStockItems.length,
      purchase_total: money(
        sum(purchases.filter((purchase) => purchase.status !== "cancelled").map((purchase) => purchase.grand_total))
      ),
      sales_total: money(
        sum(sales.filter((sale) => sale.status !== "cancelled").map((sale) => sale.grand_total))
      ),
    },
    low_stock_items: lowStockItems,
    stock_report: stockReport,
  };
}

function buildMockDataset() {
  const rng = createRng(260429);
  const buildReference = createReferenceBuilder();
  const purchases = buildPurchases(rng, buildReference);
  const sales = buildSales(rng, buildReference, purchases);
  const quotations = buildQuotations(rng, buildReference);
  const billingNotes = buildBillingNotes(rng, buildReference, sales);
  const paymentBatches = buildPaymentBatches(rng, buildReference, purchases);
  const creditNotes = buildCreditNotes(rng, buildReference, sales, billingNotes);

  attachSourceQuotationLinks(quotations, purchases, sales);
  attachFinancialLinks(purchases, sales, billingNotes, paymentBatches, creditNotes);

  const dashboard = buildDashboard(purchases, sales, billingNotes, paymentBatches);
  const eligibleBillingNoteSales = buildEligibleBillingNoteSales(sales, billingNotes);
  const eligiblePaymentBatchPurchases = buildEligiblePaymentBatchPurchases(
    purchases,
    paymentBatches
  );
  const eligibleCreditNoteSales = buildEligibleCreditNoteSales(sales, creditNotes);

  return {
    mockDashboard: dashboard,
    mockPurchases: sortByDateDescending(purchases, "transaction_date"),
    mockSales: sortByDateDescending(sales, "transaction_date"),
    mockQuotations: sortByDateDescending(quotations, "quotation_date"),
    mockBillingNotes: sortByDateDescending(billingNotes, "billing_note_date"),
    mockPaymentBatches: sortByDateDescending(paymentBatches, "batch_date"),
    mockCreditNotes: sortByDateDescending(creditNotes, "credit_note_date"),
    mockEligibleBillingNoteSales: sortByDateDescending(
      eligibleBillingNoteSales,
      "transaction_date"
    ),
    mockBillingNoteSummary: buildBillingNoteSummary(billingNotes),
    mockBillingNoteNextReferenceNo: buildNextReferenceNo(billingNotes, "BN"),
    mockEligiblePaymentBatchPurchases: sortByDateDescending(
      eligiblePaymentBatchPurchases,
      "transaction_date"
    ),
    mockPaymentBatchSummary: buildPaymentBatchSummary(paymentBatches),
    mockPaymentBatchNextReferenceNo: buildNextReferenceNo(paymentBatches, "PMT"),
    mockEligibleCreditNoteSales: sortByDateDescending(
      eligibleCreditNoteSales,
      "transaction_date"
    ),
    mockCreditNoteNextReferenceNo: buildNextReferenceNo(creditNotes, "CN"),
  };
}

const dataset = buildMockDataset();

export const mockDashboard = dataset.mockDashboard;
export const mockPurchases = dataset.mockPurchases;
export const mockSales = dataset.mockSales;
export const mockQuotations = dataset.mockQuotations;
export const mockBillingNotes = dataset.mockBillingNotes;
export const mockPaymentBatches = dataset.mockPaymentBatches;
export const mockCreditNotes = dataset.mockCreditNotes;
export const mockEligibleBillingNoteSales = dataset.mockEligibleBillingNoteSales;
export const mockBillingNoteSummary = dataset.mockBillingNoteSummary;
export const mockBillingNoteNextReferenceNo = dataset.mockBillingNoteNextReferenceNo;
export const mockEligiblePaymentBatchPurchases = dataset.mockEligiblePaymentBatchPurchases;
export const mockPaymentBatchSummary = dataset.mockPaymentBatchSummary;
export const mockPaymentBatchNextReferenceNo = dataset.mockPaymentBatchNextReferenceNo;
export const mockEligibleCreditNoteSales = dataset.mockEligibleCreditNoteSales;
export const mockCreditNoteNextReferenceNo = dataset.mockCreditNoteNextReferenceNo;
