// React hook for payment batch state and actions.

import { useEffect, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";

function createForm(paymentBatch) {
  return {
    reference_no: paymentBatch.reference_no || "",
    batch_date: paymentBatch.batch_date || "",
    planned_payment_date: paymentBatch.planned_payment_date || "",
    bank_reference: paymentBatch.bank_reference || "",
    note: paymentBatch.note || "",
  };
}

function usePaymentBatchEditFormState({ paymentBatch, onSave }) {
  const { t } = useLanguage();
  const [form, setForm] = useState(() => createForm(paymentBatch));
  const [isDirty, setIsDirty] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    setForm(createForm(paymentBatch));
    setIsDirty(false);
  }, [paymentBatch]);

  useEffect(() => {
    if (!saveSuccess) return;
    const timer = setTimeout(() => setSaveSuccess(false), 2500);
    return () => clearTimeout(timer);
  }, [saveSuccess]);

  function updateField(key, value) {
    setIsDirty(true);
    setSaveSuccess(false);
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const next = {
      ...paymentBatch,
      reference_no: form.reference_no,
      batch_date: form.batch_date,
      planned_payment_date: form.planned_payment_date,
      bank_reference: form.bank_reference,
      note: form.note,
    };
    setIsSubmitting(true);
    const saved = await onSave?.(next);
    setIsSubmitting(false);
    if (saved === false) return;
    setIsDirty(false);
    setSaveSuccess(true);
  }

  return {
    form,
    isDirty,
    isSubmitting,
    saveSuccess,
    updateField,
    handleSubmit,
    t,
  };
}

export default usePaymentBatchEditFormState;
