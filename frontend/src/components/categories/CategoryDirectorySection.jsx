// Section component for category management forms or detail views.

import { useLanguage } from "../../i18n/LanguageContext";

function CategoryDirectorySection({
  collapsibleCategoryIds,
  isTreeCollapsed,
  categoryRows,
  childCategoryCounts,
  productAssignments,
  collapsedCategoryIds,
  onToggleFullCategoryTree,
  onOpenCategoryEditor,
  onOpenSubcategoryEditor,
  onToggleCategoryFolder,
}) {
  const { t } = useLanguage();

  return (
    <section className="section-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("category.directoryEyebrow")}</p>
          <h3>{t("category.directoryTitle")}</h3>
        </div>
        <div className="transaction-table-actions">
          {collapsibleCategoryIds.length ? (
            <button
              className="secondary-button"
              type="button"
              onClick={onToggleFullCategoryTree}
            >
              {isTreeCollapsed ? t("category.expandTree") : t("category.collapseTree")}
            </button>
          ) : null}
          <button className="primary-button" type="button" onClick={onOpenCategoryEditor}>
            {t("category.newCategory")}
          </button>
        </div>
      </div>

      <div className="transaction-table-window partner-table-window category-tree-window">
        <div className="table-scroll category-tree-table">
          {categoryRows.length === 0 ? (
            <p className="empty-copy">{t("category.noMatch")}</p>
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
                  <th>{t("category.colCategory")}</th>
                  <th>{t("category.colProducts")}</th>
                  <th>{t("category.colSubcategories")}</th>
                  <th>{t("category.colAction")}</th>
                </tr>
              </thead>
              <tbody>
                {categoryRows.map(
                  ({ category, depth, hasChildren, isLastSibling, ancestorContinuations }) => {
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
                                    ? t("category.expandCategory", { name: category.name })
                                    : t("category.collapseCategory", { name: category.name })
                                }
                                onClick={() => onToggleCategoryFolder(category.id)}
                              >
                                {collapsedCategoryIds.has(category.id) ? ">" : "v"}
                              </button>
                            ) : (
                              <span className="category-tree-toggle placeholder" aria-hidden="true">
                                .
                              </span>
                            )}
                            <span className="category-tree-main">
                              <strong>{category.name || t("category.unnamedCategory")}</strong>
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
                              onClick={() => onOpenCategoryEditor(category)}
                            >
                              {t("common.edit")}
                            </button>
                            <button
                              className="table-action-button secondary-table-action"
                              type="button"
                              onClick={() => onOpenSubcategoryEditor(category)}
                            >
                              {t("category.addSubcategory")}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}

export default CategoryDirectorySection;
