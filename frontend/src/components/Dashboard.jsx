import { useMemo, useState } from "react";
import { formatNumber as formatLocaleNumber } from "../format";
import { useLanguage } from "../i18n/LanguageContext";

// A product is treated as a "high-cycle" mover when it reorders, on average,
// at least this often. Slower-but-repeat items fall into "healthy long-cycle"
// so a wholesaler's every-6-months lines are never mistaken for dead stock.
const HIGH_CYCLE_MAX_INTERVAL_DAYS = 60;
const REORDER_PAGE_SIZE = 4;
const DISPATCH_LIMIT = 5;
const CYCLE_EXAMPLES = 2;

function num(value) {
  return Number(value || 0);
}

function formatCompact(value) {
  const n = Number(value || 0);
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    return `${sign}฿${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}฿${(abs / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  }
  return `${sign}฿${abs.toFixed(0)}`;
}

function formatUnits(value) {
  const n = Number(value || 0);
  return formatLocaleNumber(Math.abs(n) >= 100 ? Math.round(n) : n, null, {
    maximumFractionDigits: 1,
  });
}

function daysBetween(startIso, endIso) {
  if (!startIso || !endIso) return 0;
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

// Classify how a product moves through stock from its lifetime order history.
// Returns null for items that have never cycled (so they stay out of the mix).
function classifyCycle(row) {
  const cycles = num(row.cycle_count);
  if (cycles <= 0) return null;
  if (cycles === 1) return { klass: "oneOff", cyclesPerYear: null };

  const spanDays = daysBetween(row.first_sale_date, row.last_sale_date);
  const avgInterval = spanDays / (cycles - 1);
  const cyclesPerYear = avgInterval > 0 ? 365 / avgInterval : null;
  const klass = avgInterval <= HIGH_CYCLE_MAX_INTERVAL_DAYS ? "high" : "long";
  return { klass, cyclesPerYear };
}

function reorderTone(row) {
  if (row._isCritical) return "danger";
  if (row._days == null) return "accent";
  if (row._days <= 3) return "danger";
  if (row._days <= 7) return "warning";
  return "accent";
}

// ── KPI ribbon ─────────────────────────────────────────────────────────
function KpiRibbon({ metrics, cashflow }) {
  const { t } = useLanguage();
  const net = num(cashflow?.net_open);
  const lowStock = num(metrics?.low_stock_count);

  const items = [
    { key: "inventory", label: t("dashboard.ribbon.inventory"), value: formatCompact(metrics?.total_stock_value) },
    { key: "ar", label: t("dashboard.ribbon.arOpen"), value: formatCompact(cashflow?.ar_total_open), tone: "positive" },
    { key: "ap", label: t("dashboard.ribbon.apOpen"), value: formatCompact(cashflow?.ap_total_open), tone: "accent" },
    { key: "net", label: t("dashboard.ribbon.net"), value: formatCompact(net), tone: net >= 0 ? "positive" : "danger" },
    { key: "skus", label: t("dashboard.ribbon.skus"), value: formatLocaleNumber(metrics?.total_products) },
    {
      key: "low",
      label: t("dashboard.ribbon.lowStock"),
      value: formatLocaleNumber(lowStock),
      tone: lowStock > 0 ? "warning" : "neutral",
    },
  ];

  return (
    <div className="dash-ribbon">
      {items.map((item) => (
        <div className={`dash-ribbon-cell tone-${item.tone || "neutral"}`} key={item.key}>
          <span className="dash-ribbon-label">{item.label}</span>
          <strong className="dash-ribbon-value">{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

// ── Urgent reorder (hero) ──────────────────────────────────────────────
function UrgentReorderWidget({ rows }) {
  const { t } = useLanguage();
  const [page, setPage] = useState(0);

  const pageCount = Math.max(1, Math.ceil(rows.length / REORDER_PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const start = safePage * REORDER_PAGE_SIZE;
  const visible = rows.slice(start, start + REORDER_PAGE_SIZE);

  return (
    <section className="dash-card dash-reorder">
      <header className="dash-card-head">
        <div>
          <p className="dash-eyebrow">{t("dashboard.reorder.eyebrow")}</p>
          <h3>{t("dashboard.reorder.title")}</h3>
        </div>
        {rows.length > REORDER_PAGE_SIZE ? (
          <div className="dash-pager">
            <button
              type="button"
              className="dash-pager-btn"
              aria-label={t("dashboard.reorder.prev")}
              onClick={() => setPage(Math.max(0, safePage - 1))}
              disabled={safePage === 0}
            >
              ◀
            </button>
            <span className="dash-pager-label">{`${safePage + 1}/${pageCount}`}</span>
            <button
              type="button"
              className="dash-pager-btn"
              aria-label={t("dashboard.reorder.next")}
              onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))}
              disabled={safePage >= pageCount - 1}
            >
              ▶
            </button>
          </div>
        ) : null}
      </header>

      {rows.length === 0 ? (
        <p className="dash-empty">{t("dashboard.reorder.empty")}</p>
      ) : (
        <ol className="dash-reorder-list">
          {visible.map((row, index) => {
            const tone = reorderTone(row);
            const fill = row._reorder > 0 ? Math.min(100, (row._available / row._reorder) * 100) : 0;
            const badge = row._isCritical
              ? t("dashboard.reorder.out")
              : row._days == null
                ? "—"
                : t("dashboard.reorder.days", { n: formatLocaleNumber(row._days) });
            return (
              <li className="dash-reorder-row" key={row.product_id || index}>
                <span className="dash-reorder-rank">{start + index + 1}</span>
                <div className="dash-reorder-main">
                  <div className="dash-reorder-toprow">
                    <span className="dash-reorder-name" title={row.product_name}>
                      {row.product_name || "—"}
                    </span>
                    <span className={`dash-badge tone-${tone}`}>{badge}</span>
                  </div>
                  <div className="dash-reorder-track">
                    <span className={`dash-reorder-fill tone-${tone}`} style={{ width: `${fill}%` }} />
                  </div>
                  <div className="dash-reorder-meta">
                    <span className="dash-reorder-stock">
                      {formatUnits(row._available)}/{formatUnits(row._reorder)} {row.unit || ""}
                    </span>
                    {num(row.recommended_restock) > 0 ? (
                      <span className="dash-reorder-restock">
                        +{formatUnits(row.recommended_restock)} {row.unit || ""}
                      </span>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

// ── Stock cycling segmentation ─────────────────────────────────────────
function StockCyclingWidget({ stockReport }) {
  const { t } = useLanguage();

  const mix = useMemo(() => {
    const buckets = {
      high: { count: 0, examples: [] },
      long: { count: 0, examples: [] },
      oneOff: { count: 0, examples: [] },
    };
    const tagged = [];
    stockReport.forEach((row) => {
      const result = classifyCycle(row);
      if (!result) return;
      tagged.push({ row, ...result });
      buckets[result.klass].count += 1;
    });
    // Fill each band's example names with its strongest movers (by lifetime units).
    Object.keys(buckets).forEach((klass) => {
      buckets[klass].examples = tagged
        .filter((entry) => entry.klass === klass)
        .sort((a, b) => num(b.row.sales_history_units) - num(a.row.sales_history_units))
        .slice(0, CYCLE_EXAMPLES)
        .map((entry) => entry.row.product_name)
        .filter(Boolean);
    });
    return { buckets, total: tagged.length };
  }, [stockReport]);

  const bands = [
    { klass: "high", label: t("dashboard.cycling.high") },
    { klass: "long", label: t("dashboard.cycling.long") },
    { klass: "oneOff", label: t("dashboard.cycling.oneOff") },
  ];

  return (
    <section className="dash-card dash-cycling">
      <header className="dash-card-head">
        <div>
          <p className="dash-eyebrow">{t("dashboard.cycling.eyebrow")}</p>
          <h3>{t("dashboard.cycling.title")}</h3>
        </div>
      </header>

      {mix.total === 0 ? (
        <p className="dash-empty">{t("dashboard.cycling.empty")}</p>
      ) : (
        <>
          <div className="dash-segbar" role="img" aria-label={t("dashboard.cycling.title")}>
            {bands.map((band) => {
              const pct = (mix.buckets[band.klass].count / mix.total) * 100;
              if (pct <= 0) return null;
              return (
                <span
                  key={band.klass}
                  className={`dash-segbar-part seg-${band.klass}`}
                  style={{ width: `${pct}%` }}
                  title={`${band.label}: ${mix.buckets[band.klass].count}`}
                />
              );
            })}
          </div>
          <ul className="dash-cycling-legend">
            {bands.map((band) => (
              <li className="dash-cycling-row" key={band.klass}>
                <span className={`dash-dot seg-${band.klass}`} />
                <span className="dash-cycling-label">{band.label}</span>
                <span className="dash-cycling-count">{mix.buckets[band.klass].count}</span>
                <span className="dash-cycling-examples" title={mix.buckets[band.klass].examples.join(", ")}>
                  {mix.buckets[band.klass].examples.join(", ") || "—"}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

// ── Delivery planning (dispatch + alerts) ──────────────────────────────
function DeliveryPlanningWidget({ stockReport }) {
  const { t } = useLanguage();

  const { dispatch, maxPending, delayedSkus, delayedUnits } = useMemo(() => {
    const pendingRows = stockReport
      .filter((row) => num(row.pending_sales_units) > 0)
      .sort((a, b) => num(b.pending_sales_units) - num(a.pending_sales_units));
    const delayed = stockReport.filter((row) => num(row.delayed_purchase_units) > 0);
    return {
      dispatch: pendingRows.slice(0, DISPATCH_LIMIT),
      maxPending: pendingRows.length ? num(pendingRows[0].pending_sales_units) : 0,
      delayedSkus: delayed.length,
      delayedUnits: delayed.reduce((total, row) => total + num(row.delayed_purchase_units), 0),
    };
  }, [stockReport]);

  return (
    <section className="dash-card dash-dispatch">
      <header className="dash-card-head">
        <div>
          <p className="dash-eyebrow">{t("dashboard.dispatch.eyebrow")}</p>
          <h3>{t("dashboard.dispatch.title")}</h3>
        </div>
      </header>

      {dispatch.length === 0 ? (
        <p className="dash-empty">{t("dashboard.dispatch.empty")}</p>
      ) : (
        <ul className="dash-dispatch-list">
          {dispatch.map((row, index) => {
            const pending = num(row.pending_sales_units);
            const fill = maxPending > 0 ? (pending / maxPending) * 100 : 0;
            return (
              <li className="dash-dispatch-row" key={row.product_id || index}>
                <span className="dash-dispatch-name" title={row.product_name}>
                  {row.product_name || "—"}
                </span>
                <span className="dash-dispatch-track">
                  <span className="dash-dispatch-fill" style={{ width: `${fill}%` }} />
                </span>
                <span className="dash-dispatch-qty">
                  {formatUnits(pending)} {row.unit || ""}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <div className={`dash-dispatch-alert ${delayedSkus > 0 ? "is-alert" : "is-clear"}`}>
        {delayedSkus > 0 ? (
          <span>
            ⚠ {t("dashboard.dispatch.delayed", { skus: formatLocaleNumber(delayedSkus), units: formatUnits(delayedUnits) })}
          </span>
        ) : (
          <span>✓ {t("dashboard.dispatch.noDelays")}</span>
        )}
      </div>
    </section>
  );
}

// ── Order coverage pipeline (footer) ───────────────────────────────────
// Left: open customer demand split into On hand / Delivering / Ordered-no-PO,
// sized by units or money. Right: popular sold products by supplier across a
// selectable look-back window (1 day … 3 years).
function OrderCoveragePipelineWidget({ coverage }) {
  const { t } = useLanguage();
  const [measure, setMeasure] = useState("units"); // "units" | "money"
  const [windowKey, setWindowKey] = useState("1m");
  const byMoney = measure === "money";

  const states = coverage?.states || null;
  const totalUnits = num(coverage?.total?.units);
  const total = byMoney ? num(coverage?.total?.value) : totalUnits;
  const windows = Array.isArray(coverage?.windows) ? coverage.windows : [];
  const activeWindow = windows.some((w) => w.key === windowKey)
    ? windowKey
    : windows[0]?.key;
  const popular = coverage?.popular?.[activeWindow] || [];

  const bands = [
    { key: "ready", label: t("dashboard.coverage.ready") },
    { key: "incoming", label: t("dashboard.coverage.incoming") },
    { key: "gap", label: t("dashboard.coverage.gap") },
  ];

  const sizeOf = (state) => (byMoney ? num(state?.value) : num(state?.units));
  const fmtState = (state) =>
    byMoney ? formatCompact(state?.value) : `${formatUnits(state?.units)}`;

  return (
    <section className="dash-card dash-coverage">
      <header className="dash-card-head">
        <div>
          <p className="dash-eyebrow">{t("dashboard.coverage.eyebrow")}</p>
          <h3>{t("dashboard.coverage.title")}</h3>
        </div>
        <div className="dash-cov-toggle" role="group" aria-label={t("dashboard.coverage.title")}>
          <button
            type="button"
            className={`dash-cov-toggle-btn${!byMoney ? " is-active" : ""}`}
            onClick={() => setMeasure("units")}
          >
            {t("dashboard.coverage.byUnits")}
          </button>
          <button
            type="button"
            className={`dash-cov-toggle-btn${byMoney ? " is-active" : ""}`}
            onClick={() => setMeasure("money")}
          >
            {t("dashboard.coverage.byMoney")}
          </button>
        </div>
      </header>

      {totalUnits <= 0 ? (
        <p className="dash-empty">{t("dashboard.coverage.empty")}</p>
      ) : (
        <div className="dash-cov-body">
          <div className="dash-cov-main">
            <div className="dash-cov-headline">
              <strong>{num(coverage?.coverage_pct)}%</strong>
              <span>{t("dashboard.coverage.fulfillable")}</span>
            </div>
            <div
              className="dash-segbar dash-cov-bar"
              role="img"
              aria-label={t("dashboard.coverage.title")}
            >
              {bands.map((band) => {
                const state = states?.[band.key];
                const pct = total > 0 ? (sizeOf(state) / total) * 100 : 0;
                if (pct <= 0) return null;
                return (
                  <span
                    key={band.key}
                    className={`dash-segbar-part seg-${band.key}`}
                    style={{ width: `${pct}%` }}
                    title={`${band.label}: ${fmtState(state)}`}
                  />
                );
              })}
            </div>
            <ul className="dash-cov-legend">
              {bands.map((band) => (
                <li className="dash-cov-legend-item" key={band.key}>
                  <span className={`dash-dot seg-${band.key}`} />
                  <span className="dash-cov-legend-label">{band.label}</span>
                  <span className="dash-cov-legend-value">{fmtState(states?.[band.key])}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="dash-pop">
            <div className="dash-pop-head">
              <p className="dash-pop-title">{t("dashboard.coverage.popular")}</p>
              <div
                className="dash-pop-windows"
                role="group"
                aria-label={t("dashboard.coverage.popular")}
              >
                {windows.map((w) => (
                  <button
                    key={w.key}
                    type="button"
                    className={`dash-pop-window-btn${w.key === activeWindow ? " is-active" : ""}`}
                    onClick={() => setWindowKey(w.key)}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
            </div>
            {popular.length === 0 ? (
              <p className="dash-pop-empty">{t("dashboard.coverage.popularEmpty")}</p>
            ) : (
              <ul className="dash-pop-list">
                {popular.map((item, index) => (
                  <li className="dash-pop-row" key={item.product_id || index}>
                    <span className="dash-pop-rank">{index + 1}</span>
                    <span className="dash-pop-name" title={item.product_name}>
                      {item.product_name || "—"}
                    </span>
                    <span className="dash-pop-metric">
                      {byMoney
                        ? formatCompact(item.value)
                        : `${formatUnits(item.units)} ${item.unit || ""}`}
                    </span>
                    <span
                      className="dash-pop-supplier"
                      title={item.supplier_name || t("dashboard.coverage.noSupplier")}
                    >
                      {item.supplier_name || t("dashboard.coverage.noSupplier")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function Dashboard({ dashboard }) {
  const stockReport = useMemo(
    () => (Array.isArray(dashboard?.stock_report) ? dashboard.stock_report : []),
    [dashboard]
  );
  const cashflow = dashboard?.overview?.cashflow || null;
  const coverage = dashboard?.overview?.order_coverage || null;

  const reorderItems = useMemo(() => {
    return stockReport
      .map((row) => {
        const available = num(row.available_stock ?? row.current_stock);
        const reorder = num(row.reorder_level);
        const oversold = num(row.oversold_units);
        const days =
          row.days_until_stockout === null || row.days_until_stockout === undefined
            ? null
            : Number(row.days_until_stockout);
        const isCritical = oversold > 0 || available <= 0;
        return {
          ...row,
          _available: available,
          _reorder: reorder,
          _oversold: oversold,
          _days: days,
          _isCritical: isCritical,
          _needsReorder: isCritical || (reorder > 0 && available <= reorder),
        };
      })
      .filter((row) => row._needsReorder)
      .sort((a, b) => {
        const critDiff = (a._isCritical ? 0 : 1) - (b._isCritical ? 0 : 1);
        if (critDiff !== 0) return critDiff;
        const aDays = a._days == null ? Infinity : a._days;
        const bDays = b._days == null ? Infinity : b._days;
        if (aDays !== bDays) return aDays - bDays;
        return num(b.recommended_restock) - num(a.recommended_restock);
      });
  }, [stockReport]);

  return (
    <div className="dashboard-page">
      <KpiRibbon metrics={dashboard?.metrics} cashflow={cashflow} />
      <div className="dash-grid">
        <UrgentReorderWidget rows={reorderItems} />
        <StockCyclingWidget stockReport={stockReport} />
        <DeliveryPlanningWidget stockReport={stockReport} />
      </div>
      <OrderCoveragePipelineWidget coverage={coverage} />
    </div>
  );
}

export default Dashboard;
