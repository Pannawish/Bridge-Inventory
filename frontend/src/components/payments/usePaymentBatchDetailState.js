import { useEffect, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { deepEqual } from "../../equality";
import {
  toggleLinePaidTransform,
  updateLinePaidDateTransform,
  markAllPaidTransform,
  clearAllPaidTransform,
} from "./paymentBatchDetailHelpers";

function usePaymentBatchDetailState({ paymentBatch, onSave, onDelete }) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState(paymentBatch);
  const [docRefModal, setDocRefModal] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setDraft(paymentBatch);
  }, [paymentBatch]);

  function toggleLinePaid(lineId) {
    setDraft((current) => toggleLinePaidTransform(current, lineId));
  }

  function updateLinePaidDate(lineId, value) {
    setDraft((current) => updateLinePaidDateTransform(current, lineId, value));
  }

  function markAllPaid() {
    setDraft((current) => markAllPaidTransform(current));
  }

  function clearAllPaid() {
    setDraft((current) => clearAllPaidTransform(current));
  }

  async function handleSave(event) {
    event?.preventDefault();
    setIsSubmitting(true);
    await onSave?.(draft);
    setIsSubmitting(false);
  }

  function handleCancelBatch() {
    if (window.confirm(t("paymentBatch.cancelBatchConfirm"))) {
      onSave?.({ ...draft, status: "cancelled" });
    }
  }

  function handleDelete() {
    onDelete(draft);
  }

  const isCancelled = draft.status === "cancelled";
  // Derived: Save is only "dirty" while the working draft differs from the
  // payment batch as last loaded/saved. Reverting line changes turns Save off.
  const isDirty = !deepEqual(draft, paymentBatch);

  return {
    draft,
    docRefModal,
    setDocRefModal,
    isCancelled,
    isDirty,
    isSubmitting,
    toggleLinePaid,
    updateLinePaidDate,
    markAllPaid,
    clearAllPaid,
    handleSave,
    handleCancelBatch,
    handleDelete,
  };
}

export default usePaymentBatchDetailState;
