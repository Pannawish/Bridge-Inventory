import { useState } from "react";
import {
  markPurchaseItemReceived,
  purchaseStatuses,
  updatePurchaseItemReceivedDate,
  updatePurchaseItemStatus,
} from "../purchaseStatus";
import { saleStatuses, updateSaleItemDate, updateSaleItemStatus } from "../saleStatus";
import { formatSaleStockIssueMessage, getSaleStockIssues } from "../saleStock";
import { deepEqual } from "../equality";
import DocumentRefModal from "./DocumentRefModal";
import { useLanguage } from "../i18n/LanguageContext";
import TransactionDetailModal from "./transactions/TransactionDetailModal";
import TransactionTableDirectorySection from "./transactions/TransactionTableDirectorySection";
import {
  getRowGrandTotal,
  formatCurrency,
} from "./transactions/transactionTableUtils";

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
  initialDetailRow = null,
}) {
  const { language, t } = useLanguage();
  // Seed the detail popup from a deep-link (dashboard Order/Delivery Planning) as
  // *initial* state so it is present in the table's very first render — the modal
  // paints in the same frame as the list, with no post-mount effect hop and no
  // "list flashes, then card pops" gap. Plain View clicks still open it normally.
  const [selectedRow, setSelectedRow] = useState(initialDetailRow);
  const [originalRow, setOriginalRow] = useState(initialDetailRow);
  const [showAllRows, setShowAllRows] = useState(false);
  const [docRefModal, setDocRefModal] = useState(null);
  const title =
    type === "purchase" ? t("transactionTable.titlePurchases") : t("transactionTable.titleSales");
  const personKey = type === "purchase" ? "supplier_name" : "customer_name";
  const statuses = type === "purchase" ? purchaseStatuses : saleStatuses;
  const detailTitle =
    type === "purchase"
      ? t("transactionTable.detailTitlePurchase")
      : t("transactionTable.detailTitleSale");
  const detailNameLabel =
    type === "purchase" ? t("transactionTable.supplierLabel") : t("transactionTable.customerLabel");
  const shouldShowViewAll = enableViewAll && compactRows > 0 && rows.length > compactRows;
  const isCompact = shouldShowViewAll && !showAllRows;
  const visibleRows = isCompact ? rows.slice(0, compactRows) : rows;
  const rowsGrandTotal = rows.reduce(
    (sum, row) => sum + getRowGrandTotal(row, type),
    0
  );
  // Derived, not a one-way flag: Save is only enabled while the working row
  // actually differs from the row as it was opened/last saved. Reverting an
  // edit back to its original value turns Save off again.
  const hasUnsavedItemChanges =
    !!selectedRow && !!originalRow && !deepEqual(selectedRow, originalRow);

  function handleDeleteSelectedRow() {
    const confirmed = window.confirm(
      t("transactionTable.deleteConfirm", {
        ref: selectedRow.reference_no || t("transactionTable.thisTransaction"),
      })
    );

    if (!confirmed) {
      return;
    }

    onDeleteRow?.(selectedRow);
    closeSelectedRow();
  }

  function openSelectedRow(row) {
    setSelectedRow(row);
    setOriginalRow(row);
  }

  function closeSelectedRow() {
    setSelectedRow(null);
    setOriginalRow(null);
  }

  function handleMarkPurchaseItemReceived(itemIndex) {
    const updatedRow = markPurchaseItemReceived(selectedRow, itemIndex);
    setSelectedRow(updatedRow);
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
  }

  function handlePurchaseItemReceivedDateChange(itemIndex, receivedDate) {
    const updatedRow = updatePurchaseItemReceivedDate(selectedRow, itemIndex, receivedDate);
    setSelectedRow(updatedRow);
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
  }

  async function handleSavePurchaseUpdates() {
    const saved = await onPurchaseItemStatusChange?.(selectedRow);

    if (saved === false) {
      return;
    }

    setOriginalRow(selectedRow);
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
    // Validate against the original *saved* baseline (originalRow), not the live
    // selectedRow. selectedRow already carries this session's earlier unsaved
    // line changes, so using it as the baseline subtracts those out of the demand
    // and lets the order over-commit stock one line at a time. Measuring the delta
    // from the saved state counts every unsaved change in this session together.
    const issues = enableSaleStockPrecheck
      ? getSaleStockIssues(updatedRow, products, purchases, sales, {
          excludeSaleId: selectedRow.id,
          currentSale: originalRow || selectedRow,
        })
      : [];

    if (issues.length) {
      onWarning?.(
        formatSaleStockIssueMessage(issues, {
          t,
          locale: language === "th" ? "th-TH" : "en-US",
        })
      );
      return;
    }

    onWarning?.("");
    setSelectedRow(updatedRow);
  }

  function handleSaleItemDateChange(itemIndex, fieldName, nextValue) {
    const updatedRow = updateSaleItemDate(selectedRow, itemIndex, fieldName, nextValue);
    setSelectedRow(updatedRow);
  }

  async function handleSaveSaleUpdates() {
    const saved = await onSaleUpdate?.(selectedRow);

    if (saved === false) {
      return;
    }

    setOriginalRow(selectedRow);
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

      <TransactionTableDirectorySection
        rows={visibleRows}
        type={type}
        personKey={personKey}
        statuses={statuses}
        isCompact={isCompact}
        onOpenSelectedRow={openSelectedRow}
        onPurchaseStatusChange={onPurchaseStatusChange}
        onSaleStatusChange={onSaleStatusChange}
        getRowGrandTotal={(row) => getRowGrandTotal(row, type)}
      />

      {rows.length ? (
        <div className="tx-sales-summary transaction-grand-total">
          <div className="tx-summary-row tx-summary-grand">
            <strong>{t("transactionTable.colGrandTotal")}</strong>
            <strong>{formatCurrency(rowsGrandTotal)}</strong>
          </div>
        </div>
      ) : null}

      {selectedRow ? (
        <TransactionDetailModal
          selectedRow={selectedRow}
          type={type}
          products={products}
          personKey={personKey}
          detailTitle={detailTitle}
          detailNameLabel={detailNameLabel}
          hasUnsavedItemChanges={hasUnsavedItemChanges}
          onClose={closeSelectedRow}
          onEditRow={onEditRow}
          onSavePurchaseUpdates={
            type === "purchase" && onPurchaseItemStatusChange ? handleSavePurchaseUpdates : null
          }
          onSaveSaleUpdates={type === "sale" && onSaleUpdate ? handleSaveSaleUpdates : null}
          onPurchaseTaxInvoiceChange={handlePurchaseTaxInvoiceChange}
          onSaleCustomerPoReferenceChange={handleSaleCustomerPoReferenceChange}
          onPurchaseItemStatusChange={handlePurchaseItemStatusChange}
          onPurchaseItemReceivedDateChange={handlePurchaseItemReceivedDateChange}
          onMarkPurchaseItemReceived={handleMarkPurchaseItemReceived}
          onSaleItemStatusChange={handleSaleItemStatusChange}
          onSaleItemDateChange={handleSaleItemDateChange}
          onDeleteRow={onDeleteRow ? handleDeleteSelectedRow : null}
          onOpenDocRef={setDocRefModal}
        />
      ) : null}

      {docRefModal ? (
        <DocumentRefModal
          docType={docRefModal.docType}
          docId={docRefModal.docId}
          referenceNo={docRefModal.referenceNo}
          onClose={() => setDocRefModal(null)}
        />
      ) : null}
    </section>
  );
}

export default TransactionTable;
