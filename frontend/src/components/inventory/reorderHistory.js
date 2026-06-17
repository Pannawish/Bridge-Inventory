// Reconstructs a product's real stock-on-hand history and window-based sales
// velocity from the dated purchase/sales arrays already held in app state. This
// feeds the "Today in the middle" reorder-projection charts: the LEFT side is
// the genuine past stock pattern, and the window velocity sets the RIGHT-side
// projection slope.
import { getStoredPurchaseItemStatus } from "../../purchaseStatus";
import { getStoredSaleItemStatus } from "../../saleStatus";
import { isSaleStockDeducted } from "../../saleStock";
import { getItemBaseQuantity } from "../../unitConversion";

const MS_PER_DAY = 86_400_000;

// Selectable timeframes. Only ratios our data can actually back are exposed;
// `days: null` means "all history". Longer ratios (1Y/3Y/5Y) can be appended
// here later once enough history exists — every consumer reads this list.
export const REORDER_WINDOWS = [
  { key: "1m", label: "1M", days: 30 },
  { key: "3m", label: "3M", days: 90 },
  { key: "6m", label: "6M", days: 180 },
  { key: "all", label: "All", days: null },
];

export const DEFAULT_REORDER_WINDOW = "3m";

export function getReorderWindow(key) {
  return REORDER_WINDOWS.find((w) => w.key === key) || REORDER_WINDOWS[1];
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isFinite(d.getTime()) ? d : null;
}

export function dayKey(date) {
  const d = toDate(date);
  return d ? d.toISOString().slice(0, 10) : "";
}

export function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function daysBetween(a, b) {
  const da = toDate(a);
  const db = toDate(b);
  if (!da || !db) return 0;
  return Math.round((db - da) / MS_PER_DAY);
}

// Signed, dated stock movements for one product: +received purchases, −sold
// (stock-deducting) sale lines. Sorted oldest → newest.
export function collectStockEvents({ productId, purchases = [], sales = [] }) {
  const pid = `${productId}`;
  const events = [];

  (Array.isArray(purchases) ? purchases : []).forEach((purchase) => {
    if (!purchase) return;
    (purchase.items || []).forEach((item) => {
      if (`${item.product_id}` !== pid) return;
      if (getStoredPurchaseItemStatus(item, purchase.status) !== "received") return;
      const date = toDate(item.received_date || purchase.transaction_date);
      if (!date) return;
      const qty = getItemBaseQuantity(item);
      if (!(qty > 0)) return;
      events.push({ date, delta: qty, kind: "in" });
    });
  });

  (Array.isArray(sales) ? sales : []).forEach((sale) => {
    if (!sale) return;
    (sale.items || []).forEach((item) => {
      if (`${item.product_id}` !== pid) return;
      const status = getStoredSaleItemStatus(item, sale.status);
      if (!isSaleStockDeducted(status)) return;
      const date = toDate(sale.transaction_date);
      if (!date) return;
      const qty = getItemBaseQuantity(item);
      if (!(qty > 0)) return;
      events.push({ date, delta: -qty, kind: "out" });
    });
  });

  events.sort((a, b) => a.date - b.date);
  return events;
}

// Real stock-on-hand curve from `fromDate` (or first event) up to today, ANCHORED
// to the known current stock and walked backward so the final point is exact.
// Returns [{ date: "YYYY-MM-DD", qty }] — connect linearly for the depletion ramps.
export function buildStockHistory({ productId, purchases, sales, currentStock, fromDate = null }) {
  const events = collectStockEvents({ productId, purchases, sales });
  const today = startOfToday();
  const cur = Math.max(0, num(currentStock));

  let run = 0;
  const cum = events.map((e) => {
    run += e.delta;
    return { date: e.date, after: run };
  });
  const baseLevel = cur - run; // level before the very first event

  const from = toDate(fromDate) || events[0]?.date || today;

  // Fold any events before the window start into the opening level.
  let preCount = 0;
  while (preCount < cum.length && cum[preCount].date < from) preCount += 1;
  const levelAtFrom = baseLevel + (preCount > 0 ? cum[preCount - 1].after : 0);

  const points = [{ date: dayKey(from), qty: Math.max(0, levelAtFrom) }];
  for (let i = preCount; i < cum.length; i += 1) {
    if (cum[i].date > today) break;
    points.push({ date: dayKey(cum[i].date), qty: Math.max(0, baseLevel + cum[i].after) });
  }

  const last = points[points.length - 1];
  if (last.date === dayKey(today)) {
    last.qty = cur;
  } else {
    points.push({ date: dayKey(today), qty: cur });
  }
  return points;
}

// Stock history trimmed to the last `cycles` purchase receipts — the dashboard
// mini shows just the recent shape, not the whole span.
export function buildRecentStockHistory({ productId, purchases, sales, currentStock, cycles = 3 }) {
  const ins = collectStockEvents({ productId, purchases, sales }).filter((e) => e.delta > 0);
  const fromDate = ins.length > cycles ? ins[ins.length - cycles].date : null;
  return buildStockHistory({ productId, purchases, sales, currentStock, fromDate });
}

// Sales lines for one product inside a timeframe window, plus the velocity
// (units/day) that drives the projection. Mirrors the old buildSalesActivity
// shape so the detail table can render it directly.
export function collectProductSales({ productId, sales = [], windowDays = null, today = startOfToday() }) {
  const pid = `${productId}`;
  const cutoff = windowDays ? new Date(today.getTime() - (windowDays - 1) * MS_PER_DAY) : null;

  const entries = [];
  const orderIds = new Set();
  let totalUnits = 0;
  let firstDate = null;
  let lastDate = null;

  (Array.isArray(sales) ? sales : []).forEach((sale) => {
    if (!sale || sale.status === "cancelled") return;
    (sale.items || []).forEach((item, index) => {
      if (`${item.product_id}` !== pid) return;
      const status = getStoredSaleItemStatus(item, sale.status);
      if (status === "cancelled" || status === "returned") return;
      const date = toDate(sale.transaction_date);
      if (!date) return;
      if (cutoff && date < cutoff) return;
      const qty = getItemBaseQuantity(item);
      if (!(qty > 0)) return;
      entries.push({
        key: `${sale.id}-${item.id ?? index}`,
        ref: sale.reference_no || sale.id,
        date: sale.transaction_date || "",
        customer: sale.customer_name || "",
        qty,
      });
      totalUnits += qty;
      orderIds.add(`${sale.id}`);
      if (!firstDate || date < firstDate) firstDate = date;
      if (!lastDate || date > lastDate) lastDate = date;
    });
  });

  entries.sort((a, b) => String(b.date).localeCompare(String(a.date)));

  // Short windows read as a recent rate (÷ the whole horizon, so quiet days
  // count); "All" divides by the active span to match the backend's lifetime
  // average daily demand.
  let perDay = 0;
  if (windowDays) {
    perDay = totalUnits / windowDays;
  } else if (firstDate && lastDate) {
    const spanDays = Math.max(1, daysBetween(firstDate, lastDate) + 1);
    perDay = totalUnits / spanDays;
  }

  return { entries, totalUnits, orderCount: orderIds.size, perDay };
}
