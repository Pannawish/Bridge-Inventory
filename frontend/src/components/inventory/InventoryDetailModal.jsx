import { useEffect, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { formatDate } from "../../format";
import { formatCurrency } from "../products/productUtils";
import { api } from "../../api";
import DocumentRefChip from "../DocumentRefChip";
import DocumentRefModal from "../DocumentRefModal";
import { ReorderSawtoothFull } from "../charts/ReorderSawtooth";
import {
  num,
  formatUnits,
  getAvailable,
  getBuyQuantity,
  getDailyDemand,
  getReorderLevel,
} from "./inventoryUtils";

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
function InventoryDetailModal({ row, health, onClose }) {
  const { t } = useLanguage();
  const [layers, setLayers] = useState([]);
  const [layersLoading, setLayersLoading] = useState(false);
  const [layersError, setLayersError] = useState("");
  const [docRefModal, setDocRefModal] = useState(null);

  useEffect(() => {
    if (!row.product_id) return undefined;

    let isMounted = true;
    async function fetchLayers() {
      setLayersLoading(true);
      setLayersError("");
      try {
        const data = await api.getProductStockLayers(row.product_id);
        if (isMounted) {
          const sorted = (data?.layers || []).sort((a, b) => {
            const dateA = a.received_date || a.transaction_date || "";
            const dateB = b.received_date || b.transaction_date || "";
            return dateA.localeCompare(dateB);
          });
          setLayers(sorted);
        }
      } catch (err) {
        if (isMounted) setLayersError(err.message || "Failed to load layers.");
      } finally {
        if (isMounted) setLayersLoading(false);
      }
    }

    fetchLayers();
    return () => {
      isMounted = false;
    };
  }, [row.product_id]);

  const unit = row.unit || "";
  const available = getAvailable(row);
  const reorder = getReorderLevel(row);
  const demand = getDailyDemand(row);
  const buy = getBuyQuantity(row);
  const days = row.days_until_stockout;
  const leadTime = num(row.average_lead_time_days);
  const safety = num(row.safety_stock);
  const layersTotal = layers.reduce(
    (sum, layer) => sum + num(layer.available_quantity) * num(layer.base_unit_cost),
    0
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

        <div className="inv-detail-top">
          <div className="inv-detail-graph">
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

          <div className="inv-detail-calc">
            <p className="inv-detail-heading">{t("inventory.calc.title")}</p>
            <div className="inv-calc-list">
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
        </div>

        <div className="inv-detail-block">
          <p className="inv-detail-heading">{t("inventory.layers.title")}</p>
          {layersLoading && <div className="notice-banner inv-layers-notice">{t("common.loading")}</div>}
          {layersError && <div className="error-banner inv-layers-notice">{layersError}</div>}
          {!layersLoading && !layersError && layers.length === 0 && (
            <p className="empty-copy inv-layers-empty">{t("inventory.noLayers")}</p>
          )}
          {!layersLoading && !layersError && layers.length > 0 && (
            <div className="transaction-table-window">
              <div className="table-scroll inv-layers-scroll">
                <table className="transaction-history-table inv-layers-table">
                  <thead>
                    <tr>
                      <th>{t("products.supplierColumn")}</th>
                      <th>{t("products.batchRefColumn")}</th>
                      <th>{t("products.receivedDateColumn")}</th>
                      <th style={{ textAlign: "right" }}>{t("products.availableStockColumn")}</th>
                      <th style={{ textAlign: "right" }}>{t("products.costPerUnitColumn")}</th>
                      <th style={{ textAlign: "right" }}>{t("products.totalValueColumn")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {layers.map((layer) => (
                      <tr key={layer.purchase_item_id} className="partner-table-row">
                        <td>
                          <strong>{layer.supplier_name || t("common.unknown")}</strong>
                        </td>
                        <td>
                          {layer.purchase_reference_no || layer.purchase_id ? (
                            <DocumentRefChip
                              label={layer.purchase_reference_no || layer.purchase_id}
                              docType="purchase"
                              onClick={() =>
                                setDocRefModal({
                                  docType: "purchase",
                                  docId: layer.purchase_id,
                                  referenceNo: layer.purchase_reference_no || layer.purchase_id,
                                })
                              }
                            />
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>
                          {layer.received_date ? formatDate(layer.received_date) : formatDate(layer.transaction_date)}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {formatUnits(layer.available_quantity)} {unit}
                        </td>
                        <td style={{ textAlign: "right" }}>{formatCurrency(layer.base_unit_cost)}</td>
                        <td style={{ textAlign: "right" }} className="layer-total-val">
                          {formatCurrency(layer.available_quantity * layer.base_unit_cost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan="5" style={{ textAlign: "right" }}>
                        <strong>{t("inventory.layers.total")}</strong>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <strong>{formatCurrency(layersTotal)}</strong>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
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
