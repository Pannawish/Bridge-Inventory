import { useLanguage } from "../../i18n/LanguageContext";
import ContactOptionField from "../ContactOptionField";

function SupplierContactSection({
  draftSupplier,
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
          <p className="eyebrow">{t("supplier.contactEyebrow")}</p>
          <h4>{t("supplier.contactTitle")}</h4>
        </div>
        <span>{t("supplier.contactDescription")}</span>
      </div>

      <div className="contact-editor-grid">
        <ContactOptionField
          label={t("supplier.locationLabel")}
          options={draftSupplier.locations}
          selectedIndex={draftSupplier.selectedLocationIndex}
          placeholder={t("supplier.locationPlaceholder")}
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
          label={t("supplier.emailLabel")}
          options={draftSupplier.emails}
          selectedIndex={draftSupplier.selectedEmailIndex}
          placeholder={t("supplier.emailPlaceholder")}
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
            label={t("supplier.telLabel")}
            options={draftSupplier.tels}
            selectedIndex={draftSupplier.selectedTelIndex}
            placeholder={t("supplier.telPlaceholder")}
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

export default SupplierContactSection;
