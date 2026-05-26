import { formatPurchaseLeadTime, getPurchaseItemDisplayStatus } from "../../purchaseStatus";
import { getStoredSaleItemStatus } from "../../saleStatus";
import { getItemQuantityDetails } from "../../unitConversion";
import { formatDate } from "../../format";
import { useLanguage } from "../../i18n/LanguageContext";
import { getStatusLabel } from "../../i18n/statusLabels";
import {
  computeItemAmount,
  computeVatSummary,
  formatCurrency,
  getDocumentName,
  getTransactionDocuments,
  itemMatchesProduct,
  renderBillDiscount,
  renderDiscounts,
} from "./productUtils";

function DiscountBreakdown({ item, transaction }) {
  const { t } = useLanguage();

  return (
    <div className="tx-discount-breakdown">
      <span className="tx-discount-breakdown-row">
        <span className="tx-discount-type">{t("transactionTable.discountItem")}</span>
        <span className="tx-discount-label">{renderDiscounts(item)}</span>
      </span>
      <span className="tx-discount-breakdown-row">
        <span className="tx-discount-type">{t("transactionTable.discountBill")}</span>
        <span className="tx-discount-label">{renderBillDiscount(transaction)}</span>
      </span>
    </div>
  );
}

function ProductTransactionDetailModal({
  viewingProduct,
  viewingTransaction,
  onBackToProduct,
  onClose,
}) {
  const { t } = useLanguage();
  const isPurchase = viewingTransaction.type === "purchase";
  const transaction = viewingTransaction.data;
  const summary = computeVatSummary(
    transaction.items || [],
    transaction.vat_mode,
    transaction
  );
  const showVat = transaction.vat_mode !== "none";
  const documents = getTransactionDocuments(transaction, t);

  return (
    <div
      className="detail-modal product-detail-modal section-card"
      role="dialog"
      aria-modal="true"
      aria-labelledby="transaction-detail-title"
    >
      <div className="section-heading supplier-modal-header">
        <div>
          <p className="eyebrow">
            {isPurchase
              ? t("products.purchaseTransactionEyebrow")
              : t("products.saleTransactionEyebrow")}
          </p>
          <h3 id="transaction-detail-title">{transaction.reference_no}</h3>
        </div>
        <div className="product-detail-header-actions">
          <button className="secondary-button" type="button" onClick={onBackToProduct}>
            {t("products.backButton")}
          </button>
          <button
            className="icon-button subtle"
            type="button"
            aria-label={t("common.close")}
            onClick={onClose}
          >
            X
          </button>
        </div>
      </div>

      <div className="product-detail-body">
        <div className="detail-grid">
          <div>
            <p className="detail-label">
              {isPurchase
                ? t("products.transactionSupplierLabel")
                : t("products.transactionCustomerLabel")}
            </p>
            <strong>
              {isPurchase ? transaction.supplier_name || "—" : transaction.customer_name || "—"}
            </strong>
          </div>
          <div>
            <p className="detail-label">{t("products.transactionStatusLabel")}</p>
            <strong>
              <span className={`status-badge status-${transaction.status}`}>
                {getStatusLabel(t, transaction.status)}
              </span>
            </strong>
          </div>
          <div>
            <p className="detail-label">{t("products.transactionDateLabel")}</p>
            <strong>{formatDate(transaction.transaction_date)}</strong>
          </div>
          <div>
            <p className="detail-label">{t("products.transactionPaymentTermLabel")}</p>
            <strong>
              {transaction.payment_term_type === "credit"
                ? t("products.creditPaymentTerm", {
                    term: transaction.payment_term_days || "—",
                  })
                : transaction.payment_term_type === "debit"
                  ? t("products.debitPaymentTerm")
                  : "—"}
            </strong>
          </div>
          <div>
            <p className="detail-label">{t("products.transactionPaymentDateLabel")}</p>
            <strong>{formatDate(transaction.payment_date)}</strong>
          </div>
          <div>
            <p className="detail-label">{t("products.transactionDocumentsLabel")}</p>
            {documents.length ? (
              <div className="transaction-document-list">
                {documents.map((document) => (
                  <a key={document.id} href={document.url} target="_blank" rel="noreferrer">
                    {document.name || getDocumentName(document.url, t)}
                  </a>
                ))}
              </div>
            ) : (
              <strong>—</strong>
            )}
          </div>
          <div className="full-width">
            <p className="detail-label">{t("products.transactionNotesLabel")}</p>
            <strong>{transaction.note || "—"}</strong>
          </div>
        </div>

        <div className="product-detail-section detail-items">
          <p className="detail-label">{t("products.transactionItemsLabel")}</p>
          <div className="table-scroll">
            {isPurchase ? (
              <table>
                <thead>
                  <tr>
                    <th className="table-index-cell">#</th>
                    <th>{t("products.colProduct")}</th>
                    <th>{t("products.skuLabel")}</th>
                    <th>{t("products.purchaseColExpectedDelivery")}</th>
                    <th>{t("products.purchaseColLeadTime")}</th>
                    <th>{t("products.purchaseColItemStatus")}</th>
                    <th>{t("products.purchaseColReceivedDate")}</th>
                    <th>{t("products.purchaseColQty")}</th>
                    <th>{t("products.purchaseColBaseQty")}</th>
                    <th>{t("products.purchaseColUnitCost")}</th>
                    <th>{t("products.purchaseColDiscounts")}</th>
                    <th>{t("products.purchaseColAmount")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(transaction.items || []).map((item, itemIndex) => {
                    const isHighlighted =
                      viewingProduct && itemMatchesProduct(item, viewingProduct);
                    const amount = computeItemAmount(item, transaction);
                    const quantityDetails = getItemQuantityDetails(
                      item,
                      viewingProduct,
                      "purchase"
                    );
                    const displayStatus = getPurchaseItemDisplayStatus(item, transaction.status);

                    return (
                      <tr
                        key={item.id}
                        className={isHighlighted ? "transaction-row-highlight" : ""}
                      >
                        <td className="table-index-cell">{itemIndex + 1}</td>
                        <td>{item.product_name}</td>
                        <td>{item.sku || "—"}</td>
                        <td>{formatDate(item.expected_delivery_date)}</td>
                        <td>{formatPurchaseLeadTime(item, transaction)}</td>
                        <td>
                          <span className={`status-badge item-status-badge status-${displayStatus}`}>
                            {getStatusLabel(t, displayStatus)}
                          </span>
                        </td>
                        <td>{formatDate(item.received_date)}</td>
                        <td>{quantityDetails.enteredLabel}</td>
                        <td>{quantityDetails.baseLabel}</td>
                        <td>
                          {item.unit_cost !== undefined && item.unit_cost !== null
                            ? formatCurrency(item.unit_cost)
                            : "—"}
                        </td>
                        <td>
                          <DiscountBreakdown item={item} transaction={transaction} />
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
                    <th>{t("products.colProduct")}</th>
                    <th>{t("products.saleColQty")}</th>
                    <th>{t("products.saleColBaseQty")}</th>
                    <th>{t("products.saleColUnitPrice")}</th>
                    <th>{t("products.saleColDiscounts")}</th>
                    <th>{t("products.saleColAmount")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(transaction.items || []).map((item, itemIndex) => {
                    const isHighlighted =
                      viewingProduct && itemMatchesProduct(item, viewingProduct);
                    const amount = computeItemAmount(item, transaction);
                    const quantityDetails = getItemQuantityDetails(
                      item,
                      viewingProduct,
                      "sale"
                    );

                    return (
                      <tr
                        key={item.id}
                        className={isHighlighted ? "transaction-row-highlight" : ""}
                      >
                        <td className="table-index-cell">{itemIndex + 1}</td>
                        <td>{item.product_name}</td>
                        <td>{quantityDetails.enteredLabel}</td>
                        <td>{quantityDetails.baseLabel}</td>
                        <td>
                          {item.unit_price !== undefined && item.unit_price !== null
                            ? formatCurrency(item.unit_price)
                            : "—"}
                        </td>
                        <td>
                          <DiscountBreakdown item={item} transaction={transaction} />
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

        <div className="tx-sales-summary">
          {renderBillDiscount(transaction) !== "—" ? (
            <div className="tx-summary-row">
              <span>{t("products.billDiscountLabel")}</span>
              <span>{renderBillDiscount(transaction)}</span>
            </div>
          ) : null}
          {showVat ? (
            <>
              <div className="tx-summary-row">
                <span>{isPurchase ? t("products.totalLabel") : t("products.subtotalLabel")}</span>
                <span>{formatCurrency(summary.subtotal)}</span>
              </div>
              <div className="tx-summary-row">
                <span>{t("products.vatLabel")}</span>
                <span>{formatCurrency(summary.vat)}</span>
              </div>
            </>
          ) : null}
          <div className="tx-summary-row tx-summary-grand">
            <strong>{t("products.grandTotalLabel")}</strong>
            <strong>{formatCurrency(summary.grandTotal)}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProductTransactionDetailModal;
