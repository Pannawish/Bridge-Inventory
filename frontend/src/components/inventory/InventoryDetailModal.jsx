import { useMemo, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { formatDate } from "../../format";
import { ReorderProjectionFull } from "../charts/ReorderProjection";
import {
  REORDER_WINDOWS,
  DEFAULT_REORDER_WINDOW,
  getReorderWindow,
  buildStockHistory,
  collectProductSales,
  collectProductPurchases,
  startOfToday,
  dayKey,
} from "./reorderHistory";
import {
  num,
  formatUnits,
  getAvailable,
  getBuyQuantity,
  getDailyDemand,
  getReorderLevel,
} from "./inventoryUtils";

const HEALTH_TONE = { low: "danger", watch: "warning", healthy: "positive", dead: "neutral" };

// `accent` color-codes the card's left border to match the matching line/marker
// in the graph above (e.g. safety = dashed red, reorder = dashed amber, restock
// = solid green) so the calculation reads as the graph's legend.
function CalcLine({ label, value, note, accent }) {
  return (
    <div className={`inv-calc-line${accent ? ` acc-${accent}` : ""}`}>
      <span className="inv-calc-label">{label}</span>
      <strong className="inv-calc-value">{value}</strong>
      {note ? <span className="inv-calc-note">{note}</span> : null}
    </div>
  );
}

// Product reorder-point detail — same modal chrome as the purchase/sale
// TransactionDetailModal: reorder-point graph + the calculation beside it,
// with the FIFO stock layers below.
function InventoryDetailModal({ row, health, sales = [], purchases = [], onClose }) {
  const { t } = useLanguage();
  const [windowKey, setWindowKey] = useState(DEFAULT_REORDER_WINDOW);
  const window = getReorderWindow(windowKey);

  const unit = row.unit || "";
  const available = getAvailable(row);
  const reorder = getReorderLevel(row);
  const demand = getDailyDemand(row);
  const buy = getBuyQuantity(row);
  const days = row.days_until_stockout;
  const leadTime = num(row.average_lead_time_days);
  const safety = num(row.safety_stock);

  // The timeframe drives both the projection slope and the sales list below.
  const productSales = useMemo(
    () => collectProductSales({ productId: row.product_id, sales, windowDays: window.days }),
    [sales, row.product_id, window.days]
  );
  const productPurchases = useMemo(
    () => collectProductPurchases({ productId: row.product_id, purchases, windowDays: window.days }),
    [purchases, row.product_id, window.days]
  );
  const velocity = productSales.perDay;
  const historyPoints = useMemo(() => {
    const fromDate = window.days
      ? dayKey(new Date(startOfToday().getTime() - window.days * 86_400_000))
      : null;
    return buildStockHistory({
      productId: row.product_id,
      purchases,
      sales,
      currentStock: available,
      fromDate,
    });
  }, [purchases, sales, row.product_id, available, window.days]);

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
          <div className="inv-graph-head">
            <p className="inv-detail-heading">{t("inventory.graph.title")}</p>
            <div className="rp-timeframe" role="group" aria-label={t("inventory.graph.timeframe")}>
              {REORDER_WINDOWS.map((w) => (
                <button
                  key={w.key}
                  type="button"
                  className={`rp-tf-btn${w.key === windowKey ? " is-active" : ""}`}
                  onClick={() => setWindowKey(w.key)}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>
          <div className="inv-graph-frame">
            <ReorderProjectionFull
              historyPoints={historyPoints}
              current={available}
              reorder={reorder}
              safety={safety}
              velocity={velocity > 0 ? velocity : demand}
              leadTime={leadTime}
              orderQty={buy}
              unit={unit}
              tone={HEALTH_TONE[health] || "accent"}
            />
          </div>
        </div>

        <div className="inv-detail-block">
          <p className="inv-detail-heading">{t("inventory.calc.title")}</p>
          <div className="inv-calc-list inv-calc-grid">
              <CalcLine
                accent="stock"
                label={t("inventory.calc.onHand")}
                value={t("inventory.unitsValue", { qty: formatUnits(available), unit })}
              />
              <CalcLine
                accent="demand"
                label={t("inventory.calc.dailyDemand")}
                value={demand > 0 ? `${formatUnits(Math.round(demand * 100) / 100)} ${unit}` : "—"}
                note={t("inventory.calc.dailyDemandNote")}
              />
              <CalcLine
                accent="lead"
                label={t("inventory.calc.leadTime")}
                value={leadTime > 0 ? t("inventory.calc.daysValue", { days: formatUnits(leadTime) }) : "—"}
                note={t("inventory.calc.leadTimeNote")}
              />
              <CalcLine
                accent="lead"
                label={t("inventory.calc.leadDemand")}
                value={t("inventory.unitsValue", { qty: formatUnits(Math.round(demand * leadTime)), unit })}
                note={t("inventory.calc.leadDemandNote")}
              />
              <CalcLine
                accent="safety"
                label={t("inventory.calc.safetyStock")}
                value={t("inventory.unitsValue", { qty: formatUnits(safety), unit })}
                note={
                  num(row.safety_stock_days) > 0
                    ? t("inventory.calc.safetyStockNote", { days: formatUnits(num(row.safety_stock_days)) })
                    : undefined
                }
              />
              <CalcLine
                accent="reorder"
                label={t("inventory.calc.reorderPoint")}
                value={t("inventory.unitsValue", { qty: formatUnits(reorder), unit })}
                note={t("inventory.calc.reorderPointNote")}
              />
              <CalcLine
                accent="risk"
                label={t("inventory.calc.daysLeft")}
                value={
                  days === null || days === undefined
                    ? t("inventory.card.noDemandDays")
                    : t("inventory.calc.daysValue", { days: formatUnits(days) })
                }
                note={t("inventory.calc.daysLeftNote")}
              />
              <CalcLine
                accent="restock"
                label={t("inventory.calc.recommendedBuy")}
                value={buy > 0 ? t("inventory.unitsValue", { qty: formatUnits(buy), unit }) : t("inventory.card.noBuy")}
                note={t("inventory.calc.recommendedBuyNote")}
              />
            </div>
          </div>

        <div className="inv-detail-block">
          <div className="inv-graph-head">
            <p className="inv-detail-heading">{t("inventory.purchaseHistory.title")}</p>
            <span className="inv-sales-window">{window.label}</span>
          </div>
          {productPurchases.entries.length === 0 ? (
            <p className="empty-copy inv-layers-empty">{t("inventory.purchaseHistory.empty")}</p>
          ) : (
            <>
              <p className="inv-sales-summary">
                {t("inventory.purchaseHistory.summary", {
                  units: formatUnits(Math.round(productPurchases.totalUnits)),
                  unit,
                  orders: formatUnits(productPurchases.orderCount),
                  lead: formatUnits(Math.round(productPurchases.avgLead * 10) / 10),
                })}
              </p>
              <div className="transaction-table-window">
                <div className="table-scroll inv-layers-scroll">
                  <table className="transaction-history-table inv-layers-table">
                    <thead>
                      <tr>
                        <th>{t("inventory.purchaseHistory.colDate")}</th>
                        <th>{t("inventory.purchaseHistory.colRef")}</th>
                        <th>{t("inventory.purchaseHistory.colSupplier")}</th>
                        <th style={{ textAlign: "right" }}>{t("inventory.purchaseHistory.colLead")}</th>
                        <th style={{ textAlign: "right" }}>{t("inventory.purchaseHistory.colQty")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productPurchases.entries.map((entry) => (
                        <tr key={entry.key} className="partner-table-row">
                          <td>{entry.date ? formatDate(entry.date) : "—"}</td>
                          <td>
                            <strong>{entry.ref}</strong>
                          </td>
                          <td>{entry.supplier || "—"}</td>
                          <td style={{ textAlign: "right" }}>
                            {entry.leadDays != null
                              ? t("inventory.calc.daysValue", { days: formatUnits(entry.leadDays) })
                              : "—"}
                          </td>
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

        <div className="inv-detail-block">
          <div className="inv-graph-head">
            <p className="inv-detail-heading">{t("inventory.salesActivity.title")}</p>
            <span className="inv-sales-window">{window.label}</span>
          </div>
          {productSales.entries.length === 0 ? (
            <p className="empty-copy inv-layers-empty">{t("inventory.salesActivity.empty")}</p>
          ) : (
            <>
              <p className="inv-sales-summary">
                {t("inventory.salesActivity.summary", {
                  units: formatUnits(Math.round(productSales.totalUnits)),
                  unit,
                  orders: formatUnits(productSales.orderCount),
                  perDay: formatUnits(Math.round(productSales.perDay * 100) / 100),
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
                      {productSales.entries.map((entry) => (
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
