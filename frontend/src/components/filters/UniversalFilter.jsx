import { useEffect, useMemo, useRef, useState } from "react";
import StatusFilterGroup from "../StatusFilterGroup";

/**
 * UniversalFilter — one reusable, config-driven filter bar for every directory
 * page. The page passes already-translated strings so this component stays pure
 * UI (no i18n coupling) and is dropped onto any of the 11 pages by changing only
 * the `fields` config.
 *
 * Layout:
 *   • Toolbar      — universal search + result count
 *   • Primary row  — the always-visible essentials (fields with section:"primary")
 *                    plus the More / Reset actions
 *   • Advanced     — fields with section:"advanced", revealed by the More toggle
 *   • Footer       — active-filter chips + quick-filter pills, sitting right above
 *                    the data table
 *
 * Field config (each item of `fields`):
 *   { id, type, label, section?: "primary" | "advanced", span?: number, ...typeProps }
 *   type "select"      → { value, onChange, options:[{value,label}], allLabel?, allValue? }
 *   type "combobox"    → { value, onChange, options:[{value,label}], placeholder, emptyMessage, allValue? }
 *   type "daterange"   → { from, to, onFromChange, onToChange }
 *   type "numberRange" → { min, max, onMinChange, onMaxChange, prefix?, placeholderMin?, placeholderMax? }
 *   type "statusGroup" → { statuses:[…], selectedStatuses:[…], onChange, presets?, formatStatusLabel?,
 *                          summaryAll, summaryNone, summaryCount:(n)=>string }
 *   type "chipGroup"   → { options:[{value,label}], selectedValues:[…], onToggle }
 *   type "toggle"      → { active, onToggle, toggleLabel }
 */
function UniversalFilter({
  search,
  meta,
  fields = [],
  quickFilters = [],
  activeChips = [],
  onReset,
  labels = {},
  children = null,
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const primaryFields = fields.filter((field) => (field.section ?? "primary") === "primary");
  const advancedFields = fields.filter((field) => field.section === "advanced");
  const hasAdvanced = advancedFields.length > 0;
  const advancedActiveCount = advancedFields.filter(isFieldActive).length;

  return (
    <section className="section-card uf-card">
      <div className="uf-toolbar">
        <label className="uf-search">
          <SearchIcon />
          <input
            type="search"
            value={search.value}
            onChange={(event) => search.onChange(event.target.value)}
            placeholder={search.placeholder}
            aria-label={search.placeholder}
          />
        </label>
        {meta ? <span className="uf-meta">{meta}</span> : null}
      </div>

      <div className="uf-primary-row">
        <div className="uf-grid">
          {primaryFields.map((field) => (
            <FilterField key={field.id} field={field} />
          ))}
        </div>
        <div className="uf-actions">
          {hasAdvanced ? (
            <button
              type="button"
              className="uf-btn uf-more-btn"
              aria-expanded={showAdvanced}
              onClick={() => setShowAdvanced((current) => !current)}
            >
              {labels.more}
              {advancedActiveCount ? (
                <span className="uf-badge">{advancedActiveCount}</span>
              ) : null}
              <Chevron open={showAdvanced} />
            </button>
          ) : null}
          <button type="button" className="uf-btn" onClick={onReset}>
            {labels.reset}
          </button>
        </div>
      </div>

      {hasAdvanced && showAdvanced ? (
        <div className="uf-advanced">
          <div className="uf-grid">
            {advancedFields.map((field) => (
              <FilterField key={field.id} field={field} />
            ))}
          </div>
        </div>
      ) : null}

      {activeChips.length ? (
        <div className="uf-chips">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              className="uf-chip"
              onClick={chip.onRemove}
            >
              <span>{chip.label}</span>
              <span className="uf-chip-x" aria-hidden="true">
                ×
              </span>
            </button>
          ))}
          {onReset ? (
            <button type="button" className="uf-chip-clear" onClick={onReset}>
              {labels.clearAll}
            </button>
          ) : null}
        </div>
      ) : null}

      {quickFilters.length ? (
        <div className="uf-quick">
          {labels.quick ? <span className="uf-quick-label">{labels.quick}</span> : null}
          {quickFilters.map((preset) => (
            <button
              key={preset.key ?? preset.label}
              type="button"
              className={`uf-pill${preset.active ? " active" : ""}`}
              aria-pressed={preset.active}
              onClick={preset.onClick}
            >
              {preset.label}
            </button>
          ))}
        </div>
      ) : null}

      {children}
    </section>
  );
}

function FilterField({ field }) {
  const style = field.span ? { gridColumn: `span ${field.span}` } : undefined;
  return (
    <div className="uf-field" style={style}>
      <span className="uf-label">{field.label}</span>
      <FieldControl field={field} />
    </div>
  );
}

