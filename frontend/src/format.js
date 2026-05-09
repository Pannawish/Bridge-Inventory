export function formatMoney(value) {
  const number = Number(value) || 0;
  return `฿${number.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(value) {
  return value ? `${value}` : "—";
}

export function computePaymentDate(transactionDate, termType, termDays) {
  if (!transactionDate || !termType) return "";
  if (termType === "debit") return transactionDate;
  if (termType === "credit") {
    const days = parseInt(termDays, 10) || 0;
    if (!days) return "";
    const date = new Date(`${transactionDate}T00:00:00`);
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  }
  return "";
}
