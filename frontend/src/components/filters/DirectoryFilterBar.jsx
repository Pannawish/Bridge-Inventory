import { FilterPresets, ActiveFilterChips } from "../FilterControls";
import { useLanguage } from "../../i18n/LanguageContext";

// Shared filter chrome for every directory/history page. Renders the heading,
// the search + result-count toolbar, an always-visible primary row of the most
// used facets, the quick presets and active-filter chips, and a collapsible
// "More filters" panel for secondary facets. Pages compose their own facet
// controls into `primaryFields` / `moreFields` using the shared field
// components in FilterControls, so the layout and workflow stay identical
// everywhere while each page declares only the facets it needs.
function DirectoryFilterBar({
  eyebrow,
  title,
  headerActions = null,
  searchTerm,
  onSearchTermChange,
  searchPlaceholder,
  countLabel,
  primaryFields,
  moreFields = null,
  filterOpen = false,
  onToggleFilter,
  activeFilterCount = 0,
  quickPresets = [],
  activeChips = [],
  onResetFilters,
  children = null,
}) {
  const { t } = useLanguage();
  const hasMore = Boolean(moreFields);
  const hasHeading = Boolean(eyebrow || title || headerActions);

  return (
    <section className="section-card directory-filter-card">
      {hasHeading ? (
        <div className="section-heading">
          <div>
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            {title ? <h3>{title}</h3> : null}
          </div>
          {headerActions}
        </div>
      ) : null}

      <div className="filter-bar-toolbar">
        <label className="stock-search filter-bar-search">
          <span className="stock-search-icon">S</span>
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            placeholder={searchPlaceholder}
          />
        </label>
        {countLabel ? <span className="filter-bar-count">{countLabel}</span> : null}
      </div>

      <div className="filter-bar-primary">
        <div className="filter-bar-fields">{primaryFields}</div>
        <div className="filter-bar-actions">
          {hasMore ? (
            <button
              type="button"
              className="secondary-button filter-bar-more-toggle"
              aria-expanded={filterOpen}
              onClick={onToggleFilter}
            >
              {t("filterControls.moreFilters")}
              {activeFilterCount ? (
                <span className="filter-bar-badge">{activeFilterCount}</span>
              ) : null}
            </button>
          ) : null}
          <button type="button" className="secondary-button" onClick={onResetFilters}>
            {t("filterControls.resetFilter")}
          </button>
        </div>
      </div>

      <FilterPresets presets={quickPresets} />
      <ActiveFilterChips chips={activeChips} onClearAll={onResetFilters} />

      {hasMore && filterOpen ? (
        <div className="history-filter-panel filter-bar-more">
          <div className="history-filter-grid">{moreFields}</div>
        </div>
      ) : null}

      {children}
    </section>
  );
}

export default DirectoryFilterBar;
