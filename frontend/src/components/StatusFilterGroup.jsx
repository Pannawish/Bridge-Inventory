// React component for shared component: status filter group.

import { useLanguage } from "../i18n/LanguageContext";

function matchesStatusSelection(selectedStatuses = [], presetStatuses = []) {
  return (
    selectedStatuses.length === presetStatuses.length &&
    presetStatuses.every((status) => selectedStatuses.includes(status))
  );
}

export default function StatusFilterGroup({
  title,
  statuses = [],
  selectedStatuses = [],
  presets = [],
  formatStatusLabel = (status) => status,
  onChange,
}) {
  const { t } = useLanguage();
  const allSelected = matchesStatusSelection(selectedStatuses, statuses);
  const noneSelected = selectedStatuses.length === 0;

  function toggleStatus(status) {
    if (selectedStatuses.includes(status)) {
      onChange(selectedStatuses.filter((currentStatus) => currentStatus !== status));
      return;
    }

    onChange([...selectedStatuses, status]);
  }

  return (
    <div className="history-filter-status-group">
      <p className="history-filter-title">{title}</p>
      <div className="history-filter-status-toolbar">
        <div className="history-filter-status-presets">
          {presets.map((preset) => (
            <button
              key={preset.label}
              className={
                matchesStatusSelection(selectedStatuses, preset.statuses)
                  ? "history-filter-preset active"
                  : "history-filter-preset"
              }
              type="button"
              onClick={() => onChange([...preset.statuses])}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="history-filter-status-actions">
          <button
            className="history-filter-status-action"
            type="button"
            onClick={() => onChange([...statuses])}
            disabled={allSelected}
          >
            {t("common.selectAll")}
          </button>
          <button
            className="history-filter-status-action"
            type="button"
            onClick={() => onChange([])}
            disabled={noneSelected}
          >
            {t("common.clearAll")}
          </button>
        </div>
      </div>

      <div className="history-filter-options">
        {statuses.map((status) => (
          <label className="history-filter-option" key={status}>
            <input
              type="checkbox"
              checked={selectedStatuses.includes(status)}
              onChange={() => toggleStatus(status)}
            />
            <span>{formatStatusLabel(status)}</span>
          </label>
        ))}
      </div>

      {noneSelected ? (
        <p className="history-filter-status-note">
          {t("common.noStatusesSelected")}
        </p>
      ) : null}
    </div>
  );
}
