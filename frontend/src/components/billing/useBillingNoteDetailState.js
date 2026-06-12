import { useEffect, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import {
  toggleLineReceivedTransform,
  updateLineReceivedDateTransform,
  markAllReceivedTransform,
  clearAllReceivedTransform,
  computeCreditSummary,
} from "./billingNoteDetailHelpers";

function useBillingNoteDetailState({ billingNote, onSave, onDelete }) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState(billingNote);
  const [docRefModal, setDocRefModal] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  function markDirty() {
    setIsDirty(true);
    setSaveSuccess(false);
  }

  useEffect(() => {
    setDraft(billingNote);
    setIsDirty(false);
  }, [billingNote]);

  useEffect(() => {
    if (!saveSuccess) return;
    const timer = setTimeout(() => setSaveSuccess(false), 2500);
    return () => clearTimeout(timer);
  }, [saveSuccess]);

  function updateField(key, value) {
    markDirty();
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function toggleLineReceived(lineId) {
    markDirty();
    setDraft((current) => toggleLineReceivedTransform(current, lineId));
  }

  function updateLineReceivedDate(lineId, value) {
    markDirty();
    setDraft((current) => updateLineReceivedDateTransform(current, lineId, value));
  }

  function markAllReceived() {
    markDirty();
    setDraft((current) => markAllReceivedTransform(current));
  }

  function clearAllReceived() {
    markDirty();
    setDraft((current) => clearAllReceivedTransform(current));
  }

  async function handleSave(event) {
    event.preventDefault();
    setIsSubmitting(true);
    const saved = await onSave?.(draft);
    setIsSubmitting(false);
    if (saved === false) return;
    setIsDirty(false);
    setSaveSuccess(true);
  }

  function handleCancelBillingNote() {
    if (window.confirm(t("billingNote.cancelBNConfirm"))) {
      onSave?.({ ...draft, status: "cancelled" });
    }
  }

  function handleDelete() {
    onDelete(draft);
  }

  const isCancelled = draft.status === "cancelled";
  const { creditTotal, netPayable } = computeCreditSummary(draft);

  return {
    draft,
    docRefModal,
    setDocRefModal,
    isCancelled,
    creditTotal,
    netPayable,
    isDirty,
    isSubmitting,
    saveSuccess,
    updateField,
    toggleLineReceived,
    updateLineReceivedDate,
    markAllReceived,
    clearAllReceived,
    handleSave,
    handleCancelBillingNote,
    handleDelete,
  };
}

export default useBillingNoteDetailState;
