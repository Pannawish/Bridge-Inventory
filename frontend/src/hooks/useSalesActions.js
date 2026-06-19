import {
  buildSaleUpdatePayload,
  countCancelledSaleItems,
  findUncreditedCancelledSaleLines,
} from "../app/appUtils";
import { applySaleStatusToItems } from "../saleStatus";
import { getSaleStockIssues } from "../saleStock";

function shouldKeepSaleAsDraft(status) {
  return !["draft", "cancelled", "returned"].includes(`${status || "draft"}`);
}

function updateEntityById(currentRows, nextEntity) {
  return currentRows.map((row) => (row.id === nextEntity.id ? nextEntity : row));
}

function removeEntityById(currentRows, deletedId) {
  return currentRows.filter((row) => row.id !== deletedId);
}

export function useSalesActions({
  api,
  products,
  purchases,
  sales,
  creditNotes,
  usingMockPurchases,
  usingMockSales,
  setSales,
  setSaleRows,
  setCreditNotePrompt,
  setActiveTab,
  setNotice,
  setError,
  loadData,
  refreshBillingNoteEligibility,
  buildEntityNotice,
  buildStatusUpdatedNotice,
  buildStatusChangeConfirm,
  formatSaleStockMessage,
  showWarning,
  t,
  handleCreditNoteCreate,
}) {
  // Returns the stock shortfalls that should BLOCK a save/create when the sale is
  // being promoted past Draft. Empty when the sale stays in a non-committing
  // status (draft/cancelled/returned), when stock validation is off (real
  // backend), or when there is enough stock. Callers block on a non-empty result
  // — we never silently downgrade the sale to Draft.
  function getSaleStockBlockIssues(sale, options = {}) {
    const requestedStatus = sale?.status || "draft";

    if (!shouldKeepSaleAsDraft(requestedStatus)) {
      return [];
    }

    if (!usingMockPurchases || !usingMockSales) {
      return [];
    }

    return getSaleStockIssues(sale, products, purchases, sales, options);
  }

  function maybeOpenCreditNotePrompt(previousSale, nextSale) {
    if (!nextSale) {
      return;
    }

    const prevCount = countCancelledSaleItems(previousSale);
    const nextCount = countCancelledSaleItems(nextSale);
    if (nextCount <= prevCount) {
      return;
    }

    const lines = findUncreditedCancelledSaleLines(nextSale, creditNotes);
    if (!lines.length) {
      return;
    }

    setCreditNotePrompt({
      sale: nextSale,
      newlyCancelledLines: lines,
    });
  }

  async function handleSalesCreateFromHistory(formData) {
    setError("");

    const requestedSale = {
      status: `${formData.get("status") || "draft"}`,
      items: JSON.parse(`${formData.get("items") || "[]"}`),
    };
    const issues = getSaleStockBlockIssues(requestedSale);

    if (issues.length) {
      showWarning(formatSaleStockMessage(issues));
      return false;
    }

    try {
      await api.createSale(formData);
      setNotice(t("app.messages.salesTransactionSaved"));
      setActiveTab("sales-history");
      await loadData(true);
      return true;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function handleSaleStatusChange(saleId, nextStatus) {
    const sale = sales.find((row) => row.id === saleId);

    if (!sale || sale.status === nextStatus) {
      return;
    }

    if (shouldKeepSaleAsDraft(nextStatus) && usingMockPurchases && usingMockSales) {
      const nextSale = applySaleStatusToItems({ ...sale, status: nextStatus }, nextStatus);
      const issues = getSaleStockIssues(nextSale, products, purchases, sales, {
        excludeSaleId: sale.id,
        currentSale: sale,
      });

      if (issues.length) {
        showWarning(formatSaleStockMessage(issues));
        return;
      }
    }

    const confirmed = window.confirm(
      buildStatusChangeConfirm("sale", sale.reference_no, sale.status, nextStatus)
    );

    if (!confirmed) {
      return;
    }

    setError("");

    if (usingMockSales) {
      const updatedSale = applySaleStatusToItems(sale, nextStatus);

      setSales((currentRows) => updateEntityById(currentRows, updatedSale));
      setSaleRows((currentRows) => updateEntityById(currentRows, updatedSale));
      setNotice(buildStatusUpdatedNotice("sale", sale.reference_no, updatedSale.status));
      maybeOpenCreditNotePrompt(sale, updatedSale);
      return;
    }

    // Optimistically reflect the new status so the row updates instantly (same
    // feel as the detail view), then reconcile with the server in the background.
    // Roll the row back if the request fails.
    const optimisticSale = applySaleStatusToItems(sale, nextStatus);
    setSales((currentRows) => updateEntityById(currentRows, optimisticSale));
    setSaleRows((currentRows) => updateEntityById(currentRows, optimisticSale));
    setNotice(buildStatusUpdatedNotice("sale", sale.reference_no, optimisticSale.status));

    try {
      const updatedSale = await api.updateSaleStatus(saleId, nextStatus);
      const resolvedSale = updatedSale || optimisticSale;
      setSales((currentRows) => updateEntityById(currentRows, resolvedSale));
      setSaleRows((currentRows) => updateEntityById(currentRows, resolvedSale));
      maybeOpenCreditNotePrompt(sale, resolvedSale);
      // Background refreshes — not awaited, so the UI already shows the change.
      refreshBillingNoteEligibility();
      loadData(true);
    } catch (requestError) {
      setSales((currentRows) => updateEntityById(currentRows, sale));
      setSaleRows((currentRows) => updateEntityById(currentRows, sale));
      showWarning(requestError.message);
    }
  }

  async function handleSaleUpdate(updatedSale) {
    setError("");
    const previousSale = sales.find((row) => row.id === updatedSale.id);
    const issues = getSaleStockBlockIssues(updatedSale, {
      excludeSaleId: updatedSale.id,
      currentSale: previousSale,
    });

    if (issues.length) {
      showWarning(formatSaleStockMessage(issues));
      return false;
    }

    const successNotice = buildEntityNotice(
      "app.messages.entityUpdated",
      "sale",
      updatedSale.reference_no || updatedSale.id
    );

    if (usingMockSales) {
      setSales((currentRows) => updateEntityById(currentRows, updatedSale));
      setSaleRows((currentRows) => updateEntityById(currentRows, updatedSale));
      setNotice(successNotice);
      maybeOpenCreditNotePrompt(previousSale, updatedSale);
      return true;
    }

    // Optimistic save: patch the row and show the success notice immediately so
    // the detail modal / edit form reflect the save in the same frame, then
    // reconcile with the server in the background. Roll the row back on failure.
    // The credit-note prompt stays in the confirmed-save branch — it must not
    // fire for cancellations that never persisted if the request fails.
    setSales((currentRows) => updateEntityById(currentRows, updatedSale));
    setSaleRows((currentRows) => updateEntityById(currentRows, updatedSale));
    setNotice(successNotice);

    (async () => {
      try {
        const savedSale = await api.updateSale(
          updatedSale.id,
          buildSaleUpdatePayload(updatedSale)
        );
        const resolvedSale = savedSale || updatedSale;
        if (savedSale) {
          setSales((currentRows) => updateEntityById(currentRows, resolvedSale));
          setSaleRows((currentRows) => updateEntityById(currentRows, resolvedSale));
        }
        maybeOpenCreditNotePrompt(previousSale, resolvedSale);
        refreshBillingNoteEligibility();
        loadData(true);
      } catch (requestError) {
        if (previousSale) {
          setSales((currentRows) => updateEntityById(currentRows, previousSale));
          setSaleRows((currentRows) => updateEntityById(currentRows, previousSale));
        }
        showWarning(requestError.message || t("app.messages.saleUpdateFailed"));
      }
    })();

    return updatedSale;
  }

  async function handleSaleDelete(deletedSale) {
    if (usingMockSales) {
      setSales((currentRows) => removeEntityById(currentRows, deletedSale.id));
      setSaleRows((currentRows) => removeEntityById(currentRows, deletedSale.id));
      setNotice(
        buildEntityNotice(
          "app.messages.entityDeleted",
          "sale",
          deletedSale.reference_no || deletedSale.id
        )
      );
      return true;
    }

    try {
      await api.deleteSale(deletedSale.id);
      setSales((currentRows) => removeEntityById(currentRows, deletedSale.id));
      setSaleRows((currentRows) => removeEntityById(currentRows, deletedSale.id));
      setNotice(
        buildEntityNotice(
          "app.messages.entityDeleted",
          "sale",
          deletedSale.reference_no || deletedSale.id
        )
      );
      await refreshBillingNoteEligibility();
      await loadData(true);
      return true;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function handleCreditNotePromptCreate(payload) {
    const created = await handleCreditNoteCreate(payload);
    if (created === false) {
      return false;
    }
    setCreditNotePrompt(null);
    return created;
  }

  return {
    handleSalesCreateFromHistory,
    handleSaleStatusChange,
    handleSaleUpdate,
    handleSaleDelete,
    handleCreditNotePromptCreate,
  };
}
