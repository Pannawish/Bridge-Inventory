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

// Selectable timeframes. Each includes every confirmed transaction from today
// back through its window. NOTE: with only ~months of data the 1Y+ windows
// currently surface the same (all available) history — they're here so the view
// deepens automatically as real history accrues.
export const REORDER_WINDOWS = [
  { key: "1m", label: "1M", days: 30 },
  { key: "3m", label: "3M", days: 90 },
  { key: "6m", label: "6M", days: 180 },
  { key: "1y", label: "1Y", days: 365 },
  { key: "2y", label: "2Y", days: 730 },
  { key: "3y", label: "3Y", days: 1095 },
  { key: "5y", label: "5Y", days: 1825 },
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
// to the known current stock so the final point is exact. Rendered as a true
// sawtooth: purchase receipts are vertical UP jumps, sales are downward slopes.
// Returns [{ date: "YYYY-MM-DD", qty }].
export function buildStockHistory({ productId, purchases, sales, currentStock, fromDate = null }) {
  const today = startOfToday();
  // Only events up to today contribute to the on-hand-now anchor.
  const events = collectStockEvents({ productId, purchases, sales }).filter((e) => e.date <= today);
  const cur = Math.max(0, num(currentStock));
  const total = events.reduce((s, e) => s + e.delta, 0);
  const baseLevel = cur - total; // level before the very first event

  const from = toDate(fromDate) || events[0]?.date || today;
  const points = [];
  const push = (date, level) => points.push({ date: dayKey(date), qty: Math.max(0, level) });

  let lvl = baseLevel;
  let opened = false;
  events.forEach((e) => {
    const before = lvl;
    lvl += e.delta;
    if (e.date < from) return; // folded into the opening level
    if (!opened) {
      push(from, before); // carry the pre-window level to the window start
      opened = true;
    }
    if (e.kind === "in") {
      // receipt → vertical jump up (hold the level, then jump)
      push(e.date, before);
      push(e.date, lvl);
    } else {
      // sale → slope down to the new level
      push(e.date, lvl);
    }
  });

  if (!opened) push(from, lvl); // no in-window events: flat at the carried level

  const last = points[points.length - 1];
  if (last.date === dayKey(today)) last.qty = cur;
  else push(today, cur);

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

  // Velocity = units ÷ the days actually covered (earliest in-window sale →
  // today), capped at the window length. This keeps the rate honest when the
  // window is longer than the history we actually have (e.g. a 1Y window over
  // 5 months of data divides by ~150 days, not 365).
  let perDay = 0;
  if (entries.length && firstDate) {
    const coverDays = Math.max(1, Math.min(windowDays || Infinity, daysBetween(firstDate, today) + 1));
    perDay = totalUnits / coverDays;
  }

  return { entries, totalUnits, orderCount: orderIds.size, perDay };
}

// Received purchase lines for one product inside a timeframe window — the
// lead-time proof shown above the sales history. Each entry carries its
// realised lead time (order date → received date).
export function collectProductPurchases({ productId, purchases = [], windowDays = null, today = startOfToday() }) {
  const pid = `${productId}`;
  const cutoff = windowDays ? new Date(today.getTime() - (windowDays - 1) * MS_PER_DAY) : null;

  const entries = [];
  const orderIds = new Set();
  let totalUnits = 0;
  let leadSum = 0;
  let leadCount = 0;

  (Array.isArray(purchases) ? purchases : []).forEach((purchase) => {
    if (!purchase) return;
    (purchase.items || []).forEach((item, index) => {
      if (`${item.product_id}` !== pid) return;
      if (getStoredPurchaseItemStatus(item, purchase.status) !== "received") return;
      const recv = toDate(item.received_date || purchase.transaction_date);
      if (!recv) return;
      if (cutoff && recv < cutoff) return;
      const qty = getItemBaseQuantity(item);
      if (!(qty > 0)) return;
      const ordered = toDate(purchase.transaction_date);
      const leadDays = ordered ? Math.max(0, daysBetween(ordered, recv)) : null;
      entries.push({
        key: `${purchase.id}-${item.id ?? index}`,
        ref: purchase.reference_no || purchase.id,
        date: item.received_date || purchase.transaction_date || "",
        supplier: purchase.supplier_name || "",
        qty,
        leadDays,
      });
      totalUnits += qty;
      orderIds.add(`${purchase.id}`);
      if (leadDays != null) {
        leadSum += leadDays;
        leadCount += 1;
      }
    });
  });

  entries.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const avgLead = leadCount > 0 ? leadSum / leadCount : 0;
  return { entries, totalUnits, orderCount: orderIds.size, avgLead };
}
