import { useEffect, useMemo, useState } from "react";
import { formatMoney as fmt } from "../format";
import { useLanguage } from "../i18n/LanguageContext";
import { computeVatSummary } from "./quotation/quotationValueUtils";

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
  const { t } = useLanguage();

  // Preview of the reference the credit note will be issued with, shown read-only
  // like every other document so the user sees its number up front.
  const referenceNo = useMemo(
    () => nextReferenceNo || getNextReferenceNo(creditNotes),
    [nextReferenceNo, creditNotes]
  );

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

  // Mirror the source sale's VAT so the previewed credit equals the actual
  // VAT-inclusive amount the bill will be reduced by.
  const creditVat = useMemo(
    () => computeVatSummary(totalAmount, sale?.vat_mode),
    [totalAmount, sale]
  );

  async function handleSubmit(event) {
    event.preventDefault();

    if (!sale) {
      setError(t("creditNotePrompt.errorNoSale"));
      return;
    }

    const chosenLines = newlyCancelledLines.filter((line) =>
      selectedLineIds.has(line.sale_item)
    );

    if (!chosenLines.length) {
      setError(t("creditNotePrompt.errorNoItems"));
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      const payload = {
        reference_no: referenceNo,
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
            <p className="eyebrow">{t("creditNotePrompt.eyebrow")}</p>
            <h3 id="cn-prompt-title">{t("creditNotePrompt.title")}</h3>
            <p className="credit-note-prompt-subtitle">
              {t("creditNotePrompt.subtitle", {
                count: newlyCancelledLines.length,
                item: newlyCancelledLines.length === 1 ? t("creditNotePrompt.itemSingular") : t("creditNotePrompt.itemPlural"),
                ref: sale.reference_no || `Sale ${sale.id}`,
                customer: sale.customer_name || "this customer",
                verb: newlyCancelledLines.length === 1 ? t("creditNotePrompt.needsSingular") : t("creditNotePrompt.needsPlural"),
              })}
            </p>
          </div>
          <button
            type="button"
            className="icon-button subtle"
            aria-label={t("common.close")}
            onClick={onClose}
          >
            X
          </button>
        </div>

        <form className="form-layout" onSubmit={handleSubmit}>
          <div className="form-grid">
            <label>
              {t("creditNote.referenceNo")}
              <input value={referenceNo} disabled />
            </label>

            <label>
              {t("creditNotePrompt.customerLabel")}
              <input value={sale.customer_name || ""} disabled />
            </label>

            <label>
              {t("creditNotePrompt.sourceSale")}
              <input value={sale.reference_no || `Sale ${sale.id}`} disabled />
            </label>

            <label>
              {t("creditNotePrompt.creditNoteDate")}
              <input
                type="date"
                value={creditNoteDate}
                onChange={(event) => setCreditNoteDate(event.target.value)}
              />
            </label>

            <label>
              {t("creditNotePrompt.applyToBillingNote")}
              <select
                value={billingNoteId}
                onChange={(event) => setBillingNoteId(event.target.value)}
              >
                <option value="">{t("creditNotePrompt.notApplied")}</option>
                {billingNoteOptions.map((billingNote) => (
                  <option key={billingNote.id} value={billingNote.id}>
                    {(billingNote.reference_no || billingNote.id) +
                      ` — ${fmt(billingNote.total_amount)}`}
                  </option>
                ))}
              </select>
            </label>

            <label className="full-width">
              {t("creditNotePrompt.noteLabel")}
              <textarea
                rows="2"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={t("creditNotePrompt.optionalNote")}
              />
            </label>
          </div>

          <div className="line-items-header">
            <div>
              <p className="eyebrow">{t("creditNotePrompt.cancelledEyebrow")}</p>
              <h4>{t("creditNotePrompt.itemsToCredit")}</h4>
            </div>
            <span>{t("creditNotePrompt.selectedCount", { count: selectedLineIds.size })}</span>
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
                    <th>{t("creditNotePrompt.colProduct")}</th>
                    <th>{t("creditNotePrompt.colSKU")}</th>
                    <th>{t("creditNotePrompt.colQuantity")}</th>
                    <th>{t("creditNotePrompt.colUnitPrice")}</th>
                    <th>{t("creditNotePrompt.colAmount")}</th>
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
            <div className="sales-summary-row">
              <span>{t("creditNote.subtotal")}</span>
              <span>{fmt(creditVat.subtotal)}</span>
            </div>
            {creditVat.vat > 0 ? (
              <div className="sales-summary-row">
                <span>{t("creditNote.vat")}</span>
                <span>{fmt(creditVat.vat)}</span>
              </div>
            ) : null}
            <div className="sales-summary-row sales-summary-grand">
              <strong>{t("creditNotePrompt.totalCredit")}</strong>
              <strong>{fmt(creditVat.grandTotal)}</strong>
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
              {t("creditNotePrompt.createLater")}
            </button>
            <button
              className="primary-button"
              type="submit"
              disabled={submitting || !selectedLineIds.size}
            >
              {submitting ? t("creditNotePrompt.creating") : t("creditNotePrompt.createNow")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreditNotePrompt;
