// Section component for quotation workflow forms or detail views.

import { useMemo } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { formatDisplayDate } from "./quotationUtils";
import { getFilteredCustomers } from "../sales/salesFormUtils";

function QuotationFormDetailsSection({
  form,
  isEditing,
  initialReference,
  customers,
  customerQuery,
  customerOpen,
  customerError,
  onCustomerQueryChange,
  onCustomerOpen,
  onCustomerClose,
  onSelectCustomer,
  validUntilDate,
  onUpdateForm,
  onQuotationDateChange,
  onValidUntilDaysChange,
  onValidUntilDayTypeChange,
  onPaymentTermTypeChange,
  onPaymentTermDaysChange,
}) {
  const { t } = useLanguage();
  const filteredCustomers = useMemo(
    () => getFilteredCustomers(customers, customerQuery),
    [customers, customerQuery]
  );

  return (
    <div className="form-grid">
      <label>
        {t("quotation.referenceLabel")}
        <input
          value={form.reference_no}
          readOnly={!isEditing}
          onChange={(event) => onUpdateForm("reference_no", event.target.value)}
          placeholder={initialReference}
        />
      </label>

      <label>
        <span className="required-label">{t("quotation.dateLabel")}</span>
        <input
          type="date"
          value={form.quotation_date}
          onChange={(event) => onQuotationDateChange(event.target.value)}
          required
        />
      </label>

      <label className="supplier-combobox-field">
        <span className="required-label">{t("quotation.customerLabel")}</span>
        <div className="supplier-combobox">
          <input
            value={customerQuery}
            onChange={(event) => onCustomerQueryChange(event.target.value)}
            onFocus={onCustomerOpen}
            onBlur={onCustomerClose}
            placeholder={t("quotation.searchCustomerPlaceholder")}
            autoComplete="off"
            aria-expanded={customerOpen}
            aria-controls="quotation-customer-list"
            aria-invalid={customerError ? "true" : "false"}
          />
          {customerOpen ? (
            <div className="supplier-combobox-menu" id="quotation-customer-list" role="listbox">
              {filteredCustomers.length ? (
                filteredCustomers.map((customer) => (
                  <button
                    key={customer.id}
                    type="button"
                    className={
                      customer.companyName === form.customer_name
                        ? "supplier-combobox-option active"
                        : "supplier-combobox-option"
                    }
                    onMouseDown={(event) => {
                      event.preventDefault();
                      onSelectCustomer(customer);
                    }}
                    role="option"
                    aria-selected={customer.companyName === form.customer_name}
                  >
                    {customer.companyName}
                  </button>
                ))
              ) : (
                <div className="supplier-combobox-empty">
                  {t("quotation.noCustomerFound")}
                </div>
              )}
            </div>
          ) : null}
        </div>
        {customerError ? <span className="field-error-text">{customerError}</span> : null}
      </label>

      <label>
        {t("quotation.shippingDateLabel")}
        <input
          type="date"
          value={form.shipping_date}
          onChange={(event) => onUpdateForm("shipping_date", event.target.value)}
        />
      </label>

      <div className="valid-until-field">
        <span className="required-label">{t("quotation.validUntilLabel")}</span>
        <div className="valid-until-days-row">
          <input
            type="number"
            className="valid-until-days-input"
            min="0"
            max="100"
            step="1"
            value={form.valid_until_days}
            onChange={(event) => onValidUntilDaysChange(event.target.value)}
            required
          />
          <span className="valid-until-days-unit">{t("quotation.days")}</span>
        </div>
        <div
          className="valid-until-type-options"
          role="radiogroup"
          aria-label={t("quotation.validUntilTypeAriaLabel")}
        >
          {[
            { value: "calendar", label: t("quotation.calendarDays") },
            { value: "business", label: t("quotation.businessDays") },
            { value: "no_valid_date", label: t("quotation.noValidDate") },
          ].map((option) => (
            <label
              key={option.value}
              className={
                form.valid_until_day_type === option.value
                  ? "valid-until-day-option active"
                  : "valid-until-day-option"
              }
            >
              <input
                type="radio"
                name="valid_until_day_type"
                value={option.value}
                checked={form.valid_until_day_type === option.value}
                onChange={() => onValidUntilDayTypeChange(option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
        <p className="valid-until-computed-date">
          {t("quotation.expiresLabel")}{" "}
          <strong>
            {form.valid_until_day_type === "no_valid_date" || !validUntilDate
              ? "—"
              : formatDisplayDate(validUntilDate)}
          </strong>
        </p>
      </div>

      <div className="quotation-payment-valid-group">
        <label>
          {t("quotation.paymentTermLabel")}
          <select
            value={form.payment_term_type}
            onChange={(event) => onPaymentTermTypeChange(event.target.value)}
          >
            <option value="">{t("quotation.paymentTermPlaceholder")}</option>
            <option value="cash">{t("quotation.paymentTermDebit")}</option>
            <option value="credit">{t("quotation.paymentTermCredit")}</option>
          </select>
        </label>

        <label style={{ visibility: form.payment_term_type === "credit" ? "visible" : "hidden" }}>
          {t("quotation.creditTermLabel")}
          <select
            value={form.payment_term_days}
            onChange={(event) => onPaymentTermDaysChange(event.target.value)}
            tabIndex={form.payment_term_type === "credit" ? 0 : -1}
          >
            <option value="">{t("quotation.creditTermPlaceholder")}</option>
            <option value="30 days">{t("quotation.creditTerm30")}</option>
            <option value="60 days">{t("quotation.creditTerm60")}</option>
            <option value="90 days">{t("quotation.creditTerm90")}</option>
          </select>
        </label>
      </div>

      <label className="full-width">
        {t("quotation.noteLabel")}
        <textarea
          rows="3"
          value={form.note}
          onChange={(event) => onUpdateForm("note", event.target.value)}
        />
      </label>
    </div>
  );
}

export default QuotationFormDetailsSection;
