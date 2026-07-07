// Helper utilities for sales workflow behavior.

import { formatMoney as fmt } from "../../format";
import { buildConvertedItemFields } from "../../unitConversion";
import {
  buildManualAllocationPayload,
  createInitialAllocationState,
  getComputedAllocationSnapshot,
} from "./salesAllocationUtils";
import {
  computeAmount,
  emptyItem,
  getLatestSupplierCost,
  getLineLoss,
  getProductName,
  getProductSku,
  getProductUnit,
} from "./salesFormUtils";

export function buildStockPreviewItems(items, products) {
  return items
    .filter((item) => item.product_id && item.quantity)
    .map((item) => {
      const selectedProduct = products.find(
        (product) => `${product.id}` === `${item.product_id}`
      );

      return {
        product_id: item.product_id,
        product_name: selectedProduct ? getProductName(selectedProduct) : item.product_name,
        sku: selectedProduct ? getProductSku(selectedProduct) : item.sku,
        ...(selectedProduct
          ? buildConvertedItemFields(selectedProduct, item.quantity, item.unit, "sale")
          : {
              unit: item.unit || "pcs",
              base_unit: item.unit || "pcs",
              conversion_factor: 1,
              base_quantity: Number(item.quantity) || 0,
            }),
        quantity: Number(item.quantity) || 0,
      };
    });
}

export function updateItemValue(currentItems, itemIndex, key, value) {
  return currentItems.map((item, index) =>
    index === itemIndex ? { ...item, [key]: value } : item
  );
}

export function updateProductQueryItems(currentItems, itemIndex, value) {
  const allocationState = createInitialAllocationState();
  return currentItems.map((item, index) =>
    index === itemIndex
      ? {
          ...item,
          product_id: "",
          product_query: value,
          product_name: "",
          sku: "",
          unit: "pcs",
          allocation_mode: allocationState.allocation_mode,
          allocations: allocationState.allocations,
        }
      : item
  );
}

export function selectProductItems(currentItems, itemIndex, product, purchases) {
  const productName = getProductName(product);
  const sku = getProductSku(product);
  const allocationState = createInitialAllocationState();

  return currentItems.map((item, index) => {
    if (index !== itemIndex) {
      return item;
    }

    const nextItem = {
      ...item,
      product_id: product.id,
      product_query: sku ? `${productName} (${sku})` : productName,
      product_name: productName,
      sku,
      unit: getProductUnit(product),
      allocation_mode: allocationState.allocation_mode,
      allocations: allocationState.allocations,
    };
    const suggestedCost = getLatestSupplierCost(purchases, product.id, item.supplier_name);

    if (suggestedCost != null) {
      nextItem.unit_cost = `${suggestedCost}`;
    }

    return nextItem;
  });
}

export function updateSupplierItems(currentItems, itemIndex, supplierName, purchases) {
  return currentItems.map((item, index) => {
    if (index !== itemIndex) {
      return item;
    }

    const nextItem = { ...item, supplier_name: supplierName };
    const suggestedCost = getLatestSupplierCost(purchases, item.product_id, supplierName);

    if (suggestedCost != null) {
      nextItem.unit_cost = `${suggestedCost}`;
    }

    return nextItem;
  });
}

export function addDiscountToItems(currentItems, itemIndex) {
  return currentItems.map((item, index) =>
    index === itemIndex ? { ...item, discounts: [...item.discounts, ""] } : item
  );
}

export function removeDiscountFromItems(currentItems, itemIndex, discountIndex) {
  return currentItems.map((item, index) => {
    if (index !== itemIndex) {
      return item;
    }

    const nextDiscounts = item.discounts.filter(
      (_, currentDiscountIndex) => currentDiscountIndex !== discountIndex
    );
    return { ...item, discounts: nextDiscounts.length === 0 ? [""] : nextDiscounts };
  });
}

export function updateDiscountInItems(currentItems, itemIndex, discountIndex, value) {
  return currentItems.map((item, index) => {
    if (index !== itemIndex) {
      return item;
    }

    const nextDiscounts = item.discounts.map((discount, currentDiscountIndex) =>
      currentDiscountIndex === discountIndex ? value : discount
    );
    return { ...item, discounts: nextDiscounts };
  });
}

export function appendEmptyItem(currentItems) {
  return [...currentItems, emptyItem()];
}

export function removeItemAtIndex(currentItems, itemIndex) {
  return currentItems.filter((_, index) => index !== itemIndex);
}

export function reorderItems(currentItems, fromIndex, toIndex) {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= currentItems.length ||
    toIndex >= currentItems.length
  ) {
    return currentItems;
  }

  const nextItems = [...currentItems];
  const [movedItem] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, movedItem);
  return nextItems;
}

export function resolveCustomerName(customers, customerName, customerQuery) {
  const selectedCustomer = customers.find(
    (customer) => customer.companyName === customerName
  );

  if (selectedCustomer) {
    return selectedCustomer.companyName;
  }

  const exactMatch = customers.find(
    (customer) =>
      customer.companyName.toLowerCase() === customerQuery.trim().toLowerCase()
  );

  return exactMatch?.companyName || "";
}

export function getBelowCostItems(items, activeAllItemsDiscount) {
  return items.filter(
    (item) =>
      item.product_id &&
      item.quantity &&
      item.unit_price &&
      getLineLoss(item, activeAllItemsDiscount) > 0
  );
}

export function buildBelowCostConfirmationMessage(belowCostItems, activeAllItemsDiscount, t) {
  const lines = belowCostItems
    .map(
      (item) =>
        `- ${item.product_name || t("salesForm.unnamedItem")} - ${t("salesForm.belowCostBy")} ${fmt(
          getLineLoss(item, activeAllItemsDiscount)
        )}`
    )
    .join("\n");

  return `${belowCostItems.length} ${t("salesForm.belowCostConfirm")}\n\n${lines}\n\n${t("salesForm.belowCostSaveAnyway")}`;
}

export function buildSaleSubmissionItems(
  items,
  products,
  activeAllItemsDiscount,
  stockLayersByProductId = {}
) {
  return items
    .filter((item) => item.product_id && item.quantity && item.unit_price)
    .map((item) => {
      const { line_id, allocations, allocation_mode, ...itemPayload } = item;
      const selectedProduct = products.find(
        (product) => `${product.id}` === `${item.product_id}`
      );
      const convertedFields = selectedProduct
        ? buildConvertedItemFields(selectedProduct, item.quantity, item.unit, "sale")
        : {};
      const allocationPayload = buildManualAllocationPayload(
        { ...item, allocations, allocation_mode },
        Number(convertedFields.conversion_factor) || 1
      );
      const computedSnapshot = getComputedAllocationSnapshot(
        { ...item, allocations, allocation_mode },
        stockLayersByProductId[`${item.product_id}:new`] || [],
        Number(convertedFields.conversion_factor) || 1
      );

      return {
        ...itemPayload,
        unit_cost:
          computedSnapshot.unit_cost ||
          ((item.unit_cost === "" || item.unit_cost == null) ? "0" : item.unit_cost),
        supplier_name: computedSnapshot.supplier_name || item.supplier_name,
        product_name: selectedProduct ? getProductName(selectedProduct) : item.product_name,
        sku: selectedProduct ? getProductSku(selectedProduct) : item.sku,
        discounts: item.discounts,
        ...convertedFields,
        ...(allocationPayload ? { allocations: allocationPayload } : {}),
        amount: computeAmount(item, activeAllItemsDiscount),
      };
    });
}
