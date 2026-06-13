import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { withinRange } from "../FilterControls";
import { getStatusLabel } from "../../i18n/statusLabels";
import { PAGE_SIZE } from "../../app/appUtils";
import {
  buildProductFilterOptions,
  buildSupplierFilterOptions,
  daysAgoString,
  defaultSupplierOptions,
  purchaseMatchesQuery,
  sortRecentTransactions,
  statusOptions,
  transactionMatchesDateRange,
} from "./purchaseHistoryUtils";

function usePurchaseHistoryPageState({
  products,
  suppliers = defaultSupplierOptions,
  purchases,
  allPurchases = purchases,
  pagination = null,
  onPageRequest,
  onCreatePurchase,
  onPurchaseStatusChange,
  onPurchaseItemStatusChange,
  onPurchaseUpdate,
  onPurchaseDelete,
}) {
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState(statusOptions);
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [supplierFilterQuery, setSupplierFilterQuery] = useState("");
  const [supplierFilterOpen, setSupplierFilterOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [productFilterQuery, setProductFilterQuery] = useState("");
  const [productFilterOpen, setProductFilterOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [vatFilter, setVatFilter] = useState("all");
  const [localPage, setLocalPage] = useState(1);
  const [editingPurchase, setEditingPurchase] = useState(null);
  const [showNewPurchaseForm, setShowNewPurchaseForm] = useState(false);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const isServerPaginated = Boolean(pagination && onPageRequest);
  const selectedStatusKey = selectedStatuses.join(",");
  const activeFilterCount =
    (selectedSupplier ? 1 : 0) +
    (selectedProduct ? 1 : 0) +
    (selectedStatuses.length === statusOptions.length ? 0 : 1) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0) +
    (amountMin ? 1 : 0) +
    (amountMax ? 1 : 0) +
    (vatFilter === "all" ? 0 : 1);

  const supplierOptions = useMemo(
    () => buildSupplierFilterOptions(allPurchases, suppliers),
    [allPurchases, suppliers]
  );

  const filteredSupplierOptions = useMemo(() => {
    const normalizedQuery = supplierFilterQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return supplierOptions;
    }

    return supplierOptions.filter((supplier) =>
      supplier.companyName.toLowerCase().includes(normalizedQuery)
    );
  }, [supplierFilterQuery, supplierOptions]);

  const productOptions = useMemo(
    () => buildProductFilterOptions(products),
    [products]
  );

  const filteredProductOptions = useMemo(() => {
    const normalizedQuery = productFilterQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return productOptions;
    }

    return productOptions.filter((product) =>
      product.label.toLowerCase().includes(normalizedQuery)
    );
  }, [productFilterQuery, productOptions]);

  const selectedProductLabel = useMemo(
    () => productOptions.find((product) => product.id === selectedProduct)?.label || "",
    [productOptions, selectedProduct]
  );

  const filteredPurchases = useMemo(() => {
    if (isServerPaginated) {
      return [...purchases].sort(sortRecentTransactions);
    }

    return purchases.filter((purchase) => {
      const matchesSearch = normalizedSearch
        ? purchaseMatchesQuery(purchase, normalizedSearch)
        : true;
      const matchesStatus = selectedStatuses.includes(purchase.status);
      const matchesSupplier = selectedSupplier
        ? purchase.supplier_name === selectedSupplier
        : true;
      const matchesProduct = selectedProduct
        ? (purchase.items || []).some(
            (item) => `${item.product ?? item.product_id ?? ""}` === `${selectedProduct}`
          )
        : true;
      const matchesDateRange = transactionMatchesDateRange(
        purchase.transaction_date,
        dateFrom,
        dateTo
      );
      const matchesAmount = withinRange(purchase.grand_total, amountMin, amountMax);
      const matchesVat =
        vatFilter === "all" || purchase.vat_mode === vatFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesSupplier &&
        matchesProduct &&
        matchesDateRange &&
        matchesAmount &&
        matchesVat
      );
    }).sort(sortRecentTransactions);
  }, [
    amountMin,
    amountMax,
    dateFrom,
    dateTo,
    isServerPaginated,
    normalizedSearch,
    purchases,
    selectedProduct,
    selectedStatuses,
    selectedSupplier,
    vatFilter,
  ]);

  const localPagination = useMemo(() => {
    if (isServerPaginated) {
      return pagination;
    }

    const count = filteredPurchases.length;
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
  }, [filteredPurchases.length, isServerPaginated, localPage, pagination]);

  const visiblePurchases = useMemo(() => {
    if (isServerPaginated) {
      return filteredPurchases;
    }

    const page = Number(localPagination?.page || 1);
    const start = (page - 1) * PAGE_SIZE;
    return filteredPurchases.slice(start, start + PAGE_SIZE);
  }, [filteredPurchases, isServerPaginated, localPagination]);

  const usesPaginationControls = Boolean(localPagination?.count > PAGE_SIZE || isServerPaginated);
  const totalPurchaseCount = isServerPaginated
    ? pagination?.count ?? purchases.length
    : filteredPurchases.length;

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
      supplier: selectedSupplier,
      product: selectedProduct,
      dateFrom,
      dateTo,
      amountMin,
      amountMax,
      vatMode: vatFilter === "all" ? "" : vatFilter,
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
    amountMin,
    amountMax,
    dateFrom,
    dateTo,
    isServerPaginated,
    onPageRequest,
    searchTerm,
    selectedStatusKey,
    selectedSupplier,
    selectedProduct,
    vatFilter,
  ]);

  useEffect(() => {
    if (isServerPaginated) {
      return;
    }

    setLocalPage(1);
  }, [
    amountMin,
    amountMax,
    dateFrom,
    dateTo,
    isServerPaginated,
    normalizedSearch,
    selectedStatusKey,
    selectedSupplier,
    selectedProduct,
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

  function selectSupplierFilter(supplier) {
    setSelectedSupplier(supplier.companyName);
    setSupplierFilterQuery(supplier.companyName);
    setSupplierFilterOpen(false);
  }

  function selectProductFilter(product) {
    setSelectedProduct(product.id);
    setProductFilterQuery(product.label);
    setProductFilterOpen(false);
  }

  function handleProductFilterQueryChange(value) {
    setProductFilterQuery(value);
    setSelectedProduct("");
    setProductFilterOpen(true);
  }

  function resetFilters() {
    setSelectedStatuses(statusOptions);
    setSelectedSupplier("");
    setSupplierFilterQuery("");
    setSelectedProduct("");
    setProductFilterQuery("");
    setProductFilterOpen(false);
    setDateFrom("");
    setDateTo("");
    setAmountMin("");
    setAmountMax("");
    setVatFilter("all");
    setSupplierFilterOpen(false);
  }

  const vatLabels = {
    included: t("purchaseHistory.vatIncluded"),
    not_included: t("purchaseHistory.vatExcluded"),
  };
  const last30Active = dateFrom === daysAgoString(30) && !dateTo;
  const quickPresets = [
    {
      label: t("purchaseHistory.filterLastDays"),
      active: last30Active,
      onClick: () => {
        setDateFrom(last30Active ? "" : daysAgoString(30));
        setDateTo("");
      },
    },
  ].filter(Boolean);
  const activeChips = [
    selectedSupplier && {
      key: "supplier",
      label: t("purchaseHistory.supplierChip", { name: selectedSupplier }),
      onRemove: () => {
        setSelectedSupplier("");
        setSupplierFilterQuery("");
      },
    },
    selectedProduct && {
      key: "product",
      label: t("purchaseHistory.productChip", { name: selectedProductLabel }),
      onRemove: () => {
        setSelectedProduct("");
        setProductFilterQuery("");
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
      label: t("purchaseHistory.vatChip", { label: vatLabels[vatFilter] || vatFilter }),
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

  async function handleSave(updatedPurchase) {
    const saved = await onPurchaseUpdate?.(updatedPurchase);

    if (saved === false) {
      return false;
    }

    setEditingPurchase(saved && typeof saved === "object" ? saved : updatedPurchase);
    return saved;
  }

  async function handleCreatePurchase(formData) {
    const saved = await onCreatePurchase?.(formData);

    if (saved === false) {
      return false;
    }

    setShowNewPurchaseForm(false);
    return true;
  }

  async function handleDelete(deletedPurchase) {
    const deleted = await onPurchaseDelete?.(deletedPurchase);

    if (deleted === false) {
      return;
    }

    setEditingPurchase((currentPurchase) =>
      currentPurchase?.id === deletedPurchase.id ? null : currentPurchase
    );
  }

  function handlePageChange(page) {
    if (isServerPaginated) {
      onPageRequest?.(getPageRequestParams(page));
      return;
    }

    setLocalPage(page);
  }

  const vatOptions = [
    { value: "included", label: t("purchaseHistory.vatIncluded") },
    { value: "not_included", label: t("purchaseHistory.vatExcluded") },
  ];

  return {
    // View state
    editingPurchase,
    showNewPurchaseForm,
    setEditingPurchase,
    setShowNewPurchaseForm,

    // Directory props
    products,
    suppliers,
    purchases: visiblePurchases,
    allPurchases,
    filteredPurchases: visiblePurchases,
    pagination: localPagination,
    isServerPaginated,
    usesPaginationControls,
    totalPurchaseCount,
    searchTerm,
    setSearchTerm,
    filterOpen,
    setFilterOpen,
    activeFilterCount,
    resetFilters,
    quickPresets,
    activeChips,
    supplierFilterQuery,
    setSupplierFilterQuery,
    supplierFilterOpen,
    setSupplierFilterOpen,
    supplierOptions,
    filteredSupplierOptions,
    selectedSupplier,
    setSelectedSupplier,
    selectSupplierFilter,
    productFilterQuery,
    productFilterOpen,
    setProductFilterOpen,
    productOptions,
    filteredProductOptions,
    selectedProduct,
    setSelectedProduct,
    selectProductFilter,
    handleProductFilterQueryChange,
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
    vatOptions,
    selectedStatuses,
    setSelectedStatuses,

    // Handlers
    onPurchaseStatusChange,
    onPurchaseItemStatusChange,
    handleSave,
    handleCreatePurchase,
    handleDelete,
    getPageRequestParams,
    handlePageChange,
  };
}

export default usePurchaseHistoryPageState;
