import { formatMoney as fmt } from "../../format";
import { useLanguage } from "../../i18n/LanguageContext";
import { formatUnits } from "./inventoryUtils";

function InventoryOverviewSection({
  stockReportCount,
  summary,
  movementCounts,
  onOpenReference,
}) {
  const { t } = useLanguage();

  return (
    <section className="section-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("inventory.eyebrow")}</p>
          <h3>{t("inventory.title")}</h3>
          <p className="inv-subtitle">{t("inventory.subtitle")}</p>
        </div>
        <button
          type="button"
          className="secondary-button table-action-button"
          onClick={onOpenReference}
        >
          {t("inventory.formulaReference")}
        </button>
      </div>

      <div className="dashboard-summary-grid">
        <article className="dashboard-kpi-card neutral">
          <p>{t("inventory.kpiValue")}</p>
          <strong>{fmt(summary.inventoryValue)}</strong>
          <span>{t("inventory.kpiValueUnit", { count: stockReportCount })}</span>
        </article>
        <article className="dashboard-kpi-card danger">
          <p>{t("inventory.kpiAttention")}</p>
          <strong>{formatUnits(summary.attention)}</strong>
          <span>{t("inventory.kpiAttentionHelper")}</span>
        </article>
        <article className="dashboard-kpi-card warning">
          <p>{t("inventory.kpiApproaching")}</p>
          <strong>{formatUnits(summary.approaching)}</strong>
          <span>{t("inventory.kpiApproachingHelper")}</span>
        </article>
        <article className="dashboard-kpi-card neutral">
          <p>{t("inventory.kpiDead")}</p>
          <strong>{formatUnits(summary.deadCount)}</strong>
          <span>{`${fmt(summary.deadValue)} · ${t("inventory.kpiDeadHelper")}`}</span>
        </article>
      </div>

      <p className="inv-insight-line">
        {t("inventory.insightLine", {
          fast: movementCounts.fast,
          slow: movementCounts.slow,
          dead: movementCounts.dead,
        })}
      </p>
    </section>
  );
}

export default InventoryOverviewSection;
