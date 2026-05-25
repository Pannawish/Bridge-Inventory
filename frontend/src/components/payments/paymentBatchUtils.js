export const PAYMENT_BATCH_STATUS_LABEL_KEYS = {
  draft: "paymentBatch.statusDraft",
  scheduled: "paymentBatch.statusScheduled",
  partially_paid: "paymentBatch.statusPartiallyPaid",
  paid: "paymentBatch.statusPaid",
  cancelled: "paymentBatch.statusCancelled",
};

export function getToday() {
  return new Date().toISOString().split("T")[0];
}

export function daysAgoString(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatPaymentBatchStatus(status, t) {
  const key = PAYMENT_BATCH_STATUS_LABEL_KEYS[status];
  return key ? t(key) : (status || "—");
}

export function getNextPaymentBatchReferenceNo(paymentBatches) {
  const today = new Date();
  const yearMonth = `${(today.getFullYear() + 543).toString().slice(-2)}${String(
    today.getMonth() + 1
  ).padStart(2, "0")}`;
  const prefix = `PMT-${yearMonth}-`;
  const referencePattern = new RegExp(`^${prefix}(\\d+)$`);
  const maxSerial = paymentBatches.reduce((max, row) => {
    const match = `${row.reference_no || ""}`.match(referencePattern);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  const next = maxSerial + 1;
  return `${prefix}${String(next).padStart(3, "0")}`;
}

export function isPurchaseAvailableForPaymentBatch(
  purchase,
  paymentBatches,
  currentPaymentBatchId = null
) {
  const eligibleStatuses = new Set(["received", "partially_received"]);
  if (!eligibleStatuses.has(purchase.status)) return false;

  return !paymentBatches.some(
    (batch) =>
      batch.id !== currentPaymentBatchId &&
      batch.status !== "cancelled" &&
      (batch.lines || []).some((line) => `${line.purchase}` === `${purchase.id}`)
  );
}

export function getPurchasePayable(purchase) {
  const payable = Number(purchase.payable_total);
  if (Number.isFinite(payable) && payable > 0) {
    return payable;
  }
  return Number(purchase.grand_total) || 0;
}

export function buildPaymentBatchLinesFromPurchases(selectedPurchases) {
  return selectedPurchases.map((purchase) => ({
    id: `temp-line-${purchase.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    purchase: purchase.id,
    purchase_id: purchase.id,
    purchase_reference_no: purchase.reference_no,
    purchase_transaction_date: purchase.transaction_date,
    purchase_status: purchase.status,
    purchase_grand_total: purchase.grand_total,
    purchase_payable_total: purchase.payable_total,
    purchase_payment_term_type: purchase.payment_term_type,
    purchase_payment_term_days: purchase.payment_term_days,
    purchase_payment_date: purchase.payment_date,
    paid: false,
    paid_date: null,
    amount: getPurchasePayable(purchase),
  }));
}

export function computePaymentBatchStatusFromLines(lines, currentStatus) {
  if (currentStatus === "cancelled" || currentStatus === "draft") {
    return currentStatus;
  }
  if (!lines.length) return "scheduled";
  const paidCount = lines.filter((line) => line.paid).length;
  if (paidCount === 0) return "scheduled";
  if (paidCount === lines.length) return "paid";
  return "partially_paid";
}

export function computePaymentBatchActualPaymentDate(lines) {
  const dates = lines
    .filter((line) => line.paid && line.paid_date)
    .map((line) => line.paid_date);
  if (!dates.length) return null;
  return dates.reduce((max, current) => (current > max ? current : max));
}

export function paymentBatchMatchesQuery(batch, query, t) {
  const text = [
    batch.reference_no,
    batch.supplier_name,
    formatPaymentBatchStatus(batch.status, t),
    batch.batch_date,
    batch.planned_payment_date,
    batch.actual_payment_date,
    batch.bank_reference,
    batch.note,
    ...(batch.lines || []).flatMap((line) => [
      line.purchase_reference_no,
      line.paid_date,
    ]),
  ]
    .map((value) => `${value ?? ""}`.toLowerCase())
    .join(" ");
  return text.includes(query);
}

export function paymentBatchInDateRange(batch, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return true;
  const date = batch.batch_date || "";
  if (dateFrom && date < dateFrom) return false;
  if (dateTo && date > dateTo) return false;
  return true;
}
