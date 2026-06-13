// Shared filter UI used across every history/directory page so the
// quick presets, active-filter chips, and range inputs look and behave
// identically everywhere.

import { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import StatusFilterGroup from "./StatusFilterGroup";

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

// Simple labelled native <select> facet, styled like every other filter field.
// `options` is [{ value, label }]; an "all" option is rendered from `allLabel`.
// `allValue` is the sentinel the page uses for "no filter" (some pages use "",
// others "all").
export function FilterSelect({ title, value, options = [], allLabel, allValue = "all", onChange }) {
  return (
    <label className="history-filter-field">
      <span className="history-filter-title">{title}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {allLabel != null ? <option value={allValue}>{allLabel}</option> : null}
        {options.map((option) => (
          <option key={`${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

// Grouped "Date range" facet: a single field holding the From/To date inputs
// side by side, mirroring how RangeField groups a min/max amount pair.
export function FilterDateRange({ title, dateFrom, dateTo, onDateFromChange, onDateToChange }) {
  const { t } = useLanguage();
  return (
    <div className="history-filter-field">
      <span className="history-filter-title">{title || t("filterControls.dateRange")}</span>
      <div className="history-filter-range history-filter-date-range">
        <input
          type="date"
          value={dateFrom}
          onChange={(event) => onDateFromChange(event.target.value)}
          aria-label={t("filterControls.from")}
        />
        <span className="history-filter-range-sep">–</span>
        <input
          type="date"
          value={dateTo}
          onChange={(event) => onDateToChange(event.target.value)}
          aria-label={t("filterControls.to")}
        />
      </div>
    </div>
  );
}

// Compact multi-select status facet for the always-visible primary row: a
// trigger button summarising the selection, opening a popover that reuses the
// shared StatusFilterGroup (presets + checkboxes) so behaviour stays identical.
export function FilterStatusDropdown({
  title,
  statuses = [],
  selectedStatuses = [],
  presets = [],
  formatStatusLabel = (status) => status,
  onChange,
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    function handlePointer(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    function handleKey(event) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const allSelected =
    statuses.length > 0 && selectedStatuses.length === statuses.length;
  let summary;
  if (allSelected) {
    summary = t("filterControls.allStatuses");
  } else if (selectedStatuses.length === 0) {
    summary = t("filterControls.statusNone");
  } else if (selectedStatuses.length <= 2) {
    summary = selectedStatuses.map((status) => formatStatusLabel(status)).join(", ");
  } else {
    summary = t("filterControls.statusCount", { count: selectedStatuses.length });
  }

  return (
    <div className="history-filter-field filter-status-field" ref={containerRef}>
      <span className="history-filter-title">{title}</span>
      <button
        type="button"
        className="filter-status-trigger"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="filter-status-trigger-text">{summary}</span>
        <span className="filter-status-trigger-caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {open ? (
        <div className="filter-status-popover">
          <StatusFilterGroup
            title={title}
            statuses={statuses}
            selectedStatuses={selectedStatuses}
            presets={presets}
            formatStatusLabel={formatStatusLabel}
            onChange={onChange}
          />
        </div>
      ) : null}
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
