import { useEffect, useMemo, useState } from "react";
import { FilterPresets, ActiveFilterChips } from "./FilterControls";
import { useLanguage } from "../i18n/LanguageContext";
import CategoryDirectorySection from "./categories/CategoryDirectorySection";
import CategoryEditorModal from "./categories/CategoryEditorModal";
import {
  CATEGORY_STORAGE_KEY,
  createCategory,
  getAssignedCategoryId,
  getCategoryLeafLabel,
  getCategoryChildrenMap,
  getCategoryDepth,
  getCategoryNameKey,
  getCategoryOptions,
  getCategoryPathById,
  getDefaultCategories,
  hasCategoryChildren,
  isDescendantCategory,
  loadCategories,
  normalizeCategory,
  normalizeCategoryName,
  resolveLegacyCategoryId,
} from "./categories/categoryUtils";

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
  const { t } = useLanguage();
  const [draftCategory, setDraftCategory] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [levelFilter, setLevelFilter] = useState("all");
  const [usageFilter, setUsageFilter] = useState("all");
  const [parentCategoryInput, setParentCategoryInput] = useState("");
  const [isParentCategoryMenuOpen, setIsParentCategoryMenuOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [collapsedCategoryIds, setCollapsedCategoryIds] = useState(() => new Set());

  useEffect(() => {
    if (typeof document === "undefined" || !draftCategory) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [draftCategory]);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const productAssignments = useMemo(() => {
    const assignmentCount = new Map();

    products.forEach((product) => {
      const categoryId = getAssignedCategoryId(product, categories);

      if (!categoryId) {
        return;
      }

      assignmentCount.set(categoryId, (assignmentCount.get(categoryId) || 0) + 1);
    });

    return assignmentCount;
  }, [categories, products]);
  const childCategoryCounts = useMemo(() => {
    const counts = new Map();

    categories.forEach((category) => {
      const parentId = category.parentId || null;
      counts.set(parentId, (counts.get(parentId) || 0) + 1);
    });

    return counts;
  }, [categories]);
  const collapsibleCategoryIds = useMemo(
    () =>
      categories
        .filter((category) => (childCategoryCounts.get(category.id) || 0) > 0)
        .map((category) => category.id),
    [categories, childCategoryCounts]
  );
  const isTreeCollapsed =
    collapsibleCategoryIds.length > 0 &&
    collapsibleCategoryIds.every((categoryId) => collapsedCategoryIds.has(categoryId));
  const activeFilterCount = (levelFilter === "all" ? 0 : 1) + (usageFilter === "all" ? 0 : 1);
  const filteredCategories = useMemo(() => {
    const matchingIds = new Set(
      categories
        .filter((category) => {
          const path = getCategoryPathById(categories, category.id).toLowerCase();
          const directChildCount = childCategoryCounts.get(category.id) || 0;
          const assignedProductCount = productAssignments.get(category.id) || 0;
          const depth = getCategoryDepth(categories, category.id);
          const matchesSearch =
            !normalizedSearch ||
            category.name.toLowerCase().includes(normalizedSearch) ||
            category.description.toLowerCase().includes(normalizedSearch) ||
            path.includes(normalizedSearch);

          if (!matchesSearch) {
            return false;
          }
          if (levelFilter === "root" && category.parentId) {
            return false;
          }
          if (levelFilter === "subcategory" && !category.parentId) {
            return false;
          }
          if (levelFilter === "deep" && depth < 2) {
            return false;
          }
          if (usageFilter === "assigned" && assignedProductCount === 0) {
            return false;
          }
          if (usageFilter === "unassigned" && assignedProductCount > 0) {
            return false;
          }
          if (usageFilter === "has-children" && directChildCount === 0) {
            return false;
          }
          if (usageFilter === "leaf" && directChildCount > 0) {
            return false;
          }

          return true;
        })
        .map((category) => category.id)
    );
    const visibleIds = new Set(matchingIds);

    matchingIds.forEach((categoryId) => {
      let currentParentId =
        categories.find((category) => category.id === categoryId)?.parentId || null;

      while (currentParentId) {
        visibleIds.add(currentParentId);
        currentParentId =
          categories.find((category) => category.id === currentParentId)?.parentId || null;
      }
    });

    return categories.filter((category) => visibleIds.has(category.id));
  }, [
    categories,
    childCategoryCounts,
    levelFilter,
    normalizedSearch,
    productAssignments,
    usageFilter,
  ]);
  const visibleCategoryIds = useMemo(
    () => new Set(filteredCategories.map((category) => category.id)),
    [filteredCategories]
  );
  const categoryRows = useMemo(() => {
    const childMap = getCategoryChildrenMap(categories);
    const rows = [];

    function visit(parentId, depth, ancestorContinuations = []) {
      const children = (childMap.get(parentId) || []).filter((category) =>
        visibleCategoryIds.has(category.id)
      );

      children.forEach((category, index) => {
        const isLastSibling = index === children.length - 1;
        const visibleChildren = (childMap.get(category.id) || []).filter((child) =>
          visibleCategoryIds.has(child.id)
        );

        rows.push({
          category,
          depth,
          hasChildren: visibleChildren.length > 0,
          isLastSibling,
          ancestorContinuations,
        });

        if (!collapsedCategoryIds.has(category.id)) {
          visit(category.id, depth + 1, [...ancestorContinuations, !isLastSibling]);
        }
      });
    }

    visit(null, 0);
    return rows;
  }, [categories, collapsedCategoryIds, visibleCategoryIds]);
  const parentCategoryOptions = useMemo(() => {
    if (!draftCategory) {
      return [];
    }

    return categories
      .filter((category) => category.id !== draftCategory.id)
      .filter((category) => !isDescendantCategory(categories, draftCategory.id, category.id))
      .map((category) => ({
        id: category.id,
        label: getCategoryPathById(categories, category.id) || category.name,
      }));
  }, [categories, draftCategory]);
  const normalizedParentCategorySearch = parentCategoryInput.trim().toLowerCase();
  const filteredParentCategoryOptions = useMemo(() => {
    if (!normalizedParentCategorySearch) {
      return parentCategoryOptions;
    }

    return parentCategoryOptions.filter((category) =>
      category.label.toLowerCase().includes(normalizedParentCategorySearch)
    );
  }, [normalizedParentCategorySearch, parentCategoryOptions]);
  const selectedParentCategoryOption = parentCategoryOptions.find(
    (category) => category.id === draftCategory?.parentId
  );
  const shouldShowRootParentOption =
    !normalizedParentCategorySearch ||
    "root category".includes(normalizedParentCategorySearch);

  function openCategoryEditor(category = createCategory()) {
    setDraftCategory(category);
    setParentCategoryInput(
      category.parentId ? getCategoryPathById(categories, category.parentId) || "" : ""
    );
    setIsParentCategoryMenuOpen(false);
    setFormError("");
  }

  function openSubcategoryEditor(parentCategory) {
    openCategoryEditor(createCategory({ parentId: parentCategory.id }));
  }

  function closeCategoryEditor() {
    setDraftCategory(null);
    setParentCategoryInput("");
    setIsParentCategoryMenuOpen(false);
    setFormError("");
  }

  function updateDraftField(key, value) {
    setDraftCategory((currentCategory) =>
      currentCategory ? { ...currentCategory, [key]: value } : currentCategory
    );
  }

  function toggleCategoryFolder(categoryId) {
    setCollapsedCategoryIds((currentIds) => {
      const nextIds = new Set(currentIds);

      if (nextIds.has(categoryId)) {
        nextIds.delete(categoryId);
      } else {
        nextIds.add(categoryId);
      }

      return nextIds;
    });
  }

  function toggleFullCategoryTree() {
    setCollapsedCategoryIds(isTreeCollapsed ? new Set() : new Set(collapsibleCategoryIds));
  }

  function selectParentCategory(category) {
    updateDraftField("parentId", category?.id || null);
    setParentCategoryInput(category?.label || "");
    setIsParentCategoryMenuOpen(false);
    setFormError("");
  }

  function handleParentCategoryInputChange(value) {
    const normalizedValue = value.trim().toLowerCase();
    const exactMatch = parentCategoryOptions.find(
      (category) => category.label.toLowerCase() === normalizedValue
    );

    setParentCategoryInput(value);
    updateDraftField("parentId", exactMatch?.id || null);
    setIsParentCategoryMenuOpen(true);
    setFormError("");
  }

  function handleParentCategoryInputKeyDown(event) {
    if (event.key === "Escape") {
      setIsParentCategoryMenuOpen(false);
      return;
    }

    if (event.key !== "Enter") {
      return;
    }

    if (filteredParentCategoryOptions.length === 1) {
      event.preventDefault();
      selectParentCategory(filteredParentCategoryOptions[0]);
    }
  }

  function resetFilters() {
    setSearchTerm("");
    setLevelFilter("all");
    setUsageFilter("all");
    setFilterOpen(false);
  }

  const levelLabels = {
    root: t("category.levelRootLabel"),
    subcategory: t("category.levelSubLabel"),
    deep: t("category.levelDeepLabel"),
  };
  const usageLabels = {
    assigned: t("category.usageAssignedLabel"),
    unassigned: t("category.usageUnassignedLabel"),
    "has-children": t("category.usageChildrenLabel"),
    leaf: t("category.usageLeafLabel"),
  };
  const quickPresets = [
    {
      label: t("category.quickRoot"),
      active: levelFilter === "root",
      onClick: () => setLevelFilter((current) => (current === "root" ? "all" : "root")),
    },
    {
      label: t("category.quickUnassigned"),
      active: usageFilter === "unassigned",
      onClick: () =>
        setUsageFilter((current) => (current === "unassigned" ? "all" : "unassigned")),
    },
    {
      label: t("category.quickLeaf"),
      active: usageFilter === "leaf",
      onClick: () => setUsageFilter((current) => (current === "leaf" ? "all" : "leaf")),
    },
  ];
  const activeChips = [
    levelFilter !== "all" && {
      key: "level",
      label: t("category.levelChip", { label: levelLabels[levelFilter] || levelFilter }),
      onRemove: () => setLevelFilter("all"),
    },
    usageFilter !== "all" && {
      key: "usage",
      label: t("category.usageChip", { label: usageLabels[usageFilter] || usageFilter }),
      onRemove: () => setUsageFilter("all"),
    },
  ].filter(Boolean);

  async function handleSaveCategory(event) {
    event.preventDefault();

    if (!draftCategory) {
      return;
    }

    const nextCategory = normalizeCategory(draftCategory);
    const nextKey = getCategoryNameKey(nextCategory.name);

    if (!nextKey) {
      setFormError(t("category.errorNameRequired"));
      return;
    }

    if (
      parentCategoryInput.trim() &&
      selectedParentCategoryOption?.label.toLowerCase() !==
        parentCategoryInput.trim().toLowerCase()
    ) {
      setFormError(t("category.errorParentMismatch"));
      return;
    }

    if (
      nextCategory.parentId &&
      isDescendantCategory(categories, nextCategory.id, nextCategory.parentId)
    ) {
      setFormError(t("category.errorCircular"));
      return;
    }

    const duplicate = categories.some(
      (category) =>
        category.id !== nextCategory.id &&
        category.parentId === nextCategory.parentId &&
        getCategoryNameKey(category.name) === nextKey
    );

    if (duplicate) {
      setFormError(t("category.errorDuplicate"));
      return;
    }

    const savedCategory = await onSaveCategory?.(nextCategory);

    if (savedCategory === false) {
      return;
    }

    closeCategoryEditor();
  }

  async function handleDeleteCategory() {
    if (!draftCategory) {
      return;
    }

    if (hasCategoryChildren(categories, draftCategory.id)) {
      setFormError(t("category.errorHasChildren"));
      return;
    }

    if ((productAssignments.get(draftCategory.id) || 0) > 0) {
      setFormError(t("category.errorHasProducts"));
      return;
    }

    const confirmed = window.confirm(
      t("category.deleteConfirm", {
        name: draftCategory.name || t("category.unnamedCategory"),
      })
    );

    if (!confirmed) {
      return;
    }

    const deleted = await onDeleteCategory?.(draftCategory);

    if (deleted === false) {
      return;
    }

    closeCategoryEditor();
  }

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
          onParentCategoryBlur={() => setIsParentCategoryMenuOpen(false)}
          onParentCategoryKeyDown={handleParentCategoryInputKeyDown}
          onSelectParentCategory={selectParentCategory}
        />
      ) : null}
    </div>
  );
}

export default CategoryPage;
