import { useEffect, useMemo, useState } from "react";
import { PAGE_SIZE } from "../app/appUtils";
import { withinRange } from "../components/FilterControls";
import {
  daysAgoInputValue,
  getQuotationPartnerOptions,
  getQuotationState,
  quotationMatchesDateRange,
  quotationMatchesQuery,
  sortRecentQuotations,
} from "../components/quotation/quotationUtils";

export function useQuotationDirectoryFilters({
  quotations = [],
  customers = [],
  t,
  pageSize = PAGE_SIZE,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [vatFilter, setVatFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [historyPage, setHistoryPage] = useState(1);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const customerOptions = useMemo(
    () => getQuotationPartnerOptions(quotations, "customer_name", customers),
    [customers, quotations]
  );
  const productOptions = useMemo(() => {
    const optionMap = new Map();
    quotations.forEach((quotation) => {
      (quotation.items || []).forEach((item) => {
        const id = `${item.product_id ?? item.product ?? ""}`;
        if (!id || optionMap.has(id)) {
          return;
        }
        const name = `${item.product_name ?? ""}`.trim();
        const sku = `${item.sku ?? ""}`.trim();
        optionMap.set(id, { value: id, label: sku ? `${name || sku} (${sku})` : name || id });
      });
    });
    return Array.from(optionMap.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [quotations]);
  const selectedProductLabel =
    productOptions.find((product) => product.value === selectedProduct)?.label || "";

  const activeFilterCount =
    (selectedCustomer ? 1 : 0) +
    (selectedProduct ? 1 : 0) +
    (stateFilter === "all" ? 0 : 1) +
    (vatFilter === "all" ? 0 : 1) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0) +
    (amountMin ? 1 : 0) +
    (amountMax ? 1 : 0);

  const filteredQuotations = useMemo(
    () =>
      quotations
        .filter((quotation) => {
          const matchesSearch = normalizedSearch
            ? quotationMatchesQuery(quotation, normalizedSearch)
            : true;
          const matchesCustomer = selectedCustomer
            ? quotation.customer_name === selectedCustomer
            : true;
          const matchesProduct = selectedProduct
            ? (quotation.items || []).some(
                (item) => `${item.product_id ?? item.product ?? ""}` === `${selectedProduct}`
              )
            : true;
          const matchesState =
            stateFilter === "all" ||
            getQuotationState(quotation).toLowerCase() === stateFilter;
          const matchesVat = vatFilter === "all" || quotation.vat_mode === vatFilter;
          const matchesDateRange = quotationMatchesDateRange(
            quotation.quotation_date,
            dateFrom,
            dateTo
          );
          const matchesAmount = withinRange(
            quotation.grand_total,
            amountMin,
            amountMax
          );

          return (
            matchesSearch &&
            matchesCustomer &&
            matchesProduct &&
            matchesState &&
            matchesVat &&
            matchesDateRange &&
            matchesAmount
          );
        })
        .sort(sortRecentQuotations),
    [
      amountMax,
      amountMin,
      dateFrom,
      dateTo,
      normalizedSearch,
      quotations,
      selectedCustomer,
      selectedProduct,
      stateFilter,
      vatFilter,
    ]
  );

  const historyTotalPages = Math.max(1, Math.ceil(filteredQuotations.length / pageSize));
  const currentHistoryPage = Math.min(historyPage, historyTotalPages);
  const paginatedQuotations = useMemo(() => {
    const start = (currentHistoryPage - 1) * pageSize;
    return filteredQuotations.slice(start, start + pageSize);
  }, [currentHistoryPage, filteredQuotations, pageSize]);

  const quotationPagination = filteredQuotations.length
    ? {
        count: filteredQuotations.length,
        page: currentHistoryPage,
        page_size: pageSize,
        total_pages: historyTotalPages,
      }
    : null;

  useEffect(() => {
    setHistoryPage(1);
  }, [
    amountMax,
    amountMin,
    dateFrom,
    dateTo,
    normalizedSearch,
    quotations,
    selectedCustomer,
    selectedProduct,
    stateFilter,
    vatFilter,
  ]);

  function resetFilters() {
    setSelectedCustomer("");
    setSelectedProduct("");
    setStateFilter("all");
    setVatFilter("all");
    setDateFrom("");
    setDateTo("");
    setAmountMin("");
    setAmountMax("");
  }

  const vatLabels = {
    included: t("quotation.vatIncluded"),
    not_included: t("quotation.vatExcluded"),
    none: t("quotation.vatNone"),
  };

  // Only a single shortcut that the date-range fields can't express in one tap.
  // Everything else duplicates an existing filter, so it was removed.
  const quickPresets = [
    {
      key: "last30",
      label: t("quotation.quickLast30Days"),
      active: dateFrom === daysAgoInputValue(30) && !dateTo,
      onClick: () => {
        const last30 = dateFrom === daysAgoInputValue(30) && !dateTo;
        setDateFrom(last30 ? "" : daysAgoInputValue(30));
        setDateTo("");
      },
    },
  ];

  const activeChips = [
    selectedCustomer && {
      key: "customer",
      label: t("quotation.chipCustomer", { value: selectedCustomer }),
      onRemove: () => setSelectedCustomer(""),
    },
    selectedProduct && {
      key: "product",
      label: t("quotation.chipProduct", { value: selectedProductLabel }),
      onRemove: () => setSelectedProduct(""),
    },
    stateFilter !== "all" && {
      key: "state",
      label: t("quotation.chipState", {
        value: stateFilter === "valid"
          ? t("quotation.stateValid")
          : t("quotation.stateExpired"),
      }),
      onRemove: () => setStateFilter("all"),
    },
    vatFilter !== "all" && {
      key: "vat",
      label: t("quotation.chipVat", { value: vatLabels[vatFilter] || vatFilter }),
      onRemove: () => setVatFilter("all"),
    },
    dateFrom && {
      key: "dateFrom",
      label: t("quotation.chipDateFrom", { date: dateFrom }),
      onRemove: () => setDateFrom(""),
    },
    dateTo && {
      key: "dateTo",
      label: t("quotation.chipDateTo", { date: dateTo }),
      onRemove: () => setDateTo(""),
    },
    amountMin && {
      key: "amountMin",
      label: t("quotation.chipAmountMin", { value: amountMin }),
      onRemove: () => setAmountMin(""),
    },
    amountMax && {
      key: "amountMax",
      label: t("quotation.chipAmountMax", { value: amountMax }),
      onRemove: () => setAmountMax(""),
    },
  ].filter(Boolean);

  return {
    searchTerm,
    setSearchTerm,
    filterOpen,
    setFilterOpen,
    selectedCustomer,
    setSelectedCustomer,
    selectedProduct,
    setSelectedProduct,
    productOptions,
    stateFilter,
    setStateFilter,
    vatFilter,
    setVatFilter,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    amountMin,
    setAmountMin,
    amountMax,
    setAmountMax,
    historyPage,
    setHistoryPage,
    currentHistoryPage,
    historyPageSize: pageSize,
    customerOptions,
    activeFilterCount,
    filteredQuotations,
    paginatedQuotations,
    quotationPagination,
    resetFilters,
    quickPresets,
    activeChips,
  };
}
