import { buildPurchaseUpdatePayload } from "../app/appUtils";
import { applyPurchaseStatusToItems } from "../purchaseStatus";

function updateEntityById(currentRows, nextEntity) {
  return currentRows.map((row) => (row.id === nextEntity.id ? nextEntity : row));
}

function removeEntityById(currentRows, deletedId) {
  return currentRows.filter((row) => row.id !== deletedId);
}

export function usePurchaseActions({
  api,
  purchases,
  usingMockPurchases,
  setPurchases,
  setPurchaseRows,
  setNotice,
  setError,
  loadData,
  refreshPaymentBatchEligibility,
  buildEntityNotice,
  buildStatusUpdatedNotice,
  buildStatusChangeConfirm,
  showWarning,
  t,
  setActiveTab,
}) {
  async function handlePurchaseCreateFromHistory(formData) {
    setError("");

    try {
      await api.createPurchase(formData);
      setNotice(t("app.messages.purchaseTransactionSaved"));
      setActiveTab("purchase-history"); // Wait, does usePurchaseActions need setActiveTab?
      await loadData(true);
      return true;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function handleQuotationPurchaseCreate(formData) {
    setError("");

    try {
      const saved = await api.createPurchase(formData);
      setNotice(
        buildEntityNotice(
          "app.messages.entityCreated",
          "purchaseOrder",
          saved?.reference_no || ""
        )
      );
      await loadData(true);
      return saved;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function handlePurchaseStatusChange(purchaseId, nextStatus) {
    const purchase = purchases.find((row) => row.id === purchaseId);

    if (!purchase || purchase.status === nextStatus) {
      return;
    }

    if (nextStatus === "partially_received") {
      setNotice(t("app.messages.partiallyReceivedAuto"));
      return;
    }

    const confirmed = window.confirm(
      buildStatusChangeConfirm(
        "purchase",
        purchase.reference_no,
        purchase.status,
        nextStatus
      )
    );

    if (!confirmed) {
      return;
    }

    setError("");

    if (usingMockPurchases) {
      const updatedPurchase = applyPurchaseStatusToItems(purchase, nextStatus);

      setPurchases((currentRows) => updateEntityById(currentRows, updatedPurchase));
      setPurchaseRows((currentRows) => updateEntityById(currentRows, updatedPurchase));
      setNotice(
        buildStatusUpdatedNotice(
          "purchase",
          purchase.reference_no,
          updatedPurchase.status
        )
      );
      return;
    }

    try {
      await api.updatePurchaseStatus(purchaseId, nextStatus);
      setNotice(buildStatusUpdatedNotice("purchase", purchase.reference_no, nextStatus));
      await loadData(true);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function handlePurchaseItemStatusChange(updatedPurchase) {
    if (usingMockPurchases) {
      setPurchases((currentRows) => updateEntityById(currentRows, updatedPurchase));
      setPurchaseRows((currentRows) => updateEntityById(currentRows, updatedPurchase));
      setNotice(
        buildEntityNotice(
          "app.messages.entityUpdated",
          "purchase",
          updatedPurchase.reference_no || updatedPurchase.id
        )
      );
      return true;
    }

    try {
      const savedPurchase = await api.updatePurchase(updatedPurchase.id, updatedPurchase);
      const resolvedPurchase = savedPurchase || updatedPurchase;

      setPurchases((currentRows) => updateEntityById(currentRows, resolvedPurchase));
      setPurchaseRows((currentRows) => updateEntityById(currentRows, resolvedPurchase));
      setNotice(
        buildEntityNotice(
          "app.messages.entityUpdated",
          "purchase",
          updatedPurchase.reference_no || updatedPurchase.id
        )
      );
      await loadData(true);
      return true;
    } catch (requestError) {
      showWarning(requestError.message || t("app.messages.purchaseUpdateFailed"));
      return false;
    }
  }

  async function handlePurchaseUpdate(updatedPurchase) {
    if (usingMockPurchases) {
      setPurchases((currentRows) => updateEntityById(currentRows, updatedPurchase));
      setPurchaseRows((currentRows) => updateEntityById(currentRows, updatedPurchase));
      setNotice(
        buildEntityNotice(
          "app.messages.entityUpdated",
          "purchase",
          updatedPurchase.reference_no || updatedPurchase.id
        )
      );
      return true;
    }

    try {
      const savedPurchase = await api.updatePurchase(
        updatedPurchase.id,
        buildPurchaseUpdatePayload(updatedPurchase)
      );
      const resolvedPurchase = savedPurchase || updatedPurchase;

      setPurchases((currentRows) => updateEntityById(currentRows, resolvedPurchase));
      setPurchaseRows((currentRows) => updateEntityById(currentRows, resolvedPurchase));
      setNotice(
        buildEntityNotice(
          "app.messages.entityUpdated",
          "purchase",
          updatedPurchase.reference_no || updatedPurchase.id
        )
      );
      // Local rows are already patched optimistically above, so let the heavier
      // server refreshes run in the background. The save returns immediately and
      // the user gets instant feedback instead of waiting for a full reload.
      refreshPaymentBatchEligibility();
      loadData(true);
      return resolvedPurchase;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function handlePurchaseDelete(deletedPurchase) {
    if (usingMockPurchases) {
      setPurchases((currentRows) => removeEntityById(currentRows, deletedPurchase.id));
      setPurchaseRows((currentRows) => removeEntityById(currentRows, deletedPurchase.id));
      setNotice(
        buildEntityNotice(
          "app.messages.entityDeleted",
          "purchase",
          deletedPurchase.reference_no || deletedPurchase.id
        )
      );
      await refreshPaymentBatchEligibility();
      return true;
    }

    try {
      await api.deletePurchase(deletedPurchase.id);
      setPurchases((currentRows) => removeEntityById(currentRows, deletedPurchase.id));
      setPurchaseRows((currentRows) => removeEntityById(currentRows, deletedPurchase.id));
      setNotice(
        buildEntityNotice(
          "app.messages.entityDeleted",
          "purchase",
          deletedPurchase.reference_no || deletedPurchase.id
        )
      );
      await loadData(true);
      return true;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  return {
    handlePurchaseCreateFromHistory,
    handleQuotationPurchaseCreate,
    handlePurchaseStatusChange,
    handlePurchaseItemStatusChange,
    handlePurchaseUpdate,
    handlePurchaseDelete,
  };
}
