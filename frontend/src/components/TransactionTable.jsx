import { useState } from "react";

const VAT_RATE = 0.07;

function formatCurrency(value) {
  return `฿${Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function computeItemAmount(item) {
  const qty = Number(item.quantity) || 0;
  const price = Number(item.unit_price ?? item.unit_cost) || 0;

  if (item.amount !== undefined && item.amount !== null) {
    return Number(item.amount) || 0;
  }

  if (Array.isArray(item.discounts)) {
    const multiplier = item.discounts.reduce((acc, d) => {
      const clamped = Math.min(100, Math.max(0, Number(d) || 0));
      return acc * (1 - clamped / 100);
    }, 1);
    return qty * price * multiplier;
  }

  const disc = Math.min(100, Math.max(0, Number(item.discount) || 0));
  return qty * price * (1 - disc / 100);
}

function renderDiscounts(item) {
  if (Array.isArray(item.discounts)) {
    const active = item.discounts.filter((d) => Number(d) > 0);
    if (active.length > 0) {
      return active.map((d) => `${Number(d)}%`).join(" → ");
    }
    return "—";
  }

  if (Number(item.discount) > 0) {
    return `${Number(item.discount)}%`;
  }

  return "—";
}

const purchaseStatuses = ["draft", "ordered", "received", "cancelled"];
const saleStatuses = ["draft", "packed", "shipped", "delivered", "cancelled"];

function TransactionTable({
  rows,
  type,
  onPurchaseStatusChange,
  onSaleStatusChange,
  onEditRow,
  onDeleteRow,
}) {
  const [selectedRow, setSelectedRow] = useState(null);
  const title = type === "purchase" ? "Purchase History" : "Sales History";
  const personKey = type === "purchase" ? "supplier_name" : "customer_name";
  const statuses = type === "purchase" ? purchaseStatuses : saleStatuses;
  const detailTitle = type === "purchase" ? "Purchase Detail" : "Sales Detail";
  const detailNameLabel = type === "purchase" ? "Supplier" : "Customer";

  function getVatSummary(row) {
    const itemTotal = row.items.reduce((sum, item) => sum + computeItemAmount(item), 0);

    if (row.vat_mode === "included") {
      const subtotal = itemTotal / (1 + VAT_RATE);
      const vat = itemTotal - subtotal;
      return { subtotal, vat, grandTotal: itemTotal };
    }

    if (row.vat_mode === "none") {
      return { subtotal: itemTotal, vat: 0, grandTotal: itemTotal };
    }

    const vat = itemTotal * VAT_RATE;
    return { subtotal: itemTotal, vat, grandTotal: itemTotal + vat };
  }

  function handleDeleteSelectedRow() {
    const confirmed = window.confirm(
      `Delete ${selectedRow.reference_no || "this transaction"}? This action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    onDeleteRow?.(selectedRow);
    setSelectedRow(null);
  }

  return (
    <section className="section-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">History</p>
          <h3>{title}</h3>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="empty-copy">No transactions saved yet.</p>
      ) : (
        <>
          <div className="table-scroll desktop-table">
            <table>
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>{type === "purchase" ? "Supplier" : "Customer"}</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Items</th>
                  {type === "sale" ? (
                    <>
                      <th>Subtotal</th>
                      <th>VAT (7%)</th>
                      <th>Grand Total</th>
                    </>
                  ) : (
                    <th>Total</th>
                  )}
                  <th>Document</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const salesSummary = type === "sale" ? getVatSummary(row) : null;

                  return (
                    <tr key={`${type}-${row.id}`}>
                      <td>{row.reference_no}</td>
                      <td>{row[personKey]}</td>
                      <td>
                        <select
                          className={`status-select status-${row.status}`}
                          value={row.status}
                          onChange={(event) => {
                            const nextStatus = event.target.value;
                            if (type === "purchase") {
                              onPurchaseStatusChange?.(row.id, nextStatus);
                            } else {
                              onSaleStatusChange?.(row.id, nextStatus);
                            }
                          }}
                        >
                          {statuses.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>{row.transaction_date}</td>
                      <td>
                        <div className="item-pill-list">
                          {row.items.map((item) => (
                            <span key={item.id} className="item-pill">
                              {item.product_name} ×{item.quantity}
                            </span>
                          ))}
                        </div>
                      </td>
                      {type === "sale" ? (
                        <>
                          <td>{formatCurrency(salesSummary.subtotal)}</td>
                          <td>{formatCurrency(salesSummary.vat)}</td>
                          <td>
                            <strong>{formatCurrency(salesSummary.grandTotal)}</strong>
                          </td>
                        </>
                      ) : (
                        <td>{formatCurrency(row.total_amount)}</td>
                      )}
                      <td>
                        {row.document_url ? (
                          <a href={row.document_url} target="_blank" rel="noreferrer">
                            Open
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <button
                          className="table-action-button"
                          type="button"
                          onClick={() => setSelectedRow(row)}
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mobile-record-list">
            {rows.map((row) => {
              const salesSummary = type === "sale" ? getVatSummary(row) : null;

              return (
                <article className="mobile-record-card" key={`mobile-${type}-${row.id}`}>
                  <div className="mobile-record-header">
                    <div className="cell-stack">
                      <strong>{row.reference_no}</strong>
                      <span>{row[personKey]}</span>
                    </div>
                    <select
                      className={`status-select status-${row.status}`}
                      value={row.status}
                      onChange={(event) => {
                        const nextStatus = event.target.value;
                        if (type === "purchase") {
                          onPurchaseStatusChange?.(row.id, nextStatus);
                        } else {
                          onSaleStatusChange?.(row.id, nextStatus);
                        }
                      }}
                    >
                      {statuses.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mobile-record-grid">
                    <div>
                      <span>Date</span>
                      <strong>{row.transaction_date}</strong>
                    </div>
                    {type === "sale" ? (
                      <>
                        <div>
                          <span>Subtotal</span>
                          <strong>{formatCurrency(salesSummary.subtotal)}</strong>
                        </div>
                        <div>
                          <span>VAT (7%)</span>
                          <strong>{formatCurrency(salesSummary.vat)}</strong>
                        </div>
                        <div>
                          <span>Grand Total</span>
                          <strong>{formatCurrency(salesSummary.grandTotal)}</strong>
                        </div>
                      </>
                    ) : (
                      <div>
                        <span>Total</span>
                        <strong>{formatCurrency(row.total_amount)}</strong>
                      </div>
                    )}
                    <div className="full-width-mobile">
                      <span>Items</span>
                      <div className="item-pill-list">
                        {row.items.map((item) => (
                          <span key={item.id} className="item-pill">
                            {item.product_name} ×{item.quantity}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <button
                    className="secondary-button table-action-button mobile-record-button"
                    type="button"
                    onClick={() => setSelectedRow(row)}
                  >
                    Details
                  </button>
                </article>
              );
            })}
          </div>
        </>
      )}

      {selectedRow ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setSelectedRow(null)}
        >
          <div
            className="detail-modal section-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="transaction-detail-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">{detailTitle}</p>
                <h3 id="transaction-detail-title">{selectedRow.reference_no}</h3>
              </div>
              <div className="transaction-detail-actions">
                {onEditRow ? (
                  <button
                    className="edit-button table-action-button"
                    type="button"
                    onClick={() => {
                      onEditRow(selectedRow);
                      setSelectedRow(null);
                    }}
                  >
                    Edit
                  </button>
                ) : null}
                <button
                  className="secondary-button table-action-button"
                  type="button"
                  onClick={() => setSelectedRow(null)}
                >
                  Close
                </button>
              </div>
            </div>

            <div className="detail-grid">
              <div>
                <p className="detail-label">{detailNameLabel}</p>
                <strong>{selectedRow[personKey] || "—"}</strong>
              </div>
              <div>
                <p className="detail-label">Status</p>
                <strong>
                  <span className={`status-badge status-${selectedRow.status}`}>
                    {selectedRow.status}
                  </span>
                </strong>
              </div>
              <div>
                <p className="detail-label">Transaction Date</p>
                <strong>{selectedRow.transaction_date || "—"}</strong>
              </div>
              {type === "sale" ? (
                <div>
                  <p className="detail-label">Payment Receive Date</p>
                  <strong>{selectedRow.payment_received_date || "—"}</strong>
                </div>
              ) : null}
              <div>
                <p className="detail-label">Document</p>
                {selectedRow.document_url ? (
                  <a href={selectedRow.document_url} target="_blank" rel="noreferrer">
                    Open document
                  </a>
                ) : (
                  <strong>—</strong>
                )}
              </div>
              <div className="full-width">
                <p className="detail-label">Notes</p>
                <strong>{selectedRow.note || "—"}</strong>
              </div>
            </div>

            <div className="detail-items">
              <p className="detail-label">Items</p>
              <div className="table-scroll">
                {type === "sale" ? (
                  <table>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Qty</th>
                        <th>Unit Price</th>
                        <th>Discounts</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRow.items.map((item) => {
                        const amount = computeItemAmount(item);
                        return (
                          <tr key={item.id}>
                            <td>{item.product_name}</td>
                            <td>{item.quantity}</td>
                            <td>{item.unit_price ? formatCurrency(item.unit_price) : "—"}</td>
                            <td>
                              <span className="tx-discount-label">
                                {renderDiscounts(item)}
                              </span>
                            </td>
                            <td>{formatCurrency(amount)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>SKU</th>
                        <th>Unit</th>
                        <th>Qty</th>
                        <th>Unit Cost</th>
                        <th>Discounts</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRow.items.map((item) => {
                        const amount = computeItemAmount(item);

                        return (
                          <tr key={item.id}>
                            <td>{item.product_name}</td>
                            <td>{item.sku || "—"}</td>
                            <td>{item.unit || "—"}</td>
                            <td>{item.quantity}</td>
                            <td>{item.unit_cost ? formatCurrency(item.unit_cost) : "—"}</td>
                            <td>
                              <span className="tx-discount-label">
                                {renderDiscounts(item)}
                              </span>
                            </td>
                            <td>{formatCurrency(amount)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {(() => {
              const { subtotal, vat, grandTotal } = getVatSummary(selectedRow);

              return (
                <div className="tx-sales-summary">
                  <div className="tx-summary-row">
                    <span>{type === "purchase" ? "Total" : "Subtotal"}</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="tx-summary-row">
                    <span>VAT (7%)</span>
                    <span>{formatCurrency(vat)}</span>
                  </div>
                  <div className="tx-summary-row tx-summary-grand">
                    <strong>Grand Total</strong>
                    <strong>{formatCurrency(grandTotal)}</strong>
                  </div>
                </div>
              );
            })()}

            {onDeleteRow ? (
              <div className="transaction-detail-footer">
                <button
                  className="danger-button"
                  type="button"
                  onClick={handleDeleteSelectedRow}
                >
                  Delete
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default TransactionTable;
