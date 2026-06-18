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

  // Y-axis cap = the historical peak on-hand (so real sawtooth peaks never clip)
  // raised to a round value, never below the projected order-up-to.
  const histPeak = points.reduce((mx, p) => Math.max(mx, num(p.qty)), 0);
  const yMax = niceMax(Math.max(histPeak, orderUpTo, cur, rop) * 1.06);
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

        {/* x-axis diagonal dd/mm/yy ticks */}
        {xFracs.map((f, i) => {
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

      {cfg.hover ? <p className="saw-hint">{t("inventory.graph.hoverHint")}</p> : null}
    </div>
  );
}

export function ReorderProjectionFull(props) {
  return <ProjectionChart variant="full" {...props} />;
}

export function ReorderProjectionMini(props) {
  return <ProjectionChart variant="mini" {...props} />;
}
