// Section component for product management forms or detail views.

import PaginationControls from "../PaginationControls";
import UniversalFilter from "../filters/UniversalFilter";
import { getCategoryLeafLabel } from "../CategoryPage";
import {
  getProductDefaultPurchaseUnit,
  getProductDefaultSalesUnit,
} from "../../unitConversion";
import { useLanguage } from "../../i18n/LanguageContext";
import {
  formatCurrency,
  formatStockQuantity,
  isProductActive,
} from "./productUtils";
import { getTranslatedProductDisplayName } from "./productEditorHelpers";

function ProductDirectorySection({
  searchTerm,
  onSearchTermChange,
  isServerPaginated,
  filteredCount,
  totalProductCount,
  localProductCount,
  showProductFilters,
  activeFilterCount,
  onToggleFilters,
  onResetFilters,
  quickPresets,
  activeChips,
  categoryFilter,
  onCategoryFilterChange,
  categoryOptions,
  stockFilter,
  onStockFilterChange,
  filteredProductsWithMetrics,
  onCreateProduct,
  shouldShowViewAll,
  showAllRows,
  onToggleShowAllRows,
  isCompact,
  pagination,
  onPageChange,
  onOpenProductDetail,
}) {
  const { t } = useLanguage();

  const stockOptions = [
    { value: "in-stock", label: t("products.inStock") },
    { value: "low-stock", label: t("products.lowStock") },
    { value: "out-of-stock", label: t("products.outOfStock") },
    { value: "selling", label: t("products.hasSales") },
    { value: "no-sales", label: t("products.noSalesYet") },
    { value: "no-purchases", label: t("products.noReceivedPurchases") },
  ];

  // WHAT (category) → status (stock health), both always visible.
  const filterFields = [
    {
      id: "category",
      type: "select",
      section: "primary",
      label: t("products.categoryFilter"),
      value: categoryFilter,
      onChange: onCategoryFilterChange,
      allValue: "all",
      allLabel: t("products.allCategories"),
      options: categoryOptions.map((categoryLabel) => ({
        value: categoryLabel,
        label: categoryLabel,
      })),
    },
    {
      id: "stock",
      type: "select",
      section: "primary",
      label: t("products.inventoryFilter"),
      value: stockFilter,
      onChange: onStockFilterChange,
      allValue: "all",
      allLabel: t("products.allStock"),
      options: stockOptions,
    },
  ];

  return (
    <>
      <UniversalFilter
        search={{
          value: searchTerm,
          onChange: onSearchTermChange,
          placeholder: t("products.searchPlaceholder"),
        }}
        meta={t(
          isServerPaginated ? "products.pageCountServer" : "products.pageCountLocal",
          {
            count: filteredCount,
            total: isServerPaginated ? totalProductCount : localProductCount,
          }
        )}
        fields={filterFields}
        quickFilters={quickPresets}
        activeChips={activeChips}
        onReset={onResetFilters}
        labels={{
          more: t("filterControls.moreFilters"),
          reset: t("filterControls.resetFilter"),
          quick: t("filterControls.quickFilters"),
          clearAll: t("filterControls.clearAll"),
        }}
      />

      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("products.historyEyebrow")}</p>
            <h3>{t("products.historyTitle")}</h3>
          </div>
          <div className="transaction-table-actions">
            <button className="primary-button" type="button" onClick={onCreateProduct}>
              {t("products.newProduct")}
            </button>
            {shouldShowViewAll ? (
              <button
                className="secondary-button"
                type="button"
                onClick={onToggleShowAllRows}
              >
                {showAllRows ? t("common.showRecent") : t("common.viewMore")}
              </button>
            ) : null}
          </div>
        </div>

        {filteredProductsWithMetrics.length === 0 ? (
          <p className="empty-copy">{t("products.noMatch")}</p>
        ) : (
          <div
            className={
              isCompact
                ? "transaction-table-window product-table-window compact-history"
                : "transaction-table-window product-table-window"
            }
          >
            <div className="table-scroll desktop-table">
              <table className="transaction-history-table">
                <thead>
                  <tr>
                    <th className="product-col-index">{t("products.colIndex")}</th>
                    <th className="product-col-name">{t("products.colProduct")}</th>
                    <th className="product-col-category">{t("products.colCategory")}</th>
                    <th className="product-col-stock">{t("products.colStock")}</th>
                    <th className="product-col-cost">{t("products.colAvgCost")}</th>
                    <th className="product-col-action">{t("products.colAction")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProductsWithMetrics.map(({ product, metrics, categoryLabel }, index) => (
                    <tr
                      key={product.id}
                      className={!isProductActive(product) ? "product-row-disabled" : undefined}
                    >
                      <td>{index + 1}</td>
                      <td>
                        <div className="transaction-reference-cell">
                          <strong>{getTranslatedProductDisplayName(product, t)}</strong>
                          <span>
                            {product.sku
                              ? t("products.skuDisplay", { sku: product.sku })
                              : t("products.skuNotSet")}
                            {!isProductActive(product) ? ` · ${t("products.disabledBadge")}` : ""}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="cell-stack">
                          <strong>
                            {getCategoryLeafLabel(categoryLabel) || t("products.unassigned")}
                          </strong>
                          <span>{product.detail || t("products.noDetail")}</span>
                        </div>
                      </td>
                      <td>
                        <div className="cell-stack">
                          <strong>{formatStockQuantity(metrics.totalUnits, product)}</strong>
                          <span>
                            {t("products.buyAndSell", {
                              purchaseUnit: getProductDefaultPurchaseUnit(product),
                              salesUnit: getProductDefaultSalesUnit(product),
                            })}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="cell-stack">
                          <strong>{formatCurrency(metrics.avgPrice)}</strong>
                        </div>
                      </td>
                      <td>
                        <button
                          className="table-action-button"
                          type="button"
                          onClick={() => onOpenProductDetail(product)}
                        >
                          {t("products.viewButton")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mobile-record-list">
              {filteredProductsWithMetrics.map(({ product, metrics, categoryLabel }, index) => (
                <article
                  className={
                    isProductActive(product)
                      ? "mobile-record-card"
                      : "mobile-record-card product-row-disabled"
                  }
                  key={`mobile-product-${product.id}`}
                >
                  <div className="mobile-record-header">
                    <div className="mobile-record-title">
                      <span className="mobile-record-index">{index + 1}</span>
                      <div className="cell-stack">
                        <strong>{getTranslatedProductDisplayName(product, t)}</strong>
                        <span>
                          {product.sku
                            ? t("products.skuDisplay", { sku: product.sku })
                            : t("products.skuNotSet")}
                          {!isProductActive(product) ? ` · ${t("products.disabledBadge")}` : ""}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mobile-record-grid">
                    <div>
                      <span>{t("products.colCategory")}</span>
                      <strong>
                        {getCategoryLeafLabel(categoryLabel) || t("products.unassigned")}
                      </strong>
                    </div>
                    <div>
                      <span>{t("products.colStock")}</span>
                      <strong>{formatStockQuantity(metrics.totalUnits, product)}</strong>
                    </div>
                    <div>
                      <span>{t("products.colAvgCost")}</span>
                      <strong>{formatCurrency(metrics.avgPrice)}</strong>
                    </div>
                  </div>

                  <button
                    className="secondary-button table-action-button mobile-record-button"
                    type="button"
                    onClick={() => onOpenProductDetail(product)}
                  >
                    {t("products.viewButton")}
                  </button>
                </article>
              ))}
            </div>
          </div>
        )}

        <PaginationControls
          pagination={pagination}
          itemLabel={t("products.paginationLabel")}
          onPageChange={onPageChange}
        />
      </section>
    </>
  );
}

export default ProductDirectorySection;
