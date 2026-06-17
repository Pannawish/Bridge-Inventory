import { useRef, useState } from "react";
import { formatNumber } from "../../format";
import { useLanguage } from "../../i18n/LanguageContext";
import {
  startOfToday,
  toDate,
  daysBetween,
} from "../inventory/reorderHistory";

// ════════════════════════════════════════════════════════════════════════
// Reorder-point projection charts — "Today in the middle".
//   LEFT  = the product's REAL reconstructed stock-on-hand history.
//   RIGHT = the next action: project down at the window velocity, mark the
//           "Order by" date where it meets the reorder point, then a vertical
//           jump (+order qty) up to the order-up-to level.
// Two renderers share one model:
//   • ReorderProjectionMini — dashboard tile (last ≤3 cycles, no axes/hover)
//   • ReorderProjectionFull — inventory detail (dated axes + hover crosshair)
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

// Resolve the forward projection from today's figures + the chosen window's
// velocity. The reorder/safety/order-qty come from the row and stay fixed; only
// the SLOPE (velocity) changes with the timeframe.
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
        // reorder waypoint only while we're still above it (skip the odd upward
        // step when stock is already due to order)
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

function yMaxFor(model, historyPoints) {
  const histPeak = (historyPoints || []).reduce((mx, p) => Math.max(mx, num(p.qty)), 0);
  return Math.max(model.orderUpTo, model.cur, model.rop / 0.85, histPeak * 1.08, 1);
}

