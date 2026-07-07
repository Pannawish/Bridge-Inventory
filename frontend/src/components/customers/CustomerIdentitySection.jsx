// Section component for customer management forms or detail views.

import { useLanguage } from "../../i18n/LanguageContext";
import ContactOptionField from "../ContactOptionField";

function CustomerIdentitySection({
  draftCustomer,
  formErrors,
  onUpdateTextField,
  onValidateTextField,
  onUpdateOptionIndex,
  onUpdateOptionValue,
  onValidateOptionField,
  onAddOption,
  onDeleteOption,
}) {
  const { t } = useLanguage();

  return (
    <section className="contact-editor-section">
      <div className="contact-editor-section-heading">
        <div>
          <p className="eyebrow">{t("customer.identityEyebrow")}</p>
          <h4>{t("customer.identityTitle")}</h4>
        </div>
        <span>{t("customer.identityDescription")}</span>
      </div>

      <div className="contact-editor-grid">
        <label>
          <span className="required-label">{t("customer.companyNameLabel")}</span>
          <input
            autoFocus
            required
            value={draftCustomer.companyName}
            onChange={(event) => onUpdateTextField("companyName", event.target.value)}
            onBlur={() => onValidateTextField("companyName")}
            placeholder={t("customer.companyNamePlaceholder")}
            aria-invalid={formErrors.companyName ? "true" : undefined}
          />
          {formErrors.companyName ? (
            <span className="field-error-text">{formErrors.companyName}</span>
          ) : null}
        </label>

        <label>
          <span className="required-label">{t("customer.taxpayerLabel")}</span>
          <input
            required
            value={draftCustomer.taxpayerId}
            onChange={(event) => onUpdateTextField("taxpayerId", event.target.value)}
            onBlur={() => onValidateTextField("taxpayerId")}
            placeholder={t("customer.taxpayerPlaceholder")}
            aria-invalid={formErrors.taxpayerId ? "true" : undefined}
          />
          {formErrors.taxpayerId ? (
            <span className="field-error-text">{formErrors.taxpayerId}</span>
          ) : null}
        </label>

        <div className="full-width">
          <ContactOptionField
            label={t("customer.branchLabel")}
            options={draftCustomer.branches}
            selectedIndex={draftCustomer.selectedBranchIndex}
            placeholder={t("customer.branchPlaceholder")}
            required
            error={formErrors.branches}
            onSelect={(nextIndex) => onUpdateOptionIndex("selectedBranchIndex", nextIndex)}
            onChange={(nextValue) =>
              onUpdateOptionValue("branches", "selectedBranchIndex", nextValue)
            }
            onBlur={() => onValidateOptionField("branches")}
            onAdd={() => onAddOption("branches", "selectedBranchIndex")}
            onDelete={() => onDeleteOption("branches", "selectedBranchIndex")}
          />
        </div>
      </div>
    </section>
  );
}

export default CustomerIdentitySection;
