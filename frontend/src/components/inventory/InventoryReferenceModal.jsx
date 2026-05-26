import { useLanguage } from "../../i18n/LanguageContext";

function ReferenceTable({ title, subtitle, rows }) {
  const { t } = useLanguage();

  return (
    <section className="section-card inv-ref-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{title}</p>
          <h4>{subtitle}</h4>
        </div>
      </div>
      <div className="table-scroll">
        <table className="detail-item-table inv-ref-table">
          <thead>
            <tr>
              <th>{t("inventory.refColHeader")}</th>
              <th>{t("inventory.refDescHeader")}</th>
              <th>{t("inventory.refFormulaHeader")}</th>
            </tr>
          </thead>
          <tbody>
            {(Array.isArray(rows) ? rows : []).map((row) => (
              <tr key={row.col}>
                <td><strong>{row.col}</strong></td>
                <td>{row.desc}</td>
                <td className="inv-ref-formula">{row.formula}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function InventoryReferenceModal({ onClose }) {
  const { t } = useLanguage();

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="detail-modal inv-ref-modal section-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inv-ref-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("inventory.refEyebrow")}</p>
            <h3 id="inv-ref-title">{t("inventory.refTitle")}</h3>
            <p className="inv-ref-subtitle">{t("inventory.refSubtitle")}</p>
          </div>
          <button
            type="button"
            className="secondary-button table-action-button"
            onClick={onClose}
          >
            {t("common.close")}
          </button>
        </div>

        <div className="inv-ref-stack">
          <ReferenceTable
            title={t("inventory.refPlanningTitle")}
            subtitle={t("inventory.refPlanningSubtitle")}
            rows={t("inventory.refPlanningRows")}
          />
          <ReferenceTable
            title={t("inventory.refPositionTitle")}
            subtitle={t("inventory.refPositionSubtitle")}
            rows={t("inventory.refPositionRows")}
          />
          <ReferenceTable
            title={t("inventory.refContextTitle")}
            subtitle={t("inventory.refContextSubtitle")}
            rows={t("inventory.refContextRows")}
          />
        </div>
      </div>
    </div>
  );
}

export default InventoryReferenceModal;
