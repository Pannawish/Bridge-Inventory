import {
  editablePurchaseItemStatuses,
  formatPurchaseLeadTime,
  getPurchaseItemDisplayStatus,
  getPurchaseItemStatusCounts,
  getStoredPurchaseItemStatus,
} from "../../purchaseStatus";
import {
  editableSaleItemStatuses,
  getSaleItemStatusCounts,
  getStoredSaleItemStatus,
} from "../../saleStatus";
import { getItemQuantityDetails } from "../../unitConversion";
import { formatDate } from "../../format";
import { useLanguage } from "../../i18n/LanguageContext";
import { getStatusLabel } from "../../i18n/statusLabels";
import DocumentRefChip from "../DocumentRefChip";
import {
  computeItemAmount,
  computePurchaseBaseUnitCostAfterDiscount,
  computePurchaseBaseUnitCostBeforeDiscount,
  findProductForItem,
  formatCurrency,
  formatOptionalCurrency,
  getDocumentName,
  getItemStatusOptions,
  getPurchasePayableSummary,
  getTransactionDocuments,
  getVatSummary,
  renderBillDiscount,
  renderDiscounts,
} from "./transactionTableUtils";

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
  selectedRow,
  type,
  products,
  personKey,
  detailTitle,
  detailNameLabel,
  hasUnsavedItemChanges,
  onClose,
  onEditRow,
  onSavePurchaseUpdates,
  onSaveSaleUpdates,
  onPurchaseTaxInvoiceChange,
  onSaleCustomerPoReferenceChange,
  onPurchaseItemStatusChange,
  onPurchaseItemReceivedDateChange,
  onMarkPurchaseItemReceived,
  onSaleItemStatusChange,
  onSaleItemDateChange,
  onDeleteRow,
  onOpenDocRef,
}) {
  const { t } = useLanguage();

  function renderRefCell(label, docType, links) {
    const validLinks = (links || []).filter((link) => link && link.id);

    return (
      <div>
        <p className="detail-label">{label}</p>
        {validLinks.length ? (
          <div className="doc-ref-chips">
            {validLinks.map((link) => (
              <DocumentRefChip
                key={`${docType}-${link.id}`}
                label={link.reference_no || link.id}
                docType={docType}
                onClick={() =>
                  onOpenDocRef({
                    docType,
                    docId: link.id,
                    referenceNo: link.reference_no || link.id,
                  })
                }
              />
            ))}
          </div>
        ) : (
          <strong>—</strong>
        )}
      </div>
    );
  }

  const { subtotal, vat, grandTotal } = getVatSummary(selectedRow);
  const showVat = selectedRow.vat_mode !== "none";
  const payableSummary = type === "purchase" ? getPurchasePayableSummary(selectedRow) : null;
  const showPayable = payableSummary?.hasCancelledValue;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className={`detail-modal transaction-detail-modal transaction-detail-modal-${type} section-card`}
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
                  onClose();
                }}
              >
                {t("common.edit")}
              </button>
            ) : null}
            {type === "purchase" && onSavePurchaseUpdates ? (
              <button
                className="primary-button table-action-button transaction-save-button"
                type="button"
                onClick={onSavePurchaseUpdates}
                disabled={!hasUnsavedItemChanges}
              >
                {t("transactionTable.savePurchaseUpdates")}
              </button>
            ) : null}
            {type === "sale" && onSaveSaleUpdates ? (
              <button
                className="primary-button table-action-button transaction-save-button"
                type="button"
                onClick={onSaveSaleUpdates}
                disabled={!hasUnsavedItemChanges}
              >
                {t("transactionTable.saveSaleUpdates")}
              </button>
            ) : null}
            <button
              className="secondary-button table-action-button"
              type="button"
              onClick={onClose}
            >
              {t("common.close")}
            </button>
          </div>
        </div>

        <div className="detail-grid">
          <div>
            <p className="detail-label">{detailNameLabel}</p>
            <strong>{selectedRow[personKey] || "—"}</strong>
          </div>
          <div>
            <p className="detail-label">{t("transactionTable.colStatus")}</p>
            <strong>
              <span className={`status-badge status-${selectedRow.status}`}>
                {getStatusLabel(t, selectedRow.status)}
              </span>
            </strong>
          </div>
          <div>
            <p className="detail-label">{t("transactionTable.transactionDate")}</p>
            <strong>{formatDate(selectedRow.transaction_date)}</strong>
          </div>
          <div>
            <p className="detail-label">{t("transactionTable.paymentTerm")}</p>
            <strong>
              {selectedRow.payment_term_type === "credit"
                ? t("transactionTable.paymentCredit", {
                    days: selectedRow.payment_term_days || "—",
                  })
                : selectedRow.payment_term_type === "debit"
                  ? t("transactionTable.paymentDebit")
                  : "—"}
            </strong>
          </div>
          <div>
            <p className="detail-label">{t("transactionTable.paymentDate")}</p>
            <strong>{formatDate(selectedRow.payment_date)}</strong>
          </div>
          <div>
            <p className="detail-label">{t("transactionTable.colDocuments")}</p>
            {getTransactionDocuments(selectedRow, t).length ? (
              <div className="transaction-document-list">
                {getTransactionDocuments(selectedRow, t).map((document) => (
                  <a key={document.id} href={document.url} target="_blank" rel="noreferrer">
                    {document.name || getDocumentName(document.url, t)}
                  </a>
                ))}
              </div>
            ) : (
              <strong>—</strong>
            )}
          </div>
          {type === "purchase" ? (
            <div className="purchase-tax-invoice-field">
              <p className="detail-label">{t("transactionTable.supplierTaxInvoice")}</p>
              <input
                className="purchase-tax-invoice-input"
                type="text"
                value={selectedRow.supplier_tax_invoice || ""}
                onChange={(event) => onPurchaseTaxInvoiceChange(event.target.value)}
                placeholder={t("transactionTable.enterSupplierTaxInvoice")}
              />
            </div>
          ) : null}
          {type === "sale" ? (
            <div className="purchase-tax-invoice-field">
              <p className="detail-label">{t("transactionTable.customerPOReference")}</p>
              <input
                className="purchase-tax-invoice-input"
                type="text"
                value={selectedRow.customer_po_reference || ""}
                onChange={(event) => onSaleCustomerPoReferenceChange(event.target.value)}
                placeholder={t("transactionTable.enterCustomerPOReference")}
              />
            </div>
          ) : null}
          {type === "purchase" ? (
            <>
              {renderRefCell(
                t("transactionTable.sourceQuotation"),
                "quotation",
                selectedRow.source_quotation_id
                  ? [
                      {
                        id: selectedRow.source_quotation_id,
                        reference_no: selectedRow.source_quotation_reference_no,
                      },
                    ]
                  : []
              )}
              {renderRefCell(
                t("transactionTable.paymentBatch"),
                "payment-batch",
                selectedRow.payment_batch_links
              )}
            </>
          ) : null}
          {type === "sale" ? (
            <>
              {renderRefCell(
                t("transactionTable.sourceQuotation"),
                "quotation",
                selectedRow.source_quotation_id
                  ? [
                      {
                        id: selectedRow.source_quotation_id,
                        reference_no: selectedRow.source_quotation_reference_no,
                      },
                    ]
                  : []
              )}
              {renderRefCell(
                t("transactionTable.billingNotes"),
                "billing-note",
                selectedRow.billing_note_links
              )}
              {renderRefCell(
                t("transactionTable.creditNotes"),
                "credit-note",
                selectedRow.credit_note_links
              )}
            </>
          ) : null}
          <div className="full-width">
            <p className="detail-label">{t("transactionTable.notes")}</p>
            <strong>{selectedRow.note || "—"}</strong>
          </div>
        </div>

        <div className="detail-items">
          <p className="detail-label">{t("transactionTable.colItems")}</p>
          {type === "purchase" ? (
            <div
              className="item-receiving-summary"
              aria-label={t("transactionTable.itemReceivingStatus")}
            >
              <span className="item-receiving-title">
                {t("transactionTable.itemReceivingStatus")}
              </span>
              {["pending", "delayed", "received", "cancelled"].map((status) => {
                const counts = getPurchaseItemStatusCounts(
                  selectedRow.items || [],
                  selectedRow.status
                );

                return (
                  <span
                    key={status}
                    className={`status-badge item-status-badge status-${status}`}
                  >
                    {counts[status]} {getStatusLabel(t, status)}
                  </span>
                );
              })}
            </div>
          ) : null}
          {type === "sale" ? (
            <div
              className="item-receiving-summary"
              aria-label={t("transactionTable.itemSalesStatus")}
            >
              <span className="item-receiving-title">
                {t("transactionTable.itemSalesStatus")}
              </span>
              {["pending", "packed", "shipped", "delivered", "cancelled", "returned"].map(
                (status) => {
                  const counts = getSaleItemStatusCounts(
                    selectedRow.items || [],
                    selectedRow.status
                  );

                  return (
                    <span
                      key={status}
                      className={`status-badge item-status-badge status-${status}`}
                    >
                      {counts[status]} {getStatusLabel(t, status)}
                    </span>
                  );
                }
              )}
            </div>
          ) : null}
          <div className="table-scroll">
            {type === "sale" ? (
              <table className="detail-item-table detail-item-table-sale">
                <thead>
                  <tr>
                    <th className="table-index-cell">#</th>
                    <th>{t("transactionTable.colProduct")}</th>
                    <th>{t("transactionTable.colItemStatus")}</th>
                    <th>{t("transactionTable.colShippedDate")}</th>
                    <th>{t("transactionTable.colDeliveredDate")}</th>
                    <th>{t("transactionTable.colQty")}</th>
                    <th>{t("transactionTable.colBaseQty")}</th>
                    <th>{t("transactionTable.colUnitPrice")}</th>
                    <th>{t("transactionTable.supplierLabel")}</th>
                    <th>{t("transactionTable.colUnitCost")}</th>
                    <th>{t("transactionTable.colDiscounts")}</th>
                    <th>{t("transactionTable.colAmount")}</th>
                    <th>{t("transactionTable.colMargin")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedRow.items || []).map((item, itemIndex) => {
                    const amount = computeItemAmount(item, selectedRow);
                    const itemStatus = getStoredSaleItemStatus(item, selectedRow.status);
                    const itemStatusOptions = getItemStatusOptions(
                      editableSaleItemStatuses,
                      itemStatus
                    );
                    const quantityDetails = getItemQuantityDetails(
                      item,
                      findProductForItem(products, item),
                      "sale"
                    );

                    return (
                      <tr key={item.id || `${item.sku}-${itemIndex}`}>
                        <td className="table-index-cell">{itemIndex + 1}</td>
                        <td>{item.product_name}</td>
                        <td>
                          <div className="purchase-item-status-control">
                            <select
                              className={`status-select item-status-select status-${itemStatus}`}
                              value={itemStatus}
                              onChange={(event) =>
                                onSaleItemStatusChange(itemIndex, event.target.value)
                              }
                              aria-label={t("transactionTable.changeSalesStatusAria", {
                                product: item.product_name,
                              })}
                            >
                              {itemStatusOptions.map((status) => (
                                <option key={status} value={status}>
                                  {getStatusLabel(t, status)}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td>
                          <input
                            className="received-date-input"
                            type="date"
                            value={item.shipped_date || ""}
                            onChange={(event) =>
                              onSaleItemDateChange(itemIndex, "shipped_date", event.target.value)
                            }
                            disabled={!["shipped", "delivered"].includes(itemStatus)}
                          />
                        </td>
                        <td>
                          <input
                            className="received-date-input"
                            type="date"
                            value={item.delivered_date || ""}
                            onChange={(event) =>
                              onSaleItemDateChange(itemIndex, "delivered_date", event.target.value)
                            }
                            disabled={itemStatus !== "delivered"}
                          />
                        </td>
                        <td>{quantityDetails.enteredLabel}</td>
                        <td>{quantityDetails.baseLabel}</td>
                        <td>{item.unit_price ? formatCurrency(item.unit_price) : "—"}</td>
                        <td>{item.supplier_name || "—"}</td>
                        <td>
                          {Number(item.unit_cost) > 0 ? formatCurrency(item.unit_cost) : "—"}
                        </td>
                        <td>
                          <DiscountBreakdown item={item} transaction={selectedRow} />
                        </td>
                        <td>{formatCurrency(amount)}</td>
                        <td>
                          {(() => {
                            const lineCost =
                              Number(item.unit_cost || 0) * Number(item.quantity || 0);
                            return lineCost > 0
                              ? formatCurrency(amount - lineCost)
                              : "—";
                          })()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <table className="detail-item-table detail-item-table-purchase">
                <thead>
                  <tr>
                    <th className="table-index-cell">#</th>
                    <th>{t("transactionTable.colProduct")}</th>
                    <th>{t("transactionTable.colSKU")}</th>
                    <th>{t("transactionTable.colExpectedDelivery")}</th>
                    <th>{t("transactionTable.colLeadTime")}</th>
                    <th>{t("transactionTable.colItemStatus")}</th>
                    <th>{t("transactionTable.colReceivedDate")}</th>
                    <th>{t("transactionTable.colQty")}</th>
                    <th>{t("transactionTable.colBaseQty")}</th>
                    <th>{t("transactionTable.colUnitCost")}</th>
                    <th>
                      <span className="compact-column-heading">
                        <span>{t("transactionTable.colBaseCost")}</span>
                        <span>{t("transactionTable.beforeDisc")}</span>
                      </span>
                    </th>
                    <th>
                      <span className="compact-column-heading">
                        <span>{t("transactionTable.colBaseCost")}</span>
                        <span>{t("transactionTable.afterDisc")}</span>
                      </span>
                    </th>
                    <th>{t("transactionTable.colDiscounts")}</th>
                    <th>{t("transactionTable.colAmount")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {(selectedRow.items || []).map((item, itemIndex) => {
                    const amount = computeItemAmount(item, selectedRow);
                    const displayStatus = getPurchaseItemDisplayStatus(item, selectedRow.status);
                    const storedStatus = getStoredPurchaseItemStatus(item, selectedRow.status);
                    const itemStatusOptions = getItemStatusOptions(
                      editablePurchaseItemStatuses,
                      storedStatus
                    );
                    const canMarkReceived =
                      !["draft", "cancelled"].includes(selectedRow.status) &&
                      !["cancelled", "received"].includes(storedStatus);
                    const quantityDetails = getItemQuantityDetails(
                      item,
                      findProductForItem(products, item),
                      "purchase"
                    );
                    const isCancelled = storedStatus === "cancelled";

                    return (
                      <tr
                        key={item.id || `${item.sku}-${itemIndex}`}
                        className={isCancelled ? "detail-item-cancelled" : undefined}
                      >
                        <td className="table-index-cell">{itemIndex + 1}</td>
                        <td>{item.product_name}</td>
                        <td>{item.sku || "—"}</td>
                        <td>{formatDate(item.expected_delivery_date)}</td>
                        <td>{formatPurchaseLeadTime(item, selectedRow)}</td>
                        <td>
                          <div className="purchase-item-status-control">
                            <select
                              className={`status-select item-status-select status-${displayStatus}`}
                              value={storedStatus}
                              onChange={(event) =>
                                onPurchaseItemStatusChange(itemIndex, event.target.value)
                              }
                              disabled={selectedRow.status === "draft"}
                              aria-label={t("transactionTable.changeReceivingStatusAria", {
                                product: item.product_name,
                              })}
                            >
                              {itemStatusOptions.map((status) => (
                                <option key={status} value={status}>
                                  {getStatusLabel(t, status)}
                                </option>
                              ))}
                            </select>
                            {displayStatus === "delayed" ? (
                              <span className="status-badge item-status-badge status-delayed">
                                {t("transactionTable.delayed")}
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
                              onPurchaseItemReceivedDateChange(itemIndex, event.target.value)
                            }
                            disabled={storedStatus !== "received"}
                          />
                        </td>
                        <td>{quantityDetails.enteredLabel}</td>
                        <td>{quantityDetails.baseLabel}</td>
                        <td>{item.unit_cost ? formatCurrency(item.unit_cost) : "—"}</td>
                        <td>
                          {formatOptionalCurrency(
                            computePurchaseBaseUnitCostBeforeDiscount(item)
                          )}
                        </td>
                        <td>
                          {formatOptionalCurrency(
                            computePurchaseBaseUnitCostAfterDiscount(item, selectedRow)
                          )}
                        </td>
                        <td>
                          <DiscountBreakdown item={item} transaction={selectedRow} />
                        </td>
                        <td className={isCancelled ? "detail-item-amount-cancelled" : undefined}>
                          {formatCurrency(amount)}
                        </td>
                        <td>
                          <button
                            className="secondary-button table-action-button mark-received-button"
                            type="button"
                            onClick={() => onMarkPurchaseItemReceived(itemIndex)}
                            disabled={!canMarkReceived}
                          >
                            {t("transactionTable.markReceived")}
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

        <div className="tx-sales-summary">
          {renderBillDiscount(selectedRow) !== "—" ? (
            <div className="tx-summary-row">
              <span>{t("transactionTable.billDiscount")}</span>
              <span>{renderBillDiscount(selectedRow)}</span>
            </div>
          ) : null}
          {showVat ? (
            <>
              <div className="tx-summary-row">
                <span>
                  {type === "purchase"
                    ? t("transactionTable.colTotal")
                    : t("transactionTable.subtotal")}
                </span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="tx-summary-row">
                <span>{t("transactionTable.vat", { rate: 7 })}</span>
                <span>{formatCurrency(vat)}</span>
              </div>
            </>
          ) : null}
          <div className="tx-summary-row tx-summary-grand">
            <strong>
              {showPayable
                ? t("transactionTable.originalTotal")
                : t("transactionTable.colGrandTotal")}
            </strong>
            <strong>{formatCurrency(grandTotal)}</strong>
          </div>
          {showPayable ? (
            <>
              <div className="tx-summary-row tx-summary-cancelled">
                <span>
                  {t("transactionTable.cancelledAmount", {
                    count: payableSummary.cancelledCount,
                  })}
                </span>
                <span>-{formatCurrency(payableSummary.cancelled)}</span>
              </div>
              <div className="tx-summary-row tx-summary-grand tx-summary-payable">
                <strong>{t("transactionTable.amountPayable")}</strong>
                <strong>{formatCurrency(payableSummary.payable)}</strong>
              </div>
            </>
          ) : null}
        </div>

        {onDeleteRow ? (
          <div className="transaction-detail-footer">
            <button
              className="danger-button"
              type="button"
              onClick={onDeleteRow}
            >
              {t("common.delete")}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default TransactionDetailModal;
