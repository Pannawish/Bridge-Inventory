import PaginationControls from "../PaginationControls";
import { formatPurchaseLeadTime, getPurchaseItemDisplayStatus } from "../../purchaseStatus";
import { getStoredSaleItemStatus } from "../../saleStatus";
import {
  getProductBaseUnit,
  getItemQuantityDetails,
} from "../../unitConversion";
import { formatDate } from "../../format";
import { useLanguage } from "../../i18n/LanguageContext";
import { getStatusLabel } from "../../i18n/statusLabels";
import {
  computeItemAmount,
  computeVatSummary,
  formatCurrency,
  formatStockQuantity,
  getDocumentName,
  getProductCategoryLabel,
  getProductPictures,
  getProductSubNames,
  getSelectedProductPicture,
  getTransactionDocuments,
  itemMatchesProduct,
  renderBillDiscount,
  renderDiscounts,
} from "./productUtils";
import {
  computePurchaseBaseUnitCostAfterDiscount,
  computePurchaseBaseUnitCostBeforeDiscount,
  formatOptionalCurrency,
  getTranslatedProductDisplayName,
} from "./productEditorHelpers";

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

function TransactionDetailModal({
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
                          <span
                            className={`status-badge item-status-badge status-${displayStatus}`}
                          >
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

function ProductHistoryModal({
  viewingProduct,
  viewingPictureId,
  onViewingPictureChange,
  categories,
  viewingProductMetrics,
  productHistoryLoadingId,
  productHistoryError,
  viewPurchaseHistory,
  purchaseHistoryPagination,
  onPurchaseHistoryPageChange,
  viewSalesHistory,
  salesHistoryPagination,
  onSalesHistoryPageChange,
  onOpenTransactionDetail,
  onOpenProductEditor,
  onClose,
}) {
  const { t } = useLanguage();
  const viewingProductPictures = getProductPictures(viewingProduct);
  const selectedViewingPicture =
    viewingProductPictures.find((picture) => picture.id === viewingPictureId) ||
    getSelectedProductPicture(viewingProduct);

  return (
    <div
      className="detail-modal product-detail-modal section-card"
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-history-title"
    >
      <div className="section-heading supplier-modal-header">
        <div>
          <p className="eyebrow">{t("products.purchaseHistoryEyebrow")}</p>
          <h3 id="product-history-title">
            {getTranslatedProductDisplayName(viewingProduct, t)}
          </h3>
        </div>
        <div className="product-detail-header-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={() => onOpenProductEditor(viewingProduct)}
          >
            {t("common.edit")}
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

      <div className="product-history-info-strip">
        <div className="product-history-stat">
          <span>{t("products.statSKU")}</span>
          <strong>{viewingProduct.sku || "—"}</strong>
        </div>
        <div className="product-history-stat">
          <span>{t("products.statCategory")}</span>
          <strong>{getProductCategoryLabel(viewingProduct, categories) || "—"}</strong>
        </div>
        <div className="product-history-stat">
          <span>{t("products.statTotalUnits")}</span>
          <strong>{formatStockQuantity(viewingProductMetrics?.totalUnits ?? 0, viewingProduct)}</strong>
        </div>
        <div className="product-history-stat">
          <span>{t("products.statAvgPrice")}</span>
          <strong>{formatCurrency(viewingProductMetrics?.avgPrice ?? 0)}</strong>
        </div>
      </div>

      <div className="product-detail-body">
        <div className="product-profile-panel">
          <div className="product-profile-media">
            {selectedViewingPicture?.url ? (
              <img
                src={selectedViewingPicture.url}
                alt={getTranslatedProductDisplayName(viewingProduct, t)}
                className="product-profile-image"
                onError={(event) => {
                  event.target.style.display = "none";
                }}
              />
            ) : (
              <div className="product-profile-placeholder">{t("products.noImage")}</div>
            )}
            {viewingProductPictures.length > 1 ? (
              <div className="product-picture-links compact">
                {viewingProductPictures.map((picture) => (
                  <button
                    className={
                      selectedViewingPicture?.id === picture.id
                        ? "product-picture-link active"
                        : "product-picture-link"
                    }
                    type="button"
                    key={picture.id}
                    onClick={() => onViewingPictureChange(picture.id)}
                  >
                    {picture.name || getDocumentName(picture.url, t)}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="product-profile-copy">
            <div>
              <p className="detail-label">{t("products.mainNameLabel")}</p>
              <strong>{getTranslatedProductDisplayName(viewingProduct, t)}</strong>
            </div>
            <div>
              <p className="detail-label">{t("products.subNamesLabel")}</p>
              {getProductSubNames(viewingProduct).length ? (
                <div className="item-pill-list">
                  {getProductSubNames(viewingProduct).map((subName) => (
                    <span key={subName} className="item-pill">
                      {subName}
                    </span>
                  ))}
                </div>
              ) : (
                <strong>—</strong>
              )}
            </div>
            <div>
              <p className="detail-label">{t("products.categoryLabel")}</p>
              <strong>{getProductCategoryLabel(viewingProduct, categories) || "—"}</strong>
            </div>
            <div>
              <p className="detail-label">{t("products.baseStockUnitLabel")}</p>
              <strong>{getProductBaseUnit(viewingProduct)}</strong>
            </div>
            <div>
              <p className="detail-label">{t("products.productDetailLabel")}</p>
              <p className="product-detail-text">{viewingProduct.detail || "—"}</p>
            </div>
          </div>
        </div>

        {productHistoryLoadingId === `${viewingProduct.id}` ? (
          <div className="notice-banner">{t("products.loadingTransactionHistory")}</div>
        ) : null}
        {productHistoryError ? <div className="error-banner">{productHistoryError}</div> : null}

        <div className="product-detail-section">
          <p className="detail-label">{t("products.purchaseHistoryEyebrow")}</p>
          {viewPurchaseHistory.length === 0 ? (
            <p className="empty-copy">{t("products.noPurchaseHistory")}</p>
          ) : (
            <div>
              <div className="transaction-table-window product-history-table-window">
                <div className="table-scroll desktop-table">
                  <table className="transaction-history-table transaction-history-table-purchase product-history-transaction-table">
                    <colgroup>
                      <col className="product-history-col-index" />
                      <col className="product-history-col-reference" />
                      <col className="product-history-col-party" />
                      <col className="product-history-col-date" />
                      <col className="product-history-col-qty" />
                      <col className="product-history-col-qty" />
                      <col className="product-history-col-money" />
                      <col className="product-history-col-base-cost" />
                      <col className="product-history-col-base-cost" />
                      <col className="product-history-col-discount" />
                      <col className="product-history-col-money" />
                      <col className="product-history-col-status" />
                      <col className="product-history-col-action" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th className="table-index-cell">#</th>
                        <th>{t("products.purchaseColRef")}</th>
                        <th>{t("products.purchaseColSupplier")}</th>
                        <th>{t("products.purchaseColDate")}</th>
                        <th>{t("products.purchaseColQty")}</th>
                        <th>{t("products.purchaseColBaseQty")}</th>
                        <th>{t("products.purchaseColUnitCost")}</th>
                        <th>
                          <span className="compact-column-heading">
                            <span>{t("products.purchaseColBaseCostBefore")}</span>
                          </span>
                        </th>
                        <th>
                          <span className="compact-column-heading">
                            <span>{t("products.purchaseColBaseCostAfter")}</span>
                          </span>
                        </th>
                        <th>{t("products.purchaseColDiscounts")}</th>
                        <th>{t("products.purchaseColAmount")}</th>
                        <th>{t("products.purchaseColStatus")}</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {viewPurchaseHistory.map(({ purchase, item }, itemIndex) => {
                        const quantityDetails = getItemQuantityDetails(item, viewingProduct, "purchase");
                        const rowNumber =
                          (purchaseHistoryPagination.page - 1) *
                            purchaseHistoryPagination.page_size +
                          itemIndex +
                          1;
                        const displayStatus = getPurchaseItemDisplayStatus(item, purchase.status);

                        return (
                          <tr key={`${purchase.id}-${item.id}`}>
                            <td className="table-index-cell">{rowNumber}</td>
                            <td>{purchase.reference_no}</td>
                            <td>{purchase.supplier_name}</td>
                            <td>{formatDate(purchase.transaction_date)}</td>
                            <td>{quantityDetails.enteredLabel}</td>
                            <td>{quantityDetails.baseLabel}</td>
                            <td>
                              {item.unit_cost !== undefined && item.unit_cost !== null
                                ? formatCurrency(item.unit_cost)
                                : "—"}
                            </td>
                            <td>{formatOptionalCurrency(computePurchaseBaseUnitCostBeforeDiscount(item))}</td>
                            <td>
                              {formatOptionalCurrency(
                                computePurchaseBaseUnitCostAfterDiscount(item, purchase)
                              )}
                            </td>
                            <td>
                              <DiscountBreakdown item={item} transaction={purchase} />
                            </td>
                            <td>{formatCurrency(computeItemAmount(item, purchase))}</td>
                            <td>
                              <span className={`status-badge status-${displayStatus}`}>
                                {getStatusLabel(t, displayStatus)}
                              </span>
                            </td>
                            <td>
                              <button
                                className="table-action-button"
                                type="button"
                                onClick={() => onOpenTransactionDetail("purchase", purchase)}
                              >
                                {t("products.detailsButton")}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <PaginationControls
                pagination={purchaseHistoryPagination}
                onPageChange={onPurchaseHistoryPageChange}
                itemLabel={t("products.purchasePaginationLabel")}
              />
            </div>
          )}
        </div>

        <div className="product-detail-section">
          <p className="detail-label">{t("products.salesHistoryEyebrow")}</p>
          {viewSalesHistory.length === 0 ? (
            <p className="empty-copy">{t("products.noSalesHistory")}</p>
          ) : (
            <div>
              <div className="transaction-table-window product-history-table-window">
                <div className="table-scroll desktop-table">
                  <table className="transaction-history-table transaction-history-table-sale product-history-transaction-table">
                    <colgroup>
                      <col className="product-history-col-index" />
                      <col className="product-history-col-reference" />
                      <col className="product-history-col-party" />
                      <col className="product-history-col-date" />
                      <col className="product-history-col-qty" />
                      <col className="product-history-col-qty" />
                      <col className="product-history-col-money" />
                      <col className="product-history-col-discount" />
                      <col className="product-history-col-money" />
                      <col className="product-history-col-status" />
                      <col className="product-history-col-action" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th className="table-index-cell">#</th>
                        <th>{t("products.saleColRef")}</th>
                        <th>{t("products.saleColCustomer")}</th>
                        <th>{t("products.saleColDate")}</th>
                        <th>{t("products.saleColQty")}</th>
                        <th>{t("products.saleColBaseQty")}</th>
                        <th>{t("products.saleColUnitPrice")}</th>
                        <th>{t("products.saleColDiscounts")}</th>
                        <th>{t("products.saleColAmount")}</th>
                        <th>{t("products.saleColStatus")}</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {viewSalesHistory.map(({ sale, item }, itemIndex) => {
                        const quantityDetails = getItemQuantityDetails(item, viewingProduct, "sale");
                        const displayStatus = getStoredSaleItemStatus(item, sale.status);
                        const rowNumber =
                          (salesHistoryPagination.page - 1) * salesHistoryPagination.page_size +
                          itemIndex +
                          1;

                        return (
                          <tr key={`${sale.id}-${item.id}`}>
                            <td className="table-index-cell">{rowNumber}</td>
                            <td>{sale.reference_no}</td>
                            <td>{sale.customer_name}</td>
                            <td>{formatDate(sale.transaction_date)}</td>
                            <td>{quantityDetails.enteredLabel}</td>
                            <td>{quantityDetails.baseLabel}</td>
                            <td>
                              {item.unit_price !== undefined && item.unit_price !== null
                                ? formatCurrency(item.unit_price)
                                : "—"}
                            </td>
                            <td>
                              <DiscountBreakdown item={item} transaction={sale} />
                            </td>
                            <td>{formatCurrency(computeItemAmount(item, sale))}</td>
                            <td>
                              <span className={`status-badge status-${displayStatus}`}>
                                {getStatusLabel(t, displayStatus)}
                              </span>
                            </td>
                            <td>
                              <button
                                className="table-action-button"
                                type="button"
                                onClick={() => onOpenTransactionDetail("sale", sale)}
                              >
                                {t("products.detailsButton")}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <PaginationControls
                pagination={salesHistoryPagination}
                onPageChange={onSalesHistoryPageChange}
                itemLabel={t("products.salesPaginationLabel")}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProductDetailModal(props) {
  const { viewingProduct, viewingTransaction } = props;

  if (!viewingProduct && !viewingTransaction) {
    return null;
  }

  return (
    <div className="modal-backdrop">
      {viewingTransaction ? (
        <TransactionDetailModal {...props} />
      ) : (
        <ProductHistoryModal {...props} />
      )}
    </div>
  );
}

export default ProductDetailModal;
