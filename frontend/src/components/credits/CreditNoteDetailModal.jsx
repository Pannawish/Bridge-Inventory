import { useState } from "react";
import { formatDate, formatMoney as fmt } from "../../format";
import { useLanguage } from "../../i18n/LanguageContext";
import DocumentRefChip from "../DocumentRefChip";
import DocumentRefModal from "../DocumentRefModal";
import { printTransactionDocument } from "../documentRefs/printTransactionDocument";
import CreditNoteStatusPill from "./CreditNoteStatusPill";

function CreditNoteDetailModal({ creditNote, onClose, onEdit, onLinkBillingNote, onDelete }) {
  const { t } = useLanguage();
  const [docRefModal, setDocRefModal] = useState(null);

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="detail-modal transaction-detail-modal section-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cn-detail-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("creditNote.eyebrow")}</p>
            <h3 id="cn-detail-title">{creditNote.reference_no || creditNote.id}</h3>
          </div>
          <div className="transaction-detail-actions">
            {onEdit ? (
              <button
                type="button"
                className="edit-button table-action-button"
                onClick={() => {
                  onEdit(creditNote);
                  onClose();
                }}
              >
                {t("common.edit")}
              </button>
            ) : null}
            {creditNote.status !== "cancelled" ? (
              <button
                type="button"
                className="secondary-button table-action-button"
                onClick={() => {
                  onLinkBillingNote?.(creditNote);
                  onClose();
                }}
              >
                {t("creditNote.linkBillingNoteAction")}
              </button>
            ) : null}
            <button
              type="button"
              className="secondary-button table-action-button"
              onClick={() =>
                printTransactionDocument({
                  docType: "credit-note",
                  doc: creditNote,
                  referenceNo: creditNote.reference_no,
                  t,
                })
              }
            >
              {t("common.print")}
            </button>
            <button
              type="button"
              className="secondary-button table-action-button"
              onClick={onClose}
            >
              {t("common.close")}
            </button>
          </div>
        </div>

        <div className="detail-grid">
          <div>
            <p className="detail-label">{t("creditNote.customerLabel")}</p>
            <strong>{creditNote.customer_name || "—"}</strong>
          </div>
          <div>
            <p className="detail-label">{t("creditNote.colStatus")}</p>
            <strong>
              <CreditNoteStatusPill status={creditNote.status} />
            </strong>
          </div>
          <div>
            <p className="detail-label">{t("creditNote.creditNoteDateLabel")}</p>
            <strong>{formatDate(creditNote.credit_note_date)}</strong>
          </div>
          <div>
            <p className="detail-label">{t("creditNote.sourceSale")}</p>
            {creditNote.sale ? (
              <div className="doc-ref-chips">
                <DocumentRefChip
                  label={creditNote.sale_reference_no || creditNote.sale}
                  docType="sale"
                  onClick={() =>
                    setDocRefModal({
                      docType: "sale",
                      docId: creditNote.sale,
                      referenceNo: creditNote.sale_reference_no || creditNote.sale,
                    })
                  }
                />
              </div>
            ) : (
              <strong>—</strong>
            )}
          </div>
          <div>
            <p className="detail-label">{t("creditNote.appliedBillingNote")}</p>
            {creditNote.billing_note ? (
              <div className="doc-ref-chips">
                <DocumentRefChip
                  label={creditNote.billing_note_reference_no || creditNote.billing_note}
                  docType="billing-note"
                  onClick={() =>
                    setDocRefModal({
                      docType: "billing-note",
                      docId: creditNote.billing_note,
                      referenceNo:
                        creditNote.billing_note_reference_no || creditNote.billing_note,
                    })
                  }
                />
              </div>
            ) : (
              <strong>{t("creditNote.notApplied")}</strong>
            )}
          </div>
          <div className="full-width">
            <p className="detail-label">{t("creditNote.noteLabel")}</p>
            <strong>{creditNote.note || "—"}</strong>
          </div>
        </div>

        <div className="line-items-header">
          <div>
            <p className="eyebrow">{t("creditNote.linesDetailEyebrow")}</p>
            <h4>{t("creditNote.linesDetailTitle")}</h4>
          </div>
          <span>
            {t("creditNote.linesItemCount", { count: (creditNote.lines || []).length })}
          </span>
        </div>

        <div className="transaction-table-window">
          <div className="table-scroll partner-line-scroll desktop-table">
            <table className="transaction-history-table partner-line-table">
              <thead>
                <tr>
                  <th>{t("creditNote.colProduct")}</th>
                  <th>{t("creditNote.colSKU")}</th>
                  <th>{t("creditNote.colQuantity")}</th>
                  <th>{t("creditNote.colUnitPrice")}</th>
                  <th>{t("creditNote.colAmount")}</th>
                </tr>
              </thead>
              <tbody>
                {(creditNote.lines || []).map((line) => (
                  <tr key={line.id} className="partner-table-row">
                    <td>{line.product_name}</td>
                    <td>{line.sku || "—"}</td>
                    <td>{line.quantity}</td>
                    <td>{fmt(line.unit_price)}</td>
                    <td>{fmt(line.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="4" style={{ textAlign: "right" }}>{t("creditNote.subtotal")}</td>
                  <td>{fmt(creditNote.total_before_vat)}</td>
                </tr>
                {Number(creditNote.vat_amount) > 0 ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: "right" }}>{t("creditNote.vat")}</td>
                    <td>{fmt(creditNote.vat_amount)}</td>
                  </tr>
                ) : null}
                <tr>
                  <td colSpan="4" style={{ textAlign: "right" }}>
                    <strong>{t("creditNote.totalCredit")}</strong>
                  </td>
                  <td>
                    <strong>{fmt(creditNote.total_amount)}</strong>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="transaction-detail-footer">
          <button
            type="button"
            className="danger-button"
            onClick={() => onDelete(creditNote)}
          >
            {t("common.delete")}
          </button>
        </div>
      </div>

      {docRefModal ? (
        <DocumentRefModal
          docType={docRefModal.docType}
          docId={docRefModal.docId}
          referenceNo={docRefModal.referenceNo}
          onClose={() => setDocRefModal(null)}
        />
      ) : null}
    </div>
  );
}

export default CreditNoteDetailModal;
