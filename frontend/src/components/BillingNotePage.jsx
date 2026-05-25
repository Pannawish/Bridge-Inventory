import { useEffect, useMemo, useState } from "react";
import { formatDate, formatMoney as fmt } from "../format";
import EligiblePartyCombobox from "./EligiblePartyCombobox";
import PaginationControls from "./PaginationControls";
import DocumentRefChip from "./DocumentRefChip";
import DocumentRefModal from "./DocumentRefModal";
import {
  FilterPresets,
  ActiveFilterChips,
  RangeField,
  withinRange,
} from "./FilterControls";
import { useLanguage } from "../i18n/LanguageContext";

const STATUS_LABEL_KEYS = {
  draft: "billingNote.statusDraft",
  issued: "billingNote.statusIssued",
  partially_received: "billingNote.statusPartiallyReceived",
  fully_received: "billingNote.statusFullyReceived",
  cancelled: "billingNote.statusCancelled",
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

function getNextReferenceNo(billingNotes) {
  const today = new Date();
  const yearMonth = `${(today.getFullYear() + 543).toString().slice(-2)}${String(today.getMonth() + 1).padStart(2, "0")}`;
  const prefix = `BN-${yearMonth}-`;
  const referencePattern = new RegExp(`^${prefix}(\\d+)$`);
  const maxSerial = billingNotes.reduce((max, row) => {
    const match = `${row.reference_no || ""}`.match(referencePattern);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  const next = maxSerial + 1;
  return `${prefix}${String(next).padStart(3, "0")}`;
}

function isSaleAvailableForBillingNote(sale, billingNotes, currentBillingNoteId = null) {
  const eligibleStatuses = new Set(["delivered", "partially_delivered", "shipped"]);
  if (!eligibleStatuses.has(sale.status)) {
    return false;
  }

  return !billingNotes.some(
    (note) =>
      note.id !== currentBillingNoteId &&
      note.status !== "cancelled" &&
      (note.lines || []).some((line) => `${line.sale}` === `${sale.id}`)
  );
}

function buildLinesFromSales(selectedSales) {
  return selectedSales.map((sale) => ({
    id: `temp-line-${sale.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    sale: sale.id,
    sale_id: sale.id,
    sale_reference_no: sale.reference_no,
    sale_transaction_date: sale.transaction_date,
    sale_status: sale.status,
    sale_grand_total: sale.grand_total,
    sale_payment_term_type: sale.payment_term_type,
    sale_payment_term_days: sale.payment_term_days,
    sale_payment_date: sale.payment_date,
    received: false,
    received_date: null,
    amount: Number(sale.grand_total) || 0,
  }));
}

function computeStatusFromLines(lines, currentStatus) {
  if (currentStatus === "cancelled" || currentStatus === "draft") {
    return currentStatus;
  }
  if (!lines.length) return "issued";
  const receivedCount = lines.filter((line) => line.received).length;
  if (receivedCount === 0) return "issued";
  if (receivedCount === lines.length) return "fully_received";
  return "partially_received";
}

function computeActualPaymentDate(lines) {
  const dates = lines
    .filter((line) => line.received && line.received_date)
    .map((line) => line.received_date);
  if (!dates.length) return null;
  return dates.reduce((max, current) => (current > max ? current : max));
}

function billingNoteMatchesQuery(note, query, t) {
  const text = [
    note.reference_no,
    note.customer_name,
    formatStatus(note.status, t),
    note.billing_note_date,
    note.expected_payment_date,
    note.actual_payment_date,
    note.bank_reference,
    note.note,
    ...(note.lines || []).flatMap((line) => [
      line.sale_reference_no,
      line.received_date,
    ]),
  ]
    .map((value) => `${value ?? ""}`.toLowerCase())
    .join(" ");
  return text.includes(query);
}

function billingNoteInDateRange(note, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return true;
  const date = note.billing_note_date || "";
  if (dateFrom && date < dateFrom) return false;
  if (dateTo && date > dateTo) return false;
  return true;
}

function StatusPill({ status }) {
  const { t } = useLanguage();
  const className = `status-badge status-${status || "issued"}`;
  return <span className={className}>{formatStatus(status, t)}</span>;
}

function CreateBillingNoteModal({
  sales,
  billingNotes,
  nextReferenceNo = "",
  onClose,
  onCreate,
}) {
  const { t } = useLanguage();
  const [customerName, setCustomerName] = useState("");
  const [billingNoteDate, setBillingNoteDate] = useState(getToday());
  const [expectedPaymentDate, setExpectedPaymentDate] = useState("");
  const [bankReference, setBankReference] = useState("");
  const [note, setNote] = useState("");
  const [selectedSaleIds, setSelectedSaleIds] = useState(new Set());
  const [error, setError] = useState("");

  const customerOptions = useMemo(() => {
    const set = new Set(
      sales
        .filter((sale) => isSaleAvailableForBillingNote(sale, billingNotes))
        .map((sale) => `${sale.customer_name ?? ""}`.trim())
        .filter(Boolean)
    );
    return Array.from(set).sort();
  }, [sales, billingNotes]);

  const eligibleSales = useMemo(() => {
    if (!customerName) return [];
    return sales.filter(
      (sale) =>
        sale.customer_name === customerName &&
        isSaleAvailableForBillingNote(sale, billingNotes)
    );
  }, [customerName, sales, billingNotes]);

  function toggleSale(saleId) {
    setSelectedSaleIds((current) => {
      const next = new Set(current);
      if (next.has(saleId)) {
        next.delete(saleId);
      } else {
        next.add(saleId);
      }
      return next;
    });
  }

  function selectAll() {
    setSelectedSaleIds(new Set(eligibleSales.map((sale) => sale.id)));
  }

  function clearAll() {
    setSelectedSaleIds(new Set());
  }

  const totalAmount = useMemo(() => {
    return eligibleSales
      .filter((sale) => selectedSaleIds.has(sale.id))
      .reduce((acc, sale) => acc + (Number(sale.grand_total) || 0), 0);
  }, [eligibleSales, selectedSaleIds]);

  function handleSubmit(event) {
    event.preventDefault();

    if (!customerName) {
      setError(t("billingNote.selectCustomerFirst"));
      return;
    }

    const chosenSales = eligibleSales.filter((sale) =>
      selectedSaleIds.has(sale.id)
    );

    if (!chosenSales.length) {
      setError(t("billingNote.noEligibleSales"));
      return;
    }

    const referenceNo = nextReferenceNo || getNextReferenceNo(billingNotes);
    const lines = buildLinesFromSales(chosenSales);

    onCreate({
      reference_no: referenceNo,
      customer_name: customerName,
      billing_note_date: billingNoteDate || getToday(),
      expected_payment_date: expectedPaymentDate || null,
      actual_payment_date: null,
      status: "issued",
      bank_reference: bankReference,
      note,
      total_amount: totalAmount,
      lines,
    });
  }

  return (
    <section className="section-card billing-note-create-card" aria-labelledby="bn-create-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("billingNote.eyebrow")}</p>
          <h3 id="bn-create-title">{t("billingNote.createTitle")}</h3>
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
            id="billing-note-customer"
            label={t("billingNote.customerLabel")}
            value={customerName}
            options={customerOptions}
            placeholder={t("billingNote.searchPlaceholder")}
            emptyMessage={t("billingNote.noEligibleSales")}
            onChange={(nextCustomerName) => {
              setCustomerName(nextCustomerName);
              setSelectedSaleIds(new Set());
              setError("");
            }}
          />

          <label>
            {t("billingNote.dateLabel")}
            <input
              type="date"
              value={billingNoteDate}
              onChange={(event) => setBillingNoteDate(event.target.value)}
            />
          </label>

          <label>
            {t("billingNote.expectedPaymentDate")}
            <input
              type="date"
              value={expectedPaymentDate}
              onChange={(event) => setExpectedPaymentDate(event.target.value)}
            />
          </label>

          <label>
            {t("billingNote.bankReference")}
            <input
              value={bankReference}
              onChange={(event) => setBankReference(event.target.value)}
              placeholder={t("common.optional")}
            />
          </label>

          <label className="full-width">
            {t("billingNote.noteLabel")}
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
            <p className="eyebrow">{t("billingNote.step2")}</p>
            <h4>{t("billingNote.chooseSales")}</h4>
          </div>
          <span>{t("billingNote.selectedCount", { count: selectedSaleIds.size })}</span>
        </div>

        {customerName ? (
          eligibleSales.length === 0 ? (
            <p className="empty-copy">
              {t("billingNote.noEligibleSales")}
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

              <div className="transaction-table-window billing-note-create-table-window">
                <div className="table-scroll billing-note-create-scroll">
                  <table className="transaction-history-table partner-line-table billing-note-create-table">
                    <colgroup>
                      <col className="billing-note-select-col" />
                      <col className="billing-note-reference-col" />
                      <col className="billing-note-date-col" />
                      <col className="billing-note-status-col" />
                      <col className="billing-note-term-col" />
                      <col className="billing-note-date-col" />
                      <col className="billing-note-amount-col" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th />
                        <th>{t("billingNote.colReference")}</th>
                        <th>{t("billingNote.colSaleDate")}</th>
                        <th>{t("common.status")}</th>
                        <th>{t("billingNote.colPaymentTerm")}</th>
                        <th>{t("billingNote.colPaymentDue")}</th>
                        <th>{t("billingNote.colAmount")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {eligibleSales.map((sale) => {
                        const checked = selectedSaleIds.has(sale.id);
                        return (
                          <tr
                            key={sale.id}
                            className={checked ? "partner-table-row active" : "partner-table-row"}
                          >
                            <td>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleSale(sale.id)}
                              />
                            </td>
                            <td>{sale.reference_no || sale.id}</td>
                            <td>{formatDate(sale.transaction_date)}</td>
                            <td>
                              <span className={`status-badge status-${sale.status}`}>
                                {sale.status?.replace(/_/g, " ")}
                              </span>
                            </td>
                            <td>
                              {sale.payment_term_type === "credit"
                                ? t("billingNote.paymentCreditTerm", { days: sale.payment_term_days || "" })
                                : sale.payment_term_type === "debit"
                                  ? t("billingNote.paymentDebitTerm")
                                  : "—"}
                            </td>
                            <td>{formatDate(sale.payment_date)}</td>
                            <td>{fmt(sale.grand_total)}</td>
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
          <p className="empty-copy">{t("billingNote.selectCustomerFirst")}</p>
        )}

        <div className="sales-summary-card">
          <div className="sales-summary-row sales-summary-grand">
            <strong>{t("billingNote.totalAmount")}</strong>
            <strong>{fmt(totalAmount)}</strong>
          </div>
        </div>

        {error ? <div className="error-banner">{error}</div> : null}

        <div className="supplier-modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button className="primary-button" type="submit">
            {t("billingNote.createButton")}
          </button>
        </div>
      </form>
    </section>
  );
}

function BillingNoteDetailModal({
  billingNote,
  onClose,
  onSave,
  onDelete,
}) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState(billingNote);
  const [docRefModal, setDocRefModal] = useState(null);

  useEffect(() => {
    setDraft(billingNote);
  }, [billingNote]);

  function updateField(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function toggleLineReceived(lineId) {
    setDraft((current) => {
      const lines = (current.lines || []).map((line) => {
        if (line.id !== lineId) return line;
        const nextReceived = !line.received;
        return {
          ...line,
          received: nextReceived,
          received_date: nextReceived
            ? line.received_date || getToday()
            : null,
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

  function updateLineReceivedDate(lineId, value) {
    setDraft((current) => {
      const lines = (current.lines || []).map((line) =>
        line.id === lineId ? { ...line, received_date: value } : line
      );
      return {
        ...current,
        lines,
        actual_payment_date: computeActualPaymentDate(lines),
      };
    });
  }

  function markAllReceived() {
    setDraft((current) => {
      const today = getToday();
      const lines = (current.lines || []).map((line) => ({
        ...line,
        received: true,
        received_date: line.received_date || today,
      }));
      return {
        ...current,
        lines,
        status: computeStatusFromLines(lines, current.status),
        actual_payment_date: computeActualPaymentDate(lines),
      };
    });
  }

  function clearAllReceived() {
    setDraft((current) => {
      const lines = (current.lines || []).map((line) => ({
        ...line,
        received: false,
        received_date: null,
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

  function handleCancelBN() {
    if (window.confirm(t("billingNote.cancelBNConfirm"))) {
      onSave({ ...draft, status: "cancelled" });
    }
  }

  const isCancelled = draft.status === "cancelled";
  const creditTotal = (draft.credit_notes || [])
    .filter((credit) => credit.status !== "cancelled")
    .reduce((acc, credit) => acc + (Number(credit.total_amount) || 0), 0);
  const netPayable = (Number(draft.total_amount) || 0) - creditTotal;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="detail-modal transaction-detail-modal section-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bn-detail-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("billingNote.eyebrow")}</p>
            <h3 id="bn-detail-title">{draft.reference_no || draft.id}</h3>
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
            {t("billingNote.referenceNo")}
            <input
              value={draft.reference_no || ""}
              onChange={(event) => updateField("reference_no", event.target.value)}
            />
          </label>

          <label>
            {t("billingNote.customerLabel")}
            <input value={draft.customer_name || ""} disabled />
          </label>

          <label>
            {t("billingNote.dateLabel")}
            <input
              type="date"
              value={draft.billing_note_date || ""}
              onChange={(event) =>
                updateField("billing_note_date", event.target.value)
              }
            />
          </label>

          <label>
            {t("billingNote.expectedPaymentDate")}
            <input
              type="date"
              value={draft.expected_payment_date || ""}
              onChange={(event) =>
                updateField("expected_payment_date", event.target.value)
              }
            />
          </label>

          <label>
            {t("billingNote.actualPaymentDate")}
            <input
              type="date"
              value={draft.actual_payment_date || ""}
              readOnly
            />
          </label>

          <label>
            {t("billingNote.bankReference")}
            <input
              value={draft.bank_reference || ""}
              onChange={(event) =>
                updateField("bank_reference", event.target.value)
              }
            />
          </label>

          <label className="full-width">
            {t("billingNote.noteLabel")}
            <textarea
              rows="2"
              value={draft.note || ""}
              onChange={(event) => updateField("note", event.target.value)}
            />
          </label>
        </div>

        <div className="line-items-header">
          <div>
            <p className="eyebrow">{t("billingNote.salesOrdersEyebrow")}</p>
            <h4>{t("billingNote.receivePayment")}</h4>
          </div>
          <span>
            {t("billingNote.receivedFraction", {
              received: (draft.lines || []).filter((line) => line.received).length,
              total: (draft.lines || []).length,
            })}
          </span>
        </div>

        {!isCancelled && (draft.lines || []).length > 0 ? (
          <div className="history-filter-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={markAllReceived}
            >
              {t("billingNote.markAllReceived")}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={clearAllReceived}
            >
              {t("billingNote.clearAll")}
            </button>
          </div>
        ) : null}

        <div className="transaction-table-window">
          <div className="table-scroll partner-line-scroll desktop-table">
            <table className="transaction-history-table partner-line-table">
              <thead>
                <tr>
                  <th>{t("billingNote.colReceived")}</th>
                  <th>{t("billingNote.colReference")}</th>
                  <th>{t("billingNote.colSaleDate")}</th>
                  <th>{t("billingNote.colPaymentTerm")}</th>
                  <th>{t("billingNote.colPaymentDue")}</th>
                  <th>{t("billingNote.colPaymentReceivedDate")}</th>
                  <th>{t("billingNote.colAmount")}</th>
                </tr>
              </thead>
              <tbody>
                {(draft.lines || []).map((line) => (
                  <tr
                    key={line.id}
                    className={line.received ? "partner-table-row active" : "partner-table-row"}
                  >
                    <td>
                      <input
                        type="checkbox"
                        checked={line.received}
                        disabled={isCancelled}
                        onChange={() => toggleLineReceived(line.id)}
                      />
                    </td>
                    <td>
                      <DocumentRefChip
                        label={line.sale_reference_no || line.sale_id || line.sale}
                        docType="sale"
                        onClick={() =>
                          setDocRefModal({
                            docType: "sale",
                            docId: line.sale_id || line.sale,
                            referenceNo: line.sale_reference_no || line.sale_id || line.sale,
                          })
                        }
                      />
                    </td>
                    <td>{formatDate(line.sale_transaction_date)}</td>
                    <td>
                      {line.sale_payment_term_type === "credit"
                        ? t("billingNote.paymentCreditTerm", { days: line.sale_payment_term_days || "" })
                        : line.sale_payment_term_type === "debit"
                          ? t("billingNote.paymentDebitTerm")
                          : "—"}
                    </td>
                    <td>{formatDate(line.sale_payment_date)}</td>
                    <td>
                      {line.received ? (
                        <input
                          type="date"
                          value={line.received_date || ""}
                          onChange={(event) =>
                            updateLineReceivedDate(line.id, event.target.value)
                          }
                          disabled={isCancelled}
                        />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{fmt(line.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="6" style={{ textAlign: "right" }}>
                    <strong>{t("billingNote.colTotal")}</strong>
                  </td>
                  <td>
                    <strong>{fmt(draft.total_amount)}</strong>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {(draft.credit_notes || []).length > 0 ? (
          <>
            <div className="line-items-header">
              <div>
                <p className="eyebrow">{t("billingNote.creditNotesEyebrow")}</p>
                <h4>{t("billingNote.appliedCredits")}</h4>
              </div>
              <span>{t("billingNote.appliedCount", { count: (draft.credit_notes || []).length })}</span>
            </div>

            <div className="transaction-table-window">
              <div className="table-scroll partner-line-scroll desktop-table">
                <table className="transaction-history-table partner-line-table">
                  <thead>
                    <tr>
                      <th>{t("billingNote.colReference")}</th>
                      <th>{t("billingNote.colIssued")}</th>
                      <th>{t("billingNote.colStatus")}</th>
                      <th>{t("billingNote.colAmount")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(draft.credit_notes || []).map((credit) => (
                      <tr key={credit.id} className="partner-table-row">
                        <td>
                          <DocumentRefChip
                            label={credit.reference_no || credit.id}
                            docType="credit-note"
                            onClick={() =>
                              setDocRefModal({
                                docType: "credit-note",
                                docId: credit.id,
                                referenceNo: credit.reference_no || credit.id,
                              })
                            }
                          />
                        </td>
                        <td>{formatDate(credit.credit_note_date)}</td>
                        <td>
                          <StatusPill status={credit.status} />
                        </td>
                        <td>{fmt(credit.total_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="sales-summary-card">
              <div className="sales-summary-row">
                <span>{t("billingNote.totalBilled")}</span>
                <span>{fmt(draft.total_amount)}</span>
              </div>
              <div className="sales-summary-row">
                <span>{t("billingNote.lessCredits")}</span>
                <span>{fmt(creditTotal)}</span>
              </div>
              <div className="sales-summary-row sales-summary-grand">
                <strong>{t("billingNote.netPayable")}</strong>
                <strong>{fmt(netPayable)}</strong>
              </div>
            </div>
          </>
        ) : null}

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
              onClick={handleCancelBN}
            >
              {t("billingNote.cancelBN")}
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

function BillingNotePage({
  billingNotes = [],
  allBillingNotes = billingNotes,
  customers = [],
  sales = [],
  summary: serverSummary = null,
  nextReferenceNo = "",
  pagination = null,
  onPageRequest,
  onCreateBillingNote,
  onUpdateBillingNote,
  onDeleteBillingNote,
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
  const [activeBillingNote, setActiveBillingNote] = useState(null);
  const STATUS_OPTIONS = [
    { value: "issued", label: t("billingNote.statusIssued") },
    { value: "partially_received", label: t("billingNote.statusPartiallyReceived") },
    { value: "fully_received", label: t("billingNote.statusFullyReceived") },
    { value: "cancelled", label: t("billingNote.statusCancelled") },
  ];

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const isServerPaginated = Boolean(pagination && onPageRequest);
  const filtered = useMemo(() => {
    if (isServerPaginated) {
      return billingNotes;
    }

    return billingNotes.filter((note) => {
      if (normalizedSearch && !billingNoteMatchesQuery(note, normalizedSearch, t)) {
        return false;
      }
      if (statusFilter !== "all" && note.status !== statusFilter) {
        return false;
      }
      if (!billingNoteInDateRange(note, dateFrom, dateTo)) {
        return false;
      }
      if (!withinRange(note.total_amount, amountMin, amountMax)) {
        return false;
      }
      return true;
    });
  }, [
    amountMin,
    amountMax,
    billingNotes,
    dateFrom,
    dateTo,
    isServerPaginated,
    normalizedSearch,
    statusFilter,
  ]);

  const compactRows = 5;
  const shouldShowViewAll = !isServerPaginated && filtered.length > compactRows;
  const isCompact = shouldShowViewAll && !showAllRows;
  const totalBillingNoteCount = pagination?.count ?? billingNotes.length;

  const computedSummary = useMemo(() => {
    const today = getToday();
    let outstanding = 0;
    let overdue = 0;
    let received = 0;
    allBillingNotes.forEach((note) => {
      if (note.status === "fully_received") {
        received += Number(note.total_amount) || 0;
      } else if (note.status !== "cancelled") {
        outstanding += Number(note.total_amount) || 0;
        if (note.expected_payment_date && note.expected_payment_date < today) {
          overdue += Number(note.total_amount) || 0;
        }
      }
    });
    return { outstanding, overdue, received };
  }, [allBillingNotes]);
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
      label: t("billingNote.filterLastDays"),
      active: last30Active,
      onClick: () => {
        setDateFrom(last30Active ? "" : daysAgoString(30));
        setDateTo("");
      },
    },
    {
      label: t("billingNote.filterAwaiting"),
      active: statusFilter === "issued",
      onClick: () =>
        setStatusFilter((current) =>
          current === "issued" ? "all" : "issued"
        ),
    },
    {
      label: t("billingNote.filterFullyReceived"),
      active: statusFilter === "fully_received",
      onClick: () =>
        setStatusFilter((current) =>
          current === "fully_received" ? "all" : "fully_received"
        ),
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
    const saved = await onCreateBillingNote?.(payload);
    if (saved !== false) {
      setCreating(false);
    }
  }

  async function handleSave(updated) {
    const saved = await onUpdateBillingNote?.(updated);
    if (saved !== false) {
      setActiveBillingNote(null);
    }
  }

  async function handleDelete(note) {
    if (!window.confirm(t("billingNote.deleteBN", { ref: note.reference_no || note.id }))) {
      return;
    }
    const ok = await onDeleteBillingNote?.(note);
    if (ok !== false) {
      setActiveBillingNote(null);
    }
  }

  if (creating) {
    return (
      <div className="stack-layout">
        <CreateBillingNoteModal
          customers={customers}
          sales={sales}
          billingNotes={allBillingNotes}
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
            <p className="eyebrow">{t("billingNote.receivablesEyebrow")}</p>
            <h3>{t("billingNote.receivablesTitle")}</h3>
          </div>
        </div>

        <div className="dashboard-summary-grid">
          <article className="dashboard-kpi-card neutral">
            <p>{t("billingNote.outstanding")}</p>
            <strong>{fmt(summary.outstanding)}</strong>
            <span>{t("billingNote.outstandingDesc")}</span>
          </article>
          <article className="dashboard-kpi-card danger">
            <p>{t("billingNote.overdue")}</p>
            <strong>{fmt(summary.overdue)}</strong>
            <span>{t("billingNote.overdueDesc")}</span>
          </article>
          <article className="dashboard-kpi-card positive">
            <p>{t("billingNote.received")}</p>
            <strong>{fmt(summary.received)}</strong>
            <span>{t("billingNote.receivedDesc")}</span>
          </article>
        </div>
      </section>

      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("billingNote.searchEyebrow")}</p>
            <h3>{t("billingNote.searchTitle")}</h3>
          </div>
        </div>

        <div className="supplier-directory-toolbar">
          <label className="stock-search supplier-search">
            <span className="stock-search-icon">S</span>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={t("billingNote.searchPlaceholder")}
            />
          </label>
          <div className="stock-report-summary supplier-search-meta">
            <span>
              {isServerPaginated
                ? t("billingNote.pageCountServer", { count: filtered.length, total: totalBillingNoteCount })
                : t("billingNote.pageCountLocal", { count: filtered.length, total: billingNotes.length })}
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
            <p className="eyebrow">{t("billingNote.historyEyebrow")}</p>
            <h3>{t("billingNote.historyTitle")}</h3>
          </div>
          <div className="transaction-table-actions">
            <button
              className="primary-button"
              type="button"
              onClick={() => setCreating(true)}
            >
              {t("billingNote.createButton")}
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
          <p className="empty-copy">{t("billingNote.noMatch")}</p>
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
                    <th>{t("billingNote.colReference")}</th>
                    <th>{t("billingNote.colCustomer")}</th>
                    <th>{t("billingNote.colIssued")}</th>
                    <th>{t("billingNote.colExpected")}</th>
                    <th>{t("billingNote.colActual")}</th>
                    <th>{t("billingNote.colStatus")}</th>
                    <th>{t("billingNote.colTotal")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((note, index) => (
                    <tr
                      key={note.id}
                      className={
                        activeBillingNote?.id === note.id
                          ? "partner-table-row active"
                          : "partner-table-row"
                      }
                    >
                      <td className="table-index-cell">{index + 1}</td>
                      <td>{note.reference_no || note.id}</td>
                      <td>{note.customer_name}</td>
                      <td>{formatDate(note.billing_note_date)}</td>
                      <td>{formatDate(note.expected_payment_date)}</td>
                      <td>{formatDate(note.actual_payment_date)}</td>
                      <td>
                        <StatusPill status={note.status} />
                      </td>
                      <td>{fmt(note.total_amount)}</td>
                      <td>
                        <button
                          className="table-action-button"
                          type="button"
                          onClick={() => setActiveBillingNote(note)}
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
              {filtered.map((note, index) => (
                <article
                  className="mobile-record-card"
                  key={`mobile-bn-${note.id}`}
                >
                  <div className="mobile-record-header">
                    <div className="mobile-record-title">
                      <span className="mobile-record-index">{index + 1}</span>
                      <div className="cell-stack">
                        <strong>{note.reference_no || note.id}</strong>
                        <span>{note.customer_name}</span>
                      </div>
                    </div>
                    <StatusPill status={note.status} />
                  </div>
                  <div className="mobile-record-grid">
                    <div>
                      <span>{t("billingNote.colIssued")}</span>
                      <strong>{formatDate(note.billing_note_date)}</strong>
                    </div>
                    <div>
                      <span>{t("billingNote.colExpected")}</span>
                      <strong>{formatDate(note.expected_payment_date)}</strong>
                    </div>
                    <div>
                      <span>{t("billingNote.colActual")}</span>
                      <strong>{formatDate(note.actual_payment_date)}</strong>
                    </div>
                    <div>
                      <span>{t("billingNote.colTotal")}</span>
                      <strong>{fmt(note.total_amount)}</strong>
                    </div>
                  </div>
                  <button
                    className="secondary-button table-action-button mobile-record-button"
                    type="button"
                    onClick={() => setActiveBillingNote(note)}
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
          itemLabel={t("billingNote.historyTitle")}
          onPageChange={(page) => onPageRequest?.(getPageRequestParams(page))}
        />
      </section>

      {activeBillingNote ? (
        <BillingNoteDetailModal
          key={activeBillingNote.id}
          billingNote={activeBillingNote}
          onClose={() => setActiveBillingNote(null)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      ) : null}
    </div>
  );
}

export default BillingNotePage;
