import { useEffect, useState } from "react";
import { api } from "../api";
import { formatDate, formatMoney as fmt } from "../format";
import DocumentRefChip from "./DocumentRefChip";

function prettyStatus(status) {
  if (!status) return "—";
  return `${status}`
    .split("_")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}

function renderDiscounts(discounts) {
  if (!Array.isArray(discounts)) {
    return "—";
  }
  const active = discounts.filter((value) => Number(value) > 0);
  if (!active.length) {
    return "—";
  }
  return active.map((value) => `${Number(value)}%`).join("|");
}

function paymentTerm(type, days) {
  if (type === "credit") return `Credit (${days || ""})`;
  if (type === "debit") return "Debit";
  return "—";
}

function quotationLink(id, referenceNo) {
  return id ? [{ id, reference_no: referenceNo || "" }] : [];
}

// Per-document configuration: how to fetch, and how to render header fields,
// the line-items table, totals, and the outgoing reference chips.
const DOC_CONFIG = {
  quotation: {
    label: "Quotation",
    fetch: (id) => api.getQuotation(id),
    header: (doc) => [
      { label: "Date", value: formatDate(doc.quotation_date) },
      { label: "Valid Until", value: formatDate(doc.valid_until_date) },
      { label: "Customer", value: doc.customer_name || "—" },
      { label: "Supplier", value: doc.supplier_name || "—" },
      { label: "Note", value: doc.note || "—", fullWidth: true },
    ],
    items: (doc) => ({
      columns: ["#", "Product", "SKU", "Qty", "Unit", "Sale Price", "Discounts", "Amount"],
      rows: (doc.items || []).map((item, index) => [
        index + 1,
        item.product_name || "—",
        item.sku || "—",
        item.quantity,
        item.unit || "—",
        fmt(item.sale_price),
        renderDiscounts(item.discounts),
        fmt(item.sale_amount),
      ]),
    }),
    totals: (doc) => [
      { label: "Subtotal", value: fmt(doc.total_before_vat) },
      { label: "VAT", value: fmt(doc.vat_amount) },
      { label: "Grand Total", value: fmt(doc.grand_total), strong: true },
    ],
    refs: (doc) => [
      {
        label: "Purchase Orders Created",
        docType: "purchase",
        links: doc.derived_purchase_links || [],
      },
      {
        label: "Sales Created",
        docType: "sale",
        links: doc.derived_sale_links || [],
      },
    ],
  },
  purchase: {
    label: "Purchase Order",
    fetch: (id) => api.getPurchase(id),
    header: (doc) => [
      { label: "Date", value: formatDate(doc.transaction_date) },
      { label: "Supplier", value: doc.supplier_name || "—" },
      { label: "Status", status: doc.status },
      { label: "Supplier's Tax Invoice", value: doc.supplier_tax_invoice || "—" },
      { label: "Note", value: doc.note || "—", fullWidth: true },
    ],
    items: (doc) => ({
      columns: [
        "#",
        "Product",
        "SKU",
        "Expected",
        "Item Status",
        "Received",
        "Qty",
        "Unit Cost",
        "Discounts",
        "Amount",
      ],
      rows: (doc.items || []).map((item, index) => [
        index + 1,
        item.product_name || "—",
        item.sku || "—",
        formatDate(item.expected_delivery_date),
        prettyStatus(item.item_status),
        formatDate(item.received_date),
        item.quantity,
        fmt(item.unit_cost),
        renderDiscounts(item.discounts),
        fmt(item.amount),
      ]),
    }),
    totals: (doc) => [
      { label: "Total", value: fmt(doc.total_before_vat) },
      { label: "VAT", value: fmt(doc.vat_amount) },
      { label: "Grand Total", value: fmt(doc.grand_total), strong: true },
    ],
    refs: (doc) => [
      {
        label: "Source Quotation",
        docType: "quotation",
        links: quotationLink(doc.source_quotation_id, doc.source_quotation_reference_no),
      },
      {
        label: "Payment Batch",
        docType: "payment-batch",
        links: doc.payment_batch_links || [],
      },
    ],
  },
  sale: {
    label: "Tax Invoice",
    fetch: (id) => api.getSale(id),
    header: (doc) => [
      { label: "Date", value: formatDate(doc.transaction_date) },
      { label: "Customer", value: doc.customer_name || "—" },
      { label: "Status", status: doc.status },
      { label: "Customer's PO Ref.", value: doc.customer_po_reference || "—" },
      { label: "Note", value: doc.note || "—", fullWidth: true },
    ],
    items: (doc) => ({
      columns: [
        "#",
        "Product",
        "SKU",
        "Item Status",
        "Shipped",
        "Delivered",
        "Qty",
        "Unit Price",
        "Supplier",
        "Unit Cost",
        "Discounts",
        "Amount",
      ],
      rows: (doc.items || []).map((item, index) => [
        index + 1,
        item.product_name || "—",
        item.sku || "—",
        prettyStatus(item.item_status),
        formatDate(item.shipped_date),
        formatDate(item.delivered_date),
        item.quantity,
        fmt(item.unit_price),
        item.supplier_name || "—",
        Number(item.unit_cost) > 0 ? fmt(item.unit_cost) : "—",
        renderDiscounts(item.discounts),
        fmt(item.amount),
      ]),
    }),
    totals: (doc) => [
      { label: "Subtotal", value: fmt(doc.total_before_vat) },
      { label: "VAT", value: fmt(doc.vat_amount) },
      { label: "Grand Total", value: fmt(doc.grand_total), strong: true },
    ],
    refs: (doc) => [
      {
        label: "Source Quotation",
        docType: "quotation",
        links: quotationLink(doc.source_quotation_id, doc.source_quotation_reference_no),
      },
      {
        label: "Billing Notes",
        docType: "billing-note",
        links: doc.billing_note_links || [],
      },
      {
        label: "Credit Notes",
        docType: "credit-note",
        links: doc.credit_note_links || [],
      },
    ],
  },
  "billing-note": {
    label: "Billing Note",
    fetch: (id) => api.getBillingNote(id),
    header: (doc) => [
      { label: "Date", value: formatDate(doc.billing_note_date) },
      { label: "Customer", value: doc.customer_name || "—" },
      { label: "Status", status: doc.status },
      { label: "Expected Payment", value: formatDate(doc.expected_payment_date) },
      { label: "Actual Payment", value: formatDate(doc.actual_payment_date) },
      { label: "Bank Reference", value: doc.bank_reference || "—" },
      { label: "Note", value: doc.note || "—", fullWidth: true },
    ],
    items: (doc) => ({
      columns: [
        "#",
        "Reference",
        "Sale Date",
        "Payment Term",
        "Payment Due",
        "Received",
        "Received Date",
        "Amount",
      ],
      rows: (doc.lines || []).map((line, index) => [
        index + 1,
        line.sale_reference_no || line.sale || "—",
        formatDate(line.sale_transaction_date),
        paymentTerm(line.sale_payment_term_type, line.sale_payment_term_days),
        formatDate(line.sale_payment_date),
        line.received ? "Yes" : "No",
        formatDate(line.received_date),
        fmt(line.amount),
      ]),
    }),
    totals: (doc) => [
      { label: "Total Billed", value: fmt(doc.total_amount) },
      { label: "Net (after credits)", value: fmt(doc.net_amount), strong: true },
    ],
    refs: (doc) => [
      {
        label: "Sales",
        docType: "sale",
        links: (doc.lines || []).map((line) => ({
          id: line.sale_id || line.sale,
          reference_no: line.sale_reference_no || "",
        })),
      },
      {
        label: "Credit Notes",
        docType: "credit-note",
        links: (doc.credit_notes || []).map((cn) => ({
          id: cn.id,
          reference_no: cn.reference_no || "",
        })),
      },
    ],
  },
  "payment-batch": {
    label: "Payment Batch",
    fetch: (id) => api.getPaymentBatch(id),
    header: (doc) => [
      { label: "Date", value: formatDate(doc.batch_date) },
      { label: "Supplier", value: doc.supplier_name || "—" },
      { label: "Status", status: doc.status },
      { label: "Planned Payment", value: formatDate(doc.planned_payment_date) },
      { label: "Actual Payment", value: formatDate(doc.actual_payment_date) },
      { label: "Bank Reference", value: doc.bank_reference || "—" },
      { label: "Note", value: doc.note || "—", fullWidth: true },
    ],
    items: (doc) => ({
      columns: [
        "#",
        "Reference",
        "Date",
        "Payment Term",
        "Payment Due",
        "Paid",
        "Paid Date",
        "Amount",
      ],
      rows: (doc.lines || []).map((line, index) => [
        index + 1,
        line.purchase_reference_no || line.purchase || "—",
        formatDate(line.purchase_transaction_date),
        paymentTerm(line.purchase_payment_term_type, line.purchase_payment_term_days),
        formatDate(line.purchase_payment_date),
        line.paid ? "Yes" : "No",
        formatDate(line.paid_date),
        fmt(line.amount),
      ]),
    }),
    totals: (doc) => [{ label: "Total", value: fmt(doc.total_amount), strong: true }],
    refs: (doc) => [
      {
        label: "Purchases",
        docType: "purchase",
        links: (doc.lines || []).map((line) => ({
          id: line.purchase_id || line.purchase,
          reference_no: line.purchase_reference_no || "",
        })),
      },
    ],
  },
  "credit-note": {
    label: "Credit Note",
    fetch: (id) => api.getCreditNote(id),
    header: (doc) => [
      { label: "Date", value: formatDate(doc.credit_note_date) },
      { label: "Customer", value: doc.customer_name || "—" },
      { label: "Status", status: doc.status },
      { label: "Note", value: doc.note || "—", fullWidth: true },
    ],
    items: (doc) => ({
      columns: ["#", "Product", "SKU", "Qty", "Unit Price", "Amount"],
      rows: (doc.lines || []).map((line, index) => [
        index + 1,
        line.product_name || "—",
        line.sku || "—",
        line.quantity,
        fmt(line.unit_price),
        fmt(line.amount),
      ]),
    }),
    totals: (doc) => [{ label: "Total Credited", value: fmt(doc.total_amount), strong: true }],
    refs: (doc) => [
      {
        label: "Source Sale",
        docType: "sale",
        links: doc.sale ? [{ id: doc.sale, reference_no: doc.sale_reference_no || "" }] : [],
      },
      {
        label: "Billing Note",
        docType: "billing-note",
        links: doc.billing_note
          ? [{ id: doc.billing_note, reference_no: doc.billing_note_reference_no || "" }]
          : [],
      },
    ],
  },
};

