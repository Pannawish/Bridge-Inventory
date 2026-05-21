// Shared filter UI used across every history/directory page so the
// quick presets, active-filter chips, and range inputs look and behave
// identically everywhere.

export function FilterPresets({ presets }) {
  const items = (presets || []).filter(Boolean);
  if (!items.length) {
    return null;
  }
  return (
    <div className="history-filter-presets">
      <span className="history-filter-presets-label">Quick filters</span>
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
          title="Remove this filter"
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
          Clear all
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
