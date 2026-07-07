// React component for shared component: payment line amount.

import { formatMoney as fmt } from "../format";
import { useLanguage } from "../i18n/LanguageContext";

// Shows what a payment-batch line actually pays and explains any gap from the
// purchase's original total: cancelled items reduce an unpaid line, while a line
// already paid surfaces a discrepancy if the purchase total has since changed.
// Shared by the payment batch page and the document reference modal so both views
// explain a reduced amount the same way.
export default function PaymentLineAmount({ line }) {
  const { t } = useLanguage();

  const amount = Number(line.amount) || 0;
  const original = Number(line.purchase_grand_total) || 0;
  const currentPayable = Number.isFinite(Number(line.purchase_payable_total))
    ? Number(line.purchase_payable_total)
    : amount;
  const cancelledItems = line.purchase_cancelled_items || [];

  const showOriginal = original - amount > 0.005;
  const hasCancellations = cancelledItems.length > 0;
  const paidDiscrepancy = line.paid && Math.abs(currentPayable - amount) > 0.005;

  const cancelledTitle = cancelledItems
    .map((item) => `${item.product_name} (−${fmt(item.amount)})`)
    .join("\n");

  return (
    <div className="payment-batch-amount-cell">
      <span>{fmt(amount)}</span>
      {showOriginal ? (
        <span className="payment-batch-original-amount">{fmt(original)}</span>
      ) : null}
      {hasCancellations ? (
        <span className="payment-batch-reason" title={cancelledTitle}>
          {t("paymentBatch.cancelledReason", { count: cancelledItems.length })}
        </span>
      ) : null}
      {paidDiscrepancy ? (
        <span
          className="payment-batch-discrepancy"
          title={t("paymentBatch.paidDiscrepancyHint", { amount: fmt(currentPayable) })}
        >
          {t("paymentBatch.paidDiscrepancy", { amount: fmt(currentPayable) })}
        </span>
      ) : null}
    </div>
  );
}
