import {
  computePaymentBatchActualPaymentDate,
  computePaymentBatchStatusFromLines,
  getToday,
} from "./paymentBatchUtils";

/**
 * Pure state transformation: toggle the paid flag on a single line.
 */
export function toggleLinePaidTransform(current, lineId) {
  const lines = (current.lines || []).map((line) => {
    if (line.id !== lineId) return line;
    const nextPaid = !line.paid;
    return {
      ...line,
      paid: nextPaid,
      paid_date: nextPaid ? line.paid_date || getToday() : null,
    };
  });
  return {
    ...current,
    lines,
    status: computePaymentBatchStatusFromLines(lines, current.status),
    actual_payment_date: computePaymentBatchActualPaymentDate(lines),
  };
}

/**
 * Pure state transformation: update the paid_date on a single line.
 */
export function updateLinePaidDateTransform(current, lineId, value) {
  const lines = (current.lines || []).map((line) =>
    line.id === lineId ? { ...line, paid_date: value } : line
  );
  return {
    ...current,
    lines,
    actual_payment_date: computePaymentBatchActualPaymentDate(lines),
  };
}

/**
 * Pure state transformation: mark all lines as paid.
 */
export function markAllPaidTransform(current) {
  const today = getToday();
  const lines = (current.lines || []).map((line) => ({
    ...line,
    paid: true,
    paid_date: line.paid_date || today,
  }));
  return {
    ...current,
    lines,
    status: computePaymentBatchStatusFromLines(lines, current.status),
    actual_payment_date: computePaymentBatchActualPaymentDate(lines),
  };
}

/**
 * Pure state transformation: clear all paid flags.
 */
export function clearAllPaidTransform(current) {
  const lines = (current.lines || []).map((line) => ({
    ...line,
    paid: false,
    paid_date: null,
  }));
  return {
    ...current,
    lines,
    status: computePaymentBatchStatusFromLines(lines, current.status),
    actual_payment_date: null,
  };
}
