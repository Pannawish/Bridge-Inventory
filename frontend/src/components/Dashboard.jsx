import { useMemo, useState } from "react";
import { formatNumber as formatLocaleNumber } from "../format";
import { useLanguage } from "../i18n/LanguageContext";
import { ReorderSawtoothMini } from "./charts/ReorderSawtooth";

// Stock-cycling frequency ladder. A product's average orders-per-year (derived
// from its order history) drops it into one of five bands, from "very fast"
// (reorders weekly+) down to "one-off" (a single lifetime order). Thresholds are
// in cycles/year so the bands read as a clean frequency ladder.
const CYCLE_BANDS = ["veryFast", "fast", "steady", "slow", "oneOff"];
const CYCLE_THRESHOLDS = { veryFast: 26, fast: 12, steady: 4 }; // cycles/year
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

// Procurement pipeline (mirror of the delivery pipeline, for purchase orders):
// the three open stages a PO moves through before it's fully received.
const CLOSED_PURCHASE_STATUSES = new Set(["received", "cancelled"]);
const PURCHASE_STATUS_TONE = {
  draft: "neutral",
  ordered: "accent",
  partially_received: "warning",
};
const PURCHASE_STAGES = [
  { key: "draft", statuses: ["draft"] },
  { key: "ordered", statuses: ["ordered"] },
  { key: "receiving", statuses: ["partially_received"] },
];
const OPEN_PURCHASE_STATUSES = PURCHASE_STAGES.flatMap((stage) => stage.statuses);
const PURCHASE_STAGE_BY_STATUS = PURCHASE_STAGES.reduce((map, stage) => {
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

function daysBetween(startIso, endIso) {
  if (!startIso || !endIso) return 0;
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

// Map an orders-per-year figure to a frequency band.
function bandForCyclesPerYear(cyclesPerYear) {
  if (cyclesPerYear >= CYCLE_THRESHOLDS.veryFast) return "veryFast";
  if (cyclesPerYear >= CYCLE_THRESHOLDS.fast) return "fast";
  if (cyclesPerYear >= CYCLE_THRESHOLDS.steady) return "steady";
  return "slow";
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
  // No measurable interval (all orders landed the same day) but multiple
  // cycles → treat as very fast, since it cycled repeatedly in ~no time.
  const klass = cyclesPerYear ? bandForCyclesPerYear(cyclesPerYear) : "veryFast";
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

  const bands = CYCLE_BANDS.map((klass) => ({
    klass,
    label: t(`dashboard.cycling.${klass}`),
    def: t(`dashboard.cycling.${klass}Def`),
  }));
  const total = CYCLE_BANDS.reduce((sum, klass) => sum + tagged[klass].length, 0);

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

// ── Zone 2 (grid) · Order planning (procurement pipeline) ──────────────
// Mirror of the delivery pipeline, for purchase orders: open POs grouped by
// stage; each stage and each PO deep-links into the filtered purchase history.
function OrderPlanningWidget({ orders, totalOpen, stageCounts, onOpenPurchase, onOpenStage, onOpenCenter }) {
  const { t } = useLanguage();

  return (
    <section className="dash-card dash-dispatch dash-ordering">
      <header className="dash-card-head">
        <div>
          <p className="dash-eyebrow">{t("dashboard.order.eyebrow")}</p>
          <h3>{t("dashboard.order.title")}</h3>
        </div>
      </header>

      <div className="dash-pipe" role="group" aria-label={t("dashboard.order.title")}>
        {PURCHASE_STAGES.map((stage, index) => (
          <div className="dash-pipe-slot" key={stage.key}>
            {index > 0 ? <span className="dash-pipe-arrow" aria-hidden="true">→</span> : null}
            <button
              type="button"
              className={`dash-pipe-stage pstage-${stage.key}${stageCounts[stage.key] > 0 ? " is-live" : ""}`}
              onClick={() => onOpenStage(stage.statuses)}
              disabled={stageCounts[stage.key] === 0}
              title={t("dashboard.order.openStage", { stage: t(`dashboard.order.stage.${stage.key}`) })}
            >
              <strong>{formatLocaleNumber(stageCounts[stage.key] || 0)}</strong>
              <span>{t(`dashboard.order.stage.${stage.key}`)}</span>
            </button>
          </div>
        ))}
      </div>

      {orders.length === 0 ? (
        <p className="dash-empty">{t("dashboard.order.empty")}</p>
      ) : (
        <ul className="dash-do-list">
          {orders.map((po) => {
            const tone = PURCHASE_STATUS_TONE[po.status] || "neutral";
            return (
              <li key={po.id}>
                <button
                  type="button"
                  className="dash-do-row"
                  onClick={() => onOpenPurchase(po.id)}
                  title={t("dashboard.order.openOrder")}
                >
                  <span className="dash-do-ref">{po.reference_no || po.id}</span>
                  <span className="dash-do-cust" title={po.supplier_name}>
                    {po.supplier_name || "—"}
                  </span>
                  <span className={`dash-status-chip tone-${tone}`}>
                    {t(`dashboard.order.status.${po.status}`)}
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
          {t("dashboard.order.actionCenter", { n: formatLocaleNumber(totalOpen) })} →
        </button>
      ) : null}
    </section>
  );
}

// ── Footer · Popular products ──────────────────────────────────────────
// Top sellers in a chosen window; clicking a product opens it in the Inventory
// page so the user can see why it ranks (the deep "why" view lives there).
function PopularProductsWidget({ coverage, onOpenProduct }) {
  const { t } = useLanguage();
  const windows = Array.isArray(coverage?.windows) ? coverage.windows : [];
  const [windowKey, setWindowKey] = useState(windows[0]?.key);
  const activeWindow = windows.some((w) => w.key === windowKey) ? windowKey : windows[0]?.key;
  const popular = coverage?.popular?.[activeWindow] || [];

  return (
    <section className="dash-card dash-popular">
      <header className="dash-card-head">
        <div>
          <p className="dash-eyebrow">{t("dashboard.popular.eyebrow")}</p>
          <h3>{t("dashboard.popular.title")}</h3>
        </div>
        <div className="dash-pop-windows" role="group" aria-label={t("dashboard.popular.title")}>
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
      </header>

      {popular.length === 0 ? (
        <p className="dash-pop-empty">{t("dashboard.popular.empty")}</p>
      ) : (
        <ul className="dash-pop-list">
          {popular.map((item, index) => (
            <li key={item.product_id || index}>
              <button
                type="button"
                className="dash-pop-row is-clickable"
                onClick={() => onOpenProduct(item)}
                title={t("dashboard.popular.open")}
              >
                <span className="dash-pop-rank">{index + 1}</span>
                <span className="dash-pop-name" title={item.product_name}>
                  {item.product_name || "—"}
                </span>
                <span className="dash-pop-metric">
                  {formatUnits(item.units)} {item.unit || ""}
                </span>
                <span className="dash-do-go" aria-hidden="true">→</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Drill-down modals ──────────────────────────────────────────────────
// Turn a raw orders-per-year figure into a friendly "every ~N days" headline
// plus a "≈N×/yr" sub, so the modal reads in plain language instead of "30×/yr".
function cycleFrequencyParts(t, band, cyclesPerYear) {
  if (band === "oneOff") {
    return { primary: t("dashboard.cycling.oneOffTag"), secondary: "" };
  }
  // Multiple orders with no measurable gap (all landed the same day) → faster
  // than "every day"; show a plain "very frequent" rather than a bogus interval.
  if (!cyclesPerYear) {
    return { primary: t("dashboard.cycling.frequent"), secondary: "" };
  }
  const perYear = Math.max(1, Math.round(cyclesPerYear));
  const intervalDays = Math.max(1, Math.round(365 / cyclesPerYear));
  return {
    primary: t("dashboard.cycling.everyDays", { n: formatLocaleNumber(intervalDays) }),
    secondary: t("dashboard.cycling.perYear", { n: formatLocaleNumber(perYear) }),
  };
}

function CyclingModal({ band, label, items, onClose, onOpenProduct }) {
  const { t } = useLanguage();
  return (
    <DashModal eyebrow={t("dashboard.cycling.eyebrow")} title={`${label} · ${items.length}`} onClose={onClose}>
      {items.length === 0 ? (
        <p className="dash-empty">{t("dashboard.cycling.empty")}</p>
      ) : (
        <ul className="dash-cycle-list">
          {items.map(({ row, cyclesPerYear }) => {
            const freq = cycleFrequencyParts(t, band, cyclesPerYear);
            const sold = num(row.sales_history_units);
            return (
              <li key={row.product_id}>
                <button
                  type="button"
                  className="dash-cycle-item is-clickable"
                  onClick={() => onOpenProduct(row)}
                  title={t("dashboard.cycling.investigate")}
                >
                  <span className={`dash-cycle-dot seg-${band}`} aria-hidden="true" />
                  <span className="dash-cycle-id">
                    <span className="dash-cycle-name">{row.product_name}</span>
                    <span className="dash-cycle-sub">
                      {row.sku ? `${row.sku} · ` : ""}
                      {t("dashboard.cycling.soldAllTime", { n: formatLocaleNumber(sold) })}
                    </span>
                  </span>
                  <span className="dash-cycle-freq">
                    <strong>{freq.primary}</strong>
                    {freq.secondary ? <span>{freq.secondary}</span> : null}
                  </span>
                  <span className="dash-cycle-go" aria-hidden="true">→</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </DashModal>
  );
}

function Dashboard({ dashboard, sales = [], purchases = [], onNavigate }) {
  const { t } = useLanguage();
  const [quickPo, setQuickPo] = useState(null);
  const [cyclingBand, setCyclingBand] = useState(null);

  const stockReport = useMemo(
    () => (Array.isArray(dashboard?.stock_report) ? dashboard.stock_report : []),
    [dashboard]
  );
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
    const tagged = { veryFast: [], fast: [], steady: [], slow: [], oneOff: [] };
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

  // Order planning: open purchase orders, oldest first, each deep-linkable.
  const openPurchases = useMemo(() => {
    return (Array.isArray(purchases) ? purchases : [])
      .filter((po) => po && !CLOSED_PURCHASE_STATUSES.has(po.status))
      .sort((a, b) => String(a.transaction_date || "").localeCompare(String(b.transaction_date || "")));
  }, [purchases]);

  const purchaseStageCounts = useMemo(() => {
    const counts = { draft: 0, ordered: 0, receiving: 0 };
    openPurchases.forEach((po) => {
      const stage = PURCHASE_STAGE_BY_STATUS[po.status];
      if (stage) counts[stage] += 1;
    });
    return counts;
  }, [openPurchases]);

  // ── deep-link / action helpers ──
  const orderProducts = (items, supplierName) =>
    onNavigate?.({ tab: "purchase-history", prefill: { supplier_name: supplierName || "", items } });
  const openProductInInventory = (productId) =>
    onNavigate?.({ tab: "inventory", focusProductId: productId });
  const openSale = (saleId) => onNavigate?.({ tab: "sales-history", focusId: saleId });
  const openStage = (statuses) => onNavigate?.({ tab: "sales-history", statusFilter: statuses });
  const openPurchase = (purchaseId) => onNavigate?.({ tab: "purchase-history", focusId: purchaseId });
  const openPurchaseStage = (statuses) =>
    onNavigate?.({ tab: "purchase-history", statusFilter: statuses });

  const handleQuickPoConfirm = ({ vendor, qty, price }) => {
    if (quickPo) {
      orderProducts([toPrefillItem(quickPo, qty, price === "" ? quickPo.unit_cost : price)], vendor);
    }
    setQuickPo(null);
  };

  const bandLabels = CYCLE_BANDS.reduce((map, klass) => {
    map[klass] = t(`dashboard.cycling.${klass}`);
    return map;
  }, {});

  return (
    <div className="dashboard-page">
      <div className="dash-grid">
        <UrgentReorderWidget rows={reorderItems} onQuickOrder={setQuickPo} />
        <OrderPlanningWidget
          orders={openPurchases.slice(0, DISPATCH_LIMIT)}
          totalOpen={openPurchases.length}
          stageCounts={purchaseStageCounts}
          onOpenPurchase={openPurchase}
          onOpenStage={openPurchaseStage}
          onOpenCenter={() => openPurchaseStage(OPEN_PURCHASE_STATUSES)}
        />
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

      <div className="dash-footer">
        <StockCyclingWidget tagged={cyclingTagged} onOpenBand={setCyclingBand} />
        <PopularProductsWidget
          coverage={coverage}
          onOpenProduct={(item) => openProductInInventory(item.product_id)}
        />
      </div>

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
            openProductInInventory(row.product_id);
          }}
        />
      ) : null}
    </div>
  );
}

export default Dashboard;
