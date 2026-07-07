// Utility module for shared component: transaction discounts.

export function getActiveTransactionDiscount(enabled, value) {
  const numericValue = Number(value);

  if (!enabled || !Number.isFinite(numericValue) || numericValue <= 0) {
    return null;
  }

  return Math.min(100, Math.max(0, numericValue));
}

export function getEffectiveDiscounts(discounts, transactionDiscount = null) {
  const itemDiscounts = Array.isArray(discounts) && discounts.length ? discounts : [0];

  if (transactionDiscount === null || transactionDiscount === undefined) {
    return itemDiscounts;
  }

  return [...itemDiscounts, transactionDiscount];
}

export function computeDiscountedAmount(quantity, unitPrice, discounts) {
  const qty = Number(quantity) || 0;
  const price = Number(unitPrice) || 0;
  const multiplier = (discounts || []).reduce((acc, discount) => {
    const clamped = Math.min(100, Math.max(0, Number(discount) || 0));
    return acc * (1 - clamped / 100);
  }, 1);

  return qty * price * multiplier;
}