function FieldControl({ field }) {
  switch (field.type) {
    case "select":
      return (
        <select
          className="uf-control"
          value={field.value}
          onChange={(event) => field.onChange(event.target.value)}
        >
          {field.allLabel != null ? (
            <option value={field.allValue ?? "all"}>{field.allLabel}</option>
          ) : null}
          {field.options.map((option) => (
            <option key={`${option.value}`} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    case "daterange":
      return (
        <div className="uf-control uf-daterange">
          <input
            type="date"
            value={field.from}
            onChange={(event) => field.onFromChange(event.target.value)}
            aria-label={`${field.label} from`}
          />
          <span className="uf-daterange-sep" aria-hidden="true">
            –
          </span>
          <input
            type="date"
            value={field.to}
            onChange={(event) => field.onToChange(event.target.value)}
            aria-label={`${field.label} to`}
          />
        </div>
      );
    case "numberRange":
      return (
        <div className="uf-control uf-numrange">
          {field.prefix ? <span className="uf-numrange-prefix">{field.prefix}</span> : null}
          <input
            type="number"
            inputMode="decimal"
            min="0"
            value={field.min}
            onChange={(event) => field.onMinChange(event.target.value)}
            placeholder={field.placeholderMin}
          />
          <span className="uf-numrange-sep" aria-hidden="true">
            –
          </span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            value={field.max}
            onChange={(event) => field.onMaxChange(event.target.value)}
            placeholder={field.placeholderMax}
          />
        </div>
      );
    case "combobox":
      return <ComboboxControl field={field} />;
    case "statusGroup":
      return <StatusGroupControl field={field} />;
    case "chipGroup":
      return (
        <div className="uf-chipgroup">
          {field.options.map((option) => {
            const active = (field.selectedValues || []).some(
              (value) => `${value}` === `${option.value}`
            );
            return (
              <button
                key={`${option.value}`}
                type="button"
                className={`uf-pill${active ? " active" : ""}`}
                aria-pressed={active}
                onClick={() => field.onToggle(option.value)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      );
    case "toggle":
      return (
        <div className="uf-chipgroup">
          <button
            type="button"
            className={`uf-pill${field.active ? " active" : ""}`}
            aria-pressed={field.active}
            onClick={field.onToggle}
          >
            {field.toggleLabel}
          </button>
        </div>
      );
    default:
      return null;
  }
}

// Searchable single-select dropdown. Owns its own query/open state so the page
// only tracks the selected value.
function ComboboxControl({ field }) {
  const { value, options, placeholder, emptyMessage, allValue = "", onChange } = field;
  const selectedLabel = useMemo(
    () => options.find((option) => `${option.value}` === `${value}`)?.label || "",
    [options, value]
  );
  const [query, setQuery] = useState(selectedLabel);
  const [open, setOpen] = useState(false);
  const lastValueRef = useRef(value);
  const containerRef = useRef(null);

  useEffect(() => {
    if (value !== lastValueRef.current) {
      lastValueRef.current = value;
      setQuery(selectedLabel);
    }
  }, [selectedLabel, value]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    function handlePointer(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
        setQuery(selectedLabel);
      }
    }
    document.addEventListener("mousedown", handlePointer);
    return () => document.removeEventListener("mousedown", handlePointer);
  }, [open, selectedLabel]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions = normalizedQuery
    ? options.filter((option) => option.label.toLowerCase().includes(normalizedQuery))
    : options;

  function handleSelect(option) {
    lastValueRef.current = option.value;
    setQuery(option.label);
    setOpen(false);
    onChange(option.value);
  }

  return (
    <div className="uf-control uf-combobox" ref={containerRef}>
      <input
        type="search"
        value={query}
        placeholder={placeholder}
        autoComplete="off"
        aria-expanded={open}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          if (value) {
            lastValueRef.current = allValue;
            onChange(allValue);
          }
        }}
        onFocus={() => setOpen(true)}
      />
      {open ? (
        <div className="uf-combobox-menu" role="listbox">
          {filteredOptions.length ? (
            filteredOptions.map((option) => (
              <button
                key={`${option.value}`}
                type="button"
                className={
                  `${option.value}` === `${value}`
                    ? "uf-combobox-option active"
                    : "uf-combobox-option"
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
            <div className="uf-combobox-empty">{emptyMessage}</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

// Compact multi-select status facet: a trigger summarising the selection that
// opens a popover reusing the shared StatusFilterGroup. Owns its own open state.
function StatusGroupControl({ field }) {
  const {
    statuses = [],
    selectedStatuses = [],
    presets = [],
    formatStatusLabel = (status) => status,
    onChange,
    summaryAll = "",
    summaryNone = "",
    summaryCount = (count) => `${count}`,
    label,
  } = field;
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

  const allSelected = statuses.length > 0 && selectedStatuses.length === statuses.length;
  let summary;
  if (allSelected) {
    summary = summaryAll;
  } else if (selectedStatuses.length === 0) {
    summary = summaryNone;
  } else if (selectedStatuses.length <= 2) {
    summary = selectedStatuses.map((status) => formatStatusLabel(status)).join(", ");
  } else {
    summary = summaryCount(selectedStatuses.length);
  }

  return (
    <div className="uf-control uf-statusgroup" ref={containerRef}>
      <button
        type="button"
        className="uf-statusgroup-trigger"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="uf-statusgroup-text">{summary}</span>
        <span className="uf-statusgroup-caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {open ? (
        <div className="uf-statusgroup-popover">
          <StatusFilterGroup
            title={label}
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

function isFieldActive(field) {
  switch (field.type) {
    case "select":
      return field.value != null && field.value !== (field.allValue ?? "all");
    case "combobox":
      return Boolean(field.value) && field.value !== (field.allValue ?? "");
    case "daterange":
      return Boolean(field.from || field.to);
    case "numberRange":
      return Boolean(field.min || field.max);
    case "statusGroup":
      return (
        (field.statuses || []).length > 0 &&
        (field.selectedStatuses || []).length !== (field.statuses || []).length
      );
    case "chipGroup":
      return (field.selectedValues || []).length > 0;
    case "toggle":
      return Boolean(field.active);
    default:
      return false;
  }
}

function SearchIcon() {
  return (
    <svg
      className="uf-search-icon"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function Chevron({ open }) {
  return (
    <svg
      className={`uf-chevron${open ? " open" : ""}`}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export default UniversalFilter;
