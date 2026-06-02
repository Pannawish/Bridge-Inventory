import { getItemBaseQuantity } from "../../unitConversion";
import { computeItemAmount } from "./productUtils";

/**
 * Reads the transaction document off a history entry, regardless of type.
 * Purchase entries are shaped { purchase, item }; sale entries { sale, item }.
 */
function getEntryTransaction(entry, type) {
  return type === "purchase" ? entry?.purchase : entry?.sale;
}

/**
 * The counter-party on an entry: supplier for purchases, customer for sales.
 */
export function getEntryPartyName(entry, type) {
  const transaction = getEntryTransaction(entry, type);
  return type === "purchase"
    ? `${transaction?.supplier_name ?? ""}`.trim()
    : `${transaction?.customer_name ?? ""}`.trim();
}

export function getEntryDate(entry, type) {
  return `${getEntryTransaction(entry, type)?.transaction_date ?? ""}`;
}

/**
 * Cost (purchase) or price (sale) per BASE unit, after item + bill discounts.
 * Using the base unit keeps buy and sell comparable even when they were
 * entered in different units (e.g. bought by box, sold by piece).
 */
export function getEntryBaseUnitValue(entry, type) {
  const transaction = getEntryTransaction(entry, type);
  const baseQuantity = getItemBaseQuantity(entry?.item);

  if (!(baseQuantity > 0)) {
    return null;
  }

  return computeItemAmount(entry?.item, transaction) / baseQuantity;
}

/**
 * Distinct, sorted party names present in a set of history entries.
 */
export function buildPartyOptions(entries, type) {
  const seen = new Set();

  entries.forEach((entry) => {
    const name = getEntryPartyName(entry, type);
    if (name) {
      seen.add(name);
    }
  });

  return Array.from(seen).sort((left, right) =>
    left.localeCompare(right, undefined, { sensitivity: "base" })
  );
}

/**
 * Scopes entries by party name and/or transaction date range.
 * Empty filter values mean "no constraint".
 */
export function filterHistoryEntries(entries, type, { party = "", dateFrom = "", dateTo = "" } = {}) {
  const normalizedParty = `${party ?? ""}`.trim().toLowerCase();

  if (!normalizedParty && !dateFrom && !dateTo) {
    return entries;
  }

  return entries.filter((entry) => {
    if (normalizedParty && getEntryPartyName(entry, type).toLowerCase() !== normalizedParty) {
      return false;
    }

    const date = getEntryDate(entry, type);
    if (dateFrom && date && date < dateFrom) {
      return false;
    }
    if (dateTo && date && date > dateTo) {
      return false;
    }

    return true;
  });
}

/**
 * Reduces entries to a price summary in base-unit terms:
 *  - last:     most recent base-unit value
 *  - lastDate: date of that most recent value
 *  - avg:      quantity-weighted average base-unit value (total amount / total base qty)
 *  - count:    number of contributing entries
 */
export function summarizeEntries(entries, type) {
  let totalAmount = 0;
  let totalBaseQuantity = 0;
  let last = null;

  entries.forEach((entry) => {
    const baseUnitValue = getEntryBaseUnitValue(entry, type);
    if (baseUnitValue === null) {
      return;
    }

    const transaction = getEntryTransaction(entry, type);
    const baseQuantity = getItemBaseQuantity(entry?.item);
    totalAmount += computeItemAmount(entry?.item, transaction);
    totalBaseQuantity += baseQuantity;

    const date = getEntryDate(entry, type);
    if (!last || date >= last.date) {
      last = { value: baseUnitValue, date };
    }
  });

  return {
    last: last?.value ?? null,
    lastDate: last?.date ?? "",
    avg: totalBaseQuantity > 0 ? totalAmount / totalBaseQuantity : null,
    count: entries.length,
  };
}

function computeMargin(buyValue, sellValue) {
  if (buyValue === null || sellValue === null) {
    return { amount: null, percent: null };
  }

  const amount = sellValue - buyValue;
  const percent = buyValue ? (amount / buyValue) * 100 : null;
  return { amount, percent };
}

/**
 * Buy/sell summaries plus the spread between them, both on the latest deal
 * and on the (typical) weighted averages.
 */
export function computePriceInsights(purchaseEntries = [], saleEntries = []) {
  const buy = summarizeEntries(purchaseEntries, "purchase");
  const sell = summarizeEntries(saleEntries, "sale");

  return {
    buy,
    sell,
    marginLast: computeMargin(buy.last, sell.last),
    marginAvg: computeMargin(buy.avg, sell.avg),
  };
}
