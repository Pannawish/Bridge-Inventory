// React component for credit note: credit note edit form.

import { useState } from "react";
import { formatMoney as fmt } from "../../format";
import DocumentRefChip from "../DocumentRefChip";
import DocumentRefModal from "../DocumentRefModal";
import { CREDIT_NOTE_STATUS_LABEL_KEYS } from "./creditNoteUtils";
import useCreditNoteEditFormState from "./useCreditNoteEditFormState";

function CreditNoteEditForm({ creditNote, billingNotes = [], onCancel, onSave }) {
  const {
    form,
    isDirty,
    isSubmitting,
    billingNoteOptions,
    updateField,
    handleSubmit,
    t,
  } = useCreditNoteEditFormState({ creditNote, billingNotes, onSave });
  const [docRefModal, setDocRefModal] = useState(null);

  return (
    <section className="section-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("creditNote.editEyebrow")}</p>
          <h3>{t("creditNote.editTitle")}</h3>
        </div>
        <button className="secondary-button table-action-button" type="button" onClick={onCancel}>
          {t("common.cancel")}
        </button>
      </div>

      <form className="form-layout" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label>
            {t("creditNote.referenceNo")}
            <input
              value={form.reference_no}
              onChange={(event) => updateField("reference_no", event.target.value)}
            />
          </label>

          <label>
            {t("creditNote.customerLabel")}
            <input value={creditNote.customer_name || ""} disabled />
          </label>

          <label>
            {t("creditNote.sourceSale")}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                value={creditNote.sale_reference_no || creditNote.sale || ""}
                disabled
                style={{ flex: 1 }}
              />
              {creditNote.sale ? (
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
              ) : null}
            </div>
          </label>

          <label>
            {t("creditNote.creditNoteDateLabel")}
            <input
              type="date"
              value={form.credit_note_date}
              onChange={(event) => updateField("credit_note_date", event.target.value)}
            />
          </label>

          <label>
            {t("creditNote.appliedBillingNote")}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <select
                value={form.billing_note || ""}
                onChange={(event) => updateField("billing_note", event.target.value || null)}
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
              {form.billing_note ? (
                <DocumentRefChip
                  label={creditNote.billing_note_reference_no || form.billing_note}
                  docType="billing-note"
                  onClick={() =>
                    setDocRefModal({
                      docType: "billing-note",
                      docId: form.billing_note,
                      referenceNo:
                        creditNote.billing_note_reference_no || form.billing_note,
                    })
                  }
                />
              ) : null}
            </div>
            {billingNoteOptions.length === 0 && !form.billing_note ? (
              <span className="field-helper-text">
                {t("creditNote.noAvailableBillingNotes")}
              </span>
            ) : null}
          </label>

          <label>
            {t("common.status")}
            <select
              value={form.status || "issued"}
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
              value={form.note}
              onChange={(event) => updateField("note", event.target.value)}
            />
          </label>
        </div>

        <div className="supplier-modal-actions">
          <button className="secondary-button" type="button" onClick={onCancel}>
            {t("common.cancel")}
          </button>
          <button className="primary-button" type="submit" disabled={!isDirty || isSubmitting}>
            {isSubmitting ? t("common.saving") : t("common.save")}
          </button>
        </div>
      </form>

      {docRefModal ? (
        <DocumentRefModal
          docType={docRefModal.docType}
          docId={docRefModal.docId}
          referenceNo={docRefModal.referenceNo}
          onClose={() => setDocRefModal(null)}
        />
      ) : null}
    </section>
  );
}

export default CreditNoteEditForm;
