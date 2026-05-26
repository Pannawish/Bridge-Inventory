import { useLanguage } from "../../i18n/LanguageContext";
import {
  formatCurrency,
  getPurchasePayableSummary,
  getVatSummary,
  renderBillDiscount,
} from "./transactionTableUtils";

function TransactionDetailSummary({ selectedRow, type }) {
  const { t } = useLanguage();
  const { subtotal, vat, grandTotal } = getVatSummary(selectedRow);
  const showVat = selectedRow.vat_mode !== "none";
  const payableSummary = type === "purchase" ? getPurchasePayableSummary(selectedRow) : null;
  const showPayable = payableSummary?.hasCancelledValue;

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
  );
}

export default TransactionDetailSummary;
