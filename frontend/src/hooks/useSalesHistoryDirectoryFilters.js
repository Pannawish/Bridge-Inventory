// React hook for shared application hook state and actions.

import { useEffect, useMemo, useState } from "react";
import { withinRange } from "../components/FilterControls";
import { getStatusLabel } from "../i18n/statusLabels";
import { PAGE_SIZE } from "../app/appUtils";
import {
  buildCustomerFilterOptions,
  daysAgoString,
  saleMatchesQuery,
  sortRecentTransactions,
  statusOptions,
  transactionMatchesDateRange,
  vatOptionValues,
} from "../components/sales/salesHistoryUtils";
import { buildProductFilterOptions } from "../components/purchases/purchaseHistoryUtils";

export function useSalesHistoryDirectoryFilters({
  sales = [],
  allSales = sales,
  customers = [],
  products = [],
  pagination = null,
  onPageRequest,
  t,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState(statusOptions);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [customerFilterQuery, setCustomerFilterQuery] = useState("");
  const [customerFilterOpen, setCustomerFilterOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [vatFilter, setVatFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("");
  const [localPage, setLocalPage] = useState(1);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const isServerPaginated = Boolean(pagination && onPageRequest);
  const selectedStatusKey = selectedStatuses.join(",");
  const customerOptions = useMemo(
    () => buildCustomerFilterOptions(allSales, customers),
    [allSales, customers]
  );
  const productOptions = useMemo(
    () => buildProductFilterOptions(products),
    [products]
  );

  const filteredCustomerOptions = useMemo(() => {
    const normalizedQuery = customerFilterQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return customerOptions;
    }

    return customerOptions.filter((customer) =>
      customer.companyName.toLowerCase().includes(normalizedQuery)
    );
  }, [customerFilterQuery, customerOptions]);

  const filteredSales = useMemo(() => {
    if (isServerPaginated) {
      return [...sales].sort(sortRecentTransactions);
    }

    return sales
      .filter((sale) => {
        const matchesSearch = normalizedSearch
          ? saleMatchesQuery(sale, normalizedSearch)
          : true;
        const matchesStatus = selectedStatuses.includes(sale.status);
        const matchesCustomer = selectedCustomer
          ? sale.customer_name === selectedCustomer
          : true;
        const matchesProduct = selectedProduct
          ? (sale.items || []).some(
              (item) => `${item.product ?? item.product_id ?? ""}` === `${selectedProduct}`
            )
          : true;
        const matchesDateRange = transactionMatchesDateRange(
          sale.transaction_date,
          dateFrom,
          dateTo
        );
        const matchesAmount = withinRange(sale.grand_total, amountMin, amountMax);
        const matchesVat = vatFilter === "all" || sale.vat_mode === vatFilter;

        return (
          matchesSearch &&
          matchesStatus &&
          matchesCustomer &&
          matchesProduct &&
          matchesDateRange &&
          matchesAmount &&
          matchesVat
        );
      })
      .sort(sortRecentTransactions);
  }, [
    amountMax,
    amountMin,
    dateFrom,
    dateTo,
    isServerPaginated,
    normalizedSearch,
    sales,
    selectedCustomer,
    selectedProduct,
    selectedStatuses,
    vatFilter,
  ]);

  const localPagination = useMemo(() => {
    if (isServerPaginated) {
      return pagination;
    }

    const count = filteredSales.length;
    const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
    const page = Math.min(localPage, totalPages);

    return {
      count,
      next: null,
      previous: null,
      page,
      page_size: PAGE_SIZE,
      total_pages: totalPages,
    };
  }, [filteredSales.length, isServerPaginated, localPage, pagination]);

  const visibleSales = useMemo(() => {
    if (isServerPaginated) {
      return filteredSales;
    }

    const page = Number(localPagination?.page || 1);
    const start = (page - 1) * PAGE_SIZE;
    return filteredSales.slice(start, start + PAGE_SIZE);
  }, [filteredSales, isServerPaginated, localPagination]);

  const usesPaginationControls = Boolean(localPagination?.count > PAGE_SIZE || isServerPaginated);
  const totalSalesCount = isServerPaginated
    ? pagination?.count ?? sales.length
    : filteredSales.length;

  const activeFilterCount =
    (selectedCustomer ? 1 : 0) +
    (selectedProduct ? 1 : 0) +
    (selectedStatuses.length === statusOptions.length ? 0 : 1) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0) +
    (amountMin ? 1 : 0) +
    (amountMax ? 1 : 0) +
    (vatFilter === "all" ? 0 : 1) +
    (stockFilter ? 1 : 0);

  function getPageRequestParams(page = 1) {
    return {
      page,
      search: searchTerm,
      statuses:
        selectedStatuses.length === statusOptions.length
          ? ""
          : selectedStatuses.length
            ? selectedStatuses
            : "__none__",
      customer: selectedCustomer,
      product: selectedProduct,
      dateFrom,
      dateTo,
      amountMin,
      amountMax,
      vatMode: vatFilter === "all" ? "" : vatFilter,
      stockFilter,
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
  }, [
    amountMax,
    amountMin,
    dateFrom,
    dateTo,
    isServerPaginated,
    onPageRequest,
    searchTerm,
    selectedCustomer,
    selectedProduct,
    selectedStatusKey,
    vatFilter,
    stockFilter,
  ]);

  useEffect(() => {
    if (isServerPaginated) {
      return;
    }

    setLocalPage(1);
  }, [
    amountMax,
    amountMin,
    dateFrom,
    dateTo,
    isServerPaginated,
    normalizedSearch,
    selectedCustomer,
    selectedProduct,
    selectedStatusKey,
    stockFilter,
    vatFilter,
  ]);

  useEffect(() => {
    if (isServerPaginated) {
      return;
    }

    const totalPages = Math.max(1, Number(localPagination?.total_pages || 1));
    if (localPage > totalPages) {
      setLocalPage(totalPages);
    }
  }, [isServerPaginated, localPage, localPagination]);

  function selectCustomerFilter(customer) {
    setSelectedCustomer(customer.companyName);
    setCustomerFilterQuery(customer.companyName);
    setCustomerFilterOpen(false);
  }

  function handleCustomerFilterQueryChange(value) {
    setCustomerFilterQuery(value);
    setSelectedCustomer("");
    setCustomerFilterOpen(true);
  }

  function resetFilters() {
    setSelectedStatuses(statusOptions);
    setSelectedCustomer("");
    setCustomerFilterQuery("");
    setSelectedProduct("");
    setDateFrom("");
    setDateTo("");
    setAmountMin("");
    setAmountMax("");
    setVatFilter("all");
    setStockFilter("");
    setCustomerFilterOpen(false);
  }

  const vatLabels = {
    included: t("salesHistory.vatIncluded"),
    not_included: t("salesHistory.vatExcluded"),
  };

  const vatOptions = vatOptionValues.map((value) => ({
    value,
    label:
      value === "included"
        ? t("salesHistory.vatIncluded")
        : t("salesHistory.vatExcluded"),
  }));

  const last30Active = dateFrom === daysAgoString(30) && !dateTo;
  const quickPresets = [
    {
      label: t("salesHistory.filterLastDays"),
      active: last30Active,
      onClick: () => {
        setDateFrom(last30Active ? "" : daysAgoString(30));
        setDateTo("");
      },
    },
    {
      label: t("salesHistory.presetInsufficientStock"),
      active: stockFilter === "insufficient_stock",
      onClick: () => {
        if (stockFilter === "insufficient_stock") {
          setStockFilter("");
        } else {
          setStockFilter("insufficient_stock");
        }
      },
    },
  ].filter(Boolean);

  const selectedProductLabel =
    productOptions.find((product) => `${product.id}` === `${selectedProduct}`)?.label || "";
  const activeChips = [
    selectedCustomer && {
      key: "customer",
      label: t("salesHistory.customerChip", { name: selectedCustomer }),
      onRemove: () => {
        setSelectedCustomer("");
        setCustomerFilterQuery("");
      },
    },
    selectedProduct && {
      key: "product",
      label: t("salesHistory.productChip", { name: selectedProductLabel }),
      onRemove: () => setSelectedProduct(""),
    },
    stockFilter === "insufficient_stock" && {
      key: "stockFilter",
      label: t("salesHistory.insufficientStockChip"),
      onRemove: () => {
        setStockFilter("");
      },
    },
    selectedStatuses.length !== statusOptions.length && {
      key: "status",
      label: t("filterControls.statusChip", {
        label: selectedStatuses.length
          ? selectedStatuses.map((status) => getStatusLabel(t, status)).join(", ")
          : t("common.allStatuses"),
      }),
      onRemove: () => setSelectedStatuses(statusOptions),
    },
    vatFilter !== "all" && {
      key: "vat",
      label: t("salesHistory.vatChip", { label: vatLabels[vatFilter] || vatFilter }),
      onRemove: () => setVatFilter("all"),
    },
    dateFrom && {
      key: "dateFrom",
      label: t("filterControls.fromChip", { date: dateFrom }),
      onRemove: () => setDateFrom(""),
    },
    dateTo && {
      key: "dateTo",
      label: t("filterControls.toChip", { date: dateTo }),
      onRemove: () => setDateTo(""),
    },
    amountMin && {
      key: "amountMin",
      label: t("filterControls.minChip", { value: amountMin }),
      onRemove: () => setAmountMin(""),
    },
    amountMax && {
      key: "amountMax",
      label: t("filterControls.maxChip", { value: amountMax }),
      onRemove: () => setAmountMax(""),
    },
  ].filter(Boolean);

  function handlePageChange(page) {
    if (isServerPaginated) {
      onPageRequest?.(getPageRequestParams(page));
      return;
    }

    setLocalPage(page);
  }

  return {
    searchTerm,
    setSearchTerm,
    filterOpen,
    setFilterOpen,
    selectedStatuses,
    setSelectedStatuses,
    selectedCustomer,
    setSelectedCustomer,
    customerOptions,
    customerFilterQuery,
    customerFilterOpen,
    setCustomerFilterOpen,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    amountMin,
    setAmountMin,
    amountMax,
    setAmountMax,
    vatFilter,
    setVatFilter,
    stockFilter,
    setStockFilter,
    selectedProduct,
    setSelectedProduct,
    productOptions,
    filteredCustomerOptions,
    filteredSales: visibleSales,
    isServerPaginated,
    usesPaginationControls,
    pagination: localPagination,
    totalSalesCount,
    activeFilterCount,
    resetFilters,
    vatOptions,
    quickPresets,
    activeChips,
    selectCustomerFilter,
    handleCustomerFilterQueryChange,
    handlePageChange,
    usesPaginationControls,
  };
}
