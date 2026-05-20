function DocumentRefChip({ label, docType, onClick }) {
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
      title={`Open ${label}`}
    >
      <span className="doc-ref-chip-icon">{icons[docType] || "🔗"}</span>
      <span className="doc-ref-chip-label">{label}</span>
      <span className="doc-ref-chip-arrow">↗</span>
    </button>
  );
}

export default DocumentRefChip;
