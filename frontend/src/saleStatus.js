import { formatStatusLabel, getTodayString } from "./purchaseStatus";

export { formatStatusLabel, getTodayString };

export const saleStatuses = ["draft", "packed", "shipped", "delivered", "cancelled"];
export const saleItemStatuses = ["pending", "packed", "shipped", "delivered", "cancelled"];
export const editableSaleItemStatuses = ["pending", "packed", "shipped", "delivered"];

export function getInitialSaleItemStatus(saleStatus = "draft") {
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
    { pending: 0, packed: 0, shipped: 0, delivered: 0, cancelled: 0 }
  );
}

export function getSaleStatusFromItems(sale) {
  const items = sale.items || [];

  if (!items.length) {
    return sale.status || "draft";
  }

  const storedStatuses = items.map((item) => getStoredSaleItemStatus(item, sale.status));

  if (storedStatuses.every((status) => status === "cancelled")) {
    return "cancelled";
  }

  if (storedStatuses.every((status) => status === "delivered")) {
    return "delivered";
  }

  if (storedStatuses.some((status) => status === "shipped" || status === "delivered")) {
    return "shipped";
  }

  if (storedStatuses.some((status) => status === "packed")) {
    return "packed";
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
