import { useState } from "react";

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value || 0));
}

const purchaseStatuses = ["draft", "ordered", "received", "cancelled"];

function TransactionTable({ rows, type, onPurchaseStatusChange }) {
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const title = type === "purchase" ? "Purchase History" : "Sales History";
  const personKey = type === "purchase" ? "supplier_name" : "customer_name";

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
                {type === "purchase" ? <th>More Information</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${type}-${row.id}`}>
                  <td>{row.reference_no}</td>
                  <td>{row[personKey]}</td>
                  <td>
                    {type === "purchase" ? (
                      <select
                        className={`status-select status-${row.status}`}
                        value={row.status}
                        onChange={(event) =>
                          onPurchaseStatusChange?.(row.id, event.target.value)
                        }
                      >
                        {purchaseStatuses.map((status) => (
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
                  {type === "purchase" ? (
                    <td>
                      <button
                        className="secondary-button table-action-button"
                        type="button"
                        onClick={() => setSelectedPurchase(row)}
                      >
                        More Information
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {type === "purchase" && selectedPurchase ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setSelectedPurchase(null)}
        >
          <div
            className="detail-modal section-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="purchase-detail-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">Purchase Detail</p>
                <h3 id="purchase-detail-title">{selectedPurchase.reference_no}</h3>
              </div>
              <button
                className="secondary-button table-action-button"
                type="button"
                onClick={() => setSelectedPurchase(null)}
              >
                Close
              </button>
            </div>

            <div className="detail-grid">
              <div>
                <p className="detail-label">Supplier</p>
                <strong>{selectedPurchase.supplier_name || "-"}</strong>
              </div>
              <div>
                <p className="detail-label">Status</p>
                <strong>{selectedPurchase.status || "-"}</strong>
              </div>
              <div>
                <p className="detail-label">Transaction Date</p>
                <strong>{selectedPurchase.transaction_date || "-"}</strong>
              </div>
              <div>
                <p className="detail-label">Total Amount</p>
                <strong>{formatCurrency(selectedPurchase.total_amount)}</strong>
              </div>
              <div>
                <p className="detail-label">Document</p>
                {selectedPurchase.document_url ? (
                  <a href={selectedPurchase.document_url} target="_blank" rel="noreferrer">
                    Open document
                  </a>
                ) : (
                  <strong>-</strong>
                )}
              </div>
              <div>
                <p className="detail-label">Notes</p>
                <strong>{selectedPurchase.note || "-"}</strong>
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
                      <th>Unit Cost</th>
                      <th>Unit Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPurchase.items.map((item) => (
                      <tr key={item.id}>
                        <td>{item.product_name}</td>
                        <td>{item.quantity}</td>
                        <td>{item.unit_cost ? formatCurrency(item.unit_cost) : "-"}</td>
                        <td>{item.unit_price ? formatCurrency(item.unit_price) : "-"}</td>
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
