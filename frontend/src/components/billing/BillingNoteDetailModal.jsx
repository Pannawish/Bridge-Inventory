import { formatDate, formatMoney as fmt } from "../../format";
import { useLanguage } from "../../i18n/LanguageContext";
import DocumentRefChip from "../DocumentRefChip";
import DocumentRefModal from "../DocumentRefModal";
import { printTransactionDocument } from "../documentRefs/printTransactionDocument";
import BillingNoteStatusPill from "./BillingNoteStatusPill";
import useBillingNoteDetailState from "./useBillingNoteDetailState";

function BillingNoteDetailModal({
  billingNote,
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
    creditTotal,
    netPayable,
    isDirty,
    isSubmitting,
    toggleLineReceived,
    updateLineReceivedDate,
    markAllReceived,
    clearAllReceived,
    handleSave,
    handleCancelBillingNote,
    handleDelete,
  } = useBillingNoteDetailState({ billingNote, onSave, onDelete });

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="detail-modal transaction-detail-modal section-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bn-detail-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("billingNote.eyebrow")}</p>
            <h3 id="bn-detail-title">{draft.reference_no || draft.id}</h3>
          </div>
          <div className="transaction-detail-actions">
            {onEdit ? (
              <button
                type="button"
                className="edit-button table-action-button"
                onClick={() => {
                  onEdit(billingNote);
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
                {isSubmitting ? t("common.saving") : t("billingNote.saveLines")}
              </button>
            ) : null}
            <button
              type="button"
              className="secondary-button table-action-button"
              onClick={() =>
                printTransactionDocument({
                  docType: "billing-note",
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
            <p className="detail-label">{t("billingNote.customerLabel")}</p>
            <strong>{draft.customer_name || "—"}</strong>
          </div>
          <div>
            <p className="detail-label">{t("billingNote.colStatus")}</p>
            <strong>
              <BillingNoteStatusPill status={draft.status} />
            </strong>
          </div>
          <div>
            <p className="detail-label">{t("billingNote.dateLabel")}</p>
            <strong>{formatDate(draft.billing_note_date)}</strong>
          </div>
          <div>
            <p className="detail-label">{t("billingNote.expectedPaymentDate")}</p>
            <strong>{formatDate(draft.expected_payment_date)}</strong>
          </div>
          <div>
            <p className="detail-label">{t("billingNote.actualPaymentDate")}</p>
            <strong>{formatDate(draft.actual_payment_date)}</strong>
          </div>
          <div>
            <p className="detail-label">{t("billingNote.bankReference")}</p>
            <strong>{draft.bank_reference || "—"}</strong>
          </div>
          <div className="full-width">
            <p className="detail-label">{t("billingNote.noteLabel")}</p>
            <strong>{draft.note || "—"}</strong>
          </div>
        </div>

        <div className="line-items-header">
          <div>
            <p className="eyebrow">{t("billingNote.salesOrdersEyebrow")}</p>
            <h4>{t("billingNote.receivePayment")}</h4>
          </div>
          <span>
            {t("billingNote.receivedFraction", {
              received: (draft.lines || []).filter((line) => line.received).length,
              total: (draft.lines || []).length,
            })}
          </span>
        </div>

        {!isCancelled && (draft.lines || []).length > 0 ? (
          <div className="history-filter-actions">
            <button
              type="button"
              className="secondary-button table-action-button"
              onClick={markAllReceived}
            >
              {t("billingNote.markAllReceived")}
            </button>
            <button
              type="button"
              className="secondary-button table-action-button"
              onClick={clearAllReceived}
            >
              {t("billingNote.clearAll")}
            </button>
          </div>
        ) : null}

        <div className="transaction-table-window">
          <div className="table-scroll partner-line-scroll desktop-table">
            <table className="transaction-history-table partner-line-table">
              <thead>
                <tr>
                  <th>{t("billingNote.colReceived")}</th>
                  <th>{t("billingNote.colReference")}</th>
                  <th>{t("billingNote.colSaleDate")}</th>
                  <th>{t("billingNote.colPaymentTerm")}</th>
                  <th>{t("billingNote.colPaymentDue")}</th>
                  <th>{t("billingNote.colPaymentReceivedDate")}</th>
                  <th>{t("billingNote.colAmount")}</th>
                </tr>
              </thead>
              <tbody>
                {(draft.lines || []).map((line) => (
                  <tr
                    key={line.id}
                    className={line.received ? "partner-table-row active" : "partner-table-row"}
                  >
                    <td>
                      <input
                        type="checkbox"
                        checked={line.received}
                        disabled={isCancelled}
                        onChange={() => toggleLineReceived(line.id)}
                      />
                    </td>
                    <td>
                      <DocumentRefChip
                        label={line.sale_reference_no || line.sale_id || line.sale}
                        docType="sale"
                        onClick={() =>
                          setDocRefModal({
                            docType: "sale",
                            docId: line.sale_id || line.sale,
                            referenceNo:
                              line.sale_reference_no || line.sale_id || line.sale,
                          })
                        }
                      />
                    </td>
                    <td>{formatDate(line.sale_transaction_date)}</td>
                    <td>
                      {line.sale_payment_term_type === "credit"
                        ? t("billingNote.paymentCreditTerm", {
                            days: line.sale_payment_term_days || "",
                          })
                        : line.sale_payment_term_type === "cash"
                          ? t("billingNote.paymentDebitTerm")
                          : "—"}
                    </td>
                    <td>{formatDate(line.sale_payment_date)}</td>
                    <td>
                      {line.received ? (
                        <input
                          type="date"
                          value={line.received_date || ""}
                          onChange={(event) =>
                            updateLineReceivedDate(line.id, event.target.value)
                          }
                          disabled={isCancelled}
                        />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{fmt(line.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="6" style={{ textAlign: "right" }}>
                    <strong>{t("billingNote.colTotal")}</strong>
                  </td>
                  <td>
                    <strong>{fmt(draft.total_amount)}</strong>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {(draft.credit_notes || []).length > 0 ? (
          <>
            <div className="line-items-header">
              <div>
                <p className="eyebrow">{t("billingNote.creditNotesEyebrow")}</p>
                <h4>{t("billingNote.appliedCredits")}</h4>
              </div>
              <span>
                {t("billingNote.appliedCount", {
                  count: (draft.credit_notes || []).length,
                })}
              </span>
            </div>

            <div className="transaction-table-window">
              <div className="table-scroll partner-line-scroll desktop-table">
                <table className="transaction-history-table partner-line-table">
                  <thead>
                    <tr>
                      <th>{t("billingNote.colReference")}</th>
                      <th>{t("billingNote.colIssued")}</th>
                      <th>{t("billingNote.colStatus")}</th>
                      <th>{t("billingNote.colAmount")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(draft.credit_notes || []).map((credit) => (
                      <tr key={credit.id} className="partner-table-row">
                        <td>
                          <DocumentRefChip
                            label={credit.reference_no || credit.id}
                            docType="credit-note"
                            onClick={() =>
                              setDocRefModal({
                                docType: "credit-note",
                                docId: credit.id,
                                referenceNo: credit.reference_no || credit.id,
                              })
                            }
                          />
                        </td>
                        <td>{formatDate(credit.credit_note_date)}</td>
                        <td>
                          <BillingNoteStatusPill status={credit.status} />
                        </td>
                        <td>{fmt(credit.total_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="sales-summary-card">
              <div className="sales-summary-row">
                <span>{t("billingNote.totalBilled")}</span>
                <span>{fmt(draft.total_amount)}</span>
              </div>
              <div className="sales-summary-row">
                <span>{t("billingNote.lessCredits")}</span>
                <span>{fmt(creditTotal)}</span>
              </div>
              <div className="sales-summary-row sales-summary-grand">
                <strong>{t("billingNote.netPayable")}</strong>
                <strong>{fmt(netPayable)}</strong>
              </div>
            </div>
          </>
        ) : null}

        <div className="transaction-detail-footer">
          <button type="button" className="danger-button" onClick={handleDelete}>
            {t("common.delete")}
          </button>
          {!isCancelled ? (
            <button
              type="button"
              className="secondary-button"
              onClick={handleCancelBillingNote}
            >
              {t("billingNote.cancelBN")}
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

export default BillingNoteDetailModal;
