import { useLanguage } from "../../i18n/LanguageContext";

const HIDDEN_KEYS = new Set([
  "uploaded_documents",
  "uploaded_pictures",
  "remove_document",
  "remove_document_ids",
  "remove_picture_ids",
  "selected_picture_index",
  "selected_picture_id",
]);

const FIELD_ORDER = [
  "id",
  "reference_no",
  "sku",
  "productName",
  "product_name",
  "companyName",
  "status",
  "transaction_date",
  "quotation_date",
  "valid_until_date",
  "billing_note_date",
  "batch_date",
  "credit_note_date",
  "customer_name",
  "supplier_name",
  "customer_po_reference",
  "supplier_tax_invoice",
  "payment_term_type",
  "payment_term_days",
  "payment_date",
  "expected_payment_date",
  "planned_payment_date",
  "actual_payment_date",
  "vat_mode",
  "bill_discount",
  "total_before_vat",
  "vat_amount",
  "grand_total",
  "payable_total",
  "total_amount",
  "net_amount",
  "bank_reference",
  "category",
  "category_name",
  "stockBaseUnit",
  "defaultPurchaseUnit",
  "defaultSalesUnit",
  "reorder_level",
  "current_stock",
  "average_unit_cost",
  "average_recent_sale_price",
  "received_purchase_count",
  "active_sales_count",
  "note",
  "detail",
  "created_at",
  "updated_at",
];

const TABLE_FIELD_ORDER = [
  "id",
  "reference_no",
  "product_name",
  "productName",
  "sku",
  "status",
  "item_status",
  "sale_reference_no",
  "purchase_reference_no",
  "sale_status",
  "purchase_status",
  "transaction_date",
  "expected_delivery_date",
  "received_date",
  "shipped_date",
  "delivered_date",
  "quantity",
  "unit",
  "base_quantity",
  "base_unit",
  "conversion_factor",
  "unit_cost",
  "unit_price",
  "amount",
  "line_total",
  "total_cost",
  "received",
  "paid",
  "paid_date",
];

function compact(value) {
  return value !== undefined && value !== null && value !== "";
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toSnakeCase(value) {
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s.-]+/g, "_")
    .toLowerCase();
}

function normalizeLabelKey(field) {
  return field
    .split(".")
    .map((part) => toSnakeCase(part))
    .join("_");
}

function fallbackFieldLabel(field) {
  return field
    .split(".")
    .map((part) =>
      toSnakeCase(part)
        .split("_")
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
    )
    .join(" / ");
}

function translatedFieldLabel(field, t) {
  const labelKey = normalizeLabelKey(field);
  const translationKey = `chatDetail.field.${labelKey}`;
  const translated = t(translationKey);
  return translated === translationKey ? fallbackFieldLabel(field) : translated;
}

function translatedCollectionTitle(key, t) {
  const labelKey = normalizeLabelKey(key);
  const translationKey = `chatDetail.collection.${labelKey}`;
  const translated = t(translationKey);
  return translated === translationKey ? translatedFieldLabel(key, t) : translated;
}

function formatValue(value, t) {
  if (Array.isArray(value)) {
    return value
      .filter(compact)
      .map((item) => formatValue(item, t))
      .join(", ");
  }
  if (typeof value === "boolean") {
    return value ? t("common.yes") : t("common.no");
  }
  if (isPlainObject(value)) {
    return (
      value.reference_no ||
      value.companyName ||
      value.company_name ||
      value.productName ||
      value.product_name ||
      value.name ||
      value.url ||
      value.id ||
      JSON.stringify(value)
    );
  }
  return `${value}`;
}

function fallback(value, t) {
  return compact(value) ? formatValue(value, t) : "-";
}

function getRecordTitle(data) {
  return (
    data?.reference_no ||
    data?.productName ||
    data?.product_name ||
    data?.companyName ||
    data?.company_name ||
    data?.sku ||
    data?.id ||
    ""
  );
}

function getFieldSortIndex(field) {
  const directIndex = FIELD_ORDER.indexOf(field);
  if (directIndex >= 0) {
    return directIndex;
  }
  const normalized = normalizeLabelKey(field);
  const normalizedIndex = FIELD_ORDER.map(normalizeLabelKey).indexOf(normalized);
  return normalizedIndex >= 0 ? normalizedIndex : FIELD_ORDER.length + 1;
}

function isDisplayableArray(value) {
  return Array.isArray(value) && value.length && value.every((item) => !isPlainObject(item));
}

