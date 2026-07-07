// Page component for shared component workflows.

import UniversalFilter from "./filters/UniversalFilter";
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
    isDraftCategoryDirty,
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

  const levelOptions = [
    { value: "root", label: t("category.rootCategories") },
    { value: "subcategory", label: t("category.subcategories") },
    { value: "deep", label: t("category.deepNested") },
  ];
  const usageOptions = [
    { value: "assigned", label: t("category.assignedToProducts") },
    { value: "unassigned", label: t("category.noAssigned") },
    { value: "has-children", label: t("category.hasChildren") },
    { value: "leaf", label: t("category.leafCategories") },
  ];

  // WHAT (level) → usage, both always visible.
  const filterFields = [
    {
      id: "level",
      type: "select",
      section: "primary",
      label: t("category.levelFilter"),
      value: levelFilter,
      onChange: setLevelFilter,
      allValue: "all",
      allLabel: t("category.allLevels"),
      options: levelOptions,
    },
    {
      id: "usage",
      type: "select",
      section: "primary",
      label: t("category.usageFilter"),
      value: usageFilter,
      onChange: setUsageFilter,
      allValue: "all",
      allLabel: t("category.allCategories"),
      options: usageOptions,
    },
  ];

  return (
    <div className="stack-layout">
      <UniversalFilter
        search={{
          value: searchTerm,
          onChange: setSearchTerm,
          placeholder: t("category.searchPlaceholder"),
        }}
        meta={t("category.pageCount", {
          count: filteredCategories.length,
          total: categories.length,
        })}
        fields={filterFields}
        quickFilters={quickPresets}
        activeChips={activeChips}
        onReset={resetFilters}
        labels={{
          more: t("filterControls.moreFilters"),
          reset: t("filterControls.resetFilter"),
          quick: t("filterControls.quickFilters"),
          clearAll: t("filterControls.clearAll"),
        }}
      />

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
          isDirty={isDraftCategoryDirty}
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
