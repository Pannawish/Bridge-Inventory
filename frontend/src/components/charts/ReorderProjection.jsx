import { useEffect, useRef, useState } from "react";
import { formatNumber } from "../../format";
import { useLanguage } from "../../i18n/LanguageContext";
import { startOfToday, toDate, daysBetween } from "../inventory/reorderHistory";

// Measure a container so the mini can render its SVG at the real pixel size and
// fill a fixed-height dashboard tile without distorting axis text.
function useSize(ref) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0].contentRect;
      setSize({ w: Math.round(cr.width), h: Math.round(cr.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

// ════════════════════════════════════════════════════════════════════════
// Reorder-point projection chart — "Today in the middle", dense 10×10 grid.
//   LEFT  = the product's REAL reconstructed stock-on-hand history.
//   RIGHT = the next action: project down at the window velocity, mark the
//           "Order by" date where it meets the reorder point, then a vertical
//           jump (+order qty) up to the order-up-to level.
// The canvas stays clean (lines + dot markers only); every number lives in the
// bottom-right data card. One renderer, two sizes (full / mini).
// ════════════════════════════════════════════════════════════════════════

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function addDays(base, offset) {
  const d = new Date(base.getTime());
  d.setDate(d.getDate() + Math.round(offset));
  return d;
}

// dd/mm/yy — compact, for the diagonal date axis.
function fmtDMY(date) {
  const d = toDate(date);
  if (!d) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

// Round a raw max up to a "nice" cap (1 / 2 / 2.5 / 5 × 10ⁿ) so the 10 quantity
// ticks land on readable values and the sawtooth peaks never clip the top.
function niceMax(raw) {
  const r = raw > 0 ? raw : 1;
  const pow = Math.pow(10, Math.floor(Math.log10(r)));
  const n = r / pow;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return nice * pow;
}

// Resolve the forward projection from today's figures + the chosen window's
// velocity. Reorder/safety/order-qty stay fixed; only the slope (velocity)
// changes with the timeframe.
export function buildProjection({ current, reorder, safety, velocity, leadTime, orderQty }) {
  const cur = Math.max(0, num(current));
  const rop = Math.max(0, num(reorder));
  let ss = Math.max(0, num(safety));
  if (rop > 0 && ss >= rop) ss = rop * 0.5;
  const demand = Math.max(0, num(velocity));
  const lead = Math.max(0, num(leadTime));
  const qty = num(orderQty) > 0 ? num(orderQty) : Math.max(rop - ss, rop, 1);
  const hasDemand = demand > 0;
  const dueNow = cur <= rop;

  const dReorder = hasDemand ? Math.max(0, (cur - rop) / demand) : 0;
  const dArrive = dReorder + lead;
  const levelAtArrive = hasDemand ? Math.max(0, cur - demand * dArrive) : cur;
  const orderUpTo = levelAtArrive + qty;
  const tailDays = hasDemand
    ? Math.min((orderUpTo - ss) / demand, Math.max(dArrive * 0.6, lead, 4))
    : 0;
  const futureDays = Math.max(hasDemand ? dArrive + tailDays : 1, 1);

  const verts = hasDemand
    ? [
        [0, cur],
        ...(cur > rop ? [[dReorder, rop]] : []),
        [dArrive, levelAtArrive],
        [dArrive, orderUpTo],
        [futureDays, Math.max(ss, orderUpTo - demand * tailDays)],
      ]
    : [
        [0, cur],
        [1, cur],
      ];

  return {
    cur, rop, ss, demand, lead, qty, hasDemand, dueNow,
    dReorder, dArrive, levelAtArrive, orderUpTo, futureDays, verts,
  };
}

const VARIANTS = {
  full: { W: 960, H: 430, m: { l: 58, r: 20, t: 24, b: 64 }, yDiv: 10, xLabelEvery: 1, hover: true },
  mini: { W: 640, H: 210, m: { l: 40, r: 14, t: 12, b: 40 }, yDiv: 5, xLabelEvery: 2, hover: false },
};

// Shared renderer. `variant` controls size, grid density, hover and the
// bottom-right data card.
function ProjectionChart({
  variant = "full",
  yMode = "peak",
  historyPoints = [],
  current,
  reorder,
  safety,
  velocity,
  leadTime,
  orderQty,
  unit = "",
  tone = "accent",
}) {
  const { t } = useLanguage();
  const cfg = VARIANTS[variant] || VARIANTS.full;
  const isMini = variant === "mini";
  const svgRef = useRef(null);
  const wrapRef = useRef(null);
  const measured = useSize(wrapRef);
  const [hover, setHover] = useState(null);
  const model = buildProjection({ current, reorder, safety, velocity, leadTime, orderQty });
  const fmt = (v) => formatNumber(Math.round(num(v)));

  // The mini fills its tile at the real pixel size (1:1 viewBox) so text stays
  // crisp; the full chart keeps a fixed viewBox and scales by width.
  const m = cfg.m;
  const W = isMini ? measured.w : cfg.W;
  const H = isMini ? measured.h : cfg.H;
  if (isMini && (W < 40 || H < 40)) {
    return <div ref={wrapRef} className="rp-chart rp-mini" />;
  }
  const innerW = W - m.l - m.r;
  const innerH = H - m.t - m.b;
  const plotBottom = m.t + innerH;
  const midX = m.l + innerW * 0.5;

  const { cur, rop, ss, orderUpTo, dReorder, dArrive, hasDemand, dueNow } = model;

  const today = startOfToday();
  const points = Array.isArray(historyPoints) ? historyPoints : [];
  const histStart = points.length ? toDate(points[0].date) : today;
  const spanDays = Math.max(1, daysBetween(histStart, today));

  // Y-axis cap. "peak" mode fits the historical peak on-hand (real sawtooth peaks
  // never clip). "zone" mode (the decision-zone inset) caps to the reorder band
  // instead, so reorder/safety stay clearly separated; stock above the cap clips
  // flat along the top (intended — the full pane above shows the real height).
  const histPeak = points.reduce((mx, p) => Math.max(mx, num(p.qty)), 0);
  const yMax =
    yMode === "zone"
      ? niceMax(Math.max(rop, ss, orderUpTo, 1) * 1.6)
      : niceMax(Math.max(histPeak, orderUpTo, cur, rop) * 1.06);
  const py = (v) => m.t + innerH - (clamp(v, 0, yMax) / yMax) * innerH;

  const pxPast = (dateStr) => m.l + (daysBetween(histStart, dateStr) / spanDays) * (midX - m.l);
  const pxFut = (day) => midX + (day / model.futureDays) * (m.l + innerW - midX);

  // Date at a horizontal fraction (0 = history start, 0.5 = today, 1 = horizon).
  const dateAtFrac = (frac) =>
    frac <= 0.5 ? addDays(histStart, spanDays * (frac / 0.5)) : addDays(today, model.futureDays * ((frac - 0.5) / 0.5));

  const pastPx = points.map((p) => ({ x: pxPast(p.date), y: py(p.qty), qty: num(p.qty), date: p.date }));
  const futPx = model.verts.map(([d, v]) => ({ x: pxFut(d), y: py(v), day: d, qty: v }));
  const pastLine = pastPx.map((p) => `${p.x},${p.y}`).join(" ");
  const futLine = futPx.map((p) => `${p.x},${p.y}`).join(" ");

  const ssY = py(ss);
  const ropY = py(rop);
  const curY = py(cur);
  const peakY = py(orderUpTo);

  // 10 (or 5) horizontal gridlines + quantity ticks, evenly spaced 0…yMax.
  const yTicks = Array.from({ length: cfg.yDiv + 1 }, (_, i) => (yMax * i) / cfg.yDiv);
  // 10 vertical gridlines; today lands exactly on the centre line.
  const xFracs = Array.from({ length: 11 }, (_, i) => i / 10);

  // Projected stock at an x-pixel — history (left) walks real points, projection
  // (right) walks the future verts. Drives the hover crosshair.
  function readAt(xPix) {
    if (xPix <= midX && pastPx.length) {
      for (let i = 0; i < pastPx.length - 1; i += 1) {
        const a = pastPx[i];
        const b = pastPx[i + 1];
        if (xPix >= a.x && xPix <= b.x && b.x !== a.x) {
          const f = (xPix - a.x) / (b.x - a.x);
          return { qty: a.qty + f * (b.qty - a.qty), date: dateAtFrac((xPix - m.l) / innerW), future: false };
        }
      }
      return { qty: pastPx[0].qty, date: histStart, future: false };
    }
    for (let i = 0; i < futPx.length - 1; i += 1) {
      const a = futPx[i];
      const b = futPx[i + 1];
      if (xPix >= a.x && xPix <= b.x && b.x !== a.x) {
        const f = (xPix - a.x) / (b.x - a.x);
        const day = a.day + f * (b.day - a.day);
        return { qty: a.qty + f * (b.qty - a.qty), date: addDays(today, day), future: true, day };
      }
    }
    const last = futPx[futPx.length - 1];
    return { qty: last.qty, date: addDays(today, last.day), future: true, day: last.day };
  }

  function handleMove(event) {
    const svg = svgRef.current;
    if (!svg || typeof svg.getScreenCTM !== "function") return;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const loc = pt.matrixTransform(ctm.inverse());
    const xC = clamp(loc.x, m.l, m.l + innerW);
    const read = readAt(xC);
    const rect = svg.getBoundingClientRect();
    setHover({
      xC,
      yPx: py(read.qty),
      value: read.qty,
      date: read.date,
      future: read.future,
      day: read.day,
      leftPx: event.clientX - rect.left,
      topPx: event.clientY - rect.top,
      flip: event.clientX - rect.left > rect.width * 0.6,
    });
  }

  const hoverStatus = hover
    ? hover.value <= ss
      ? "safety"
      : hover.value <= rop
      ? "reorder"
      : "healthy"
    : null;
  const hoverStatusLabel =
    hoverStatus === "safety"
      ? t("inventory.graph.statusSafety")
      : hoverStatus === "reorder"
      ? t("inventory.graph.statusReorder")
      : t("inventory.graph.statusHealthy");

  return (
    <div ref={wrapRef} className={`rp-chart rp-${variant}`}>
      <svg
        ref={svgRef}
        className={`saw rp-svg${cfg.hover ? " is-interactive" : ""}`}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio={isMini ? "none" : "xMidYMid meet"}
        role="img"
        aria-label={t("inventory.graph.title")}
        onMouseMove={cfg.hover ? handleMove : undefined}
        onMouseLeave={cfg.hover ? () => setHover(null) : undefined}
      >
        {/* future (projection) region tint */}
        <rect className="rp-future-band" x={midX} y={m.t} width={Math.max(0, m.l + innerW - midX)} height={innerH} />

        {/* 10×N grid */}
        {yTicks.map((v, i) => (
          <line key={`gy${i}`} className="rp-grid" x1={m.l} y1={py(v)} x2={m.l + innerW} y2={py(v)} />
        ))}
        {xFracs.map((f, i) => (
          <line key={`gx${i}`} className="rp-grid" x1={m.l + f * innerW} y1={m.t} x2={m.l + f * innerW} y2={plotBottom} />
        ))}

        {/* safety-stock zone */}
        {ss > 0 ? (
          <rect className="saw-ss-band" x={m.l} y={ssY} width={innerW} height={Math.max(0, plotBottom - ssY)} />
        ) : null}

        {/* axes */}
        <line className="saw-axis" x1={m.l} y1={m.t} x2={m.l} y2={plotBottom} />
        <line className="saw-axis" x1={m.l} y1={plotBottom} x2={m.l + innerW} y2={plotBottom} />

        {/* threshold reference lines — clean, no inline numbers */}
        <line className="saw-peak" x1={m.l} y1={peakY} x2={m.l + innerW} y2={peakY} />
        {rop > 0 ? <line className="saw-rop" x1={m.l} y1={ropY} x2={m.l + innerW} y2={ropY} /> : null}
        {ss > 0 ? <line className="saw-ss" x1={m.l} y1={ssY} x2={m.l + innerW} y2={ssY} /> : null}

        {/* real history (solid) + projection (dashed) */}
        {pastPx.length > 1 ? <polyline className={`saw-line tone-${tone}`} points={pastLine} /> : null}
        {hasDemand ? <polyline className={`rp-proj tone-${tone}`} points={futLine} /> : null}

        {/* Today centre divider */}
        <line className="rp-today" x1={midX} y1={m.t} x2={midX} y2={plotBottom} />

        {/* dot markers (no attached numbers) */}
        {hasDemand && !dueNow && dReorder > 0.3 ? (
          <circle className="rp-mark is-order" cx={pxFut(dReorder)} cy={ropY} r={variant === "mini" ? 3 : 4.5} />
        ) : null}
        {hasDemand ? (
          <circle className="rp-mark is-restock" cx={pxFut(dArrive)} cy={peakY} r={variant === "mini" ? 3 : 4.5} />
        ) : null}
        <circle className={`rp-mark is-now tone-${tone}`} cx={midX} cy={curY} r={variant === "mini" ? 3.2 : 5} />

        {/* y-axis quantity ticks */}
        {yTicks.map((v, i) => (
          <text key={`ty${i}`} className="rp-yt" x={m.l - 7} y={py(v) + 3}>
            {fmt(v)}
          </text>
        ))}

        {/* x-axis diagonal dd/mm/yy ticks (suppressed on the inset — the full
            pane above already carries them on the shared x-scale) */}
        {(cfg.hideXLabels ? [] : xFracs).map((f, i) => {
          const isToday = Math.abs(f - 0.5) < 1e-6;
          if (i % cfg.xLabelEvery !== 0 && !isToday) return null;
          const x = m.l + f * innerW;
          return (
            <text
              key={`tx${i}`}
              className={`rp-xt${isToday ? " is-today" : ""}`}
              x={x}
              y={plotBottom + 11}
              transform={`rotate(-34 ${x} ${plotBottom + 11})`}
            >
              {isToday ? t("inventory.graph.today") : fmtDMY(dateAtFrac(f))}
            </text>
          );
        })}

        {/* hover crosshair */}
        {hover ? (
          <g className="saw-cross">
            <line x1={hover.xC} y1={m.t} x2={hover.xC} y2={plotBottom} />
            <line x1={m.l} y1={hover.yPx} x2={m.l + innerW} y2={hover.yPx} />
            <circle className={`saw-cross-dot is-${hoverStatus}`} cx={hover.xC} cy={hover.yPx} r="5" />
          </g>
        ) : null}
      </svg>

      {hover ? (
        <div
          className={`saw-tip${hover.flip ? " flip" : ""}`}
          style={{ left: `${hover.leftPx}px`, top: `${hover.topPx}px` }}
        >
          <span className="saw-tip-date">{fmtDMY(hover.date)}</span>
          <span className="saw-tip-qty">
            {fmt(hover.value)} {unit}
          </span>
          <span className="saw-tip-sub">
            {hover.future
              ? t("inventory.graph.daysFromNow", { n: Math.max(0, Math.round(hover.day || 0)) })
              : t("inventory.graph.projected")}
          </span>
          <span className={`saw-tip-status is-${hoverStatus}`}>{hoverStatusLabel}</span>
        </div>
      ) : null}

      {cfg.hover && variant === "full" ? <p className="saw-hint">{t("inventory.graph.hoverHint")}</p> : null}
    </div>
  );
}

export function ReorderProjectionMini(props) {
  return <ProjectionChart variant="mini" {...props} />;
}

// ════════════════════════════════════════════════════════════════════════
// Interactive "terminal" chart for the inventory detail modal.
//   • Single CONTINUOUS time axis (past history + future projection share it);
//     "Today" is a divider line wherever it falls, not a forced centre.
//   • Mouse-wheel zooms around the cursor; click-drag pans; the Y-axis
//     auto-fits the visible stock range (precision viewport).
//   • Crosshair reads exact date/qty; double-click resets the view.
// The viewport is CONTROLLED by the parent so the calc cards below can recompute
// from the same visible range. Lines/markers are clipped to the plot, so panning
// past the data edges is graceful.
// ════════════════════════════════════════════════════════════════════════

const MS_DAY = 86_400_000;

function toMs(value) {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
  const d = toDate(value);
  return d ? d.getTime() : null;
}

// Pick a readable x-tick spacing (in days) for the visible span so the date
// axis declutters as you zoom out — the only "level of detail" that's
// meaningful for sparse inventory data (tick density, not data bucketing).
function pickStepDays(spanDays) {
  const steps = [1, 2, 3, 7, 14, 30, 60, 120, 182, 365];
  for (const s of steps) if (spanDays / s <= 9) return s;
  return 730;
}

export function ReorderViewportChart({
  historyPoints = [],
  model,
  viewport,
  bounds,
  onViewportChange,
  onReset,
  unit = "",
  tone = "accent",
}) {
  const { t } = useLanguage();
  const W = 960;
  const H = 430;
  const m = { l: 60, r: 20, t: 24, b: 56 };
  const innerW = W - m.l - m.r;
  const innerH = H - m.t - m.b;
  const plotBottom = m.t + innerH;

  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const [hover, setHover] = useState(null);
  const [dragging, setDragging] = useState(false);

  const today = startOfToday();
  const todayMs = today.getTime();
  const fmt = (v) => formatNumber(Math.round(num(v)));

  const mdl = model || {};
  const rop = Math.max(0, num(mdl.rop));
  const ss = Math.max(0, num(mdl.ss));
  const cur = Math.max(0, num(mdl.cur));
  const orderUpTo = Math.max(0, num(mdl.orderUpTo));

  // Merge real history (≤ today) and projection verts (≥ today) onto one axis.
  const hist = (Array.isArray(historyPoints) ? historyPoints : [])
    .map((p) => ({ t: toMs(p.date), q: num(p.qty) }))
    .filter((p) => Number.isFinite(p.t))
    .sort((a, b) => a.t - b.t);
  const proj = mdl.hasDemand && Array.isArray(mdl.verts)
    ? mdl.verts.map(([d, q]) => ({ t: todayMs + d * MS_DAY, q: num(q) }))
    : [];
  const series = [...hist, ...proj].sort((a, b) => a.t - b.t);

  const dataMinT = series.length ? series[0].t : todayMs - 90 * MS_DAY;
  const dataMaxT = series.length ? series[series.length - 1].t : todayMs + 14 * MS_DAY;
  const totalSpan = Math.max(MS_DAY, dataMaxT - dataMinT);

  // Hard pan/zoom limits supplied by the parent so the visible window matches the
  // selected timeframe button: LEFT = the start of the chosen range (no scrolling
  // back into older history than the button implies), RIGHT = the end of the
  // reorder-point projection (no scrolling past it into an empty future, which
  // would drop the projection line off-screen). Falls back to the data extent.
  const boundLo = toMs(bounds?.min);
  const boundHi = toMs(bounds?.max);
  const hasBounds = Number.isFinite(boundLo) && Number.isFinite(boundHi) && boundHi > boundLo;
  const minSpan = 2 * MS_DAY;
  // Cap zoom-out at the allowed window so you can never see beyond the bounds.
  const maxSpan = hasBounds ? boundHi - boundLo : totalSpan * 1.6 + 8 * MS_DAY;

  // Controlled viewport (fall back to a sensible default if missing).
  const t0 = toMs(viewport?.from) ?? todayMs - 90 * MS_DAY;
  const t1 = Math.max(t0 + minSpan, toMs(viewport?.to) ?? todayMs + 14 * MS_DAY);
  const span = t1 - t0;

  // Latest committed viewport, synced to the controlled props each render. Wheel
  // handlers read/mutate this synchronously so rapid ticks compound instead of
  // all computing from the same pre-render span (which feels sluggish).
  const liveRef = useRef({ t0, t1 });
  liveRef.current = { t0, t1 };

  const pxX = (tm) => m.l + ((tm - t0) / span) * innerW;
  const invX = (px) => t0 + ((px - m.l) / innerW) * span;

  // Stock level at any time (linear interp over the merged series) — drives the
  // crosshair AND the auto-Y fit at the viewport edges.
  function qAt(tm) {
    if (!series.length) return 0;
    if (tm <= series[0].t) return series[0].q;
    if (tm >= series[series.length - 1].t) return series[series.length - 1].q;
    for (let i = 0; i < series.length - 1; i += 1) {
      const a = series[i];
      const b = series[i + 1];
      if (tm >= a.t && tm <= b.t) {
        if (b.t === a.t) return b.q;
        return a.q + ((tm - a.t) / (b.t - a.t)) * (b.q - a.q);
      }
    }
    return series[series.length - 1].q;
  }

  // Auto-Y: fit the visible stock (points inside the window + the interpolated
  // level at each edge), so zooming into a low-stock dip rescales to that range.
  const visible = series.filter((p) => p.t >= t0 && p.t <= t1);
  const fitQs = visible.map((p) => p.q);
  fitQs.push(qAt(t0), qAt(t1));
  let qLo = Math.min(...fitQs);
  let qHi = Math.max(...fitQs);
  if (!Number.isFinite(qLo) || !Number.isFinite(qHi)) {
    qLo = 0;
    qHi = Math.max(1, rop || 1);
  }
  const pad = Math.max((qHi - qLo) * 0.12, qHi * 0.04, 1);
  const yMin = Math.max(0, qLo - pad);
  const yMax = qHi + pad > yMin ? qHi + pad : yMin + 1;

  const pyY = (q) => m.t + innerH - ((clamp(q, yMin, yMax) - yMin) / (yMax - yMin)) * innerH;
  const inX = (tm) => tm >= t0 && tm <= t1;
  const inY = (q) => q >= yMin && q <= yMax;

  // Axis ticks.
  const stepDays = pickStepDays(span / MS_DAY);
  const stepMs = stepDays * MS_DAY;
  const kStart = Math.ceil((t0 - todayMs) / stepMs);
  const kEnd = Math.floor((t1 - todayMs) / stepMs);
  const xTicks = [];
  for (let k = kStart; k <= kEnd && xTicks.length < 16; k += 1) xTicks.push(todayMs + k * stepMs);
  const yCount = 6;
  const yTicks = Array.from({ length: yCount + 1 }, (_, i) => yMin + ((yMax - yMin) * i) / yCount);

  // Polylines (clipped by the plot clipPath).
  const histLine = hist.map((p) => `${pxX(p.t)},${pyY(p.q)}`).join(" ");
  const projLine = proj.map((p) => `${pxX(p.t)},${pyY(p.q)}`).join(" ");

  const todayX = pxX(todayMs);
  const futureX = clamp(todayX, m.l, m.l + innerW);

  // Lead-time band: the in-transit window between placing the order (the reorder
  // crossing, or today if a reorder is already due) and the stock arriving.
  const leadStartT = todayMs + num(mdl.dReorder) * MS_DAY;
  const leadEndT = todayMs + num(mdl.dArrive) * MS_DAY;
  const showLead = mdl.hasDemand && num(mdl.lead) > 0 && leadEndT > t0 && leadStartT < t1;
  const leadX0 = clamp(pxX(leadStartT), m.l, m.l + innerW);
  const leadX1 = clamp(pxX(leadEndT), m.l, m.l + innerW);

  // ── Pointer → SVG coordinate (viewBox is scaled, so go through the CTM) ──
  function svgPoint(evt) {
    const svg = svgRef.current;
    if (!svg || typeof svg.getScreenCTM !== "function") return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    return pt.matrixTransform(ctm.inverse());
  }

  function commit(nT0, nT1) {
    const s = clamp(nT1 - nT0, minSpan, maxSpan);
    const mid = (nT0 + nT1) / 2;
    let a = nT1 - nT0 === s ? nT0 : mid - s / 2;
    let b = a + s;
    const lo = hasBounds ? boundLo : dataMinT - totalSpan * 0.6;
    const hi = hasBounds ? boundHi : dataMaxT + totalSpan * 0.6;
    if (a < lo) { b += lo - a; a = lo; }
    if (b > hi) { a -= b - hi; b = hi; }
    liveRef.current = { t0: a, t1: b }; // sync before the (async) re-render
    if (onViewportChange) onViewportChange(a, b);
  }

  function onPointerDown(evt) {
    const loc = svgPoint(evt);
    if (!loc) return;
    dragRef.current = { startX: loc.x, t0, t1, moved: false };
    setDragging(true);
    setHover(null);
    if (svgRef.current?.setPointerCapture) {
      try { svgRef.current.setPointerCapture(evt.pointerId); } catch { /* ignore */ }
    }
  }

  function onPointerMove(evt) {
    const loc = svgPoint(evt);
    if (!loc) return;
    if (dragRef.current) {
      const d = dragRef.current;
      const dpx = loc.x - d.startX;
      if (Math.abs(dpx) > 1) d.moved = true;
      const dt = -(dpx / innerW) * (d.t1 - d.t0);
      commit(d.t0 + dt, d.t1 + dt);
      return;
    }
    const xC = clamp(loc.x, m.l, m.l + innerW);
    const tm = invX(xC);
    const q = qAt(tm);
    const rect = svgRef.current.getBoundingClientRect();
    setHover({
      xC,
      yPx: pyY(q),
      value: q,
      tm,
      future: tm > todayMs,
      leftPx: evt.clientX - rect.left,
      topPx: evt.clientY - rect.top,
      flip: evt.clientX - rect.left > rect.width * 0.6,
    });
  }

  function endDrag() {
    dragRef.current = null;
    setDragging(false);
  }

  // Zoom around a fixed time point, keeping it under the same x-pixel.
  function zoomAround(centerT, factor) {
    const cur0 = liveRef.current.t0;
    const curSpan = liveRef.current.t1 - cur0;
    const newSpan = clamp(curSpan * factor, minSpan, maxSpan);
    const frac = (centerT - cur0) / curSpan;
    const nT0 = centerT - frac * newSpan;
    commit(nT0, nT0 + newSpan);
  }
  const zoomInBtn = () => zoomAround((liveRef.current.t0 + liveRef.current.t1) / 2, 0.6);
  const zoomOutBtn = () => zoomAround((liveRef.current.t0 + liveRef.current.t1) / 2, 1 / 0.6);

  // Native wheel listener (React's onWheel is passive — can't preventDefault).
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;
    function onWheel(evt) {
      evt.preventDefault();
      const loc = svgPoint(evt);
      if (!loc) return;
      // Read the LIVE viewport (compounds across rapid ticks before re-render).
      const cur0 = liveRef.current.t0;
      const curSpan = liveRef.current.t1 - cur0;
      const xC = clamp(loc.x, m.l, m.l + innerW);
      const tc = cur0 + ((xC - m.l) / innerW) * curSpan;
      // Smooth, proportional zoom: scale by the actual scroll amount (normalised
      // across mouse/trackpad/line-mode) instead of a fixed per-tick step, so it
      // glides rather than jumping.
      let d = evt.deltaY;
      if (evt.deltaMode === 1) d *= 16;
      else if (evt.deltaMode === 2) d *= innerH;
      const factor = clamp(Math.exp(d * 0.0015), 0.5, 2);
      const newSpan = clamp(curSpan * factor, minSpan, maxSpan);
      const frac = (tc - cur0) / curSpan;
      const nT0 = tc - frac * newSpan;
      commit(nT0, nT0 + newSpan);
    }
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  });

  const hoverStatus = hover
    ? hover.value <= ss
      ? "safety"
      : hover.value <= rop
      ? "reorder"
      : "healthy"
    : null;
  const hoverStatusLabel =
    hoverStatus === "safety"
      ? t("inventory.graph.statusSafety")
      : hoverStatus === "reorder"
      ? t("inventory.graph.statusReorder")
      : t("inventory.graph.statusHealthy");

  const clipId = "rp-vp-clip";

  return (
    <div className="rp-chart rp-viewport">
      <div className="rp-vp-controls">
        <button type="button" className="rp-vp-btn" onClick={zoomInBtn} aria-label={t("inventory.graph.zoomIn")} title={t("inventory.graph.zoomIn")}>+</button>
        <button type="button" className="rp-vp-btn" onClick={zoomOutBtn} aria-label={t("inventory.graph.zoomOut")} title={t("inventory.graph.zoomOut")}>−</button>
        <button type="button" className="rp-vp-btn" onClick={() => onReset && onReset()} aria-label={t("inventory.graph.resetView")} title={t("inventory.graph.resetView")}>⤢</button>
      </div>
      <svg
        ref={svgRef}
        className={`saw rp-svg rp-vp-svg${dragging ? " is-dragging" : ""}`}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={t("inventory.graph.title")}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={() => { endDrag(); setHover(null); }}
        onDoubleClick={() => onReset && onReset()}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={m.l} y={m.t} width={innerW} height={innerH} />
          </clipPath>
        </defs>

        {/* future (projection) region tint */}
        {todayMs < t1 ? (
          <rect className="rp-future-band" x={futureX} y={m.t} width={Math.max(0, m.l + innerW - futureX)} height={innerH} />
        ) : null}

        {/* grid */}
        {yTicks.map((v, i) => (
          <line key={`gy${i}`} className="rp-grid" x1={m.l} y1={pyY(v)} x2={m.l + innerW} y2={pyY(v)} />
        ))}
        {xTicks.map((tm, i) => (
          <line key={`gx${i}`} className="rp-grid" x1={pxX(tm)} y1={m.t} x2={pxX(tm)} y2={plotBottom} />
        ))}

        {/* safety-stock danger zone (area below the safety line) */}
        {ss > 0 && ss >= yMin ? (
          <rect
            className="saw-ss-band"
            x={m.l}
            y={pyY(Math.min(ss, yMax))}
            width={innerW}
            height={Math.max(0, plotBottom - pyY(Math.min(ss, yMax)))}
          />
        ) : null}

        {/* lead-time band (order placed → stock arrives) + label */}
        {showLead && leadX1 - leadX0 > 2 ? (
          <g className="rp-lead">
            <rect className="rp-lead-band" x={leadX0} y={m.t} width={leadX1 - leadX0} height={innerH} />
            <text className="rp-lead-label" x={(leadX0 + leadX1) / 2} y={m.t + 12}>
              {t("inventory.graph.leadGap", { n: Math.round(num(mdl.lead)) })}
            </text>
          </g>
        ) : null}

        {/* axes */}
        <line className="saw-axis" x1={m.l} y1={m.t} x2={m.l} y2={plotBottom} />
        <line className="saw-axis" x1={m.l} y1={plotBottom} x2={m.l + innerW} y2={plotBottom} />

        {/* threshold reference lines + right-edge labels colour-matched to the
            calculation cards below (green=restock, amber=reorder, red=safety) */}
        {orderUpTo > 0 && inY(orderUpTo) ? (
          <>
            <line className="saw-peak rp-vp-peak" x1={m.l} y1={pyY(orderUpTo)} x2={m.l + innerW} y2={pyY(orderUpTo)} />
            <text className="rp-lab rp-lab-peak" x={m.l + 6} y={pyY(orderUpTo) - 5}>
              {t("inventory.graph.lineRestock")}
            </text>
          </>
        ) : null}
        {rop > 0 && inY(rop) ? (
          <>
            <line className="saw-rop" x1={m.l} y1={pyY(rop)} x2={m.l + innerW} y2={pyY(rop)} />
            <text className="rp-lab rp-lab-rop" x={m.l + 6} y={pyY(rop) - 5}>
              {t("inventory.graph.lineReorder")}
            </text>
          </>
        ) : null}
        {ss > 0 && inY(ss) ? (
          <>
            <line className="saw-ss" x1={m.l} y1={pyY(ss)} x2={m.l + innerW} y2={pyY(ss)} />
            <text className="rp-lab rp-lab-ss" x={m.l + 6} y={pyY(ss) - 5}>
              {t("inventory.graph.lineSafety")}
            </text>
          </>
        ) : null}

        {/* lines + markers, clipped to the plot */}
        <g clipPath={`url(#${clipId})`}>
          {hist.length > 1 ? <polyline className={`saw-line tone-${tone}`} points={histLine} /> : null}
          {proj.length > 1 ? <polyline className={`rp-proj tone-${tone}`} points={projLine} /> : null}

          {mdl.hasDemand && !mdl.dueNow && inX(todayMs + num(mdl.dReorder) * MS_DAY) && inY(rop) ? (
            <circle className="rp-mark is-order" cx={pxX(todayMs + num(mdl.dReorder) * MS_DAY)} cy={pyY(rop)} r={4.5} />
          ) : null}
          {mdl.hasDemand && inX(todayMs + num(mdl.dArrive) * MS_DAY) && inY(orderUpTo) ? (
            <circle className="rp-mark is-restock rp-vp-restock" cx={pxX(todayMs + num(mdl.dArrive) * MS_DAY)} cy={pyY(orderUpTo)} r={4.5} />
          ) : null}
          {inX(todayMs) && inY(cur) ? (
            <circle className={`rp-mark is-now tone-${tone}`} cx={todayX} cy={pyY(cur)} r={5} />
          ) : null}
        </g>

        {/* Today divider */}
        {inX(todayMs) ? <line className="rp-today" x1={todayX} y1={m.t} x2={todayX} y2={plotBottom} /> : null}

        {/* y-axis ticks */}
        {yTicks.map((v, i) => (
          <text key={`ty${i}`} className="rp-yt" x={m.l - 7} y={pyY(v) + 3}>
            {fmt(v)}
          </text>
        ))}

        {/* x-axis diagonal dd/mm/yy ticks (the bold "Today" mark below covers the
            tick nearest today, so skip a normal label there to avoid overlap) */}
        {xTicks.map((tm, i) => {
          if (Math.abs(tm - todayMs) < stepMs * 0.4) return null;
          const x = pxX(tm);
          return (
            <text
              key={`tx${i}`}
              className="rp-xt"
              x={x}
              y={plotBottom + 11}
              transform={`rotate(-34 ${x} ${plotBottom + 11})`}
            >
              {fmtDMY(new Date(tm))}
            </text>
          );
        })}
        {inX(todayMs) ? (
          <text
            className="rp-xt is-today"
            x={todayX}
            y={plotBottom + 11}
            transform={`rotate(-34 ${todayX} ${plotBottom + 11})`}
          >
            {t("inventory.graph.today")}
          </text>
        ) : null}

        {/* crosshair */}
        {hover ? (
          <g className="saw-cross">
            <line x1={hover.xC} y1={m.t} x2={hover.xC} y2={plotBottom} />
            <line x1={m.l} y1={hover.yPx} x2={m.l + innerW} y2={hover.yPx} />
            <circle className={`saw-cross-dot is-${hoverStatus}`} cx={hover.xC} cy={hover.yPx} r="5" />
          </g>
        ) : null}
      </svg>

      {hover ? (
        <div
          className={`saw-tip${hover.flip ? " flip" : ""}`}
          style={{ left: `${hover.leftPx}px`, top: `${hover.topPx}px` }}
        >
          <span className="saw-tip-date">{fmtDMY(new Date(hover.tm))}</span>
          <span className="saw-tip-qty">
            {fmt(hover.value)} {unit}
          </span>
          <span className="saw-tip-sub">
            {hover.future ? t("inventory.graph.projected") : t("inventory.graph.recorded")}
          </span>
          <span className={`saw-tip-status is-${hoverStatus}`}>{hoverStatusLabel}</span>
        </div>
      ) : null}

      <p className="saw-hint rp-vp-hint">{t("inventory.graph.viewportHint")}</p>
    </div>
  );
}
