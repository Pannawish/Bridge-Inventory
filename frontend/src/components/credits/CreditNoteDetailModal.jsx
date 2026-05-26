import { useEffect, useMemo, useState } from "react";
import { formatMoney as fmt } from "../../format";
import { useLanguage } from "../../i18n/LanguageContext";
import DocumentRefChip from "../DocumentRefChip";
import DocumentRefModal from "../DocumentRefModal";
import CreditNoteStatusPill from "./CreditNoteStatusPill";
import {
  CREDIT_NOTE_STATUS_LABEL_KEYS,
  customerBillingNoteOptions,
} from "./creditNoteUtils";

function CreditNoteDetailModal({
  creditNote,
  billingNotes,
  onClose,
  onSave,
  onDelete,
}) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState(creditNote);
  const [docRefModal, setDocRefModal] = useState(null);

  useEffect(() => {
    setDraft(creditNote);
  }, [creditNote]);

  function updateField(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  const billingNoteOptions = useMemo(
    () =>
      customerBillingNoteOptions(
        billingNotes,
        draft.customer_name,
        draft.billing_note || ""
      ),
    [billingNotes, draft.customer_name, draft.billing_note]
  );

  function handleSave(event) {
    event.preventDefault();
    onSave(draft);
  }

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
            <h3 id="cn-detail-title">{draft.reference_no || draft.id}</h3>
          </div>
          <div className="section-heading-actions">
            <CreditNoteStatusPill status={draft.status} />
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
              {t("creditNote.referenceNo")}
              <input
                value={draft.reference_no || ""}
                onChange={(event) => updateField("reference_no", event.target.value)}
              />
            </label>

            <label>
              {t("creditNote.customerLabel")}
              <input value={draft.customer_name || ""} disabled />
            </label>

            <label>
              {t("creditNote.sourceSale")}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  value={draft.sale_reference_no || draft.sale || ""}
                  disabled
                  style={{ flex: 1 }}
                />
                {draft.sale ? (
                  <DocumentRefChip
                    label={draft.sale_reference_no || draft.sale}
                    docType="sale"
                    onClick={() =>
                      setDocRefModal({
                        docType: "sale",
                        docId: draft.sale,
                        referenceNo: draft.sale_reference_no || draft.sale,
                      })
                    }
                  />
                ) : null}
              </div>
            </label>

            <label>
              {t("creditNote.creditNoteDateLabel")}
              <input
                type="date"
                value={draft.credit_note_date || ""}
                onChange={(event) => updateField("credit_note_date", event.target.value)}
              />
            </label>

            <label>
              {t("creditNote.appliedBillingNote")}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <select
                  value={draft.billing_note || ""}
                  onChange={(event) =>
                    updateField("billing_note", event.target.value || null)
                  }
                  style={{ flex: 1 }}
                >
                  <option value="">{t("creditNote.notApplied")}</option>
                  {billingNoteOptions.map((billingNote) => (
                    <option key={billingNote.id} value={billingNote.id}>
                      {(billingNote.reference_no || billingNote.id) +
                        ` — ${fmt(billingNote.total_amount)}`}
                    </option>
                  ))}
                </select>
                {draft.billing_note ? (
                  <DocumentRefChip
                    label={draft.billing_note_reference_no || draft.billing_note}
                    docType="billing-note"
                    onClick={() =>
                      setDocRefModal({
                        docType: "billing-note",
                        docId: draft.billing_note,
                        referenceNo:
                          draft.billing_note_reference_no || draft.billing_note,
                      })
                    }
                  />
                ) : null}
              </div>
            </label>

            <label>
              {t("common.status")}
              <select
                value={draft.status || "issued"}
                onChange={(event) => updateField("status", event.target.value)}
              >
                {Object.entries(CREDIT_NOTE_STATUS_LABEL_KEYS).map(([value, key]) => (
                  <option key={value} value={value}>
                    {t(key)}
                  </option>
                ))}
              </select>
            </label>

            <label className="full-width">
              {t("creditNote.noteLabel")}
              <textarea
                rows="2"
                value={draft.note || ""}
                onChange={(event) => updateField("note", event.target.value)}
              />
            </label>
          </div>

          <div className="line-items-header">
            <div>
              <p className="eyebrow">{t("creditNote.linesDetailEyebrow")}</p>
              <h4>{t("creditNote.linesDetailTitle")}</h4>
            </div>
            <span>
              {t("creditNote.linesItemCount", { count: (draft.lines || []).length })}
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
                  {(draft.lines || []).map((line) => (
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
                    <td colSpan="4" style={{ textAlign: "right" }}>
                      <strong>{t("creditNote.totalCredit")}</strong>
                    </td>
                    <td>
                      <strong>{fmt(draft.total_amount)}</strong>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="supplier-modal-actions">
            <button
              type="button"
              className="danger-button"
              onClick={() => onDelete(draft)}
            >
              {t("common.delete")}
            </button>
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

export default CreditNoteDetailModal;
