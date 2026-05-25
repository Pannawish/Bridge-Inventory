import { useEffect, useState } from "react";
import { formatDate, formatMoney as fmt } from "../../format";
import { useLanguage } from "../../i18n/LanguageContext";
import DocumentRefChip from "../DocumentRefChip";
import DocumentRefModal from "../DocumentRefModal";
import BillingNoteStatusPill from "./BillingNoteStatusPill";
import {
  computeBillingNoteActualPaymentDate,
  computeBillingNoteStatusFromLines,
  getToday,
} from "./billingNoteUtils";

function BillingNoteDetailModal({
  billingNote,
  onClose,
  onSave,
  onDelete,
}) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState(billingNote);
  const [docRefModal, setDocRefModal] = useState(null);

  useEffect(() => {
    setDraft(billingNote);
  }, [billingNote]);

  function updateField(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function toggleLineReceived(lineId) {
    setDraft((current) => {
      const lines = (current.lines || []).map((line) => {
        if (line.id !== lineId) return line;
        const nextReceived = !line.received;
        return {
          ...line,
          received: nextReceived,
          received_date: nextReceived ? line.received_date || getToday() : null,
        };
      });
      return {
        ...current,
        lines,
        status: computeBillingNoteStatusFromLines(lines, current.status),
        actual_payment_date: computeBillingNoteActualPaymentDate(lines),
      };
    });
  }

  function updateLineReceivedDate(lineId, value) {
    setDraft((current) => {
      const lines = (current.lines || []).map((line) =>
        line.id === lineId ? { ...line, received_date: value } : line
      );
      return {
        ...current,
        lines,
        actual_payment_date: computeBillingNoteActualPaymentDate(lines),
      };
    });
  }

  function markAllReceived() {
    setDraft((current) => {
      const today = getToday();
      const lines = (current.lines || []).map((line) => ({
        ...line,
        received: true,
        received_date: line.received_date || today,
      }));
      return {
        ...current,
        lines,
        status: computeBillingNoteStatusFromLines(lines, current.status),
        actual_payment_date: computeBillingNoteActualPaymentDate(lines),
      };
    });
  }

  function clearAllReceived() {
    setDraft((current) => {
      const lines = (current.lines || []).map((line) => ({
        ...line,
        received: false,
        received_date: null,
      }));
      return {
        ...current,
        lines,
        status: computeBillingNoteStatusFromLines(lines, current.status),
        actual_payment_date: null,
      };
    });
  }

  function handleSave(event) {
    event.preventDefault();
    onSave(draft);
  }

  function handleCancelBillingNote() {
    if (window.confirm(t("billingNote.cancelBNConfirm"))) {
      onSave({ ...draft, status: "cancelled" });
    }
  }

  const isCancelled = draft.status === "cancelled";
  const creditTotal = (draft.credit_notes || [])
    .filter((credit) => credit.status !== "cancelled")
    .reduce((acc, credit) => acc + (Number(credit.total_amount) || 0), 0);
  const netPayable = (Number(draft.total_amount) || 0) - creditTotal;

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
          <div className="section-heading-actions">
            <BillingNoteStatusPill status={draft.status} />
            <button
              type="button"
              className="icon-button subtle"
              aria-label={t("common.close")}
              onClick={onClose}
            >
              X
            </button>
          </div>
        </div>

        <form className="form-layout" onSubmit={handleSave}>
          <div className="form-grid">
            <label>
              {t("billingNote.referenceNo")}
              <input
                value={draft.reference_no || ""}
                onChange={(event) => updateField("reference_no", event.target.value)}
              />
            </label>

            <label>
              {t("billingNote.customerLabel")}
              <input value={draft.customer_name || ""} disabled />
            </label>

            <label>
              {t("billingNote.dateLabel")}
              <input
                type="date"
                value={draft.billing_note_date || ""}
                onChange={(event) => updateField("billing_note_date", event.target.value)}
              />
            </label>

            <label>
              {t("billingNote.expectedPaymentDate")}
              <input
                type="date"
                value={draft.expected_payment_date || ""}
                onChange={(event) =>
                  updateField("expected_payment_date", event.target.value)
                }
              />
            </label>

            <label>
              {t("billingNote.actualPaymentDate")}
              <input type="date" value={draft.actual_payment_date || ""} readOnly />
            </label>

            <label>
              {t("billingNote.bankReference")}
              <input
                value={draft.bank_reference || ""}
                onChange={(event) => updateField("bank_reference", event.target.value)}
              />
            </label>

            <label className="full-width">
              {t("billingNote.noteLabel")}
              <textarea
                rows="2"
                value={draft.note || ""}
                onChange={(event) => updateField("note", event.target.value)}
              />
            </label>
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
              <button type="button" className="secondary-button" onClick={markAllReceived}>
                {t("billingNote.markAllReceived")}
              </button>
              <button type="button" className="secondary-button" onClick={clearAllReceived}>
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
                          : line.sale_payment_term_type === "debit"
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

          <div className="supplier-modal-actions">
            <button type="button" className="danger-button" onClick={() => onDelete(draft)}>
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
            <button type="button" className="secondary-button" onClick={onClose}>
              {t("common.close")}
            </button>
            <button type="submit" className="primary-button">
              {t("common.save")}
            </button>
          </div>
        </form>
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
