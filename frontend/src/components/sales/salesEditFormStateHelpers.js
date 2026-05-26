import { getProductUnit } from "./salesHistoryUtils";

/**
 * Updates a standard field value of a line item.
 */
export function updateItemHelper(currentItems, itemIndex, key, value) {
  return currentItems.map((item, index) =>
    index === itemIndex ? { ...item, [key]: value } : item
  );
}

/**
 * Updates item fields when a new product is selected.
 */
export function updateItemProductHelper(currentItems, itemIndex, productValue, productOptions, products) {
  const selectedProduct = productOptions.find((option) => option.value === productValue);

  return currentItems.map((item, index) =>
    index === itemIndex
      ? {
          ...item,
          product_value: productValue,
          product_id: selectedProduct?.id || "",
          product_name: selectedProduct?.name || "",
          sku: selectedProduct?.sku || "",
          unit: selectedProduct?.id
            ? getProductUnit(products.find((product) => `${product.id}` === `${selectedProduct.id}`))
            : "pcs",
        }
      : item
  );
}

/**
 * Adds a new discount element to a specific line item.
 */
export function addDiscountHelper(currentItems, itemIndex) {
  return currentItems.map((item, index) =>
    index === itemIndex
      ? { ...item, discounts: [...(item.discounts || [0]), 0] }
      : item
  );
}

/**
 * Removes a discount element from a specific line item.
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
 * Updates a specific discount value within a line item.
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
 * Appends a new default empty line item to the items list.
 */
export function addItemHelper(currentItems, saleId) {
  return [
    ...currentItems,
    {
      id: `sale-${saleId}-item-${Date.now()}`,
      product_value: "",
      product_id: "",
      product_name: "",
      sku: "",
      unit: "pcs",
      base_unit: "pcs",
      conversion_factor: 1,
      base_quantity: 1,
      item_status: "pending",
      shipped_date: "",
      delivered_date: "",
      quantity: 1,
      unit_price: "",
      discounts: [0],
    },
  ];
}
