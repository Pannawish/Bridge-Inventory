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

const STATUS_LABELS = {
  issued: "Issued",
  cancelled: "Cancelled",
};

const STATUS_OPTIONS = [
  { value: "issued", label: "Issued" },
  { value: "cancelled", label: "Cancelled" },
];

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

function formatStatus(status) {
  return STATUS_LABELS[status] || status || "—";
}

function getNextReferenceNo(creditNotes) {
  const today = new Date();
  const yearMonth = `${(today.getFullYear() + 543).toString().slice(-2)}${String(
    today.getMonth() + 1
  ).padStart(2, "0")}`;
  const prefix = `CN-${yearMonth}-`;
  const referencePattern = new RegExp(`^${prefix}(\\d+)$`);
  const maxSerial = creditNotes.reduce((max, row) => {
    const match = `${row.reference_no || ""}`.match(referencePattern);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `${prefix}${String(maxSerial + 1).padStart(3, "0")}`;
}

function creditNoteMatchesQuery(note, query) {
  const text = [
    note.reference_no,
    note.customer_name,
    note.sale_reference_no,
    note.billing_note_reference_no,
    formatStatus(note.status),
    note.credit_note_date,
    note.note,
    ...(note.lines || []).map((line) => line.product_name),
  ]
    .map((value) => `${value ?? ""}`.toLowerCase())
    .join(" ");
  return text.includes(query);
}

function creditNoteInDateRange(note, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return true;
  const date = note.credit_note_date || "";
  if (dateFrom && date < dateFrom) return false;
  if (dateTo && date > dateTo) return false;
  return true;
}

function StatusPill({ status }) {
  return (
    <span className={`status-badge status-${status || "issued"}`}>
      {formatStatus(status)}
    </span>
  );
}

function customerBillingNoteOptions(billingNotes, customerName, includeId = "") {
  return billingNotes.filter(
    (note) =>
      note.customer_name === customerName &&
      (note.status !== "cancelled" || note.id === includeId)
  );
}

function CreateCreditNoteModal({
  sales,
  billingNotes,
  creditNotes,
  nextReferenceNo = "",
  onClose,
  onCreate,
}) {
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
      setError("Choose a customer first.");
      return;
    }
    if (!selectedSale) {
      setError("Choose the sale that has cancelled or returned items.");
      return;
    }

    const chosenLines = cancelledLines.filter((line) =>
      selectedLineIds.has(line.sale_item)
    );
    if (!chosenLines.length) {
      setError("Select at least one cancelled or returned item to credit.");
      return;
    }

    onCreate({
      reference_no: nextReferenceNo || getNextReferenceNo(creditNotes),
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
          <p className="eyebrow">Credit Note</p>
          <h3 id="cn-create-title">Create Credit Note</h3>
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
          <EligiblePartyCombobox
            id="credit-note-customer"
            label="Customer"
            value={customerName}
            options={customerOptions}
            placeholder="Search customer with cancelled or returned items"
            emptyMessage="No customers have cancelled or returned sale items."
            onChange={(nextCustomerName) => {
              setCustomerName(nextCustomerName);
              setSaleId("");
              setBillingNoteId("");
              setSelectedLineIds(new Set());
              setError("");
            }}
          />

          <label>
            Credit Note Date
            <input
              type="date"
              value={creditNoteDate}
              onChange={(event) => setCreditNoteDate(event.target.value)}
            />
          </label>

          <label>
            Sales Order
            <select
              value={saleId}
              onChange={(event) => {
                setSaleId(event.target.value);
                setError("");
              }}
              disabled={!customerName}
            >
              <option value="">Select a sale with cancelled or returned items</option>
              {customerSales.map((sale) => (
                <option key={sale.id} value={sale.id}>
                  {(sale.reference_no || sale.id) +
                    ` — ${(sale.cancelled_lines || []).length} cancelled/returned`}
                </option>
              ))}
            </select>
          </label>

          <label>
            Apply to Billing Note (optional)
            <select
              value={billingNoteId}
              onChange={(event) => setBillingNoteId(event.target.value)}
              disabled={!customerName}
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
            <p className="eyebrow">Step 2</p>
            <h4>Cancelled or Returned Items to Credit</h4>
          </div>
          <span>{selectedLineIds.size} selected</span>
        </div>

        {!customerName ? (
          <p className="empty-copy">Select a customer to see eligible sales.</p>
        ) : !selectedSale ? (
          <p className="empty-copy">
            Select a sales order to load its cancelled or returned items.
          </p>
        ) : cancelledLines.length === 0 ? (
          <p className="empty-copy">
            This sale has no cancelled or returned items left to credit.
          </p>
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
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Quantity</th>
                    <th>Unit Price</th>
                    <th>Amount</th>
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
            <strong>Total Credit</strong>
            <strong>{fmt(totalAmount)}</strong>
          </div>
        </div>

        {error ? <div className="error-banner">{error}</div> : null}

        <div className="supplier-modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" type="submit">
            Create Credit Note
          </button>
        </div>
      </form>
    </section>
  );
}

function CreditNoteDetailModal({ creditNote, billingNotes, onClose, onSave, onDelete }) {
  const [draft, setDraft] = useState(creditNote);
  const [docRefModal, setDocRefModal] = useState(null);

  useEffect(() => {
    setDraft(creditNote);
  }, [creditNote]);

  function updateField(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  const billingNoteOptions = useMemo(
    () =>
      customerBillingNoteOptions(
        billingNotes,
        draft.customer_name,
        draft.billing_note || ""
      ),
    [billingNotes, draft.customer_name, draft.billing_note]
  );

  function handleSave(event) {
    event.preventDefault();
    onSave(draft);
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="detail-modal transaction-detail-modal section-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cn-detail-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">Credit Note</p>
            <h3 id="cn-detail-title">{draft.reference_no || draft.id}</h3>
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
              Customer
              <input value={draft.customer_name || ""} disabled />
            </label>

            <label>
              Source Sale
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input value={draft.sale_reference_no || draft.sale || ""} disabled style={{ flex: 1 }} />
                {draft.sale && (
                  <DocumentRefChip
                    label={draft.sale_reference_no || draft.sale}
                    docType="sale"
                    onClick={() =>
                      setDocRefModal({
                        docType: "sale",
                        docId: draft.sale,
                        referenceNo: draft.sale_reference_no || draft.sale,
                      })
                    }
                  />
                )}
              </div>
            </label>

            <label>
              Credit Note Date
              <input
                type="date"
                value={draft.credit_note_date || ""}
                onChange={(event) =>
                  updateField("credit_note_date", event.target.value)
                }
              />
            </label>

            <label>
              Applied to Billing Note
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <select
                  value={draft.billing_note || ""}
                  onChange={(event) =>
                    updateField("billing_note", event.target.value || null)
                  }
                  style={{ flex: 1 }}
                >
                  <option value="">Not applied to a billing note</option>
                  {billingNoteOptions.map((billingNote) => (
                    <option key={billingNote.id} value={billingNote.id}>
                      {(billingNote.reference_no || billingNote.id) +
                        ` — ${fmt(billingNote.total_amount)}`}
                    </option>
                  ))}
                </select>
                {draft.billing_note && (
                  <DocumentRefChip
                    label={draft.billing_note_reference_no || draft.billing_note}
                    docType="billing-note"
                    onClick={() =>
                      setDocRefModal({
                        docType: "billing-note",
                        docId: draft.billing_note,
                        referenceNo: draft.billing_note_reference_no || draft.billing_note,
                      })
                    }
                  />
                )}
              </div>
            </label>

            <label>
              Status
              <select
                value={draft.status || "issued"}
                onChange={(event) => updateField("status", event.target.value)}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
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
              <p className="eyebrow">Cancelled or Returned Items</p>
              <h4>Credited Lines</h4>
            </div>
            <span>{(draft.lines || []).length} items</span>
          </div>

          <div className="transaction-table-window">
            <div className="table-scroll partner-line-scroll desktop-table">
              <table className="transaction-history-table partner-line-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Quantity</th>
                    <th>Unit Price</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(draft.lines || []).map((line) => (
                    <tr key={line.id} className="partner-table-row">
                      <td>{line.product_name}</td>
                      <td>{line.sku || "—"}</td>
                      <td>{line.quantity}</td>
                      <td>{fmt(line.unit_price)}</td>
                      <td>{fmt(line.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan="4" style={{ textAlign: "right" }}>
                      <strong>Total Credit</strong>
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
            <button type="button" className="secondary-button" onClick={onClose}>
              Close
            </button>
            <button type="submit" className="primary-button">
              Save
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

function CreditNotePage({
  creditNotes = [],
  allCreditNotes = creditNotes,
  billingNotes = [],
  sales = [],
  nextReferenceNo = "",
  pagination = null,
  onPageRequest,
  onCreateCreditNote,
  onUpdateCreditNote,
  onDeleteCreditNote,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [showAllRows, setShowAllRows] = useState(false);
  const [creating, setCreating] = useState(false);
  const [activeCreditNote, setActiveCreditNote] = useState(null);
  const [docRefModal, setDocRefModal] = useState(null);

  function renderListRef(docType, docId, referenceNo) {
    if (!docId) return "—";
    return (
      <DocumentRefChip
        label={referenceNo || docId}
        docType={docType}
        onClick={() =>
          setDocRefModal({ docType, docId, referenceNo: referenceNo || docId })
        }
      />
    );
  }

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const isServerPaginated = Boolean(pagination && onPageRequest);

  const filtered = useMemo(() => {
    if (isServerPaginated) {
      return creditNotes;
    }
    return creditNotes.filter((note) => {
      if (normalizedSearch && !creditNoteMatchesQuery(note, normalizedSearch)) {
        return false;
      }
      if (statusFilter !== "all" && note.status !== statusFilter) {
        return false;
      }
      if (!creditNoteInDateRange(note, dateFrom, dateTo)) {
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
    creditNotes,
    dateFrom,
    dateTo,
    isServerPaginated,
    normalizedSearch,
    statusFilter,
  ]);

  const compactRows = 5;
  const shouldShowViewAll = !isServerPaginated && filtered.length > compactRows;
  const isCompact = shouldShowViewAll && !showAllRows;
  const totalCreditNoteCount = pagination?.count ?? creditNotes.length;

  const summary = useMemo(() => {
    let issued = 0;
    let cancelled = 0;
    allCreditNotes.forEach((note) => {
      if (note.status === "cancelled") {
        cancelled += Number(note.total_amount) || 0;
      } else {
        issued += Number(note.total_amount) || 0;
      }
    });
    return { issued, cancelled, count: allCreditNotes.length };
  }, [allCreditNotes]);

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
      label: "Last 30 days",
      active: last30Active,
      onClick: () => {
        setDateFrom(last30Active ? "" : daysAgoString(30));
        setDateTo("");
      },
    },
    {
      label: "Issued",
      active: statusFilter === "issued",
      onClick: () =>
        setStatusFilter((current) =>
          current === "issued" ? "all" : "issued"
        ),
    },
    {
      label: "Cancelled",
      active: statusFilter === "cancelled",
      onClick: () =>
        setStatusFilter((current) =>
          current === "cancelled" ? "all" : "cancelled"
        ),
    },
  ];
  const activeChips = [
    statusFilter !== "all" && {
      key: "status",
      label: `Status: ${formatStatus(statusFilter)}`,
      onRemove: () => setStatusFilter("all"),
    },
    dateFrom && {
      key: "dateFrom",
      label: `From ${dateFrom}`,
      onRemove: () => setDateFrom(""),
    },
    dateTo && {
      key: "dateTo",
      label: `To ${dateTo}`,
      onRemove: () => setDateTo(""),
    },
    amountMin && {
      key: "amountMin",
      label: `Min ฿${amountMin}`,
      onRemove: () => setAmountMin(""),
    },
    amountMax && {
      key: "amountMax",
      label: `Max ฿${amountMax}`,
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
    const saved = await onCreateCreditNote?.(payload);
    if (saved !== false) {
      setCreating(false);
    }
  }

  async function handleSave(updated) {
    const saved = await onUpdateCreditNote?.(updated);
    if (saved !== false) {
      setActiveCreditNote(null);
    }
  }

  async function handleDelete(note) {
    if (!window.confirm(`Delete credit note ${note.reference_no || note.id}?`)) {
      return;
    }
    const ok = await onDeleteCreditNote?.(note);
    if (ok !== false) {
      setActiveCreditNote(null);
    }
  }

  if (creating) {
    return (
      <div className="stack-layout">
        <CreateCreditNoteModal
          sales={sales}
          billingNotes={billingNotes}
          creditNotes={allCreditNotes}
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
            <p className="eyebrow">Receivables</p>
            <h3>Credit Notes (Customer Reductions)</h3>
          </div>
        </div>

        <div className="dashboard-summary-grid">
          <article className="dashboard-kpi-card neutral">
            <p>Issued Credits</p>
            <strong>{fmt(summary.issued)}</strong>
            <span>Reducing customer balances</span>
          </article>
          <article className="dashboard-kpi-card danger">
            <p>Cancelled Credits</p>
            <strong>{fmt(summary.cancelled)}</strong>
            <span>No longer applied</span>
          </article>
          <article className="dashboard-kpi-card positive">
            <p>Credit Notes</p>
            <strong>{summary.count}</strong>
            <span>Total credit notes recorded</span>
          </article>
        </div>
      </section>

      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Search</p>
            <h3>Find Credit Notes</h3>
          </div>
        </div>

        <div className="supplier-directory-toolbar">
          <label className="stock-search supplier-search">
            <span className="stock-search-icon">S</span>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search reference, customer, sale ref, status"
            />
          </label>
          <div className="stock-report-summary supplier-search-meta">
            <span>
              {isServerPaginated
                ? `${filtered.length} on this page of ${totalCreditNoteCount} shown`
                : `${filtered.length} of ${creditNotes.length} shown`}
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

        <FilterPresets presets={quickPresets} />
        <ActiveFilterChips chips={activeChips} onClearAll={resetFilters} />

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
              <RangeField
                title="Credit Amount (฿)"
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
            <p className="eyebrow">History</p>
            <h3>Credit Notes</h3>
          </div>
          <div className="transaction-table-actions">
            <button
              className="primary-button"
              type="button"
              onClick={() => setCreating(true)}
            >
              Create Credit Note
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
          <p className="empty-copy">No credit notes match the current search.</p>
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
                    <th>Customer</th>
                    <th>Sale Ref</th>
                    <th>Billing Note</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Total Credit</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((note, index) => (
                    <tr
                      key={note.id}
                      className={
                        activeCreditNote?.id === note.id
                          ? "partner-table-row active"
                          : "partner-table-row"
                      }
                    >
                      <td className="table-index-cell">{index + 1}</td>
                      <td>{note.reference_no || note.id}</td>
                      <td>{note.customer_name}</td>
                      <td>{renderListRef("sale", note.sale, note.sale_reference_no)}</td>
                      <td>
                        {renderListRef(
                          "billing-note",
                          note.billing_note,
                          note.billing_note_reference_no
                        )}
                      </td>
                      <td>{formatDate(note.credit_note_date)}</td>
                      <td>
                        <StatusPill status={note.status} />
                      </td>
                      <td>{fmt(note.total_amount)}</td>
                      <td>
                        <button
                          className="table-action-button"
                          type="button"
                          onClick={() => setActiveCreditNote(note)}
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
              {filtered.map((note, index) => (
                <article className="mobile-record-card" key={`mobile-cn-${note.id}`}>
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
                      <span>Sale Ref</span>
                      <strong>
                        {renderListRef("sale", note.sale, note.sale_reference_no)}
                      </strong>
                    </div>
                    <div>
                      <span>Billing Note</span>
                      <strong>
                        {renderListRef(
                          "billing-note",
                          note.billing_note,
                          note.billing_note_reference_no
                        )}
                      </strong>
                    </div>
                    <div>
                      <span>Date</span>
                      <strong>{formatDate(note.credit_note_date)}</strong>
                    </div>
                    <div>
                      <span>Total Credit</span>
                      <strong>{fmt(note.total_amount)}</strong>
                    </div>
                  </div>
                  <button
                    className="secondary-button table-action-button mobile-record-button"
                    type="button"
                    onClick={() => setActiveCreditNote(note)}
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
          itemLabel="credit notes"
          onPageChange={(page) => onPageRequest?.(getPageRequestParams(page))}
        />
      </section>

      {activeCreditNote ? (
        <CreditNoteDetailModal
          key={activeCreditNote.id}
          creditNote={activeCreditNote}
          billingNotes={billingNotes}
          onClose={() => setActiveCreditNote(null)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      ) : null}

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

export default CreditNotePage;
