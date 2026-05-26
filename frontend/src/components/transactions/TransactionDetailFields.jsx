import { formatDate } from "../../format";
import { useLanguage } from "../../i18n/LanguageContext";
import { getStatusLabel } from "../../i18n/statusLabels";
import DocumentRefChip from "../DocumentRefChip";
import { getDocumentName, getTransactionDocuments } from "./transactionTableUtils";

function normalizeRefLinks(links) {
  if (Array.isArray(links)) {
    return links.filter((link) => link && link.id);
  }

  if (links && typeof links === "object" && links.id) {
    return [links];
  }

  return [];
}

function renderRefCell({ label, docType, links, onOpenDocRef }) {
  const validLinks = normalizeRefLinks(links);

  return (
    <div>
      <p className="detail-label">{label}</p>
      {validLinks.length ? (
        <div className="doc-ref-chips">
          {validLinks.map((link) => (
            <DocumentRefChip
              key={`${docType}-${link.id}`}
              label={link.reference_no || link.id}
              docType={docType}
              onClick={() =>
                onOpenDocRef({
                  docType,
                  docId: link.id,
                  referenceNo: link.reference_no || link.id,
                })
              }
            />
          ))}
        </div>
      ) : (
        <strong>—</strong>
      )}
    </div>
  );
}

function TransactionDetailFields({
  selectedRow,
  type,
  personKey,
  detailNameLabel,
  onPurchaseTaxInvoiceChange,
  onSaleCustomerPoReferenceChange,
  onOpenDocRef,
}) {
  const { t } = useLanguage();

  return (
    <div className="detail-grid">
      <div>
        <p className="detail-label">{detailNameLabel}</p>
        <strong>{selectedRow[personKey] || "—"}</strong>
      </div>
      <div>
        <p className="detail-label">{t("transactionTable.colStatus")}</p>
        <strong>
          <span className={`status-badge status-${selectedRow.status}`}>
            {getStatusLabel(t, selectedRow.status)}
          </span>
        </strong>
      </div>
      <div>
        <p className="detail-label">{t("transactionTable.transactionDate")}</p>
        <strong>{formatDate(selectedRow.transaction_date)}</strong>
      </div>
      <div>
        <p className="detail-label">{t("transactionTable.paymentTerm")}</p>
        <strong>
          {selectedRow.payment_term_type === "credit"
            ? t("transactionTable.paymentCredit", {
                days: selectedRow.payment_term_days || "—",
              })
            : selectedRow.payment_term_type === "debit"
              ? t("transactionTable.paymentDebit")
              : "—"}
        </strong>
      </div>
      <div>
        <p className="detail-label">{t("transactionTable.paymentDate")}</p>
        <strong>{formatDate(selectedRow.payment_date)}</strong>
      </div>
      <div>
        <p className="detail-label">{t("transactionTable.colDocuments")}</p>
        {getTransactionDocuments(selectedRow, t).length ? (
          <div className="transaction-document-list">
            {getTransactionDocuments(selectedRow, t).map((document) => (
              <a key={document.id} href={document.url} target="_blank" rel="noreferrer">
                {document.name || getDocumentName(document.url, t)}
              </a>
            ))}
          </div>
        ) : (
          <strong>—</strong>
        )}
      </div>
      {type === "purchase" ? (
        <div className="purchase-tax-invoice-field">
          <p className="detail-label">{t("transactionTable.supplierTaxInvoice")}</p>
          <input
            className="purchase-tax-invoice-input"
            type="text"
            value={selectedRow.supplier_tax_invoice || ""}
            onChange={(event) => onPurchaseTaxInvoiceChange(event.target.value)}
            placeholder={t("transactionTable.enterSupplierTaxInvoice")}
          />
        </div>
      ) : null}
      {type === "sale" ? (
        <div className="purchase-tax-invoice-field">
          <p className="detail-label">{t("transactionTable.customerPOReference")}</p>
          <input
            className="purchase-tax-invoice-input"
            type="text"
            value={selectedRow.customer_po_reference || ""}
            onChange={(event) => onSaleCustomerPoReferenceChange(event.target.value)}
            placeholder={t("transactionTable.enterCustomerPOReference")}
          />
        </div>
      ) : null}
      {type === "purchase" ? (
        <>
          {renderRefCell({
            label: t("transactionTable.sourceQuotation"),
            docType: "quotation",
            links: selectedRow.source_quotation_id
              ? [
                  {
                    id: selectedRow.source_quotation_id,
                    reference_no: selectedRow.source_quotation_reference_no,
                  },
                ]
              : [],
            onOpenDocRef,
          })}
          {renderRefCell({
            label: t("transactionTable.paymentBatch"),
            docType: "payment-batch",
            links: selectedRow.payment_batch_links,
            onOpenDocRef,
          })}
        </>
      ) : null}
      {type === "sale" ? (
        <>
          {renderRefCell({
            label: t("transactionTable.sourceQuotation"),
            docType: "quotation",
            links: selectedRow.source_quotation_id
              ? [
                  {
                    id: selectedRow.source_quotation_id,
                    reference_no: selectedRow.source_quotation_reference_no,
                  },
                ]
              : [],
            onOpenDocRef,
          })}
          {renderRefCell({
            label: t("transactionTable.billingNotes"),
            docType: "billing-note",
            links: selectedRow.billing_note_links,
            onOpenDocRef,
          })}
          {renderRefCell({
            label: t("transactionTable.creditNotes"),
            docType: "credit-note",
            links: selectedRow.credit_note_links,
            onOpenDocRef,
          })}
        </>
      ) : null}
      <div className="full-width">
        <p className="detail-label">{t("transactionTable.notes")}</p>
        <strong>{selectedRow.note || "—"}</strong>
      </div>
    </div>
  );
}

export default TransactionDetailFields;
