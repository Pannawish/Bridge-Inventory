// Helper utilities for credit note behavior.

export const CREDIT_NOTE_STATUS_LABEL_KEYS = {
  issued: "creditNote.statusIssued",
  cancelled: "creditNote.statusCancelled",
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

export function formatCreditNoteStatus(status, t) {
  const key = CREDIT_NOTE_STATUS_LABEL_KEYS[status];
  return key ? t(key) : (status || "—");
}

export function getNextCreditNoteReferenceNo(creditNotes) {
  const today = new Date();
  const yearMonth = `${(today.getFullYear() + 543).toString().slice(-2)}${String(
    today.getMonth() + 1
  ).padStart(2, "0")}`;
  const prefix = `CN-${yearMonth}-`;
  const referencePattern = new RegExp(`^${prefix}(\\d+)$`);
  const maxSerial = creditNotes.reduce((max, row) => {
    const match = `${row.reference_no || ""}`.match(referencePattern);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `${prefix}${String(maxSerial + 1).padStart(3, "0")}`;
}

export function creditNoteMatchesQuery(note, query, t) {
  const text = [
    note.reference_no,
    note.customer_name,
    note.sale_reference_no,
    note.billing_note_reference_no,
    formatCreditNoteStatus(note.status, t),
    note.credit_note_date,
    note.note,
    ...(note.lines || []).map((line) => line.product_name),
  ]
    .map((value) => `${value ?? ""}`.toLowerCase())
    .join(" ");
  return text.includes(query);
}

export function creditNoteInDateRange(note, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return true;
  const date = note.credit_note_date || "";
  if (dateFrom && date < dateFrom) return false;
  if (dateTo && date > dateTo) return false;
  return true;
}

export function customerBillingNoteOptions(
  billingNotes,
  customerName,
  includeId = ""
) {
  return billingNotes.filter(
    (note) =>
      note.customer_name === customerName &&
      (note.status !== "cancelled" || note.id === includeId)
  );
}
