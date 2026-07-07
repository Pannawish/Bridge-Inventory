// Status badge component for credit note records.

import { useLanguage } from "../../i18n/LanguageContext";
import { formatCreditNoteStatus } from "./creditNoteUtils";

function CreditNoteStatusPill({ status }) {
  const { t } = useLanguage();

  return (
    <span className={`status-badge status-${status || "issued"}`}>
      {formatCreditNoteStatus(status, t)}
    </span>
  );
}

export default CreditNoteStatusPill;
