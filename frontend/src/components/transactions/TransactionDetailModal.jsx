import { useLanguage } from "../../i18n/LanguageContext";
import TransactionDetailFields from "./TransactionDetailFields";
import TransactionDetailItemsSection from "./TransactionDetailItemsSection";
import TransactionDetailSummary from "./TransactionDetailSummary";

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

        <TransactionDetailFields
          selectedRow={selectedRow}
          type={type}
          personKey={personKey}
          detailNameLabel={detailNameLabel}
          onPurchaseTaxInvoiceChange={onPurchaseTaxInvoiceChange}
          onSaleCustomerPoReferenceChange={onSaleCustomerPoReferenceChange}
          onOpenDocRef={onOpenDocRef}
        />

        <TransactionDetailItemsSection
          selectedRow={selectedRow}
          type={type}
          products={products}
          onPurchaseItemStatusChange={onPurchaseItemStatusChange}
          onPurchaseItemReceivedDateChange={onPurchaseItemReceivedDateChange}
          onMarkPurchaseItemReceived={onMarkPurchaseItemReceived}
          onSaleItemStatusChange={onSaleItemStatusChange}
          onSaleItemDateChange={onSaleItemDateChange}
        />

        <TransactionDetailSummary selectedRow={selectedRow} type={type} />

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
