import { useLanguage } from "../../i18n/LanguageContext";
import ContactOptionField from "../ContactOptionField";

function CustomerContactSection({
  draftCustomer,
  formErrors,
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
          <p className="eyebrow">{t("customer.contactEyebrow")}</p>
          <h4>{t("customer.contactTitle")}</h4>
        </div>
        <span>{t("customer.contactDescription")}</span>
      </div>

      <div className="contact-editor-grid">
        <ContactOptionField
          label={t("customer.locationLabel")}
          options={draftCustomer.locations}
          selectedIndex={draftCustomer.selectedLocationIndex}
          placeholder={t("customer.locationPlaceholder")}
          required
          error={formErrors.locations}
          onSelect={(nextIndex) => onUpdateOptionIndex("selectedLocationIndex", nextIndex)}
          onChange={(nextValue) =>
            onUpdateOptionValue("locations", "selectedLocationIndex", nextValue)
          }
          onBlur={() => onValidateOptionField("locations")}
          onAdd={() => onAddOption("locations", "selectedLocationIndex")}
          onDelete={() => onDeleteOption("locations", "selectedLocationIndex")}
        />

        <ContactOptionField
          label={t("customer.emailLabel")}
          options={draftCustomer.emails}
          selectedIndex={draftCustomer.selectedEmailIndex}
          placeholder={t("customer.emailPlaceholder")}
          type="email"
          required
          error={formErrors.emails}
          onSelect={(nextIndex) => onUpdateOptionIndex("selectedEmailIndex", nextIndex)}
          onChange={(nextValue) =>
            onUpdateOptionValue("emails", "selectedEmailIndex", nextValue)
          }
          onBlur={() => onValidateOptionField("emails")}
          onAdd={() => onAddOption("emails", "selectedEmailIndex")}
          onDelete={() => onDeleteOption("emails", "selectedEmailIndex")}
        />

        <div className="full-width">
          <ContactOptionField
            label={t("customer.telLabel")}
            options={draftCustomer.tels}
            selectedIndex={draftCustomer.selectedTelIndex}
            placeholder={t("customer.telPlaceholder")}
            type="tel"
            required
            error={formErrors.tels}
            onSelect={(nextIndex) => onUpdateOptionIndex("selectedTelIndex", nextIndex)}
            onChange={(nextValue) =>
              onUpdateOptionValue("tels", "selectedTelIndex", nextValue)
            }
            onBlur={() => onValidateOptionField("tels")}
            onAdd={() => onAddOption("tels", "selectedTelIndex")}
            onDelete={() => onDeleteOption("tels", "selectedTelIndex")}
          />
        </div>
      </div>
    </section>
  );
}

export default CustomerContactSection;
