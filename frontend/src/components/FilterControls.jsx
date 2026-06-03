// Shared filter UI used across every history/directory page so the
// quick presets, active-filter chips, and range inputs look and behave
// identically everywhere.

import { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";

// Self-contained searchable dropdown for a single filter facet (supplier,
// customer, product, …). It owns its own query/open state so the page hook
// only has to track the selected value. `options` is [{ value, label }].
export function FilterCombobox({
  id,
  title,
  value = "",
  options = [],
  placeholder,
  emptyMessage,
  onChange,
}) {
  const selectedLabel = useMemo(
    () => options.find((option) => `${option.value}` === `${value}`)?.label || "",
    [options, value]
  );
  const [query, setQuery] = useState(selectedLabel);
  const [open, setOpen] = useState(false);
  const lastValueRef = useRef(value);

  // Keep the visible text in sync when the selection changes from outside
  // (e.g. a chip removed the filter, or Reset cleared everything).
  useEffect(() => {
    if (value !== lastValueRef.current) {
      lastValueRef.current = value;
      setQuery(selectedLabel);
    }
  }, [selectedLabel, value]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions = normalizedQuery
    ? options.filter((option) => option.label.toLowerCase().includes(normalizedQuery))
    : options;

  function handleInputChange(event) {
    setQuery(event.target.value);
    setOpen(true);
    if (value) {
      lastValueRef.current = "";
      onChange("");
    }
  }

  function handleSelect(option) {
    lastValueRef.current = option.value;
    setQuery(option.label);
    setOpen(false);
    onChange(option.value);
  }

  function handleBlur() {
    window.setTimeout(() => {
      setOpen(false);
      setQuery(selectedLabel);
    }, 120);
  }

  return (
    <label className="history-filter-field supplier-combobox-field">
      <span className="history-filter-title">{title}</span>
      <div className="supplier-combobox">
        <input
          id={id}
          type="search"
          value={query}
          onChange={handleInputChange}
          onFocus={() => setOpen(true)}
          onBlur={handleBlur}
          placeholder={placeholder}
          autoComplete="off"
          aria-expanded={open}
        />
        {open ? (
          <div className="supplier-combobox-menu" role="listbox">
            {filteredOptions.length ? (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={
                    `${option.value}` === `${value}`
                      ? "supplier-combobox-option active"
                      : "supplier-combobox-option"
                  }
                  onMouseDown={(event) => {
                    event.preventDefault();
                    handleSelect(option);
                  }}
                  role="option"
                  aria-selected={`${option.value}` === `${value}`}
                >
                  {option.label}
                </button>
              ))
            ) : (
              <div className="supplier-combobox-empty">{emptyMessage}</div>
            )}
          </div>
        ) : null}
      </div>
    </label>
  );
}

export function FilterPresets({ presets }) {
  const { t } = useLanguage();
  const items = (presets || []).filter(Boolean);
  if (!items.length) {
    return null;
  }
  return (
    <div className="history-filter-presets">
      <span className="history-filter-presets-label">{t("filterControls.quickFilters")}</span>
      {items.map((preset) => (
        <button
          key={preset.label}
          type="button"
          className={`history-filter-preset${preset.active ? " active" : ""}`}
          aria-pressed={preset.active}
          onClick={preset.onClick}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}

export function ActiveFilterChips({ chips, onClearAll }) {
  const { t } = useLanguage();
  const items = (chips || []).filter(Boolean);
  if (!items.length) {
    return null;
  }
  return (
    <div className="history-filter-chipbar">
      {items.map((chip) => (
        <button
          key={chip.key}
          type="button"
          className="history-filter-chip"
          onClick={chip.onRemove}
          title={t("filterControls.removeFilter")}
        >
          <span className="history-filter-chip-label">{chip.label}</span>
          <span className="history-filter-chip-remove" aria-hidden="true">
            ×
          </span>
        </button>
      ))}
      {onClearAll ? (
        <button
          type="button"
          className="history-filter-clear-all"
          onClick={onClearAll}
        >
          {t("filterControls.clearAll")}
        </button>
      ) : null}
    </div>
  );
}

export function RangeField({
  title,
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
  prefix,
  placeholderMin = "Min",
  placeholderMax = "Max",
  step,
}) {
  return (
    <div className="history-filter-field">
      <span className="history-filter-title">{title}</span>
      <div className="history-filter-range">
        {prefix ? (
          <span className="history-filter-range-prefix">{prefix}</span>
        ) : null}
        <input
          type="number"
          inputMode="decimal"
          value={minValue}
          onChange={(event) => onMinChange(event.target.value)}
          placeholder={placeholderMin}
          step={step}
          min="0"
        />
        <span className="history-filter-range-sep">–</span>
        <input
          type="number"
          inputMode="decimal"
          value={maxValue}
          onChange={(event) => onMaxChange(event.target.value)}
          placeholder={placeholderMax}
          step={step}
          min="0"
        />
      </div>
    </div>
  );
}

// Shared range predicate: keeps a numeric value when it falls inside the
// (optionally open-ended) min/max bounds entered as strings.
export function withinRange(value, minRaw, maxRaw) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return !minRaw && !maxRaw;
  }
  if (minRaw !== "" && minRaw != null) {
    const min = Number(minRaw);
    if (Number.isFinite(min) && amount < min) {
      return false;
    }
  }
  if (maxRaw !== "" && maxRaw != null) {
    const max = Number(maxRaw);
    if (Number.isFinite(max) && amount > max) {
      return false;
    }
  }
  return true;
}
