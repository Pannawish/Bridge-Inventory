import { useLanguage } from "../../i18n/LanguageContext";

function ProductUnitsFields({
  draftProduct,
  onUpdateDraftField,
  onAddDraftUnitConversion,
  onUpdateDraftUnitConversion,
  onToggleDraftUnitConversion,
  onRemoveDraftUnitConversion,
}) {
  const { t } = useLanguage();

  return (
    <section className="product-editor-section">
      <div className="product-editor-section-heading">
        <div>
          <p className="eyebrow">{t("products.stockUnitsEyebrow")}</p>
          <h4>{t("products.stockUnitsTitle")}</h4>
        </div>
        <span>{t("products.stockUnitsHint")}</span>
      </div>

      <div className="product-editor-grid product-editor-unit-grid">
        <label>
          <span className="required-label">{t("products.baseStockUnitLabel")}</span>
          <input
            value={draftProduct.stockBaseUnit}
            onChange={(event) => onUpdateDraftField("stockBaseUnit", event.target.value)}
            placeholder={t("products.baseStockUnitPlaceholder")}
          />
        </label>

        <label>
          <span className="required-label">{t("products.defaultPurchaseUnitLabel")}</span>
          <input
            value={draftProduct.defaultPurchaseUnit}
            onChange={(event) => onUpdateDraftField("defaultPurchaseUnit", event.target.value)}
            placeholder={t("products.defaultPurchaseUnitPlaceholder")}
          />
        </label>

        <label>
          <span className="required-label">{t("products.defaultSalesUnitLabel")}</span>
          <input
            value={draftProduct.defaultSalesUnit}
            onChange={(event) => onUpdateDraftField("defaultSalesUnit", event.target.value)}
            placeholder={t("products.defaultSalesUnitPlaceholder")}
          />
        </label>
      </div>

      <div className="supplier-option-field product-editor-subsection">
        <div className="product-name-editor-header">
          <div>
            <p className="detail-label">{t("products.unitConversionsLabel")}</p>
            <p className="inventory-note product-name-editor-note">
              {t("products.unitConversionsNote")}
            </p>
          </div>
          <button className="secondary-button" type="button" onClick={onAddDraftUnitConversion}>
            {t("products.addUnitButton")}
          </button>
        </div>

        {(draftProduct.unitConversions || []).map((conversion, index) => (
          <div className="unit-conversion-row" key={`unit-conversion-${index}`}>
            <label>
              <span className="required-label">{t("products.unitLabel")}</span>
              <input
                value={conversion.unit}
                onChange={(event) => onUpdateDraftUnitConversion(index, "unit", event.target.value)}
                placeholder={t("products.unitPlaceholder")}
              />
            </label>
            <label>
              <span className="required-label">{t("products.factorToBaseLabel")}</span>
              <input
                type="number"
                min="0.000001"
                step="0.000001"
                value={conversion.factorToBase}
                onChange={(event) =>
                  onUpdateDraftUnitConversion(index, "factorToBase", event.target.value)
                }
                placeholder="1"
              />
            </label>
            <label className="unit-conversion-check">
              <input
                type="checkbox"
                checked={!!conversion.allowPurchase}
                onChange={() => onToggleDraftUnitConversion(index, "allowPurchase")}
              />
              {t("products.allowPurchaseLabel")}
            </label>
            <label className="unit-conversion-check">
              <input
                type="checkbox"
                checked={!!conversion.allowSale}
                onChange={() => onToggleDraftUnitConversion(index, "allowSale")}
              />
              {t("products.allowSaleLabel")}
            </label>
            <button
              className="icon-button subtle"
              type="button"
              aria-label={t("products.removeUnitAriaLabel", { n: index + 1 })}
              onClick={() => onRemoveDraftUnitConversion(index)}
            >
              X
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

export default ProductUnitsFields;
