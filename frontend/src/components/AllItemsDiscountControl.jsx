import { useLanguage } from "../i18n/LanguageContext";

export default function AllItemsDiscountControl({
  enabled,
  value,
  onEnabledChange,
  onValueChange,
}) {
  const { t } = useLanguage();

  return (
    <section className="purchase-vat-card transaction-wide-discount-card">
      <div className="purchase-vat-card-header">
        <p className="purchase-vat-label">{t("allItemsDiscount.label")}</p>
        <label className="vat-toggle">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => onEnabledChange(event.target.checked)}
          />
          <span className="vat-toggle-track" />
          <span className="vat-toggle-text">{enabled ? t("common.on") : t("common.off")}</span>
        </label>
      </div>

      {enabled ? (
        <label className="transaction-wide-discount-field">
          <span>{t("allItemsDiscount.discount")}</span>
          <div className="sales-discount-entry">
            <input
              className="sales-discount-input"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={value}
              onChange={(event) => onValueChange(event.target.value)}
              placeholder="0"
              required
            />
            <span className="sales-discount-pct">%</span>
          </div>
        </label>
      ) : null}
    </section>
  );
}
