import { useLanguage } from "../i18n/LanguageContext";

function formatNumber(value, locale) {
  return Number(value || 0).toLocaleString(locale);
}

function PaginationControls({ pagination, onPageChange, itemLabel }) {
  const { language, t } = useLanguage();
  const resolvedItemLabel = itemLabel || t("pagination.records");
  const locale = language === "th" ? "th-TH" : "en-US";

  if (!pagination || !pagination.count) {
    return null;
  }

  const page = Number(pagination.page || 1);
  const totalPages = Math.max(1, Number(pagination.total_pages || 1));
  const pageSize = Number(pagination.page_size || 0);
  const count = Number(pagination.count || 0);
  const start = pageSize ? (page - 1) * pageSize + 1 : 1;
  const end = pageSize ? Math.min(count, page * pageSize) : count;

  return (
    <div className="list-pagination">
      <span>
        {t("pagination.showing", {
          start: formatNumber(start, locale),
          end: formatNumber(end, locale),
          count: formatNumber(count, locale),
          label: resolvedItemLabel,
        })}
      </span>
      <div className="list-pagination-actions">
        <button
          className="secondary-button"
          type="button"
          onClick={() => onPageChange?.(Math.max(1, page - 1))}
          disabled={page <= 1}
        >
          {t("common.previous")}
        </button>
        <span className="pagination-pill">
          {t("pagination.page", {
            page: formatNumber(page, locale),
            total: formatNumber(totalPages, locale),
          })}
        </span>
        <button
          className="secondary-button"
          type="button"
          onClick={() => onPageChange?.(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
        >
          {t("common.next")}
        </button>
      </div>
    </div>
  );
}

export default PaginationControls;
