// React hook for billing note state and actions.

import { useEffect, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { deepEqual } from "../../equality";
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setDraft(billingNote);
  }, [billingNote]);

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

  async function handleSave(event) {
    event?.preventDefault();
    setIsSubmitting(true);
    await onSave?.(draft);
    setIsSubmitting(false);
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
  // Derived: Save is only "dirty" while the working draft differs from the
  // billing note as last loaded/saved. Reverting line changes turns Save off.
  const isDirty = !deepEqual(draft, billingNote);
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
