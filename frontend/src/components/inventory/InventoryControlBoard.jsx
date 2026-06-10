import { useMemo, useState } from "react";
import { formatMoney as fmt, formatDate } from "../../format";
import { useLanguage } from "../../i18n/LanguageContext";
import DocumentRefChip from "../DocumentRefChip";
import DocumentRefModal from "../DocumentRefModal";
import InventoryMetricModal from "./InventoryMetricModal";
import {
  num,
  formatUnits,
  getAvailable,
  getBuyQuantity,
  getHealth,
  getReorderLevel,
  getStockValue,
  getSupplierOptions,
  buildMovementClassifier,
} from "./inventoryUtils";

const isOpenAr = (note) => !["fully_received", "cancelled"].includes(note.status);
const isOpenAp = (batch) => !["paid", "cancelled"].includes(batch.status);

function toPrefillItem(row, qty) {
  return {
    product_id: row.product_id,
    product_name: row.product_name,
    sku: row.sku || "",
    unit: row.unit || "",
    quantity: qty > 0 ? qty : 1,
    unit_cost: row.unit_cost ?? row.average_unit_cost ?? "",
  };
}

function KpiCard({ tone, label, value, meaning, viewLabel, onClick }) {
  return (
    <button type="button" className={`inv-kpi-card tone-${tone}`} onClick={onClick}>
      <span className="inv-kpi-label">{label}</span>
      <strong className="inv-kpi-value">{value}</strong>
      <span className="inv-kpi-meaning">{meaning}</span>
      <span className="inv-kpi-more">{viewLabel} ›</span>
    </button>
  );
}

