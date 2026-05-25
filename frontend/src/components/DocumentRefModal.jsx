import { useEffect, useState } from "react";
import { api } from "../api";
import { formatDate, formatMoney as fmt } from "../format";
import { getStatusLabel } from "../i18n/statusLabels";
import DocumentRefChip from "./DocumentRefChip";
import PaymentLineAmount from "./PaymentLineAmount";
import { useLanguage } from "../i18n/LanguageContext";

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

function getBaseQuantity(item) {
  if (item?.base_quantity !== undefined && item?.base_quantity !== null) {
    return Number(item.base_quantity) || 0;
  }

  const quantity = Number(item?.quantity) || 0;
  const factor = Number(item?.conversion_factor) || 1;
  return quantity * factor;
}

function getItemConversionFactor(item) {
  const rawFactor = Number(item?.conversion_factor);
  if (Number.isFinite(rawFactor) && rawFactor > 0) {
    return rawFactor;
  }

  const quantity = Number(item?.quantity) || 0;
  const baseQuantity = getBaseQuantity(item);
  return quantity > 0 && baseQuantity > 0 ? baseQuantity / quantity : 1;
}

function formatOptionalMoney(value) {
  return value === null || value === undefined || !Number.isFinite(Number(value))
    ? "—"
    : fmt(value);
}

function formatQuantityWithUnit(quantity, unit) {
  const numericQuantity = Number(quantity);
  const normalizedUnit = `${unit || ""}`.trim();

  if (!Number.isFinite(numericQuantity)) {
    return "—";
  }

  return normalizedUnit ? `${numericQuantity} ${normalizedUnit}` : `${numericQuantity}`;
}

function getSaleBaseUnitPrice(item) {
  const unitPrice = Number(item?.unit_price);
  if (!Number.isFinite(unitPrice)) {
    return null;
  }

  return unitPrice / getItemConversionFactor(item);
}

function getSaleBaseUnitPriceAfterDiscount(item) {
  const baseQuantity = getBaseQuantity(item);
  if (baseQuantity <= 0) {
    return null;
  }

  return (Number(item?.amount) || 0) / baseQuantity;
}

function getPurchaseBaseUnitCost(item) {
  const unitCost = Number(item?.unit_cost);
  if (!Number.isFinite(unitCost)) {
    return null;
  }

  return unitCost / getItemConversionFactor(item);
}

function getPurchaseBaseUnitCostAfterDiscount(item) {
  const baseQuantity = getBaseQuantity(item);
  if (baseQuantity <= 0) {
    return null;
  }

  return (Number(item?.amount) || 0) / baseQuantity;
}

function quotationLink(id, referenceNo) {
  return id ? [{ id, reference_no: referenceNo || "" }] : [];
}

// Purchase totals, expanded to show the payable breakdown when line items have
// been cancelled: the original grand total, the cancelled value, and the amount
// actually payable to the supplier.
function buildPurchasePayableTotals(doc, t) {
  const grand = Number(doc.grand_total) || 0;
  const payable = Number(doc.payable_total);
  const hasPayableReduction =
    Number.isFinite(payable) && grand - payable > 0.005;

  const totals = [
    { label: t("common.total"), value: fmt(doc.total_before_vat) },
    { label: t("documentRef.paymentTermVAT"), value: fmt(doc.vat_amount) },
    {
      label: hasPayableReduction
        ? t("documentRef.originalTotal")
        : t("common.grandTotal"),
      value: fmt(doc.grand_total),
      strong: true,
    },
  ];

  if (hasPayableReduction) {
    const cancelledCount = (doc.items || []).filter(
      (item) => item.item_status === "cancelled"
    ).length;
    totals.push({
      label: t("documentRef.cancelledAmount", { count: cancelledCount }),
      value: `−${fmt(grand - payable)}`,
      className: "tx-summary-cancelled",
    });
    totals.push({
      label: t("documentRef.amountPayable"),
      value: fmt(payable),
      strong: true,
      className: "tx-summary-payable",
    });
  }

  return totals;
}

