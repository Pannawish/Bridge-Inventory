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
import {
  saleStatusPresets,
  statusOptions,
} from "./salesHistoryUtils";

function SalesHistoryDirectorySection({
  sales = [],
  filteredSales = [],
  products = [],
  purchases = [],
  allSales = [],
  enableStockValidation = true,
  pagination = null,
  isServerPaginated = false,
  totalSalesCount = 0,
  searchTerm,
  onSearchTermChange,
  filterOpen,
  onToggleFilter,
  activeFilterCount = 0,
  onResetFilters,
  quickPresets = [],
  activeChips = [],
  customerFilterQuery,
  onCustomerFilterQueryChange,
  customerFilterOpen,
  onCustomerFilterOpen,
  onCustomerFilterClose,
  filteredCustomerOptions = [],
  selectedCustomer,
  onSelectCustomerFilter,
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

  return (
    <div className="stack-layout">
      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("salesHistory.searchEyebrow")}</p>
            <h3>{t("salesHistory.searchTitle")}</h3>
          </div>
        </div>

        <div className="supplier-directory-toolbar">
          <label className="stock-search supplier-search">
            <span className="stock-search-icon">S</span>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => onSearchTermChange(event.target.value)}
              placeholder={t("salesHistory.searchPlaceholder")}
            />
          </label>
          <div className="stock-report-summary supplier-search-meta">
            <span>
              {isServerPaginated
                ? t("salesHistory.pageCountServer", {
                    count: filteredSales.length,
                    total: totalSalesCount,
                  })
                : t("salesHistory.pageCountLocal", {
                    count: filteredSales.length,
                    total: sales.length,
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
                <span className="history-filter-title">{t("salesHistory.customerFilter")}</span>
                <div className="supplier-combobox">
                  <input
                    type="search"
                    value={customerFilterQuery}
                    onChange={(event) => onCustomerFilterQueryChange(event.target.value)}
                    onFocus={onCustomerFilterOpen}
                    onBlur={() => {
                      window.setTimeout(onCustomerFilterClose, 120);
                    }}
                    placeholder={t("salesHistory.searchCustomerPlaceholder")}
                    autoComplete="off"
                    aria-expanded={customerFilterOpen}
                    aria-controls="sales-history-customer-filter"
                  />

                  {customerFilterOpen ? (
                    <div
                      className="supplier-combobox-menu"
                      id="sales-history-customer-filter"
                      role="listbox"
                    >
                      {filteredCustomerOptions.length ? (
                        filteredCustomerOptions.map((customer) => (
                          <button
                            key={customer.id}
                            type="button"
                            className={
                              customer.companyName === selectedCustomer
                                ? "supplier-combobox-option active"
                                : "supplier-combobox-option"
                            }
                            onMouseDown={(event) => {
                              event.preventDefault();
                              onSelectCustomerFilter(customer);
                            }}
                            role="option"
                            aria-selected={customer.companyName === selectedCustomer}
                          >
                            {customer.companyName}
                          </button>
                        ))
                      ) : (
                        <div className="supplier-combobox-empty">
                          {t("salesHistory.noCustomerFound")}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </label>

              <label className="history-filter-field">
                <span className="history-filter-title">{t("salesHistory.dateFromLabel")}</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => onDateFromChange(event.target.value)}
                />
              </label>

              <label className="history-filter-field">
                <span className="history-filter-title">{t("salesHistory.dateToLabel")}</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(event) => onDateToChange(event.target.value)}
                />
              </label>

              <RangeField
                title={t("salesHistory.amountLabel")}
                prefix="฿"
                minValue={amountMin}
                maxValue={amountMax}
                onMinChange={onAmountMinChange}
                onMaxChange={onAmountMaxChange}
              />

              <label className="history-filter-field">
                <span className="history-filter-title">{t("salesHistory.vatLabel")}</span>
                <select
                  value={vatFilter}
                  onChange={(event) => onVatFilterChange(event.target.value)}
                >
                  <option value="all">{t("salesHistory.allVat")}</option>
                  {vatOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <StatusFilterGroup
              title={t("salesHistory.statusSectionTitle")}
              statuses={statusOptions}
              selectedStatuses={selectedStatuses}
              presets={saleStatusPresets.map((preset) => ({
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
        compactRows={isServerPaginated ? 0 : 5}
        enableViewAll={!isServerPaginated}
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
