import { useEffect, useMemo, useState } from "react";
import { formatDate, formatMoney as fmt } from "../format";
import EligiblePartyCombobox from "./EligiblePartyCombobox";
import PaginationControls from "./PaginationControls";
import DocumentRefChip from "./DocumentRefChip";
import DocumentRefModal from "./DocumentRefModal";
import PaymentLineAmount from "./PaymentLineAmount";
import {
  FilterPresets,
  ActiveFilterChips,
  RangeField,
  withinRange,
} from "./FilterControls";
import { useLanguage } from "../i18n/LanguageContext";

const STATUS_LABEL_KEYS = {
  draft: "paymentBatch.statusDraft",
  scheduled: "paymentBatch.statusScheduled",
  partially_paid: "paymentBatch.statusPartiallyPaid",
  paid: "paymentBatch.statusPaid",
  cancelled: "paymentBatch.statusCancelled",
};

function getToday() {
  return new Date().toISOString().split("T")[0];
}

function daysAgoString(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatStatus(status, t) {
  const key = STATUS_LABEL_KEYS[status];
  return key ? t(key) : (status || "—");
}

function getNextReferenceNo(paymentBatches) {
  const today = new Date();
  const yearMonth = `${(today.getFullYear() + 543).toString().slice(-2)}${String(today.getMonth() + 1).padStart(2, "0")}`;
  const prefix = `PMT-${yearMonth}-`;
  const referencePattern = new RegExp(`^${prefix}(\\d+)$`);
  const maxSerial = paymentBatches.reduce((max, row) => {
    const match = `${row.reference_no || ""}`.match(referencePattern);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  const next = maxSerial + 1;
  return `${prefix}${String(next).padStart(3, "0")}`;
}

function isPurchaseAvailableForPaymentBatch(
  purchase,
  paymentBatches,
  currentPaymentBatchId = null
) {
  const eligibleStatuses = new Set(["received", "partially_received"]);
  if (!eligibleStatuses.has(purchase.status)) return false;

  return !paymentBatches.some(
    (batch) =>
      batch.id !== currentPaymentBatchId &&
      batch.status !== "cancelled" &&
      (batch.lines || []).some((line) => `${line.purchase}` === `${purchase.id}`)
  );
}

function getPurchasePayable(purchase) {
  const payable = Number(purchase.payable_total);
  if (Number.isFinite(payable) && payable > 0) {
    return payable;
  }
  return Number(purchase.grand_total) || 0;
}

function buildLinesFromPurchases(selectedPurchases) {
  return selectedPurchases.map((purchase) => ({
    id: `temp-line-${purchase.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    purchase: purchase.id,
    purchase_id: purchase.id,
    purchase_reference_no: purchase.reference_no,
    purchase_transaction_date: purchase.transaction_date,
    purchase_status: purchase.status,
    purchase_grand_total: purchase.grand_total,
    purchase_payable_total: purchase.payable_total,
    purchase_payment_term_type: purchase.payment_term_type,
    purchase_payment_term_days: purchase.payment_term_days,
    purchase_payment_date: purchase.payment_date,
    paid: false,
    paid_date: null,
    amount: getPurchasePayable(purchase),
  }));
}

function computeStatusFromLines(lines, currentStatus) {
  if (currentStatus === "cancelled" || currentStatus === "draft") {
    return currentStatus;
  }
  if (!lines.length) return "scheduled";
  const paidCount = lines.filter((line) => line.paid).length;
  if (paidCount === 0) return "scheduled";
  if (paidCount === lines.length) return "paid";
  return "partially_paid";
}

function computeActualPaymentDate(lines) {
  const dates = lines
    .filter((line) => line.paid && line.paid_date)
    .map((line) => line.paid_date);
  if (!dates.length) return null;
  return dates.reduce((max, current) => (current > max ? current : max));
}

function batchMatchesQuery(batch, query, t) {
  const text = [
    batch.reference_no,
    batch.supplier_name,
    formatStatus(batch.status, t),
    batch.batch_date,
    batch.planned_payment_date,
    batch.actual_payment_date,
    batch.bank_reference,
    batch.note,
    ...(batch.lines || []).flatMap((line) => [
      line.purchase_reference_no,
      line.paid_date,
    ]),
  ]
    .map((value) => `${value ?? ""}`.toLowerCase())
    .join(" ");
  return text.includes(query);
}

function batchInDateRange(batch, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return true;
  const date = batch.batch_date || "";
  if (dateFrom && date < dateFrom) return false;
  if (dateTo && date > dateTo) return false;
  return true;
}

function StatusPill({ status }) {
  const { t } = useLanguage();
  const className = `status-badge status-${status || "scheduled"}`;
  return <span className={className}>{formatStatus(status, t)}</span>;
}

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
        .filter((purchase) => isPurchaseAvailableForPaymentBatch(purchase, paymentBatches))
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
    setSelectedPurchaseIds(new Set(eligiblePurchases.map((p) => p.id)));
  }

  function clearAll() {
    setSelectedPurchaseIds(new Set());
  }

  const totalAmount = useMemo(() => {
    return eligiblePurchases
      .filter((p) => selectedPurchaseIds.has(p.id))
      .reduce((acc, p) => acc + getPurchasePayable(p), 0);
  }, [eligiblePurchases, selectedPurchaseIds]);

  function handleSubmit(event) {
    event.preventDefault();

    if (!supplierName) {
      setError(t("paymentBatch.selectSupplierFirst"));
      return;
    }

    const chosen = eligiblePurchases.filter((p) =>
      selectedPurchaseIds.has(p.id)
    );

    if (!chosen.length) {
      setError(t("paymentBatch.noEligiblePurchases"));
      return;
    }

    const referenceNo = nextReferenceNo || getNextReferenceNo(paymentBatches);
    const lines = buildLinesFromPurchases(chosen);

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
            <p className="empty-copy">
              {t("paymentBatch.noEligiblePurchases")}
            </p>
          ) : (
            <>
              <div className="history-filter-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={selectAll}
                >
                  {t("common.selectAll")}
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={clearAll}
                >
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
                                ? t("paymentBatch.paymentCreditTerm", { days: purchase.payment_term_days || "" })
                                : purchase.payment_term_type === "debit"
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

function PaymentBatchDetailModal({
  paymentBatch,
  onClose,
  onSave,
  onDelete,
}) {
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
    setDraft((current) => {
      const lines = (current.lines || []).map((line) => {
        if (line.id !== lineId) return line;
        const nextPaid = !line.paid;
        return {
          ...line,
          paid: nextPaid,
          paid_date: nextPaid ? line.paid_date || getToday() : null,
        };
      });
      return {
        ...current,
        lines,
        status: computeStatusFromLines(lines, current.status),
        actual_payment_date: computeActualPaymentDate(lines),
      };
    });
  }

  function updateLinePaidDate(lineId, value) {
    setDraft((current) => {
      const lines = (current.lines || []).map((line) =>
        line.id === lineId ? { ...line, paid_date: value } : line
      );
      return {
        ...current,
        lines,
        actual_payment_date: computeActualPaymentDate(lines),
      };
    });
  }

  function markAllPaid() {
    setDraft((current) => {
      const today = getToday();
      const lines = (current.lines || []).map((line) => ({
        ...line,
        paid: true,
        paid_date: line.paid_date || today,
      }));
      return {
        ...current,
        lines,
        status: computeStatusFromLines(lines, current.status),
        actual_payment_date: computeActualPaymentDate(lines),
      };
    });
  }

  function clearAllPaid() {
    setDraft((current) => {
      const lines = (current.lines || []).map((line) => ({
        ...line,
        paid: false,
        paid_date: null,
      }));
      return {
        ...current,
        lines,
        status: computeStatusFromLines(lines, current.status),
        actual_payment_date: null,
      };
    });
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

  const isCancelled = draft.status === "cancelled";

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="detail-modal transaction-detail-modal section-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pb-detail-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("paymentBatch.eyebrow")}</p>
            <h3 id="pb-detail-title">{draft.reference_no || draft.id}</h3>
          </div>
          <div className="section-heading-actions">
            <StatusPill status={draft.status} />
            <button
              type="button"
              className="icon-button subtle"
              aria-label={t("common.close")}
              onClick={onClose}
            >
              X
            </button>
          </div>
        </div>

        <form className="form-layout" onSubmit={handleSave}>
        <div className="form-grid">
          <label>
            {t("paymentBatch.referenceNo")}
            <input
              value={draft.reference_no || ""}
              onChange={(event) => updateField("reference_no", event.target.value)}
            />
          </label>

          <label>
            {t("paymentBatch.supplierLabel")}
            <input value={draft.supplier_name || ""} disabled />
          </label>

          <label>
            {t("paymentBatch.batchDate")}
            <input
              type="date"
              value={draft.batch_date || ""}
              onChange={(event) => updateField("batch_date", event.target.value)}
            />
          </label>

          <label>
            {t("paymentBatch.plannedPaymentDate")}
            <input
              type="date"
              value={draft.planned_payment_date || ""}
              onChange={(event) =>
                updateField("planned_payment_date", event.target.value)
              }
            />
          </label>

          <label>
            {t("paymentBatch.actualPaymentDate")}
            <input
              type="date"
              value={draft.actual_payment_date || ""}
              readOnly
            />
          </label>

          <label>
            {t("paymentBatch.bankReference")}
            <input
              value={draft.bank_reference || ""}
              onChange={(event) =>
                updateField("bank_reference", event.target.value)
              }
            />
          </label>

          <label className="full-width">
            {t("paymentBatch.noteLabel")}
            <textarea
              rows="2"
              value={draft.note || ""}
              onChange={(event) => updateField("note", event.target.value)}
            />
          </label>
        </div>

        <div className="line-items-header">
          <div>
            <p className="eyebrow">{t("paymentBatch.purchaseOrdersEyebrow")}</p>
            <h4>{t("paymentBatch.markAsPaid")}</h4>
          </div>
          <span>
            {t("paymentBatch.paidFraction", {
              paid: (draft.lines || []).filter((line) => line.paid).length,
              total: (draft.lines || []).length,
            })}
          </span>
        </div>

        {!isCancelled && (draft.lines || []).length > 0 ? (
          <div className="history-filter-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={markAllPaid}
            >
              {t("paymentBatch.markAllPaid")}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={clearAllPaid}
            >
              {t("paymentBatch.clearAll")}
            </button>
          </div>
        ) : null}

        <div className="transaction-table-window">
          <div className="table-scroll partner-line-scroll desktop-table">
            <table className="transaction-history-table partner-line-table">
              <thead>
                <tr>
                  <th>{t("paymentBatch.colPaid")}</th>
                  <th>{t("paymentBatch.colReference")}</th>
                  <th>{t("paymentBatch.colPODate")}</th>
                  <th>{t("paymentBatch.colPaymentTerm")}</th>
                  <th>{t("paymentBatch.colPaymentDue")}</th>
                  <th>{t("paymentBatch.colPaidDate")}</th>
                  <th>{t("paymentBatch.colAmount")}</th>
                </tr>
              </thead>
              <tbody>
                {(draft.lines || []).map((line) => (
                  <tr
                    key={line.id}
                    className={line.paid ? "partner-table-row active" : "partner-table-row"}
                  >
                    <td>
                      <input
                        type="checkbox"
                        checked={line.paid}
                        disabled={isCancelled}
                        onChange={() => toggleLinePaid(line.id)}
                      />
                    </td>
                    <td>
                      <DocumentRefChip
                        label={line.purchase_reference_no || line.purchase_id || line.purchase}
                        docType="purchase"
                        onClick={() =>
                          setDocRefModal({
                            docType: "purchase",
                            docId: line.purchase_id || line.purchase,
                            referenceNo: line.purchase_reference_no || line.purchase_id || line.purchase,
                          })
                        }
                      />
                    </td>
                    <td>{formatDate(line.purchase_transaction_date)}</td>
                    <td>
                      {line.purchase_payment_term_type === "credit"
                        ? t("paymentBatch.paymentCreditTerm", { days: line.purchase_payment_term_days || "" })
                        : line.purchase_payment_term_type === "debit"
                          ? t("paymentBatch.paymentDebitTerm")
                          : "—"}
                    </td>
                    <td>{formatDate(line.purchase_payment_date)}</td>
                    <td>
                      {line.paid ? (
                        <input
                          type="date"
                          value={line.paid_date || ""}
                          onChange={(event) =>
                            updateLinePaidDate(line.id, event.target.value)
                          }
                          disabled={isCancelled}
                        />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td><PaymentLineAmount line={line} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="6" style={{ textAlign: "right" }}>
                    <strong>{t("paymentBatch.colTotal")}</strong>
                  </td>
                  <td>
                    <strong>{fmt(draft.total_amount)}</strong>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="supplier-modal-actions">
          <button
            type="button"
            className="danger-button"
            onClick={() => onDelete(draft)}
          >
            {t("common.delete")}
          </button>
          {!isCancelled ? (
            <button
              type="button"
              className="secondary-button"
              onClick={handleCancelBatch}
            >
              {t("paymentBatch.cancelBatch")}
            </button>
          ) : null}
          <button type="button" className="secondary-button" onClick={onClose}>
            {t("common.close")}
          </button>
          <button type="submit" className="primary-button">
            {t("common.save")}
          </button>
        </div>
      </form>
      </div>

      {docRefModal && (
        <DocumentRefModal
          docType={docRefModal.docType}
          docId={docRefModal.docId}
          referenceNo={docRefModal.referenceNo}
          onClose={() => setDocRefModal(null)}
        />
      )}
    </div>
  );
}

function PaymentBatchPage({
  paymentBatches = [],
  allPaymentBatches = paymentBatches,
  suppliers = [],
  purchases = [],
  summary: serverSummary = null,
  nextReferenceNo = "",
  pagination = null,
  onPageRequest,
  onCreatePaymentBatch,
  onUpdatePaymentBatch,
  onDeletePaymentBatch,
}) {
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [showAllRows, setShowAllRows] = useState(false);
  const [creating, setCreating] = useState(false);
  const [activeBatch, setActiveBatch] = useState(null);
  const STATUS_OPTIONS = [
    { value: "scheduled", label: t("paymentBatch.statusScheduled") },
    { value: "partially_paid", label: t("paymentBatch.statusPartiallyPaid") },
    { value: "paid", label: t("paymentBatch.statusPaid") },
    { value: "cancelled", label: t("paymentBatch.statusCancelled") },
  ];

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const isServerPaginated = Boolean(pagination && onPageRequest);
  const filtered = useMemo(() => {
    if (isServerPaginated) {
      return paymentBatches;
    }

    return paymentBatches.filter((batch) => {
      if (normalizedSearch && !batchMatchesQuery(batch, normalizedSearch, t)) {
        return false;
      }
      if (statusFilter !== "all" && batch.status !== statusFilter) {
        return false;
      }
      if (!batchInDateRange(batch, dateFrom, dateTo)) {
        return false;
      }
      if (!withinRange(batch.total_amount, amountMin, amountMax)) {
        return false;
      }
      return true;
    });
  }, [
    amountMin,
    amountMax,
    dateFrom,
    dateTo,
    isServerPaginated,
    normalizedSearch,
    paymentBatches,
    statusFilter,
  ]);

  const compactRows = 5;
  const shouldShowViewAll = !isServerPaginated && filtered.length > compactRows;
  const isCompact = shouldShowViewAll && !showAllRows;
  const totalPaymentBatchCount = pagination?.count ?? paymentBatches.length;

  const computedSummary = useMemo(() => {
    const today = getToday();
    let outstanding = 0;
    let overdue = 0;
    let paid = 0;
    allPaymentBatches.forEach((batch) => {
      if (batch.status === "paid") {
        paid += Number(batch.total_amount) || 0;
      } else if (batch.status !== "cancelled") {
        outstanding += Number(batch.total_amount) || 0;
        if (batch.planned_payment_date && batch.planned_payment_date < today) {
          overdue += Number(batch.total_amount) || 0;
        }
      }
    });
    return { outstanding, overdue, paid };
  }, [allPaymentBatches]);
  const summary = serverSummary || computedSummary;

  const activeFilterCount =
    (statusFilter !== "all" ? 1 : 0) +
    (dateFrom || dateTo ? 1 : 0) +
    (amountMin ? 1 : 0) +
    (amountMax ? 1 : 0);

  function resetFilters() {
    setSearchTerm("");
    setStatusFilter("all");
    setDateFrom("");
    setDateTo("");
    setAmountMin("");
    setAmountMax("");
    setFilterOpen(false);
  }

  const last30Active = dateFrom === daysAgoString(30) && !dateTo;
  const quickPresets = [
    {
      label: t("paymentBatch.filterLastDays"),
      active: last30Active,
      onClick: () => {
        setDateFrom(last30Active ? "" : daysAgoString(30));
        setDateTo("");
      },
    },
    {
      label: t("paymentBatch.filterScheduled"),
      active: statusFilter === "scheduled",
      onClick: () =>
        setStatusFilter((current) =>
          current === "scheduled" ? "all" : "scheduled"
        ),
    },
    {
      label: t("paymentBatch.filterPaid"),
      active: statusFilter === "paid",
      onClick: () =>
        setStatusFilter((current) => (current === "paid" ? "all" : "paid")),
    },
  ];
  const activeChips = [
    statusFilter !== "all" && {
      key: "status",
      label: t("filterControls.statusChip", { label: formatStatus(statusFilter, t) }),
      onRemove: () => setStatusFilter("all"),
    },
    dateFrom && {
      key: "dateFrom",
      label: t("filterControls.fromChip", { date: dateFrom }),
      onRemove: () => setDateFrom(""),
    },
    dateTo && {
      key: "dateTo",
      label: t("filterControls.toChip", { date: dateTo }),
      onRemove: () => setDateTo(""),
    },
    amountMin && {
      key: "amountMin",
      label: t("filterControls.minChip", { value: amountMin }),
      onRemove: () => setAmountMin(""),
    },
    amountMax && {
      key: "amountMax",
      label: t("filterControls.maxChip", { value: amountMax }),
      onRemove: () => setAmountMax(""),
    },
  ].filter(Boolean);

  function getPageRequestParams(page = 1) {
    return {
      page,
      search: searchTerm,
      status: statusFilter === "all" ? "" : statusFilter,
      dateFrom,
      dateTo,
      amountMin,
      amountMax,
    };
  }

  useEffect(() => {
    if (!isServerPaginated) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      onPageRequest(getPageRequestParams(1));
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [
    amountMin,
    amountMax,
    dateFrom,
    dateTo,
    isServerPaginated,
    onPageRequest,
    searchTerm,
    statusFilter,
  ]);

  async function handleCreate(payload) {
    const saved = await onCreatePaymentBatch?.(payload);
    if (saved !== false) {
      setCreating(false);
    }
  }

  async function handleSave(updated) {
    const saved = await onUpdatePaymentBatch?.(updated);
    if (saved !== false) {
      setActiveBatch(null);
    }
  }

  async function handleDelete(batch) {
    if (!window.confirm(t("paymentBatch.deleteConfirm", { ref: batch.reference_no || batch.id }))) {
      return;
    }
    const ok = await onDeletePaymentBatch?.(batch);
    if (ok !== false) {
      setActiveBatch(null);
    }
  }

  if (creating) {
    return (
      <div className="stack-layout">
        <CreatePaymentBatchModal
          suppliers={suppliers}
          purchases={purchases}
          paymentBatches={allPaymentBatches}
          nextReferenceNo={nextReferenceNo}
          onClose={() => setCreating(false)}
          onCreate={handleCreate}
        />
      </div>
    );
  }

  return (
    <div className="stack-layout">
      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("paymentBatch.payablesEyebrow")}</p>
            <h3>{t("paymentBatch.payablesTitle")}</h3>
          </div>
        </div>

        <div className="dashboard-summary-grid">
          <article className="dashboard-kpi-card neutral">
            <p>{t("paymentBatch.outstanding")}</p>
            <strong>{fmt(summary.outstanding)}</strong>
            <span>{t("paymentBatch.outstandingDesc")}</span>
          </article>
          <article className="dashboard-kpi-card danger">
            <p>{t("paymentBatch.overdue")}</p>
            <strong>{fmt(summary.overdue)}</strong>
            <span>{t("paymentBatch.overdueDesc")}</span>
          </article>
          <article className="dashboard-kpi-card positive">
            <p>{t("paymentBatch.paid")}</p>
            <strong>{fmt(summary.paid)}</strong>
            <span>{t("paymentBatch.paidDesc")}</span>
          </article>
        </div>
      </section>

      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("paymentBatch.searchEyebrow")}</p>
            <h3>{t("paymentBatch.searchTitle")}</h3>
          </div>
        </div>

        <div className="supplier-directory-toolbar">
          <label className="stock-search supplier-search">
            <span className="stock-search-icon">S</span>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={t("paymentBatch.searchPlaceholder")}
            />
          </label>
          <div className="stock-report-summary supplier-search-meta">
            <span>
              {isServerPaginated
                ? t("paymentBatch.pageCountServer", { count: filtered.length, total: totalPaymentBatchCount })
                : t("paymentBatch.pageCountLocal", { count: filtered.length, total: paymentBatches.length })}
            </span>
          </div>
        </div>

        <div className="history-filter-actions">
          <button
            className="secondary-button product-filter-toggle"
            type="button"
            aria-expanded={filterOpen}
            onClick={() => setFilterOpen((value) => !value)}
          >
            {t("filterControls.filter")}
            {activeFilterCount ? <span>{activeFilterCount}</span> : null}
          </button>
          <button className="secondary-button" type="button" onClick={resetFilters}>
            {t("filterControls.resetFilter")}
          </button>
        </div>

        <FilterPresets presets={quickPresets} />
        <ActiveFilterChips chips={activeChips} onClearAll={resetFilters} />

        {filterOpen ? (
          <div className="history-filter-panel">
            <div className="history-filter-grid">
              <label className="history-filter-field">
                <span className="history-filter-title">{t("common.status")}</span>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="all">{t("filterControls.allStatuses")}</option>
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="history-filter-field">
                <span className="history-filter-title">{t("filterControls.from")}</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                />
              </label>
              <label className="history-filter-field">
                <span className="history-filter-title">{t("filterControls.to")}</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                />
              </label>
              <RangeField
                title={t("filterControls.amountBaht")}
                prefix="฿"
                minValue={amountMin}
                maxValue={amountMax}
                onMinChange={setAmountMin}
                onMaxChange={setAmountMax}
              />
            </div>
          </div>
        ) : null}
      </section>

      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("paymentBatch.historyEyebrow")}</p>
            <h3>{t("paymentBatch.historyTitle")}</h3>
          </div>
          <div className="transaction-table-actions">
            <button
              className="primary-button"
              type="button"
              onClick={() => setCreating(true)}
            >
              {t("paymentBatch.createButton")}
            </button>
            {shouldShowViewAll ? (
              <button
                className="secondary-button"
                type="button"
                onClick={() => setShowAllRows((value) => !value)}
              >
                {showAllRows ? t("common.showRecent") : t("common.viewMore")}
              </button>
            ) : null}
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="empty-copy">{t("paymentBatch.noMatch")}</p>
        ) : (
          <div
            className={
              isCompact
                ? "transaction-table-window partner-table-window compact-history"
                : "transaction-table-window partner-table-window"
            }
          >
            <div className="table-scroll desktop-table">
              <table className="transaction-history-table">
                <thead>
                  <tr>
                    <th className="table-index-cell">#</th>
                    <th>{t("paymentBatch.colReference")}</th>
                    <th>{t("paymentBatch.colSupplier")}</th>
                    <th>{t("paymentBatch.colCreated")}</th>
                    <th>{t("paymentBatch.colPlanned")}</th>
                    <th>{t("paymentBatch.colActual")}</th>
                    <th>{t("paymentBatch.colStatus")}</th>
                    <th>{t("paymentBatch.colTotal")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((batch, index) => (
                    <tr
                      key={batch.id}
                      className={
                        activeBatch?.id === batch.id
                          ? "partner-table-row active"
                          : "partner-table-row"
                      }
                    >
                      <td className="table-index-cell">{index + 1}</td>
                      <td>{batch.reference_no || batch.id}</td>
                      <td>{batch.supplier_name}</td>
                      <td>{formatDate(batch.batch_date)}</td>
                      <td>{formatDate(batch.planned_payment_date)}</td>
                      <td>{formatDate(batch.actual_payment_date)}</td>
                      <td>
                        <StatusPill status={batch.status} />
                      </td>
                      <td>{fmt(batch.total_amount)}</td>
                      <td>
                        <button
                          className="table-action-button"
                          type="button"
                          onClick={() => setActiveBatch(batch)}
                        >
                          {t("common.view")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mobile-record-list">
              {filtered.map((batch, index) => (
                <article
                  className="mobile-record-card"
                  key={`mobile-pb-${batch.id}`}
                >
                  <div className="mobile-record-header">
                    <div className="mobile-record-title">
                      <span className="mobile-record-index">{index + 1}</span>
                      <div className="cell-stack">
                        <strong>{batch.reference_no || batch.id}</strong>
                        <span>{batch.supplier_name}</span>
                      </div>
                    </div>
                    <StatusPill status={batch.status} />
                  </div>
                  <div className="mobile-record-grid">
                    <div>
                      <span>{t("paymentBatch.colCreated")}</span>
                      <strong>{formatDate(batch.batch_date)}</strong>
                    </div>
                    <div>
                      <span>{t("paymentBatch.colPlanned")}</span>
                      <strong>{formatDate(batch.planned_payment_date)}</strong>
                    </div>
                    <div>
                      <span>{t("paymentBatch.colActual")}</span>
                      <strong>{formatDate(batch.actual_payment_date)}</strong>
                    </div>
                    <div>
                      <span>{t("paymentBatch.colTotal")}</span>
                      <strong>{fmt(batch.total_amount)}</strong>
                    </div>
                  </div>
                  <button
                    className="secondary-button table-action-button mobile-record-button"
                    type="button"
                    onClick={() => setActiveBatch(batch)}
                  >
                    View
                  </button>
                </article>
              ))}
            </div>
          </div>
        )}
        <PaginationControls
          pagination={pagination}
          itemLabel={t("paymentBatch.historyTitle")}
          onPageChange={(page) => onPageRequest?.(getPageRequestParams(page))}
        />
      </section>

      {activeBatch ? (
        <PaymentBatchDetailModal
          key={activeBatch.id}
          paymentBatch={activeBatch}
          onClose={() => setActiveBatch(null)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      ) : null}
    </div>
  );
}

export default PaymentBatchPage;
