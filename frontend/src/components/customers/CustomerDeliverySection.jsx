import { useLanguage } from "../../i18n/LanguageContext";
import { getRequiredFieldError } from "../contactValidation";
import { CUSTOMER_REQUIRED_FIELD_KEYS } from "./customerUtils";
import ContactOptionField from "../ContactOptionField";

function CustomerDeliverySection({
  draftCustomer,
  formErrors,
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
          <ContactOptionField
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
                billingNoteDate: next === "cash" ? "" : customer.billingNoteDate,
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
            <option value="cash">{t("customer.termDebit")}</option>
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
  );
}

export default CustomerDeliverySection;
