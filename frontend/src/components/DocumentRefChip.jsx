import { useLanguage } from "../i18n/LanguageContext";

function DocumentRefChip({ label, docType, onClick }) {
  const { t } = useLanguage();
  const icons = {
    quotation: "📋",
    purchase: "🛒",
    sale: "🧾",
    "billing-note": "📄",
    "credit-note": "📝",
    "payment-batch": "💳",
  };

  return (
    <button
      type="button"
      className={`doc-ref-chip doc-ref-chip--${docType}`}
      onClick={onClick}
      title={t("documentRef.open", { label })}
    >
      <span className="doc-ref-chip-icon">{icons[docType] || "🔗"}</span>
      <span className="doc-ref-chip-label">{label}</span>
      <span className="doc-ref-chip-arrow">↗</span>
    </button>
  );
}

export default DocumentRefChip;
