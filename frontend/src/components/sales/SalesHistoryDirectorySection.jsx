import PaginationControls from "../PaginationControls";
import TransactionTable from "../TransactionTable";
import UniversalFilter from "../filters/UniversalFilter";
import { useLanguage } from "../../i18n/LanguageContext";
import { getStatusLabel } from "../../i18n/statusLabels";
import { saleStatusPresets, statusOptions } from "./salesHistoryUtils";

function SalesHistoryDirectorySection({
  sales = [],
  filteredSales = [],
  products = [],
  purchases = [],
  allSales = [],
  enableStockValidation = true,
  pagination = null,
  isServerPaginated = false,
  isPaginated = false,
  totalSalesCount = 0,
  searchTerm,
  onSearchTermChange,
  onResetFilters,
  quickPresets = [],
  activeChips = [],
  customerOptions = [],
  selectedCustomer,
  onSelectedCustomerChange,
  selectedProduct,
  onSelectedProductChange,
  productOptions = [],
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
  onSaleStatusChange,
  onSaleUpdate,
  onWarning,
  onEditSale,
  onDeleteSale,
  onCreateSale,
  onPageChange,
}) {
  const { t } = useLanguage();

  const countLabel = t(
    isServerPaginated ? "salesHistory.pageCountServer" : "salesHistory.pageCountLocal",
    { count: filteredSales.length, total: totalSalesCount }
  );

  // WHO → WHEN → STATUS in the always-visible row; WHAT → $ → VAT under More.
  const filterFields = [
    {
      id: "customer",
      type: "combobox",
      section: "primary",
      label: t("salesHistory.customerFilter"),
      value: selectedCustomer,
      onChange: onSelectedCustomerChange,
      options: customerOptions.map((customer) => ({
        value: customer.companyName,
        label: customer.companyName,
      })),
      allValue: "",
      placeholder: t("salesHistory.searchCustomerPlaceholder"),
      emptyMessage: t("salesHistory.noCustomerFound"),
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
      label: t("salesHistory.statusSectionTitle"),
      statuses: statusOptions,
      selectedStatuses,
      onChange: onSelectedStatusesChange,
      presets: saleStatusPresets.map((preset) => ({
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
      label: t("salesHistory.productFilter"),
      value: selectedProduct,
      onChange: onSelectedProductChange,
      options: productOptions.map((product) => ({
        value: product.id,
        label: product.label,
      })),
      allValue: "",
      placeholder: t("salesHistory.searchProductPlaceholder"),
      emptyMessage: t("salesHistory.noProductFound"),
    },
    {
      id: "amount",
      type: "numberRange",
      section: "advanced",
      label: t("salesHistory.amountLabel"),
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
      label: t("salesHistory.vatLabel"),
      value: vatFilter,
      onChange: onVatFilterChange,
      allValue: "all",
      allLabel: t("salesHistory.allVat"),
      options: vatOptions,
    },
  ];

  return (
    <div className="stack-layout">
      <UniversalFilter
        search={{
          value: searchTerm,
          onChange: onSearchTermChange,
          placeholder: t("salesHistory.searchPlaceholder"),
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
        rows={filteredSales}
        products={products}
        purchases={purchases}
        sales={allSales}
        enableSaleStockPrecheck={enableStockValidation}
        type="sale"
        onSaleStatusChange={onSaleStatusChange}
        onSaleUpdate={onSaleUpdate}
        onWarning={onWarning}
        onEditRow={onEditSale}
        onDeleteRow={onDeleteSale}
        compactRows={isPaginated ? 0 : 5}
        enableViewAll={!isPaginated}
        headerActions={
          <button className="primary-button" type="button" onClick={onCreateSale}>
            {t("salesHistory.newSale")}
          </button>
        }
      />

      <PaginationControls
        pagination={pagination}
        itemLabel={t("salesHistory.paginationLabel")}
        onPageChange={onPageChange}
      />
    </div>
  );
}

export default SalesHistoryDirectorySection;
