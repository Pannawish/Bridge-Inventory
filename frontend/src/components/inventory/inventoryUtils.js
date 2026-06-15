import { formatNumber } from "../../format";

export function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getAvailable(row) {
  return num(row.available_stock ?? row.current_stock);
}

export function getDailyDemand(row) {
  if (row.average_daily_demand !== undefined && row.average_daily_demand !== null) {
    return num(row.average_daily_demand);
  }

  return num(row.predicted_7_day_demand) / 7;
}

export function getReorderLevel(row) {
  return num(row.reorder_level);
}

export function getStockValue(row) {
  if (row.stock_value !== undefined && row.stock_value !== null) {
    return num(row.stock_value);
  }

  return getAvailable(row) * num(row.average_unit_cost ?? row.unit_cost);
}

export function getBuyQuantity(row) {
  return num(row.recommended_restock);
}

export function getSupplierOptions(row) {
  return Array.isArray(row.supplier_options) ? row.supplier_options : [];
}

const WATCH_MULTIPLIER = 1.25;
const HEALTH_ORDER = { low: 0, watch: 1, dead: 2, healthy: 3 };

export function getHealth(row) {
  const available = getAvailable(row);
  const reorder = getReorderLevel(row);
  const demand = getDailyDemand(row);
  const oversold = num(row.oversold_units);
  const pendingSales = num(row.pending_sales_units);
  const incomingPo = num(row.incoming_purchase_units ?? row.pending_purchase_units);
  const delayedPo = num(row.delayed_purchase_units);
  const salesHistory = num(row.sales_history_units);

  if (oversold > 0) return "low";
  if (pendingSales > 0 && pendingSales > available + incomingPo) return "low";

  const hasNoSalesSignal = salesHistory <= 0 && demand <= 0 && pendingSales <= 0;
  if (hasNoSalesSignal) return "dead";

  if (reorder > 0 && available <= reorder) return "low";
  if (reorder > 0 && available <= reorder * WATCH_MULTIPLIER) return "watch";
  if (delayedPo > 0 || pendingSales > 0) return "watch";
  return "healthy";
}

export const SORT_OPTIONS = ["priority", "demand", "value", "days", "buy"];
export const HEALTH_KEYS = ["low", "watch", "healthy", "dead"];
export const DAYS_OPTIONS = ["7", "14", "30"];

export function sortRows(rows, sortKey) {
  const copy = [...rows];
  if (sortKey === "demand") {
    copy.sort((a, b) => getDailyDemand(b) - getDailyDemand(a));
  } else if (sortKey === "value") {
    copy.sort((a, b) => getStockValue(b) - getStockValue(a));
  } else if (sortKey === "days") {
    copy.sort((a, b) => {
      const aDays = a.days_until_stockout;
      const bDays = b.days_until_stockout;
      if (aDays === null || aDays === undefined) return 1;
      if (bDays === null || bDays === undefined) return -1;
      return aDays - bDays;
    });
  } else if (sortKey === "buy") {
    copy.sort((a, b) => getBuyQuantity(b) - getBuyQuantity(a));
  } else {
    copy.sort(
      (a, b) =>
        HEALTH_ORDER[getHealth(a)] - HEALTH_ORDER[getHealth(b)] ||
        getBuyQuantity(b) - getBuyQuantity(a)
    );
  }

  return copy;
}

export function formatUnits(value) {
  return formatNumber(value);
}

export function toggleInSet(setter, value) {
  setter((current) => {
    const next = new Set(current);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    return next;
  });
}
