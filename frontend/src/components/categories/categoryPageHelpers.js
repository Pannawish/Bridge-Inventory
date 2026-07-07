// Helper utilities for category management behavior.

import {
  getAssignedCategoryId,
  getCategoryDepth,
  getCategoryPathById,
  getCategoryChildrenMap,
  isDescendantCategory,
  normalizeCategory,
  getCategoryNameKey,
} from "./categoryUtils";

/**
 * Computes counting mappings of products assigned to each category.
 */
export function computeProductAssignments(products, categories) {
  const assignmentCount = new Map();

  products.forEach((product) => {
    const categoryId = getAssignedCategoryId(product, categories);

    if (!categoryId) {
      return;
    }

    assignmentCount.set(categoryId, (assignmentCount.get(categoryId) || 0) + 1);
  });

  return assignmentCount;
}

/**
 * Computes countings of immediate subcategory descendants.
 */
export function computeChildCategoryCounts(categories) {
  const counts = new Map();

  categories.forEach((category) => {
    const parentId = category.parentId || null;
    counts.set(parentId, (counts.get(parentId) || 0) + 1);
  });

  return counts;
}

/**
 * Performs visibility and filter searches across the flat categories list.
 */
export function filterCategoriesHelper({
  categories,
  levelFilter,
  usageFilter,
  normalizedSearch,
  childCategoryCounts,
  productAssignments,
}) {
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
}

/**
 * Traverses visible categories recursively to prepare hierarchical row layouts.
 */
export function buildCategoryRows({ categories, collapsedCategoryIds, visibleCategoryIds }) {
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
}

/**
 * Computes options for selecting valid parent categories (excluding circular dependencies).
 */
export function buildParentCategoryOptions({ categories, draftCategory }) {
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
}

/**
 * Validates the modal editor categories form schema.
 */
export function validateCategoryForm({
  draftCategory,
  parentCategoryInput,
  selectedParentCategoryOption,
  categories,
  t,
}) {
  const nextCategory = normalizeCategory(draftCategory);
  const nextKey = getCategoryNameKey(nextCategory.name);

  if (!nextKey) {
    return { error: t("category.errorNameRequired") };
  }

  if (
    parentCategoryInput.trim() &&
    selectedParentCategoryOption?.label.toLowerCase() !==
      parentCategoryInput.trim().toLowerCase()
  ) {
    return { error: t("category.errorParentMismatch") };
  }

  if (
    nextCategory.parentId &&
    isDescendantCategory(categories, nextCategory.id, nextCategory.parentId)
  ) {
    return { error: t("category.errorCircular") };
  }

  const duplicate = categories.some(
    (category) =>
      category.id !== nextCategory.id &&
      category.parentId === nextCategory.parentId &&
      getCategoryNameKey(category.name) === nextKey
  );

  if (duplicate) {
    return { error: t("category.errorDuplicate") };
  }

  return { nextCategory };
}
