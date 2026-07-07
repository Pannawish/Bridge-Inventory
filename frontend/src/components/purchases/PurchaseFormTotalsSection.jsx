// Section component for purchase workflow forms or detail views.

import { formatMoney as fmt } from "../../format";
import { useLanguage } from "../../i18n/LanguageContext";
import { isVatEnabled } from "./purchaseFormUtils";

function PurchaseFormTotalsSection({
  vatMode,
  vatOptions,
  vatSummary,
  onVatModeChange,
}) {
  const { t } = useLanguage();

  return (
    <>
      <section className="purchase-vat-card">
        <div className="purchase-vat-card-header">
          <p className="purchase-vat-label">{t("purchaseForm.vatSetting")}</p>
          <label className="vat-toggle">
            <input
              type="checkbox"
              checked={isVatEnabled(vatMode)}
              onChange={(event) =>
                onVatModeChange(event.target.checked ? "not_included" : "none")
              }
            />
            <span className="vat-toggle-track" />
            <span className="vat-toggle-text">
              {isVatEnabled(vatMode) ? t("purchaseForm.vatOn") : t("purchaseForm.vatOff")}
            </span>
          </label>
        </div>
        {isVatEnabled(vatMode) ? (
          <div
            className="purchase-vat-options"
            role="radiogroup"
            aria-label={t("purchaseForm.vatAriaLabel")}
          >
            {vatOptions.map((option) => (
              <label
                key={option.value}
                className={
                  vatMode === option.value ? "purchase-vat-option active" : "purchase-vat-option"
                }
              >
                <input
                  type="radio"
                  name="purchase-vat-mode"
                  value={option.value}
                  checked={vatMode === option.value}
                  onChange={(event) => onVatModeChange(event.target.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        ) : null}
      </section>

      <div className="sales-summary-card">
        {isVatEnabled(vatMode) ? (
          <>
            <div className="sales-summary-row">
              <span>{t("purchaseForm.subtotal")}</span>
              <span>{fmt(vatSummary.total)}</span>
            </div>
            <div className="sales-summary-row">
              <span>{t("purchaseForm.vat")}</span>
              <span>{fmt(vatSummary.vat)}</span>
            </div>
          </>
        ) : null}
        <div className="sales-summary-row sales-summary-grand">
          <strong>{t("purchaseForm.grandTotal")}</strong>
          <strong>{fmt(vatSummary.grandTotal)}</strong>
        </div>
      </div>
    </>
  );
}

export default PurchaseFormTotalsSection;
