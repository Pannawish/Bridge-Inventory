import { useEffect, useMemo, useState } from "react";
import { formatMoney as fmt } from "../format";

function getToday() {
  return new Date().toISOString().split("T")[0];
}

function getNextReferenceNo(creditNotes) {
  const today = new Date();
  const yearMonth = `${(today.getFullYear() + 543).toString().slice(-2)}${String(
    today.getMonth() + 1
  ).padStart(2, "0")}`;
  const prefix = `CN-${yearMonth}-`;
  const referencePattern = new RegExp(`^${prefix}(\\d+)$`);
  const maxSerial = (creditNotes || []).reduce((max, row) => {
    const match = `${row.reference_no || ""}`.match(referencePattern);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `${prefix}${String(maxSerial + 1).padStart(3, "0")}`;
}

function customerBillingNoteOptions(billingNotes, customerName) {
  return (billingNotes || []).filter(
    (note) => note.customer_name === customerName && note.status !== "cancelled"
  );
}

function CreditNotePrompt({
  sale,
  newlyCancelledLines = [],
  billingNotes = [],
  creditNotes = [],
  nextReferenceNo = "",
  onClose,
  onCreate,
}) {
  const [creditNoteDate, setCreditNoteDate] = useState(getToday());
  const [billingNoteId, setBillingNoteId] = useState("");
  const [note, setNote] = useState("");
  const [selectedLineIds, setSelectedLineIds] = useState(
    () => new Set(newlyCancelledLines.map((line) => line.sale_item))
  );
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setSelectedLineIds(new Set(newlyCancelledLines.map((line) => line.sale_item)));
  }, [newlyCancelledLines]);

  const billingNoteOptions = useMemo(
    () => customerBillingNoteOptions(billingNotes, sale?.customer_name || ""),
    [billingNotes, sale]
  );

  function toggleLine(saleItemId) {
    setSelectedLineIds((current) => {
      const next = new Set(current);
      if (next.has(saleItemId)) {
        next.delete(saleItemId);
      } else {
        next.add(saleItemId);
      }
      return next;
    });
  }

  const totalAmount = useMemo(
    () =>
      newlyCancelledLines
        .filter((line) => selectedLineIds.has(line.sale_item))
        .reduce((acc, line) => acc + (Number(line.amount) || 0), 0),
    [newlyCancelledLines, selectedLineIds]
  );

  async function handleSubmit(event) {
    event.preventDefault();

    if (!sale) {
      setError("Sale information is missing.");
      return;
    }

    const chosenLines = newlyCancelledLines.filter((line) =>
      selectedLineIds.has(line.sale_item)
    );

    if (!chosenLines.length) {
      setError("Select at least one cancelled or returned item to credit.");
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      const payload = {
        reference_no: nextReferenceNo || getNextReferenceNo(creditNotes),
        customer_name: sale.customer_name || "",
        sale: sale.id,
        billing_note: billingNoteId || null,
        credit_note_date: creditNoteDate || getToday(),
        status: "issued",
        note,
        lines: chosenLines.map((line) => ({
          sale_item: line.sale_item,
          product_name: line.product_name,
          sku: line.sku,
          quantity: line.quantity,
          unit_price: line.unit_price,
          amount: line.amount,
        })),
      };
      const created = await onCreate(payload);
      if (created === false) {
        return;
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!sale) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="detail-modal credit-note-prompt-modal section-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cn-prompt-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">Items cancelled or returned</p>
            <h3 id="cn-prompt-title">Create a Credit Note?</h3>
            <p className="credit-note-prompt-subtitle">
              {newlyCancelledLines.length} cancelled or returned item
              {newlyCancelledLines.length === 1 ? "" : "s"} on{" "}
              <strong>{sale.reference_no || `Sale ${sale.id}`}</strong> for{" "}
              <strong>{sale.customer_name || "this customer"}</strong>{" "}
              {newlyCancelledLines.length === 1 ? "needs" : "need"} a credit
              note. Issue it now to keep records aligned, or click{" "}
              <em>Create Later</em> to handle it from the Credit Notes page.
            </p>
          </div>
          <button
            type="button"
            className="icon-button subtle"
            aria-label="Close"
            onClick={onClose}
          >
            X
          </button>
        </div>

        <form className="form-layout" onSubmit={handleSubmit}>
          <div className="form-grid">
            <label>
              Customer
              <input value={sale.customer_name || ""} disabled />
            </label>

            <label>
              Source Sale
              <input value={sale.reference_no || `Sale ${sale.id}`} disabled />
            </label>

            <label>
              Credit Note Date
              <input
                type="date"
                value={creditNoteDate}
                onChange={(event) => setCreditNoteDate(event.target.value)}
              />
            </label>

            <label>
              Apply to Billing Note (optional)
              <select
                value={billingNoteId}
                onChange={(event) => setBillingNoteId(event.target.value)}
              >
                <option value="">Not applied to a billing note</option>
                {billingNoteOptions.map((billingNote) => (
                  <option key={billingNote.id} value={billingNote.id}>
                    {(billingNote.reference_no || billingNote.id) +
                      ` — ${fmt(billingNote.total_amount)}`}
                  </option>
                ))}
              </select>
            </label>

            <label className="full-width">
              Note
              <textarea
                rows="2"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Optional note"
              />
            </label>
          </div>

          <div className="line-items-header">
            <div>
              <p className="eyebrow">Cancelled items</p>
              <h4>Items to credit</h4>
            </div>
            <span>{selectedLineIds.size} selected</span>
          </div>

          <div className="transaction-table-window credit-note-prompt-table-window">
            <div className="table-scroll">
              <table className="transaction-history-table credit-note-prompt-table">
                <colgroup>
                  <col className="credit-note-select-col" />
                  <col className="credit-note-product-col" />
                  <col className="credit-note-sku-col" />
                  <col className="credit-note-qty-col" />
                  <col className="credit-note-price-col" />
                  <col className="credit-note-amount-col" />
                </colgroup>
                <thead>
                  <tr>
                    <th />
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Quantity</th>
                    <th>Unit Price</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {newlyCancelledLines.map((line) => {
                    const checked = selectedLineIds.has(line.sale_item);
                    return (
                      <tr
                        key={line.sale_item}
                        className={
                          checked
                            ? "partner-table-row active"
                            : "partner-table-row"
                        }
                      >
                        <td>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleLine(line.sale_item)}
                          />
                        </td>
                        <td>{line.product_name}</td>
                        <td>{line.sku || "—"}</td>
                        <td>{line.quantity}</td>
                        <td>{fmt(line.unit_price)}</td>
                        <td>{fmt(line.amount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="sales-summary-card">
            <div className="sales-summary-row sales-summary-grand">
              <strong>Total Credit</strong>
              <strong>{fmt(totalAmount)}</strong>
            </div>
          </div>

          {error ? <div className="error-banner">{error}</div> : null}

          <div className="supplier-modal-actions credit-note-prompt-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={onClose}
              disabled={submitting}
            >
              Create Later
            </button>
            <button
              className="primary-button"
              type="submit"
              disabled={submitting || !selectedLineIds.size}
            >
              {submitting ? "Creating..." : "Create Credit Note"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreditNotePrompt;
