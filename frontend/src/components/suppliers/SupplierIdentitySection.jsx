import { useLanguage } from "../../i18n/LanguageContext";
import ContactOptionField from "../ContactOptionField";

function SupplierIdentitySection({
  draftSupplier,
  formErrors,
  onUpdateTextField,
  onUpdateOptionIndex,
  onUpdateOptionValue,
  onAddOption,
  onDeleteOption,
}) {
  const { t } = useLanguage();

  return (
    <section className="contact-editor-section">
      <div className="contact-editor-section-heading">
        <div>
          <p className="eyebrow">{t("supplier.identityEyebrow")}</p>
          <h4>{t("supplier.identityTitle")}</h4>
        </div>
        <span>{t("supplier.identityDescription")}</span>
      </div>

      <div className="contact-editor-grid">
        <label>
          <span className="required-label">{t("supplier.companyNameLabel")}</span>
          <input
            autoFocus
            required
            value={draftSupplier.companyName}
            onChange={(event) => onUpdateTextField("companyName", event.target.value)}
            placeholder={t("supplier.companyNamePlaceholder")}
            aria-invalid={formErrors.companyName ? "true" : undefined}
          />
          {formErrors.companyName ? (
            <span className="field-error-text">{formErrors.companyName}</span>
          ) : null}
        </label>

        <label>
          <span className="required-label">{t("supplier.taxpayerLabel")}</span>
          <input
            required
            value={draftSupplier.taxpayerId}
            onChange={(event) => onUpdateTextField("taxpayerId", event.target.value)}
            placeholder={t("supplier.taxpayerPlaceholder")}
            aria-invalid={formErrors.taxpayerId ? "true" : undefined}
          />
          {formErrors.taxpayerId ? (
            <span className="field-error-text">{formErrors.taxpayerId}</span>
          ) : null}
        </label>

        <div className="full-width">
          <ContactOptionField
            label={t("supplier.branchLabel")}
            options={draftSupplier.branches}
            selectedIndex={draftSupplier.selectedBranchIndex}
            placeholder={t("supplier.branchPlaceholder")}
            required
            error={formErrors.branches}
            onSelect={(nextIndex) => onUpdateOptionIndex("selectedBranchIndex", nextIndex)}
            onChange={(nextValue) =>
              onUpdateOptionValue("branches", "selectedBranchIndex", nextValue)
            }
            onAdd={() => onAddOption("branches", "selectedBranchIndex")}
            onDelete={() => onDeleteOption("branches", "selectedBranchIndex")}
          />
        </div>
      </div>
    </section>
  );
}

export default SupplierIdentitySection;