function buildDocConfig(t) {
  function paymentTerm(type, days) {
    if (type === "credit") return t("documentRef.creditTermCredit", { days: days || "" });
    if (type === "debit") return t("documentRef.creditTermDebit");
    return "—";
  }

  return {
    quotation: {
      label: t("documentRef.quotation"),
      fetch: (id) => api.getQuotation(id),
      header: (doc) => [
        { label: t("documentRef.dateLabel"), value: formatDate(doc.quotation_date) },
        { label: t("documentRef.validUntil"), value: formatDate(doc.valid_until_date) },
        { label: t("documentRef.customer"), value: doc.customer_name || "—" },
        { label: t("documentRef.supplier"), value: doc.supplier_name || "—" },
        { label: t("documentRef.noteLabel"), value: doc.note || "—", fullWidth: true },
      ],
      items: (doc) => ({
        columns: [
          "#",
          t("documentRef.colProduct"),
          t("documentRef.colSKU"),
          t("documentRef.colQty"),
          t("documentRef.colUnit"),
          t("documentRef.colSalePrice"),
          t("documentRef.colDiscounts"),
          t("documentRef.colAmount"),
        ],
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
        { label: t("common.subtotal"), value: fmt(doc.total_before_vat) },
        { label: t("documentRef.paymentTermVAT"), value: fmt(doc.vat_amount) },
        { label: t("common.grandTotal"), value: fmt(doc.grand_total), strong: true },
      ],
      refs: (doc) => [
        {
          label: t("documentRef.purchaseOrders"),
          docType: "purchase",
          links: doc.derived_purchase_links || [],
        },
        {
          label: t("documentRef.salesCreated"),
          docType: "sale",
          links: doc.derived_sale_links || [],
        },
      ],
    },
    purchase: {
      label: t("documentRef.purchase"),
      fetch: (id) => api.getPurchase(id),
      header: (doc) => [
        { label: t("documentRef.dateLabel"), value: formatDate(doc.transaction_date) },
        { label: t("documentRef.supplier"), value: doc.supplier_name || "—" },
        { label: t("documentRef.status"), status: doc.status },
        { label: t("documentRef.supplierTaxInvoice"), value: doc.supplier_tax_invoice || "—" },
        { label: t("documentRef.noteLabel"), value: doc.note || "—", fullWidth: true },
      ],
      items: (doc) => ({
        columns: [
          "#",
          t("documentRef.colProduct"),
          t("documentRef.colSKU"),
          t("documentRef.colExpected"),
          t("documentRef.colItemStatus"),
          t("documentRef.colReceived"),
          t("documentRef.colQty"),
          t("documentRef.colBaseQty"),
          t("documentRef.colBaseCost"),
          t("documentRef.colBaseCostAfterDisc"),
          t("documentRef.colUnitCost"),
          t("documentRef.colDiscounts"),
          t("documentRef.colAmount"),
        ],
        rows: (doc.items || []).map((item, index) => [
          index + 1,
          item.product_name || "—",
          item.sku || "—",
          formatDate(item.expected_delivery_date),
          getStatusLabel(t, item.item_status),
          formatDate(item.received_date),
          formatQuantityWithUnit(item.quantity, item.unit),
          formatQuantityWithUnit(item.base_quantity, item.base_unit),
          formatOptionalMoney(getPurchaseBaseUnitCost(item)),
          formatOptionalMoney(getPurchaseBaseUnitCostAfterDiscount(item)),
          fmt(item.unit_cost),
          renderDiscounts(item.discounts),
          item.item_status === "cancelled" ? (
            <span className="detail-item-amount-cancelled">{fmt(item.amount)}</span>
          ) : (
            fmt(item.amount)
          ),
        ]),
        rowClassNames: (doc.items || []).map((item) =>
          item.item_status === "cancelled" ? "detail-item-cancelled" : undefined
        ),
      }),
      totals: (doc) => buildPurchasePayableTotals(doc, t),
      refs: (doc) => [
        {
          label: t("documentRef.sourceQuotation"),
          docType: "quotation",
          links: quotationLink(doc.source_quotation_id, doc.source_quotation_reference_no),
        },
        {
          label: t("documentRef.paymentBatchLabel"),
          docType: "payment-batch",
          links: doc.payment_batch_links || [],
        },
      ],
    },
    sale: {
      label: t("documentRef.sale"),
      fetch: (id) => api.getSale(id),
      header: (doc) => [
        { label: t("documentRef.dateLabel"), value: formatDate(doc.transaction_date) },
        { label: t("documentRef.customer"), value: doc.customer_name || "—" },
        { label: t("documentRef.status"), status: doc.status },
        { label: t("documentRef.customerPORef"), value: doc.customer_po_reference || "—" },
        { label: t("documentRef.noteLabel"), value: doc.note || "—", fullWidth: true },
      ],
      items: (doc) => ({
        columns: [
          "#",
          t("documentRef.colProduct"),
          t("documentRef.colSKU"),
          t("documentRef.colItemStatus"),
          t("documentRef.colShipped"),
          t("documentRef.colDelivered"),
          t("documentRef.colQty"),
          t("documentRef.colBaseQty"),
          t("documentRef.colBaseUnitPrice"),
          t("documentRef.colBaseUnitPriceAfterDisc"),
          t("documentRef.colUnitPrice"),
          t("documentRef.supplier"),
          t("documentRef.colUnitCost"),
          t("documentRef.colDiscounts"),
          t("documentRef.colAmount"),
        ],
        rows: (doc.items || []).map((item, index) => [
          index + 1,
          item.product_name || "—",
          item.sku || "—",
          getStatusLabel(t, item.item_status),
          formatDate(item.shipped_date),
          formatDate(item.delivered_date),
          formatQuantityWithUnit(item.quantity, item.unit),
          formatQuantityWithUnit(item.base_quantity, item.base_unit),
          formatOptionalMoney(getSaleBaseUnitPrice(item)),
          formatOptionalMoney(getSaleBaseUnitPriceAfterDiscount(item)),
          fmt(item.unit_price),
          item.supplier_name || "—",
          Number(item.unit_cost) > 0 ? fmt(item.unit_cost) : "—",
          renderDiscounts(item.discounts),
          fmt(item.amount),
        ]),
      }),
      totals: (doc) => [
        { label: t("common.subtotal"), value: fmt(doc.total_before_vat) },
        { label: t("documentRef.paymentTermVAT"), value: fmt(doc.vat_amount) },
        { label: t("common.grandTotal"), value: fmt(doc.grand_total), strong: true },
      ],
      refs: (doc) => [
        {
          label: t("documentRef.sourceQuotation"),
          docType: "quotation",
          links: quotationLink(doc.source_quotation_id, doc.source_quotation_reference_no),
        },
        {
          label: t("documentRef.billingNotes"),
          docType: "billing-note",
          links: doc.billing_note_links || [],
        },
        {
          label: t("documentRef.creditNotes"),
          docType: "credit-note",
          links: doc.credit_note_links || [],
        },
      ],
    },
    "billing-note": {
      label: t("documentRef.billingNote"),
      fetch: (id) => api.getBillingNote(id),
      header: (doc) => [
        { label: t("documentRef.dateLabel"), value: formatDate(doc.billing_note_date) },
        { label: t("documentRef.customer"), value: doc.customer_name || "—" },
        { label: t("documentRef.status"), status: doc.status },
        { label: t("documentRef.expectedPayment"), value: formatDate(doc.expected_payment_date) },
        { label: t("documentRef.actualPayment"), value: formatDate(doc.actual_payment_date) },
        { label: t("documentRef.bankReference"), value: doc.bank_reference || "—" },
        { label: t("documentRef.noteLabel"), value: doc.note || "—", fullWidth: true },
      ],
      items: (doc) => ({
        columns: [
          "#",
          t("documentRef.colReference"),
          t("documentRef.colSaleDate"),
          t("documentRef.colPaymentTerm"),
          t("documentRef.colPaymentDue"),
          t("documentRef.colReceived"),
          t("documentRef.colReceivedDate"),
          t("documentRef.colAmount"),
        ],
        rows: (doc.lines || []).map((line, index) => [
          index + 1,
          line.sale_reference_no || line.sale || "—",
          formatDate(line.sale_transaction_date),
          paymentTerm(line.sale_payment_term_type, line.sale_payment_term_days),
          formatDate(line.sale_payment_date),
          line.received ? t("common.yes") : t("common.no"),
          formatDate(line.received_date),
          fmt(line.amount),
        ]),
      }),
      totals: (doc) => [
        { label: t("documentRef.totalBilled"), value: fmt(doc.total_amount) },
        { label: t("documentRef.netAfterCredits"), value: fmt(doc.net_amount), strong: true },
      ],
      refs: (doc) => [
        {
          label: t("documentRef.sales"),
          docType: "sale",
          links: (doc.lines || []).map((line) => ({
            id: line.sale_id || line.sale,
            reference_no: line.sale_reference_no || "",
          })),
        },
        {
          label: t("documentRef.creditNotes"),
          docType: "credit-note",
          links: (doc.credit_notes || []).map((cn) => ({
            id: cn.id,
            reference_no: cn.reference_no || "",
          })),
        },
      ],
    },
    "payment-batch": {
      label: t("documentRef.paymentBatch"),
      fetch: (id) => api.getPaymentBatch(id),
      header: (doc) => [
        { label: t("documentRef.dateLabel"), value: formatDate(doc.batch_date) },
        { label: t("documentRef.supplier"), value: doc.supplier_name || "—" },
        { label: t("documentRef.status"), status: doc.status },
        { label: t("documentRef.plannedPayment"), value: formatDate(doc.planned_payment_date) },
        { label: t("documentRef.actualPayment"), value: formatDate(doc.actual_payment_date) },
        { label: t("documentRef.bankReference"), value: doc.bank_reference || "—" },
        { label: t("documentRef.noteLabel"), value: doc.note || "—", fullWidth: true },
      ],
      items: (doc) => ({
        columns: [
          "#",
          t("documentRef.colReference"),
          t("documentRef.colPODate"),
          t("documentRef.colPaymentTerm"),
          t("documentRef.colPaymentDue"),
          t("documentRef.colPaid"),
          t("documentRef.colPaidDate"),
          t("documentRef.colAmount"),
        ],
        rows: (doc.lines || []).map((line, index) => [
          index + 1,
          line.purchase_reference_no || line.purchase || "—",
          formatDate(line.purchase_transaction_date),
          paymentTerm(line.purchase_payment_term_type, line.purchase_payment_term_days),
          formatDate(line.purchase_payment_date),
          line.paid ? t("common.yes") : t("common.no"),
          formatDate(line.paid_date),
          <PaymentLineAmount key={line.id || index} line={line} />,
        ]),
      }),
      totals: (doc) => [{ label: t("common.total"), value: fmt(doc.total_amount), strong: true }],
      refs: (doc) => [
        {
          label: t("documentRef.purchases"),
          docType: "purchase",
          links: (doc.lines || []).map((line) => ({
            id: line.purchase_id || line.purchase,
            reference_no: line.purchase_reference_no || "",
          })),
        },
      ],
    },
    "credit-note": {
      label: t("documentRef.creditNote"),
      fetch: (id) => api.getCreditNote(id),
      header: (doc) => [
        { label: t("documentRef.dateLabel"), value: formatDate(doc.credit_note_date) },
        { label: t("documentRef.customer"), value: doc.customer_name || "—" },
        { label: t("documentRef.status"), status: doc.status },
        { label: t("documentRef.noteLabel"), value: doc.note || "—", fullWidth: true },
      ],
      items: (doc) => ({
        columns: [
          "#",
          t("documentRef.colProduct"),
          t("documentRef.colSKU"),
          t("documentRef.colQty"),
          t("documentRef.colUnitPrice"),
          t("documentRef.colAmount"),
        ],
        rows: (doc.lines || []).map((line, index) => [
          index + 1,
          line.product_name || "—",
          line.sku || "—",
          line.quantity,
          fmt(line.unit_price),
          fmt(line.amount),
        ]),
      }),
      totals: (doc) => [{ label: t("documentRef.totalCredited"), value: fmt(doc.total_amount), strong: true }],
      refs: (doc) => [
        {
          label: t("documentRef.sourceSale"),
          docType: "sale",
          links: doc.sale ? [{ id: doc.sale, reference_no: doc.sale_reference_no || "" }] : [],
        },
        {
          label: t("documentRef.billingNoteLabel"),
          docType: "billing-note",
          links: doc.billing_note
            ? [{ id: doc.billing_note, reference_no: doc.billing_note_reference_no || "" }]
            : [],
        },
      ],
    },
  };
}

function DocumentDetailBody({ entry, onOpenRef }) {
  const { t } = useLanguage();
  const DOC_CONFIG = buildDocConfig(t);
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
        if (active) setError(t("documentRef.failed"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [entry.docType, entry.docId]);

  if (!config) return null;
  if (loading) return <p className="doc-ref-modal-loading">{t("documentRef.loading")}</p>;
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
                  {getStatusLabel(t, field.status)}
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
                  <tr key={rowIndex} className={itemTable.rowClassNames?.[rowIndex]}>
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
          {totals.map(({ label, value, strong, className }) => (
            <div
              key={label}
              className={`${
                strong ? "tx-summary-row tx-summary-grand" : "tx-summary-row"
              }${className ? ` ${className}` : ""}`}
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
  const { t } = useLanguage();
  const [stack, setStack] = useState([{ docType, docId, referenceNo }]);

  // A fresh open (props change) resets the drill-down stack.
  useEffect(() => {
    setStack([{ docType, docId, referenceNo }]);
  }, [docType, docId, referenceNo]);

  const entry = stack[stack.length - 1];
  const DOC_CONFIG = buildDocConfig(t);
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
                {t("documentRef.back")}
              </button>
            )}
            <button
              type="button"
              className="secondary-button table-action-button"
              onClick={onClose}
            >
              {t("common.close")}
            </button>
          </div>
        </div>

        <DocumentDetailBody entry={entry} onOpenRef={openRef} />
      </div>
    </div>
  );
}

export default DocumentRefModal;
