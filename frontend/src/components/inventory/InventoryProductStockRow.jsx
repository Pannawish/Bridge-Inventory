import { formatMoney as fmt } from "../../format";
import { useLanguage } from "../../i18n/LanguageContext";
import { useState } from "react";
import InventoryDetailModal from "./InventoryDetailModal";
import {
  formatUnits,
  getAvailable,
  getBuyQuantity,
  getDailyDemand,
  getReorderLevel,
  getStockValue,
  getSupplierOptions,
} from "./inventoryUtils";

function HealthBadge({ health }) {
  const { t } = useLanguage();

  return (
    <span className={`inv-health-badge inv-health-${health}`}>
      <i className="inv-health-dot" aria-hidden="true" />
      {t(`inventory.health.${health}`)}
    </span>
  );
}

function MovementBadge({ movement }) {
  const { t } = useLanguage();

  return (
    <span className={`inv-move-badge inv-move-${movement}`}>
      {t(`inventory.movement.${movement}`)}
    </span>
  );
}

function InventoryProductStockRow({ row, health, movement }) {
  const { t } = useLanguage();
  const [detailOpen, setDetailOpen] = useState(false);

  const unit = row.unit || "";
  const available = getAvailable(row);
  const reorder = getReorderLevel(row);
  const demand = getDailyDemand(row);
  const buy = getBuyQuantity(row);
  const days = row.days_until_stockout;
  const options = getSupplierOptions(row);
  const best = options[0] || null;
  const hasPoint = reorder > 0;
  const belowPoint = hasPoint && available <= reorder;
  const daysText =
    days === null || days === undefined
      ? t("inventory.card.noDemandDays")
      : t("inventory.card.daysLeft", { days: formatUnits(days) });
  const demandText = demand > 0 ? formatUnits(Math.round(demand * 100) / 100) : "—";
  const supplierNote = best
    ? options.length > 1
      ? t("inventory.card.moreSuppliers", { count: options.length - 1 })
      : t("inventory.card.onlySupplier")
    : null;

  return (
    <article className={`inv-card inv-card-${health}`}>
      <div className="inv-row-grid">
        <section className="inv-row-section inv-row-product">
          <p className="inv-row-section-label">{t("inventory.colProduct")}</p>
          <div className="inv-card-name">
            <strong>{row.product_name || "—"}</strong>
            <span>{`${row.sku || "—"} · ${row.category || t("inventory.uncategorized")}`}</span>
          </div>
          <div className="inv-row-badges">
            <HealthBadge health={health} />
            <MovementBadge movement={movement} />
          </div>
        </section>

        <section className="inv-row-section inv-row-stock">
          <p className="inv-row-section-label">{t("inventory.sectionStock")}</p>
          <div className="inv-row-metric">
            <span>{t("inventory.card.onHand")}</span>
            <strong>{t("inventory.unitsValue", { qty: formatUnits(available), unit })}</strong>
          </div>
          <div className="inv-row-metric">
            <span>{t("inventory.card.reorderPoint")}</span>
            <strong>{t("inventory.unitsValue", { qty: formatUnits(reorder), unit })}</strong>
          </div>
          <div className="inv-row-metric">
            <span>{t("inventory.card.suggestedBuy")}</span>
            {buy > 0 ? (
              <strong>{t("inventory.unitsValue", { qty: formatUnits(buy), unit })}</strong>
            ) : (
              <em className="inv-row-value-muted">{t("inventory.card.noBuy")}</em>
            )}
          </div>
          <p className={`inv-row-note ${hasPoint ? (belowPoint ? "is-low" : "is-ok") : ""}`}>
            {hasPoint
              ? belowPoint
                ? t("inventory.card.belowPoint")
                : t("inventory.card.abovePoint")
              : t("inventory.card.noPoint")}
          </p>
          <p className="inv-row-note">
            {t("inventory.card.demandPerDay")}: {demandText} · {daysText}
          </p>
        </section>

        <section className="inv-row-section inv-row-supplier">
          <p className="inv-row-section-label">{t("inventory.sectionSupplier")}</p>
          <div className="inv-row-metric">
            <span>{t("inventory.card.reorderFrom")}</span>
            {best ? <strong>{best.supplier_name}</strong> : <em className="inv-row-value-muted">{t("inventory.card.noSupplier")}</em>}
          </div>
          <div className="inv-row-metric">
            <span>{t("inventory.card.lastCost")}</span>
            {best ? (
              <strong>
                {t("inventory.card.pricePerUnit", {
                  amount: fmt(best.last_cost),
                  unit: unit || "unit",
                })}
              </strong>
            ) : (
              <em className="inv-row-value-muted">—</em>
            )}
          </div>
          <div className="inv-row-metric">
            <span>{t("inventory.card.stockValue")}</span>
            <strong>{fmt(getStockValue(row))}</strong>
          </div>
          {supplierNote ? <p className="inv-row-note">{supplierNote}</p> : null}
          <div className="inv-row-expand-bar">
            <button
              type="button"
              className="secondary-button compact-button inv-row-expand-btn"
              onClick={() => setDetailOpen(true)}
            >
              {t("inventory.showDetails")}
            </button>
          </div>
        </section>
      </div>

      {detailOpen ? (
        <InventoryDetailModal row={row} health={health} onClose={() => setDetailOpen(false)} />
      ) : null}
    </article>
  );
}

export default InventoryProductStockRow;
