import { useEffect, useMemo, useState } from "react";
import PurchaseForm from "./PurchaseForm";
import PurchaseEditForm from "./purchases/PurchaseEditForm";
import PaginationControls from "./PaginationControls";
import StatusFilterGroup from "./StatusFilterGroup";
import TransactionTable from "./TransactionTable";
import { useLanguage } from "../i18n/LanguageContext";
import {
  FilterPresets,
  ActiveFilterChips,
  RangeField,
  withinRange,
} from "./FilterControls";
import { getStatusLabel } from "../i18n/statusLabels";
import {
  buildSupplierFilterOptions,
  daysAgoString,
  defaultSupplierOptions,
  purchaseMatchesQuery,
  purchaseStatusPresets,
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
    <div className="stack-layout">
      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("purchaseHistory.searchEyebrow")}</p>
            <h3>{t("purchaseHistory.searchTitle")}</h3>
          </div>
        </div>

        <div className="supplier-directory-toolbar">
          <label className="stock-search supplier-search">
            <span className="stock-search-icon">S</span>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={t("purchaseHistory.searchPlaceholder")}
            />
          </label>
          <div className="stock-report-summary supplier-search-meta">
            <span>
              {isServerPaginated
                ? t("purchaseHistory.pageCountServer", { count: filteredPurchases.length, total: totalPurchaseCount })
                : t("purchaseHistory.pageCountLocal", { count: filteredPurchases.length, total: purchases.length })}
            </span>
          </div>
        </div>

        <div className="history-filter-actions">
          <button
            className="secondary-button product-filter-toggle"
            type="button"
            aria-expanded={filterOpen}
            onClick={() => setFilterOpen((currentValue) => !currentValue)}
          >
            {t("filterControls.filter")}
            {activeFilterCount ? <span>{activeFilterCount}</span> : null}
          </button>
          <button className="secondary-button" type="button" onClick={resetFilters}>
            {t("filterControls.resetFilter")}
          </button>
        </div>

        <FilterPresets presets={quickPresets} />
        <ActiveFilterChips chips={activeChips} onClearAll={resetFilters} />

        {filterOpen ? (
          <div className="history-filter-panel">
            <div className="history-filter-grid">
              <label className="history-filter-field supplier-combobox-field">
                <span className="history-filter-title">{t("purchaseHistory.supplierFilter")}</span>
                <div className="supplier-combobox">
                  <input
                    type="search"
                    value={supplierFilterQuery}
                    onChange={(event) => {
                      setSupplierFilterQuery(event.target.value);
                      setSelectedSupplier("");
                      setSupplierFilterOpen(true);
                    }}
                    onFocus={() => setSupplierFilterOpen(true)}
                    onBlur={() => {
                      window.setTimeout(() => setSupplierFilterOpen(false), 120);
                    }}
                    placeholder={t("purchaseHistory.searchSupplierPlaceholder")}
                    autoComplete="off"
                    aria-expanded={supplierFilterOpen}
                    aria-controls="purchase-history-supplier-filter"
                  />

                  {supplierFilterOpen ? (
                    <div
                      className="supplier-combobox-menu"
                      id="purchase-history-supplier-filter"
                      role="listbox"
                    >
                      {filteredSupplierOptions.length ? (
                        filteredSupplierOptions.map((supplier) => (
                          <button
                            key={supplier.id}
                            type="button"
                            className={
                              supplier.companyName === selectedSupplier
                                ? "supplier-combobox-option active"
                                : "supplier-combobox-option"
                            }
                            onMouseDown={(event) => {
                              event.preventDefault();
                              selectSupplierFilter(supplier);
                            }}
                            role="option"
                            aria-selected={supplier.companyName === selectedSupplier}
                          >
                            {supplier.companyName}
                          </button>
                        ))
                      ) : (
                        <div className="supplier-combobox-empty">{t("purchaseHistory.noSupplierFound")}</div>
                      )}
                    </div>
                  ) : null}
                </div>
              </label>

              <label className="history-filter-field">
                <span className="history-filter-title">{t("purchaseHistory.dateFromLabel")}</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                />
              </label>

              <label className="history-filter-field">
                <span className="history-filter-title">{t("purchaseHistory.dateToLabel")}</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                />
              </label>

              <RangeField
                title={t("purchaseHistory.amountLabel")}
                prefix="฿"
                minValue={amountMin}
                maxValue={amountMax}
                onMinChange={setAmountMin}
                onMaxChange={setAmountMax}
              />

              <label className="history-filter-field">
                <span className="history-filter-title">{t("purchaseHistory.vatLabel")}</span>
                <select
                  value={vatFilter}
                  onChange={(event) => setVatFilter(event.target.value)}
                >
                  <option value="all">{t("purchaseHistory.allVat")}</option>
                  {vatOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <StatusFilterGroup
              title={t("purchaseHistory.statusSectionTitle")}
              statuses={statusOptions}
              selectedStatuses={selectedStatuses}
              presets={purchaseStatusPresets.map((preset) => ({
                ...preset,
                label: t(preset.labelKey),
              }))}
              formatStatusLabel={(status) => getStatusLabel(t, status)}
              onChange={setSelectedStatuses}
            />
          </div>
        ) : null}
      </section>

      <TransactionTable
        rows={filteredPurchases}
        products={products}
        type="purchase"
        onPurchaseStatusChange={onPurchaseStatusChange}
        onPurchaseItemStatusChange={onPurchaseItemStatusChange}
        onEditRow={setEditingPurchase}
        onDeleteRow={handleDelete}
        compactRows={isServerPaginated ? 0 : 5}
        enableViewAll={!isServerPaginated}
        headerActions={
          <button
            className="primary-button"
            type="button"
            onClick={() => {
              setEditingPurchase(null);
              setShowNewPurchaseForm(true);
            }}
          >
            {t("purchaseHistory.newPurchase")}
          </button>
        }
      />
      <PaginationControls
        pagination={pagination}
        itemLabel={t("purchaseHistory.paginationLabel")}
        onPageChange={(page) => onPageRequest?.(getPageRequestParams(page))}
      />
    </div>
  );
}

export default PurchaseHistoryPage;
