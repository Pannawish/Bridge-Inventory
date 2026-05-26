import { FilterPresets, ActiveFilterChips } from "./FilterControls";
import CategoryDirectorySection from "./categories/CategoryDirectorySection";
import CategoryEditorModal from "./categories/CategoryEditorModal";
import { useCategoryPageState } from "./categories/useCategoryPageState";
import { getDefaultCategories } from "./categories/categoryUtils";

// Preserve stable public exports for backwards-compatibility
export {
  CATEGORY_STORAGE_KEY,
  getCategoryLeafLabel,
  getCategoryOptions,
  getCategoryPathById,
  getDefaultCategories,
  loadCategories,
  normalizeCategoryName,
  resolveLegacyCategoryId,
} from "./categories/categoryUtils";

function CategoryPage({
  categories = getDefaultCategories(),
  products = [],
  onSaveCategory,
  onDeleteCategory,
}) {
  const {
    draftCategory,
    searchTerm,
    filterOpen,
    levelFilter,
    usageFilter,
    parentCategoryInput,
    isParentCategoryMenuOpen,
    formError,
    collapsedCategoryIds,
    productAssignments,
    childCategoryCounts,
    collapsibleCategoryIds,
    isTreeCollapsed,
    activeFilterCount,
    filteredCategories,
    categoryRows,
    filteredParentCategoryOptions,
    shouldShowRootParentOption,
    quickPresets,
    activeChips,
    setSearchTerm,
    setFilterOpen,
    setLevelFilter,
    setUsageFilter,
    openCategoryEditor,
    openSubcategoryEditor,
    closeCategoryEditor,
    updateDraftField,
    toggleCategoryFolder,
    toggleFullCategoryTree,
    selectParentCategory,
    handleParentCategoryInputChange,
    handleParentCategoryInputKeyDown,
    resetFilters,
    handleSaveCategory,
    handleDeleteCategory,
    setFormError,
    setIsParentCategoryMenuOpen,
    t,
  } = useCategoryPageState({
    categories,
    products,
    onSaveCategory,
    onDeleteCategory,
  });

  return (
    <div className="stack-layout">
      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("category.eyebrow")}</p>
            <h3>{t("category.findTitle")}</h3>
          </div>
        </div>

        <div className="supplier-directory-toolbar">
          <label className="stock-search supplier-search">
            <span className="stock-search-icon">S</span>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={t("category.searchPlaceholder")}
            />
          </label>
          <div className="stock-report-summary supplier-search-meta">
            <span>
              {t("category.pageCount", {
                count: filteredCategories.length,
                total: categories.length,
              })}
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
            {t("common.filter")}
            {activeFilterCount ? <span>{activeFilterCount}</span> : null}
          </button>
          <button className="secondary-button" type="button" onClick={resetFilters}>
            {t("common.resetFilter")}
          </button>
        </div>

        <FilterPresets presets={quickPresets} />
        <ActiveFilterChips chips={activeChips} onClearAll={resetFilters} />

        {filterOpen ? (
          <div className="history-filter-panel">
            <div className="history-filter-grid">
              <label className="history-filter-field">
                <span className="history-filter-title">{t("category.levelFilter")}</span>
                <select
                  value={levelFilter}
                  onChange={(event) => setLevelFilter(event.target.value)}
                >
                  <option value="all">{t("category.allLevels")}</option>
                  <option value="root">{t("category.rootCategories")}</option>
                  <option value="subcategory">{t("category.subcategories")}</option>
                  <option value="deep">{t("category.deepNested")}</option>
                </select>
              </label>

              <label className="history-filter-field">
                <span className="history-filter-title">{t("category.usageFilter")}</span>
                <select
                  value={usageFilter}
                  onChange={(event) => setUsageFilter(event.target.value)}
                >
                  <option value="all">{t("category.allCategories")}</option>
                  <option value="assigned">{t("category.assignedToProducts")}</option>
                  <option value="unassigned">{t("category.noAssigned")}</option>
                  <option value="has-children">{t("category.hasChildren")}</option>
                  <option value="leaf">{t("category.leafCategories")}</option>
                </select>
              </label>
            </div>
          </div>
        ) : null}
      </section>

      <CategoryDirectorySection
        collapsibleCategoryIds={collapsibleCategoryIds}
        isTreeCollapsed={isTreeCollapsed}
        categoryRows={categoryRows}
        childCategoryCounts={childCategoryCounts}
        productAssignments={productAssignments}
        collapsedCategoryIds={collapsedCategoryIds}
        onToggleFullCategoryTree={toggleFullCategoryTree}
        onOpenCategoryEditor={(category) =>
          category ? openCategoryEditor(category) : openCategoryEditor()
        }
        onOpenSubcategoryEditor={openSubcategoryEditor}
        onToggleCategoryFolder={toggleCategoryFolder}
      />

      {draftCategory ? (
        <CategoryEditorModal
          categories={categories}
          draftCategory={draftCategory}
          formError={formError}
          parentCategoryInput={parentCategoryInput}
          isParentCategoryMenuOpen={isParentCategoryMenuOpen}
          shouldShowRootParentOption={shouldShowRootParentOption}
          filteredParentCategoryOptions={filteredParentCategoryOptions}
          onClose={closeCategoryEditor}
          onSaveCategory={handleSaveCategory}
          onDeleteCategory={handleDeleteCategory}
          onUpdateDraftField={updateDraftField}
          onSetFormError={setFormError}
          onParentCategoryInputChange={handleParentCategoryInputChange}
          onParentCategoryFocus={() => setIsParentCategoryMenuOpen(true)}
          onParentCategoryBlur={() => {
            // Respect key lock delay for selections
            window.setTimeout(() => setIsParentCategoryMenuOpen(false), 120);
          }}
          onParentCategoryKeyDown={handleParentCategoryInputKeyDown}
          onSelectParentCategory={selectParentCategory}
        />
      ) : null}
    </div>
  );
}

export default CategoryPage;
