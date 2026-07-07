// Modal component for customer management workflows.

import { useLanguage } from "../../i18n/LanguageContext";
import CustomerIdentitySection from "./CustomerIdentitySection";
import CustomerContactSection from "./CustomerContactSection";
import CustomerDeliverySection from "./CustomerDeliverySection";
import { markFieldBlurredOnBlurCapture } from "../formBlurValidation";

function CustomerEditorModal({
  draftCustomer,
  formErrors,
  isDirty = false,
  onClose,
  onSave,
  onDelete,
  onUpdateTextField,
  onValidateTextField,
  onUpdateDraftCustomer,
  onUpdateOptionIndex,
  onUpdateOptionValue,
  onValidateOptionField,
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
          onBlurCapture={markFieldBlurredOnBlurCapture}
          onSubmit={(event) => {
            event.preventDefault();
            onSave();
          }}
        >
          <div className="contact-editor-layout">
            <CustomerIdentitySection
              draftCustomer={draftCustomer}
              formErrors={formErrors}
              onUpdateTextField={onUpdateTextField}
              onValidateTextField={onValidateTextField}
              onUpdateOptionIndex={onUpdateOptionIndex}
              onUpdateOptionValue={onUpdateOptionValue}
              onValidateOptionField={onValidateOptionField}
              onAddOption={onAddOption}
              onDeleteOption={onDeleteOption}
            />

            <CustomerContactSection
              draftCustomer={draftCustomer}
              formErrors={formErrors}
              onUpdateOptionIndex={onUpdateOptionIndex}
              onUpdateOptionValue={onUpdateOptionValue}
              onValidateOptionField={onValidateOptionField}
              onAddOption={onAddOption}
              onDeleteOption={onDeleteOption}
            />

            <CustomerDeliverySection
              draftCustomer={draftCustomer}
              formErrors={formErrors}
              onUpdateTextField={onUpdateTextField}
              onValidateTextField={onValidateTextField}
              onUpdateDraftCustomer={onUpdateDraftCustomer}
              onUpdateOptionIndex={onUpdateOptionIndex}
              onUpdateOptionValue={onUpdateOptionValue}
              onValidateOptionField={onValidateOptionField}
              onAddOption={onAddOption}
              onDeleteOption={onDeleteOption}
              onSetFormErrors={onSetFormErrors}
            />
          </div>

          <div className="supplier-modal-actions">
            <button className="danger-button" type="button" onClick={onDelete}>
              {t("customer.deleteButton")}
            </button>
            <button className="secondary-button" type="button" onClick={onClose}>
              {t("common.cancel")}
            </button>
            <button className="primary-button" type="submit" disabled={!isDirty}>
              {t("customer.saveButton")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CustomerEditorModal;
