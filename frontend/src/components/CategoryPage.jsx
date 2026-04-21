import { useEffect, useMemo, useState } from "react";

export const CATEGORY_STORAGE_KEY = "inventory-management-categories";

const defaultCategories = [
  { id: "category-1", name: "Stationery", description: "Paper, notebooks, and general office supplies." },
  { id: "category-2", name: "Writing Tools", description: "Pens, markers, pencils, and related writing items." },
  { id: "category-3", name: "Desk Accessories", description: "Staplers, clips, folders, and desktop tools." },
  { id: "category-4", name: "Paper Goods", description: "Sticky notes, file paper, and paper-based products." },
];

function createCategory(overrides = {}) {
  return {
    id: `category-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: "",
    description: "",
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
  };
}

export function normalizeCategoryName(name) {
  return getCategoryKey(name);
}

export function getDefaultCategories() {
  return defaultCategories;
}

export function loadCategories() {
  if (typeof window === "undefined") {
    return defaultCategories;
  }

  try {
    const raw = window.localStorage.getItem(CATEGORY_STORAGE_KEY);

    if (!raw) {
      return defaultCategories;
    }

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed) || parsed.length === 0) {
      return defaultCategories;
    }

    const seen = new Set();

    return parsed
      .map(normalizeCategory)
      .filter((category) => {
        const key = getCategoryKey(category.name);

        if (!key || seen.has(key)) {
          return false;
        }

        seen.add(key);
        return true;
      });
  } catch {
    return defaultCategories;
  }
}

function CategoryPage() {
  const [categories, setCategories] = useState(() => loadCategories());
  const [draftCategory, setDraftCategory] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    window.localStorage.setItem(
      CATEGORY_STORAGE_KEY,
      JSON.stringify(categories.map(normalizeCategory))
    );
    window.dispatchEvent(new Event("inventory-categories-updated"));
  }, [categories]);

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
  const filteredCategories = useMemo(
    () =>
      categories.filter((category) => {
        if (!normalizedSearch) {
          return true;
        }

        return (
          category.name.toLowerCase().includes(normalizedSearch) ||
          category.description.toLowerCase().includes(normalizedSearch)
        );
      }),
    [categories, normalizedSearch]
  );

  function openCategoryEditor(category = createCategory()) {
    setDraftCategory(category);
    setFormError("");
  }

  function closeCategoryEditor() {
    setDraftCategory(null);
    setFormError("");
  }

  function updateDraftField(key, value) {
    setDraftCategory((currentCategory) =>
      currentCategory ? { ...currentCategory, [key]: value } : currentCategory
    );
  }

  function handleSaveCategory(event) {
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

    const duplicate = categories.some(
      (category) =>
        category.id !== nextCategory.id &&
        getCategoryKey(category.name) === nextKey
    );

    if (duplicate) {
      setFormError("This category already exists.");
      return;
    }

    const exists = categories.some((category) => category.id === nextCategory.id);

    setCategories((currentCategories) =>
      exists
        ? currentCategories.map((category) =>
            category.id === nextCategory.id ? nextCategory : category
          )
        : [nextCategory, ...currentCategories]
    );
    closeCategoryEditor();
  }

  function handleDeleteCategory() {
    if (!draftCategory) {
      return;
    }

    const exists = categories.some((category) => category.id === draftCategory.id);

    if (!exists) {
      closeCategoryEditor();
      return;
    }

    const confirmed = window.confirm(
      `Delete category ${draftCategory.name || "this category"}?`
    );

    if (!confirmed) {
      return;
    }

    setCategories((currentCategories) =>
      currentCategories.filter((category) => category.id !== draftCategory.id)
    );
    closeCategoryEditor();
  }

  return (
    <div className="stack-layout">
      <section className="section-card supplier-directory-card">
        <div className="section-heading supplier-directory-heading">
          <div>
            <p className="eyebrow">Category</p>
            <h3>Category Directory</h3>
          </div>
          <button className="primary-button" type="button" onClick={() => openCategoryEditor()}>
            New Category
          </button>
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
            <span>{filteredCategories.length} categories shown</span>
          </div>
        </div>

        <div className="supplier-list">
          {filteredCategories.length === 0 ? (
            <p className="empty-copy">No categories match the current search.</p>
          ) : (
            filteredCategories.map((category) => (
              <button
                key={category.id}
                type="button"
                className="supplier-list-item product-list-card"
                onClick={() => openCategoryEditor(category)}
              >
                <strong className="product-card-name">{category.name}</strong>
                <span>{category.description || "No description."}</span>
              </button>
            ))
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
