// Modal component for inventory control workflows.

import { useLanguage } from "../../i18n/LanguageContext";

// Generic KPI drill-down popup — same chrome as the other detail modals
// (modal-backdrop › detail-modal section-card › section-heading). Shows what a
// headline number means and the products/transactions behind it.
function InventoryMetricModal({ eyebrow, title, value, tone = "neutral", description, headerAction, onClose, children }) {
  const { t } = useLanguage();

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="detail-modal section-card inv-metric-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h3>{title}</h3>
          </div>
          <div className="transaction-detail-actions">
            {headerAction}
            <button type="button" className="secondary-button table-action-button" onClick={onClose}>
              {t("common.close")}
            </button>
          </div>
        </div>

        <div className={`inv-metric-headline tone-${tone}`}>{value}</div>
        {description ? <p className="inv-metric-desc">{description}</p> : null}

        <div className="inv-metric-body">{children}</div>
      </div>
    </div>
  );
}

export default InventoryMetricModal;