// ── Mini (dashboard tile) ─────────────────────────────────────────────────
// Minimal version: real history on the left half, the next-action jump on the
// right, a centred Today divider, and the reorder/safety reference lines. No
// axes, no hover — just the shape + the two value tags.
export function ReorderProjectionMini({
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
  const model = buildProjection({ current, reorder, safety, velocity, leadTime, orderQty });
  const fmt = (v) => formatNumber(Math.round(num(v)));

  const W = 300;
  const H = 96;
  const m = { l: 6, r: 30, t: 12, b: 16 };
  const innerW = W - m.l - m.r;
  const innerH = H - m.t - m.b;
  const plotBottom = m.t + innerH;
  const midX = m.l + innerW * 0.5;

  const yMax = yMaxFor(model, historyPoints);
  const py = (v) => m.t + innerH - (clamp(v, 0, yMax) / yMax) * innerH;

  const today = startOfToday();
  const points = Array.isArray(historyPoints) ? historyPoints : [];
  const histStart = points.length ? toDate(points[0].date) : today;
  const spanDays = Math.max(1, daysBetween(histStart, today));
  const pxPast = (dateStr) => m.l + (daysBetween(histStart, dateStr) / spanDays) * (midX - m.l);
  const pxFut = (day) => midX + (day / model.futureDays) * (m.l + innerW - midX);

  const pastLine = points.map((p) => `${pxPast(p.date)},${py(p.qty)}`).join(" ");
  const futLine = model.verts.map(([d, v]) => `${pxFut(d)},${py(v)}`).join(" ");

  const ssY = py(model.ss);
  const ropY = py(model.rop);
  const curY = py(model.cur);
  const topPct = (yPx) => `${clamp((yPx / H) * 100, 7, 93)}%`;

  const dueLabel = model.dueNow
    ? t("inventory.graph.orderNow")
    : t("inventory.graph.orderBy");

  return (
    <div className="rp-mini-wrap">
      <svg className="rp-mini" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        {model.ss > 0 ? (
          <rect className="saw-ss-band" x={m.l} y={ssY} width={innerW} height={Math.max(0, plotBottom - ssY)} />
        ) : null}
        {model.rop > 0 ? <line className="saw-rop" x1={m.l} y1={ropY} x2={m.l + innerW} y2={ropY} /> : null}
        {model.ss > 0 ? <line className="saw-ss" x1={m.l} y1={ssY} x2={m.l + innerW} y2={ssY} /> : null}

        {/* Today divider */}
        <line className="rp-today" x1={midX} y1={m.t} x2={midX} y2={plotBottom} />

        {/* real history (solid) + projection (dashed) */}
        {points.length > 1 ? (
          <polyline className={`saw-line tone-${tone}`} points={pastLine} vectorEffect="non-scaling-stroke" />
        ) : null}
        {model.hasDemand ? (
          <polyline className={`rp-proj tone-${tone}`} points={futLine} vectorEffect="non-scaling-stroke" />
        ) : null}

        {/* order-by crossing + current dot (at Today, the centre) */}
        {model.hasDemand && !model.dueNow ? (
          <circle className="rp-orderby-dot" cx={pxFut(model.dReorder)} cy={ropY} r="3.2" />
        ) : null}
        <circle className={`saw-now tone-${tone}`} cx={midX} cy={curY} r="2.6" vectorEffect="non-scaling-stroke" />
      </svg>

      <span className={`saw-tag is-now tone-${tone}`} style={{ top: topPct(curY) }}>
        {fmt(model.cur)} {unit}
      </span>
      {model.rop > 0 ? (
        <span className="saw-tag is-rop" style={{ top: topPct(ropY) }}>{fmt(model.rop)}</span>
      ) : null}
      {model.ss > 0 ? (
        <span className="saw-tag is-ss" style={{ top: topPct(ssY) }}>{fmt(model.ss)}</span>
      ) : null}
      {model.hasDemand ? (
        <span className={`saw-date${model.dueNow ? " is-now" : ""}`}>{dueLabel}</span>
      ) : null}
    </div>
  );
}

// ── Full (inventory detail) — dated axes + hover crosshair ────────────────
export function ReorderProjectionFull({
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
  const svgRef = useRef(null);
  const [hover, setHover] = useState(null);
  const model = buildProjection({ current, reorder, safety, velocity, leadTime, orderQty });
  const fmt = (v) => formatNumber(Math.round(num(v)));

  const W = 920;
  const H = 380;
  const m = { l: 58, r: 120, t: 34, b: 78 };
  const innerW = W - m.l - m.r;
  const innerH = H - m.t - m.b;
  const plotBottom = m.t + innerH;
  const midX = m.l + innerW * 0.5;

  const yMax = yMaxFor(model, historyPoints);
  const py = (v) => m.t + innerH - (clamp(v, 0, yMax) / yMax) * innerH;

  const today = startOfToday();
  const points = Array.isArray(historyPoints) ? historyPoints : [];
  const histStart = points.length ? toDate(points[0].date) : today;
  const spanDays = Math.max(1, daysBetween(histStart, today));
  const pxPast = (dateStr) => m.l + (daysBetween(histStart, dateStr) / spanDays) * (midX - m.l);
  const pxFut = (day) => midX + (day / model.futureDays) * (m.l + innerW - midX);

  const { cur, rop, ss, orderUpTo, dReorder, dArrive, hasDemand, dueNow } = model;
  const ssY = py(ss);
  const ropY = py(rop);
  const curY = py(cur);
  const peakY = py(orderUpTo);

  const pastPx = points.map((p) => ({ x: pxPast(p.date), y: py(p.qty), qty: num(p.qty), date: p.date }));
  const futPx = model.verts.map(([d, v]) => ({ x: pxFut(d), y: py(v), day: d, qty: v }));
  const pastLine = pastPx.map((p) => `${p.x},${p.y}`).join(" ");
  const futLine = futPx.map((p) => `${p.x},${p.y}`).join(" ");

  // Quantity gridlines / left-axis ticks at the decision thresholds (deduped so
  // labels never collide).
  const yTicks = [];
  [orderUpTo, cur, rop, ss, 0]
    .map((v) => Math.round(v))
    .filter((v) => v >= 0 && v <= yMax)
    .forEach((v) => {
      if (!yTicks.some((k) => k === v || Math.abs(py(k) - py(v)) < 13)) yTicks.push(v);
    });
  yTicks.sort((a, b) => a - b);

  // Diagonal dd/mm/yy date ticks: a few across the real past, plus the future
  // decision dates. Today is the centre divider (labelled separately).
  const dateTicks = [];
  if (points.length) {
    const midDate = addDays(histStart, Math.round(spanDays / 2));
    dateTicks.push({ x: pxPast(points[0].date), label: fmtDMY(histStart) });
    if (spanDays > 20) dateTicks.push({ x: pxPast(midDate.toISOString().slice(0, 10)), label: fmtDMY(midDate) });
  }
  if (hasDemand && !dueNow && dReorder > 0.5) {
    dateTicks.push({ x: pxFut(dReorder), label: fmtDMY(addDays(today, dReorder)), accent: "order" });
  }
  if (hasDemand && dArrive > 0.5) {
    dateTicks.push({ x: pxFut(dArrive), label: fmtDMY(addDays(today, dArrive)), accent: "restock" });
  }

  // Stock projected onto an x-pixel: history (left) walks the real points;
  // projection (right) walks the future verts. Used by the hover crosshair.
  function readAt(xPix) {
    if (xPix <= midX && pastPx.length) {
      for (let i = 0; i < pastPx.length - 1; i += 1) {
        const a = pastPx[i];
        const b = pastPx[i + 1];
        if (xPix >= a.x && xPix <= b.x && b.x !== a.x) {
          const f = (xPix - a.x) / (b.x - a.x);
          const days = Math.round(daysBetween(histStart, today) * ((xPix - m.l) / (midX - m.l)));
          return { qty: a.qty + f * (b.qty - a.qty), date: addDays(histStart, days), future: false };
        }
      }
      const p0 = pastPx[0];
      return { qty: p0.qty, date: histStart, future: false };
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
    <div className="saw-analysis">
      <svg
        ref={svgRef}
        className="saw saw-full"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={t("inventory.graph.title")}
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
      >
        {/* quantity gridlines */}
        {yTicks.map((v) => (
          <line key={`g${v}`} className="saw-grid" x1={m.l} y1={py(v)} x2={m.l + innerW} y2={py(v)} />
        ))}

        {/* safety-stock zone */}
        {ss > 0 ? (
          <rect className="saw-ss-band" x={m.l} y={ssY} width={innerW} height={Math.max(0, plotBottom - ssY)} />
        ) : null}

        {/* future (projection) region tint */}
        <rect className="rp-future-band" x={midX} y={m.t} width={Math.max(0, m.l + innerW - midX)} height={innerH} />

        {/* axes */}
        <line className="saw-axis" x1={m.l} y1={m.t} x2={m.l} y2={plotBottom} />
        <line className="saw-axis" x1={m.l} y1={plotBottom} x2={m.l + innerW} y2={plotBottom} />

        {/* threshold reference lines */}
        <line className="saw-peak" x1={m.l} y1={peakY} x2={m.l + innerW} y2={peakY} />
        {rop > 0 ? <line className="saw-rop" x1={m.l} y1={ropY} x2={m.l + innerW} y2={ropY} /> : null}
        {ss > 0 ? <line className="saw-ss" x1={m.l} y1={ssY} x2={m.l + innerW} y2={ssY} /> : null}

        {/* real history (solid) */}
        {pastPx.length > 1 ? (
          <polyline className={`saw-line tone-${tone}`} points={pastLine} />
        ) : null}

        {/* projection (dashed) */}
        {hasDemand ? <polyline className={`rp-proj tone-${tone}`} points={futLine} /> : null}

        {/* left-axis quantity tick labels */}
        {yTicks.map((v) => (
          <text key={`t${v}`} className="saw-yt" x={m.l - 8} y={py(v) + 3}>
            {fmt(v)}
          </text>
        ))}
        <text className="saw-axis-label" x={15} y={m.t + innerH / 2} transform={`rotate(-90 15 ${m.t + innerH / 2})`}>
          {t("inventory.graph.quantity")} ({unit || t("inventory.graph.units")})
        </text>

        {/* right-gutter threshold names */}
        <text className="saw-name is-peak" x={m.l + innerW + 8} y={peakY + 3}>
          {t("inventory.graph.orderUpTo")}
        </text>
        {rop > 0 ? (
          <text className="saw-name is-reorder" x={m.l + innerW + 8} y={ropY + 3}>
            {t("inventory.graph.reorderPoint")} · {fmt(rop)}
          </text>
        ) : null}
        {ss > 0 ? (
          <text className="saw-name is-safety" x={m.l + innerW + 8} y={ssY + 3}>
            {t("inventory.graph.safetyStock")} · {fmt(ss)}
          </text>
        ) : null}

        {/* region captions */}
        <text className="rp-region" x={(m.l + midX) / 2} y={m.t - 12}>
          {t("inventory.graph.regionPast")}
        </text>
        <text className="rp-region" x={(midX + m.l + innerW) / 2} y={m.t - 12}>
          {t("inventory.graph.regionFuture")}
        </text>

        {/* "how much" replenishment jump label */}
        {hasDemand ? (
          <text className="saw-restock-label" x={pxFut(dArrive) + 6} y={peakY - 6}>
            +{fmt(model.qty)} {unit}
          </text>
        ) : null}

        {/* Today divider */}
        <g className="rp-today-group">
          <line className="rp-today" x1={midX} y1={m.t} x2={midX} y2={plotBottom} />
          <circle className={`saw-now tone-${tone}`} cx={midX} cy={curY} r="4.5" />
          <text className={`saw-now-label tone-${tone}`} x={midX - 9} y={curY - 9} textAnchor="end">
            {t("inventory.graph.now")} · {fmt(cur)} {unit}
          </text>
          <text className="rp-today-role" x={midX} y={plotBottom + 16}>{t("inventory.graph.today")}</text>
          <text className="rp-today-date" x={midX} y={plotBottom + 29}>{fmtDMY(today)}</text>
        </g>

        {/* "Order by" highlighted marker (the WHEN) */}
        {hasDemand && !dueNow && dReorder > 0.4 ? (
          <g className="rp-orderby">
            <line x1={pxFut(dReorder)} y1={m.t} x2={pxFut(dReorder)} y2={plotBottom} />
            <circle className="rp-orderby-dot" cx={pxFut(dReorder)} cy={ropY} r="5" />
            <text className="rp-orderby-role" x={pxFut(dReorder)} y={plotBottom + 16}>
              {t("inventory.graph.orderBy")}
            </text>
            <text className="rp-orderby-date" x={pxFut(dReorder)} y={plotBottom + 29}>
              {fmtDMY(addDays(today, dReorder))}
            </text>
          </g>
        ) : null}
        {hasDemand && dueNow ? (
          <text className="rp-ordernow" x={midX + 8} y={curY - 14}>{t("inventory.graph.orderNow")}</text>
        ) : null}

        {/* diagonal date ticks */}
        {dateTicks.map((tk, i) => (
          <text
            key={`d${i}`}
            className={`rp-date-tick${tk.accent ? ` is-${tk.accent}` : ""}`}
            x={tk.x}
            y={plotBottom + 12}
            transform={`rotate(-32 ${tk.x} ${plotBottom + 12})`}
          >
            {tk.label}
          </text>
        ))}

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

      <p className="saw-hint">{t("inventory.graph.hoverHint")}</p>
    </div>
  );
}
