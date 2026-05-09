import { useEffect, useMemo, useState } from "react";
import { formatDate, formatMoney as fmt } from "../format";

const STATUS_LABELS = {
  draft: "Draft",
  scheduled: "Scheduled",
  partially_paid: "Partially Paid",
  paid: "Paid",
  cancelled: "Cancelled",
};

const STATUS_OPTIONS = [
  { value: "scheduled", label: "Scheduled" },
  { value: "partially_paid", label: "Partially Paid" },
  { value: "paid", label: "Paid" },
  { value: "cancelled", label: "Cancelled" },
];

function getToday() {
  return new Date().toISOString().split("T")[0];
}

function formatStatus(status) {
  return STATUS_LABELS[status] || status || "—";
}

function getNextReferenceNo(paymentBatches) {
  const today = new Date();
  const yearMonth = `${(today.getFullYear() + 543).toString().slice(-2)}${String(today.getMonth() + 1).padStart(2, "0")}`;
  const prefix = `PMT-${yearMonth}-`;
  const sameMonth = paymentBatches.filter((row) =>
    `${row.reference_no || ""}`.startsWith(prefix)
  );
  const next = sameMonth.length + 1;
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

function buildLinesFromPurchases(selectedPurchases) {
  return selectedPurchases.map((purchase) => ({
    id: `temp-line-${purchase.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    purchase: purchase.id,
    purchase_id: purchase.id,
    purchase_reference_no: purchase.reference_no,
    purchase_transaction_date: purchase.transaction_date,
    purchase_status: purchase.status,
    purchase_grand_total: purchase.grand_total,
    purchase_payment_term_type: purchase.payment_term_type,
    purchase_payment_term_days: purchase.payment_term_days,
    purchase_payment_date: purchase.payment_date,
    paid: false,
    paid_date: null,
    amount: Number(purchase.grand_total) || 0,
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

function batchMatchesQuery(batch, query) {
  const text = [
    batch.reference_no,
    batch.supplier_name,
    formatStatus(batch.status),
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
  const className = `status-badge status-${status || "scheduled"}`;
  return <span className={className}>{formatStatus(status)}</span>;
}

function CreatePaymentBatchModal({
  suppliers,
  purchases,
  paymentBatches,
  onClose,
  onCreate,
}) {
  const [supplierName, setSupplierName] = useState("");
  const [batchDate, setBatchDate] = useState(getToday());
  const [plannedPaymentDate, setPlannedPaymentDate] = useState("");
  const [bankReference, setBankReference] = useState("");
  const [note, setNote] = useState("");
  const [selectedPurchaseIds, setSelectedPurchaseIds] = useState(new Set());
  const [error, setError] = useState("");

  const supplierOptions = useMemo(() => {
    const fromSuppliers = suppliers
      .map((supplier) => `${supplier.companyName ?? ""}`.trim())
      .filter(Boolean);
    const fromPurchases = purchases
      .map((purchase) => `${purchase.supplier_name ?? ""}`.trim())
      .filter(Boolean);
    return Array.from(new Set([...fromSuppliers, ...fromPurchases])).sort();
  }, [suppliers, purchases]);

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
      .reduce((acc, p) => acc + (Number(p.grand_total) || 0), 0);
  }, [eligiblePurchases, selectedPurchaseIds]);

  function handleSubmit(event) {
    event.preventDefault();

    if (!supplierName) {
      setError("Choose a supplier first.");
      return;
    }

    const chosen = eligiblePurchases.filter((p) =>
      selectedPurchaseIds.has(p.id)
    );

    if (!chosen.length) {
      setError("Select at least one purchase order.");
      return;
    }

    const referenceNo = getNextReferenceNo(paymentBatches);
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
    <section className="section-card" aria-labelledby="pb-create-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Payment Batch</p>
          <h3 id="pb-create-title">Create Payment Batch</h3>
        </div>
        <button
          className="secondary-button table-action-button"
          type="button"
          onClick={onClose}
        >
          Cancel
        </button>
      </div>

      <form className="form-layout" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label>
            Supplier
            <select
              value={supplierName}
              onChange={(event) => {
                setSupplierName(event.target.value);
                setSelectedPurchaseIds(new Set());
                setError("");
              }}
            >
              <option value="">— Select supplier —</option>
              {supplierOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Batch Date
            <input
              type="date"
              value={batchDate}
              onChange={(event) => setBatchDate(event.target.value)}
            />
          </label>

          <label>
            Planned Payment Date
            <input
              type="date"
              value={plannedPaymentDate}
              onChange={(event) => setPlannedPaymentDate(event.target.value)}
            />
          </label>

          <label>
            Bank Reference
            <input
              value={bankReference}
              onChange={(event) => setBankReference(event.target.value)}
              placeholder="Optional"
            />
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
            <p className="eyebrow">Step 2</p>
            <h4>Choose Purchase Orders</h4>
          </div>
          <span>{selectedPurchaseIds.size} selected</span>
        </div>

        {supplierName ? (
          eligiblePurchases.length === 0 ? (
            <p className="empty-copy">
              No eligible purchases for this supplier. (POs must be received and not in another active payment batch.)
            </p>
          ) : (
            <>
              <div className="history-filter-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={selectAll}
                >
                  Select All
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={clearAll}
                >
                  Clear
                </button>
              </div>

              <div className="transaction-table-window">
                <div className="table-scroll desktop-table">
                  <table className="transaction-history-table partner-line-table">
                    <thead>
                      <tr>
                        <th />
                        <th>Reference</th>
                        <th>Date</th>
                        <th>Status</th>
                        <th>Payment Term</th>
                        <th>Payment Due</th>
                        <th>Amount</th>
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
                                ? `Credit (${purchase.payment_term_days || ""})`
                                : purchase.payment_term_type === "debit"
                                  ? "Debit"
                                  : "—"}
                            </td>
                            <td>{formatDate(purchase.payment_date)}</td>
                            <td>{fmt(purchase.grand_total)}</td>
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
          <p className="empty-copy">Select a supplier to see eligible purchases.</p>
        )}

        <div className="sales-summary-card">
          <div className="sales-summary-row sales-summary-grand">
            <strong>Total Amount</strong>
            <strong>{fmt(totalAmount)}</strong>
          </div>
        </div>

        {error ? <div className="error-banner">{error}</div> : null}

        <div className="supplier-modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" type="submit">
            Create Payment Batch
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
  const [draft, setDraft] = useState(paymentBatch);

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
    if (window.confirm("Cancel this payment batch? Purchases inside will be released.")) {
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
            <p className="eyebrow">Payment Batch</p>
            <h3 id="pb-detail-title">{draft.reference_no || draft.id}</h3>
          </div>
          <div className="section-heading-actions">
            <StatusPill status={draft.status} />
            <button
              type="button"
              className="icon-button subtle"
              aria-label="Close"
              onClick={onClose}
            >
              X
            </button>
          </div>
        </div>

        <form className="form-layout" onSubmit={handleSave}>
        <div className="form-grid">
          <label>
            Reference No.
            <input
              value={draft.reference_no || ""}
              onChange={(event) => updateField("reference_no", event.target.value)}
            />
          </label>

          <label>
            Supplier
            <input value={draft.supplier_name || ""} disabled />
          </label>

          <label>
            Batch Date
            <input
              type="date"
              value={draft.batch_date || ""}
              onChange={(event) => updateField("batch_date", event.target.value)}
            />
          </label>

          <label>
            Planned Payment Date
            <input
              type="date"
              value={draft.planned_payment_date || ""}
              onChange={(event) =>
                updateField("planned_payment_date", event.target.value)
              }
            />
          </label>

          <label>
            Actual Payment Date
            <input
              type="date"
              value={draft.actual_payment_date || ""}
              readOnly
            />
          </label>

          <label>
            Bank Reference
            <input
              value={draft.bank_reference || ""}
              onChange={(event) =>
                updateField("bank_reference", event.target.value)
              }
            />
          </label>

          <label className="full-width">
            Note
            <textarea
              rows="2"
              value={draft.note || ""}
              onChange={(event) => updateField("note", event.target.value)}
            />
          </label>
        </div>

        <div className="line-items-header">
          <div>
            <p className="eyebrow">Purchase Orders</p>
            <h4>Mark as Paid</h4>
          </div>
          <span>
            {(draft.lines || []).filter((line) => line.paid).length} /{" "}
            {(draft.lines || []).length} paid
          </span>
        </div>

        {!isCancelled && (draft.lines || []).length > 0 ? (
          <div className="history-filter-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={markAllPaid}
            >
              Mark All Paid
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={clearAllPaid}
            >
              Clear All
            </button>
          </div>
        ) : null}

        <div className="transaction-table-window">
          <div className="table-scroll partner-line-scroll desktop-table">
            <table className="transaction-history-table partner-line-table">
              <thead>
                <tr>
                  <th>Paid?</th>
                  <th>Reference</th>
                  <th>PO Date</th>
                  <th>Payment Term</th>
                  <th>Payment Due</th>
                  <th>Paid Date</th>
                  <th>Amount</th>
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
                    <td>{line.purchase_reference_no || line.purchase}</td>
                    <td>{formatDate(line.purchase_transaction_date)}</td>
                    <td>
                      {line.purchase_payment_term_type === "credit"
                        ? `Credit (${line.purchase_payment_term_days || ""})`
                        : line.purchase_payment_term_type === "debit"
                          ? "Debit"
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
                    <td>{fmt(line.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="6" style={{ textAlign: "right" }}>
                    <strong>Total</strong>
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
            Delete
          </button>
          {!isCancelled ? (
            <button
              type="button"
              className="secondary-button"
              onClick={handleCancelBatch}
            >
              Cancel Payment Batch
            </button>
          ) : null}
          <button type="button" className="secondary-button" onClick={onClose}>
            Close
          </button>
          <button type="submit" className="primary-button">
            Save
          </button>
        </div>
      </form>
      </div>
    </div>
  );
}

function PaymentBatchPage({
  paymentBatches = [],
  suppliers = [],
  purchases = [],
  onCreatePaymentBatch,
  onUpdatePaymentBatch,
  onDeletePaymentBatch,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [showAllRows, setShowAllRows] = useState(false);
  const [creating, setCreating] = useState(false);
  const [activeBatch, setActiveBatch] = useState(null);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filtered = useMemo(() => {
    return paymentBatches.filter((batch) => {
      if (normalizedSearch && !batchMatchesQuery(batch, normalizedSearch)) {
        return false;
      }
      if (statusFilter !== "all" && batch.status !== statusFilter) {
        return false;
      }
      if (!batchInDateRange(batch, dateFrom, dateTo)) {
        return false;
      }
      return true;
    });
  }, [paymentBatches, normalizedSearch, statusFilter, dateFrom, dateTo]);

  const compactRows = 5;
  const shouldShowViewAll = filtered.length > compactRows;
  const isCompact = shouldShowViewAll && !showAllRows;

  const summary = useMemo(() => {
    const today = getToday();
    let outstanding = 0;
    let overdue = 0;
    let paid = 0;
    paymentBatches.forEach((batch) => {
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
  }, [paymentBatches]);

  const activeFilterCount =
    (statusFilter !== "all" ? 1 : 0) + (dateFrom || dateTo ? 1 : 0);

  function resetFilters() {
    setSearchTerm("");
    setStatusFilter("all");
    setDateFrom("");
    setDateTo("");
    setFilterOpen(false);
  }

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
    if (!window.confirm(`Delete payment batch ${batch.reference_no || batch.id}?`)) {
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
          paymentBatches={paymentBatches}
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
            <p className="eyebrow">Payables</p>
            <h3>Payment Batches (Pay Suppliers)</h3>
          </div>
        </div>

        <div className="dashboard-summary-grid">
          <article className="dashboard-kpi-card neutral">
            <p>Outstanding</p>
            <strong>{fmt(summary.outstanding)}</strong>
            <span>Not yet paid to suppliers</span>
          </article>
          <article className="dashboard-kpi-card danger">
            <p>Overdue</p>
            <strong>{fmt(summary.overdue)}</strong>
            <span>Past planned payment date</span>
          </article>
          <article className="dashboard-kpi-card positive">
            <p>Paid</p>
            <strong>{fmt(summary.paid)}</strong>
            <span>Fully paid batches</span>
          </article>
        </div>
      </section>

      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Search</p>
            <h3>Find Payment Batches</h3>
          </div>
        </div>

        <div className="supplier-directory-toolbar">
          <label className="stock-search supplier-search">
            <span className="stock-search-icon">S</span>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search reference, supplier, status, PO ref"
            />
          </label>
          <div className="stock-report-summary supplier-search-meta">
            <span>
              {filtered.length} of {paymentBatches.length} shown
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
            Filter
            {activeFilterCount ? <span>{activeFilterCount}</span> : null}
          </button>
          <button className="secondary-button" type="button" onClick={resetFilters}>
            Reset Filter
          </button>
        </div>

        {filterOpen ? (
          <div className="history-filter-panel">
            <div className="history-filter-grid">
              <label className="history-filter-field">
                <span className="history-filter-title">Status</span>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="all">All statuses</option>
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="history-filter-field">
                <span className="history-filter-title">From</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                />
              </label>
              <label className="history-filter-field">
                <span className="history-filter-title">To</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                />
              </label>
            </div>
          </div>
        ) : null}
      </section>

      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">History</p>
            <h3>Payment Batches</h3>
          </div>
          <div className="transaction-table-actions">
            <button
              className="primary-button"
              type="button"
              onClick={() => setCreating(true)}
            >
              Create Payment Batch
            </button>
            {shouldShowViewAll ? (
              <button
                className="secondary-button"
                type="button"
                onClick={() => setShowAllRows((value) => !value)}
              >
                {showAllRows ? "Show Recent" : "View More"}
              </button>
            ) : null}
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="empty-copy">No payment batches match the current search.</p>
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
                    <th>Reference</th>
                    <th>Supplier</th>
                    <th>Created</th>
                    <th>Planned</th>
                    <th>Actual</th>
                    <th>Status</th>
                    <th>Total</th>
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
                          View
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
                      <span>Created</span>
                      <strong>{formatDate(batch.batch_date)}</strong>
                    </div>
                    <div>
                      <span>Planned</span>
                      <strong>{formatDate(batch.planned_payment_date)}</strong>
                    </div>
                    <div>
                      <span>Actual</span>
                      <strong>{formatDate(batch.actual_payment_date)}</strong>
                    </div>
                    <div>
                      <span>Total</span>
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
