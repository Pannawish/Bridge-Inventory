// Helper utilities for category management behavior.

export const CATEGORY_STORAGE_KEY = "inventory-management-categories";

const defaultCategories = [
  {
    id: "category-stationery",
    name: "Stationery",
    description: "Paper, notebooks, and general office supplies.",
    parentId: null,
  },
  {
    id: "category-notebooks",
    name: "Notebooks",
    description: "Exercise books, notebooks, and writing pads.",
    parentId: "category-stationery",
  },
  {
    id: "category-writing-tools",
    name: "Writing Tools",
    description: "Pens, markers, pencils, and related writing items.",
    parentId: null,
  },
  {
    id: "category-pens",
    name: "Pens",
    description: "Ballpoint pens, gel pens, and office writing pens.",
    parentId: "category-writing-tools",
  },
  {
    id: "category-gel-pens",
    name: "Gel Pens",
    description: "Smooth ink gel pens grouped under pens.",
    parentId: "category-pens",
  },
  {
    id: "category-blue-gel-pens",
    name: "Blue Gel Pens",
    description: "Blue gel pens nested inside gel pens.",
    parentId: "category-gel-pens",
  },
  {
    id: "category-premium-blue-gel-pens",
    name: "Premium Blue Gel Pens",
    description: "Premium blue gel pens nested multiple levels deep.",
    parentId: "category-blue-gel-pens",
  },
  {
    id: "category-desk-accessories",
    name: "Desk Accessories",
    description: "Staplers, clips, folders, and desktop tools.",
    parentId: null,
  },
  {
    id: "category-staplers",
    name: "Staplers",
    description: "Desktop staplers and fastening tools.",
    parentId: "category-desk-accessories",
  },
  {
    id: "category-paper-goods",
    name: "Paper Goods",
    description: "Sticky notes, file paper, and paper-based products.",
    parentId: null,
  },
  {
    id: "category-sticky-notes",
    name: "Sticky Notes",
    description: "Sticky note pads and adhesive memo paper.",
    parentId: "category-paper-goods",
  },
  {
    id: "category-presentation",
    name: "Presentation Supplies",
    description: "Whiteboard, highlighting, and classroom presentation tools.",
    parentId: null,
  },
  {
    id: "category-markers",
    name: "Markers",
    description: "Whiteboard markers, permanent markers, and highlighters.",
    parentId: "category-presentation",
  },
  {
    id: "category-filing",
    name: "Filing",
    description: "Binders, folders, and storage accessories for documents.",
    parentId: "category-desk-accessories",
  },
  {
    id: "category-archive-folders",
    name: "Archive Folders",
    description: "Long-term document storage folders nested under filing.",
    parentId: "category-filing",
  },
  {
    id: "category-yearly-archive-folders",
    name: "Yearly Archive Folders",
    description: "Year-based archive folders nested inside archive folders.",
    parentId: "category-archive-folders",
  },
  {
    id: "category-correction",
    name: "Correction",
    description: "Correction tape and correction stationery.",
    parentId: "category-writing-tools",
  },
];

export function createCategory(overrides = {}) {
  return {
    id: `category-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: "",
    description: "",
    parentId: null,
    ...overrides,
  };
}

function getCategoryKey(name) {
  return `${name ?? ""}`.trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizeCategory(category) {
  return {
    id: category.id || createCategory().id,
    name: `${category.name ?? ""}`.trim(),
    description: `${category.description ?? ""}`,
    parentId: category.parentId || null,
  };
}

export function normalizeCategoryName(name) {
  return getCategoryKey(name);
}

export function getDefaultCategories() {
  return defaultCategories;
}

export function buildCategoryLookup(categories) {
  return new Map(categories.map((category) => [category.id, category]));
}

export function getCategoryChildrenMap(categories) {
  const childMap = new Map();

  categories.forEach((category) => {
    const parentKey = category.parentId || null;

    if (!childMap.has(parentKey)) {
      childMap.set(parentKey, []);
    }

    childMap.get(parentKey).push(category);
  });

  return childMap;
}

export function getCategoryPathById(categories, categoryId) {
  if (!categoryId) {
    return "";
  }

  const categoryLookup = buildCategoryLookup(categories);
  const pathParts = [];
  let currentCategory = categoryLookup.get(categoryId);
  const visited = new Set();

  while (currentCategory && !visited.has(currentCategory.id)) {
    visited.add(currentCategory.id);
    pathParts.unshift(currentCategory.name);
    currentCategory = currentCategory.parentId
      ? categoryLookup.get(currentCategory.parentId)
      : null;
  }

  return pathParts.join(" / ");
}

export function getCategoryLeafLabel(label) {
  if (!label) {
    return "";
  }

  const parts = `${label}`.split("/").map((part) => part.trim()).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "";
}

export function getLeafCategoryOptions(categories) {
  const childMap = getCategoryChildrenMap(categories);

  return categories
    .filter((category) => !(childMap.get(category.id) || []).length)
    .map((category) => ({
      id: category.id,
      name: category.name,
      label: getCategoryPathById(categories, category.id) || category.name,
    }));
}

export function getCategoryOptions(categories) {
  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    label: getCategoryPathById(categories, category.id) || category.name,
  }));
}

export function resolveLegacyCategoryId(categories, categoryName = "") {
  const normalizedName = getCategoryKey(categoryName);

  if (!normalizedName) {
    return "";
  }

  const exactLeafMatch = getLeafCategoryOptions(categories).find(
    (category) => getCategoryKey(category.name) === normalizedName
  );

  if (exactLeafMatch) {
    return exactLeafMatch.id;
  }

  const exactMatch = categories.find(
    (category) => getCategoryKey(category.name) === normalizedName
  );

  return exactMatch?.id || "";
}

export function loadCategories() {
  return defaultCategories;
}

export function getAssignedCategoryId(product, categories) {
  if (product.categoryId && categories.some((category) => category.id === product.categoryId)) {
    return product.categoryId;
  }

  return resolveLegacyCategoryId(categories, product.category);
}

export function hasCategoryChildren(categories, categoryId) {
  return categories.some((category) => category.parentId === categoryId);
}

export function getCategoryDepth(categories, categoryId) {
  let depth = 0;
  let currentParentId =
    categories.find((category) => category.id === categoryId)?.parentId || null;
  const visited = new Set();

  while (currentParentId && !visited.has(currentParentId)) {
    visited.add(currentParentId);
    depth += 1;
    currentParentId =
      categories.find((category) => category.id === currentParentId)?.parentId || null;
  }

  return depth;
}

export function isDescendantCategory(categories, categoryId, potentialParentId) {
  let currentParentId = potentialParentId;

  while (currentParentId) {
    if (currentParentId === categoryId) {
      return true;
    }

    currentParentId =
      categories.find((category) => category.id === currentParentId)?.parentId || null;
  }

  return false;
}

export function getCategoryNameKey(name) {
  return getCategoryKey(name);
}
