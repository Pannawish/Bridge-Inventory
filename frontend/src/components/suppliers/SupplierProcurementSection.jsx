import { useLanguage } from "../../i18n/LanguageContext";

function SupplierProcurementSection({
  draftSupplier,
  formErrors,
  onUpdateTextField,
}) {
  const { t } = useLanguage();

  return (
    <section className="contact-editor-section">
      <div className="contact-editor-section-heading">
        <div>
          <p className="eyebrow">{t("supplier.procurementEyebrow")}</p>
          <h4>{t("supplier.procurementTitle")}</h4>
        </div>
        <span>{t("supplier.procurementDescription")}</span>
      </div>

      <div className="contact-editor-grid">
        <label>
          <span className="required-label">{t("supplier.procurementNameLabel")}</span>
          <input
            required
            value={draftSupplier.procurementName}
            onChange={(event) => onUpdateTextField("procurementName", event.target.value)}
            placeholder={t("supplier.procurementNamePlaceholder")}
            aria-invalid={formErrors.procurementName ? "true" : undefined}
          />
          {formErrors.procurementName ? (
            <span className="field-error-text">{formErrors.procurementName}</span>
          ) : null}
        </label>

        <label>
          <span className="required-label">{t("supplier.procurementTelLabel")}</span>
          <input
            required
            type="tel"
            value={draftSupplier.procurementTel}
            onChange={(event) => onUpdateTextField("procurementTel", event.target.value)}
            placeholder={t("supplier.procurementTelPlaceholder")}
            aria-invalid={formErrors.procurementTel ? "true" : undefined}
          />
          {formErrors.procurementTel ? (
            <span className="field-error-text">{formErrors.procurementTel}</span>
          ) : null}
        </label>
      </div>
    </section>
  );
}

export default SupplierProcurementSection;
