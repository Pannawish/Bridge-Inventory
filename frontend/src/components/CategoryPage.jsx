import { useEffect, useMemo, useState } from "react";

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

function createCategory(overrides = {}) {
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

function normalizeCategory(category) {
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

function getCategoryChildrenMap(categories) {
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

function getAssignedCategoryId(product, categories) {
  if (product.categoryId && categories.some((category) => category.id === product.categoryId)) {
    return product.categoryId;
  }

  return resolveLegacyCategoryId(categories, product.category);
}

function hasCategoryChildren(categories, categoryId) {
  return categories.some((category) => category.parentId === categoryId);
}

function getCategoryDepth(categories, categoryId) {
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

function isDescendantCategory(categories, categoryId, potentialParentId) {
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

function CategoryPage({
  categories = defaultCategories,
  products = [],
  onSaveCategory,
  onDeleteCategory,
}) {
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
  const activeFilterCount =
    (levelFilter === "all" ? 0 : 1) + (usageFilter === "all" ? 0 : 1);
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

  function selectParentCategory(category) {
    updateDraftField("parentId", category?.id || null);
    setParentCategoryInput(category?.label || "");
    setIsParentCategoryMenuOpen(false);
    setFormError("");
  }

  function handleParentCategoryInputChange(value) {
    const nextValue = value;
    const normalizedValue = nextValue.trim().toLowerCase();
    const exactMatch = parentCategoryOptions.find(
      (category) => category.label.toLowerCase() === normalizedValue
    );

    setParentCategoryInput(nextValue);
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

  async function handleSaveCategory(event) {
    event.preventDefault();

    if (!draftCategory) {
      return;
    }

    const nextCategory = normalizeCategory(draftCategory);
    const nextKey = getCategoryKey(nextCategory.name);

    if (!nextKey) {
      setFormError("Category name is required.");
      return;
    }

    if (
      parentCategoryInput.trim() &&
      selectedParentCategoryOption?.label.toLowerCase() !==
        parentCategoryInput.trim().toLowerCase()
    ) {
      setFormError(
        "Choose a matching parent category from the dropdown, or clear the field for Root Category."
      );
      return;
    }

    if (
      nextCategory.parentId &&
      isDescendantCategory(categories, nextCategory.id, nextCategory.parentId)
    ) {
      setFormError("Parent category cannot be the current category or its child.");
      return;
    }

    const duplicate = categories.some(
      (category) =>
        category.id !== nextCategory.id &&
        category.parentId === nextCategory.parentId &&
        getCategoryKey(category.name) === nextKey
    );

    if (duplicate) {
      setFormError("This category already exists in the selected parent folder.");
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
      setFormError("Delete or move subcategories before deleting this folder.");
      return;
    }

    if ((productAssignments.get(draftCategory.id) || 0) > 0) {
      setFormError("This category is assigned to products and cannot be deleted.");
      return;
    }

    const confirmed = window.confirm(
      `Delete category ${draftCategory.name || "this category"}?`
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
            <p className="eyebrow">Category</p>
            <h3>Find Categories</h3>
          </div>
        </div>

        <div className="supplier-directory-toolbar">
          <label className="stock-search supplier-search">
            <span className="stock-search-icon">S</span>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search category name or description"
            />
          </label>
          <div className="stock-report-summary supplier-search-meta">
            <span>{filteredCategories.length} of {categories.length} categories shown</span>
          </div>
        </div>

        <div className="history-filter-actions">
          <button
            className="secondary-button product-filter-toggle"
            type="button"
            aria-expanded={filterOpen}
            onClick={() => setFilterOpen((currentValue) => !currentValue)}
          >
            Filter
            {activeFilterCount ? <span>{activeFilterCount}</span> : null}
          </button>
          <button className="secondary-button" type="button" onClick={resetFilters}>
            Reset Filter
          </button>
        </div>

        {filterOpen ? (
          <div className="history-filter-panel">
            <div className="history-filter-grid">
              <label className="history-filter-field">
                <span className="history-filter-title">Category Level</span>
                <select
                  value={levelFilter}
                  onChange={(event) => setLevelFilter(event.target.value)}
                >
                  <option value="all">All levels</option>
                  <option value="root">Root categories</option>
                  <option value="subcategory">Subcategories</option>
                  <option value="deep">Deep nested categories</option>
                </select>
              </label>

              <label className="history-filter-field">
                <span className="history-filter-title">Category Use</span>
                <select
                  value={usageFilter}
                  onChange={(event) => setUsageFilter(event.target.value)}
                >
                  <option value="all">All categories</option>
                  <option value="assigned">Assigned to products</option>
                  <option value="unassigned">No assigned products</option>
                  <option value="has-children">Has subcategories</option>
                  <option value="leaf">Leaf categories</option>
                </select>
              </label>
            </div>
          </div>
        ) : null}
      </section>

      <section className="section-card supplier-directory-card">
        <div className="section-heading supplier-directory-heading">
          <div>
            <p className="eyebrow">Category Directory</p>
            <h3>Category List</h3>
          </div>
          <button className="primary-button" type="button" onClick={() => openCategoryEditor()}>
            New Category
          </button>
        </div>

        <div className="table-scroll category-tree-table">
          {categoryRows.length === 0 ? (
            <p className="empty-copy">No categories match the current search.</p>
          ) : (
            <table>
              <colgroup>
                <col className="category-col-name" />
                <col className="category-col-products" />
                <col className="category-col-children" />
                <col className="category-col-action" />
              </colgroup>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Products</th>
                  <th>Subcategories</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {categoryRows.map(({
                  category,
                  depth,
                  hasChildren,
                  isLastSibling,
                  ancestorContinuations,
                }) => {
                  const directChildCount = childCategoryCounts.get(category.id) || 0;
                  const assignedProductCount = productAssignments.get(category.id) || 0;
                  const isExpanded = hasChildren && !collapsedCategoryIds.has(category.id);

                  return (
                    <tr key={category.id}>
                      <td>
                        <div className="category-tree-cell">
                          <span className="category-tree-guides" aria-hidden="true">
                            {Array.from({ length: depth }).map((_, level) => {
                              const isCurrentLevel = level === depth - 1;
                              const className = isCurrentLevel
                                ? isLastSibling
                                  ? "category-tree-guide connector last"
                                  : "category-tree-guide connector"
                                : ancestorContinuations[level + 1]
                                  ? "category-tree-guide continues"
                                  : "category-tree-guide";

                              return <span className={className} key={level} />;
                            })}
                          </span>
                          {hasChildren ? (
                            <button
                              className={
                                isExpanded
                                  ? "category-tree-toggle has-visible-children"
                                  : "category-tree-toggle"
                              }
                              type="button"
                              aria-label={
                                collapsedCategoryIds.has(category.id)
                                  ? `Expand ${category.name}`
                                  : `Collapse ${category.name}`
                              }
                              onClick={() => toggleCategoryFolder(category.id)}
                            >
                              {collapsedCategoryIds.has(category.id) ? ">" : "v"}
                            </button>
                          ) : (
                            <span className="category-tree-toggle placeholder" aria-hidden="true">
                              .
                            </span>
                          )}
                          <span className="category-tree-main">
                            <strong>{category.name || "Unnamed Category"}</strong>
                          </span>
                        </div>
                      </td>
                      <td>{assignedProductCount}</td>
                      <td>{directChildCount}</td>
                      <td>
                        <div className="category-row-actions">
                          <button
                            className="table-action-button"
                            type="button"
                            onClick={() => openCategoryEditor(category)}
                          >
                            Edit
                          </button>
                          <button
                            className="table-action-button secondary-table-action"
                            type="button"
                            onClick={() => openSubcategoryEditor(category)}
                          >
                            Add Sub
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {draftCategory ? (
        <div className="modal-backdrop">
          <div
            className="detail-modal supplier-modal section-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="category-modal-title"
          >
            <div className="section-heading supplier-modal-header">
              <div>
                <p className="eyebrow">
                  {categories.some((category) => category.id === draftCategory.id)
                    ? "Edit Category"
                    : "New Category"}
                </p>
                <h3 id="category-modal-title">{draftCategory.name || "Category"}</h3>
              </div>
              <button
                className="icon-button subtle"
                type="button"
                aria-label="Close"
                onClick={closeCategoryEditor}
              >
                X
              </button>
            </div>

            {formError ? <div className="error-banner">{formError}</div> : null}

            <form className="form-layout" onSubmit={handleSaveCategory}>
              <div className="form-grid">
                <label className="full-width">
                  Category Name
                  <input
                    autoFocus
                    value={draftCategory.name}
                    onChange={(event) => {
                      updateDraftField("name", event.target.value);
                      setFormError("");
                    }}
                    placeholder="e.g. Stationery"
                    required
                  />
                </label>

                <label className="full-width supplier-combobox-field">
                  Parent Category
                  <div className="supplier-combobox">
                    <input
                      type="search"
                      role="combobox"
                      aria-expanded={isParentCategoryMenuOpen}
                      aria-controls="category-parent-list"
                      aria-autocomplete="list"
                      value={parentCategoryInput}
                      onChange={(event) => handleParentCategoryInputChange(event.target.value)}
                      onFocus={() => setIsParentCategoryMenuOpen(true)}
                      onBlur={() => setIsParentCategoryMenuOpen(false)}
                      onKeyDown={handleParentCategoryInputKeyDown}
                      placeholder="Root Category or type category name"
                    />

                    {isParentCategoryMenuOpen ? (
                      <div
                        className="supplier-combobox-menu"
                        id="category-parent-list"
                        role="listbox"
                      >
                        {shouldShowRootParentOption ? (
                          <button
                            className={
                              draftCategory.parentId
                                ? "supplier-combobox-option"
                                : "supplier-combobox-option active"
                            }
                            type="button"
                            role="option"
                            aria-selected={!draftCategory.parentId}
                            onMouseDown={(event) => {
                              event.preventDefault();
                              selectParentCategory(null);
                            }}
                          >
                            Root Category
                          </button>
                        ) : null}

                        {filteredParentCategoryOptions.map((category) => (
                          <button
                            className={
                              category.id === draftCategory.parentId
                                ? "supplier-combobox-option active"
                                : "supplier-combobox-option"
                            }
                            key={category.id}
                            type="button"
                            role="option"
                            aria-selected={category.id === draftCategory.parentId}
                            onMouseDown={(event) => {
                              event.preventDefault();
                              selectParentCategory(category);
                            }}
                          >
                            {category.label}
                          </button>
                        ))}

                        {!shouldShowRootParentOption &&
                        filteredParentCategoryOptions.length === 0 ? (
                          <div className="supplier-combobox-empty">
                            No matching parent category found.
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <span className="field-helper-text">
                    Clear this field to keep the category at root level.
                  </span>
                </label>

                <label className="full-width">
                  Description
                  <textarea
                    rows="3"
                    value={draftCategory.description}
                    onChange={(event) => updateDraftField("description", event.target.value)}
                    placeholder="Category notes or usage"
                  />
                </label>
              </div>

              <div className="supplier-modal-actions">
                <button className="danger-button" type="button" onClick={handleDeleteCategory}>
                  Delete Category
                </button>
                <button className="secondary-button" type="button" onClick={closeCategoryEditor}>
                  Cancel
                </button>
                <button className="primary-button" type="submit">
                  Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default CategoryPage;
