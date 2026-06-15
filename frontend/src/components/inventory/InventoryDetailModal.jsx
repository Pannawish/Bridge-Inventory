import { useMemo } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { formatDate } from "../../format";
import { getItemBaseQuantity } from "../../unitConversion";
import { ReorderSawtoothFull } from "../charts/ReorderSawtooth";
import {
  num,
  formatUnits,
  getAvailable,
  getBuyQuantity,
  getDailyDemand,
  getReorderLevel,
} from "./inventoryUtils";

const ACTIVE_SALE_ITEM = (status) =>
  status !== "cancelled" && status !== "returned" && status !== "draft";

// The sales orders that consumed this product, newest first, plus a summary
// (total units, distinct orders, and units/day over the active span). This is
// the "why is it popular" evidence behind the dashboard ranking.
function buildSalesActivity(sales, productId) {
  const entries = [];
  const orderIds = new Set();
  let totalUnits = 0;
  let firstDate = null;
  let lastDate = null;

  (Array.isArray(sales) ? sales : []).forEach((sale) => {
    if (!sale || sale.status === "cancelled") return;
    (sale.items || []).forEach((item, index) => {
      if (`${item.product_id}` !== `${productId}`) return;
      const status = item.item_status || item.status || sale.status;
      if (!ACTIVE_SALE_ITEM(status)) return;
      const qty = getItemBaseQuantity(item);
      if (!(qty > 0)) return;
      entries.push({
        key: `${sale.id}-${item.id ?? index}`,
        ref: sale.reference_no || sale.id,
        date: sale.transaction_date || "",
        customer: sale.customer_name || "",
        qty,
      });
      totalUnits += qty;
      orderIds.add(`${sale.id}`);
      const date = sale.transaction_date;
      if (date) {
        if (!firstDate || date < firstDate) firstDate = date;
        if (!lastDate || date > lastDate) lastDate = date;
      }
    });
  });

  entries.sort((a, b) => String(b.date).localeCompare(String(a.date)));

  let perDay = 0;
  if (firstDate && lastDate) {
    const spanDays = Math.max(
      1,
      Math.round((new Date(lastDate) - new Date(firstDate)) / 86_400_000) + 1
    );
    perDay = totalUnits / spanDays;
  }

  return { entries, totalUnits, orderCount: orderIds.size, perDay };
}

const HEALTH_TONE = { low: "danger", watch: "warning", healthy: "positive", dead: "neutral" };

function CalcLine({ label, value, note, highlight }) {
  return (
    <div className={`inv-calc-line${highlight ? " is-key" : ""}`}>
      <span className="inv-calc-label">{label}</span>
      <strong className="inv-calc-value">{value}</strong>
      {note ? <span className="inv-calc-note">{note}</span> : null}
    </div>
  );
}

