// Helper utilities for purchase workflow behavior.

import { getProductUnitOptions } from "../../unitConversion";
import {
  getProductName,
  getProductSku,
  getPurchaseProductQuery,
} from "./purchaseHistoryUtils";

/**
 * Updates a specific field on a purchase item.
 */
export function updateItemHelper(currentItems, itemIndex, key, value) {
  return currentItems.map((item, index) =>
    index === itemIndex ? { ...item, [key]: value } : item
  );
}

/**
 * Updates item query fields when user types in product search.
 */
export function updateProductQueryHelper(currentItems, itemIndex, value) {
  return currentItems.map((item, index) =>
    index === itemIndex
      ? {
          ...item,
          product_id: "",
          product_query: value,
          product_name: "",
          sku: "",
          unit: "pcs",
        }
      : item
  );
}

/**
 * Updates item fields when a product is selected.
 */
export function selectProductHelper(currentItems, itemIndex, product) {
  const productName = getProductName(product);
  const sku = getProductSku(product);
  const unitOptions = getProductUnitOptions(product, "purchase");

  return currentItems.map((item, index) =>
    index === itemIndex
      ? {
          ...item,
          product_id: product.id,
          product_query: getPurchaseProductQuery(productName, sku),
          product_name: productName,
          sku,
          unit: unitOptions.some((conversion) => conversion.unit === item.unit)
            ? item.unit
            : unitOptions[0]?.unit || item.unit || "pcs",
        }
      : item
  );
}

/**
 * Adds a discount row to a purchase item.
 */
export function addDiscountHelper(currentItems, itemIndex) {
  return currentItems.map((item, index) =>
    index === itemIndex
      ? { ...item, discounts: [...(item.discounts || [0]), 0] }
      : item
  );
}

/**
 * Removes a specific discount row from a purchase item.
 */
export function removeDiscountHelper(currentItems, itemIndex, discountIndex) {
  return currentItems.map((item, index) => {
    if (index !== itemIndex) {
      return item;
    }

    const nextDiscounts = (item.discounts || [0]).filter(
      (_, currentDiscountIndex) => currentDiscountIndex !== discountIndex
    );

    return {
      ...item,
      discounts: nextDiscounts.length ? nextDiscounts : [0],
    };
  });
}

/**
 * Updates a specific discount value on a purchase item.
 */
export function updateDiscountHelper(currentItems, itemIndex, discountIndex, value) {
  return currentItems.map((item, index) => {
    if (index !== itemIndex) {
      return item;
    }

    const nextDiscounts = (item.discounts || [0]).map((discount, currentDiscountIndex) =>
      currentDiscountIndex === discountIndex ? value : discount
    );

    return { ...item, discounts: nextDiscounts };
  });
}

/**
 * Appends an empty purchase item row expecting values.
 */
export function addItemHelper(currentItems, purchaseId) {
  return [
    ...currentItems,
    {
      id: `purchase-${purchaseId}-item-${Date.now()}`,
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
      discounts: [0],
    },
  ];
}
