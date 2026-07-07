// Helper utilities for quotation workflow behavior.

import {
  computeAmount,
  normalizeDiscounts,
  getProductSku,
  getProductName,
} from "./quotationUtils";
import { buildConvertedItemFields } from "../../unitConversion";

/**
 * Pure helper to translate a product name or return a fallback.
 */
export function getTranslatedProductName(product, t) {
  return getProductName(product, t("products.productFallback", { id: product?.id || "" }));
}

/**
 * Validates the core fields of the quotation form.
 * Returns { error: string } if validation fails, or null if it passes.
 */
export function validateQuotationForm(form, items, validUntilDate, t) {
  if (!form.quotation_date) {
    return { error: t("quotation.errorDateRequired") };
  }

  const validUntilDays = Number(form.valid_until_days);
  const isNoValidDate = form.valid_until_day_type === "no_valid_date";
  if (!isNoValidDate && (Number.isNaN(validUntilDays) || validUntilDays < 1 || validUntilDays > 100)) {
    return { error: t("quotation.errorValidUntilDays") };
  }
  if (!isNoValidDate && !validUntilDate) {
    return { error: t("quotation.errorValidUntilCompute") };
  }

  for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
    const options = items[itemIndex].supplier_options || [];
    for (const option of options) {
      const hasSupplierName = `${option.supplier_name ?? ""}`.trim();
      const missingCost =
        option.cost_price === "" ||
        option.cost_price === null ||
        option.cost_price === undefined;
      if (hasSupplierName && missingCost) {
        return {
          error: t("quotation.errorSupplierCostPrice", {
            supplier: option.supplier_name,
            index: itemIndex + 1,
          }),
        };
      }
    }
  }

  return null;
}

/**
 * Normalizes line items and builds their conversion fields.
 * Returns { normalizedItems } or { error, itemErrors, openProductIndex } if there's a validation error.
 */
export function buildNormalizedItems(items, products, t) {
  const itemErrors = {};
  const normalizedItems = [];

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const selectedProduct = products.find((product) => `${product.id}` === `${item.product_id}`);

    if (!selectedProduct) {
      itemErrors[index] = t("quotation.errorSelectProduct");
      return {
        error: t("quotation.errorSelectProduct"),
        itemErrors,
        openProductIndex: index,
      };
    }

    if (!item.quantity || Number(item.quantity) <= 0) {
      return { error: t("quotation.errorQuantityRequired", { index: index + 1 }) };
    }

    if (item.sale_price === "" || item.sale_price === null || item.sale_price === undefined) {
      return { error: t("quotation.errorSalePriceRequired", { index: index + 1 }) };
    }

    const discounts = normalizeDiscounts(item);
    const convertedFields = buildConvertedItemFields(
      selectedProduct,
      item.quantity,
      item.unit,
      "sale"
    );

    const supplierOptionRows = (item.supplier_options || [])
      .filter((option) => `${option.supplier_name ?? ""}`.trim())
      .map((option) => ({
        supplier_name: `${option.supplier_name}`.trim(),
        cost_price: option.cost_price,
      }));

    normalizedItems.push({
      line_id: item.line_id,
      product_id: selectedProduct.id,
      product_name: getTranslatedProductName(selectedProduct, t),
      sku: getProductSku(selectedProduct),
      ...convertedFields,
      quantity: Number(item.quantity) || 0,
      sale_price: item.sale_price,
      discounts,
      supplier_options: supplierOptionRows,
      sale_amount: computeAmount(item, "sale_price"),
    });
  }

  return { normalizedItems };
}
