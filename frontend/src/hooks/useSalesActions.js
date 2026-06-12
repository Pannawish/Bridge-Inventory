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

function buildDraftSale(sale) {
  return applySaleStatusToItems(sale, "draft");
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
  function normalizeSaleForAvailableStock(sale, options = {}) {
    const requestedStatus = sale?.status || "draft";

    if (!shouldKeepSaleAsDraft(requestedStatus)) {
      return { sale, issues: [], forcedDraft: false };
    }

    if (!usingMockPurchases || !usingMockSales) {
      return { sale, issues: [], forcedDraft: false };
    }

    const issues = getSaleStockIssues(sale, products, purchases, sales, options);

    if (!issues.length) {
      return { sale, issues: [], forcedDraft: false };
    }

    return {
      sale: buildDraftSale(sale),
      issues,
      forcedDraft: true,
    };
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
    const { sale: normalizedSale, issues, forcedDraft } = normalizeSaleForAvailableStock(
      requestedSale
    );

    if (forcedDraft) {
      formData.set("status", normalizedSale.status);
      formData.set("items", JSON.stringify(normalizedSale.items || []));
    }

    try {
      await api.createSale(formData);
      setNotice(
        forcedDraft
          ? t("app.messages.salesTransactionSavedAsDraft", {
              reason: formatSaleStockMessage(issues),
            })
          : t("app.messages.salesTransactionSaved")
      );
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

    try {
      const updatedSale = await api.updateSaleStatus(saleId, nextStatus);
      setNotice(buildStatusUpdatedNotice("sale", sale.reference_no, nextStatus));
      await loadData(true);
      maybeOpenCreditNotePrompt(sale, updatedSale);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function handleSaleUpdate(updatedSale) {
    setError("");
    const previousSale = sales.find((row) => row.id === updatedSale.id);
    const { sale: normalizedSale, issues, forcedDraft } = normalizeSaleForAvailableStock(
      updatedSale,
      {
        excludeSaleId: updatedSale.id,
        currentSale: previousSale,
      }
    );
    const successNotice = forcedDraft
      ? t("app.messages.saleSavedAsDraft", {
          ref: updatedSale.reference_no || updatedSale.id,
          reason: formatSaleStockMessage(issues),
        })
      : buildEntityNotice(
          "app.messages.entityUpdated",
          "sale",
          updatedSale.reference_no || updatedSale.id
        );

    if (usingMockSales) {
      setSales((currentRows) => updateEntityById(currentRows, normalizedSale));
      setSaleRows((currentRows) => updateEntityById(currentRows, normalizedSale));
      setNotice(successNotice);
      maybeOpenCreditNotePrompt(previousSale, normalizedSale);
      return true;
    }

    try {
      const savedSale = await api.updateSale(
        normalizedSale.id,
        buildSaleUpdatePayload(normalizedSale)
      );
      const resolvedSale = savedSale || normalizedSale;

      setSales((currentRows) => updateEntityById(currentRows, resolvedSale));
      setSaleRows((currentRows) => updateEntityById(currentRows, resolvedSale));
      setNotice(successNotice);
      maybeOpenCreditNotePrompt(previousSale, resolvedSale);
      // Local rows are already patched optimistically; run the heavier server
      // refreshes in the background so the save returns instantly.
      refreshBillingNoteEligibility();
      loadData(true);
      return resolvedSale;
    } catch (requestError) {
      showWarning(requestError.message || t("app.messages.saleUpdateFailed"));
      return false;
    }
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
