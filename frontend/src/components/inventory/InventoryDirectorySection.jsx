// Section component for inventory control forms or detail views.

import {
  DAYS_OPTIONS,
  HEALTH_KEYS,
  SORT_OPTIONS,
  toggleInSet,
} from "./inventoryUtils";
import InventoryProductStockRow from "./InventoryProductStockRow";
import UniversalFilter from "../filters/UniversalFilter";
import { useLanguage } from "../../i18n/LanguageContext";

function InventoryDirectorySection({
  search,
  onSearchChange,
  stockReportCount,
  filteredRows,
  sortKey,
  onSortKeyChange,
  quickPresets,
  activeChips,
  onResetFilters,
  healthSet,
  setHealthSet,
  categoryFilter,
  onCategoryFilterChange,
  categoryOptions,
  supplierFilter,
  onSupplierFilterChange,
  supplierFilterOptions,
  daysWithin,
  onDaysWithinChange,
  needsReorderOnly,
  onToggleNeedsReorderOnly,
  valueMin,
  onValueMinChange,
  valueMax,
  onValueMaxChange,
  onOpenDetail,
  onCreatePo,
}) {
  const { t } = useLanguage();

  // Inventory's purpose is stock-health monitoring, so Health sits in the
  // always-visible row alongside sort/supplier/category. The deeper facets
  // (movement, stockout window, reorder need, value) live under More.
  const filterFields = [
    {
      id: "sort",
      type: "select",
      section: "primary",
      label: t("inventory.sortLabel"),
      value: sortKey,
      onChange: onSortKeyChange,
      options: SORT_OPTIONS.map((option) => ({
        value: option,
        label: t(`inventory.sort.${option}`),
      })),
    },
    {
      id: "supplier",
      type: "select",
      section: "primary",
      label: t("inventory.filters.supplier"),
      value: supplierFilter,
      onChange: onSupplierFilterChange,
      allValue: "all",
      allLabel: t("inventory.filters.allSuppliers"),
      options: supplierFilterOptions.map((supplier) => ({
        value: supplier,
        label: supplier,
      })),
    },
    {
      id: "category",
      type: "select",
      section: "primary",
      label: t("inventory.filterCategory"),
      value: categoryFilter,
      onChange: onCategoryFilterChange,
      allValue: "all",
      allLabel: t("inventory.allCategories"),
      options: categoryOptions.map((category) => ({
        value: category,
        label: category,
      })),
    },
    {
      id: "health",
      type: "chipGroup",
      section: "primary",
      span: 2,
      label: t("inventory.filterHealth"),
      options: HEALTH_KEYS.map((key) => ({
        value: key,
        label: t(`inventory.health.${key}`),
      })),
      selectedValues: [...healthSet],
      onToggle: (value) => toggleInSet(setHealthSet, value),
    },
    {
      id: "days",
      type: "select",
      section: "advanced",
      label: t("inventory.filters.days"),
      value: daysWithin,
      onChange: onDaysWithinChange,
      allValue: "all",
      allLabel: t("inventory.filters.daysAny"),
      options: DAYS_OPTIONS.map((value) => ({
        value,
        label: t(`inventory.filters.days${value}`),
      })),
    },
    {
      id: "reorder",
      type: "toggle",
      section: "advanced",
      label: t("inventory.filters.reorderNeed"),
      active: needsReorderOnly,
      onToggle: onToggleNeedsReorderOnly,
      toggleLabel: t("inventory.filters.needsReorderOnly"),
    },
    {
      id: "value",
      type: "numberRange",
      section: "advanced",
      label: t("inventory.filters.value"),
      prefix: "฿",
      min: valueMin,
      max: valueMax,
      onMinChange: onValueMinChange,
      onMaxChange: onValueMaxChange,
      placeholderMin: t("inventory.filters.min"),
      placeholderMax: t("inventory.filters.max"),
    },
  ];

  return (
    <UniversalFilter
      search={{
        value: search,
        onChange: onSearchChange,
        placeholder: t("inventory.searchPlaceholder"),
      }}
      meta={t("inventory.shownCount", {
        shown: filteredRows.length,
        total: stockReportCount,
      })}
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
    >
      {filteredRows.length === 0 ? (
        <p className="empty-copy">{t("inventory.noMatch")}</p>
      ) : (
        <div className="inv-card-list">
          {filteredRows.map(({ row, health }) => (
            <InventoryProductStockRow
              key={row.product_id}
              row={row}
              health={health}
              onShowDetails={() => onOpenDetail({ row, health })}
              onCreatePo={onCreatePo ? () => onCreatePo(row) : undefined}
            />
          ))}
        </div>
      )}
    </UniversalFilter>
  );
}

export default InventoryDirectorySection;
