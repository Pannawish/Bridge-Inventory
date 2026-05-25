import { useState } from "react";
import {
  editablePurchaseItemStatuses,
  formatStatusLabel,
  formatPurchaseLeadTime,
  getPurchaseItemDisplayStatus,
  getPurchaseItemStatusCounts,
  getStoredPurchaseItemStatus,
  markPurchaseItemReceived,
  purchaseStatuses,
  updatePurchaseItemReceivedDate,
  updatePurchaseItemStatus,
} from "../purchaseStatus";
import {
  editableSaleItemStatuses,
  getSaleItemStatusCounts,
  getStoredSaleItemStatus,
  saleStatuses,
  updateSaleItemDate,
  updateSaleItemStatus,
} from "../saleStatus";
import { formatSaleStockIssueMessage, getSaleStockIssues } from "../saleStock";
import { getItemBaseQuantity, getItemQuantityDetails } from "../unitConversion";
import { formatDate } from "../format";
import DocumentRefChip from "./DocumentRefChip";
import DocumentRefModal from "./DocumentRefModal";
import { useLanguage } from "../i18n/LanguageContext";

const VAT_RATE = 0.07;

function formatCurrency(value) {
  return `฿${Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function applyBillDiscount(amount, transaction) {
  const billDiscount = Math.min(
    100,
    Math.max(0, Number(transaction?.bill_discount ?? transaction?.billDiscount ?? 0) || 0)
  );

  return amount * (1 - billDiscount / 100);
}

function computeItemAmount(item, transaction = null) {
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
    return applyBillDiscount(qty * price * multiplier, transaction);
  }

  const disc = Math.min(100, Math.max(0, Number(item.discount) || 0));
  return applyBillDiscount(qty * price * (1 - disc / 100), transaction);
}

function computePurchaseBaseUnitCostBeforeDiscount(item) {
  const unitCost = Number(item.unit_cost);
  if (!Number.isFinite(unitCost)) {
    return null;
  }

  const quantity = Number(item.quantity) || 0;
  const baseQuantity = getItemBaseQuantity(item);
  const conversionFactor = Number(item.conversion_factor ?? item.conversionFactor);
  const resolvedFactor =
    Number.isFinite(conversionFactor) && conversionFactor > 0
      ? conversionFactor
      : quantity > 0 && baseQuantity > 0
        ? baseQuantity / quantity
        : 1;

  return unitCost / resolvedFactor;
}

function computePurchaseBaseUnitCostAfterDiscount(item, transaction = null) {
  const baseQuantity = getItemBaseQuantity(item);
  if (baseQuantity <= 0) {
    return null;
  }

  return computeItemAmount(item, transaction) / baseQuantity;
}

function formatOptionalCurrency(value) {
  return value === null || value === undefined || !Number.isFinite(Number(value))
    ? "—"
    : formatCurrency(value);
}

function renderDiscounts(item) {
  if (Array.isArray(item.discounts)) {
    const active = item.discounts.filter((d) => Number(d) > 0);
    if (active.length > 0) {
      return active.map((d) => `${Number(d)}%`).join("|");
    }
    return "—";
  }

  if (Number(item.discount) > 0) {
    return `${Number(item.discount)}%`;
  }

  return "—";
}

function renderBillDiscount(transaction) {
  const discount = Number(transaction?.bill_discount ?? transaction?.billDiscount ?? 0);

  if (discount > 0) {
    return `${discount}%`;
  }

  return "—";
}

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

function normalizeLookupValue(value) {
  return `${value ?? ""}`.trim().toLowerCase();
}

function getProductSearchNames(product) {
  const mainName = `${
    product?.name ?? product?.productName ?? product?.product_name ?? ""
  }`.trim();
  const subNames = Array.isArray(product?.subNames)
    ? product.subNames
    : Array.isArray(product?.sub_names)
      ? product.sub_names
      : [];

  return [mainName, ...subNames]
    .map((name) => `${name ?? ""}`.trim())
    .filter(
      (name, index, names) =>
        name && names.findIndex((item) => item.toLowerCase() === name.toLowerCase()) === index
    );
}

function findProductForItem(products = [], item = {}) {
  const itemProductId = normalizeLookupValue(item.product_id ?? item.productId);
  const itemSku = normalizeLookupValue(item.sku);
  const itemName = normalizeLookupValue(item.product_name ?? item.productName ?? item.name);

  return (
    products.find((product) => {
      const productId = normalizeLookupValue(product.id);
      const productSku = normalizeLookupValue(product.sku ?? product.SKU);
      const productNames = getProductSearchNames(product).map(normalizeLookupValue);

      return (
        (itemProductId && productId === itemProductId) ||
        (itemSku && productSku === itemSku) ||
        (itemName && productNames.includes(itemName))
      );
    }) || null
  );
}

function getItemStatusOptions(editableStatuses, currentStatus) {
  if (!currentStatus || editableStatuses.includes(currentStatus)) {
    return editableStatuses;
  }

  return [currentStatus, ...editableStatuses];
}

function getItemCount(items = []) {
  return items.length.toLocaleString("en-US");
}

function getDocumentName(documentUrl = "", t = null) {
  const [path = ""] = `${documentUrl}`.split("?");
  const name = path.split("/").filter(Boolean).pop();
  const fallback = t ? t("transactionTable.attachedDocument") : "Attached document";
  return name ? decodeURIComponent(name) : fallback;
}

function getTransactionDocuments(row = {}, t = null) {
  if (Array.isArray(row.documents) && row.documents.length) {
    return row.documents;
  }

  return row.document_url
    ? [
        {
          id: "__legacy_document__",
          name: getDocumentName(row.document_url, t),
          url: row.document_url,
        },
      ]
    : [];
}

function TransactionTable({
  rows,
  products = [],
  purchases = [],
  sales = [],
  enableSaleStockPrecheck = true,
  type,
  onPurchaseStatusChange,
  onPurchaseItemStatusChange,
  onSaleStatusChange,
  onSaleUpdate,
  onWarning,
  onEditRow,
  onDeleteRow,
  compactRows = 0,
  enableViewAll = false,
  headerActions = null,
}) {
  const { t } = useLanguage();
  const [selectedRow, setSelectedRow] = useState(null);
  const [hasUnsavedItemChanges, setHasUnsavedItemChanges] = useState(false);
  const [showAllRows, setShowAllRows] = useState(false);
  const [docRefModal, setDocRefModal] = useState(null);
  const title = type === "purchase" ? t("transactionTable.titlePurchases") : t("transactionTable.titleSales");
  const personKey = type === "purchase" ? "supplier_name" : "customer_name";
  const statuses = type === "purchase" ? purchaseStatuses : saleStatuses;
  const detailTitle = type === "purchase" ? t("transactionTable.detailTitlePurchase") : t("transactionTable.detailTitleSale");
  const detailNameLabel = type === "purchase" ? t("transactionTable.supplierLabel") : t("transactionTable.customerLabel");
  const shouldShowViewAll = enableViewAll && compactRows > 0 && rows.length > compactRows;
  const isCompact = shouldShowViewAll && !showAllRows;

  function getVatSummary(row) {
    const itemTotal = (row.items || []).reduce(
      (sum, item) => sum + computeItemAmount(item, row),
      0
    );

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
      t("transactionTable.deleteConfirm", { ref: selectedRow.reference_no || t("transactionTable.thisTransaction") })
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
    if (nextStatus === "cancelled") {
      const confirmed = window.confirm(t("transactionTable.cancelPurchaseItemConfirm"));

      if (!confirmed) {
        return;
      }
    }

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

  function handleSaleCustomerPoReferenceChange(nextValue) {
    setSelectedRow((currentRow) =>
      currentRow
        ? {
            ...currentRow,
            customer_po_reference: nextValue,
          }
        : currentRow
    );
    setHasUnsavedItemChanges(true);
  }

  async function handleSavePurchaseUpdates() {
    const saved = await onPurchaseItemStatusChange?.(selectedRow);

    if (saved === false) {
      return;
    }

    setHasUnsavedItemChanges(false);
  }

  function handleSaleItemStatusChange(itemIndex, nextStatus) {
    if (nextStatus === "cancelled" || nextStatus === "returned") {
      const confirmed = window.confirm(
        nextStatus === "returned"
          ? t("transactionTable.returnSaleItemConfirm")
          : t("transactionTable.cancelSaleItemConfirm")
      );

      if (!confirmed) {
        return;
      }
    }

    const updatedRow = updateSaleItemStatus(selectedRow, itemIndex, nextStatus);
    const issues = enableSaleStockPrecheck
      ? getSaleStockIssues(updatedRow, products, purchases, sales, {
          excludeSaleId: selectedRow.id,
          currentSale: selectedRow,
        })
      : [];

    if (issues.length) {
      onWarning?.(formatSaleStockIssueMessage(issues));
      return;
    }

    onWarning?.("");
    setSelectedRow(updatedRow);
    setHasUnsavedItemChanges(true);
  }

  function handleSaleItemDateChange(itemIndex, fieldName, nextValue) {
    const updatedRow = updateSaleItemDate(selectedRow, itemIndex, fieldName, nextValue);

    setSelectedRow(updatedRow);
    setHasUnsavedItemChanges(true);
  }

  async function handleSaveSaleUpdates() {
    const saved = await onSaleUpdate?.(selectedRow);

    if (saved === false) {
      return;
    }

    setHasUnsavedItemChanges(false);
  }

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
                  setDocRefModal({
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

  return (
    <section className="section-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("transactionTable.historyEyebrow")}</p>
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
              {showAllRows ? t("common.showRecent") : t("common.viewMore")}
            </button>
          ) : null}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="empty-copy">{t("transactionTable.noTransactions")}</p>
      ) : (
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
                {type === "sale" ? (
                  <col className="history-col-tax" />
                ) : null}
                {type === "purchase" ? (
                  <>
                    <col className="history-col-tax" />
                  </>
                ) : null}
                <col className="history-col-money" />
                <col className="history-col-action" />
              </colgroup>
              <thead>
                <tr>
                  <th className="table-index-cell">#</th>
                  <th>{t("transactionTable.colRef")}</th>
                  <th>{type === "purchase" ? t("transactionTable.supplierLabel") : t("transactionTable.customerLabel")}</th>
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
                          <span>{type === "purchase" ? t("transactionTable.purchaseOrderLabel") : t("transactionTable.salesInvoiceLabel")}</span>
                        </div>
                      </td>
                      <td>
                        <div className="cell-stack">
                          <strong>{row[personKey] || "—"}</strong>
                          <span>{type === "purchase" ? t("transactionTable.supplierLabel") : t("transactionTable.customerLabel")}</span>
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
                              {formatStatusLabel(status)}
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
                          onClick={() => openSelectedRow(row)}
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
                          {formatStatusLabel(status)}
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
                        {documents.length ? t("transactionTable.attachedCount", { count: documents.length }) : "—"}
                      </strong>
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
            <strong>{t("transactionTable.colGrandTotal")}</strong>
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
                      closeSelectedRow();
                    }}
                  >
                    {t("common.edit")}
                  </button>
                ) : null}
                {type === "purchase" && onPurchaseItemStatusChange ? (
                  <button
                    className="primary-button table-action-button transaction-save-button"
                    type="button"
                    onClick={handleSavePurchaseUpdates}
                    disabled={!hasUnsavedItemChanges}
                  >
                    {t("transactionTable.savePurchaseUpdates")}
                  </button>
                ) : null}
                {type === "sale" && onSaleUpdate ? (
                  <button
                    className="primary-button table-action-button transaction-save-button"
                    type="button"
                    onClick={handleSaveSaleUpdates}
                    disabled={!hasUnsavedItemChanges}
                  >
                    {t("transactionTable.saveSaleUpdates")}
                  </button>
                ) : null}
                <button
                  className="secondary-button table-action-button"
                  type="button"
                  onClick={closeSelectedRow}
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
                    {formatStatusLabel(selectedRow.status)}
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
                    ? t("transactionTable.paymentCredit", { days: selectedRow.payment_term_days || "—" })
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
                    onChange={(event) => handlePurchaseTaxInvoiceChange(event.target.value)}
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
                    onChange={(event) =>
                      handleSaleCustomerPoReferenceChange(event.target.value)
                    }
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
                  {renderRefCell(t("transactionTable.billingNotes"), "billing-note", selectedRow.billing_note_links)}
                  {renderRefCell(t("transactionTable.creditNotes"), "credit-note", selectedRow.credit_note_links)}
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
                <div className="item-receiving-summary" aria-label={t("transactionTable.itemReceivingStatus")}>
                  <span className="item-receiving-title">{t("transactionTable.itemReceivingStatus")}</span>
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
              {type === "sale" ? (
                <div className="item-receiving-summary" aria-label={t("transactionTable.itemSalesStatus")}>
                  <span className="item-receiving-title">{t("transactionTable.itemSalesStatus")}</span>
                  {(() => {
                    const counts = getSaleItemStatusCounts(
                      selectedRow.items || [],
                      selectedRow.status
                    );

                    return [
                      "pending",
                      "packed",
                      "shipped",
                      "delivered",
                      "cancelled",
                      "returned",
                    ].map((status) => (
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
                                    handleSaleItemStatusChange(itemIndex, event.target.value)
                                  }
                                  aria-label={`Change ${item.product_name} sales status`}
                                >
                                  {itemStatusOptions.map((status) => (
                                    <option key={status} value={status}>
                                      {formatStatusLabel(status)}
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
                                  handleSaleItemDateChange(
                                    itemIndex,
                                    "shipped_date",
                                    event.target.value
                                  )
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
                                  handleSaleItemDateChange(
                                    itemIndex,
                                    "delivered_date",
                                    event.target.value
                                  )
                                }
                                disabled={itemStatus !== "delivered"}
                              />
                            </td>
                            <td>{quantityDetails.enteredLabel}</td>
                            <td>{quantityDetails.baseLabel}</td>
                            <td>{item.unit_price ? formatCurrency(item.unit_price) : "—"}</td>
                            <td>{item.supplier_name || "—"}</td>
                            <td>
                              {Number(item.unit_cost) > 0
                                ? formatCurrency(item.unit_cost)
                                : "—"}
                            </td>
                            <td>
                              <DiscountBreakdown item={item} transaction={selectedRow} />
                            </td>
                            <td>{formatCurrency(amount)}</td>
                            <td>
                              {(() => {
                                const lineCost =
                                  Number(item.unit_cost || 0) *
                                  Number(item.quantity || 0);
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
                        const displayStatus = getPurchaseItemDisplayStatus(
                          item,
                          selectedRow.status
                        );
                        const storedStatus = getStoredPurchaseItemStatus(
                          item,
                          selectedRow.status
                        );
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

                        return (
                          <tr key={item.id || `${item.sku}-${itemIndex}`}>
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
                                    handlePurchaseItemStatusChange(itemIndex, event.target.value)
                                  }
                                  disabled={selectedRow.status === "draft"}
                                  aria-label={`Change ${item.product_name} receiving status`}
                                >
                                  {itemStatusOptions.map((status) => (
                                    <option key={status} value={status}>
                                      {formatStatusLabel(status)}
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
                                  handlePurchaseItemReceivedDateChange(
                                    itemIndex,
                                    event.target.value
                                  )
                                }
                                disabled={storedStatus !== "received"}
                                aria-label={`Edit ${item.product_name} received date`}
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
                            <td>{formatCurrency(amount)}</td>
                            <td>
                              <button
                                className="secondary-button table-action-button mark-received-button"
                                type="button"
                                onClick={() => handleMarkPurchaseItemReceived(itemIndex)}
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

            {(() => {
              const { subtotal, vat, grandTotal } = getVatSummary(selectedRow);
              const showVat = selectedRow.vat_mode !== "none";

              return (
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
                        <span>{type === "purchase" ? t("transactionTable.colTotal") : t("transactionTable.subtotal")}</span>
                        <span>{formatCurrency(subtotal)}</span>
                      </div>
                      <div className="tx-summary-row">
                        <span>{t("transactionTable.vat", { rate: 7 })}</span>
                        <span>{formatCurrency(vat)}</span>
                      </div>
                    </>
                  ) : null}
                  <div className="tx-summary-row tx-summary-grand">
                    <strong>{t("transactionTable.colGrandTotal")}</strong>
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
                  {t("common.delete")}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {docRefModal && (
        <DocumentRefModal
          docType={docRefModal.docType}
          docId={docRefModal.docId}
          referenceNo={docRefModal.referenceNo}
          onClose={() => setDocRefModal(null)}
        />
      )}
    </section>
  );
}

export default TransactionTable;
