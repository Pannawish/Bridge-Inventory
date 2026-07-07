// React component for payment batch: payment batch edit form.

import usePaymentBatchEditFormState from "./usePaymentBatchEditFormState";

function PaymentBatchEditForm({ paymentBatch, onCancel, onSave }) {
  const { form, isDirty, isSubmitting, updateField, handleSubmit, t } =
    usePaymentBatchEditFormState({ paymentBatch, onSave });

  return (
    <section className="section-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("paymentBatch.editEyebrow")}</p>
          <h3>{t("paymentBatch.editTitle")}</h3>
        </div>
        <button className="secondary-button table-action-button" type="button" onClick={onCancel}>
          {t("common.cancel")}
        </button>
      </div>

      <form className="form-layout" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label>
            {t("paymentBatch.referenceNo")}
            <input
              value={form.reference_no}
              onChange={(event) => updateField("reference_no", event.target.value)}
            />
          </label>

          <label>
            {t("paymentBatch.supplierLabel")}
            <input value={paymentBatch.supplier_name || ""} disabled />
          </label>

          <label>
            {t("paymentBatch.batchDate")}
            <input
              type="date"
              value={form.batch_date}
              onChange={(event) => updateField("batch_date", event.target.value)}
            />
          </label>

          <label>
            {t("paymentBatch.plannedPaymentDate")}
            <input
              type="date"
              value={form.planned_payment_date}
              onChange={(event) => updateField("planned_payment_date", event.target.value)}
            />
          </label>

          <label>
            {t("paymentBatch.bankReference")}
            <input
              value={form.bank_reference}
              onChange={(event) => updateField("bank_reference", event.target.value)}
            />
          </label>

          <label className="full-width">
            {t("paymentBatch.noteLabel")}
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

export default PaymentBatchEditForm;
