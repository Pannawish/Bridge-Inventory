import { buildConvertedItemFields } from "../../unitConversion";
import {
  computeAmount,
  computeLeadTimeDays,
  emptyItem,
  getProductName,
  getProductSku,
  getProductUnit,
} from "./purchaseFormUtils";

export function updateItemValue(currentItems, index, key, value) {
  return currentItems.map((item, itemIndex) =>
    itemIndex === index ? { ...item, [key]: value } : item
  );
}

export function updateProductQueryItems(currentItems, index, value) {
  return currentItems.map((item, itemIndex) =>
    itemIndex === index
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

export function selectProductItems(currentItems, index, product) {
  const productName = getProductName(product);
  const sku = getProductSku(product);
  const unit = getProductUnit(product);

  return currentItems.map((item, itemIndex) =>
    itemIndex === index
      ? {
          ...item,
          product_id: product.id,
          product_query: sku ? `${productName} (${sku})` : productName,
          product_name: productName,
          sku,
          unit,
        }
      : item
  );
}

export function addDiscountToItems(currentItems, itemIndex) {
  return currentItems.map((item, index) =>
    index === itemIndex
      ? { ...item, discounts: [...(item.discounts || [""]), ""] }
      : item
  );
}

export function removeDiscountFromItems(currentItems, itemIndex, discountIndex) {
  return currentItems.map((item, index) => {
    if (index !== itemIndex) {
      return item;
    }

    const nextDiscounts = (item.discounts || [""]).filter(
      (_, currentDiscountIndex) => currentDiscountIndex !== discountIndex
    );

    return {
      ...item,
      discounts: nextDiscounts.length ? nextDiscounts : [""],
    };
  });
}

export function updateDiscountInItems(currentItems, itemIndex, discountIndex, value) {
  return currentItems.map((item, index) => {
    if (index !== itemIndex) {
      return item;
    }

    const nextDiscounts = (item.discounts || [""]).map(
      (discount, currentDiscountIndex) =>
        currentDiscountIndex === discountIndex ? value : discount
    );

    return { ...item, discounts: nextDiscounts };
  });
}

export function appendEmptyItem(currentItems) {
  return [...currentItems, emptyItem()];
}

export function removeItemAtIndex(currentItems, index) {
  return currentItems.filter((_, itemIndex) => itemIndex !== index);
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

export function resolveSupplierName(suppliers, supplierName, supplierQuery) {
  const selectedSupplier = suppliers.find(
    (supplier) => supplier.companyName === supplierName
  );

  if (selectedSupplier) {
    return selectedSupplier.companyName;
  }

  const exactMatch = suppliers.find(
    (supplier) =>
      supplier.companyName.toLowerCase() === supplierQuery.trim().toLowerCase()
  );

  return exactMatch?.companyName || "";
}

export function buildPurchaseSubmissionItems({
  items,
  products,
  transactionDate,
  status,
  activeAllItemsDiscount,
  getInitialPurchaseItemStatus,
  getTodayString,
}) {
  const nextItemErrors = {};
  const filteredItems = items.reduce((nextItems, item, index) => {
    const selectedProduct = products.find(
      (product) => `${product.id}` === `${item.product_id}`
    );

    if (!selectedProduct) {
      nextItemErrors[index] = "missing_product";
      return nextItems;
    }

    if (!item.expected_delivery_date) {
      nextItemErrors[index] = "missing_delivery";
      return nextItems;
    }

    if (!item.quantity || !item.unit_cost) {
      return nextItems;
    }

    const itemStatus = getInitialPurchaseItemStatus(status);

    return [
      ...nextItems,
      {
        product_id: selectedProduct.id,
        product_name: getProductName(selectedProduct),
        sku: getProductSku(selectedProduct),
        ...buildConvertedItemFields(
          selectedProduct,
          item.quantity,
          item.unit,
          "purchase"
        ),
        expected_delivery_date: item.expected_delivery_date,
        item_status: itemStatus,
        received_date: itemStatus === "received" ? getTodayString() : "",
        lead_time_days: computeLeadTimeDays(transactionDate, item.expected_delivery_date),
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        discounts: item.discounts,
        amount: computeAmount(item, activeAllItemsDiscount),
      },
    ];
  }, []);

  return {
    filteredItems,
    nextItemErrors,
  };
}
