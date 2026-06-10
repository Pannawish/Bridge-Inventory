import { useMemo, useState } from "react";
import { formatNumber as formatLocaleNumber } from "../format";
import { useLanguage } from "../i18n/LanguageContext";
import { ReorderSawtoothMini } from "./charts/ReorderSawtooth";

// A product is treated as a "high-cycle" mover when it reorders, on average,
// at least this often. Slower-but-repeat items fall into "healthy long-cycle"
// so a wholesaler's every-6-months lines are never mistaken for dead stock.
const HIGH_CYCLE_MAX_INTERVAL_DAYS = 60;
const REORDER_PAGE_SIZE = 3;
const DISPATCH_LIMIT = 6;
const CLOSED_SALE_STATUSES = new Set(["delivered", "cancelled", "returned"]);
const SALE_STATUS_TONE = {
  draft: "neutral",
  partially_packed: "warning",
  packed: "warning",
  partially_shipped: "accent",
  shipped: "accent",
  partially_delivered: "accent",
};

// Fulfilment pipeline: collapse the granular sale statuses into the three
// stages the floor actually thinks in. Order matters — it drives the tracker.
const DELIVERY_STAGES = [
  { key: "draft", statuses: ["draft"] },
  { key: "packing", statuses: ["partially_packed", "packed"] },
  { key: "delivering", statuses: ["partially_shipped", "shipped", "partially_delivered"] },
];
const OPEN_SALE_STATUSES = DELIVERY_STAGES.flatMap((stage) => stage.statuses);
const STAGE_BY_STATUS = DELIVERY_STAGES.reduce((map, stage) => {
  stage.statuses.forEach((status) => {
    map[status] = stage.key;
  });
  return map;
}, {});

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

