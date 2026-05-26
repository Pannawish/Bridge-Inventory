import { useEffect, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
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

  useEffect(() => {
    setDraft(paymentBatch);
  }, [paymentBatch]);

  function updateField(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

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

  function handleSave(event) {
    event.preventDefault();
    onSave(draft);
  }

  function handleCancelBatch() {
    if (window.confirm(t("paymentBatch.cancelBatchConfirm"))) {
      onSave({ ...draft, status: "cancelled" });
    }
  }

  function handleDelete() {
    onDelete(draft);
  }

  const isCancelled = draft.status === "cancelled";

  return {
    draft,
    docRefModal,
    setDocRefModal,
    isCancelled,
    updateField,
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
