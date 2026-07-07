// React hook for shared application hook state and actions.

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

    // Optimistically reflect the new status so the row updates instantly (same
    // feel as the detail view), then reconcile with the server in the background.
    // Roll the row back if the request fails.
    const optimisticPurchase = applyPurchaseStatusToItems(purchase, nextStatus);
    setPurchases((currentRows) => updateEntityById(currentRows, optimisticPurchase));
    setPurchaseRows((currentRows) => updateEntityById(currentRows, optimisticPurchase));
    setNotice(
      buildStatusUpdatedNotice("purchase", purchase.reference_no, optimisticPurchase.status)
    );

    try {
      await api.updatePurchaseStatus(purchaseId, nextStatus);
      // Background refreshes — not awaited, so the UI already shows the change.
      refreshPaymentBatchEligibility();
      loadData(true);
    } catch (requestError) {
      setPurchases((currentRows) => updateEntityById(currentRows, purchase));
      setPurchaseRows((currentRows) => updateEntityById(currentRows, purchase));
      showWarning(requestError.message);
    }
  }

  function handlePurchaseItemStatusChange(updatedPurchase) {
    const successNotice = buildEntityNotice(
      "app.messages.entityUpdated",
      "purchase",
      updatedPurchase.reference_no || updatedPurchase.id
    );

    if (usingMockPurchases) {
      setPurchases((currentRows) => updateEntityById(currentRows, updatedPurchase));
      setPurchaseRows((currentRows) => updateEntityById(currentRows, updatedPurchase));
      setNotice(successNotice);
      return true;
    }

    // Optimistic save: patch the row and show the success notice immediately so
    // the detail modal's Save button rebaselines in the same frame, then reconcile
    // with the server in the background. Roll the row back if the request fails.
    const previousPurchase = purchases.find((row) => row.id === updatedPurchase.id);
    setPurchases((currentRows) => updateEntityById(currentRows, updatedPurchase));
    setPurchaseRows((currentRows) => updateEntityById(currentRows, updatedPurchase));
    setNotice(successNotice);

    (async () => {
      try {
        const savedPurchase = await api.updatePurchase(updatedPurchase.id, updatedPurchase);
        if (savedPurchase) {
          setPurchases((currentRows) => updateEntityById(currentRows, savedPurchase));
          setPurchaseRows((currentRows) => updateEntityById(currentRows, savedPurchase));
        }
        refreshPaymentBatchEligibility();
        loadData(true);
      } catch (requestError) {
        if (previousPurchase) {
          setPurchases((currentRows) => updateEntityById(currentRows, previousPurchase));
          setPurchaseRows((currentRows) => updateEntityById(currentRows, previousPurchase));
        }
        showWarning(requestError.message || t("app.messages.purchaseUpdateFailed"));
      }
    })();

    return true;
  }

  function handlePurchaseUpdate(updatedPurchase) {
    const successNotice = buildEntityNotice(
      "app.messages.entityUpdated",
      "purchase",
      updatedPurchase.reference_no || updatedPurchase.id
    );

    if (usingMockPurchases) {
      setPurchases((currentRows) => updateEntityById(currentRows, updatedPurchase));
      setPurchaseRows((currentRows) => updateEntityById(currentRows, updatedPurchase));
      setNotice(successNotice);
      return updatedPurchase;
    }

    // Optimistic save: patch the row and surface the notice immediately so the
    // edit form rebaselines without waiting for the round-trip, then reconcile
    // with the server payload in the background. Roll back on failure.
    const previousPurchase = purchases.find((row) => row.id === updatedPurchase.id);
    setPurchases((currentRows) => updateEntityById(currentRows, updatedPurchase));
    setPurchaseRows((currentRows) => updateEntityById(currentRows, updatedPurchase));
    setNotice(successNotice);

    (async () => {
      try {
        const savedPurchase = await api.updatePurchase(
          updatedPurchase.id,
          buildPurchaseUpdatePayload(updatedPurchase)
        );
        if (savedPurchase) {
          setPurchases((currentRows) => updateEntityById(currentRows, savedPurchase));
          setPurchaseRows((currentRows) => updateEntityById(currentRows, savedPurchase));
        }
        refreshPaymentBatchEligibility();
        loadData(true);
      } catch (requestError) {
        if (previousPurchase) {
          setPurchases((currentRows) => updateEntityById(currentRows, previousPurchase));
          setPurchaseRows((currentRows) => updateEntityById(currentRows, previousPurchase));
        }
        setError(requestError.message);
      }
    })();

    return updatedPurchase;
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
