import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { customerBillingNoteOptions } from "./creditNoteUtils";

function createForm(creditNote) {
  return {
    reference_no: creditNote.reference_no || "",
    credit_note_date: creditNote.credit_note_date || "",
    billing_note: creditNote.billing_note || "",
    status: creditNote.status || "issued",
    note: creditNote.note || "",
  };
}

function useCreditNoteEditFormState({ creditNote, billingNotes = [], onSave }) {
  const { t } = useLanguage();
  const [form, setForm] = useState(() => createForm(creditNote));
  const [isDirty, setIsDirty] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    setForm(createForm(creditNote));
    setIsDirty(false);
  }, [creditNote]);

  useEffect(() => {
    if (!saveSuccess) return;
    const timer = setTimeout(() => setSaveSuccess(false), 2500);
    return () => clearTimeout(timer);
  }, [saveSuccess]);

  const billingNoteOptions = useMemo(
    () =>
      customerBillingNoteOptions(
        billingNotes,
        creditNote.customer_name,
        form.billing_note || ""
      ),
    [billingNotes, creditNote.customer_name, form.billing_note]
  );

  function updateField(key, value) {
    setIsDirty(true);
    setSaveSuccess(false);
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const next = {
      ...creditNote,
      reference_no: form.reference_no,
      credit_note_date: form.credit_note_date,
      billing_note: form.billing_note || null,
      status: form.status,
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
    billingNoteOptions,
    updateField,
    handleSubmit,
    t,
  };
}

export default useCreditNoteEditFormState;
