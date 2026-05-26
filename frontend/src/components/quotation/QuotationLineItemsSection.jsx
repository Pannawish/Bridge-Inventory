import EligiblePartyCombobox from "../EligiblePartyCombobox";
import { getProductDefaultSalesUnit, getProductUnitConversions } from "../../unitConversion";
import { formatMoney as fmt } from "../../format";
import { useLanguage } from "../../i18n/LanguageContext";
import {
  getAverageCostForSelectedUnit,
  getAverageRecentSalePriceForSelectedUnit,
} from "../productPriceMetrics";
import { isProductActive } from "../products/productUtils";
import {
  computeAmount,
  findProductForItem,
  normalizeDiscounts,
} from "./quotationUtils";

function QuotationLineItemsSection({
  items,
  products,
  supplierOptions,
  openProductIndex,
  itemErrors,
  getFilteredProducts,
  getTranslatedProductName,
  onAddItem,
  onRemoveItem,
  onUpdateItem,
  onUpdateProductQuery,
  onSetOpenProductIndex,
  onSelectProduct,
  onAddSupplierOption,
  onRemoveSupplierOption,
  onUpdateSupplierOption,
  onAddDiscount,
  onRemoveDiscount,
  onUpdateDiscount,
  getProductSku,
}) {
  const { t } = useLanguage();

  return (
    <div className="line-items-card">
      <div className="line-items-header">
        <h4>{t("quotation.itemsTitle")}</h4>
        <button className="secondary-button" type="button" onClick={onAddItem}>
          {t("quotation.addItem")}
        </button>
      </div>

      {items.map((item, index) => {
        const selectedProduct = findProductForItem(item, products);
        const filteredProducts = getFilteredProducts(item.product_query);
        const unitOptions = selectedProduct ? getProductUnitConversions(selectedProduct) : [];
        const saleAmount = computeAmount(item, "sale_price");
        const averageCostForSelectedUnit = getAverageCostForSelectedUnit(
          selectedProduct,
          item.unit
        );
        const recentAverageSalePriceForSelectedUnit =
          getAverageRecentSalePriceForSelectedUnit(selectedProduct, item.unit);

        return (
          <div className="line-item-row quotation-line-item-row" key={item.line_id}>
            <div
              className="line-item-index"
              aria-label={t("quotation.itemAriaLabel", { index: index + 1 })}
            >
              {index + 1}
            </div>

            <label className="purchase-item-field quotation-item-product">
              <span className="required-label">{t("quotation.colProduct")}</span>
              <div className="supplier-combobox">
                <input
                  value={item.product_query}
                  onChange={(event) => onUpdateProductQuery(index, event.target.value)}
                  onFocus={() => onSetOpenProductIndex(index)}
                  onBlur={() => {
                    window.setTimeout(() => onSetOpenProductIndex(null), 120);
                  }}
                  placeholder={t("quotation.searchProductPlaceholder")}
                  autoComplete="off"
                  aria-expanded={openProductIndex === index}
                  aria-controls={`quotation-product-list-${item.line_id}`}
                  aria-invalid={itemErrors[index] ? "true" : "false"}
                  required
                />

                {openProductIndex === index ? (
                  <div
                    className="supplier-combobox-menu"
                    id={`quotation-product-list-${item.line_id}`}
                    role="listbox"
                  >
                    {filteredProducts.length ? (
                      filteredProducts.map((product) => {
                        const productName = getTranslatedProductName(product);
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
                        {t("quotation.noProductFound")}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
              {itemErrors[index] ? (
                <span className="field-error-text">{itemErrors[index]}</span>
              ) : null}
            </label>

            <label className="purchase-item-field quotation-item-unit">
              <span className="required-label">{t("quotation.colUnit")}</span>
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
            </label>

            <label className="purchase-item-field quotation-item-qty">
              <span className="required-label">{t("quotation.colQty")}</span>
              <input
                type="number"
                min="1"
                value={item.quantity}
                onChange={(event) => onUpdateItem(index, "quantity", event.target.value)}
                required
              />
            </label>

            <label className="purchase-item-field quotation-item-sale">
              <span className="required-label">{t("quotation.colSalePrice")}</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={item.sale_price}
                onChange={(event) => onUpdateItem(index, "sale_price", event.target.value)}
                placeholder="0.00"
                required
              />
              {averageCostForSelectedUnit ? (
                <span className="field-helper-text">
                  {t("common.avgCostForUnit", {
                    amount: fmt(averageCostForSelectedUnit),
                    unit: item.unit || getProductDefaultSalesUnit(selectedProduct),
                  })}
                </span>
              ) : null}
              {recentAverageSalePriceForSelectedUnit ? (
                <span className="field-helper-text">
                  {t("common.avgRecentSalePriceForUnit", {
                    amount: fmt(recentAverageSalePriceForSelectedUnit),
                    unit: item.unit || getProductDefaultSalesUnit(selectedProduct),
                  })}
                </span>
              ) : null}
            </label>

            <div className="purchase-item-field quotation-item-discounts">
              <span>{t("quotation.colDiscounts")}</span>
              <div className="sales-discount-cell">
                {normalizeDiscounts(item).map((discount, discountIndex) => (
                  <div key={discountIndex} className="sales-discount-entry">
                    {discountIndex > 0 ? (
                      <span className="sales-discount-chain-label">
                        {t("quotation.discountThen")}
                      </span>
                    ) : null}
                    <input
                      className="sales-discount-input"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={discount}
                      onChange={(event) =>
                        onUpdateDiscount(index, discountIndex, event.target.value)
                      }
                      placeholder="0"
                    />
                    <span className="sales-discount-pct">%</span>
                    {normalizeDiscounts(item).length > 1 ? (
                      <button
                        className="sales-discount-remove"
                        type="button"
                        aria-label={t("quotation.removeDiscount")}
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
                  {t("quotation.addDiscount")}
                </button>
              </div>
            </div>

            <div className="purchase-item-field quotation-item-amount">
              <span>{t("quotation.colSaleAmount")}</span>
              <div className="sales-line-amount">{fmt(saleAmount)}</div>
            </div>

            <button
              className="danger-button quotation-item-remove"
              type="button"
              onClick={() => onRemoveItem(index)}
              disabled={items.length === 1}
            >
              {t("quotation.removeItem")}
            </button>

            <div className="purchase-item-field quotation-item-suppliers">
              <span>{t("quotation.suppliersLabel")}</span>
              <div className="quotation-supplier-list">
                {(item.supplier_options || []).map((option, optionIndex) => (
                  <div className="quotation-supplier-row" key={option.option_id}>
                    <EligiblePartyCombobox
                      id={`quotation-item-${item.line_id}-supplier-${option.option_id}`}
                      label={t("quotation.supplierLabel")}
                      value={option.supplier_name}
                      options={supplierOptions}
                      placeholder={t("quotation.searchSupplierPlaceholder")}
                      emptyMessage={t("quotation.noSupplierFound")}
                      onChange={(nextSupplierName) =>
                        onUpdateSupplierOption(index, optionIndex, "supplier_name", nextSupplierName)
                      }
                    />
                    <label className="quotation-supplier-cost">
                      <span>{t("quotation.colCostPrice")}</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={option.cost_price}
                        onChange={(event) =>
                          onUpdateSupplierOption(index, optionIndex, "cost_price", event.target.value)
                        }
                        placeholder="0.00"
                      />
                    </label>
                    <button
                      className="danger-button quotation-supplier-remove"
                      type="button"
                      onClick={() => onRemoveSupplierOption(index, optionIndex)}
                    >
                      {t("quotation.removeSupplierOption")}
                    </button>
                  </div>
                ))}
                <button
                  className="secondary-button quotation-supplier-add"
                  type="button"
                  onClick={() => onAddSupplierOption(index)}
                >
                  {t("quotation.addSupplierOption")}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default QuotationLineItemsSection;
