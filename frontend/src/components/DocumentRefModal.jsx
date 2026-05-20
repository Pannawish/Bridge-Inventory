import { useEffect, useState } from "react";
import { api } from "../api";
import { formatDate } from "../format";
import { formatMoney as fmt } from "../format";

const DOC_CONFIG = {
  quotation: {
    label: "Quotation",
    fetch: (id) => api.getQuotation(id),
    fields: (doc) => [
      { label: "Date", value: formatDate(doc.quotation_date) },
      { label: "Valid Until", value: formatDate(doc.valid_until_date) },
      { label: "Customer", value: doc.customer_name || "—" },
      { label: "Supplier", value: doc.supplier_name || "—" },
      { label: "Total", value: fmt(doc.grand_total) },
    ],
    tabId: "quotations",
  },
  purchase: {
    label: "Purchase Order",
    fetch: (id) => api.getPurchase(id),
    fields: (doc) => [
      { label: "Date", value: formatDate(doc.transaction_date) },
      { label: "Supplier", value: doc.supplier_name || "—" },
      { label: "Status", value: doc.status || "—" },
      { label: "Total", value: fmt(doc.grand_total) },
    ],
    tabId: "purchase-history",
  },
  sale: {
    label: "Tax Invoice",
    fetch: (id) => api.getSale(id),
    fields: (doc) => [
      { label: "Date", value: formatDate(doc.transaction_date) },
      { label: "Customer", value: doc.customer_name || "—" },
      { label: "Status", value: doc.status || "—" },
      { label: "Total", value: fmt(doc.grand_total) },
    ],
    tabId: "sales-history",
  },
  "billing-note": {
    label: "Billing Note",
    fetch: (id) => api.getBillingNote(id),
    fields: (doc) => [
      { label: "Date", value: formatDate(doc.billing_note_date) },
      { label: "Customer", value: doc.customer_name || "—" },
      { label: "Status", value: doc.status || "—" },
      { label: "Total", value: fmt(doc.total_amount) },
    ],
    tabId: "billing-notes",
  },
  "credit-note": {
    label: "Credit Note",
    fetch: (id) => api.getCreditNote(id),
    fields: (doc) => [
      { label: "Date", value: formatDate(doc.credit_note_date) },
      { label: "Customer", value: doc.customer_name || "—" },
      { label: "Status", value: doc.status || "—" },
      { label: "Total", value: fmt(doc.total_amount) },
    ],
    tabId: "credit-notes",
  },
  "payment-batch": {
    label: "Payment Batch",
    fetch: (id) => api.getPaymentBatch(id),
    fields: (doc) => [
      { label: "Date", value: formatDate(doc.batch_date) },
      { label: "Supplier", value: doc.supplier_name || "—" },
      { label: "Status", value: doc.status || "—" },
      { label: "Total", value: fmt(doc.total_amount) },
    ],
    tabId: "payment-batches",
  },
};

function DocumentRefModal({ docType, docId, referenceNo, onClose, onNavigate }) {
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const config = DOC_CONFIG[docType];

  useEffect(() => {
    if (!config || !docId) return;
    setLoading(true);
    setError("");
    config
      .fetch(docId)
      .then(setDoc)
      .catch(() => setError("Failed to load document."))
      .finally(() => setLoading(false));
  }, [docId, docType]);

  if (!config) return null;

  return (
    <div
      className="modal-backdrop doc-ref-modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="doc-ref-modal section-card"
        role="dialog"
        aria-modal="true"
        aria-label={`${config.label} ${referenceNo}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="doc-ref-modal-header">
          <div>
            <p className="eyebrow">{config.label}</p>
            <h3 className="doc-ref-modal-ref">{referenceNo || docId}</h3>
          </div>
          <button
            type="button"
            className="icon-button subtle"
            aria-label="Close"
            onClick={onClose}
          >
            X
          </button>
        </div>

        {loading && <p className="doc-ref-modal-loading">Loading…</p>}
        {error && <p className="doc-ref-modal-error">{error}</p>}

        {!loading && !error && doc && (
          <dl className="doc-ref-modal-fields">
            {config.fields(doc).map(({ label, value }) =>
              value && value !== "—" ? (
                <div key={label} className="doc-ref-modal-field">
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ) : null
            )}
          </dl>
        )}

        {onNavigate && (
          <div className="doc-ref-modal-footer">
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                onNavigate(config.tabId, docId);
                onClose();
              }}
            >
              Open in {config.label}s →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default DocumentRefModal;