// Top-of-page control board: the six headline figures, each readable at a
// glance and clickable to a drill-down that explains the number and lists the
// products / transactions behind it so the user can act on it.
function InventoryControlBoard({ dashboard, billingNotes = [], paymentBatches = [], onNavigate, onOpenReference }) {
  const { t } = useLanguage();
  const [openMetric, setOpenMetric] = useState(null);
  const [docRef, setDocRef] = useState(null);

  const stockReport = useMemo(
    () => (Array.isArray(dashboard?.stock_report) ? dashboard.stock_report : []),
    [dashboard]
  );
  const metrics = dashboard?.metrics || {};
  const cashflow = dashboard?.overview?.cashflow || {};
  const todayStr = cashflow.today || formatDate(new Date());

  const stock = useMemo(() => {
    const classify = buildMovementClassifier(stockReport);
    let inventoryValue = 0;
    let deadValue = 0;
    const movement = { fast: 0, slow: 0, dead: 0 };
    const lowRows = [];
    const approachingRows = [];
    stockReport.forEach((row) => {
      const value = getStockValue(row);
      inventoryValue += value;
      const health = getHealth(row);
      const move = classify(row);
      movement[move] = (movement[move] || 0) + 1;
      if (health === "dead") deadValue += value;
      const reorder = getReorderLevel(row);
      const available = getAvailable(row);
      if (reorder > 0 && available <= reorder) lowRows.push(row);
      else if (health === "watch") approachingRows.push(row);
    });
    const valueRows = [...stockReport].sort((a, b) => getStockValue(b) - getStockValue(a));
    lowRows.sort(
      (a, b) => getAvailable(a) - getReorderLevel(a) - (getAvailable(b) - getReorderLevel(b))
    );
    return {
      inventoryValue,
      deadValue,
      movement,
      lowRows,
      approachingRows,
      valueRows,
      skuCount: num(metrics.total_products) || stockReport.length,
    };
  }, [stockReport, metrics]);

  const openAr = useMemo(
    () =>
      (Array.isArray(billingNotes) ? billingNotes : [])
        .filter(isOpenAr)
        .sort((a, b) => String(a.expected_payment_date || "").localeCompare(String(b.expected_payment_date || ""))),
    [billingNotes]
  );
  const openAp = useMemo(
    () =>
      (Array.isArray(paymentBatches) ? paymentBatches : [])
        .filter(isOpenAp)
        .sort((a, b) => String(a.planned_payment_date || "").localeCompare(String(b.planned_payment_date || ""))),
    [paymentBatches]
  );

  const arTotal = num(cashflow.ar_total_open);
  const apTotal = num(cashflow.ap_total_open);
  const net = num(cashflow.net_open);

  // ── actions ──
  const createPoFor = (rows) => {
    const items = rows.map((row) => toPrefillItem(row, getBuyQuantity(row)));
    if (items.length > 0) onNavigate?.({ tab: "purchase-history", prefill: { supplier_name: "", items } });
    setOpenMetric(null);
  };
  const goTo = (tab) => {
    onNavigate?.({ tab });
    setOpenMetric(null);
  };

  const stockCards = [
    {
      key: "value",
      tone: "accent",
      label: t("inventory.kpiValue"),
      value: fmt(stock.inventoryValue),
      meaning: t("inventory.board.value.meaning"),
    },
    {
      key: "skus",
      tone: "neutral",
      label: t("inventory.board.skus.label"),
      value: formatUnits(stock.skuCount),
      meaning: t("inventory.board.skus.meaning"),
    },
    {
      key: "low",
      tone: stock.lowRows.length > 0 ? "danger" : "positive",
      label: t("inventory.board.low.label"),
      value: formatUnits(stock.lowRows.length),
      meaning: t("inventory.board.low.meaning"),
    },
  ];
  const cashCards = [
    {
      key: "ar",
      tone: "positive",
      label: t("inventory.board.ar.label"),
      value: fmt(arTotal),
      meaning: t("inventory.board.ar.meaning"),
    },
    {
      key: "ap",
      tone: "accent",
      label: t("inventory.board.ap.label"),
      value: fmt(apTotal),
      meaning: t("inventory.board.ap.meaning"),
    },
    {
      key: "net",
      tone: net >= 0 ? "positive" : "danger",
      label: t("inventory.board.net.label"),
      value: fmt(net),
      meaning: t("inventory.board.net.meaning"),
    },
  ];

  const overdue = (dateStr) => Boolean(dateStr) && dateStr < todayStr;

  return (
    <>
    <section className="section-card inv-control">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("inventory.eyebrow")}</p>
          <h3>{t("inventory.title")}</h3>
          <p className="inv-subtitle">{t("inventory.subtitle")}</p>
        </div>
        <button type="button" className="secondary-button table-action-button" onClick={onOpenReference}>
          {t("inventory.formulaReference")}
        </button>
      </div>

      <div className="inv-kpi-groups">
        <div className="inv-kpi-group">
          <p className="inv-kpi-group-label">{t("inventory.board.groupStock")}</p>
          <div className="inv-kpi-row">
            {stockCards.map((card) => (
              <KpiCard
                key={card.key}
                tone={card.tone}
                label={card.label}
                value={card.value}
                meaning={card.meaning}
                viewLabel={t("inventory.board.viewDetail")}
                onClick={() => setOpenMetric(card.key)}
              />
            ))}
          </div>
        </div>
        <div className="inv-kpi-group">
          <p className="inv-kpi-group-label">{t("inventory.board.groupCash")}</p>
          <div className="inv-kpi-row">
            {cashCards.map((card) => (
              <KpiCard
                key={card.key}
                tone={card.tone}
                label={card.label}
                value={card.value}
                meaning={card.meaning}
                viewLabel={t("inventory.board.viewDetail")}
                onClick={() => setOpenMetric(card.key)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Inventory value ── */}
      {openMetric === "value" ? (
        <InventoryMetricModal
          eyebrow={t("inventory.board.groupStock")}
          title={t("inventory.kpiValue")}
          value={fmt(stock.inventoryValue)}
          tone="accent"
          description={t("inventory.board.value.desc")}
          onClose={() => setOpenMetric(null)}
        >
          {stock.deadValue > 0 ? (
            <p className="inv-metric-hint">{t("inventory.board.value.deadHint", { amount: fmt(stock.deadValue) })}</p>
          ) : null}
          <table className="detail-item-table inv-metric-table">
            <thead>
              <tr>
                <th>{t("inventory.colProduct")}</th>
                <th style={{ textAlign: "right" }}>{t("inventory.card.onHand")}</th>
                <th style={{ textAlign: "right" }}>{t("inventory.kpiValue")}</th>
              </tr>
            </thead>
            <tbody>
              {stock.valueRows.slice(0, 25).map((row) => (
                <tr key={row.product_id}>
                  <td>
                    <strong>{row.product_name}</strong>
                    <span className="inv-metric-sub">{row.sku || "—"}</span>
                  </td>
                  <td style={{ textAlign: "right" }}>{formatUnits(getAvailable(row))} {row.unit || ""}</td>
                  <td style={{ textAlign: "right" }} className="inv-metric-num">{fmt(getStockValue(row))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </InventoryMetricModal>
      ) : null}

      {/* ── Active SKUs ── */}
      {openMetric === "skus" ? (
        <InventoryMetricModal
          eyebrow={t("inventory.board.groupStock")}
          title={t("inventory.board.skus.label")}
          value={formatUnits(stock.skuCount)}
          tone="neutral"
          description={t("inventory.board.skus.desc")}
          onClose={() => setOpenMetric(null)}
        >
          <div className="inv-metric-stats">
            <div className="inv-metric-stat tone-positive">
              <strong>{formatUnits(stock.movement.fast)}</strong>
              <span>{t("inventory.movement.fast")}</span>
            </div>
            <div className="inv-metric-stat tone-accent">
              <strong>{formatUnits(stock.movement.slow)}</strong>
              <span>{t("inventory.movement.slow")}</span>
            </div>
            <div className="inv-metric-stat tone-neutral">
              <strong>{formatUnits(stock.movement.dead)}</strong>
              <span>{t("inventory.movement.dead")}</span>
            </div>
          </div>
          <p className="inv-metric-hint">{t("inventory.board.skus.movementHint")}</p>
        </InventoryMetricModal>
      ) : null}

      {/* ── Low stock ── */}
      {openMetric === "low" ? (
        <InventoryMetricModal
          eyebrow={t("inventory.board.groupStock")}
          title={t("inventory.board.low.label")}
          value={formatUnits(stock.lowRows.length)}
          tone={stock.lowRows.length > 0 ? "danger" : "positive"}
          description={t("inventory.board.low.desc")}
          headerAction={
            stock.lowRows.length > 0 ? (
              <button
                type="button"
                className="primary-button table-action-button"
                onClick={() => createPoFor(stock.lowRows)}
              >
                {t("inventory.board.low.createAll")}
              </button>
            ) : null
          }
          onClose={() => setOpenMetric(null)}
        >
          {stock.lowRows.length === 0 ? (
            <p className="inv-metric-empty">{t("inventory.board.low.empty")}</p>
          ) : (
            <table className="detail-item-table inv-metric-table">
              <thead>
                <tr>
                  <th>{t("inventory.colProduct")}</th>
                  <th style={{ textAlign: "right" }}>{t("inventory.card.onHand")}</th>
                  <th style={{ textAlign: "right" }}>{t("inventory.card.reorderPoint")}</th>
                  <th style={{ textAlign: "right" }}>{t("inventory.card.suggestedBuy")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {stock.lowRows.map((row) => (
                  <tr key={row.product_id}>
                    <td>
                      <strong>{row.product_name}</strong>
                      <span className="inv-metric-sub">{getSupplierOptions(row)[0]?.supplier_name || t("inventory.card.noSupplier")}</span>
                    </td>
                    <td style={{ textAlign: "right" }} className="inv-metric-low">{formatUnits(getAvailable(row))} {row.unit || ""}</td>
                    <td style={{ textAlign: "right" }}>{formatUnits(getReorderLevel(row))} {row.unit || ""}</td>
                    <td style={{ textAlign: "right" }} className="inv-metric-num">{getBuyQuantity(row) > 0 ? `${formatUnits(getBuyQuantity(row))} ${row.unit || ""}` : "—"}</td>
                    <td style={{ textAlign: "right" }}>
                      <button type="button" className="secondary-button compact-button" onClick={() => createPoFor([row])}>
                        {t("inventory.board.low.createPo")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {stock.approachingRows.length > 0 ? (
            <p className="inv-metric-hint">
              {t("inventory.board.low.approaching", { n: formatUnits(stock.approachingRows.length) })}
            </p>
          ) : null}
        </InventoryMetricModal>
      ) : null}

      {/* ── AR open ── */}
      {openMetric === "ar" ? (
        <InventoryMetricModal
          eyebrow={t("inventory.board.groupCash")}
          title={t("inventory.board.ar.label")}
          value={fmt(arTotal)}
          tone="positive"
          description={t("inventory.board.ar.desc")}
          headerAction={
            <button type="button" className="primary-button table-action-button" onClick={() => goTo("billing-notes")}>
              {t("inventory.board.ar.open")}
            </button>
          }
          onClose={() => setOpenMetric(null)}
        >
          {num(cashflow.overdue_ar) > 0 ? (
            <p className="inv-metric-hint is-danger">{t("inventory.board.ar.overdueHint", { amount: fmt(cashflow.overdue_ar) })}</p>
          ) : null}
          {openAr.length === 0 ? (
            <p className="inv-metric-empty">{t("inventory.board.ar.empty")}</p>
          ) : (
            <table className="detail-item-table inv-metric-table">
              <thead>
                <tr>
                  <th>{t("inventory.board.col.customer")}</th>
                  <th>{t("inventory.board.col.reference")}</th>
                  <th>{t("inventory.board.col.due")}</th>
                  <th style={{ textAlign: "right" }}>{t("inventory.board.col.amount")}</th>
                </tr>
              </thead>
              <tbody>
                {openAr.map((note) => (
                  <tr key={note.id} className={overdue(note.expected_payment_date) ? "is-overdue" : ""}>
                    <td><strong>{note.customer_name || "—"}</strong></td>
                    <td>
                      <DocumentRefChip
                        label={note.reference_no || note.id}
                        docType="billing-note"
                        onClick={() => setDocRef({ docType: "billing-note", docId: note.id, referenceNo: note.reference_no || note.id })}
                      />
                    </td>
                    <td>{note.expected_payment_date ? formatDate(note.expected_payment_date) : "—"}</td>
                    <td style={{ textAlign: "right" }} className="inv-metric-num">{fmt(note.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </InventoryMetricModal>
      ) : null}

      {/* ── AP open ── */}
      {openMetric === "ap" ? (
        <InventoryMetricModal
          eyebrow={t("inventory.board.groupCash")}
          title={t("inventory.board.ap.label")}
          value={fmt(apTotal)}
          tone="accent"
          description={t("inventory.board.ap.desc")}
          headerAction={
            <button type="button" className="primary-button table-action-button" onClick={() => goTo("payment-batches")}>
              {t("inventory.board.ap.open")}
            </button>
          }
          onClose={() => setOpenMetric(null)}
        >
          {num(cashflow.overdue_ap) > 0 ? (
            <p className="inv-metric-hint is-danger">{t("inventory.board.ap.overdueHint", { amount: fmt(cashflow.overdue_ap) })}</p>
          ) : null}
          {openAp.length === 0 ? (
            <p className="inv-metric-empty">{t("inventory.board.ap.empty")}</p>
          ) : (
            <table className="detail-item-table inv-metric-table">
              <thead>
                <tr>
                  <th>{t("inventory.board.col.supplier")}</th>
                  <th>{t("inventory.board.col.reference")}</th>
                  <th>{t("inventory.board.col.due")}</th>
                  <th style={{ textAlign: "right" }}>{t("inventory.board.col.amount")}</th>
                </tr>
              </thead>
              <tbody>
                {openAp.map((batch) => (
                  <tr key={batch.id} className={overdue(batch.planned_payment_date) ? "is-overdue" : ""}>
                    <td><strong>{batch.supplier_name || "—"}</strong></td>
                    <td>
                      <DocumentRefChip
                        label={batch.reference_no || batch.id}
                        docType="payment-batch"
                        onClick={() => setDocRef({ docType: "payment-batch", docId: batch.id, referenceNo: batch.reference_no || batch.id })}
                      />
                    </td>
                    <td>{batch.planned_payment_date ? formatDate(batch.planned_payment_date) : "—"}</td>
                    <td style={{ textAlign: "right" }} className="inv-metric-num">{fmt(batch.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </InventoryMetricModal>
      ) : null}

      {/* ── Net position ── */}
      {openMetric === "net" ? (
        <InventoryMetricModal
          eyebrow={t("inventory.board.groupCash")}
          title={t("inventory.board.net.label")}
          value={fmt(net)}
          tone={net >= 0 ? "positive" : "danger"}
          description={t("inventory.board.net.desc")}
          onClose={() => setOpenMetric(null)}
        >
          <div className="inv-net-grid">
            <div className="inv-net-cell tone-positive">
              <span>{t("inventory.board.ar.label")}</span>
              <strong>{fmt(arTotal)}</strong>
            </div>
            <div className="inv-net-cell tone-accent">
              <span>{t("inventory.board.ap.label")}</span>
              <strong>{fmt(apTotal)}</strong>
            </div>
            <div className={`inv-net-cell ${net >= 0 ? "tone-positive" : "tone-danger"}`}>
              <span>{t("inventory.board.net.label")}</span>
              <strong>{fmt(net)}</strong>
            </div>
          </div>
          {Array.isArray(cashflow.buckets) && cashflow.buckets.length > 0 ? (
            <>
              <p className="inv-metric-hint">{t("inventory.board.net.forecastHint")}</p>
              <table className="detail-item-table inv-metric-table">
                <thead>
                  <tr>
                    <th>{t("inventory.board.net.period")}</th>
                    <th style={{ textAlign: "right" }}>{t("inventory.board.ar.label")}</th>
                    <th style={{ textAlign: "right" }}>{t("inventory.board.ap.label")}</th>
                    <th style={{ textAlign: "right" }}>{t("inventory.board.net.label")}</th>
                  </tr>
                </thead>
                <tbody>
                  {cashflow.buckets.map((bucket) => (
                    <tr key={bucket.key} className={bucket.is_overdue ? "is-overdue" : ""}>
                      <td><strong>{bucket.is_overdue ? t("inventory.board.net.overdue") : bucket.label}</strong></td>
                      <td style={{ textAlign: "right" }}>{fmt(bucket.ar_in)}</td>
                      <td style={{ textAlign: "right" }}>{fmt(bucket.ap_out)}</td>
                      <td style={{ textAlign: "right" }} className={`inv-metric-num ${num(bucket.net) < 0 ? "is-low" : ""}`}>{fmt(bucket.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : null}
        </InventoryMetricModal>
      ) : null}
    </section>

    {docRef ? (
      <DocumentRefModal
        docType={docRef.docType}
        docId={docRef.docId}
        referenceNo={docRef.referenceNo}
        onClose={() => setDocRef(null)}
      />
    ) : null}
    </>
  );
}

export default InventoryControlBoard;
