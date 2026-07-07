// React hook for shared application hook state and actions.

import { useEffect, useMemo, useState } from "react";
import {
  getProductAllNames,
  getProductCategoryLabel,
  getProductMetrics,
  getProductPreviousSkus,
} from "../components/products/productUtils";

export function useProductDirectoryFilters({
  products = [],
  allProducts = [],
  categories = [],
  purchases = [],
  sales = [],
  pagination = null,
  onPageRequest,
  t,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showProductFilters, setShowProductFilters] = useState(false);
  const [showAllRows, setShowAllRows] = useState(false);

  const isServerPaginated = Boolean(pagination && onPageRequest);
  const normalizedSearch = searchTerm.trim().toLowerCase();

  const productsWithMetrics = useMemo(
    () =>
      products.map((product) => ({
        product,
        metrics: getProductMetrics(product, purchases, sales),
        categoryLabel: getProductCategoryLabel(product, categories),
      })),
    [categories, products, purchases, sales]
  );

  const categoryOptions = useMemo(
    () =>
      [
        ...new Set(
          allProducts
            .map((product) => getProductCategoryLabel(product, categories))
            .filter(Boolean)
        ),
      ].sort((left, right) => left.localeCompare(right)),
    [allProducts, categories]
  );

  const filteredProductsWithMetrics = useMemo(() => {
    if (isServerPaginated) {
      return productsWithMetrics;
    }

    return productsWithMetrics.filter(({ product, metrics, categoryLabel }) => {
      const searchableNames = getProductAllNames(product);
      const matchesSearch =
        !normalizedSearch ||
        searchableNames.some((name) => name.toLowerCase().includes(normalizedSearch)) ||
        categoryLabel.toLowerCase().includes(normalizedSearch) ||
        `${product.sku ?? ""}`.toLowerCase().includes(normalizedSearch) ||
        getProductPreviousSkus(product).some((sku) =>
          sku.toLowerCase().includes(normalizedSearch)
        ) ||
        `${product.productDisplayId}`.includes(normalizedSearch);

      if (!matchesSearch) {
        return false;
      }

      if (categoryFilter !== "all" && categoryLabel !== categoryFilter) {
        return false;
      }

      if (stockFilter === "in-stock") {
        return metrics.totalUnits > 0;
      }

      if (stockFilter === "out-of-stock") {
        return metrics.totalUnits <= 0;
      }

      if (stockFilter === "low-stock") {
        const reorderLevel = Number(product.reorderLevel ?? product.reorder_level ?? 0) || 0;
        return metrics.totalUnits > 0 && reorderLevel > 0 && metrics.totalUnits <= reorderLevel;
      }

      if (stockFilter === "selling") {
        return metrics.activeSalesCount > 0;
      }

      if (stockFilter === "no-sales") {
        return metrics.activeSalesCount === 0;
      }

      if (stockFilter === "no-purchases") {
        return metrics.receivedPurchaseCount === 0;
      }

      return true;
    });
  }, [categoryFilter, isServerPaginated, normalizedSearch, productsWithMetrics, stockFilter]);

  const activeFilterCount =
    (categoryFilter === "all" ? 0 : 1) + (stockFilter === "all" ? 0 : 1);
  const compactRows = 5;
  const shouldShowViewAll =
    !isServerPaginated && filteredProductsWithMetrics.length > compactRows;
  const isCompact = shouldShowViewAll && !showAllRows;
  const totalProductCount = pagination?.count ?? products.length;

  function getPageRequestParams(page = 1) {
    return {
      page,
      search: searchTerm,
      category: categoryFilter === "all" ? "" : categoryFilter,
      stockFilter: stockFilter === "all" ? "" : stockFilter,
    };
  }

  useEffect(() => {
    if (!isServerPaginated) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      onPageRequest(getPageRequestParams(1));
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [categoryFilter, isServerPaginated, onPageRequest, searchTerm, stockFilter]);

  function resetProductFilters() {
    setCategoryFilter("all");
    setStockFilter("all");
  }

  const stockLabels = {
    "in-stock": t("products.inStock"),
    "low-stock": t("products.lowStock"),
    "out-of-stock": t("products.outOfStock"),
    selling: t("products.hasSales"),
    "no-sales": t("products.noSalesYet"),
    "no-purchases": t("products.noReceivedPurchases"),
  };

  // No quick presets — every shortcut duplicated the Stock-status select, and
  // there is no date facet here, so nothing additive remains.
  const quickPresets = [];

  const activeChips = [
    categoryFilter !== "all" && {
      key: "category",
      label: t("products.categoryChip", { label: categoryFilter }),
      onRemove: () => setCategoryFilter("all"),
    },
    stockFilter !== "all" && {
      key: "stock",
      label: stockLabels[stockFilter] || stockFilter,
      onRemove: () => setStockFilter("all"),
    },
  ].filter(Boolean);

  function handlePageChange(page) {
    onPageRequest?.(getPageRequestParams(page));
  }

  return {
    searchTerm,
    setSearchTerm,
    stockFilter,
    setStockFilter,
    categoryFilter,
    setCategoryFilter,
    showProductFilters,
    setShowProductFilters,
    showAllRows,
    setShowAllRows,
    isServerPaginated,
    productsWithMetrics,
    categoryOptions,
    filteredProductsWithMetrics,
    activeFilterCount,
    shouldShowViewAll,
    isCompact,
    totalProductCount,
    resetProductFilters,
    quickPresets,
    activeChips,
    handlePageChange,
  };
}
