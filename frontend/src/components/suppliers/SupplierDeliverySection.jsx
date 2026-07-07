// Section component for supplier management forms or detail views.

import { useLanguage } from "../../i18n/LanguageContext";
import { getRequiredFieldError } from "../contactValidation";
import { SUPPLIER_REQUIRED_FIELD_KEYS } from "./supplierUtils";
import ContactOptionField from "../ContactOptionField";

function SupplierDeliverySection({
  draftSupplier,
  formErrors,
  onUpdateTextField,
  onValidateTextField,
  onUpdateDraftSupplier,
  onUpdateOptionIndex,
  onUpdateOptionValue,
  onValidateOptionField,
  onAddOption,
  onDeleteOption,
  onSetFormErrors,
}) {
  const { t } = useLanguage();

  return (
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
          <ContactOptionField
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
            onBlur={() => onValidateOptionField("shippingAddresses")}
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
            onBlur={() => onValidateTextField("remark")}
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
                billingNoteDate: next === "cash" ? "" : supplier.billingNoteDate,
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
            onBlur={() => onValidateTextField("termType")}
            aria-invalid={formErrors.termType ? "true" : undefined}
          >
            <option value="">{t("supplier.selectPaymentTerm")}</option>
            <option value="cash">{t("supplier.termDebit")}</option>
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
              onBlur={() => onValidateTextField("billingNoteDate")}
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
  );
}

export default SupplierDeliverySection;
