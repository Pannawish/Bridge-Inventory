import EligiblePartyCombobox from "../EligiblePartyCombobox";
import { useLanguage } from "../../i18n/LanguageContext";
import { formatDisplayDate } from "./quotationUtils";

function QuotationFormDetailsSection({
  form,
  isEditing,
  initialReference,
  customerOptions,
  validUntilDate,
  onUpdateForm,
  onQuotationDateChange,
  onValidUntilDaysChange,
  onValidUntilDayTypeChange,
}) {
  const { t } = useLanguage();

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

      <EligiblePartyCombobox
        id="quotation-customer"
        label={t("quotation.customerLabel")}
        value={form.customer_name}
        options={customerOptions}
        placeholder={t("quotation.searchCustomerPlaceholder")}
        emptyMessage={t("quotation.noCustomerFound")}
        onChange={(nextCustomerName) => onUpdateForm("customer_name", nextCustomerName)}
      />

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
