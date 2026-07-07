// Helper utilities for billing note behavior.

export const BILLING_NOTE_STATUS_LABEL_KEYS = {
  draft: "billingNote.statusDraft",
  issued: "billingNote.statusIssued",
  partially_received: "billingNote.statusPartiallyReceived",
  fully_received: "billingNote.statusFullyReceived",
  cancelled: "billingNote.statusCancelled",
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

export function formatBillingNoteStatus(status, t) {
  const key = BILLING_NOTE_STATUS_LABEL_KEYS[status];
  return key ? t(key) : (status || "—");
}

export function getNextBillingNoteReferenceNo(billingNotes) {
  const today = new Date();
  const yearMonth = `${(today.getFullYear() + 543).toString().slice(-2)}${String(
    today.getMonth() + 1
  ).padStart(2, "0")}`;
  const prefix = `BN-${yearMonth}-`;
  const referencePattern = new RegExp(`^${prefix}(\\d+)$`);
  const maxSerial = billingNotes.reduce((max, row) => {
    const match = `${row.reference_no || ""}`.match(referencePattern);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  const next = maxSerial + 1;
  return `${prefix}${String(next).padStart(3, "0")}`;
}

export function isSaleAvailableForBillingNote(
  sale,
  billingNotes,
  currentBillingNoteId = null
) {
  const eligibleStatuses = new Set(["delivered", "partially_delivered", "shipped"]);
  if (!eligibleStatuses.has(sale.status)) {
    return false;
  }

  return !billingNotes.some(
    (note) =>
      note.id !== currentBillingNoteId &&
      note.status !== "cancelled" &&
      (note.lines || []).some((line) => `${line.sale}` === `${sale.id}`)
  );
}

export function filterLinkableCreditNotesForCustomer(creditNotes, customerName) {
  return (creditNotes || []).filter(
    (note) =>
      note.customer_name === customerName &&
      note.status !== "cancelled" &&
      !note.billing_note
  );
}

export function buildBillingNoteLinesFromSales(selectedSales) {
  return selectedSales.map((sale) => ({
    id: `temp-line-${sale.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    sale: sale.id,
    sale_id: sale.id,
    sale_reference_no: sale.reference_no,
    sale_transaction_date: sale.transaction_date,
    sale_status: sale.status,
    sale_grand_total: sale.grand_total,
    sale_payment_term_type: sale.payment_term_type,
    sale_payment_term_days: sale.payment_term_days,
    sale_payment_date: sale.payment_date,
    received: false,
    received_date: null,
    amount: Number(sale.grand_total) || 0,
  }));
}

export function computeBillingNoteStatusFromLines(lines, currentStatus) {
  if (currentStatus === "cancelled" || currentStatus === "draft") {
    return currentStatus;
  }
  if (!lines.length) return "issued";
  const receivedCount = lines.filter((line) => line.received).length;
  if (receivedCount === 0) return "issued";
  if (receivedCount === lines.length) return "fully_received";
  return "partially_received";
}

export function computeBillingNoteActualPaymentDate(lines) {
  const dates = lines
    .filter((line) => line.received && line.received_date)
    .map((line) => line.received_date);
  if (!dates.length) return null;
  return dates.reduce((max, current) => (current > max ? current : max));
}

export function billingNoteMatchesQuery(note, query, t) {
  const text = [
    note.reference_no,
    note.customer_name,
    formatBillingNoteStatus(note.status, t),
    note.billing_note_date,
    note.expected_payment_date,
    note.actual_payment_date,
    note.bank_reference,
    note.note,
    ...(note.lines || []).flatMap((line) => [
      line.sale_reference_no,
      line.received_date,
    ]),
  ]
    .map((value) => `${value ?? ""}`.toLowerCase())
    .join(" ");
  return text.includes(query);
}

export function billingNoteInDateRange(note, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return true;
  const date = note.billing_note_date || "";
  if (dateFrom && date < dateFrom) return false;
  if (dateTo && date > dateTo) return false;
  return true;
}