// Product reorder-point detail — same modal chrome as the purchase/sale
// TransactionDetailModal: reorder-point graph + the calculation beside it,
// with the FIFO stock layers below.
function InventoryDetailModal({ row, health, sales = [], onClose }) {
  const { t } = useLanguage();

  const unit = row.unit || "";
  const available = getAvailable(row);
  const reorder = getReorderLevel(row);
  const demand = getDailyDemand(row);
  const buy = getBuyQuantity(row);
  const days = row.days_until_stockout;
  const leadTime = num(row.average_lead_time_days);
  const safety = num(row.safety_stock);
  const salesActivity = useMemo(
    () => buildSalesActivity(sales, row.product_id),
    [sales, row.product_id]
  );

  return (
    <>
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="detail-modal section-card inv-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inv-detail-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">{`${row.sku || "—"} · ${row.category || t("inventory.uncategorized")}`}</p>
            <h3 id="inv-detail-title">{row.product_name || "—"}</h3>
          </div>
          <div className="transaction-detail-actions">
            <button className="secondary-button table-action-button" type="button" onClick={onClose}>
              {t("common.close")}
            </button>
          </div>
        </div>

        <div className="inv-detail-graphwrap">
          <p className="inv-detail-heading">{t("inventory.graph.title")}</p>
          <div className="inv-graph-frame">
            <ReorderSawtoothFull
              current={available}
              reorder={reorder}
              safety={safety}
              dailyDemand={demand}
              leadTime={leadTime}
              restock={buy}
              unit={unit}
              tone={HEALTH_TONE[health] || "accent"}
            />
          </div>
        </div>

        <div className="inv-detail-block">
          <p className="inv-detail-heading">{t("inventory.calc.title")}</p>
          <div className="inv-calc-list inv-calc-grid">
              <CalcLine
                label={t("inventory.calc.onHand")}
                value={t("inventory.unitsValue", { qty: formatUnits(available), unit })}
              />
              <CalcLine
                label={t("inventory.calc.dailyDemand")}
                value={demand > 0 ? `${formatUnits(Math.round(demand * 100) / 100)} ${unit}` : "—"}
                note={t("inventory.calc.dailyDemandNote")}
              />
              <CalcLine
                label={t("inventory.calc.leadTime")}
                value={leadTime > 0 ? t("inventory.calc.daysValue", { days: formatUnits(leadTime) }) : "—"}
                note={t("inventory.calc.leadTimeNote")}
              />
              <CalcLine
                label={t("inventory.calc.leadDemand")}
                value={t("inventory.unitsValue", { qty: formatUnits(Math.round(demand * leadTime)), unit })}
                note={t("inventory.calc.leadDemandNote")}
              />
              <CalcLine
                label={t("inventory.calc.safetyStock")}
                value={t("inventory.unitsValue", { qty: formatUnits(safety), unit })}
                note={
                  num(row.safety_stock_days) > 0
                    ? t("inventory.calc.safetyStockNote", { days: formatUnits(num(row.safety_stock_days)) })
                    : undefined
                }
              />
              <CalcLine
                highlight
                label={t("inventory.calc.reorderPoint")}
                value={t("inventory.unitsValue", { qty: formatUnits(reorder), unit })}
                note={t("inventory.calc.reorderPointNote")}
              />
              <CalcLine
                label={t("inventory.calc.daysLeft")}
                value={
                  days === null || days === undefined
                    ? t("inventory.card.noDemandDays")
                    : t("inventory.calc.daysValue", { days: formatUnits(days) })
                }
                note={t("inventory.calc.daysLeftNote")}
              />
              <CalcLine
                label={t("inventory.calc.recommendedBuy")}
                value={buy > 0 ? t("inventory.unitsValue", { qty: formatUnits(buy), unit }) : t("inventory.card.noBuy")}
                note={t("inventory.calc.recommendedBuyNote")}
              />
            </div>
          </div>

        <div className="inv-detail-block">
          <p className="inv-detail-heading">{t("inventory.salesActivity.title")}</p>
          {salesActivity.entries.length === 0 ? (
            <p className="empty-copy inv-layers-empty">{t("inventory.salesActivity.empty")}</p>
          ) : (
            <>
              <p className="inv-sales-summary">
                {t("inventory.salesActivity.summary", {
                  units: formatUnits(Math.round(salesActivity.totalUnits)),
                  unit,
                  orders: formatUnits(salesActivity.orderCount),
                  perDay: formatUnits(Math.round(salesActivity.perDay * 100) / 100),
                })}
              </p>
              <div className="transaction-table-window">
                <div className="table-scroll inv-layers-scroll">
                  <table className="transaction-history-table inv-layers-table">
                    <thead>
                      <tr>
                        <th>{t("inventory.salesActivity.colDate")}</th>
                        <th>{t("inventory.salesActivity.colRef")}</th>
                        <th>{t("inventory.salesActivity.colCustomer")}</th>
                        <th style={{ textAlign: "right" }}>{t("inventory.salesActivity.colQty")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesActivity.entries.map((entry) => (
                        <tr key={entry.key} className="partner-table-row">
                          <td>{entry.date ? formatDate(entry.date) : "—"}</td>
                          <td>
                            <strong>{entry.ref}</strong>
                          </td>
                          <td>{entry.customer || "—"}</td>
                          <td style={{ textAlign: "right" }}>
                            {formatUnits(entry.qty)} {unit}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
    </>
  );
}

export default InventoryDetailModal;
