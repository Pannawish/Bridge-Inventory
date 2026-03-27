import { useState } from "react";

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value || 0));
}

const purchaseStatuses = ["draft", "ordered", "received", "cancelled"];
const saleStatuses = ["draft", "packed", "shipped", "delivered", "cancelled"];

function TransactionTable({ rows, type, onPurchaseStatusChange, onSaleStatusChange }) {
  const [selectedRow, setSelectedRow] = useState(null);
  const title = type === "purchase" ? "Purchase History" : "Sales History";
  const personKey = type === "purchase" ? "supplier_name" : "customer_name";
  const statuses = type === "purchase" ? purchaseStatuses : saleStatuses;
  const detailTitle = type === "purchase" ? "Purchase Detail" : "Sales Detail";
  const detailNameLabel = type === "purchase" ? "Supplier" : "Customer";

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
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Reference</th>
                <th>{type === "purchase" ? "Supplier Name" : "Name"}</th>
                <th>Status</th>
                <th>Date</th>
                <th>Items</th>
                <th>Total</th>
                <th>Document</th>
                <th>More Information</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${type}-${row.id}`}>
                  <td>{row.reference_no}</td>
                  <td>{row[personKey]}</td>
                  <td>
                    {type === "purchase" || type === "sale" ? (
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
                    ) : (
                      <span className={`status-badge status-${row.status}`}>{row.status}</span>
                    )}
                  </td>
                  <td>{row.transaction_date}</td>
                  <td>
                    <div className="item-pill-list">
                      {row.items.map((item) => (
                        <span key={item.id} className="item-pill">
                          {item.product_name} x {item.quantity}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>{formatCurrency(row.total_amount)}</td>
                  <td>
                    {row.document_url ? (
                      <a href={row.document_url} target="_blank" rel="noreferrer">
                        Open
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>
                    <button
                      className="secondary-button table-action-button"
                      type="button"
                      onClick={() => setSelectedRow(row)}
                    >
                      More Information
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
              <button
                className="secondary-button table-action-button"
                type="button"
                onClick={() => setSelectedRow(null)}
              >
                Close
              </button>
            </div>

            <div className="detail-grid">
              <div>
                <p className="detail-label">{detailNameLabel}</p>
                <strong>{selectedRow[personKey] || "-"}</strong>
              </div>
              <div>
                <p className="detail-label">Status</p>
                <strong>{selectedRow.status || "-"}</strong>
              </div>
              <div>
                <p className="detail-label">Transaction Date</p>
                <strong>{selectedRow.transaction_date || "-"}</strong>
              </div>
              <div>
                <p className="detail-label">Total Amount</p>
                <strong>{formatCurrency(selectedRow.total_amount)}</strong>
              </div>
              {type === "sale" ? (
                <div>
                  <p className="detail-label">Payment Receive Date</p>
                  <strong>{selectedRow.payment_received_date || "-"}</strong>
                </div>
              ) : null}
              <div>
                <p className="detail-label">Document</p>
                {selectedRow.document_url ? (
                  <a href={selectedRow.document_url} target="_blank" rel="noreferrer">
                    Open document
                  </a>
                ) : (
                  <strong>-</strong>
                )}
              </div>
              <div>
                <p className="detail-label">Notes</p>
                <strong>{selectedRow.note || "-"}</strong>
              </div>
            </div>

            <div className="detail-items">
              <p className="detail-label">Items</p>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Quantity</th>
                      <th>{type === "purchase" ? "Unit Cost" : "Unit Price"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedRow.items.map((item) => (
                      <tr key={item.id}>
                        <td>{item.product_name}</td>
                        <td>{item.quantity}</td>
                        <td>
                          {type === "purchase"
                            ? item.unit_cost
                              ? formatCurrency(item.unit_cost)
                              : "-"
                            : item.unit_price
                              ? formatCurrency(item.unit_price)
                              : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default TransactionTable;
