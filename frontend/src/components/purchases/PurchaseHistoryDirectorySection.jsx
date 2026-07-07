// Section component for purchase workflow forms or detail views.

import PaginationControls from "../PaginationControls";
import TransactionTable from "../TransactionTable";
import UniversalFilter from "../filters/UniversalFilter";
import { useLanguage } from "../../i18n/LanguageContext";
import { getStatusLabel } from "../../i18n/statusLabels";
import { purchaseStatusPresets, statusOptions } from "./purchaseHistoryUtils";

function PurchaseHistoryDirectorySection({
  purchases = [],
  filteredPurchases = [],
  products = [],
  pagination = null,
  isServerPaginated = false,
  isPaginated = false,
  totalPurchaseCount = 0,
  searchTerm,
  onSearchTermChange,
  onResetFilters,
  quickPresets = [],
  activeChips = [],
  supplierOptions = [],
  selectedSupplier,
  onSelectedSupplierChange,
  productOptions = [],
  selectedProduct,
  onSelectedProductChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  amountMin,
  onAmountMinChange,
  amountMax,
  onAmountMaxChange,
  vatFilter,
  onVatFilterChange,
  vatOptions = [],
  selectedStatuses = [],
  onSelectedStatusesChange,
  onPurchaseStatusChange,
  onPurchaseItemStatusChange,
  onEditPurchase,
  onDeletePurchase,
  onCreatePurchase,
  onPageChange,
  initialDetailRow = null,
}) {
  const { t } = useLanguage();

  const countLabel = t(
    isServerPaginated ? "purchaseHistory.pageCountServer" : "purchaseHistory.pageCountLocal",
    { count: filteredPurchases.length, total: totalPurchaseCount }
  );

  // WHO → WHEN → STATUS in the always-visible row; WHAT → $ → VAT under More.
  const filterFields = [
    {
      id: "supplier",
      type: "combobox",
      section: "primary",
      label: t("purchaseHistory.supplierFilter"),
      value: selectedSupplier,
      onChange: onSelectedSupplierChange,
      options: supplierOptions.map((supplier) => ({
        value: supplier.companyName,
        label: supplier.companyName,
      })),
      allValue: "",
      placeholder: t("purchaseHistory.searchSupplierPlaceholder"),
      emptyMessage: t("purchaseHistory.noSupplierFound"),
    },
    {
      id: "date",
      type: "daterange",
      section: "primary",
      label: t("filterControls.dateRange"),
      from: dateFrom,
      to: dateTo,
      onFromChange: onDateFromChange,
      onToChange: onDateToChange,
    },
    {
      id: "status",
      type: "statusGroup",
      section: "primary",
      label: t("purchaseHistory.statusSectionTitle"),
      statuses: statusOptions,
      selectedStatuses,
      onChange: onSelectedStatusesChange,
      presets: purchaseStatusPresets.map((preset) => ({
        ...preset,
        label: t(preset.labelKey),
      })),
      formatStatusLabel: (status) => getStatusLabel(t, status),
      summaryAll: t("filterControls.allStatuses"),
      summaryNone: t("filterControls.statusNone"),
      summaryCount: (count) => t("filterControls.statusCount", { count }),
    },
    {
      id: "product",
      type: "combobox",
      section: "advanced",
      label: t("purchaseHistory.productFilter"),
      value: selectedProduct,
      onChange: onSelectedProductChange,
      options: productOptions.map((product) => ({
        value: product.id,
        label: product.label,
      })),
      allValue: "",
      placeholder: t("purchaseHistory.searchProductPlaceholder"),
      emptyMessage: t("purchaseHistory.noProductFound"),
    },
    {
      id: "amount",
      type: "numberRange",
      section: "advanced",
      label: t("purchaseHistory.amountLabel"),
      prefix: "฿",
      min: amountMin,
      max: amountMax,
      onMinChange: onAmountMinChange,
      onMaxChange: onAmountMaxChange,
      placeholderMin: t("filterControls.min"),
      placeholderMax: t("filterControls.max"),
    },
    {
      id: "vat",
      type: "select",
      section: "advanced",
      label: t("purchaseHistory.vatLabel"),
      value: vatFilter,
      onChange: onVatFilterChange,
      allValue: "all",
      allLabel: t("purchaseHistory.allVat"),
      options: vatOptions,
    },
  ];

  return (
    <div className="stack-layout">
      <UniversalFilter
        search={{
          value: searchTerm,
          onChange: onSearchTermChange,
          placeholder: t("purchaseHistory.searchPlaceholder"),
        }}
        meta={countLabel}
        fields={filterFields}
        quickFilters={quickPresets}
        activeChips={activeChips}
        onReset={onResetFilters}
        labels={{
          more: t("filterControls.moreFilters"),
          reset: t("filterControls.resetFilter"),
          quick: t("filterControls.quickFilters"),
          clearAll: t("filterControls.clearAll"),
        }}
      />

      <TransactionTable
        rows={filteredPurchases}
        products={products}
        type="purchase"
        onPurchaseStatusChange={onPurchaseStatusChange}
        onPurchaseItemStatusChange={onPurchaseItemStatusChange}
        onEditRow={onEditPurchase}
        onDeleteRow={onDeletePurchase}
        compactRows={isPaginated ? 0 : 5}
        enableViewAll={!isPaginated}
        initialDetailRow={initialDetailRow}
        headerActions={
          <button className="primary-button" type="button" onClick={onCreatePurchase}>
            {t("purchaseHistory.newPurchase")}
          </button>
        }
      />

      <PaginationControls
        pagination={pagination}
        itemLabel={t("purchaseHistory.paginationLabel")}
        onPageChange={onPageChange}
      />
    </div>
  );
}

export default PurchaseHistoryDirectorySection;
