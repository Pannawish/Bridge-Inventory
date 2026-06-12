import { useLanguage } from "../../i18n/LanguageContext";
import SupplierIdentitySection from "./SupplierIdentitySection";
import SupplierProcurementSection from "./SupplierProcurementSection";
import SupplierContactSection from "./SupplierContactSection";
import SupplierDeliverySection from "./SupplierDeliverySection";

function SupplierEditorModal({
  draftSupplier,
  formErrors,
  isDirty = false,
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
            <SupplierIdentitySection
              draftSupplier={draftSupplier}
              formErrors={formErrors}
              onUpdateTextField={onUpdateTextField}
              onUpdateOptionIndex={onUpdateOptionIndex}
              onUpdateOptionValue={onUpdateOptionValue}
              onAddOption={onAddOption}
              onDeleteOption={onDeleteOption}
            />

            <SupplierProcurementSection
              draftSupplier={draftSupplier}
              formErrors={formErrors}
              onUpdateTextField={onUpdateTextField}
            />

            <SupplierContactSection
              draftSupplier={draftSupplier}
              formErrors={formErrors}
              onUpdateOptionIndex={onUpdateOptionIndex}
              onUpdateOptionValue={onUpdateOptionValue}
              onAddOption={onAddOption}
              onDeleteOption={onDeleteOption}
            />

            <SupplierDeliverySection
              draftSupplier={draftSupplier}
              formErrors={formErrors}
              onUpdateTextField={onUpdateTextField}
              onUpdateDraftSupplier={onUpdateDraftSupplier}
              onUpdateOptionIndex={onUpdateOptionIndex}
              onUpdateOptionValue={onUpdateOptionValue}
              onAddOption={onAddOption}
              onDeleteOption={onDeleteOption}
              onSetFormErrors={onSetFormErrors}
            />
          </div>

          <div className="supplier-modal-actions">
            <button className="danger-button" type="button" onClick={onDelete}>
              {t("supplier.deleteButton")}
            </button>
            <button className="secondary-button" type="button" onClick={onClose}>
              {t("common.cancel")}
            </button>
            <button className="primary-button" type="submit" disabled={!isDirty}>
              {t("supplier.saveButton")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SupplierEditorModal;
