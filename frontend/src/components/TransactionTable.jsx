import { useState } from "react";
import {
  formatStatusLabel,
  getPurchaseItemDisplayStatus,
  getPurchaseItemStatusCounts,
  getStoredPurchaseItemStatus,
  markPurchaseItemReceived,
  purchaseItemStatuses,
  purchaseStatuses,
  updatePurchaseItemReceivedDate,
  updatePurchaseItemStatus,
} from "../purchaseStatus";

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

const saleStatuses = ["draft", "packed", "shipped", "delivered", "cancelled"];

function TransactionTable({
  rows,
  type,
  onPurchaseStatusChange,
  onPurchaseItemStatusChange,
  onSaleStatusChange,
  onEditRow,
  onDeleteRow,
  compactRows = 0,
  enableViewAll = false,
  headerActions = null,
}) {
  const [selectedRow, setSelectedRow] = useState(null);
  const [hasUnsavedItemChanges, setHasUnsavedItemChanges] = useState(false);
  const [showAllRows, setShowAllRows] = useState(false);
  const title = type === "purchase" ? "Purchases" : "Sales";
  const personKey = type === "purchase" ? "supplier_name" : "customer_name";
  const statuses = type === "purchase" ? purchaseStatuses : saleStatuses;
  const detailTitle = type === "purchase" ? "Purchase Detail" : "Sales Detail";
  const detailNameLabel = type === "purchase" ? "Supplier" : "Customer";
  const shouldShowViewAll = enableViewAll && compactRows > 0 && rows.length > compactRows;
  const isCompact = shouldShowViewAll && !showAllRows;

  function getVatSummary(row) {
    const itemTotal = (row.items || []).reduce((sum, item) => sum + computeItemAmount(item), 0);

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

  function getRowGrandTotal(row) {
    const storedGrandTotal = Number(row.grand_total);

    if (Number.isFinite(storedGrandTotal) && storedGrandTotal > 0) {
      return storedGrandTotal;
    }

    if (type === "purchase") {
      const totalAmount = Number(row.total_amount);

      if (Number.isFinite(totalAmount) && totalAmount > 0) {
        return totalAmount;
      }
    }

    return getVatSummary(row).grandTotal;
  }

  const rowsGrandTotal = rows.reduce(
    (sum, row) => sum + getRowGrandTotal(row),
    0
  );

  function handleDeleteSelectedRow() {
    const confirmed = window.confirm(
      `Delete ${selectedRow.reference_no || "this transaction"}? This action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    onDeleteRow?.(selectedRow);
    closeSelectedRow();
  }

  function openSelectedRow(row) {
    setSelectedRow(row);
    setHasUnsavedItemChanges(false);
  }

  function closeSelectedRow() {
    setSelectedRow(null);
    setHasUnsavedItemChanges(false);
  }

  function handleMarkPurchaseItemReceived(itemIndex) {
    const updatedRow = markPurchaseItemReceived(selectedRow, itemIndex);

    setSelectedRow(updatedRow);
    setHasUnsavedItemChanges(true);
  }

  function handlePurchaseItemStatusChange(itemIndex, nextStatus) {
    const updatedRow = updatePurchaseItemStatus(selectedRow, itemIndex, nextStatus);

    setSelectedRow(updatedRow);
    setHasUnsavedItemChanges(true);
  }

  function handlePurchaseItemReceivedDateChange(itemIndex, receivedDate) {
    const updatedRow = updatePurchaseItemReceivedDate(selectedRow, itemIndex, receivedDate);

    setSelectedRow(updatedRow);
    setHasUnsavedItemChanges(true);
  }

  function handlePurchaseTaxInvoiceChange(nextValue) {
    setSelectedRow((currentRow) =>
      currentRow
        ? {
            ...currentRow,
            supplier_tax_invoice: nextValue,
          }
        : currentRow
    );
    setHasUnsavedItemChanges(true);
  }

  function handleSavePurchaseUpdates() {
    onPurchaseItemStatusChange?.(selectedRow);
    setHasUnsavedItemChanges(false);
  }

  return (
    <section className="section-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">History</p>
          <h3>{title}</h3>
        </div>
        <div className="transaction-table-actions">
          {headerActions}
          {shouldShowViewAll ? (
            <button
              className="secondary-button"
              type="button"
              onClick={() => setShowAllRows((currentValue) => !currentValue)}
            >
              {showAllRows ? "Show Recent" : "View All"}
            </button>
          ) : null}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="empty-copy">No transactions saved yet.</p>
      ) : (
        <div className={isCompact ? "transaction-table-window compact-history" : "transaction-table-window"}>
          <div className="table-scroll desktop-table">
            <table>
              <thead>
                <tr>
                  <th className="table-index-cell">#</th>
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
                    <>
                      <th>Supplier's Tax Invoice</th>
                      <th>Total</th>
                    </>
                  )}
                  <th>Document</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => {
                  const salesSummary = type === "sale" ? getVatSummary(row) : null;

                  return (
                    <tr key={`${type}-${row.id}`}>
                      <td className="table-index-cell">{rowIndex + 1}</td>
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
                            <option
                              key={status}
                              value={status}
                              disabled={type === "purchase" && status === "partially_received"}
                            >
                              {formatStatusLabel(status)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>{row.transaction_date}</td>
                      <td>
                        <div className="item-pill-list">
                          {(row.items || []).map((item, itemIndex) => (
                            <span key={item.id} className="item-pill">
                              <span className="item-pill-index">{itemIndex + 1}.</span>
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
                        <>
                          <td>{row.supplier_tax_invoice || "—"}</td>
                          <td>{formatCurrency(row.total_amount)}</td>
                        </>
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
                          onClick={() => openSelectedRow(row)}
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
            {rows.map((row, rowIndex) => {
              const salesSummary = type === "sale" ? getVatSummary(row) : null;

              return (
                <article className="mobile-record-card" key={`mobile-${type}-${row.id}`}>
                  <div className="mobile-record-header">
                    <div className="mobile-record-title">
                      <span className="mobile-record-index">{rowIndex + 1}</span>
                      <div className="cell-stack">
                        <strong>{row.reference_no}</strong>
                        <span>{row[personKey]}</span>
                      </div>
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
                        <option
                          key={status}
                          value={status}
                          disabled={type === "purchase" && status === "partially_received"}
                        >
                          {formatStatusLabel(status)}
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
                        <span>Supplier's Tax Invoice</span>
                        <strong>{row.supplier_tax_invoice || "—"}</strong>
                      </div>
                    )}
                    {type === "purchase" ? (
                      <div>
                        <span>Total</span>
                        <strong>{formatCurrency(row.total_amount)}</strong>
                      </div>
                    ) : null}
                    <div className="full-width-mobile">
                      <span>Items</span>
                      <div className="item-pill-list">
                        {(row.items || []).map((item, itemIndex) => (
                          <span key={item.id} className="item-pill">
                            <span className="item-pill-index">{itemIndex + 1}.</span>
                            {item.product_name} ×{item.quantity}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <button
                    className="secondary-button table-action-button mobile-record-button"
                    type="button"
                    onClick={() => openSelectedRow(row)}
                  >
                    Details
                  </button>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {rows.length ? (
        <div className="tx-sales-summary transaction-grand-total">
          <div className="tx-summary-row tx-summary-grand">
            <strong>Grand Total</strong>
            <strong>{formatCurrency(rowsGrandTotal)}</strong>
          </div>
        </div>
      ) : null}

      {selectedRow ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={closeSelectedRow}
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
                      closeSelectedRow();
                    }}
                  >
                    Edit
                  </button>
                ) : null}
                {type === "purchase" && onPurchaseItemStatusChange ? (
                  <button
                    className="primary-button table-action-button"
                    type="button"
                    onClick={handleSavePurchaseUpdates}
                    disabled={!hasUnsavedItemChanges}
                  >
                    Save Purchase Updates
                  </button>
                ) : null}
                <button
                  className="secondary-button table-action-button"
                  type="button"
                  onClick={closeSelectedRow}
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
                    {formatStatusLabel(selectedRow.status)}
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
              {type === "purchase" ? (
                <div className="purchase-tax-invoice-field">
                  <p className="detail-label">Supplier's Tax Invoice</p>
                  <input
                    className="purchase-tax-invoice-input"
                    type="text"
                    value={selectedRow.supplier_tax_invoice || ""}
                    onChange={(event) => handlePurchaseTaxInvoiceChange(event.target.value)}
                    placeholder="Enter supplier tax invoice"
                  />
                </div>
              ) : null}
              <div className="full-width">
                <p className="detail-label">Notes</p>
                <strong>{selectedRow.note || "—"}</strong>
              </div>
            </div>

            <div className="detail-items">
              <p className="detail-label">Items</p>
              {type === "purchase" ? (
                <div className="item-receiving-summary" aria-label="Item receiving status">
                  <span className="item-receiving-title">Item Receiving Status</span>
                  {(() => {
                    const counts = getPurchaseItemStatusCounts(
                      selectedRow.items || [],
                      selectedRow.status
                    );

                    return ["pending", "delayed", "received", "cancelled"].map((status) => (
                      <span
                        key={status}
                        className={`status-badge item-status-badge status-${status}`}
                      >
                        {counts[status]} {formatStatusLabel(status)}
                      </span>
                    ));
                  })()}
                </div>
              ) : null}
              <div className="table-scroll">
                {type === "sale" ? (
                  <table>
                    <thead>
                      <tr>
                        <th className="table-index-cell">#</th>
                        <th>Product</th>
                        <th>Qty</th>
                        <th>Unit Price</th>
                        <th>Discounts</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedRow.items || []).map((item, itemIndex) => {
                        const amount = computeItemAmount(item);
                        return (
                          <tr key={item.id}>
                            <td className="table-index-cell">{itemIndex + 1}</td>
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
                        <th className="table-index-cell">#</th>
                        <th>Product</th>
                        <th>SKU</th>
                        <th>Unit</th>
                        <th>Expected Delivery</th>
                        <th>Lead Time</th>
                        <th>Item Status</th>
                        <th>Received Date</th>
                        <th>Qty</th>
                        <th>Unit Cost</th>
                        <th>Discounts</th>
                        <th>Amount</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedRow.items || []).map((item, itemIndex) => {
                        const amount = computeItemAmount(item);
                        const displayStatus = getPurchaseItemDisplayStatus(
                          item,
                          selectedRow.status
                        );
                        const storedStatus = getStoredPurchaseItemStatus(
                          item,
                          selectedRow.status
                        );
                        const canMarkReceived =
                          !["draft", "cancelled"].includes(selectedRow.status) &&
                          !["cancelled", "received"].includes(storedStatus);

                        return (
                          <tr key={item.id || `${item.sku}-${itemIndex}`}>
                            <td className="table-index-cell">{itemIndex + 1}</td>
                            <td>{item.product_name}</td>
                            <td>{item.sku || "—"}</td>
                            <td>{item.unit || "—"}</td>
                            <td>{item.expected_delivery_date || "—"}</td>
                            <td>
                              {item.lead_time_days !== undefined && item.lead_time_days !== ""
                                ? `${item.lead_time_days} days`
                                : "—"}
                            </td>
                            <td>
                              <div className="purchase-item-status-control">
                                <select
                                  className={`status-select item-status-select status-${displayStatus}`}
                                  value={storedStatus}
                                  onChange={(event) =>
                                    handlePurchaseItemStatusChange(itemIndex, event.target.value)
                                  }
                                  disabled={["draft", "cancelled"].includes(selectedRow.status)}
                                  aria-label={`Change ${item.product_name} receiving status`}
                                >
                                  {purchaseItemStatuses.map((status) => (
                                    <option key={status} value={status}>
                                      {formatStatusLabel(status)}
                                    </option>
                                  ))}
                                </select>
                                {displayStatus === "delayed" ? (
                                  <span className="status-badge item-status-badge status-delayed">
                                    Delayed
                                  </span>
                                ) : null}
                              </div>
                            </td>
                            <td>
                              <input
                                className="received-date-input"
                                type="date"
                                value={item.received_date || ""}
                                onChange={(event) =>
                                  handlePurchaseItemReceivedDateChange(
                                    itemIndex,
                                    event.target.value
                                  )
                                }
                                disabled={storedStatus !== "received"}
                                aria-label={`Edit ${item.product_name} received date`}
                              />
                            </td>
                            <td>{item.quantity}</td>
                            <td>{item.unit_cost ? formatCurrency(item.unit_cost) : "—"}</td>
                            <td>
                              <span className="tx-discount-label">
                                {renderDiscounts(item)}
                              </span>
                            </td>
                            <td>{formatCurrency(amount)}</td>
                            <td>
                              <button
                                className="secondary-button table-action-button mark-received-button"
                                type="button"
                                onClick={() => handleMarkPurchaseItemReceived(itemIndex)}
                                disabled={!canMarkReceived}
                              >
                                Mark Received
                              </button>
                            </td>
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
