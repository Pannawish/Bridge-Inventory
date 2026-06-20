import { getToday } from "./quotationDateUtils";
import { normalizeDiscounts } from "./quotationValueUtils";
import { findPartnerByCompanyName } from "./quotationDirectoryUtils";

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

  const refNote = quotation.reference_no ? `Ref: ${quotation.reference_no}` : "";

  return [...groupsBySupplier.values()].map((group) => ({
    supplier_name: group.supplierName,
    supplier: group.supplier,
    referenceLabel: quotation.reference_no || "",
    transaction_date: getToday(),
    note: refNote,
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
    transaction_date: getToday(),
    vat_mode: quotation.vat_mode || "not_included",
    payment_term_type: paymentTermType,
    payment_term_days: paymentTermDays,
    shipping_date: quotation.shipping_date || "",
    note: "",
    items: rows.map(({ item, option }) => ({
      ...buildConversionItemBase(item),
      unit_price: item.sale_price ?? "",
      supplier_name: option?.supplier_name || "",
      unit_cost: option?.cost_price ?? "",
    })),
  };
}
