import { useLanguage } from "../../i18n/LanguageContext";
import { getRequiredFieldError } from "../contactValidation";
import {
  CUSTOMER_REQUIRED_FIELD_KEYS,
  getCustomerOptionError,
} from "./customerUtils";

function CustomerOptionField({
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

function CustomerEditorModal({
  draftCustomer,
  formErrors,
  onClose,
  onSave,
  onDelete,
  onUpdateTextField,
  onUpdateDraftCustomer,
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
        aria-labelledby="customer-modal-title"
      >
        <div className="section-heading supplier-modal-header">
          <div>
            <p className="eyebrow">{t("customer.detailsEyebrow")}</p>
            <h3 id="customer-modal-title">
              {draftCustomer.companyName || t("customer.newCustomer")}
            </h3>
          </div>
          <button
            className="icon-button subtle"
            type="button"
            aria-label={t("customer.closeLabel")}
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
          <div className="contact-editor-layout">
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
                    placeholder={t("customer.taxpayerPlaceholder")}
                    aria-invalid={formErrors.taxpayerId ? "true" : undefined}
                  />
                  {formErrors.taxpayerId ? (
                    <span className="field-error-text">{formErrors.taxpayerId}</span>
                  ) : null}
                </label>

                <div className="full-width">
                  <CustomerOptionField
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
                    onAdd={() => onAddOption("branches", "selectedBranchIndex")}
                    onDelete={() => onDeleteOption("branches", "selectedBranchIndex")}
                  />
                </div>
              </div>
            </section>

            <section className="contact-editor-section">
              <div className="contact-editor-section-heading">
                <div>
                  <p className="eyebrow">{t("customer.contactEyebrow")}</p>
                  <h4>{t("customer.contactTitle")}</h4>
                </div>
                <span>{t("customer.contactDescription")}</span>
              </div>

              <div className="contact-editor-grid">
                <CustomerOptionField
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
                  onAdd={() => onAddOption("locations", "selectedLocationIndex")}
                  onDelete={() => onDeleteOption("locations", "selectedLocationIndex")}
                />

                <CustomerOptionField
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
                  onAdd={() => onAddOption("emails", "selectedEmailIndex")}
                  onDelete={() => onDeleteOption("emails", "selectedEmailIndex")}
                />

                <div className="full-width">
                  <CustomerOptionField
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
                    onAdd={() => onAddOption("tels", "selectedTelIndex")}
                    onDelete={() => onDeleteOption("tels", "selectedTelIndex")}
                  />
                </div>
              </div>
            </section>

            <section className="contact-editor-section">
              <div className="contact-editor-section-heading">
                <div>
                  <p className="eyebrow">{t("customer.deliveryEyebrow")}</p>
                  <h4>{t("customer.deliveryTitle")}</h4>
                </div>
                <span>{t("customer.deliveryDescription")}</span>
              </div>

              <div className="contact-editor-grid">
                <div className="full-width">
                  <CustomerOptionField
                    label={t("customer.shippingLabel")}
                    options={draftCustomer.shippingAddresses}
                    selectedIndex={draftCustomer.selectedShippingAddressIndex}
                    placeholder={t("customer.shippingPlaceholder")}
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
                  {t("customer.remarkLabel")}
                  <textarea
                    rows="4"
                    value={draftCustomer.remark}
                    onChange={(event) => onUpdateTextField("remark", event.target.value)}
                    placeholder={t("customer.remarkPlaceholder")}
                  />
                </label>

                <label>
                  <span className="required-label">{t("customer.paymentTermLabel")}</span>
                  <select
                    required
                    value={draftCustomer.termType}
                    onChange={(event) => {
                      const next = event.target.value;
                      onUpdateDraftCustomer((customer) => ({
                        ...customer,
                        termType: next,
                        billingNoteDate: next === "debit" ? "" : customer.billingNoteDate,
                      }));
                      onSetFormErrors((currentErrors) => ({
                        ...currentErrors,
                        termType: getRequiredFieldError(
                          t(CUSTOMER_REQUIRED_FIELD_KEYS.termType),
                          next
                        ),
                        billingNoteDate:
                          next === "credit"
                            ? getRequiredFieldError(
                                t(CUSTOMER_REQUIRED_FIELD_KEYS.billingNoteDate),
                                draftCustomer.billingNoteDate
                              )
                            : "",
                      }));
                    }}
                    aria-invalid={formErrors.termType ? "true" : undefined}
                  >
                    <option value="">{t("customer.selectPaymentTerm")}</option>
                    <option value="debit">{t("customer.termDebit")}</option>
                    <option value="credit">{t("customer.termCredit")}</option>
                  </select>
                  {formErrors.termType ? (
                    <span className="field-error-text">{formErrors.termType}</span>
                  ) : null}
                </label>

                {draftCustomer.termType === "credit" ? (
                  <label>
                    <span className="required-label">{t("customer.creditTermLabel")}</span>
                    <select
                      required
                      value={draftCustomer.billingNoteDate}
                      onChange={(event) =>
                        onUpdateTextField("billingNoteDate", event.target.value)
                      }
                      aria-invalid={formErrors.billingNoteDate ? "true" : undefined}
                    >
                      <option value="">{t("customer.selectCreditTerm")}</option>
                      <option value="30 days">{t("customer.days30")}</option>
                      <option value="60 days">{t("customer.days60")}</option>
                      <option value="90 days">{t("customer.days90")}</option>
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
              {t("customer.deleteButton")}
            </button>
            <button className="secondary-button" type="button" onClick={onClose}>
              {t("common.cancel")}
            </button>
            <button className="primary-button" type="submit">
              {t("customer.saveButton")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CustomerEditorModal;
