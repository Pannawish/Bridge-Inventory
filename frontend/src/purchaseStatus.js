// Purchase status derivation shared by forms and history views.

export const purchaseStatuses = [
  "draft",
  "ordered",
  "partially_received",
  "received",
  "cancelled",
];

export const purchaseItemStatuses = ["pending", "received", "cancelled"];
export const editablePurchaseItemStatuses = ["pending", "received", "cancelled"];

export function formatStatusLabel(status) {
  return `${status || ""}`
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function getTodayString(date = new Date()) {
  return date.toISOString().split("T")[0];
}

function getDateMs(dateValue) {
  if (!dateValue) {
    return null;
  }

  const date = new Date(`${dateValue}T00:00:00`);
  const time = date.getTime();

  return Number.isFinite(time) ? time : null;
}

export function formatPurchaseLeadTime(item, purchase) {
  const startMs = getDateMs(purchase?.transaction_date);
  const receivedMs = getDateMs(item?.received_date);

  if (startMs === null || receivedMs === null) {
    return "—";
  }

  const days = Math.max(0, Math.round((receivedMs - startMs) / 86400000));
  return `${days} days`;
}

export function getInitialPurchaseItemStatus(purchaseStatus = "ordered") {
  if (purchaseStatus === "received") {
    return "received";
  }

  if (purchaseStatus === "cancelled") {
    return "cancelled";
  }

  return "pending";
}

export function getStoredPurchaseItemStatus(item, purchaseStatus = "ordered") {
  const status = item.item_status || item.status;

  if (status === "ordered" || status === "in_transit" || status === "draft") {
    return "pending";
  }

  if (purchaseItemStatuses.includes(status)) {
    return status;
  }

  return getInitialPurchaseItemStatus(purchaseStatus);
}

export function getPurchaseItemDisplayStatus(
  item,
  purchaseStatus = "ordered",
  todayString = getTodayString()
) {
  const itemStatus = getStoredPurchaseItemStatus(item, purchaseStatus);

  if (itemStatus === "received" || itemStatus === "cancelled") {
    return itemStatus;
  }

  if (item.expected_delivery_date && item.expected_delivery_date < todayString) {
    return "delayed";
  }

  return "pending";
}

export function getPurchaseItemStatusCounts(
  items = [],
  purchaseStatus = "ordered",
  todayString = getTodayString()
) {
  return items.reduce(
    (counts, item) => {
      const status = getPurchaseItemDisplayStatus(item, purchaseStatus, todayString);
      return {
        ...counts,
        [status]: counts[status] + 1,
      };
    },
    { pending: 0, delayed: 0, received: 0, cancelled: 0 }
  );
}

export function getPurchaseStatusFromItems(purchase) {
  const items = purchase.items || [];

  if (!items.length) {
    return purchase.status || "draft";
  }

  const storedStatuses = items.map((item) =>
    getStoredPurchaseItemStatus(item, purchase.status)
  );
  const activeStatuses = storedStatuses.filter((status) => status !== "cancelled");

  if (storedStatuses.every((status) => status === "cancelled")) {
    return "cancelled";
  }

  if (!activeStatuses.length) {
    return "cancelled";
  }

  if (activeStatuses.every((status) => status === "received")) {
    return "received";
  }

  if (activeStatuses.some((status) => status === "received")) {
    return "partially_received";
  }

  if (purchase.status === "draft") {
    return "draft";
  }

  return "ordered";
}

export function applyPurchaseStatusToItems(purchase, nextStatus) {
  const today = getTodayString();
  const nextItems = (purchase.items || []).map((item) => {
    if (nextStatus === "received") {
      return {
        ...item,
        item_status: "received",
        received_date: item.received_date || today,
      };
    }

    if (nextStatus === "cancelled") {
      return {
        ...item,
        item_status: "cancelled",
        received_date: "",
      };
    }

    if (nextStatus === "draft" || nextStatus === "ordered") {
      return {
        ...item,
        item_status: "pending",
        received_date: "",
      };
    }

    return item;
  });
  const nextPurchase = { ...purchase, status: nextStatus, items: nextItems };

  return {
    ...nextPurchase,
    status: getPurchaseStatusFromItems(nextPurchase),
  };
}

export function markPurchaseItemReceived(purchase, itemIndex, receivedDate = getTodayString()) {
  return updatePurchaseItemStatus(purchase, itemIndex, "received", receivedDate);
}

export function updatePurchaseItemStatus(
  purchase,
  itemIndex,
  nextStatus,
  receivedDate = getTodayString()
) {
  const storedStatus = purchaseItemStatuses.includes(nextStatus) ? nextStatus : "pending";
  const nextItems = (purchase.items || []).map((item, index) => {
    if (index !== itemIndex) {
      return item;
    }

    return {
      ...item,
      item_status: storedStatus,
      received_date:
        storedStatus === "received" ? item.received_date || receivedDate : "",
    };
  });
  const nextPurchase = { ...purchase, items: nextItems };

  return {
    ...nextPurchase,
    status: getPurchaseStatusFromItems(nextPurchase),
  };
}

export function updatePurchaseItemReceivedDate(purchase, itemIndex, receivedDate) {
  const nextItems = (purchase.items || []).map((item, index) => {
    if (index !== itemIndex) {
      return item;
    }

    if (getStoredPurchaseItemStatus(item, purchase.status) !== "received") {
      return item;
    }

    return {
      ...item,
      received_date: receivedDate || getTodayString(),
    };
  });

  return {
    ...purchase,
    items: nextItems,
  };
}
