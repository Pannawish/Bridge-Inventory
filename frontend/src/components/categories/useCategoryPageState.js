import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import {
  createCategory,
  getCategoryPathById,
  getDefaultCategories,
  hasCategoryChildren,
} from "./categoryUtils";
import {
  computeProductAssignments,
  computeChildCategoryCounts,
  filterCategoriesHelper,
  buildCategoryRows,
  buildParentCategoryOptions,
  validateCategoryForm,
} from "./categoryPageHelpers";

export function useCategoryPageState({
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

  // Scroll lock side-effect when draftCategory (modal) opens or closes
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

  const productAssignments = useMemo(
    () => computeProductAssignments(products, categories),
    [categories, products]
  );

  const childCategoryCounts = useMemo(
    () => computeChildCategoryCounts(categories),
    [categories]
  );

  const collapsibleCategoryIds = useMemo(
    () =>
      categories
        .filter((category) => (childCategoryCounts.get(category.id) || 0) > 0)
        .map((category) => category.id),
    [categories, childCategoryCounts]
  );

  const isTreeCollapsed = useMemo(
    () =>
      collapsibleCategoryIds.length > 0 &&
      collapsibleCategoryIds.every((categoryId) => collapsedCategoryIds.has(categoryId)),
    [collapsibleCategoryIds, collapsedCategoryIds]
  );

  const activeFilterCount = (levelFilter === "all" ? 0 : 1) + (usageFilter === "all" ? 0 : 1);

  const filteredCategories = useMemo(
    () =>
      filterCategoriesHelper({
        categories,
        levelFilter,
        usageFilter,
        normalizedSearch,
        childCategoryCounts,
        productAssignments,
      }),
    [categories, levelFilter, usageFilter, normalizedSearch, childCategoryCounts, productAssignments]
  );

  const visibleCategoryIds = useMemo(
    () => new Set(filteredCategories.map((category) => category.id)),
    [filteredCategories]
  );

  const categoryRows = useMemo(
    () =>
      buildCategoryRows({
        categories,
        collapsedCategoryIds,
        visibleCategoryIds,
      }),
    [categories, collapsedCategoryIds, visibleCategoryIds]
  );

  const parentCategoryOptions = useMemo(
    () => buildParentCategoryOptions({ categories, draftCategory }),
    [categories, draftCategory]
  );

  const normalizedParentCategorySearch = parentCategoryInput.trim().toLowerCase();

  const filteredParentCategoryOptions = useMemo(() => {
    if (!normalizedParentCategorySearch) {
      return parentCategoryOptions;
    }

    return parentCategoryOptions.filter((category) =>
      category.label.toLowerCase().includes(normalizedParentCategorySearch)
    );
  }, [normalizedParentCategorySearch, parentCategoryOptions]);

  const selectedParentCategoryOption = useMemo(
    () => parentCategoryOptions.find((category) => category.id === draftCategory?.parentId),
    [parentCategoryOptions, draftCategory?.parentId]
  );

  const shouldShowRootParentOption = useMemo(
    () =>
      !normalizedParentCategorySearch ||
      "root category".includes(normalizedParentCategorySearch),
    [normalizedParentCategorySearch]
  );

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
    setLevelFilter("all");
    setUsageFilter("all");
  }

  const levelLabels = useMemo(
    () => ({
      root: t("category.levelRootLabel"),
      subcategory: t("category.levelSubLabel"),
      deep: t("category.levelDeepLabel"),
    }),
    [t]
  );

  const usageLabels = useMemo(
    () => ({
      assigned: t("category.usageAssignedLabel"),
      unassigned: t("category.usageUnassignedLabel"),
      "has-children": t("category.usageChildrenLabel"),
      leaf: t("category.usageLeafLabel"),
    }),
    [t]
  );

  const quickPresets = useMemo(
    () => [
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
    ],
    [t, levelFilter, usageFilter]
  );

  const activeChips = useMemo(
    () =>
      [
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
      ].filter(Boolean),
    [t, levelFilter, usageFilter, levelLabels, usageLabels]
  );

  async function handleSaveCategory(event) {
    event.preventDefault();

    if (!draftCategory) {
      return;
    }

    const validation = validateCategoryForm({
      draftCategory,
      parentCategoryInput,
      selectedParentCategoryOption,
      categories,
      t,
    });

    if (validation.error) {
      setFormError(validation.error);
      return;
    }

    const savedCategory = await onSaveCategory?.(validation.nextCategory);

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

  return {
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
    visibleCategoryIds,
    categoryRows,
    parentCategoryOptions,
    filteredParentCategoryOptions,
    selectedParentCategoryOption,
    shouldShowRootParentOption,
    levelLabels,
    usageLabels,
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
  };
}
