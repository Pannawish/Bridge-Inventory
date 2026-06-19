import { useEffect, useMemo, useState } from "react";
import { formatMoney as fmt } from "../../format";
import { useLanguage } from "../../i18n/LanguageContext";
import EligiblePartyCombobox from "../EligiblePartyCombobox";
import {
  customerBillingNoteOptions,
  getNextCreditNoteReferenceNo,
  getToday,
} from "./creditNoteUtils";

function CreateCreditNoteModal({
  sales,
  billingNotes,
  creditNotes,
  nextReferenceNo = "",
  onClose,
  onCreate,
}) {
  const { t } = useLanguage();
  const [customerName, setCustomerName] = useState("");
  const [creditNoteDate, setCreditNoteDate] = useState(getToday());
  const [saleId, setSaleId] = useState("");
  const [selectedLineIds, setSelectedLineIds] = useState(new Set());
  const [billingNoteId, setBillingNoteId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const customerOptions = useMemo(() => {
    const set = new Set(
      sales.map((sale) => `${sale.customer_name ?? ""}`.trim()).filter(Boolean)
    );
    return Array.from(set).sort();
  }, [sales]);

  const customerSales = useMemo(() => {
    if (!customerName) return [];
    return sales.filter((sale) => sale.customer_name === customerName);
  }, [customerName, sales]);

  const selectedSale = useMemo(
    () => customerSales.find((sale) => `${sale.id}` === `${saleId}`) || null,
    [customerSales, saleId]
  );

  const cancelledLines = selectedSale?.cancelled_lines || [];

  const billingNoteOptions = useMemo(
    () => customerBillingNoteOptions(billingNotes, customerName),
    [billingNotes, customerName]
  );

  useEffect(() => {
    setSelectedLineIds(new Set(cancelledLines.map((line) => line.sale_item)));
    // Re-run only when the chosen sale changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saleId]);

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
      cancelledLines
        .filter((line) => selectedLineIds.has(line.sale_item))
        .reduce((acc, line) => acc + (Number(line.amount) || 0), 0),
    [cancelledLines, selectedLineIds]
  );

  function handleSubmit(event) {
    event.preventDefault();

    if (!customerName) {
      setError(t("creditNote.selectCustomerFirst"));
      return;
    }
    if (!selectedSale) {
      setError(t("creditNote.selectSaleFirst"));
      return;
    }

    const chosenLines = cancelledLines.filter((line) =>
      selectedLineIds.has(line.sale_item)
    );
    if (!chosenLines.length) {
      setError(t("creditNote.noItemsToCredit"));
      return;
    }

    onCreate({
      reference_no:
        nextReferenceNo || getNextCreditNoteReferenceNo(creditNotes),
      customer_name: customerName,
      sale: selectedSale.id,
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
    });
  }

  return (
    <section
      className="section-card credit-note-create-card"
      aria-labelledby="cn-create-title"
    >
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("creditNote.eyebrow")}</p>
          <h3 id="cn-create-title">{t("creditNote.createTitle")}</h3>
        </div>
        <button
          className="secondary-button table-action-button"
          type="button"
          onClick={onClose}
        >
          {t("common.cancel")}
        </button>
      </div>

      <form className="form-layout" onSubmit={handleSubmit}>
        <div className="form-grid">
          <EligiblePartyCombobox
            id="credit-note-customer"
            label={t("creditNote.customerLabel")}
            value={customerName}
            options={customerOptions}
            placeholder={t("creditNote.searchCustomerPlaceholder")}
            emptyMessage={t("creditNote.noCustomersWithItems")}
            onChange={(nextCustomerName) => {
              setCustomerName(nextCustomerName);
              setSaleId("");
              setBillingNoteId("");
              setSelectedLineIds(new Set());
              setError("");
            }}
          />

          <label>
            {t("creditNote.creditNoteDateLabel")}
            <input
              type="date"
              value={creditNoteDate}
              onChange={(event) => setCreditNoteDate(event.target.value)}
            />
          </label>

          <label>
            {t("creditNote.salesOrderLabel")}
            <select
              value={saleId}
              onChange={(event) => {
                setSaleId(event.target.value);
                setError("");
              }}
              disabled={!customerName}
            >
              <option value="">{t("creditNote.selectSaleWithItems")}</option>
              {customerSales.map((sale) => (
                <option key={sale.id} value={sale.id}>
                  {(sale.reference_no || sale.id) +
                    ` — ${(sale.cancelled_lines || []).length} cancelled/returned`}
                </option>
              ))}
            </select>
          </label>

          <label>
            {t("creditNote.applyToBillingNote")}
            <select
              value={billingNoteId}
              onChange={(event) => setBillingNoteId(event.target.value)}
              disabled={!customerName}
            >
              <option value="">{t("creditNote.notApplied")}</option>
              {billingNoteOptions.map((billingNote) => (
                <option key={billingNote.id} value={billingNote.id}>
                  {(billingNote.reference_no || billingNote.id) +
                    ` — ${fmt(billingNote.total_amount)}`}
                </option>
              ))}
            </select>
            {customerName && billingNoteOptions.length === 0 ? (
              <span className="field-helper-text">
                {t("creditNote.noAvailableBillingNotes")}
              </span>
            ) : null}
          </label>

          <label className="full-width">
            {t("creditNote.noteLabel")}
            <textarea
              rows="2"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={t("common.optional")}
            />
          </label>
        </div>

        <div className="line-items-header">
          <div>
            <p className="eyebrow">{t("creditNote.step2")}</p>
            <h4>{t("creditNote.cancelledItems")}</h4>
          </div>
          <span>{t("creditNote.selectedCount", { count: selectedLineIds.size })}</span>
        </div>

        {!customerName ? (
          <p className="empty-copy">{t("creditNote.selectCustomerFirst")}</p>
        ) : !selectedSale ? (
          <p className="empty-copy">{t("creditNote.selectSaleFirst")}</p>
        ) : cancelledLines.length === 0 ? (
          <p className="empty-copy">{t("creditNote.noItemsToCredit")}</p>
        ) : (
          <div className="transaction-table-window credit-note-create-table-window">
            <div className="table-scroll credit-note-create-scroll">
              <table className="transaction-history-table credit-note-create-table">
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
                    <th>{t("creditNote.colProduct")}</th>
                    <th>{t("creditNote.colSKU")}</th>
                    <th>{t("creditNote.colQuantity")}</th>
                    <th>{t("creditNote.colUnitPrice")}</th>
                    <th>{t("creditNote.colAmount")}</th>
                  </tr>
                </thead>
                <tbody>
                  {cancelledLines.map((line) => {
                    const checked = selectedLineIds.has(line.sale_item);
                    return (
                      <tr
                        key={line.sale_item}
                        className={
                          checked ? "partner-table-row active" : "partner-table-row"
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
        )}

        <div className="sales-summary-card">
          <div className="sales-summary-row sales-summary-grand">
            <strong>{t("creditNote.totalCredit")}</strong>
            <strong>{fmt(totalAmount)}</strong>
          </div>
        </div>

        {error ? <div className="error-banner">{error}</div> : null}

        <div className="supplier-modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button className="primary-button" type="submit">
            {t("creditNote.createButton")}
          </button>
        </div>
      </form>
    </section>
  );
}

export default CreateCreditNoteModal;
