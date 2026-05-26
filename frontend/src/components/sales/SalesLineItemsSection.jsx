import { formatMoney as fmt } from "../../format";
import { useLanguage } from "../../i18n/LanguageContext";
import {
  buildConvertedItemFields,
  getProductUnitOptions,
  getProductBaseUnit,
} from "../../unitConversion";
import { isProductActive } from "../products/productUtils";
import {
  getAverageCostForSelectedUnit,
  getAverageRecentSalePriceForSelectedUnit,
} from "../productPriceMetrics";
import {
  computeAmount,
  getFilteredProducts,
  getLineLoss,
  getProductName,
  getProductSku,
  getProductUnit,
} from "./salesFormUtils";
import { getComputedAllocationSnapshot } from "./salesAllocationUtils";
import SalesItemAllocationSection from "./SalesItemAllocationSection";

function SalesLineItemsSection({
  items,
  products,
  stockLayersByProductId = {},
  activeAllItemsDiscount,
  openProductIndex,
  itemErrors,
  draggedItemIndex,
  onAddItem,
  onRemoveItem,
  onUpdateItem,
  onUpdateProductQuery,
  onSetOpenProductIndex,
  onSelectProduct,
  onUpdateAllocationMode,
  onAddAllocation,
  onRemoveAllocation,
  onUpdateAllocation,
  onAddDiscount,
  onRemoveDiscount,
  onUpdateDiscount,
  onItemDragStart,
  onItemDragOver,
  onItemDrop,
  onItemDragEnd,
}) {
  const { t } = useLanguage();
  return (
    <div className="line-items-card">
      <div className="line-items-header">
        <h4>{t("salesForm.itemsTitle")}</h4>
        <button className="secondary-button" type="button" onClick={onAddItem}>
          {t("salesForm.addItem")}
        </button>
      </div>

      {items.map((item, index) => {
        const amount = computeAmount(item, activeAllItemsDiscount);
        const filteredProducts = getFilteredProducts(products, item.product_query);
        const selectedProduct = products.find(
          (product) => `${product.id}` === `${item.product_id}`
        );
        const averageCostForSelectedUnit = getAverageCostForSelectedUnit(
          selectedProduct,
          item.unit
        );
        const recentAverageSalePriceForSelectedUnit =
          getAverageRecentSalePriceForSelectedUnit(selectedProduct, item.unit);
        const unitOptions = selectedProduct
          ? getProductUnitOptions(selectedProduct, "sale")
          : [];
        const conversionPreview = selectedProduct
          ? buildConvertedItemFields(selectedProduct, item.quantity, item.unit, "sale")
          : null;
        const stockLayers = item.product_id
          ? stockLayersByProductId[`${item.product_id}:new`] || []
          : [];
        const computedSnapshot = getComputedAllocationSnapshot(
          item,
          stockLayers,
          Number(conversionPreview?.conversion_factor) || 1
        );
        const effectiveUnitCost = computedSnapshot.unit_cost || item.unit_cost;
        const lineLoss = getLineLoss(
          { ...item, unit_cost: effectiveUnitCost },
          activeAllItemsDiscount
        );

        return (
          <div
            className={
              draggedItemIndex !== null && draggedItemIndex !== index
                ? "line-item-row sales-line-item-row is-drop-target"
                : "line-item-row sales-line-item-row"
            }
            key={item.line_id}
            onDragOverCapture={onItemDragOver}
            onDropCapture={(event) => onItemDrop(event, index)}
          >
            <div
              className={
                draggedItemIndex === index
                  ? "line-item-index is-dragging"
                  : "line-item-index"
              }
              draggable={items.length > 1}
              title={items.length > 1 ? t("salesForm.dragToReorder") : t("salesForm.itemOrder")}
              aria-label={t("salesForm.itemAriaLabel", { index: index + 1 })}
              onDragStart={(event) => onItemDragStart(event, index)}
              onDragEnd={onItemDragEnd}
            >
              {index + 1}
            </div>

            <label className="purchase-item-field sales-item-product">
              <span className="required-label">{t("salesForm.colProduct")}</span>
              <div className="supplier-combobox">
                <input
                  value={item.product_query}
                  onChange={(event) => onUpdateProductQuery(index, event.target.value)}
                  onFocus={() => onSetOpenProductIndex(index)}
                  onBlur={() => {
                    window.setTimeout(() => onSetOpenProductIndex(null), 120);
                  }}
                  placeholder={t("salesForm.searchProductPlaceholder")}
                  autoComplete="off"
                  aria-expanded={openProductIndex === index}
                  aria-controls={`sales-product-list-${item.line_id}`}
                  aria-invalid={itemErrors[index] ? "true" : "false"}
                  required
                />

                {openProductIndex === index ? (
                  <div
                    className="supplier-combobox-menu"
                    id={`sales-product-list-${item.line_id}`}
                    role="listbox"
                  >
                    {filteredProducts.length ? (
                      filteredProducts.map((product) => {
                        const productName = getProductName(product);
                        const sku = getProductSku(product);
                        const disabled = !isProductActive(product);

                        return (
                          <button
                            key={product.id}
                            type="button"
                            className={`supplier-combobox-option${
                              `${product.id}` === `${item.product_id}` ? " active" : ""
                            }${disabled ? " supplier-combobox-option-disabled" : ""}`}
                            onMouseDown={(event) => {
                              event.preventDefault();
                              onSelectProduct(index, product);
                            }}
                            role="option"
                            aria-selected={`${product.id}` === `${item.product_id}`}
                            aria-disabled={disabled}
                            title={disabled ? t("products.disabledOptionHint") : undefined}
                          >
                            <span>{sku ? `${productName} (${sku})` : productName}</span>
                            {disabled ? (
                              <span className="combobox-option-tag">
                                {t("products.disabledBadge")}
                              </span>
                            ) : null}
                          </button>
                        );
                      })
                    ) : (
                      <div className="supplier-combobox-empty">
                        {t("salesForm.noProductFound")}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
              {itemErrors[index] ? (
                <span className="field-error-text">{itemErrors[index]}</span>
              ) : selectedProduct ? (
                (() => {
                  const currentStock = Number(
                    selectedProduct.current_stock ??
                    selectedProduct.currentStock ??
                    selectedProduct.available_stock ??
                    0
                  ) || 0;
                  const baseUnit = getProductBaseUnit(selectedProduct) || "pcs";
                  
                  if (currentStock <= 0) {
                    return (
                      <span className="product-stock-preview out-of-stock">
                        {t("salesForm.productOutOfStock")}
                      </span>
                    );
                  }
                  
                  return (
                    <span className="product-stock-preview in-stock">
                      {t("salesForm.productTotalStock", {
                        stock: currentStock,
                        unit: baseUnit,
                      })}
                    </span>
                  );
                })()
              ) : null}
            </label>

            <label className="purchase-item-field sales-item-unit">
              <span className="required-label">{t("salesForm.colUnit")}</span>
              <select
                value={item.unit}
                onChange={(event) => onUpdateItem(index, "unit", event.target.value)}
                disabled={!selectedProduct}
              >
                {unitOptions.length ? (
                  unitOptions.map((conversion) => (
                    <option key={conversion.unit} value={conversion.unit}>
                      {conversion.unit}
                    </option>
                  ))
                ) : (
                  <option value={item.unit || "pcs"}>{item.unit || "pcs"}</option>
                )}
              </select>
              {conversionPreview ? (
                <span className="unit-conversion-preview">
                  {conversionPreview.base_quantity} {conversionPreview.base_unit}
                </span>
              ) : null}
            </label>

            <label className="purchase-item-field sales-item-qty">
              <span className="required-label">{t("salesForm.colQty")}</span>
              <input
                type="number"
                min="1"
                value={item.quantity}
                onChange={(event) => onUpdateItem(index, "quantity", event.target.value)}
                placeholder={t("salesForm.qtyPlaceholder")}
                required
              />
            </label>

            <label className="purchase-item-field sales-item-price">
              <span className="required-label">{t("salesForm.colUnitPrice")}</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={item.unit_price}
                onChange={(event) => onUpdateItem(index, "unit_price", event.target.value)}
                placeholder="0.00"
                required
              />
              {averageCostForSelectedUnit ? (
                <span className="field-helper-text">
                  {t("common.avgCostForUnit", {
                    amount: fmt(averageCostForSelectedUnit),
                    unit: item.unit || getProductUnit(selectedProduct),
                  })}
                </span>
              ) : null}
              {recentAverageSalePriceForSelectedUnit ? (
                <span className="field-helper-text">
                  {t("common.avgRecentSalePriceForUnit", {
                    amount: fmt(recentAverageSalePriceForSelectedUnit),
                    unit: item.unit || getProductUnit(selectedProduct),
                  })}
                </span>
              ) : null}
            </label>

            <div className="purchase-item-field sales-item-discounts">
              <span>{t("salesForm.colDiscounts")}</span>
              <div className="sales-discount-cell">
                {item.discounts.map((discountValue, discountIndex) => (
                  <div key={discountIndex} className="sales-discount-entry">
                    {discountIndex > 0 ? (
                      <span className="sales-discount-chain-label">
                        {t("salesForm.discountThen")}
                      </span>
                    ) : null}
                    <input
                      className="sales-discount-input"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={discountValue}
                      onChange={(event) =>
                        onUpdateDiscount(index, discountIndex, event.target.value)
                      }
                      placeholder="0"
                    />
                    <span className="sales-discount-pct">%</span>
                    {item.discounts.length > 1 ? (
                      <button
                        className="sales-discount-remove"
                        type="button"
                        aria-label={t("salesForm.removeDiscount")}
                        onClick={() => onRemoveDiscount(index, discountIndex)}
                      >
                        X
                      </button>
                    ) : null}
                  </div>
                ))}
                <button
                  className="sales-discount-add"
                  type="button"
                  onClick={() => onAddDiscount(index)}
                >
                  {t("salesForm.addDiscount")}
                </button>
              </div>
            </div>

            <div className="purchase-item-field sales-item-amount">
              <span>{t("salesForm.colAmount")}</span>
              <div className="sales-line-amount">{fmt(amount)}</div>
            </div>

            <div className="purchase-item-field sales-item-supplier">
              <SalesItemAllocationSection
                item={item}
                stockLayers={stockLayers}
                conversionFactor={Number(conversionPreview?.conversion_factor) || 1}
                unit={item.unit || getProductUnit(selectedProduct)}
                onChangeMode={(mode) => onUpdateAllocationMode(index, mode)}
                onAddAllocation={() => onAddAllocation(index)}
                onRemoveAllocation={(rowId) => onRemoveAllocation(index, rowId)}
                onUpdateAllocation={(rowId, key, value) =>
                  onUpdateAllocation(index, rowId, key, value)
                }
              />
            </div>

            <label className="purchase-item-field sales-item-cost">
              <span>{t("salesForm.colUnitCost")}</span>
              <input
                type="number"
                min="0"
                step="0.01"
                className={lineLoss > 0 ? "sales-cost-input below-cost" : undefined}
                value={effectiveUnitCost}
                onChange={(event) => onUpdateItem(index, "unit_cost", event.target.value)}
                placeholder={t("common.optional")}
                readOnly={item.allocation_mode === "manual" || item.allocation_mode === "auto"}
              />
              {lineLoss > 0 ? (
                <span className="sales-below-cost-warning">
                  {`⚠ ${t("salesForm.belowCostBy")} ${fmt(lineLoss)}`}
                </span>
              ) : null}
            </label>

            <button
              className="danger-button sales-item-remove"
              type="button"
              onClick={() => onRemoveItem(index)}
              disabled={items.length === 1}
            >
              {t("salesForm.removeItem")}
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default SalesLineItemsSection;
