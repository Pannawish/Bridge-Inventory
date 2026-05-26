import { formatMoney as fmt } from "../../format";
import { useLanguage } from "../../i18n/LanguageContext";
import {
  buildConvertedItemFields,
  getProductUnitOptions,
} from "../../unitConversion";
import { computeAmount } from "./salesHistoryUtils";

function SalesEditLineItemsSection({
  sale,
  items,
  products,
  productOptions,
  onAddItem,
  onRemoveItem,
  onUpdateItem,
  onUpdateItemProduct,
  onAddDiscount,
  onRemoveDiscount,
  onUpdateDiscount,
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
        const amount = computeAmount(item, sale);
        const selectedProduct = products.find(
          (product) => `${product.id}` === `${item.product_id}`
        );
        const unitOptions = selectedProduct
          ? getProductUnitOptions(selectedProduct, "sale")
          : [];
        const conversionPreview = selectedProduct
          ? buildConvertedItemFields(selectedProduct, item.quantity, item.unit, "sale")
          : null;

        return (
          <div className="line-item-row sales-line-item-row" key={item.id}>
            <div className="line-item-index" aria-label={t("purchaseForm.itemAriaLabel", { index: index + 1 })}>
              {index + 1}
            </div>

            <label className="purchase-item-field sales-item-product">
              <span>{t("salesForm.colProduct")}</span>
              <select
                value={item.product_value}
                onChange={(event) => onUpdateItemProduct(index, event.target.value)}
                required
              >
                <option value="">{t("salesForm.selectProduct")}</option>
                {productOptions.map((product) => (
                  <option key={product.value} value={product.value}>
                    {product.sku ? `${product.name} (${product.sku})` : product.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="purchase-item-field sales-item-unit">
              <span>{t("salesForm.colUnit")}</span>
              {selectedProduct ? (
                <select
                  value={item.unit}
                  onChange={(event) => onUpdateItem(index, "unit", event.target.value)}
                >
                  {unitOptions.map((conversion) => (
                    <option key={conversion.unit} value={conversion.unit}>
                      {conversion.unit}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={item.unit}
                  onChange={(event) => onUpdateItem(index, "unit", event.target.value)}
                  placeholder={t("salesForm.unitPlaceholder")}
                />
              )}
              {conversionPreview ? (
                <span className="unit-conversion-preview">
                  {conversionPreview.base_quantity} {conversionPreview.base_unit}
                </span>
              ) : null}
            </label>

            <label className="purchase-item-field sales-item-qty">
              <span>{t("salesForm.colQty")}</span>
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
              <span>{t("salesForm.colUnitPrice")}</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={item.unit_price}
                onChange={(event) => onUpdateItem(index, "unit_price", event.target.value)}
                placeholder="0.00"
                required
              />
            </label>

            <div className="purchase-item-field sales-item-discounts">
              <span>{t("salesForm.colDiscounts")}</span>
              <div className="sales-discount-cell">
                {(item.discounts || [0]).map((discount, discountIndex) => (
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

export default SalesEditLineItemsSection;
