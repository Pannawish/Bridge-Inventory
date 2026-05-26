import { FilterPresets, ActiveFilterChips } from "../FilterControls";
import { useLanguage } from "../../i18n/LanguageContext";

function PartnerPageShell({
  entityKey,
  allProfilesLabelKey,
  searchTerm,
  onSearchTermChange,
  isServerPaginated,
  filteredCount,
  totalCount,
  localCount,
  filterOpen,
  activeFilterCount,
  onToggleFilterOpen,
  onResetFilters,
  quickPresets,
  activeChips,
  profileFilter,
  onProfileFilterChange,
  profileOptions,
  children,
}) {
  const { t } = useLanguage();

  return (
    <div className="stack-layout">
      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t(`${entityKey}.eyebrow`)}</p>
            <h3>{t(`${entityKey}.findTitle`)}</h3>
          </div>
        </div>

        <div className="supplier-directory-toolbar">
          <label className="stock-search supplier-search">
            <span className="stock-search-icon">S</span>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => onSearchTermChange(event.target.value)}
              placeholder={t(`${entityKey}.searchPlaceholder`)}
            />
          </label>
          <div className="stock-report-summary supplier-search-meta">
            <span>
              {isServerPaginated
                ? t(`${entityKey}.pageCountServer`, {
                    count: filteredCount,
                    total: totalCount,
                  })
                : t(`${entityKey}.pageCountLocal`, {
                    count: filteredCount,
                    total: localCount,
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
          <button className="secondary-button" type="button" onClick={onResetFilters}>
            {t("common.resetFilter")}
          </button>
        </div>

        <FilterPresets presets={quickPresets} />
        <ActiveFilterChips chips={activeChips} onClearAll={onResetFilters} />

        {filterOpen ? (
          <div className="history-filter-panel">
            <div className="history-filter-grid">
              <label className="history-filter-field">
                <span className="history-filter-title">{t(`${entityKey}.profileFilter`)}</span>
                <select
                  value={profileFilter}
                  onChange={(event) => onProfileFilterChange(event.target.value)}
                >
                  <option value="all">{t(allProfilesLabelKey)}</option>
                  {profileOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {t(option.labelKey)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        ) : null}
      </section>

      {children}
    </div>
  );
}

export default PartnerPageShell;
