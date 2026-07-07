// Status badge component for payment batch records.

import { useLanguage } from "../../i18n/LanguageContext";
import { formatPaymentBatchStatus } from "./paymentBatchUtils";

function PaymentBatchStatusPill({ status }) {
  const { t } = useLanguage();
  const className = `status-badge status-${status || "scheduled"}`;
  return <span className={className}>{formatPaymentBatchStatus(status, t)}</span>;
}

export default PaymentBatchStatusPill;
