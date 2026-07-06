// Sale status derivation shared by forms and history views.
//
// Keep this in sync with backend transaction services so frontend status
// previews match the server-side normalization applied during saves.
import { formatStatusLabel, getTodayString } from "./purchaseStatus";

export { formatStatusLabel, getTodayString };

export const saleStatuses = [
  "draft",
  "partially_packed",
  "packed",
  "partially_shipped",
  "shipped",
  "partially_delivered",
  "delivered",
  "cancelled",
  "returned",
];
export const saleItemStatuses = [
  "pending",
  "packed",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
];
export const editableSaleItemStatuses = [
  "pending",
  "packed",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
];

export function getInitialSaleItemStatus(saleStatus = "draft") {
  if (
    saleStatus === "partially_packed" ||
    saleStatus === "partially_shipped" ||
    saleStatus === "partially_delivered"
  ) {
    return "pending";
  }

  if (saleStatus === "delivered") {
    return "delivered";
  }

  if (saleStatus === "shipped") {
    return "shipped";
  }

  if (saleStatus === "packed") {
    return "packed";
  }

  if (saleStatus === "cancelled") {
    return "cancelled";
  }

  if (saleStatus === "returned") {
    return "returned";
  }

  return "pending";
}

export function getStoredSaleItemStatus(item, saleStatus = "draft") {
  const status = item.item_status || item.status;

  if (status === "draft") {
    return "pending";
  }

  if (saleItemStatuses.includes(status)) {
    return status;
  }

  return getInitialSaleItemStatus(saleStatus);
}

export function getSaleItemStatusCounts(items = [], saleStatus = "draft") {
  return items.reduce(
    (counts, item) => {
      const status = getStoredSaleItemStatus(item, saleStatus);
      return {
        ...counts,
        [status]: counts[status] + 1,
      };
    },
    { pending: 0, packed: 0, shipped: 0, delivered: 0, cancelled: 0, returned: 0 }
  );
}

function isActiveStatus(status) {
  return status !== "cancelled" && status !== "returned";
}

export function getSaleStatusFromItems(sale) {
  const items = sale.items || [];

  if (!items.length) {
    return sale.status || "draft";
  }

  const storedStatuses = items.map((item) => getStoredSaleItemStatus(item, sale.status));
  const activeStatuses = storedStatuses.filter(isActiveStatus);

  if (storedStatuses.every((status) => status === "cancelled" || status === "returned")) {
    if (storedStatuses.some((status) => status === "returned")) {
      return "returned";
    }
    return "cancelled";
  }

  if (!activeStatuses.length) {
    if (storedStatuses.some((status) => status === "returned")) {
      return "returned";
    }
    return "cancelled";
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

function getDatesForSaleItemStatus(item, nextStatus, today = getTodayString()) {
  if (nextStatus === "delivered") {
    return {
      shipped_date: item.shipped_date || today,
      delivered_date: item.delivered_date || today,
    };
  }

  if (nextStatus === "shipped") {
    return {
      shipped_date: item.shipped_date || today,
      delivered_date: "",
    };
  }

  return {
    shipped_date: "",
    delivered_date: "",
  };
}

export function applySaleStatusToItems(sale, nextStatus, today = getTodayString()) {
  const nextItems = (sale.items || []).map((item) => {
    const itemStatus = getInitialSaleItemStatus(nextStatus);
    const nextDates = getDatesForSaleItemStatus(item, itemStatus, today);

    return {
      ...item,
      item_status: itemStatus,
      ...nextDates,
    };
  });
  const nextSale = { ...sale, status: nextStatus, items: nextItems };

  return {
    ...nextSale,
    status: getSaleStatusFromItems(nextSale),
  };
}

export function updateSaleItemStatus(sale, itemIndex, nextStatus, today = getTodayString()) {
  const storedStatus = saleItemStatuses.includes(nextStatus) ? nextStatus : "pending";
  const nextItems = (sale.items || []).map((item, index) => {
    if (index !== itemIndex) {
      return item;
    }

    return {
      ...item,
      item_status: storedStatus,
      ...getDatesForSaleItemStatus(item, storedStatus, today),
    };
  });
  const nextSale = { ...sale, items: nextItems };

  return {
    ...nextSale,
    status: getSaleStatusFromItems(nextSale),
  };
}

export function updateSaleItemDate(sale, itemIndex, fieldName, nextValue) {
  const nextItems = (sale.items || []).map((item, index) => {
    if (index !== itemIndex) {
      return item;
    }

    const itemStatus = getStoredSaleItemStatus(item, sale.status);

    if (fieldName === "shipped_date" && !["shipped", "delivered"].includes(itemStatus)) {
      return item;
    }

    if (fieldName === "delivered_date" && itemStatus !== "delivered") {
      return item;
    }

    return {
      ...item,
      [fieldName]: nextValue,
    };
  });

  return {
    ...sale,
    items: nextItems,
  };
}
