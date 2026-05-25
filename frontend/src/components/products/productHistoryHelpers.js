import { itemMatchesProduct } from "./productUtils";

export const PRODUCT_HISTORY_PAGE_SIZE = 5;

export function createLocalPagination(count, page, pageSize = PRODUCT_HISTORY_PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  const safePage = Math.min(Math.max(1, Number(page) || 1), totalPages);

  return {
    count,
    next: safePage < totalPages,
    previous: safePage > 1,
    page: safePage,
    page_size: pageSize,
    total_pages: totalPages,
  };
}

export function getPaginatedRows(rows, pagination) {
  const start = (pagination.page - 1) * pagination.page_size;
  return rows.slice(start, start + pagination.page_size);
}

export function getProductPurchaseHistoryEntries(product, purchases = []) {
  return purchases.flatMap((purchase) =>
    (purchase.items || [])
      .filter((item) => itemMatchesProduct(item, product))
      .map((item) => ({ purchase, item }))
  );
}

export function getProductSalesHistoryEntries(product, sales = []) {
  return sales.flatMap((sale) =>
    (sale.items || [])
      .filter((item) => itemMatchesProduct(item, product))
      .map((item) => ({ sale, item }))
  );
}

export function loadedProductHistoryHasTransactions(history) {
  if (!history) {
    return false;
  }

  return Boolean(
    history.hasTransactionHistory ||
      history.has_transaction_history ||
      history.purchases?.length ||
      history.sales?.length
  );
}

export function collectionsHaveProductTransactionHistory(product, purchases = [], sales = []) {
  if (!product) {
    return false;
  }

  return (
    purchases.some((purchase) =>
      (purchase.items || []).some((item) => itemMatchesProduct(item, product))
    ) ||
    sales.some((sale) =>
      (sale.items || []).some((item) => itemMatchesProduct(item, product))
    )
  );
}
