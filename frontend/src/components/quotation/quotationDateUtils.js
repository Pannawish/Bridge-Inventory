export function getToday() {
  return formatDateInputValue(new Date());
}

export function formatDateInputValue(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function daysAgoInputValue(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return formatDateInputValue(date);
}

export function addDays(dateString, days) {
  const [year, month, day] = `${dateString}`.split("-").map(Number);
  const date = year && month && day ? new Date(year, month - 1, day) : new Date();

  date.setDate(date.getDate() + days);
  return formatDateInputValue(date);
}

export function addBusinessDays(dateString, days) {
  const [year, month, day] = `${dateString}`.split("-").map(Number);
  const date = year && month && day ? new Date(year, month - 1, day) : new Date();
  let added = 0;

  while (added < days) {
    date.setDate(date.getDate() + 1);
    const dayOfWeek = date.getDay();

    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      added += 1;
    }
  }

  return formatDateInputValue(date);
}

export function computeValidUntilDate(quotationDate, days, dayType) {
  const normalizedDays = Number(days);

  if (!quotationDate || !normalizedDays || normalizedDays < 1) {
    return "";
  }

  return dayType === "business"
    ? addBusinessDays(quotationDate, normalizedDays)
    : addDays(quotationDate, normalizedDays);
}

export function formatDisplayDate(dateString) {
  if (!dateString) {
    return "";
  }

  const [year, month, day] = `${dateString}`.split("-");
  return `${day}/${month}/${year.slice(2)}`;
}

export function getNextQuotationReference(quotations = []) {
  const referencePattern = /^QT-(\d{6})$/;
  const maxSerial = quotations.reduce((max, quotation) => {
    const match = `${quotation.reference_no || ""}`.match(referencePattern);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);

  return `QT-${String(maxSerial + 1).padStart(6, "0")}`;
}
