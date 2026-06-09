import { useMemo, useState } from "react";
import { formatNumber as formatLocaleNumber } from "../format";
import { useLanguage } from "../i18n/LanguageContext";

// A product is treated as a "high-cycle" mover when it reorders, on average,
// at least this often. Slower-but-repeat items fall into "healthy long-cycle"
// so a wholesaler's every-6-months lines are never mistaken for dead stock.
const HIGH_CYCLE_MAX_INTERVAL_DAYS = 60;
const REORDER_PAGE_SIZE = 4;
const DISPATCH_LIMIT = 5;
const CLOSED_SALE_STATUSES = new Set(["delivered", "cancelled", "returned"]);
const SALE_STATUS_TONE = {
  draft: "neutral",
  partially_packed: "warning",
  packed: "warning",
  partially_shipped: "accent",
  shipped: "accent",
  partially_delivered: "accent",
};

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

// Build the items a Purchase-Order prefill expects (consumed by
// createInitialItems in purchaseFormUtils).
function toPrefillItem(src, quantity, unitCost) {
  return {
    product_id: src.product_id,
    product_name: src.product_name,
    sku: src.sku || "",
    unit: src.unit || "",
    quantity: quantity > 0 ? quantity : 1,
    unit_cost: unitCost ?? src.unit_cost ?? src.average_unit_cost ?? "",
  };
}

// Split open customer demand per product into On hand / Delivering / Gap —
// the same math as the coverage bar, but kept per-row so each segment can list
// its products in a modal.
function buildCoverageSegments(stockReport) {
  const segments = { ready: [], incoming: [], gap: [] };
  stockReport.forEach((row) => {
    const demand = num(row.pending_sales_units);
    if (demand <= 0) return;
    const available = Math.max(0, num(row.available_stock ?? row.current_stock));
    const incoming = Math.max(0, num(row.incoming_purchase_units));
    const ready = Math.min(demand, available);
    const incomingCov = Math.min(demand - ready, incoming);
    const gap = Math.max(0, demand - ready - incomingCov);
    if (ready > 0) segments.ready.push({ row, qty: ready });
    if (incomingCov > 0) segments.incoming.push({ row, qty: incomingCov });
    if (gap > 0) segments.gap.push({ row, qty: gap });
  });
  Object.values(segments).forEach((list) => list.sort((a, b) => b.qty - a.qty));
  return segments;
}

