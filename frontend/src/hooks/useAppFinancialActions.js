// React hook for shared application hook state and actions.

import {
  PAGE_SIZE,
  buildBillingNotePayload,
  buildCreditNotePayload,
  buildPaymentBatchPayload,
} from "../app/appUtils";

function prependEntity(currentRows, nextEntity) {
  return [nextEntity, ...currentRows];
}

function replaceEntity(currentRows, updatedEntity) {
  return currentRows.map((row) => (row.id === updatedEntity.id ? updatedEntity : row));
}

function replaceEntities(currentRows, updatedEntities) {
  const entityMap = new Map(updatedEntities.map((entity) => [entity.id, entity]));
  return currentRows.map((row) => entityMap.get(row.id) || row);
}

function removeEntity(currentRows, deletedId) {
  return currentRows.filter((row) => row.id !== deletedId);
}

export function useAppFinancialActions({
  api,
  usingMockBillingNotes,
  setBillingNotes,
  setBillingNoteRows,
  refreshBillingNoteEligibility,
  usingMockPaymentBatches,
  setPaymentBatches,
  setPaymentBatchRows,
  refreshPaymentBatchEligibility,
  usingMockCreditNotes,
  setCreditNotes,
  setCreditNoteRows,
  refreshCreditNoteEligibility,
  loadBillingNotePage,
  setNotice,
  setError,
  buildEntityNotice,
}) {
  async function handleBillingNoteCreate(nextBillingNote) {
    setError("");

    if (usingMockBillingNotes) {
      const resolved = {
        ...nextBillingNote,
        id: nextBillingNote.id || `billing-note-mock-${Date.now()}`,
      };
      setBillingNotes((rows) => prependEntity(rows, resolved));
      setBillingNoteRows((rows) => prependEntity(rows, resolved).slice(0, PAGE_SIZE));
      setNotice(
        buildEntityNotice(
          "app.messages.entityCreated",
          "billingNote",
          resolved.reference_no || resolved.id
        )
      );
      return resolved;
    }

    try {
      const saved = await api.createBillingNote(buildBillingNotePayload(nextBillingNote));
      setBillingNotes((rows) => prependEntity(rows, saved));
      setBillingNoteRows((rows) => prependEntity(rows, saved).slice(0, PAGE_SIZE));
      setNotice(
        buildEntityNotice(
          "app.messages.entityCreated",
          "billingNote",
          saved.reference_no || saved.id
        )
      );
      await refreshBillingNoteEligibility();
      return saved;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function handleBillingNoteUpdate(updated) {
    setError("");

    if (usingMockBillingNotes) {
      setBillingNotes((rows) => replaceEntity(rows, updated));
      setBillingNoteRows((rows) => replaceEntity(rows, updated));
      setNotice(
        buildEntityNotice(
          "app.messages.entityUpdated",
          "billingNote",
          updated.reference_no || updated.id
        )
      );
      return updated;
    }

    try {
      const saved = await api.updateBillingNote(updated.id, buildBillingNotePayload(updated));
      setBillingNotes((rows) => replaceEntity(rows, saved));
      setBillingNoteRows((rows) => replaceEntity(rows, saved));
      setNotice(
        buildEntityNotice(
          "app.messages.entityUpdated",
          "billingNote",
          saved.reference_no || saved.id
        )
      );
      await refreshBillingNoteEligibility();
      return saved;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function handleBillingNoteDelete(deleted) {
    setError("");

    if (usingMockBillingNotes) {
      setBillingNotes((rows) => removeEntity(rows, deleted.id));
      setBillingNoteRows((rows) => removeEntity(rows, deleted.id));
      setNotice(
        buildEntityNotice(
          "app.messages.entityDeleted",
          "billingNote",
          deleted.reference_no || deleted.id
        )
      );
      return true;
    }

    try {
      await api.deleteBillingNote(deleted.id);
      setBillingNotes((rows) => removeEntity(rows, deleted.id));
      setBillingNoteRows((rows) => removeEntity(rows, deleted.id));
      setNotice(
        buildEntityNotice(
          "app.messages.entityDeleted",
          "billingNote",
          deleted.reference_no || deleted.id
        )
      );
      await refreshBillingNoteEligibility();
      return true;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function handleLinkCreditNotesToBillingNote(creditNotes, billingNote) {
    const notesToLink = Array.isArray(creditNotes) ? creditNotes.filter(Boolean) : [];
    if (!billingNote || !notesToLink.length) {
      return [];
    }

    setError("");

    if (usingMockCreditNotes) {
      const linkedCreditNotes = notesToLink.map((creditNote) => ({
        ...creditNote,
        billing_note: billingNote.id,
        billing_note_reference_no: billingNote.reference_no || billingNote.id,
      }));

      setCreditNotes((rows) => replaceEntities(rows, linkedCreditNotes));
      setCreditNoteRows((rows) => replaceEntities(rows, linkedCreditNotes));
      return linkedCreditNotes;
    }

    try {
      const linkedCreditNotes = await Promise.all(
        notesToLink.map((creditNote) =>
          api.updateCreditNote(
            creditNote.id,
            buildCreditNotePayload({
              ...creditNote,
              billing_note: billingNote.id,
            })
          )
        )
      );

      setCreditNotes((rows) => replaceEntities(rows, linkedCreditNotes));
      setCreditNoteRows((rows) => replaceEntities(rows, linkedCreditNotes));
      await refreshCreditNoteEligibility();
      await loadBillingNotePage();
      return linkedCreditNotes;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function handlePaymentBatchCreate(nextBatch) {
    setError("");

    if (usingMockPaymentBatches) {
      const resolved = {
        ...nextBatch,
        id: nextBatch.id || `payment-batch-mock-${Date.now()}`,
      };
      setPaymentBatches((rows) => prependEntity(rows, resolved));
      setPaymentBatchRows((rows) => prependEntity(rows, resolved).slice(0, PAGE_SIZE));
      setNotice(
        buildEntityNotice(
          "app.messages.entityCreated",
          "paymentBatch",
          resolved.reference_no || resolved.id
        )
      );
      return resolved;
    }

    try {
      const saved = await api.createPaymentBatch(buildPaymentBatchPayload(nextBatch));
      setPaymentBatches((rows) => prependEntity(rows, saved));
      setPaymentBatchRows((rows) => prependEntity(rows, saved).slice(0, PAGE_SIZE));
      setNotice(
        buildEntityNotice(
          "app.messages.entityCreated",
          "paymentBatch",
          saved.reference_no || saved.id
        )
      );
      await refreshPaymentBatchEligibility();
      return saved;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function handlePaymentBatchUpdate(updated) {
    setError("");

    if (usingMockPaymentBatches) {
      setPaymentBatches((rows) => replaceEntity(rows, updated));
      setPaymentBatchRows((rows) => replaceEntity(rows, updated));
      setNotice(
        buildEntityNotice(
          "app.messages.entityUpdated",
          "paymentBatch",
          updated.reference_no || updated.id
        )
      );
      return updated;
    }

    try {
      const saved = await api.updatePaymentBatch(
        updated.id,
        buildPaymentBatchPayload(updated)
      );
      setPaymentBatches((rows) => replaceEntity(rows, saved));
      setPaymentBatchRows((rows) => replaceEntity(rows, saved));
      setNotice(
        buildEntityNotice(
          "app.messages.entityUpdated",
          "paymentBatch",
          saved.reference_no || saved.id
        )
      );
      await refreshPaymentBatchEligibility();
      return saved;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function handlePaymentBatchDelete(deleted) {
    setError("");

    if (usingMockPaymentBatches) {
      setPaymentBatches((rows) => removeEntity(rows, deleted.id));
      setPaymentBatchRows((rows) => removeEntity(rows, deleted.id));
      setNotice(
        buildEntityNotice(
          "app.messages.entityDeleted",
          "paymentBatch",
          deleted.reference_no || deleted.id
        )
      );
      return true;
    }

    try {
      await api.deletePaymentBatch(deleted.id);
      setPaymentBatches((rows) => removeEntity(rows, deleted.id));
      setPaymentBatchRows((rows) => removeEntity(rows, deleted.id));
      setNotice(
        buildEntityNotice(
          "app.messages.entityDeleted",
          "paymentBatch",
          deleted.reference_no || deleted.id
        )
      );
      await refreshPaymentBatchEligibility();
      return true;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function handleCreditNoteCreate(nextCreditNote) {
    setError("");

    if (usingMockCreditNotes) {
      const resolved = {
        ...nextCreditNote,
        id: nextCreditNote.id || `credit-note-mock-${Date.now()}`,
      };
      setCreditNotes((rows) => prependEntity(rows, resolved));
      setCreditNoteRows((rows) => prependEntity(rows, resolved).slice(0, PAGE_SIZE));
      setNotice(
        buildEntityNotice(
          "app.messages.entityCreated",
          "creditNote",
          resolved.reference_no || resolved.id
        )
      );
      return resolved;
    }

    try {
      const saved = await api.createCreditNote(buildCreditNotePayload(nextCreditNote));
      setCreditNotes((rows) => prependEntity(rows, saved));
      setCreditNoteRows((rows) => prependEntity(rows, saved).slice(0, PAGE_SIZE));
      setNotice(
        buildEntityNotice(
          "app.messages.entityCreated",
          "creditNote",
          saved.reference_no || saved.id
        )
      );
      await refreshCreditNoteEligibility();
      await loadBillingNotePage();
      return saved;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function handleCreditNoteUpdate(updated) {
    setError("");

    if (usingMockCreditNotes) {
      setCreditNotes((rows) => replaceEntity(rows, updated));
      setCreditNoteRows((rows) => replaceEntity(rows, updated));
      setNotice(
        buildEntityNotice(
          "app.messages.entityUpdated",
          "creditNote",
          updated.reference_no || updated.id
        )
      );
      return updated;
    }

    try {
      const saved = await api.updateCreditNote(updated.id, buildCreditNotePayload(updated));
      setCreditNotes((rows) => replaceEntity(rows, saved));
      setCreditNoteRows((rows) => replaceEntity(rows, saved));
      setNotice(
        buildEntityNotice(
          "app.messages.entityUpdated",
          "creditNote",
          saved.reference_no || saved.id
        )
      );
      await refreshCreditNoteEligibility();
      await loadBillingNotePage();
      return saved;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function handleCreditNoteDelete(deleted) {
    setError("");

    if (usingMockCreditNotes) {
      setCreditNotes((rows) => removeEntity(rows, deleted.id));
      setCreditNoteRows((rows) => removeEntity(rows, deleted.id));
      setNotice(
        buildEntityNotice(
          "app.messages.entityDeleted",
          "creditNote",
          deleted.reference_no || deleted.id
        )
      );
      return true;
    }

    try {
      await api.deleteCreditNote(deleted.id);
      setCreditNotes((rows) => removeEntity(rows, deleted.id));
      setCreditNoteRows((rows) => removeEntity(rows, deleted.id));
      setNotice(
        buildEntityNotice(
          "app.messages.entityDeleted",
          "creditNote",
          deleted.reference_no || deleted.id
        )
      );
      await refreshCreditNoteEligibility();
      await loadBillingNotePage();
      return true;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  return {
    handleBillingNoteCreate,
    handleBillingNoteUpdate,
    handleBillingNoteDelete,
    handleLinkCreditNotesToBillingNote,
    handlePaymentBatchCreate,
    handlePaymentBatchUpdate,
    handlePaymentBatchDelete,
    handleCreditNoteCreate,
    handleCreditNoteUpdate,
    handleCreditNoteDelete,
  };
}
