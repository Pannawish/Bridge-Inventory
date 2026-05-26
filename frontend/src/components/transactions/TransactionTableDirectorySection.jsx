import { formatDate } from "../../format";
import { useLanguage } from "../../i18n/LanguageContext";
import { getStatusLabel } from "../../i18n/statusLabels";
import {
  formatCurrency,
  getItemCount,
  getTransactionDocuments,
} from "./transactionTableUtils";

function TransactionTableDirectorySection({
  rows,
  type,
  personKey,
  statuses,
  isCompact,
  onOpenSelectedRow,
  onPurchaseStatusChange,
  onSaleStatusChange,
  getRowGrandTotal,
}) {
  const { t } = useLanguage();

  if (rows.length === 0) {
    return <p className="empty-copy">{t("transactionTable.noTransactions")}</p>;
  }

  return (
    <div className={isCompact ? "transaction-table-window compact-history" : "transaction-table-window"}>
      <div className="table-scroll desktop-table">
        <table className={`transaction-history-table transaction-history-table-${type}`}>
          <colgroup>
            <col className="history-col-index" />
            <col className="history-col-reference" />
            <col className="history-col-party" />
            <col className="history-col-status" />
            <col className="history-col-date" />
            <col className="history-col-items" />
            <col className="history-col-tax" />
            <col className="history-col-money" />
            <col className="history-col-action" />
          </colgroup>
          <thead>
            <tr>
              <th className="table-index-cell">#</th>
              <th>{t("transactionTable.colRef")}</th>
              <th>
                {type === "purchase"
                  ? t("transactionTable.supplierLabel")
                  : t("transactionTable.customerLabel")}
              </th>
              <th>{t("transactionTable.colStatus")}</th>
              <th>{t("transactionTable.colDate")}</th>
              <th>{t("transactionTable.colItems")}</th>
              {type === "sale" ? (
                <>
                  <th>{t("transactionTable.colCustomerPORef")}</th>
                  <th>{t("transactionTable.colGrandTotal")}</th>
                </>
              ) : (
                <>
                  <th>{t("transactionTable.colTaxInv")}</th>
                  <th>{t("transactionTable.colTotal")}</th>
                </>
              )}
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => {
              const itemCount = getItemCount(row.items || []);
              return (
                <tr key={`${type}-${row.id}`}>
                  <td className="table-index-cell">{rowIndex + 1}</td>
                  <td>
                    <div className="transaction-reference-cell">
                      <strong>{row.reference_no || "—"}</strong>
                      <span>
                        {type === "purchase"
                          ? t("transactionTable.purchaseOrderLabel")
                          : t("transactionTable.salesInvoiceLabel")}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="cell-stack">
                      <strong>{row[personKey] || "—"}</strong>
                      <span>
                        {type === "purchase"
                          ? t("transactionTable.supplierLabel")
                          : t("transactionTable.customerLabel")}
                      </span>
                    </div>
                  </td>
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
                          disabled={
                            (type === "purchase" && status === "partially_received") ||
                            (type === "sale" && status.startsWith("partially_"))
                          }
                        >
                          {getStatusLabel(t, status)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>{formatDate(row.transaction_date)}</td>
                  <td>
                    <div className="history-item-summary history-item-quantity-only">
                      <span className="history-item-count">{itemCount}</span>
                    </div>
                  </td>
                  {type === "sale" ? (
                    <>
                      <td>{row.customer_po_reference || "—"}</td>
                      <td>
                        <strong>{formatCurrency(getRowGrandTotal(row))}</strong>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{row.supplier_tax_invoice || "—"}</td>
                      <td>
                        <strong>{formatCurrency(getRowGrandTotal(row))}</strong>
                      </td>
                    </>
                  )}
                  <td>
                    <button
                      className="table-action-button"
                      type="button"
                      onClick={() => onOpenSelectedRow(row)}
                    >
                      {t("transactionTable.detailsButton")}
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
          const itemCount = getItemCount(row.items || []);
          const documents = getTransactionDocuments(row, t);

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
                      disabled={
                        (type === "purchase" && status === "partially_received") ||
                        (type === "sale" && status.startsWith("partially_"))
                      }
                    >
                      {getStatusLabel(t, status)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mobile-record-grid">
                <div>
                  <span>{t("transactionTable.colDate")}</span>
                  <strong>{formatDate(row.transaction_date)}</strong>
                </div>
                {type === "sale" ? (
                  <div>
                    <span>{t("transactionTable.colGrandTotal")}</span>
                    <strong>{formatCurrency(getRowGrandTotal(row))}</strong>
                  </div>
                ) : (
                  <div>
                    <span>{t("transactionTable.supplierTaxInvoice")}</span>
                    <strong>{row.supplier_tax_invoice || "—"}</strong>
                  </div>
                )}
                {type === "purchase" ? (
                  <div>
                    <span>{t("transactionTable.colTotal")}</span>
                    <strong>{formatCurrency(getRowGrandTotal(row))}</strong>
                  </div>
                ) : null}
                <div className="full-width-mobile">
                  <span>{t("transactionTable.colItems")}</span>
                  <div className="history-item-summary mobile-history-item-summary history-item-quantity-only">
                    <span className="history-item-count">{itemCount}</span>
                  </div>
                </div>
                {type === "sale" ? (
                  <div>
                    <span>{t("transactionTable.customerPOReference")}</span>
                    <strong>{row.customer_po_reference || "—"}</strong>
                  </div>
                ) : null}
                <div>
                  <span>{t("transactionTable.colDocuments")}</span>
                  <strong>
                    {documents.length
                      ? t("transactionTable.attachedCount", { count: documents.length })
                      : "—"}
                  </strong>
                </div>
              </div>

              <button
                className="secondary-button table-action-button mobile-record-button"
                type="button"
                onClick={() => onOpenSelectedRow(row)}
              >
                {t("transactionTable.detailsButton")}
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export default TransactionTableDirectorySection;
