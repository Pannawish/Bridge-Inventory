import { useLanguage } from "../../i18n/LanguageContext";
import { getRequiredFieldError } from "../contactValidation";
import {
  SUPPLIER_REQUIRED_FIELD_KEYS,
  getSupplierOptionError,
} from "./supplierUtils";

function SupplierOptionField({
  label,
  options,
  selectedIndex,
  placeholder,
  type = "text",
  error = "",
  required = false,
  onSelect,
  onChange,
  onAdd,
  onDelete,
}) {
  const { t } = useLanguage();

  return (
    <div className="supplier-option-field">
      <label>
        <span className={required ? "required-label" : undefined}>{label}</span>
        <select
          value={selectedIndex}
          required={required}
          onChange={(event) => onSelect(Number(event.target.value))}
        >
          {options.map((option, index) => (
            <option key={`${label}-${index}`} value={index}>
              {option?.trim() || `${label} ${index + 1}`}
            </option>
          ))}
        </select>
      </label>

      <div className="supplier-option-edit-row">
        <input
          type={type}
          required={required}
          value={options[selectedIndex] || ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-invalid={error ? "true" : undefined}
        />
        <div className="supplier-option-edit-actions">
          <button className="secondary-button" type="button" onClick={onAdd}>
            {t("common.add")}
          </button>
          <button className="danger-button" type="button" onClick={onDelete}>
            {t("common.delete")}
          </button>
        </div>
      </div>
      {error ? <span className="field-error-text">{error}</span> : null}
    </div>
  );
}

function SupplierEditorModal({
  draftSupplier,
  formErrors,
  onClose,
  onSave,
  onDelete,
  onUpdateTextField,
  onUpdateDraftSupplier,
  onUpdateOptionIndex,
  onUpdateOptionValue,
  onAddOption,
  onDeleteOption,
  onSetFormErrors,
}) {
  const { t } = useLanguage();

  return (
    <div className="modal-backdrop">
      <div
        className="detail-modal supplier-modal contact-editor-modal section-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="supplier-modal-title"
      >
        <div className="section-heading supplier-modal-header">
          <div>
            <p className="eyebrow">{t("supplier.detailsEyebrow")}</p>
            <h3 id="supplier-modal-title">
              {draftSupplier.companyName || t("supplier.newSupplier")}
            </h3>
          </div>
          <button
            className="icon-button subtle"
            type="button"
            aria-label={t("supplier.closeLabel")}
            onClick={onClose}
          >
            X
          </button>
        </div>

        <form
          className="form-layout"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            onSave();
          }}
        >
          <div className="contact-editor-layout supplier-contact-editor-layout">
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
                  <SupplierOptionField
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

            <section className="contact-editor-section">
              <div className="contact-editor-section-heading">
                <div>
                  <p className="eyebrow">{t("supplier.contactEyebrow")}</p>
                  <h4>{t("supplier.contactTitle")}</h4>
                </div>
                <span>{t("supplier.contactDescription")}</span>
              </div>

              <div className="contact-editor-grid">
                <SupplierOptionField
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
                  onAdd={() => onAddOption("locations", "selectedLocationIndex")}
                  onDelete={() => onDeleteOption("locations", "selectedLocationIndex")}
                />

                <SupplierOptionField
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
                  onAdd={() => onAddOption("emails", "selectedEmailIndex")}
                  onDelete={() => onDeleteOption("emails", "selectedEmailIndex")}
                />

                <div className="full-width">
                  <SupplierOptionField
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
                    onAdd={() => onAddOption("tels", "selectedTelIndex")}
                    onDelete={() => onDeleteOption("tels", "selectedTelIndex")}
                  />
                </div>
              </div>
            </section>

            <section className="contact-editor-section">
              <div className="contact-editor-section-heading">
                <div>
                  <p className="eyebrow">{t("supplier.deliveryEyebrow")}</p>
                  <h4>{t("supplier.deliveryTitle")}</h4>
                </div>
                <span>{t("supplier.deliveryDescription")}</span>
              </div>

              <div className="contact-editor-grid">
                <div className="full-width">
                  <SupplierOptionField
                    label={t("supplier.shippingLabel")}
                    options={draftSupplier.shippingAddresses}
                    selectedIndex={draftSupplier.selectedShippingAddressIndex}
                    placeholder={t("supplier.shippingPlaceholder")}
                    required
                    error={formErrors.shippingAddresses}
                    onSelect={(nextIndex) =>
                      onUpdateOptionIndex("selectedShippingAddressIndex", nextIndex)
                    }
                    onChange={(nextValue) =>
                      onUpdateOptionValue(
                        "shippingAddresses",
                        "selectedShippingAddressIndex",
                        nextValue
                      )
                    }
                    onAdd={() => onAddOption("shippingAddresses", "selectedShippingAddressIndex")}
                    onDelete={() =>
                      onDeleteOption("shippingAddresses", "selectedShippingAddressIndex")
                    }
                  />
                </div>

                <label>
                  {t("supplier.remarkLabel")}
                  <textarea
                    rows="4"
                    value={draftSupplier.remark}
                    onChange={(event) => onUpdateTextField("remark", event.target.value)}
                    placeholder={t("supplier.remarkPlaceholder")}
                  />
                </label>

                <label>
                  <span className="required-label">{t("supplier.paymentTermLabel")}</span>
                  <select
                    required
                    value={draftSupplier.termType}
                    onChange={(event) => {
                      const next = event.target.value;
                      onUpdateDraftSupplier((supplier) => ({
                        ...supplier,
                        termType: next,
                        billingNoteDate: next === "debit" ? "" : supplier.billingNoteDate,
                      }));
                      onSetFormErrors((currentErrors) => ({
                        ...currentErrors,
                        termType: getRequiredFieldError(
                          t(SUPPLIER_REQUIRED_FIELD_KEYS.termType),
                          next
                        ),
                        billingNoteDate:
                          next === "credit"
                            ? getRequiredFieldError(
                                t(SUPPLIER_REQUIRED_FIELD_KEYS.billingNoteDate),
                                draftSupplier.billingNoteDate
                              )
                            : "",
                      }));
                    }}
                    aria-invalid={formErrors.termType ? "true" : undefined}
                  >
                    <option value="">{t("supplier.selectPaymentTerm")}</option>
                    <option value="debit">{t("supplier.termDebit")}</option>
                    <option value="credit">{t("supplier.termCredit")}</option>
                  </select>
                  {formErrors.termType ? (
                    <span className="field-error-text">{formErrors.termType}</span>
                  ) : null}
                </label>

                {draftSupplier.termType === "credit" ? (
                  <label>
                    <span className="required-label">{t("supplier.creditTermLabel")}</span>
                    <select
                      required
                      value={draftSupplier.billingNoteDate}
                      onChange={(event) =>
                        onUpdateTextField("billingNoteDate", event.target.value)
                      }
                      aria-invalid={formErrors.billingNoteDate ? "true" : undefined}
                    >
                      <option value="">{t("supplier.selectCreditTerm")}</option>
                      <option value="30 days">{t("supplier.days30")}</option>
                      <option value="60 days">{t("supplier.days60")}</option>
                      <option value="90 days">{t("supplier.days90")}</option>
                    </select>
                    {formErrors.billingNoteDate ? (
                      <span className="field-error-text">{formErrors.billingNoteDate}</span>
                    ) : null}
                  </label>
                ) : null}
              </div>
            </section>
          </div>

          <div className="supplier-modal-actions">
            <button className="danger-button" type="button" onClick={onDelete}>
              {t("supplier.deleteButton")}
            </button>
            <button className="secondary-button" type="button" onClick={onClose}>
              {t("common.cancel")}
            </button>
            <button className="primary-button" type="submit">
              {t("supplier.saveButton")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SupplierEditorModal;
