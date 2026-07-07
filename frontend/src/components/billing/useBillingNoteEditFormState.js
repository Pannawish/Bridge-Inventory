// React hook for billing note state and actions.

import { useEffect, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";

function createForm(billingNote) {
  return {
    reference_no: billingNote.reference_no || "",
    billing_note_date: billingNote.billing_note_date || "",
    expected_payment_date: billingNote.expected_payment_date || "",
    bank_reference: billingNote.bank_reference || "",
    note: billingNote.note || "",
  };
}

function useBillingNoteEditFormState({ billingNote, onSave }) {
  const { t } = useLanguage();
  const [form, setForm] = useState(() => createForm(billingNote));
  const [isDirty, setIsDirty] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    setForm(createForm(billingNote));
    setIsDirty(false);
  }, [billingNote]);

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
      ...billingNote,
      reference_no: form.reference_no,
      billing_note_date: form.billing_note_date,
      expected_payment_date: form.expected_payment_date,
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

export default useBillingNoteEditFormState;
