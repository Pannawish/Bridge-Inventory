import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { getStatusLabel } from "../../i18n/statusLabels";
import { formatDate } from "../../format";
import DocumentRefChip from "../DocumentRefChip";
import DocumentRefModal from "../DocumentRefModal";
import { ReorderViewportChart, buildProjection } from "../charts/ReorderProjection";
import {
  REORDER_WINDOWS,
  DEFAULT_REORDER_WINDOW,
  getReorderWindow,
  buildStockHistory,
  collectProductSales,
  collectProductPurchases,
  startOfToday,
} from "./reorderHistory";

const MS_DAY = 86_400_000;
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
function InventoryDetailModal({ row, health, sales = [], purchases = [], onLoadProductHistory, onClose }) {
  const { t } = useLanguage();
  // `windowKey` highlights the active quick-range preset; it goes null once the
  // user free-zooms/pans into a custom view. `viewport` ({from,to} epoch ms) is
  // the single source of truth shared by the chart AND the calc cards below.
  const [windowKey, setWindowKey] = useState(DEFAULT_REORDER_WINDOW);
  const [viewport, setViewport] = useState(null);
  // Read-only preview for a PO/TI clicked in the history tables below.
  const [docRefModal, setDocRefModal] = useState(null);

  // Load the full per-product purchase/sales history from the backend so the
  // history tables are not limited to whatever page 1 of the purchase list
  // happens to contain. Falls back to the passed-in prop arrays if the API
  // is not wired up or the call fails.
  const [loadedHistory, setLoadedHistory] = useState(null);
  const loadingRef = useRef(false);
  useEffect(() => {
    if (!onLoadProductHistory || !row?.product_id || loadingRef.current) return;
    loadingRef.current = true;
    setLoadedHistory(null);
    onLoadProductHistory(row.product_id)
      .then((data) => {
        if (data && (Array.isArray(data.purchases) || Array.isArray(data.sales))) {
          setLoadedHistory(data);
        }
      })
      .catch(() => {})
      .finally(() => { loadingRef.current = false; });
  }, [row?.product_id, onLoadProductHistory]);

  const effectivePurchases = loadedHistory?.purchases ?? purchases;
  const effectiveSales = loadedHistory?.sales ?? sales;

  const unit = row.unit || "";
  const available = getAvailable(row);
  const reorder = getReorderLevel(row);
  const demand = getDailyDemand(row);
  const buy = getBuyQuantity(row);
  const days = row.days_until_stockout;
  const leadTime = num(row.average_lead_time_days);
  const safety = num(row.safety_stock);

  // Projection model uses the CANONICAL daily demand (not the viewport), so the
  // forecast line stays stable while panning/zooming — only the view moves.
  const model = useMemo(
    () => buildProjection({ current: available, reorder, safety, velocity: demand, leadTime, orderQty: buy }),
    [available, reorder, safety, demand, leadTime, buy]
  );

  // How far right to extend a view: the full projection horizon + ~18% breathing
  // room so the forecast tail (and the restock jump) isn't flush against the edge.
  const futureSpanDays = model.hasDemand ? Math.max(Math.round(model.futureDays * 1.18), 10) : 16;

  // Default view: trailing 3 months of history + the projection horizon.
  const defaultViewport = useMemo(() => {
    const tdy = startOfToday().getTime();
    const days0 = getReorderWindow(DEFAULT_REORDER_WINDOW).days;
    return { from: tdy - days0 * MS_DAY, to: tdy + futureSpanDays * MS_DAY };
  }, [futureSpanDays]);

  // Reset the view whenever the product changes.
  useEffect(() => {
    setViewport(defaultViewport);
    setWindowKey(DEFAULT_REORDER_WINDOW);
  }, [row.product_id, defaultViewport]);

  const vp = viewport || defaultViewport;

  // Free zoom/pan keeps the last-picked preset highlighted (the buttons act as
  // quick "jump back to this range" anchors, not a mode the view exits).
  const handleViewportChange = useCallback((from, to) => {
    setViewport({ from, to });
  }, []);

  const applyPreset = useCallback(
    (w) => {
      const tdy = startOfToday().getTime();
      setViewport({ from: tdy - w.days * MS_DAY, to: tdy + futureSpanDays * MS_DAY });
      setWindowKey(w.key);
    },
    [futureSpanDays]
  );

  const handleReset = useCallback(
    () => applyPreset(getReorderWindow(DEFAULT_REORDER_WINDOW)),
    [applyPreset]
  );

  // Full reconstructed stock history; the chart clips it to the viewport.
  const historyPoints = useMemo(
    () =>
      buildStockHistory({
        productId: row.product_id,
        purchases: effectivePurchases,
        sales: effectiveSales,
        currentStock: available,
        fromDate: null,
      }),
    [effectivePurchases, effectiveSales, row.product_id, available]
  );

  // Calc cards + history tables reflect the PAST portion of the visible window.
  const productSales = useMemo(() => {
    const from = new Date(vp.from);
    const to = new Date(Math.min(vp.to, startOfToday().getTime()));
    return collectProductSales({ productId: row.product_id, sales: effectiveSales, from, to });
  }, [effectiveSales, row.product_id, vp.from, vp.to]);
  const productPurchases = useMemo(() => {
    const from = new Date(vp.from);
    const to = new Date(Math.min(vp.to, startOfToday().getTime()));
    return collectProductPurchases({ productId: row.product_id, purchases: effectivePurchases, from, to });
  }, [effectivePurchases, row.product_id, vp.from, vp.to]);

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
                  onClick={() => applyPreset(w)}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>
          <div className="inv-graph-frame">
            <ReorderViewportChart
              historyPoints={historyPoints}
              model={model}
              viewport={vp}
              onViewportChange={handleViewportChange}
              onReset={handleReset}
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
                {productPurchases.incomingUnits > 0 ? (
                  <span className="inv-incoming-note">
                    {t("inventory.purchaseHistory.incoming", {
                      units: formatUnits(Math.round(productPurchases.incomingUnits)),
                      unit,
                      orders: formatUnits(productPurchases.incomingOrders),
                    })}
                  </span>
                ) : null}
              </p>
              <div className="transaction-table-window">
                <div className="table-scroll inv-layers-scroll">
                  <table className="transaction-history-table inv-layers-table inv-hist-table">
                    <colgroup>
                      <col className="inv-hist-col-date" />
                      <col className="inv-hist-col-order" />
                      <col className="inv-hist-col-party" />
                      <col className="inv-hist-col-status" />
                      <col className="inv-hist-col-qty" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>{t("inventory.purchaseHistory.colDate")}</th>
                        <th>{t("inventory.purchaseHistory.colRef")}</th>
                        <th>{t("inventory.purchaseHistory.colSupplier")}</th>
                        <th>{t("inventory.purchaseHistory.colStatus")}</th>
                        <th style={{ textAlign: "right" }}>{t("inventory.purchaseHistory.colQty")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productPurchases.entries.map((entry) => (
                        <tr key={entry.key} className="partner-table-row">
                          <td>{entry.date ? formatDate(entry.date) : "—"}</td>
                          <td>
                            {entry.id != null ? (
                              <DocumentRefChip
                                label={entry.ref}
                                docType="purchase"
                                onClick={() =>
                                  setDocRefModal({
                                    docType: "purchase",
                                    docId: entry.id,
                                    referenceNo: entry.ref,
                                  })
                                }
                              />
                            ) : (
                              <strong>{entry.ref}</strong>
                            )}
                          </td>
                          <td>{entry.supplier || "—"}</td>
                          <td>
                            <span className="inv-hist-status">
                              <span className={`status-badge status-${entry.status}`}>
                                {getStatusLabel(t, entry.status)}
                              </span>
                              {entry.leadDays != null ? (
                                <span className="inv-hist-lead">
                                  {t("inventory.purchaseHistory.colLead")}: {formatUnits(entry.leadDays)}d
                                </span>
                              ) : null}
                            </span>
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
                  <table className="transaction-history-table inv-layers-table inv-hist-table">
                    <colgroup>
                      <col className="inv-hist-col-date" />
                      <col className="inv-hist-col-order" />
                      <col className="inv-hist-col-party" />
                      <col className="inv-hist-col-status" />
                      <col className="inv-hist-col-qty" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>{t("inventory.salesActivity.colDate")}</th>
                        <th>{t("inventory.salesActivity.colRef")}</th>
                        <th>{t("inventory.salesActivity.colCustomer")}</th>
                        <th>{t("inventory.salesActivity.colStatus")}</th>
                        <th style={{ textAlign: "right" }}>{t("inventory.salesActivity.colQty")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productSales.entries.map((entry) => (
                        <tr key={entry.key} className="partner-table-row">
                          <td>{entry.date ? formatDate(entry.date) : "—"}</td>
                          <td>
                            {entry.id != null ? (
                              <DocumentRefChip
                                label={entry.ref}
                                docType="sale"
                                onClick={() =>
                                  setDocRefModal({
                                    docType: "sale",
                                    docId: entry.id,
                                    referenceNo: entry.ref,
                                  })
                                }
                              />
                            ) : (
                              <strong>{entry.ref}</strong>
                            )}
                          </td>
                          <td>{entry.customer || "—"}</td>
                          <td>
                            <span className={`status-badge status-${entry.status}`}>
                              {getStatusLabel(t, entry.status)}
                            </span>
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

      </div>
    </div>
    {docRefModal ? (
      <DocumentRefModal
        docType={docRefModal.docType}
        docId={docRefModal.docId}
        referenceNo={docRefModal.referenceNo}
        onClose={() => setDocRefModal(null)}
      />
    ) : null}
    </>
  );
}

export default InventoryDetailModal;
