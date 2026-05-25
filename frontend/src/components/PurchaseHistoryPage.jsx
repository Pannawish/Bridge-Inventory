import { useEffect, useMemo, useState } from "react";
import PurchaseForm from "./PurchaseForm";
import PurchaseEditForm from "./purchases/PurchaseEditForm";
import PurchaseHistoryDirectorySection from "./purchases/PurchaseHistoryDirectorySection";
import { useLanguage } from "../i18n/LanguageContext";
import {
  withinRange,
} from "./FilterControls";
import { getStatusLabel } from "../i18n/statusLabels";
import {
  buildSupplierFilterOptions,
  daysAgoString,
  defaultSupplierOptions,
  purchaseMatchesQuery,
  sortRecentTransactions,
  statusOptions,
  transactionMatchesDateRange,
} from "./purchases/purchaseHistoryUtils";

function PurchaseHistoryPage({
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
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [vatFilter, setVatFilter] = useState("all");
  const [editingPurchase, setEditingPurchase] = useState(null);
  const [showNewPurchaseForm, setShowNewPurchaseForm] = useState(false);
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const isServerPaginated = Boolean(pagination && onPageRequest);
  const selectedStatusKey = selectedStatuses.join(",");
  const activeFilterCount =
    (selectedSupplier ? 1 : 0) +
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
    selectedStatuses,
    selectedSupplier,
    vatFilter,
  ]);
  const totalPurchaseCount = pagination?.count ?? purchases.length;

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
    vatFilter,
  ]);

  function selectSupplierFilter(supplier) {
    setSelectedSupplier(supplier.companyName);
    setSupplierFilterQuery(supplier.companyName);
    setSupplierFilterOpen(false);
  }

  function resetFilters() {
    setSearchTerm("");
    setSelectedStatuses(statusOptions);
    setSelectedSupplier("");
    setSupplierFilterQuery("");
    setDateFrom("");
    setDateTo("");
    setAmountMin("");
    setAmountMax("");
    setVatFilter("all");
    setFilterOpen(false);
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
      return;
    }

    setEditingPurchase(null);
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

  if (showNewPurchaseForm) {
    return (
      <div className="stack-layout">
        <PurchaseForm
          products={products}
          suppliers={suppliers}
          purchases={allPurchases}
          onSubmit={handleCreatePurchase}
          onCancel={() => setShowNewPurchaseForm(false)}
        />
      </div>
    );
  }

  if (editingPurchase) {
    return (
      <div className="stack-layout">
        <PurchaseEditForm
          key={editingPurchase.id}
          purchase={editingPurchase}
          products={products}
          suppliers={suppliers}
          onCancel={() => setEditingPurchase(null)}
          onSave={handleSave}
        />
      </div>
    );
  }

  const vatOptions = [
    { value: "included", label: t("purchaseHistory.vatIncluded") },
    { value: "not_included", label: t("purchaseHistory.vatExcluded") },
  ];

  return (
    <PurchaseHistoryDirectorySection
      purchases={purchases}
      filteredPurchases={filteredPurchases}
      products={products}
      pagination={pagination}
      isServerPaginated={isServerPaginated}
      totalPurchaseCount={totalPurchaseCount}
      searchTerm={searchTerm}
      onSearchTermChange={setSearchTerm}
      filterOpen={filterOpen}
      onToggleFilter={() => setFilterOpen((currentValue) => !currentValue)}
      activeFilterCount={activeFilterCount}
      onResetFilters={resetFilters}
      quickPresets={quickPresets}
      activeChips={activeChips}
      supplierFilterQuery={supplierFilterQuery}
      onSupplierFilterQueryChange={(value) => {
        setSupplierFilterQuery(value);
        setSelectedSupplier("");
        setSupplierFilterOpen(true);
      }}
      supplierFilterOpen={supplierFilterOpen}
      onSupplierFilterOpen={() => setSupplierFilterOpen(true)}
      onSupplierFilterClose={() => setSupplierFilterOpen(false)}
      filteredSupplierOptions={filteredSupplierOptions}
      selectedSupplier={selectedSupplier}
      onSelectSupplierFilter={selectSupplierFilter}
      dateFrom={dateFrom}
      onDateFromChange={setDateFrom}
      dateTo={dateTo}
      onDateToChange={setDateTo}
      amountMin={amountMin}
      onAmountMinChange={setAmountMin}
      amountMax={amountMax}
      onAmountMaxChange={setAmountMax}
      vatFilter={vatFilter}
      onVatFilterChange={setVatFilter}
      vatOptions={vatOptions}
      selectedStatuses={selectedStatuses}
      onSelectedStatusesChange={setSelectedStatuses}
      onPurchaseStatusChange={onPurchaseStatusChange}
      onPurchaseItemStatusChange={onPurchaseItemStatusChange}
      onEditPurchase={setEditingPurchase}
      onDeletePurchase={handleDelete}
      onCreatePurchase={() => {
        setEditingPurchase(null);
        setShowNewPurchaseForm(true);
      }}
      onPageChange={(page) => onPageRequest?.(getPageRequestParams(page))}
    />
  );
}

export default PurchaseHistoryPage;
