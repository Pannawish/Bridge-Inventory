import { useLanguage } from "../i18n/LanguageContext";

function ContactOptionField({
  label,
  options,
  selectedIndex,
  placeholder,
  type = "text",
  error = "",
  required = false,
  onSelect,
  onChange,
  onBlur,
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
          onBlur={onBlur}
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

export default ContactOptionField;
