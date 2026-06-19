import { useLanguage } from "../../i18n/LanguageContext";

const SUMMARY_FIELDS = [
  "reference_no",
  "status",
  "transaction_date",
  "quotation_date",
  "valid_until_date",
  "billing_note_date",
  "batch_date",
  "credit_note_date",
  "customer_name",
  "supplier_name",
  "sku",
  "product_name",
  "category_name",
  "stock_base_unit",
  "current_stock",
  "available_stock",
  "reorder_level",
  "grand_total",
  "total_amount",
  "expected_payment_date",
  "planned_payment_date",
  "actual_payment_date",
  "bank_reference",
  "note",
];

function compact(value) {
  return value !== undefined && value !== null && value !== "";
}

function formatValue(value, t) {
  if (Array.isArray(value)) {
    return value.filter(compact).join(", ");
  }
  if (typeof value === "boolean") {
    return value ? t("common.yes") : t("common.no");
  }
  return `${value}`;
}

function fallback(value) {
  return compact(value) ? value : "-";
}

function getRecordTitle(data) {
  return (
    data?.reference_no ||
    data?.product_name ||
    data?.productName ||
    data?.company_name ||
    data?.sku ||
    data?.id ||
    ""
  );
}

function getLineRows(data) {
  if (Array.isArray(data?.items)) {
    return data.items;
  }
  if (Array.isArray(data?.lines)) {
    return data.lines;
  }
  if (Array.isArray(data?.line_items)) {
    return data.line_items;
  }
  return [];
}

function lineName(line) {
  return (
    line.product_name ||
    line.sale_reference_no ||
    line.purchase_reference_no ||
    line.reference_no ||
    line.sku ||
    line.id ||
    ""
  );
}

function lineQuantity(line) {
  const qty = line.quantity ?? line.base_quantity ?? "";
  const unit = line.unit || line.base_unit || "";
  return [qty, unit].filter(compact).join(" ");
}

function ChatRecordDetailModal({ detail, onClose }) {
  const { t } = useLanguage();
  const data = detail?.data || {};
  const targetType = detail?.target?.type || "";
  const title = getRecordTitle(data);
  const summaryRows = SUMMARY_FIELDS
    .filter((field) => compact(data[field]))
    .map((field) => ({ field, value: data[field] }));
  const lineRows = getLineRows(data);

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
            <div className="detail-grid">
              {summaryRows.map(({ field, value }) => (
                <div key={field}>
                  <p className="detail-label">{t(`chatDetail.field.${field}`)}</p>
                  <strong>{formatValue(value, t)}</strong>
                </div>
              ))}
            </div>

            {lineRows.length ? (
              <section className="chat-detail-lines">
                <div className="section-heading chat-detail-subheading">
                  <div>
                    <p className="eyebrow">{t("chatDetail.linesEyebrow")}</p>
                    <h4>{t("chatDetail.linesTitle")}</h4>
                  </div>
                </div>
                <div className="table-scroll partner-line-scroll">
                  <table className="detail-item-table">
                    <thead>
                      <tr>
                        <th>{t("chatDetail.lineName")}</th>
                        <th>{t("chatDetail.lineSku")}</th>
                        <th>{t("chatDetail.lineStatus")}</th>
                        <th>{t("chatDetail.lineQty")}</th>
                        <th>{t("chatDetail.lineAmount")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineRows.map((line, index) => (
                        <tr key={line.id || `${lineName(line)}-${index}`}>
                          <td>{fallback(lineName(line))}</td>
                          <td>{fallback(line.sku)}</td>
                          <td>{fallback(line.status || line.item_status || line.sale_status || line.purchase_status)}</td>
                          <td>{fallback(lineQuantity(line))}</td>
                          <td>{fallback(line.amount ?? line.total_amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

export default ChatRecordDetailModal;
