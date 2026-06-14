import { formatDate, formatMoney as fmt } from "../../format";
import { useLanguage } from "../../i18n/LanguageContext";
import DocumentRefChip from "../DocumentRefChip";
import DocumentRefModal from "../DocumentRefModal";
import PaymentLineAmount from "../PaymentLineAmount";
import { printTransactionDocument } from "../documentRefs/printTransactionDocument";
import PaymentBatchStatusPill from "./PaymentBatchStatusPill";
import usePaymentBatchDetailState from "./usePaymentBatchDetailState";

function PaymentBatchDetailModal({
  paymentBatch,
  onClose,
  onEdit,
  onSave,
  onDelete,
}) {
  const { t } = useLanguage();
  const {
    draft,
    docRefModal,
    setDocRefModal,
    isCancelled,
    isDirty,
    isSubmitting,
    toggleLinePaid,
    updateLinePaidDate,
    markAllPaid,
    clearAllPaid,
    handleSave,
    handleCancelBatch,
    handleDelete,
  } = usePaymentBatchDetailState({ paymentBatch, onSave, onDelete });

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="detail-modal transaction-detail-modal section-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pb-detail-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("paymentBatch.eyebrow")}</p>
            <h3 id="pb-detail-title">{draft.reference_no || draft.id}</h3>
          </div>
          <div className="transaction-detail-actions">
            {onEdit ? (
              <button
                type="button"
                className="edit-button table-action-button"
                onClick={() => {
                  onEdit(paymentBatch);
                  onClose();
                }}
              >
                {t("common.edit")}
              </button>
            ) : null}
            {!isCancelled ? (
              <button
                type="button"
                className="primary-button table-action-button transaction-save-button"
                onClick={() => handleSave()}
                disabled={!isDirty || isSubmitting}
              >
                {isSubmitting ? t("common.saving") : t("paymentBatch.saveLines")}
              </button>
            ) : null}
            <button
              type="button"
              className="secondary-button table-action-button"
              onClick={() =>
                printTransactionDocument({
                  docType: "payment-batch",
                  doc: draft,
                  referenceNo: draft.reference_no,
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
            <p className="detail-label">{t("paymentBatch.supplierLabel")}</p>
            <strong>{draft.supplier_name || "—"}</strong>
          </div>
          <div>
            <p className="detail-label">{t("paymentBatch.colStatus")}</p>
            <strong>
              <PaymentBatchStatusPill status={draft.status} />
            </strong>
          </div>
          <div>
            <p className="detail-label">{t("paymentBatch.batchDate")}</p>
            <strong>{formatDate(draft.batch_date)}</strong>
          </div>
          <div>
            <p className="detail-label">{t("paymentBatch.plannedPaymentDate")}</p>
            <strong>{formatDate(draft.planned_payment_date)}</strong>
          </div>
          <div>
            <p className="detail-label">{t("paymentBatch.actualPaymentDate")}</p>
            <strong>{formatDate(draft.actual_payment_date)}</strong>
          </div>
          <div>
            <p className="detail-label">{t("paymentBatch.bankReference")}</p>
            <strong>{draft.bank_reference || "—"}</strong>
          </div>
          <div className="full-width">
            <p className="detail-label">{t("paymentBatch.noteLabel")}</p>
            <strong>{draft.note || "—"}</strong>
          </div>
        </div>

        <div className="line-items-header">
          <div>
            <p className="eyebrow">{t("paymentBatch.purchaseOrdersEyebrow")}</p>
            <h4>{t("paymentBatch.markAsPaid")}</h4>
          </div>
          <span>
            {t("paymentBatch.paidFraction", {
              paid: (draft.lines || []).filter((line) => line.paid).length,
              total: (draft.lines || []).length,
            })}
          </span>
        </div>

        {!isCancelled && (draft.lines || []).length > 0 ? (
          <div className="history-filter-actions">
            <button
              type="button"
              className="secondary-button table-action-button"
              onClick={markAllPaid}
            >
              {t("paymentBatch.markAllPaid")}
            </button>
            <button
              type="button"
              className="secondary-button table-action-button"
              onClick={clearAllPaid}
            >
              {t("paymentBatch.clearAll")}
            </button>
          </div>
        ) : null}

        <div className="transaction-table-window">
          <div className="table-scroll partner-line-scroll desktop-table">
            <table className="transaction-history-table partner-line-table">
              <thead>
                <tr>
                  <th>{t("paymentBatch.colPaid")}</th>
                  <th>{t("paymentBatch.colReference")}</th>
                  <th>{t("paymentBatch.colPODate")}</th>
                  <th>{t("paymentBatch.colPaymentTerm")}</th>
                  <th>{t("paymentBatch.colPaymentDue")}</th>
                  <th>{t("paymentBatch.colPaidDate")}</th>
                  <th>{t("paymentBatch.colAmount")}</th>
                </tr>
              </thead>
              <tbody>
                {(draft.lines || []).map((line) => (
                  <tr
                    key={line.id}
                    className={line.paid ? "partner-table-row active" : "partner-table-row"}
                  >
                    <td>
                      <input
                        type="checkbox"
                        checked={line.paid}
                        disabled={isCancelled}
                        onChange={() => toggleLinePaid(line.id)}
                      />
                    </td>
                    <td>
                      <DocumentRefChip
                        label={
                          line.purchase_reference_no || line.purchase_id || line.purchase
                        }
                        docType="purchase"
                        onClick={() =>
                          setDocRefModal({
                            docType: "purchase",
                            docId: line.purchase_id || line.purchase,
                            referenceNo:
                              line.purchase_reference_no ||
                              line.purchase_id ||
                              line.purchase,
                          })
                        }
                      />
                    </td>
                    <td>{formatDate(line.purchase_transaction_date)}</td>
                    <td>
                      {line.purchase_payment_term_type === "credit"
                        ? t("paymentBatch.paymentCreditTerm", {
                            days: line.purchase_payment_term_days || "",
                          })
                        : line.purchase_payment_term_type === "cash"
                          ? t("paymentBatch.paymentDebitTerm")
                          : "—"}
                    </td>
                    <td>{formatDate(line.purchase_payment_date)}</td>
                    <td>
                      {line.paid ? (
                        <input
                          type="date"
                          value={line.paid_date || ""}
                          onChange={(event) =>
                            updateLinePaidDate(line.id, event.target.value)
                          }
                          disabled={isCancelled}
                        />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <PaymentLineAmount line={line} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="6" style={{ textAlign: "right" }}>
                    <strong>{t("paymentBatch.colTotal")}</strong>
                  </td>
                  <td>
                    <strong>{fmt(draft.total_amount)}</strong>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="transaction-detail-footer">
          <button type="button" className="danger-button" onClick={handleDelete}>
            {t("common.delete")}
          </button>
          {!isCancelled ? (
            <button
              type="button"
              className="secondary-button"
              onClick={handleCancelBatch}
            >
              {t("paymentBatch.cancelBatch")}
            </button>
          ) : null}
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

export default PaymentBatchDetailModal;