// ── Reusable modal shell (same chrome as DocumentRefModal) ─────────────
function DashModal({ eyebrow, title, onClose, headerAction, children }) {
  const { t } = useLanguage();
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="detail-modal section-card dash-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="section-heading">
          <div>
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            <h3>{title}</h3>
          </div>
          <div className="transaction-detail-actions">
            {headerAction}
            <button
              type="button"
              className="secondary-button table-action-button"
              onClick={onClose}
            >
              {t("common.close")}
            </button>
          </div>
        </div>
        <div className="dash-modal-body">{children}</div>
      </div>
    </div>
  );
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
function UrgentReorderWidget({ rows, onOrder }) {
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
            const restock = num(row.recommended_restock);
            const emergency = row._isCritical
              ? t("dashboard.reorder.out")
              : row._days != null
                ? t("dashboard.reorder.days", { n: formatLocaleNumber(row._days) })
                : t("dashboard.reorder.low");
            return (
              <li className="dash-reorder-row" key={row.product_id || index}>
                <span className={`dash-emergency tone-${tone}`} title={emergency}>{emergency}</span>
                <div className="dash-reorder-main">
                  <span className="dash-reorder-name" title={row.product_name}>
                    {row.product_name || "—"}
                  </span>
                  <div
                    className="dash-reorder-track"
                    title={`${formatUnits(row._available)} / ${formatUnits(row._reorder)} ${row.unit || ""}`}
                  >
                    <span className={`dash-reorder-fill tone-${tone}`} style={{ width: `${fill}%` }} />
                  </div>
                </div>
                {restock > 0 ? (
                  <button
                    type="button"
                    className="dash-order-btn"
                    onClick={() => onOrder?.(row)}
                  >
                    {t("dashboard.reorder.order", { qty: `${formatUnits(restock)} ${row.unit || ""}` })}
                  </button>
                ) : (
                  <span className="dash-order-btn is-ghost">—</span>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

// ── Stock cycling segmentation ─────────────────────────────────────────
function StockCyclingWidget({ tagged, onOpenBand }) {
  const { t } = useLanguage();

  const bands = [
    { klass: "high", label: t("dashboard.cycling.high"), def: t("dashboard.cycling.highDef") },
    { klass: "long", label: t("dashboard.cycling.long"), def: t("dashboard.cycling.longDef") },
    { klass: "oneOff", label: t("dashboard.cycling.oneOff"), def: t("dashboard.cycling.oneOffDef") },
  ];
  const total = tagged.high.length + tagged.long.length + tagged.oneOff.length;

  return (
    <section className="dash-card dash-cycling">
      <header className="dash-card-head">
        <div>
          <p className="dash-eyebrow">{t("dashboard.cycling.eyebrow")}</p>
          <h3>{t("dashboard.cycling.title")}</h3>
        </div>
      </header>

      {total === 0 ? (
        <p className="dash-empty">{t("dashboard.cycling.empty")}</p>
      ) : (
        <>
          <div className="dash-segbar" role="img" aria-label={t("dashboard.cycling.title")}>
            {bands.map((band) => {
              const pct = (tagged[band.klass].length / total) * 100;
              if (pct <= 0) return null;
              return (
                <button
                  key={band.klass}
                  type="button"
                  className={`dash-segbar-part seg-${band.klass} is-clickable`}
                  style={{ width: `${pct}%` }}
                  title={`${band.label}: ${tagged[band.klass].length}`}
                  onClick={() => onOpenBand(band.klass)}
                  aria-label={`${band.label} ${tagged[band.klass].length}`}
                />
              );
            })}
          </div>
          <ul className="dash-cycling-legend">
            {bands.map((band) => (
              <li key={band.klass}>
                <button
                  type="button"
                  className="dash-cycling-row is-clickable"
                  onClick={() => onOpenBand(band.klass)}
                  disabled={tagged[band.klass].length === 0}
                  title={band.def}
                >
                  <span className={`dash-dot seg-${band.klass}`} />
                  <span className="dash-cycling-label">{band.label}</span>
                  <span className="dash-cycling-def">{band.def}</span>
                  <span className="dash-cycling-count">{tagged[band.klass].length}</span>
                  <span className="dash-cycling-chev">›</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

// ── Delivery planning (per-order, deep-linked) ─────────────────────────
function DeliveryPlanningWidget({ orders, totalOpen, delayedSkus, onOpenSale, onViewAll }) {
  const { t } = useLanguage();

  return (
    <section className="dash-card dash-dispatch">
      <header className="dash-card-head">
        <div>
          <p className="dash-eyebrow">{t("dashboard.dispatch.eyebrow")}</p>
          <h3>{t("dashboard.dispatch.title")}</h3>
        </div>
        {delayedSkus > 0 ? (
          <span className="dash-delayed-chip" title={t("dashboard.dispatch.delayedInbound", { n: formatLocaleNumber(delayedSkus) })}>
            ⚠ {formatLocaleNumber(delayedSkus)}
          </span>
        ) : null}
      </header>

      {orders.length === 0 ? (
        <p className="dash-empty">{t("dashboard.dispatch.empty")}</p>
      ) : (
        <ul className="dash-do-list">
          {orders.map((sale) => {
            const tone = SALE_STATUS_TONE[sale.status] || "neutral";
            return (
              <li key={sale.id}>
                <button
                  type="button"
                  className="dash-do-row"
                  onClick={() => onOpenSale(sale.id)}
                  title={t("dashboard.dispatch.openOrder")}
                >
                  <span className="dash-do-ref">{sale.reference_no || sale.id}</span>
                  <span className="dash-do-cust" title={sale.customer_name}>
                    {sale.customer_name || "—"}
                  </span>
                  <span className={`dash-status-chip tone-${tone}`}>
                    {t(`dashboard.dispatch.status.${sale.status}`)}
                  </span>
                  <span className="dash-do-go" aria-hidden="true">→</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {totalOpen > orders.length ? (
        <button type="button" className="dash-viewall" onClick={onViewAll}>
          {t("dashboard.dispatch.viewAll", { n: formatLocaleNumber(totalOpen) })} →
        </button>
      ) : null}
    </section>
  );
}

// ── Order coverage pipeline + popular products (footer) ────────────────
function OrderCoveragePipelineWidget({ coverage, onOpenSegment, onPopAction }) {
  const { t } = useLanguage();
  const [measure, setMeasure] = useState("units");
  const [windowKey, setWindowKey] = useState("1m");
  const byMoney = measure === "money";

  const states = coverage?.states || null;
  const totalUnits = num(coverage?.total?.units);
  const total = byMoney ? num(coverage?.total?.value) : totalUnits;
  const windows = Array.isArray(coverage?.windows) ? coverage.windows : [];
  const activeWindow = windows.some((w) => w.key === windowKey) ? windowKey : windows[0]?.key;
  const popular = coverage?.popular?.[activeWindow] || [];

  const bands = [
    { key: "ready", label: t("dashboard.coverage.ready") },
    { key: "incoming", label: t("dashboard.coverage.incoming") },
    { key: "gap", label: t("dashboard.coverage.gap") },
  ];

  const sizeOf = (state) => (byMoney ? num(state?.value) : num(state?.units));
  const fmtState = (state) => (byMoney ? formatCompact(state?.value) : `${formatUnits(state?.units)}`);

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
            <div className="dash-segbar dash-cov-bar" role="group" aria-label={t("dashboard.coverage.title")}>
              {bands.map((band) => {
                const state = states?.[band.key];
                const pct = total > 0 ? (sizeOf(state) / total) * 100 : 0;
                if (pct <= 0) return null;
                return (
                  <button
                    key={band.key}
                    type="button"
                    className={`dash-segbar-part seg-${band.key} is-clickable`}
                    style={{ width: `${pct}%` }}
                    title={`${band.label}: ${fmtState(state)}`}
                    onClick={() => onOpenSegment(band.key)}
                    aria-label={`${band.label} ${fmtState(state)}`}
                  />
                );
              })}
            </div>
            <ul className="dash-cov-legend">
              {bands.map((band) => (
                <li key={band.key}>
                  <button
                    type="button"
                    className="dash-cov-legend-item is-clickable"
                    onClick={() => onOpenSegment(band.key)}
                  >
                    <span className={`dash-dot seg-${band.key}`} />
                    <span className="dash-cov-legend-label">{band.label}</span>
                    <span className="dash-cov-legend-value">{fmtState(states?.[band.key])}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="dash-pop">
            <div className="dash-pop-head">
              <p className="dash-pop-title">{t("dashboard.coverage.popular")}</p>
              <div className="dash-pop-windows" role="group" aria-label={t("dashboard.coverage.popular")}>
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
                      {byMoney ? formatCompact(item.value) : `${formatUnits(item.units)} ${item.unit || ""}`}
                    </span>
                    <span className="dash-pop-supplier" title={item.supplier_name || t("dashboard.coverage.noSupplier")}>
                      {item.supplier_name || t("dashboard.coverage.noSupplier")}
                    </span>
                    <span className="dash-pop-actions">
                      <button type="button" title={t("dashboard.coverage.actQuote")} onClick={() => onPopAction("quote", item)}>📝</button>
                      <button type="button" title={t("dashboard.coverage.actPo")} onClick={() => onPopAction("po", item)}>🛒</button>
                      <button type="button" title={t("dashboard.coverage.actProduct")} onClick={() => onPopAction("product", item)}>📦</button>
                      <button type="button" title={t("dashboard.coverage.actSupplier")} onClick={() => onPopAction("supplier", item)}>🏭</button>
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

// ── Drill-down modals ──────────────────────────────────────────────────
function CyclingModal({ band, label, items, onClose, onOpenProduct }) {
  const { t } = useLanguage();
  return (
    <DashModal eyebrow={t("dashboard.cycling.eyebrow")} title={`${label} · ${items.length}`} onClose={onClose}>
      {items.length === 0 ? (
        <p className="dash-empty">{t("dashboard.cycling.empty")}</p>
      ) : (
        <table className="dash-modal-table">
          <tbody>
            {items.map(({ row, cyclesPerYear }) => (
              <tr key={row.product_id} onClick={() => onOpenProduct(row)} className="is-clickable">
                <td className="dmt-name">{row.product_name}</td>
                <td className="dmt-sku">{row.sku || ""}</td>
                <td className="dmt-metric">
                  {band === "oneOff"
                    ? t("dashboard.cycling.oneOffTag")
                    : cyclesPerYear
                      ? t("dashboard.cycling.perYear", { n: formatLocaleNumber(Math.round(cyclesPerYear)) })
                      : "—"}
                </td>
                <td className="dmt-go" aria-hidden="true">→</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </DashModal>
  );
}

function CoverageModal({ segKey, label, items, onClose, onOpenProduct, onGeneratePo }) {
  const { t } = useLanguage();
  const headerAction =
    segKey === "gap" && items.length > 0 ? (
      <button type="button" className="primary-button table-action-button" onClick={onGeneratePo}>
        {t("dashboard.coverage.generatePo")}
      </button>
    ) : null;
  return (
    <DashModal eyebrow={t("dashboard.coverage.eyebrow")} title={`${label} · ${items.length}`} onClose={onClose} headerAction={headerAction}>
      {items.length === 0 ? (
        <p className="dash-empty">{t("dashboard.coverage.empty")}</p>
      ) : (
        <table className="dash-modal-table">
          <tbody>
            {items.map(({ row, qty }) => (
              <tr key={row.product_id} onClick={() => onOpenProduct(row)} className="is-clickable">
                <td className="dmt-name">{row.product_name}</td>
                <td className="dmt-metric">{formatUnits(qty)} {row.unit || ""}</td>
                <td className="dmt-supplier">{row.best_supplier_name || t("dashboard.coverage.noSupplier")}</td>
                <td className="dmt-go" aria-hidden="true">→</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </DashModal>
  );
}

function Dashboard({ dashboard, sales = [], onNavigate }) {
  const { t } = useLanguage();
  const [cyclingBand, setCyclingBand] = useState(null);
  const [coverageSeg, setCoverageSeg] = useState(null);

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

  // Stock-cycling: classify once, keep the rows so a band click can list them.
  const cyclingTagged = useMemo(() => {
    const tagged = { high: [], long: [], oneOff: [] };
    stockReport.forEach((row) => {
      const result = classifyCycle(row);
      if (!result) return;
      tagged[result.klass].push({ row, cyclesPerYear: result.cyclesPerYear });
    });
    Object.values(tagged).forEach((list) =>
      list.sort((a, b) => num(b.row.sales_history_units) - num(a.row.sales_history_units))
    );
    return tagged;
  }, [stockReport]);

  // Delivery planning: open sales orders, oldest first, each deep-linkable.
  const openOrders = useMemo(() => {
    return (Array.isArray(sales) ? sales : [])
      .filter((sale) => sale && !CLOSED_SALE_STATUSES.has(sale.status))
      .sort((a, b) => String(a.transaction_date || "").localeCompare(String(b.transaction_date || "")));
  }, [sales]);
  const delayedSkus = useMemo(
    () => stockReport.filter((row) => num(row.delayed_purchase_units) > 0).length,
    [stockReport]
  );

  const coverageSegments = useMemo(() => buildCoverageSegments(stockReport), [stockReport]);

  // ── deep-link / action helpers ──
  const orderProducts = (items, supplierName) =>
    onNavigate?.({ tab: "purchase-history", prefill: { supplier_name: supplierName || "", items } });
  const openProduct = () => onNavigate?.({ tab: "products" });
  const openSupplier = () => onNavigate?.({ tab: "suppliers" });

  const handleReorder = (row) =>
    orderProducts([toPrefillItem(row, num(row.recommended_restock), row.unit_cost)], row.best_supplier_name);

  const handleGeneratePo = () => {
    const items = coverageSegments.gap.map(({ row, qty }) => toPrefillItem(row, qty, row.unit_cost));
    if (items.length > 0) orderProducts(items, "");
    setCoverageSeg(null);
  };

  const handlePopAction = (type, item) => {
    if (type === "po") orderProducts([toPrefillItem(item, num(item.units), "")], item.supplier_name);
    else if (type === "quote") onNavigate?.({ tab: "quotations", openNew: true });
    else if (type === "product") openProduct();
    else if (type === "supplier") openSupplier();
  };

  const segLabels = {
    ready: t("dashboard.coverage.ready"),
    incoming: t("dashboard.coverage.incoming"),
    gap: t("dashboard.coverage.gap"),
  };
  const bandLabels = {
    high: t("dashboard.cycling.high"),
    long: t("dashboard.cycling.long"),
    oneOff: t("dashboard.cycling.oneOff"),
  };

  return (
    <div className="dashboard-page">
      <KpiRibbon metrics={dashboard?.metrics} cashflow={cashflow} />
      <div className="dash-grid">
        <UrgentReorderWidget rows={reorderItems} onOrder={handleReorder} />
        <StockCyclingWidget tagged={cyclingTagged} onOpenBand={setCyclingBand} />
        <DeliveryPlanningWidget
          orders={openOrders.slice(0, DISPATCH_LIMIT)}
          totalOpen={openOrders.length}
          delayedSkus={delayedSkus}
          onOpenSale={(saleId) => onNavigate?.({ tab: "sales-history", focusId: saleId })}
          onViewAll={() => onNavigate?.({ tab: "sales-history" })}
        />
      </div>
      <OrderCoveragePipelineWidget
        coverage={coverage}
        onOpenSegment={setCoverageSeg}
        onPopAction={handlePopAction}
      />

      {cyclingBand ? (
        <CyclingModal
          band={cyclingBand}
          label={bandLabels[cyclingBand]}
          items={cyclingTagged[cyclingBand]}
          onClose={() => setCyclingBand(null)}
          onOpenProduct={() => {
            setCyclingBand(null);
            openProduct();
          }}
        />
      ) : null}

      {coverageSeg ? (
        <CoverageModal
          segKey={coverageSeg}
          label={segLabels[coverageSeg]}
          items={coverageSegments[coverageSeg]}
          onClose={() => setCoverageSeg(null)}
          onOpenProduct={() => {
            setCoverageSeg(null);
            openProduct();
          }}
          onGeneratePo={handleGeneratePo}
        />
      ) : null}
    </div>
  );
}

export default Dashboard;
