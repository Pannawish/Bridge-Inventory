import { useLanguage } from "../../i18n/LanguageContext";
import { formatBillingNoteStatus } from "./billingNoteUtils";

function BillingNoteStatusPill({ status }) {
  const { t } = useLanguage();
  const className = `status-badge status-${status || "issued"}`;
  return <span className={className}>{formatBillingNoteStatus(status, t)}</span>;
}

export default BillingNoteStatusPill;
