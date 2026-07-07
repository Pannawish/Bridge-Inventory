// React component for inventory control: inventory control board.

import { useMemo, useState } from "react";
import { formatMoney as fmt, formatDate } from "../../format";
import { useLanguage } from "../../i18n/LanguageContext";
import DocumentRefChip from "../DocumentRefChip";
import InventoryMetricModal from "./InventoryMetricModal";
import {
  num,
  formatUnits,
  getHealth,
  getStockValue,
  HEALTH_KEYS,
} from "./inventoryUtils";

const isOpenAr = (note) => !["fully_received", "cancelled"].includes(note.status);
const isOpenAp = (batch) => !["paid", "cancelled"].includes(batch.status);

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

// Top-of-page control board: the headline figures, each readable at a glance and
// clickable to a drill-down that explains the number and lists the products /
// transactions behind it so the user can act on it.
function InventoryControlBoard({
  dashboard,
  billingNotes = [],
  paymentBatches = [],
  onNavigate,
  onApplyHealthFilter,
  onOpenReference,
}) {
  const { t } = useLanguage();
  const [openMetric, setOpenMetric] = useState(null);

  const stockReport = useMemo(
    () => (Array.isArray(dashboard?.stock_report) ? dashboard.stock_report : []),
    [dashboard]
  );
  const cashflow = dashboard?.overview?.cashflow || {};
  const todayStr = cashflow.today || formatDate(new Date());

  // Inventory value decomposed by stock-health band: where the capital sits and
  // how much of it is at-risk (low) or idle (dead). Each band is a jump-off into
  // the filtered manage list.
  const stock = useMemo(() => {
    let inventoryValue = 0;
    const bands = {};
    HEALTH_KEYS.forEach((key) => {
      bands[key] = { value: 0, count: 0 };
    });
    stockReport.forEach((row) => {
      const value = getStockValue(row);
      inventoryValue += value;
      const health = getHealth(row);
      if (!bands[health]) bands[health] = { value: 0, count: 0 };
      bands[health].value += value;
      bands[health].count += 1;
    });
    return { inventoryValue, bands };
  }, [stockReport]);

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
  const goTo = (tab) => {
    onNavigate?.({ tab });
    setOpenMetric(null);
  };
  // Jump from a value-band row into the manage list, pre-filtered to that band.
  const openBand = (band) => {
    onApplyHealthFilter?.(band);
    setOpenMetric(null);
  };
  // Open a specific document's detail card on its own page (same as its "View").
  const openDoc = (tab, focusId) => {
    onNavigate?.({ tab, focusId });
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
    <section className="section-card inv-control">
      <div className="section-heading">
        <div>
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
          <div className="inv-kpi-row inv-kpi-row-stock">
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

      {/* ── Inventory value · capital by stock health ── */}
      {openMetric === "value" ? (
        <InventoryMetricModal
          eyebrow={t("inventory.board.groupStock")}
          title={t("inventory.kpiValue")}
          value={fmt(stock.inventoryValue)}
          tone="accent"
          description={t("inventory.board.value.desc")}
          onClose={() => setOpenMetric(null)}
        >
          <p className="inv-detail-heading">{t("inventory.board.value.bandTitle")}</p>
          <table className="detail-item-table inv-metric-table">
            <thead>
              <tr>
                <th>{t("inventory.board.value.colBand")}</th>
                <th style={{ textAlign: "right" }}>{t("inventory.kpiValue")}</th>
                <th style={{ textAlign: "right" }}>{t("inventory.board.value.colShare")}</th>
                <th style={{ textAlign: "right" }}>{t("inventory.board.value.colSkus")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {HEALTH_KEYS.map((key) => {
                const band = stock.bands[key] || { value: 0, count: 0 };
                const share =
                  stock.inventoryValue > 0
                    ? Math.round((band.value / stock.inventoryValue) * 100)
                    : 0;
                return (
                  <tr key={key}>
                    <td>
                      <span className={`inv-health-badge inv-health-${key}`}>
                        <i className="inv-health-dot" aria-hidden="true" />
                        {t(`inventory.health.${key}`)}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }} className="inv-metric-num">{fmt(band.value)}</td>
                    <td style={{ textAlign: "right" }}>{share}%</td>
                    <td style={{ textAlign: "right" }}>{formatUnits(band.count)}</td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        className="secondary-button compact-button"
                        disabled={band.count === 0}
                        onClick={() => openBand(key)}
                      >
                        {t("inventory.board.viewDetail")}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {stock.bands.dead?.value > 0 ? (
            <p className="inv-metric-hint is-danger">{t("inventory.board.value.deadHint", { amount: fmt(stock.bands.dead.value) })}</p>
          ) : null}
          <p className="inv-metric-hint">{t("inventory.board.value.bandHint")}</p>
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
                        onClick={() => openDoc("billing-notes", note.id)}
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
                        onClick={() => openDoc("payment-batches", batch.id)}
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
  );
}

export default InventoryControlBoard;