function reorderLevelOf(product) {
  if (!product) return 0;
  return num(product.reorderLevel ?? product.reorder_level);
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

// Open sales orders that include any of the given product ids, with the
// matching lines pulled out — powers both the backorder and allocation modals.
function ordersForProducts(orders, productIds) {
  const wanted = new Set([...productIds].map((id) => `${id}`));
  return orders
    .map((sale) => {
      const lines = (Array.isArray(sale.items) ? sale.items : []).filter((item) =>
        wanted.has(`${item.product_id}`)
      );
      return lines.length ? { sale, lines } : null;
    })
    .filter(Boolean);
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

// ── Zone 1 · Urgent reorder (hero) ─────────────────────────────────────
function UrgentReorderWidget({ rows, onQuickOrder }) {
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
        <>
          <div className="dash-saw-key" aria-hidden="true">
            <span className="dash-saw-key-item"><i className="k-stock" />{t("dashboard.reorder.key.stock")}</span>
            <span className="dash-saw-key-item"><i className="k-reorder" />{t("dashboard.reorder.key.reorder")}</span>
            <span className="dash-saw-key-item"><i className="k-safety" />{t("dashboard.reorder.key.safety")}</span>
          </div>
          {/* Fixed three slots: paging only swaps content, the layout never shifts. */}
          <ol className="dash-reorder-list">
            {Array.from({ length: REORDER_PAGE_SIZE }).map((_, slot) => {
              const row = visible[slot];
              if (!row) {
                return <li className="dash-reorder-row is-empty" key={`empty-${slot}`} aria-hidden="true" />;
              }
              const tone = reorderTone(row);
              const restock = num(row.recommended_restock);
              const dailyDemand = num(row.average_daily_demand) || num(row.predicted_7_day_demand) / 7;
              const severity = row._isCritical ? t("dashboard.reorder.out") : t("dashboard.reorder.low");
              const eta = row._days != null ? t("dashboard.reorder.days", { n: formatLocaleNumber(row._days) }) : "—";
              return (
                <li className="dash-reorder-row" key={row.product_id || slot}>
                  <div className="dash-reorder-head">
                    <span className={`dash-emergency tone-${tone}`}>{severity}</span>
                    <span className="dash-reorder-name" title={row.product_name}>
                      {row.product_name || "—"}
                    </span>
                    <span className={`dash-reorder-eta tone-${tone}`}>{eta}</span>
                    {restock > 0 ? (
                      <button type="button" className="dash-order-btn" onClick={() => onQuickOrder(row)}>
                        {t("dashboard.reorder.quickOrder")}
                      </button>
                    ) : null}
                  </div>
                  <div
                    className="dash-reorder-chart"
                    title={`${formatUnits(row._available)} / ${formatUnits(row._reorder)} ${row.unit || ""}`}
                  >
                    <ReorderSawtoothMini
                      current={row._available}
                      reorder={row._reorder}
                      safety={num(row.safety_stock)}
                      dailyDemand={dailyDemand}
                      leadTime={num(row.average_lead_time_days)}
                      restock={restock}
                      unit={row.unit || ""}
                      tone={tone}
                    />
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </section>
  );
}

// Confirm-before-create Quick PO. Autofills vendor / quantity / unit price from
// the row's best-price supplier and recommended restock, lets the user tweak,
// then hands off to the Purchase form prefilled (review-before-create).
function QuickPoDrawer({ row, onClose, onConfirm }) {
  const { t } = useLanguage();
  const [vendor, setVendor] = useState(row.best_supplier_name || "");
  const [qty, setQty] = useState(() => {
    const restock = num(row.recommended_restock);
    return restock > 0 ? String(restock) : "1";
  });
  const [price, setPrice] = useState(() => {
    const seed = row.best_supplier_cost ?? row.unit_cost ?? row.average_unit_cost;
    return seed === null || seed === undefined ? "" : String(seed);
  });

  const lineTotal = num(qty) * num(price);

  function handleSubmit(event) {
    event.preventDefault();
    onConfirm({ vendor, qty: num(qty), price: price === "" ? "" : num(price) });
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <aside
        className="dash-drawer section-card"
        role="dialog"
        aria-modal="true"
        aria-label={t("dashboard.quickPo.title")}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="section-heading">
          <div>
            <p className="eyebrow">{t("dashboard.quickPo.eyebrow")}</p>
            <h3>{row.product_name || "—"}</h3>
          </div>
          <button type="button" className="secondary-button table-action-button" onClick={onClose}>
            {t("common.close")}
          </button>
        </header>

        <div className="dash-drawer-context">
          <div>
            <span>{t("dashboard.quickPo.current")}</span>
            <strong>{formatUnits(row._available)} {row.unit || ""}</strong>
          </div>
          <div>
            <span>{t("dashboard.quickPo.reorderPoint")}</span>
            <strong>{formatUnits(row._reorder)} {row.unit || ""}</strong>
          </div>
          <div>
            <span>{t("dashboard.quickPo.daysLeft")}</span>
            <strong>{row._days != null ? t("dashboard.reorder.days", { n: formatLocaleNumber(row._days) }) : "—"}</strong>
          </div>
        </div>

        <form className="dash-drawer-body" onSubmit={handleSubmit}>
          <label className="dash-drawer-field">
            <span>{t("dashboard.quickPo.vendor")}</span>
            <input
              type="text"
              value={vendor}
              onChange={(event) => setVendor(event.target.value)}
              placeholder={t("dashboard.coverage.noSupplier")}
            />
          </label>
          <div className="dash-drawer-row">
            <label className="dash-drawer-field">
              <span>{t("dashboard.quickPo.qty")}</span>
              <div className="dash-drawer-inputunit">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={qty}
                  onChange={(event) => setQty(event.target.value)}
                  required
                />
                <em>{row.unit || ""}</em>
              </div>
            </label>
            <label className="dash-drawer-field">
              <span>{t("dashboard.quickPo.unitPrice")}</span>
              <div className="dash-drawer-inputunit">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                />
                <em>฿</em>
              </div>
            </label>
          </div>

          <div className="dash-drawer-total">
            <span>{t("dashboard.quickPo.lineTotal")}</span>
            <strong>{formatCompact(lineTotal)}</strong>
          </div>

          <p className="dash-drawer-hint">{t("dashboard.quickPo.hint")}</p>

          <div className="dash-drawer-actions">
            <button type="button" className="secondary-button" onClick={onClose}>
              {t("dashboard.quickPo.cancel")}
            </button>
            <button type="submit" className="primary-button">
              {t("dashboard.quickPo.create")}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}

// ── Zone 2 · Stock cycling segmentation ────────────────────────────────
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
                  title={t("dashboard.cycling.investigate")}
                >
                  <span className={`dash-cycle-badge seg-${band.klass}`}>{band.label}</span>
                  <span className="dash-cycling-def">{band.def}</span>
                  <span className={`dash-cycling-count seg-${band.klass}`}>{tagged[band.klass].length}</span>
                  <span className="dash-cycling-chev" aria-hidden="true">›</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

// ── Zone 3 · Delivery planning (fulfilment pipeline) ───────────────────
function DeliveryPipelineWidget({ orders, totalOpen, stageCounts, delayedSkus, onOpenSale, onOpenStage, onOpenCenter }) {
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

      <div className="dash-pipe" role="group" aria-label={t("dashboard.dispatch.title")}>
        {DELIVERY_STAGES.map((stage, index) => (
          <div className="dash-pipe-slot" key={stage.key}>
            {index > 0 ? <span className="dash-pipe-arrow" aria-hidden="true">→</span> : null}
            <button
              type="button"
              className={`dash-pipe-stage stage-${stage.key}${stageCounts[stage.key] > 0 ? " is-live" : ""}`}
              onClick={() => onOpenStage(stage.statuses)}
              disabled={stageCounts[stage.key] === 0}
              title={t("dashboard.dispatch.openStage", { stage: t(`dashboard.dispatch.stage.${stage.key}`) })}
            >
              <strong>{formatLocaleNumber(stageCounts[stage.key] || 0)}</strong>
              <span>{t(`dashboard.dispatch.stage.${stage.key}`)}</span>
            </button>
          </div>
        ))}
      </div>

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

      {totalOpen > 0 ? (
        <button type="button" className="dash-viewall" onClick={onOpenCenter}>
          {t("dashboard.dispatch.actionCenter", { n: formatLocaleNumber(totalOpen) })} →
        </button>
      ) : null}
    </section>
  );
}

// ── Zone 4 · Order coverage pipeline + popular products (footer) ───────
function OrderCoveragePipelineWidget({ coverage, onOpenSegment, onCheckAllocation, onAdjustThreshold }) {
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
                    {band.key === "gap" && sizeOf(states?.gap) > 0 ? (
                      <span className="dash-cov-legend-chev" aria-hidden="true">›</span>
                    ) : null}
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
                    <span className="dash-pop-actions">
                      <button
                        type="button"
                        className="dash-pop-action"
                        title={t("dashboard.coverage.checkAllocation")}
                        onClick={() => onCheckAllocation(item)}
                      >
                        {t("dashboard.coverage.checkAllocationShort")}
                      </button>
                      <button
                        type="button"
                        className="dash-pop-action"
                        title={t("dashboard.coverage.adjustThreshold")}
                        onClick={() => onAdjustThreshold(item)}
                      >
                        {t("dashboard.coverage.adjustThresholdShort")}
                      </button>
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
              <tr key={row.product_id} onClick={() => onOpenProduct(row)} className="is-clickable" title={t("dashboard.cycling.investigate")}>
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

function CoverageModal({ label, items, onClose, onOpenProduct }) {
  const { t } = useLanguage();
  return (
    <DashModal eyebrow={t("dashboard.coverage.eyebrow")} title={`${label} · ${items.length}`} onClose={onClose}>
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

// Gap segment → which customer orders are backordered (open orders that include
// a product with no stock and no inbound PO to cover it).
function BackorderModal({ entries, onClose, onOpenSale, onGeneratePo }) {
  const { t } = useLanguage();
  const headerAction =
    entries.length > 0 ? (
      <button type="button" className="primary-button table-action-button" onClick={onGeneratePo}>
        {t("dashboard.coverage.generatePos")}
      </button>
    ) : null;
  return (
    <DashModal
      eyebrow={t("dashboard.coverage.eyebrow")}
      title={`${t("dashboard.coverage.backorderTitle")} · ${entries.length}`}
      onClose={onClose}
      headerAction={headerAction}
    >
      {entries.length === 0 ? (
        <p className="dash-empty">{t("dashboard.coverage.backorderEmpty")}</p>
      ) : (
        <table className="dash-modal-table">
          <tbody>
            {entries.map(({ sale, lines }) => {
              const tone = SALE_STATUS_TONE[sale.status] || "neutral";
              return (
                <tr key={sale.id} onClick={() => onOpenSale(sale.id)} className="is-clickable" title={t("dashboard.dispatch.openOrder")}>
                  <td className="dmt-name">{sale.customer_name || "—"}</td>
                  <td className="dmt-sku">{sale.reference_no || sale.id}</td>
                  <td className="dmt-metric">
                    {lines.length === 1
                      ? lines[0].product_name
                      : t("dashboard.coverage.backorderLines", { n: lines.length })}
                  </td>
                  <td>
                    <span className={`dash-status-chip tone-${tone}`}>
                      {t(`dashboard.dispatch.status.${sale.status}`)}
                    </span>
                  </td>
                  <td className="dmt-go" aria-hidden="true">→</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </DashModal>
  );
}

// Popular product → which active sales orders are claiming this inventory.
function AllocationModal({ product, entries, onClose, onOpenSale }) {
  const { t } = useLanguage();
  return (
    <DashModal
      eyebrow={t("dashboard.coverage.allocationEyebrow")}
      title={product?.product_name || t("dashboard.coverage.allocationTitle")}
      onClose={onClose}
    >
      {entries.length === 0 ? (
        <p className="dash-empty">{t("dashboard.coverage.allocationEmpty")}</p>
      ) : (
        <table className="dash-modal-table">
          <tbody>
            {entries.map(({ sale, lines }) => {
              const tone = SALE_STATUS_TONE[sale.status] || "neutral";
              const claimed = lines.reduce((sum, line) => sum + num(line.quantity), 0);
              const unit = lines[0]?.unit || "";
              return (
                <tr key={sale.id} onClick={() => onOpenSale(sale.id)} className="is-clickable" title={t("dashboard.dispatch.openOrder")}>
                  <td className="dmt-name">{sale.customer_name || "—"}</td>
                  <td className="dmt-sku">{sale.reference_no || sale.id}</td>
                  <td className="dmt-metric">{formatUnits(claimed)} {unit}</td>
                  <td>
                    <span className={`dash-status-chip tone-${tone}`}>
                      {t(`dashboard.dispatch.status.${sale.status}`)}
                    </span>
                  </td>
                  <td className="dmt-go" aria-hidden="true">→</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </DashModal>
  );
}

// Popular product → quick-adjust its reorder point without leaving the board.
function ThresholdModal({ product, currentLevel, unit, onClose, onSave }) {
  const { t } = useLanguage();
  const [value, setValue] = useState(currentLevel > 0 ? String(currentLevel) : "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    const ok = await onSave(num(value));
    setSaving(false);
    if (ok !== false) onClose();
  }

  return (
    <DashModal eyebrow={t("dashboard.coverage.thresholdEyebrow")} title={product?.product_name || ""} onClose={onClose}>
      <form className="dash-threshold" onSubmit={handleSubmit}>
        <p className="dash-threshold-note">{t("dashboard.coverage.thresholdNote")}</p>
        <div className="dash-threshold-current">
          <span>{t("dashboard.coverage.thresholdCurrent")}</span>
          <strong>{formatUnits(currentLevel)} {unit}</strong>
        </div>
        <label className="dash-drawer-field">
          <span>{t("dashboard.coverage.thresholdLabel")}</span>
          <div className="dash-drawer-inputunit">
            <input
              type="number"
              min="0"
              step="any"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              autoFocus
              required
            />
            <em>{unit}</em>
          </div>
        </label>
        <div className="dash-drawer-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            {t("dashboard.quickPo.cancel")}
          </button>
          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? t("dashboard.coverage.thresholdSaving") : t("dashboard.coverage.thresholdSave")}
          </button>
        </div>
      </form>
    </DashModal>
  );
}

function Dashboard({ dashboard, sales = [], products = [], onNavigate, onUpdateReorderLevel }) {
  const { t } = useLanguage();
  const [quickPo, setQuickPo] = useState(null);
  const [cyclingBand, setCyclingBand] = useState(null);
  const [coverageSeg, setCoverageSeg] = useState(null);
  const [backorderOpen, setBackorderOpen] = useState(false);
  const [allocationProduct, setAllocationProduct] = useState(null);
  const [thresholdProduct, setThresholdProduct] = useState(null);

  const stockReport = useMemo(
    () => (Array.isArray(dashboard?.stock_report) ? dashboard.stock_report : []),
    [dashboard]
  );
  const coverage = dashboard?.overview?.order_coverage || null;

  const productById = useMemo(() => {
    const map = new Map();
    (Array.isArray(products) ? products : []).forEach((product) => {
      if (product?.id != null) map.set(`${product.id}`, product);
    });
    return map;
  }, [products]);

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

  const stageCounts = useMemo(() => {
    const counts = { draft: 0, packing: 0, delivering: 0 };
    openOrders.forEach((sale) => {
      const stage = STAGE_BY_STATUS[sale.status];
      if (stage) counts[stage] += 1;
    });
    return counts;
  }, [openOrders]);

  const delayedSkus = useMemo(
    () => stockReport.filter((row) => num(row.delayed_purchase_units) > 0).length,
    [stockReport]
  );

  const coverageSegments = useMemo(() => buildCoverageSegments(stockReport), [stockReport]);

  const gapProductIds = useMemo(
    () => new Set(coverageSegments.gap.map(({ row }) => `${row.product_id}`)),
    [coverageSegments]
  );
  const backorderEntries = useMemo(
    () => ordersForProducts(openOrders, gapProductIds),
    [openOrders, gapProductIds]
  );
  const allocationEntries = useMemo(() => {
    if (!allocationProduct) return [];
    return ordersForProducts(openOrders, [allocationProduct.product_id]);
  }, [openOrders, allocationProduct]);

  // ── deep-link / action helpers ──
  const orderProducts = (items, supplierName) =>
    onNavigate?.({ tab: "purchase-history", prefill: { supplier_name: supplierName || "", items } });
  const openProductHistory = (productId) =>
    onNavigate?.({ tab: "products", focusProductId: productId });
  const openSale = (saleId) => onNavigate?.({ tab: "sales-history", focusId: saleId });
  const openStage = (statuses) => onNavigate?.({ tab: "sales-history", statusFilter: statuses });

  const handleQuickPoConfirm = ({ vendor, qty, price }) => {
    if (quickPo) {
      orderProducts([toPrefillItem(quickPo, qty, price === "" ? quickPo.unit_cost : price)], vendor);
    }
    setQuickPo(null);
  };

  const handleGeneratePo = () => {
    const items = coverageSegments.gap.map(({ row, qty }) => toPrefillItem(row, qty, row.unit_cost));
    if (items.length > 0) orderProducts(items, "");
    setBackorderOpen(false);
  };

  const handleOpenSegment = (key) => {
    if (key === "gap") setBackorderOpen(true);
    else setCoverageSeg(key);
  };

  const handleAdjustThreshold = async (value) => {
    if (!thresholdProduct) return false;
    return onUpdateReorderLevel?.(thresholdProduct.product_id, value);
  };

  const segLabels = {
    ready: t("dashboard.coverage.ready"),
    incoming: t("dashboard.coverage.incoming"),
  };
  const bandLabels = {
    high: t("dashboard.cycling.high"),
    long: t("dashboard.cycling.long"),
    oneOff: t("dashboard.cycling.oneOff"),
  };

  const thresholdProductRecord = thresholdProduct
    ? productById.get(`${thresholdProduct.product_id}`)
    : null;

  return (
    <div className="dashboard-page">
      <div className="dash-grid">
        <UrgentReorderWidget rows={reorderItems} onQuickOrder={setQuickPo} />
        <StockCyclingWidget tagged={cyclingTagged} onOpenBand={setCyclingBand} />
        <DeliveryPipelineWidget
          orders={openOrders.slice(0, DISPATCH_LIMIT)}
          totalOpen={openOrders.length}
          stageCounts={stageCounts}
          delayedSkus={delayedSkus}
          onOpenSale={openSale}
          onOpenStage={openStage}
          onOpenCenter={() => openStage(OPEN_SALE_STATUSES)}
        />
      </div>
      <OrderCoveragePipelineWidget
        coverage={coverage}
        onOpenSegment={handleOpenSegment}
        onCheckAllocation={setAllocationProduct}
        onAdjustThreshold={setThresholdProduct}
      />

      {quickPo ? (
        <QuickPoDrawer row={quickPo} onClose={() => setQuickPo(null)} onConfirm={handleQuickPoConfirm} />
      ) : null}

      {cyclingBand ? (
        <CyclingModal
          band={cyclingBand}
          label={bandLabels[cyclingBand]}
          items={cyclingTagged[cyclingBand]}
          onClose={() => setCyclingBand(null)}
          onOpenProduct={(row) => {
            setCyclingBand(null);
            openProductHistory(row.product_id);
          }}
        />
      ) : null}

      {coverageSeg ? (
        <CoverageModal
          label={segLabels[coverageSeg]}
          items={coverageSegments[coverageSeg]}
          onClose={() => setCoverageSeg(null)}
          onOpenProduct={(row) => {
            setCoverageSeg(null);
            openProductHistory(row.product_id);
          }}
        />
      ) : null}

      {backorderOpen ? (
        <BackorderModal
          entries={backorderEntries}
          onClose={() => setBackorderOpen(false)}
          onOpenSale={(saleId) => {
            setBackorderOpen(false);
            openSale(saleId);
          }}
          onGeneratePo={handleGeneratePo}
        />
      ) : null}

      {allocationProduct ? (
        <AllocationModal
          product={allocationProduct}
          entries={allocationEntries}
          onClose={() => setAllocationProduct(null)}
          onOpenSale={(saleId) => {
            setAllocationProduct(null);
            openSale(saleId);
          }}
        />
      ) : null}

      {thresholdProduct ? (
        <ThresholdModal
          product={thresholdProduct}
          currentLevel={reorderLevelOf(thresholdProductRecord)}
          unit={thresholdProductRecord?.stockBaseUnit || thresholdProduct.unit || ""}
          onClose={() => setThresholdProduct(null)}
          onSave={handleAdjustThreshold}
        />
      ) : null}
    </div>
  );
}

export default Dashboard;
