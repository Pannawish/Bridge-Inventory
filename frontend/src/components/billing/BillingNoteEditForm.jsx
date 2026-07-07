// React component for billing note: billing note edit form.

import useBillingNoteEditFormState from "./useBillingNoteEditFormState";

function BillingNoteEditForm({ billingNote, onCancel, onSave }) {
  const { form, isDirty, isSubmitting, updateField, handleSubmit, t } =
    useBillingNoteEditFormState({ billingNote, onSave });

  return (
    <section className="section-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("billingNote.editEyebrow")}</p>
          <h3>{t("billingNote.editTitle")}</h3>
        </div>
        <button className="secondary-button table-action-button" type="button" onClick={onCancel}>
          {t("common.cancel")}
        </button>
      </div>

      <form className="form-layout" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label>
            {t("billingNote.referenceNo")}
            <input
              value={form.reference_no}
              onChange={(event) => updateField("reference_no", event.target.value)}
            />
          </label>

          <label>
            {t("billingNote.customerLabel")}
            <input value={billingNote.customer_name || ""} disabled />
          </label>

          <label>
            {t("billingNote.dateLabel")}
            <input
              type="date"
              value={form.billing_note_date}
              onChange={(event) => updateField("billing_note_date", event.target.value)}
            />
          </label>

          <label>
            {t("billingNote.expectedPaymentDate")}
            <input
              type="date"
              value={form.expected_payment_date}
              onChange={(event) => updateField("expected_payment_date", event.target.value)}
            />
          </label>

          <label>
            {t("billingNote.bankReference")}
            <input
              value={form.bank_reference}
              onChange={(event) => updateField("bank_reference", event.target.value)}
            />
          </label>

          <label className="full-width">
            {t("billingNote.noteLabel")}
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
    </section>
  );
}

export default BillingNoteEditForm;