function collectDetailRows(data, prefix = "") {
  return Object.entries(data || {}).flatMap(([key, value]) => {
    if (HIDDEN_KEYS.has(key) || !compact(value)) {
      return [];
    }

    const field = prefix ? `${prefix}.${key}` : key;
    if (Array.isArray(value)) {
      return isDisplayableArray(value) ? [{ field, value }] : [];
    }
    if (isPlainObject(value)) {
      return collectDetailRows(value, field);
    }
    return [{ field, value }];
  });
}

function buildSummaryRows(data) {
  return collectDetailRows(data).sort((left, right) => {
    const sortDifference = getFieldSortIndex(left.field) - getFieldSortIndex(right.field);
    return sortDifference || left.field.localeCompare(right.field);
  });
}

function getArraySections(data) {
  return Object.entries(data || {})
    .filter(([key, value]) => !HIDDEN_KEYS.has(key) && Array.isArray(value) && value.length && value.some(isPlainObject))
    .map(([key, value]) => ({ key, rows: value.filter(isPlainObject) }));
}

function getTableColumns(rows) {
  const seen = new Set();
  rows.forEach((row) => {
    Object.entries(row).forEach(([key, value]) => {
      if (!HIDDEN_KEYS.has(key) && compact(value)) {
        seen.add(key);
      }
    });
  });
  return [...seen].sort((left, right) => {
    const leftIndex = TABLE_FIELD_ORDER.indexOf(left);
    const rightIndex = TABLE_FIELD_ORDER.indexOf(right);
    const normalizedLeft = leftIndex >= 0 ? leftIndex : TABLE_FIELD_ORDER.length + 1;
    const normalizedRight = rightIndex >= 0 ? rightIndex : TABLE_FIELD_ORDER.length + 1;
    return normalizedLeft - normalizedRight || left.localeCompare(right);
  });
}

function ChatDetailTable({ section, t }) {
  const columns = getTableColumns(section.rows);
  if (!columns.length) {
    return null;
  }

  return (
    <section className="chat-detail-lines">
      <div className="section-heading chat-detail-subheading">
        <div>
          <p className="eyebrow">{t("chatDetail.linesEyebrow")}</p>
          <h4>{translatedCollectionTitle(section.key, t)}</h4>
        </div>
      </div>
      <div className="table-scroll partner-line-scroll">
        <table className="detail-item-table chat-detail-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>{translatedFieldLabel(column, t)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {section.rows.map((row, rowIndex) => (
              <tr key={row.id || `${section.key}-${rowIndex}`}>
                {columns.map((column) => (
                  <td key={column}>{fallback(row[column], t)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ChatRecordDetailModal({ detail, onClose }) {
  const { t } = useLanguage();
  const data = detail?.data || {};
  const targetType = detail?.target?.type || "";
  const title = getRecordTitle(data);
  const summaryRows = buildSummaryRows(data);
  const arraySections = getArraySections(data);

  if (!detail?.open) {
    return null;
  }

  return (
    <div className="modal-backdrop">
      <div
        className="detail-modal transaction-detail-modal chat-detail-modal section-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="chat-detail-title"
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t(`chatDetail.type.${targetType}`)}</p>
            <h3 id="chat-detail-title">{title || t("chatDetail.title")}</h3>
          </div>
          <button type="button" className="secondary-button" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>

        {detail.loading ? <p className="busy-copy">{t("chatDetail.loading")}</p> : null}
        {detail.error ? <p className="empty-copy">{detail.error}</p> : null}

        {!detail.loading && !detail.error ? (
          <>
            {summaryRows.length ? (
              <section className="chat-detail-summary">
                <div className="section-heading chat-detail-subheading">
                  <div>
                    <p className="eyebrow">{t("chatDetail.summaryEyebrow")}</p>
                    <h4>{t("chatDetail.summaryTitle")}</h4>
                  </div>
                </div>
                <div className="detail-grid">
                  {summaryRows.map(({ field, value }) => (
                    <div key={field}>
                      <p className="detail-label">{translatedFieldLabel(field, t)}</p>
                      <strong>{formatValue(value, t)}</strong>
                    </div>
                  ))}
                </div>
              </section>
            ) : (
              <p className="empty-copy">{t("chatDetail.emptyDetail")}</p>
            )}

            {arraySections.map((section) => (
              <ChatDetailTable key={section.key} section={section} t={t} />
            ))}
          </>
        ) : null}
      </div>
    </div>
  );
}

export default ChatRecordDetailModal;
