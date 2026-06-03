const DEFAULT_LANGUAGE = "en";
const LANGUAGE_STORAGE_KEY = "language";

export function getCurrentLanguage() {
  if (typeof document !== "undefined") {
    const documentLanguage = `${document.documentElement.lang || ""}`.trim().toLowerCase();
    if (documentLanguage) {
      return documentLanguage;
    }
  }

  try {
    const storedLanguage = `${localStorage.getItem(LANGUAGE_STORAGE_KEY) || ""}`
      .trim()
      .toLowerCase();
    if (storedLanguage) {
      return storedLanguage;
    }
  } catch {
    // ignore storage access failures
  }

  return DEFAULT_LANGUAGE;
}

export function getLocale(language = null) {
  const activeLanguage = `${language || getCurrentLanguage()}`.trim().toLowerCase();
  return activeLanguage.startsWith("th") ? "th-TH" : "en-US";
}

export function formatNumber(value, language = null, options = {}) {
  return Number(value || 0).toLocaleString(getLocale(language), options);
}

export function formatMoney(value, language = null) {
  return `฿${formatNumber(value, language, {
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
  if (termType === "cash") return transactionDate;
  if (termType === "credit") {
    const days = parseInt(termDays, 10) || 0;
    if (!days) return "";
    const date = new Date(`${transactionDate}T00:00:00`);
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  }
  return "";
}
