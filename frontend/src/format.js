export function formatMoney(value) {
  const number = Number(value) || 0;
  return `฿${number.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(value) {
  if (!value) return "—";
  const match = `${value}`.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return `${value}`;
  const [, year, month, day] = match;
  return `${day}/${month}/${year.slice(-2)}`;
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
