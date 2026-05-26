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

  useEffect(() => {
    setDraft(billingNote);
  }, [billingNote]);

  function updateField(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function toggleLineReceived(lineId) {
    setDraft((current) => toggleLineReceivedTransform(current, lineId));
  }

  function updateLineReceivedDate(lineId, value) {
    setDraft((current) => updateLineReceivedDateTransform(current, lineId, value));
  }

  function markAllReceived() {
    setDraft((current) => markAllReceivedTransform(current));
  }

  function clearAllReceived() {
    setDraft((current) => clearAllReceivedTransform(current));
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
