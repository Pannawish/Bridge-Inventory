import PaginationControls from "../PaginationControls";
import { FilterPresets, ActiveFilterChips } from "../FilterControls";
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

  return (
    <>
      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("products.eyebrow")}</p>
            <h3>{t("products.findTitle")}</h3>
          </div>
        </div>

        <div className="supplier-directory-toolbar">
          <label className="stock-search supplier-search">
            <span className="stock-search-icon">S</span>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => onSearchTermChange(event.target.value)}
              placeholder={t("products.searchPlaceholder")}
            />
          </label>
          <div className="stock-report-summary supplier-search-meta">
            <span>
              {isServerPaginated
                ? t("products.pageCountServer", {
                    count: filteredCount,
                    total: totalProductCount,
                  })
                : t("products.pageCountLocal", {
                    count: filteredCount,
                    total: localProductCount,
                  })}
            </span>
          </div>
        </div>

        <div className="history-filter-actions">
          <button
            className="secondary-button product-filter-toggle"
            type="button"
            aria-expanded={showProductFilters}
            onClick={onToggleFilters}
          >
            {t("filterControls.filter")}
            {activeFilterCount ? <span>{activeFilterCount}</span> : null}
          </button>
          <button className="secondary-button" type="button" onClick={onResetFilters}>
            {t("filterControls.resetFilter")}
          </button>
        </div>

        <FilterPresets presets={quickPresets} />
        <ActiveFilterChips chips={activeChips} onClearAll={onResetFilters} />

        {showProductFilters ? (
          <div className="history-filter-panel">
            <div className="history-filter-grid">
              <label className="history-filter-field">
                <span className="history-filter-title">{t("products.categoryFilter")}</span>
                <select
                  value={categoryFilter}
                  onChange={(event) => onCategoryFilterChange(event.target.value)}
                >
                  <option value="all">{t("products.allCategories")}</option>
                  {categoryOptions.map((categoryLabel) => (
                    <option key={categoryLabel} value={categoryLabel}>
                      {categoryLabel}
                    </option>
                  ))}
                </select>
              </label>

              <label className="history-filter-field">
                <span className="history-filter-title">{t("products.inventoryFilter")}</span>
                <select
                  value={stockFilter}
                  onChange={(event) => onStockFilterChange(event.target.value)}
                >
                  <option value="all">{t("products.allStock")}</option>
                  <option value="in-stock">{t("products.inStock")}</option>
                  <option value="low-stock">{t("products.lowStock")}</option>
                  <option value="out-of-stock">{t("products.outOfStock")}</option>
                  <option value="selling">{t("products.hasSales")}</option>
                  <option value="no-sales">{t("products.noSalesYet")}</option>
                  <option value="no-purchases">{t("products.noReceivedPurchases")}</option>
                </select>
              </label>
            </div>
          </div>
        ) : null}
      </section>

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
