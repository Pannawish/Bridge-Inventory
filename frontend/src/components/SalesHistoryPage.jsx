import { useEffect, useMemo, useState } from "react";
import SalesForm from "./SalesForm";
import SalesEditForm from "./sales/SalesEditForm";
import SalesHistoryDirectorySection from "./sales/SalesHistoryDirectorySection";
import {
  withinRange,
} from "./FilterControls";
import { useLanguage } from "../i18n/LanguageContext";
import { getStatusLabel } from "../i18n/statusLabels";
import {
  buildCustomerFilterOptions,
  daysAgoString,
  defaultCustomerOptions,
  saleMatchesQuery,
  sortRecentTransactions,
  statusOptions,
  transactionMatchesDateRange,
  vatOptionValues,
} from "./sales/salesHistoryUtils";

function SalesHistoryPage({
  sales,
  allSales = sales,
  products = [],
  suppliers = [],
  purchases = [],
  enableStockValidation = true,
  pagination = null,
  customers = defaultCustomerOptions,
  onPageRequest,
  onCreateSale,
  onSaleStatusChange,
  onSaleUpdate,
  onSaleDelete,
  onWarning,
}) {
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState(statusOptions);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [customerFilterQuery, setCustomerFilterQuery] = useState("");
  const [customerFilterOpen, setCustomerFilterOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [vatFilter, setVatFilter] = useState("all");
  const [editingSale, setEditingSale] = useState(null);
  const [showNewSaleForm, setShowNewSaleForm] = useState(false);
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const isServerPaginated = Boolean(pagination && onPageRequest);
  const selectedStatusKey = selectedStatuses.join(",");
  const activeFilterCount =
    (selectedCustomer ? 1 : 0) +
    (selectedStatuses.length === statusOptions.length ? 0 : 1) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0) +
    (amountMin ? 1 : 0) +
    (amountMax ? 1 : 0) +
    (vatFilter === "all" ? 0 : 1);
  const customerOptions = useMemo(
    () => buildCustomerFilterOptions(allSales, customers),
    [allSales, customers]
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

    return sales.filter((sale) => {
      const matchesSearch = normalizedSearch
        ? saleMatchesQuery(sale, normalizedSearch)
        : true;
      const matchesStatus = selectedStatuses.includes(sale.status);
      const matchesCustomer = selectedCustomer
        ? sale.customer_name === selectedCustomer
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
    sales,
    selectedCustomer,
    selectedStatuses,
    vatFilter,
  ]);
  const totalSalesCount = pagination?.count ?? sales.length;

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
    selectedCustomer,
    selectedStatusKey,
    vatFilter,
  ]);

  function selectCustomerFilter(customer) {
    setSelectedCustomer(customer.companyName);
    setCustomerFilterQuery(customer.companyName);
    setCustomerFilterOpen(false);
  }

  function resetFilters() {
    setSearchTerm("");
    setSelectedStatuses(statusOptions);
    setSelectedCustomer("");
    setCustomerFilterQuery("");
    setDateFrom("");
    setDateTo("");
    setAmountMin("");
    setAmountMax("");
    setVatFilter("all");
    setFilterOpen(false);
    setCustomerFilterOpen(false);
  }

  const vatLabels = {
    included: t("salesHistory.vatIncluded"),
    not_included: t("salesHistory.vatExcluded"),
  };
  const vatOptions = vatOptionValues.map((v) => ({
    value: v,
    label: v === "included" ? t("salesHistory.vatIncluded") : t("salesHistory.vatExcluded"),
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
  ].filter(Boolean);
  const activeChips = [
    selectedCustomer && {
      key: "customer",
      label: t("salesHistory.customerChip", { name: selectedCustomer }),
      onRemove: () => {
        setSelectedCustomer("");
        setCustomerFilterQuery("");
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

  async function handleSave(updatedSale) {
    const saved = await onSaleUpdate?.(updatedSale);

    if (saved === false) {
      return;
    }

    setEditingSale(null);
  }

  async function handleCreateSale(formData) {
    const saved = await onCreateSale?.(formData);

    if (saved === false) {
      return false;
    }

    setShowNewSaleForm(false);
    return true;
  }

  async function handleDelete(deletedSale) {
    const deleted = await onSaleDelete?.(deletedSale);

    if (deleted === false) {
      return;
    }

    setEditingSale((currentSale) =>
      currentSale?.id === deletedSale.id ? null : currentSale
    );
  }

  if (showNewSaleForm) {
    return (
      <div className="stack-layout">
        <SalesForm
          products={products}
          customers={customers}
          suppliers={suppliers}
          purchases={purchases}
          sales={allSales}
          enableStockValidation={enableStockValidation}
          onSubmit={handleCreateSale}
          onCancel={() => setShowNewSaleForm(false)}
        />
      </div>
    );
  }

  if (editingSale) {
    return (
      <div className="stack-layout">
        <SalesEditForm
          key={editingSale.id}
          sale={editingSale}
          products={products}
          customers={customers}
          purchases={purchases}
          sales={allSales}
          enableStockValidation={enableStockValidation}
          onCancel={() => setEditingSale(null)}
          onSave={handleSave}
        />
      </div>
    );
  }

  return (
    <SalesHistoryDirectorySection
      sales={sales}
      filteredSales={filteredSales}
      products={products}
      purchases={purchases}
      allSales={allSales}
      enableStockValidation={enableStockValidation}
      pagination={pagination}
      isServerPaginated={isServerPaginated}
      totalSalesCount={totalSalesCount}
      searchTerm={searchTerm}
      onSearchTermChange={setSearchTerm}
      filterOpen={filterOpen}
      onToggleFilter={() => setFilterOpen((currentValue) => !currentValue)}
      activeFilterCount={activeFilterCount}
      onResetFilters={resetFilters}
      quickPresets={quickPresets}
      activeChips={activeChips}
      customerFilterQuery={customerFilterQuery}
      onCustomerFilterQueryChange={(value) => {
        setCustomerFilterQuery(value);
        setSelectedCustomer("");
        setCustomerFilterOpen(true);
      }}
      customerFilterOpen={customerFilterOpen}
      onCustomerFilterOpen={() => setCustomerFilterOpen(true)}
      onCustomerFilterClose={() => setCustomerFilterOpen(false)}
      filteredCustomerOptions={filteredCustomerOptions}
      selectedCustomer={selectedCustomer}
      onSelectCustomerFilter={selectCustomerFilter}
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
      onSaleStatusChange={onSaleStatusChange}
      onSaleUpdate={onSaleUpdate}
      onWarning={onWarning}
      onEditSale={setEditingSale}
      onDeleteSale={handleDelete}
      onCreateSale={() => {
        setEditingSale(null);
        setShowNewSaleForm(true);
      }}
      onPageChange={(page) => onPageRequest?.(getPageRequestParams(page))}
    />
  );
}

export default SalesHistoryPage;
