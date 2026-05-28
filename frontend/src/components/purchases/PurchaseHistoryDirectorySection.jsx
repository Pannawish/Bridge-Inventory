import PaginationControls from "../PaginationControls";
import StatusFilterGroup from "../StatusFilterGroup";
import TransactionTable from "../TransactionTable";
import {
  FilterPresets,
  ActiveFilterChips,
  RangeField,
} from "../FilterControls";
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
  filterOpen,
  onToggleFilter,
  activeFilterCount = 0,
  onResetFilters,
  quickPresets = [],
  activeChips = [],
  supplierFilterQuery,
  onSupplierFilterQueryChange,
  supplierFilterOpen,
  onSupplierFilterOpen,
  onSupplierFilterClose,
  filteredSupplierOptions = [],
  selectedSupplier,
  onSelectSupplierFilter,
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
}) {
  const { t } = useLanguage();

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
              onChange={(event) => onSearchTermChange(event.target.value)}
              placeholder={t("purchaseHistory.searchPlaceholder")}
            />
          </label>
          <div className="stock-report-summary supplier-search-meta">
            <span>
              {isServerPaginated
                ? t("purchaseHistory.pageCountServer", {
                    count: filteredPurchases.length,
                    total: totalPurchaseCount,
                  })
                : t("purchaseHistory.pageCountLocal", {
                    count: filteredPurchases.length,
                    total: totalPurchaseCount,
                  })}
            </span>
          </div>
        </div>

        <div className="history-filter-actions">
          <button
            className="secondary-button product-filter-toggle"
            type="button"
            aria-expanded={filterOpen}
            onClick={onToggleFilter}
          >
            {t("filterControls.filter")}
            {activeFilterCount ? <span>{activeFilterCount}</span> : null}
          </button>
          <button className="secondary-button" type="button" onClick={onResetFilters}>
            {t("filterControls.resetFilter")}
          </button>
        </div>

        <FilterPresets presets={quickPresets} />
        <ActiveFilterChips chips={activeChips} onClearAll={onResetFilters} />

        {filterOpen ? (
          <div className="history-filter-panel">
            <div className="history-filter-grid">
              <label className="history-filter-field supplier-combobox-field">
                <span className="history-filter-title">{t("purchaseHistory.supplierFilter")}</span>
                <div className="supplier-combobox">
                  <input
                    type="search"
                    value={supplierFilterQuery}
                    onChange={(event) => onSupplierFilterQueryChange(event.target.value)}
                    onFocus={onSupplierFilterOpen}
                    onBlur={() => {
                      window.setTimeout(onSupplierFilterClose, 120);
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
                              onSelectSupplierFilter(supplier);
                            }}
                            role="option"
                            aria-selected={supplier.companyName === selectedSupplier}
                          >
                            {supplier.companyName}
                          </button>
                        ))
                      ) : (
                        <div className="supplier-combobox-empty">
                          {t("purchaseHistory.noSupplierFound")}
                        </div>
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
                  onChange={(event) => onDateFromChange(event.target.value)}
                />
              </label>

              <label className="history-filter-field">
                <span className="history-filter-title">{t("purchaseHistory.dateToLabel")}</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(event) => onDateToChange(event.target.value)}
                />
              </label>

              <RangeField
                title={t("purchaseHistory.amountLabel")}
                prefix="฿"
                minValue={amountMin}
                maxValue={amountMax}
                onMinChange={onAmountMinChange}
                onMaxChange={onAmountMaxChange}
              />

              <label className="history-filter-field">
                <span className="history-filter-title">{t("purchaseHistory.vatLabel")}</span>
                <select
                  value={vatFilter}
                  onChange={(event) => onVatFilterChange(event.target.value)}
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
              onChange={onSelectedStatusesChange}
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
        onEditRow={onEditPurchase}
        onDeleteRow={onDeletePurchase}
        compactRows={isPaginated ? 0 : 5}
        enableViewAll={!isPaginated}
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
