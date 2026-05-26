import { formatMoney as fmt } from "../../format";
import { useLanguage } from "../../i18n/LanguageContext";
import { isVatEnabled } from "./salesFormUtils";

function SalesFormTotalsSection({
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
          <p className="purchase-vat-label">{t("salesForm.vatSetting")}</p>
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
              {isVatEnabled(vatMode) ? t("salesForm.vatOn") : t("salesForm.vatOff")}
            </span>
          </label>
        </div>
        {isVatEnabled(vatMode) ? (
          <div
            className="purchase-vat-options"
            role="radiogroup"
            aria-label={t("salesForm.vatAriaLabel")}
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
                  name="sales-vat-mode"
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
              <span>{t("salesForm.subtotal")}</span>
              <span>{fmt(vatSummary.total)}</span>
            </div>
            <div className="sales-summary-row">
              <span>{t("salesForm.vat")}</span>
              <span>{fmt(vatSummary.vat)}</span>
            </div>
          </>
        ) : null}
        <div className="sales-summary-row sales-summary-grand">
          <strong>{t("salesForm.grandTotal")}</strong>
          <strong>{fmt(vatSummary.grandTotal)}</strong>
        </div>
      </div>
    </>
  );
}

export default SalesFormTotalsSection;
