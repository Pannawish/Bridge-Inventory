import { useEffect, useMemo, useState } from "react";
import { api } from "../../api";
import { getLocale } from "../../format";
import { useLanguage } from "../../i18n/LanguageContext";
import PaginationControls from "../PaginationControls";

const ACTIONS = ["create", "update", "delete", "login"];

function normalizeLogResponse(data) {
  if (Array.isArray(data)) {
    return { rows: data, pagination: null };
  }
  return { rows: data?.results || [], pagination: data || null };
}

function formatDateTime(value, language) {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return `${value}`;
  }
  return date.toLocaleString(getLocale(language), {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function stringifyChangeValue(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  if (Array.isArray(value)) {
    return value.length ? value.join(", ") : "—";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return `${value}`;
}

function getLabel(t, baseKey, value) {
  const key = `${baseKey}.${value}`;
  const translated = t(key);
  return translated === key ? value : translated;
}

function getObjectKey(objectType) {
  return `${objectType || ""}`.split(".").pop().toLowerCase();
}

function ActivityLogPage() {
  const { language, t } = useLanguage();
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [selectedLog, setSelectedLog] = useState(null);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [objectType, setObjectType] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const objectTypeOptions = useMemo(() => {
    const values = new Set(logs.map((log) => log.object_type).filter(Boolean));
    if (objectType) {
      values.add(objectType);
    }
    return Array.from(values).sort();
  }, [logs, objectType]);

  async function loadLogs(nextPage = page) {
    setBusy(true);
    setError("");
    try {
      const data = await api.getActivityLogs({
        page: nextPage,
        page_size: 25,
        search,
        action,
        object_type: objectType,
        user: userFilter,
        date_from: dateFrom,
        date_to: dateTo,
      });
      const normalized = normalizeLogResponse(data);
      setLogs(normalized.rows);
      setPagination(normalized.pagination);
      setPage(nextPage);
      setSelectedLog((current) => {
        if (!current) {
          return normalized.rows[0] || null;
        }
        return normalized.rows.find((row) => row.id === current.id) || normalized.rows[0] || null;
      });
    } catch (err) {
      setError(err.message || t("activityLog.errors.loadFailed"));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    loadLogs(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, action, objectType, userFilter, dateFrom, dateTo]);

  const selectedChanges = selectedLog?.changes ? Object.entries(selectedLog.changes) : [];

  return (
    <div className="stack-layout admin-page">
      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("activityLog.eyebrow")}</p>
            <h3>{t("activityLog.title")}</h3>
          </div>
          <button className="secondary-button" type="button" onClick={() => loadLogs(page)} disabled={busy}>
            {t("activityLog.refresh")}
          </button>
        </div>

        {error ? <div className="error-banner admin-inline-banner">{error}</div> : null}

        <div className="admin-filter-grid">
          <label>
            <span>{t("activityLog.search")}</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("activityLog.searchPlaceholder")}
            />
          </label>
          <label>
            <span>{t("activityLog.action")}</span>
            <select value={action} onChange={(event) => setAction(event.target.value)}>
              <option value="">{t("activityLog.allActions")}</option>
              {ACTIONS.map((item) => (
                <option value={item} key={item}>
                  {getLabel(t, "activityLog.actions", item)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{t("activityLog.objectType")}</span>
            <select value={objectType} onChange={(event) => setObjectType(event.target.value)}>
              <option value="">{t("activityLog.allObjects")}</option>
              {objectTypeOptions.map((item) => (
                <option value={item} key={item}>
                  {getLabel(t, "activityLog.objects", getObjectKey(item))}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{t("activityLog.userId")}</span>
            <input
              value={userFilter}
              onChange={(event) => setUserFilter(event.target.value)}
              placeholder={t("activityLog.userIdPlaceholder")}
            />
          </label>
          <label>
            <span>{t("common.from")}</span>
            <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          </label>
          <label>
            <span>{t("common.to")}</span>
            <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </label>
        </div>
      </section>

      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("activityLog.historyEyebrow")}</p>
            <h3>{t("activityLog.historyTitle")}</h3>
          </div>
        </div>

        {logs.length === 0 ? (
          <p className="empty-copy">{busy ? t("common.loading") : t("activityLog.noLogs")}</p>
        ) : (
          <div className="transaction-table-window admin-table-window">
            <div className="table-scroll desktop-table">
              <table className="transaction-history-table admin-table activity-log-table">
                <thead>
                  <tr>
                    <th className="table-index-cell">{t("userAccess.colIndex")}</th>
                    <th>{t("activityLog.colTime")}</th>
                    <th>{t("activityLog.colUser")}</th>
                    <th>{t("activityLog.colAction")}</th>
                    <th>{t("activityLog.colObject")}</th>
                    <th>{t("activityLog.colSummary")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, index) => (
                    <tr
                      key={log.id}
                      className={
                        selectedLog?.id === log.id ? "partner-table-row active" : "partner-table-row"
                      }
                    >
                      <td className="table-index-cell">{index + 1}</td>
                      <td>{formatDateTime(log.created_at, language)}</td>
                      <td>{log.actor_username || log.user?.username || t("activityLog.systemUser")}</td>
                      <td>
                        <span className={`admin-state action-${log.action}`}>
                          {getLabel(t, "activityLog.actions", log.action)}
                        </span>
                      </td>
                      <td>
                        <strong>{getLabel(t, "activityLog.objects", getObjectKey(log.object_type))}</strong>
                        <span className="admin-muted-line">{log.object_repr || log.object_id}</span>
                      </td>
                      <td>{log.summary}</td>
                      <td>
                        <button className="table-action-button" type="button" onClick={() => setSelectedLog(log)}>
                          {t("common.view")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <PaginationControls
          pagination={pagination}
          onPageChange={(nextPage) => loadLogs(nextPage)}
          itemLabel={t("activityLog.paginationLabel")}
        />
      </section>

      {selectedLog ? (
        <section className="section-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{t("activityLog.detailEyebrow")}</p>
              <h3>{selectedLog.summary || selectedLog.object_repr || selectedLog.id}</h3>
            </div>
          </div>

          <div className="admin-detail-grid">
            <div>
              <span>{t("activityLog.detailUser")}</span>
              <strong>{selectedLog.actor_username || selectedLog.user?.username || t("activityLog.systemUser")}</strong>
            </div>
            <div>
              <span>{t("activityLog.detailAction")}</span>
              <strong>{getLabel(t, "activityLog.actions", selectedLog.action)}</strong>
            </div>
            <div>
              <span>{t("activityLog.detailObject")}</span>
              <strong>{selectedLog.object_repr || selectedLog.object_id}</strong>
            </div>
            <div>
              <span>{t("activityLog.detailTime")}</span>
              <strong>{formatDateTime(selectedLog.created_at, language)}</strong>
            </div>
            <div>
              <span>{t("activityLog.detailIp")}</span>
              <strong>{selectedLog.ip_address || t("common.noData")}</strong>
            </div>
          </div>

          {selectedChanges.length === 0 ? (
            <p className="empty-copy">{t("activityLog.noChanges")}</p>
          ) : (
            <div className="transaction-table-window admin-table-window">
              <div className="table-scroll desktop-table">
                <table className="transaction-history-table admin-table">
                  <thead>
                    <tr>
                      <th>{t("activityLog.colField")}</th>
                      <th>{t("activityLog.colBefore")}</th>
                      <th>{t("activityLog.colAfter")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedChanges.map(([field, change]) => (
                      <tr key={field}>
                        <td>{field}</td>
                        <td>{stringifyChangeValue(change.before)}</td>
                        <td>{stringifyChangeValue(change.after)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}

export default ActivityLogPage;
