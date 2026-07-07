// Section component for purchase workflow forms or detail views.

import { formatMoney as fmt } from "../../format";
import { useLanguage } from "../../i18n/LanguageContext";
import { buildConvertedItemFields, getProductUnitOptions } from "../../unitConversion";
import { isProductActive } from "../products/productUtils";
import {
  computeAmount,
  findProductForItem,
  getProductName,
  getProductSku,
  getPurchaseProductQuery,
} from "./purchaseHistoryUtils";

function PurchaseEditLineItemsSection({
  form,
  items,
  products,
  openProductIndex,
  itemErrors,
  getFilteredProducts,
  onAddItem,
  onRemoveItem,
  onUpdateItem,
  onUpdateProductQuery,
  onSetOpenProductIndex,
  onSelectProduct,
  onAddDiscount,
  onRemoveDiscount,
  onUpdateDiscount,
}) {
  const { t } = useLanguage();

  return (
    <div className="line-items-card">
      <div className="line-items-header">
        <h4>{t("purchaseForm.itemsTitle")}</h4>
        <button className="secondary-button" type="button" onClick={onAddItem}>
          {t("purchaseForm.addItem")}
        </button>
      </div>

      {items.map((item, index) => {
        const amount = computeAmount(item, form);
        const filteredProducts = getFilteredProducts(item.product_query || "");
        const selectedProduct = findProductForItem(item, products);
        const unitOptions = selectedProduct
          ? getProductUnitOptions(selectedProduct, "purchase")
          : [];
        const conversionPreview = selectedProduct
          ? buildConvertedItemFields(selectedProduct, item.quantity, item.unit, "purchase")
          : null;

        return (
          <div className="line-item-row purchase-line-item-row" key={item.id}>
            <div className="line-item-index" aria-label={t("purchaseForm.itemAriaLabel", { index: index + 1 })}>
              {index + 1}
            </div>

            <label className="purchase-item-field purchase-item-product purchase-product-field">
              <span>{t("purchaseForm.colProduct")}</span>
              <div className="supplier-combobox">
                <input
                  value={item.product_query || ""}
                  onChange={(event) => onUpdateProductQuery(index, event.target.value)}
                  onFocus={() => onSetOpenProductIndex(index)}
                  onBlur={() => {
                    window.setTimeout(() => onSetOpenProductIndex(null), 120);
                  }}
                  placeholder={t("purchaseForm.searchProductPlaceholder")}
                  autoComplete="off"
                  aria-expanded={openProductIndex === index}
                  aria-controls={`edit-purchase-product-list-${item.id}`}
                  aria-invalid={itemErrors[index] ? "true" : "false"}
                  required
                />

                {openProductIndex === index ? (
                  <div
                    className="supplier-combobox-menu"
                    id={`edit-purchase-product-list-${item.id}`}
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
                            <span>{getPurchaseProductQuery(productName, sku)}</span>
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
                        {t("purchaseForm.noProductFound")}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
              {itemErrors[index] ? (
                <span className="field-error-text">{itemErrors[index]}</span>
              ) : null}
            </label>

            <label className="purchase-item-field purchase-item-sku">
              <span>{t("purchaseForm.colSKU")}</span>
              <input value={item.sku} readOnly placeholder={t("purchaseForm.skuPlaceholder")} />
            </label>

            <label className="purchase-item-field purchase-item-unit">
              <span>{t("purchaseForm.colUnit")}</span>
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

            <label className="purchase-item-field purchase-item-delivery">
              <span>{t("purchaseForm.colExpectedDelivery")}</span>
              <input
                type="date"
                value={item.expected_delivery_date}
                onChange={(event) =>
                  onUpdateItem(index, "expected_delivery_date", event.target.value)
                }
                min={form.transaction_date}
              />
            </label>

            <label className="purchase-item-field purchase-item-qty">
              <span>{t("purchaseForm.colQty")}</span>
              <input
                type="number"
                min="1"
                value={item.quantity}
                onChange={(event) => onUpdateItem(index, "quantity", event.target.value)}
                placeholder={t("purchaseForm.qtyPlaceholder")}
                required
              />
            </label>

            <label className="purchase-item-field purchase-item-cost">
              <span>{t("purchaseForm.colUnitCost")}</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={item.unit_cost}
                onChange={(event) => onUpdateItem(index, "unit_cost", event.target.value)}
                placeholder="0.00"
                required
              />
            </label>

            <div className="purchase-item-field purchase-item-discounts">
              <span>{t("purchaseForm.colDiscounts")}</span>
              <div className="sales-discount-cell">
                {(item.discounts || [0]).map((discount, discountIndex) => (
                  <div key={discountIndex} className="sales-discount-entry">
                    {discountIndex > 0 ? (
                      <span className="sales-discount-chain-label">
                        {t("purchaseForm.discountThen")}
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
                    {(item.discounts || [0]).length > 1 ? (
                      <button
                        className="sales-discount-remove"
                        type="button"
                        aria-label={t("purchaseForm.removeDiscount")}
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
                  {t("purchaseForm.addDiscount")}
                </button>
              </div>
            </div>

            <div className="purchase-item-field purchase-item-amount">
              <span>{t("purchaseForm.colAmount")}</span>
              <div className="sales-line-amount">{fmt(amount)}</div>
            </div>

            <button
              className="danger-button purchase-item-remove"
              type="button"
              onClick={() => onRemoveItem(index)}
              disabled={items.length === 1}
            >
              {t("purchaseForm.removeItem")}
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default PurchaseEditLineItemsSection;
