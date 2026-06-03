import { useMemo, useState } from "react";
import { formatDate, formatMoney as fmt } from "../../format";
import { useLanguage } from "../../i18n/LanguageContext";
import EligiblePartyCombobox from "../EligiblePartyCombobox";
import {
  buildPaymentBatchLinesFromPurchases,
  getNextPaymentBatchReferenceNo,
  getPurchasePayable,
  getToday,
  isPurchaseAvailableForPaymentBatch,
} from "./paymentBatchUtils";

function CreatePaymentBatchModal({
  purchases,
  paymentBatches,
  nextReferenceNo = "",
  onClose,
  onCreate,
}) {
  const { t } = useLanguage();
  const [supplierName, setSupplierName] = useState("");
  const [batchDate, setBatchDate] = useState(getToday());
  const [plannedPaymentDate, setPlannedPaymentDate] = useState("");
  const [bankReference, setBankReference] = useState("");
  const [note, setNote] = useState("");
  const [selectedPurchaseIds, setSelectedPurchaseIds] = useState(new Set());
  const [error, setError] = useState("");

  const supplierOptions = useMemo(() => {
    const set = new Set(
      purchases
        .filter((purchase) =>
          isPurchaseAvailableForPaymentBatch(purchase, paymentBatches)
        )
        .map((purchase) => `${purchase.supplier_name ?? ""}`.trim())
        .filter(Boolean)
    );
    return Array.from(set).sort();
  }, [purchases, paymentBatches]);

  const eligiblePurchases = useMemo(() => {
    if (!supplierName) return [];
    return purchases.filter(
      (purchase) =>
        purchase.supplier_name === supplierName &&
        isPurchaseAvailableForPaymentBatch(purchase, paymentBatches)
    );
  }, [supplierName, purchases, paymentBatches]);

  function togglePurchase(purchaseId) {
    setSelectedPurchaseIds((current) => {
      const next = new Set(current);
      if (next.has(purchaseId)) {
        next.delete(purchaseId);
      } else {
        next.add(purchaseId);
      }
      return next;
    });
  }

  function selectAll() {
    setSelectedPurchaseIds(new Set(eligiblePurchases.map((purchase) => purchase.id)));
  }

  function clearAll() {
    setSelectedPurchaseIds(new Set());
  }

  const totalAmount = useMemo(
    () =>
      eligiblePurchases
        .filter((purchase) => selectedPurchaseIds.has(purchase.id))
        .reduce((acc, purchase) => acc + getPurchasePayable(purchase), 0),
    [eligiblePurchases, selectedPurchaseIds]
  );

  function handleSubmit(event) {
    event.preventDefault();

    if (!supplierName) {
      setError(t("paymentBatch.selectSupplierFirst"));
      return;
    }

    const chosenPurchases = eligiblePurchases.filter((purchase) =>
      selectedPurchaseIds.has(purchase.id)
    );

    if (!chosenPurchases.length) {
      setError(t("paymentBatch.noEligiblePurchases"));
      return;
    }

    const referenceNo =
      nextReferenceNo || getNextPaymentBatchReferenceNo(paymentBatches);
    const lines = buildPaymentBatchLinesFromPurchases(chosenPurchases);

    onCreate({
      reference_no: referenceNo,
      supplier_name: supplierName,
      batch_date: batchDate || getToday(),
      planned_payment_date: plannedPaymentDate || null,
      actual_payment_date: null,
      status: "scheduled",
      bank_reference: bankReference,
      note,
      total_amount: totalAmount,
      lines,
    });
  }

  return (
    <section className="section-card payment-batch-create-card" aria-labelledby="pb-create-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("paymentBatch.eyebrow")}</p>
          <h3 id="pb-create-title">{t("paymentBatch.createTitle")}</h3>
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
            id="payment-batch-supplier"
            label={t("paymentBatch.supplierLabel")}
            value={supplierName}
            options={supplierOptions}
            placeholder={t("paymentBatch.searchPlaceholder")}
            emptyMessage={t("paymentBatch.noEligiblePurchases")}
            onChange={(nextSupplierName) => {
              setSupplierName(nextSupplierName);
              setSelectedPurchaseIds(new Set());
              setError("");
            }}
          />

          <label>
            {t("paymentBatch.batchDate")}
            <input
              type="date"
              value={batchDate}
              onChange={(event) => setBatchDate(event.target.value)}
            />
          </label>

          <label>
            {t("paymentBatch.plannedPaymentDate")}
            <input
              type="date"
              value={plannedPaymentDate}
              onChange={(event) => setPlannedPaymentDate(event.target.value)}
            />
          </label>

          <label>
            {t("paymentBatch.bankReference")}
            <input
              value={bankReference}
              onChange={(event) => setBankReference(event.target.value)}
              placeholder={t("common.optional")}
            />
          </label>

          <label className="full-width">
            {t("paymentBatch.noteLabel")}
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
            <p className="eyebrow">{t("paymentBatch.step2")}</p>
            <h4>{t("paymentBatch.choosePurchases")}</h4>
          </div>
          <span>{t("paymentBatch.selectedCount", { count: selectedPurchaseIds.size })}</span>
        </div>

        {supplierName ? (
          eligiblePurchases.length === 0 ? (
            <p className="empty-copy">{t("paymentBatch.noEligiblePurchases")}</p>
          ) : (
            <>
              <div className="history-filter-actions">
                <button className="secondary-button" type="button" onClick={selectAll}>
                  {t("common.selectAll")}
                </button>
                <button className="secondary-button" type="button" onClick={clearAll}>
                  {t("common.clear")}
                </button>
              </div>

              <div className="transaction-table-window payment-batch-create-table-window">
                <div className="table-scroll payment-batch-create-scroll">
                  <table className="transaction-history-table partner-line-table payment-batch-create-table">
                    <colgroup>
                      <col className="payment-batch-select-col" />
                      <col className="payment-batch-reference-col" />
                      <col className="payment-batch-date-col" />
                      <col className="payment-batch-status-col" />
                      <col className="payment-batch-term-col" />
                      <col className="payment-batch-date-col" />
                      <col className="payment-batch-amount-col" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th />
                        <th>{t("paymentBatch.colReference")}</th>
                        <th>{t("paymentBatch.batchDate")}</th>
                        <th>{t("common.status")}</th>
                        <th>{t("paymentBatch.colPaymentTerm")}</th>
                        <th>{t("paymentBatch.colPaymentDue")}</th>
                        <th>{t("paymentBatch.colAmount")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {eligiblePurchases.map((purchase) => {
                        const checked = selectedPurchaseIds.has(purchase.id);
                        return (
                          <tr
                            key={purchase.id}
                            className={checked ? "partner-table-row active" : "partner-table-row"}
                          >
                            <td>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => togglePurchase(purchase.id)}
                              />
                            </td>
                            <td>{purchase.reference_no || purchase.id}</td>
                            <td>{formatDate(purchase.transaction_date)}</td>
                            <td>
                              <span className={`status-badge status-${purchase.status}`}>
                                {purchase.status?.replace(/_/g, " ")}
                              </span>
                            </td>
                            <td>
                              {purchase.payment_term_type === "credit"
                                ? t("paymentBatch.paymentCreditTerm", {
                                    days: purchase.payment_term_days || "",
                                  })
                                : purchase.payment_term_type === "cash"
                                  ? t("paymentBatch.paymentDebitTerm")
                                  : "—"}
                            </td>
                            <td>{formatDate(purchase.payment_date)}</td>
                            <td>
                              {(() => {
                                const payable = getPurchasePayable(purchase);
                                const original = Number(purchase.grand_total) || 0;
                                const reduced = original - payable > 0.005;
                                return (
                                  <div className="payment-batch-amount-cell">
                                    <span>{fmt(payable)}</span>
                                    {reduced ? (
                                      <span
                                        className="payment-batch-original-amount"
                                        title={t("paymentBatch.reducedFromOriginal", {
                                          amount: fmt(original),
                                        })}
                                      >
                                        {fmt(original)}
                                      </span>
                                    ) : null}
                                  </div>
                                );
                              })()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )
        ) : (
          <p className="empty-copy">{t("paymentBatch.selectSupplierFirst")}</p>
        )}

        <div className="sales-summary-card">
          <div className="sales-summary-row sales-summary-grand">
            <strong>{t("paymentBatch.totalAmount")}</strong>
            <strong>{fmt(totalAmount)}</strong>
          </div>
        </div>

        {error ? <div className="error-banner">{error}</div> : null}

        <div className="supplier-modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button className="primary-button" type="submit">
            {t("paymentBatch.createButton")}
          </button>
        </div>
      </form>
    </section>
  );
}

export default CreatePaymentBatchModal;