function DocumentDetailBody({ entry, onOpenRef }) {
  const config = DOC_CONFIG[entry.docType];
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!config || !entry.docId) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    config
      .fetch(entry.docId)
      .then((data) => {
        if (active) setDoc(data);
      })
      .catch(() => {
        if (active) setError("Failed to load document.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [entry.docType, entry.docId]);

  if (!config) return null;
  if (loading) return <p className="doc-ref-modal-loading">Loading…</p>;
  if (error) return <p className="doc-ref-modal-error">{error}</p>;
  if (!doc) return null;

  const itemTable = config.items(doc);
  const totals = config.totals ? config.totals(doc) : [];
  const refGroups = config.refs ? config.refs(doc) : [];

  return (
    <>
      <div className="detail-grid">
        {config.header(doc).map((field) => (
          <div key={field.label} className={field.fullWidth ? "full-width" : undefined}>
            <p className="detail-label">{field.label}</p>
            {field.status !== undefined ? (
              <strong>
                <span className={`status-badge status-${field.status}`}>
                  {prettyStatus(field.status)}
                </span>
              </strong>
            ) : (
              <strong>{field.value || "—"}</strong>
            )}
          </div>
        ))}
      </div>

      {itemTable.rows.length > 0 && (
        <div className="detail-items">
          <div className="table-scroll">
            <table className="detail-item-table">
              <thead>
                <tr>
                  {itemTable.columns.map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {itemTable.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {totals.length > 0 && (
        <div className="tx-sales-summary">
          {totals.map(({ label, value, strong }) => (
            <div
              key={label}
              className={strong ? "tx-summary-row tx-summary-grand" : "tx-summary-row"}
            >
              {strong ? (
                <>
                  <strong>{label}</strong>
                  <strong>{value}</strong>
                </>
              ) : (
                <>
                  <span>{label}</span>
                  <span>{value}</span>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {refGroups.length > 0 && (
        <div className="doc-ref-modal-related">
          {refGroups.map((group) => {
            const validLinks = group.links.filter((link) => link && link.id);
            return (
              <div key={group.label} className="doc-ref-related-group">
                <p className="doc-ref-group-label">{group.label}</p>
                {validLinks.length > 0 ? (
                  <div className="doc-ref-chips">
                    {validLinks.map((link) => (
                      <DocumentRefChip
                        key={`${group.docType}-${link.id}`}
                        label={link.reference_no || link.id}
                        docType={group.docType}
                        onClick={() =>
                          onOpenRef({
                            docType: group.docType,
                            docId: link.id,
                            referenceNo: link.reference_no || link.id,
                          })
                        }
                      />
                    ))}
                  </div>
                ) : (
                  <span className="doc-ref-empty">—</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function DocumentRefModal({ docType, docId, referenceNo, onClose }) {
  const [stack, setStack] = useState([{ docType, docId, referenceNo }]);

  // A fresh open (props change) resets the drill-down stack.
  useEffect(() => {
    setStack([{ docType, docId, referenceNo }]);
  }, [docType, docId, referenceNo]);

  const entry = stack[stack.length - 1];
  const config = DOC_CONFIG[entry.docType];

  if (!config) return null;

  function openRef(nextEntry) {
    setStack((current) => [...current, nextEntry]);
  }

  function goBack() {
    setStack((current) => (current.length > 1 ? current.slice(0, -1) : current));
  }

  const canGoBack = stack.length > 1;

  return (
    <div className="modal-backdrop doc-ref-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="detail-modal transaction-detail-modal section-card"
        role="dialog"
        aria-modal="true"
        aria-label={`${config.label} ${entry.referenceNo || ""}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">{config.label}</p>
            <h3>{entry.referenceNo || entry.docId}</h3>
          </div>
          <div className="transaction-detail-actions">
            {canGoBack && (
              <button
                type="button"
                className="secondary-button table-action-button"
                onClick={goBack}
              >
                ← Back
              </button>
            )}
            <button
              type="button"
              className="secondary-button table-action-button"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>

        <DocumentDetailBody entry={entry} onOpenRef={openRef} />
      </div>
    </div>
  );
}

export default DocumentRefModal;
