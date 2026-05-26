import {
  DAYS_OPTIONS,
  HEALTH_KEYS,
  MOVEMENT_KEYS,
  SORT_OPTIONS,
  toggleInSet,
} from "./inventoryUtils";
import InventoryProductStockRow from "./InventoryProductStockRow";
import { useLanguage } from "../../i18n/LanguageContext";

function InventoryDirectorySection({
  search,
  onSearchChange,
  stockReportCount,
  filteredRows,
  filterOpen,
  onToggleFilterOpen,
  activeFilterCount,
  sortKey,
  onSortKeyChange,
  quickPresets,
  activeChips,
  onResetFilters,
  healthSet,
  setHealthSet,
  movementSet,
  setMovementSet,
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
  onCloseFilters,
}) {
  const { t } = useLanguage();

  return (
    <section className="section-card">
      <div className="supplier-directory-toolbar">
        <label className="stock-search supplier-search">
          <span className="stock-search-icon">S</span>
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t("inventory.searchPlaceholder")}
          />
        </label>
        <div className="stock-report-summary supplier-search-meta">
          <span>
            {t("inventory.shownCount", {
              shown: filteredRows.length,
              total: stockReportCount,
            })}
          </span>
        </div>
      </div>

      <div className="history-filter-actions">
        <button
          className="secondary-button product-filter-toggle"
          type="button"
          aria-expanded={filterOpen}
          onClick={onToggleFilterOpen}
        >
          {t("common.filter")}
          {activeFilterCount ? <span>{activeFilterCount}</span> : null}
        </button>
        <label className="history-filter-field inv-sort-inline">
          <span className="history-filter-title">{t("inventory.sortLabel")}</span>
          <select value={sortKey} onChange={(event) => onSortKeyChange(event.target.value)}>
            {SORT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {t(`inventory.sort.${option}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="history-filter-presets">
        <span className="history-filter-presets-label">{t("inventory.filters.quickLabel")}</span>
        {quickPresets.map((preset) => (
          <button
            key={preset.key}
            type="button"
            className={`history-filter-preset${preset.active ? " active" : ""}`}
            aria-pressed={preset.active}
            onClick={preset.onClick}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {activeChips.length ? (
        <div className="history-filter-chipbar">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              className="history-filter-chip"
              onClick={chip.onRemove}
              title={t("inventory.filters.removeFilter")}
            >
              <span className="history-filter-chip-label">{chip.label}</span>
              <span className="history-filter-chip-remove" aria-hidden="true">×</span>
            </button>
          ))}
          <button type="button" className="history-filter-clear-all" onClick={onResetFilters}>
            {t("inventory.filters.clearAll")}
          </button>
        </div>
      ) : null}

      {filterOpen ? (
        <div className="history-filter-panel inv-filter-panel">
          <div className="history-filter-grid">
            <div className="history-filter-field">
              <span className="history-filter-title">{t("inventory.filterHealth")}</span>
              <div className="inv-chip-group">
                {HEALTH_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={`history-filter-preset${healthSet.has(key) ? " active" : ""}`}
                    aria-pressed={healthSet.has(key)}
                    onClick={() => toggleInSet(setHealthSet, key)}
                  >
                    {t(`inventory.health.${key}`)}
                  </button>
                ))}
              </div>
            </div>

            <div className="history-filter-field">
              <span className="history-filter-title">{t("inventory.filterMovement")}</span>
              <div className="inv-chip-group">
                {MOVEMENT_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={`history-filter-preset${movementSet.has(key) ? " active" : ""}`}
                    aria-pressed={movementSet.has(key)}
                    onClick={() => toggleInSet(setMovementSet, key)}
                  >
                    {t(`inventory.movement.${key}`)}
                  </button>
                ))}
              </div>
            </div>

            <label className="history-filter-field">
              <span className="history-filter-title">{t("inventory.filterCategory")}</span>
              <select value={categoryFilter} onChange={(event) => onCategoryFilterChange(event.target.value)}>
                <option value="all">{t("inventory.allCategories")}</option>
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>

            <label className="history-filter-field">
              <span className="history-filter-title">{t("inventory.filters.supplier")}</span>
              <select value={supplierFilter} onChange={(event) => onSupplierFilterChange(event.target.value)}>
                <option value="all">{t("inventory.filters.allSuppliers")}</option>
                {supplierFilterOptions.map((supplier) => (
                  <option key={supplier} value={supplier}>
                    {supplier}
                  </option>
                ))}
              </select>
            </label>

            <label className="history-filter-field">
              <span className="history-filter-title">{t("inventory.filters.days")}</span>
              <select value={daysWithin} onChange={(event) => onDaysWithinChange(event.target.value)}>
                <option value="all">{t("inventory.filters.daysAny")}</option>
                {DAYS_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {t(`inventory.filters.days${value}`)}
                  </option>
                ))}
              </select>
            </label>

            <div className="history-filter-field">
              <span className="history-filter-title">{t("inventory.filters.reorderNeed")}</span>
              <div className="inv-chip-group">
                <button
                  type="button"
                  className={`history-filter-preset${needsReorderOnly ? " active" : ""}`}
                  aria-pressed={needsReorderOnly}
                  onClick={onToggleNeedsReorderOnly}
                >
                  {t("inventory.filters.needsReorderOnly")}
                </button>
              </div>
            </div>

            <div className="history-filter-field">
              <span className="history-filter-title">{t("inventory.filters.value")}</span>
              <div className="history-filter-range">
                <span className="history-filter-range-prefix">฿</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={valueMin}
                  onChange={(event) => onValueMinChange(event.target.value)}
                  placeholder={t("inventory.filters.min")}
                />
                <span className="history-filter-range-sep">–</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={valueMax}
                  onChange={(event) => onValueMaxChange(event.target.value)}
                  placeholder={t("inventory.filters.max")}
                />
              </div>
            </div>
          </div>

          <div className="history-filter-actions">
            <button className="secondary-button" type="button" onClick={onResetFilters}>
              {t("common.reset")}
            </button>
            <button className="primary-button" type="button" onClick={onCloseFilters}>
              {t("inventory.filters.done")}
            </button>
          </div>
        </div>
      ) : null}

      {filteredRows.length === 0 ? (
        <p className="empty-copy">{t("inventory.noMatch")}</p>
      ) : (
        <div className="inv-card-list">
          {filteredRows.map(({ row, health, movement }) => (
            <InventoryProductStockRow
              key={row.product_id}
              row={row}
              health={health}
              movement={movement}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default InventoryDirectorySection;
