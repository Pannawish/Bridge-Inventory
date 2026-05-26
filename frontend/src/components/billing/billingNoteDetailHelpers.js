import {
  computeBillingNoteActualPaymentDate,
  computeBillingNoteStatusFromLines,
  getToday,
} from "./billingNoteUtils";

/**
 * Pure state transformation: toggle the received flag on a single line.
 */
export function toggleLineReceivedTransform(current, lineId) {
  const lines = (current.lines || []).map((line) => {
    if (line.id !== lineId) return line;
    const nextReceived = !line.received;
    return {
      ...line,
      received: nextReceived,
      received_date: nextReceived ? line.received_date || getToday() : null,
    };
  });
  return {
    ...current,
    lines,
    status: computeBillingNoteStatusFromLines(lines, current.status),
    actual_payment_date: computeBillingNoteActualPaymentDate(lines),
  };
}

/**
 * Pure state transformation: update the received_date on a single line.
 */
export function updateLineReceivedDateTransform(current, lineId, value) {
  const lines = (current.lines || []).map((line) =>
    line.id === lineId ? { ...line, received_date: value } : line
  );
  return {
    ...current,
    lines,
    actual_payment_date: computeBillingNoteActualPaymentDate(lines),
  };
}

/**
 * Pure state transformation: mark all lines as received.
 */
export function markAllReceivedTransform(current) {
  const today = getToday();
  const lines = (current.lines || []).map((line) => ({
    ...line,
    received: true,
    received_date: line.received_date || today,
  }));
  return {
    ...current,
    lines,
    status: computeBillingNoteStatusFromLines(lines, current.status),
    actual_payment_date: computeBillingNoteActualPaymentDate(lines),
  };
}

/**
 * Pure state transformation: clear all received flags.
 */
export function clearAllReceivedTransform(current) {
  const lines = (current.lines || []).map((line) => ({
    ...line,
    received: false,
    received_date: null,
  }));
  return {
    ...current,
    lines,
    status: computeBillingNoteStatusFromLines(lines, current.status),
    actual_payment_date: null,
  };
}

/**
 * Compute the credit note totals for a billing note draft.
 */
export function computeCreditSummary(draft) {
  const creditTotal = (draft.credit_notes || [])
    .filter((credit) => credit.status !== "cancelled")
    .reduce((acc, credit) => acc + (Number(credit.total_amount) || 0), 0);
  const netPayable = (Number(draft.total_amount) || 0) - creditTotal;
  return { creditTotal, netPayable };
}
