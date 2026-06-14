import { useRef, useState } from "react";
import { formatNumber } from "../../format";
import { useLanguage } from "../../i18n/LanguageContext";

// ════════════════════════════════════════════════════════════════════════
// Shared inventory "sawtooth" reorder-point model, rendered two ways:
//   • ReorderSawtoothMini — minimal, value-labelled + one "order by" date
//     marker (dashboard, fixed 3-up tile)
//   • ReorderSawtoothFull — full-width labelled analysis chart with a
//     TradingView-style hover crosshair (inventory detail modal)
// Stock burns down at the average daily demand from the order-up-to peak (C)
// to the safety stock (B'); a PO placed at the reorder point (A) lands one
// lead-time later and tops it back up to the peak.
// ════════════════════════════════════════════════════════════════════════

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// Resolve the textbook model points from a stock_report-shaped row's fields.
export function buildSawtoothModel({ current, reorder, safety, dailyDemand, leadTime, restock }) {
  const cur = Math.max(0, num(current));
  const rop = Math.max(0, num(reorder));
  // Keep safety strictly below the reorder point so the model always reads as a
  // sawtooth (reorder line above the safety band).
  let ss = Math.max(0, num(safety));
  if (rop > 0 && ss >= rop) ss = rop * 0.5;
  const demand = Math.max(0, num(dailyDemand));
  const lead = num(leadTime) > 0 ? num(leadTime) : demand > 0 && rop > ss ? (rop - ss) / demand : 0;
  const orderQty = num(restock) > 0 ? num(restock) : Math.max(rop - ss, rop, 1);
  return { cur, rop, ss, demand, lead, orderQty };
}

// Vertical scale anchored to the reorder point (NOT the order quantity, which
// can be huge and would squash the reorder/safety lines to the floor). This
// keeps the reorder point near ~58% and safety proportionally below it, so the
// teeth and every reference line stay readable. NOTE: because the first
// descent's slope is the true daily demand, the time it takes to fall from the
// current stock down through the reorder point and safety stock is exact even
// though the replenishment peak is only a display value.
function displayScale(model) {
  const { cur, rop, ss } = model;
  const yMax = Math.max(rop / 0.58, cur * 1.12, ss / 0.45, 1);
  return { yMax, drawPeak: yMax * 0.92 };
}

function addDays(offset) {
  const d = new Date();
  d.setDate(d.getDate() + Math.round(offset));
  return d;
}

function fmtDate(offset) {
  return addDays(offset).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ── Mini (dashboard) ────────────────────────────────────────────────────
// Minimal trajectory + the three key values, plus a single "order by" date
// marker where the line crosses the reorder point.
export function ReorderSawtoothMini({ tone = "accent", unit = "", ...params }) {
  const { t } = useLanguage();
  const model = buildSawtoothModel(params);
  const fmt = (v) => formatNumber(Math.round(num(v)));
  const W = 200;
  const H = 60;
  const padX = 4;
  const padTop = 7;
  const padBot = 6;
  const { yMax, drawPeak } = displayScale(model);
  const py = (v) => H - padBot - (clamp(v, 0, yMax) / yMax) * (H - padTop - padBot);

  const { cur, rop, ss, demand } = model;
  // x-distance (in cycle widths) from "now" to the first safety-stock touch.
  const remaining = demand > 0 && drawPeak > ss ? clamp((cur - ss) / (drawPeak - ss), 0, 1) : 0;

  let line;
  let px = (x) => padX + x;
  if (demand > 0) {
    const verts = [[0, cur]];
    let x = remaining;
    verts.push([x, ss], [x, drawPeak]);
    for (let k = 0; k < 2; k += 1) {
      x += 1;
      verts.push([x, ss], [x, drawPeak]);
    }
    verts.push([x + 0.5, (ss + drawPeak) / 2]);
    const maxX = verts[verts.length - 1][0] || 1;
    px = (xx) => padX + (xx / maxX) * (W - padX * 2);
    line = verts.map(([xx, v]) => `${px(xx)},${py(v)}`).join(" ");
  } else {
    line = `${padX},${py(cur)} ${W - padX},${py(cur)}`;
  }

  const ssY = py(ss);
  const ropY = py(rop);
  const curY = py(cur);
  const topPct = (yPx) => `${clamp((yPx / H) * 100, 7, 93)}%`;

  // "Order by" crossing: where the falling line meets the reorder point. On the
  // first descending segment (0 → remaining), value drops cur → ss linearly.
  const hasCross = demand > 0 && rop > 0 && cur > ss;
  const dueNow = cur <= rop;
  const crossUnits = hasCross && cur > rop ? (remaining * (cur - rop)) / (cur - ss) : 0;
  const crossX = px(crossUnits);
  const daysToReorder = demand > 0 ? Math.max(0, (cur - rop) / demand) : 0;
  const dateLabel = dueNow
    ? t("dashboard.reorder.orderNow")
    : t("dashboard.reorder.orderBy", { date: fmtDate(daysToReorder) });

  return (
    <div className="saw-mini-wrap">
      <svg className="saw saw-mini" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        <rect className="saw-ss-band" x={padX} y={ssY} width={W - padX * 2} height={Math.max(0, H - padBot - ssY)} />
        {rop > 0 ? <line className="saw-rop" x1={padX} y1={ropY} x2={W - padX} y2={ropY} /> : null}
        {ss > 0 ? <line className="saw-ss" x1={padX} y1={ssY} x2={W - padX} y2={ssY} /> : null}
        {hasCross ? <line className="saw-cross-mini" x1={crossX} y1={padTop} x2={crossX} y2={H - padBot} /> : null}
        <polyline className={`saw-line tone-${tone}`} points={line} vectorEffect="non-scaling-stroke" />
        <line className={`saw-now-guide tone-${tone}`} x1={padX} y1={curY} x2={W - padX} y2={curY} />
        <circle className={`saw-now tone-${tone}`} cx={padX + 1.5} cy={curY} r="2.6" />
      </svg>
      <span className={`saw-tag is-now tone-${tone}`} style={{ top: topPct(curY) }}>
        {fmt(cur)} {unit}
      </span>
      {rop > 0 ? (
        <span className="saw-tag is-rop" style={{ top: topPct(ropY) }}>{fmt(rop)}</span>
      ) : null}
      {ss > 0 ? (
        <span className="saw-tag is-ss" style={{ top: topPct(ssY) }}>{fmt(ss)}</span>
      ) : null}
      {demand > 0 ? (
        <span className={`saw-date${dueNow ? " is-now" : ""}`}>{dateLabel}</span>
      ) : null}
    </div>
  );
}

// ── Full (inventory detail) — interactive analysis chart ──────────────────
export function ReorderSawtoothFull({ tone = "accent", unit = "", ...params }) {
  const { t } = useLanguage();
  const svgRef = useRef(null);
  const [hover, setHover] = useState(null);
  const model = buildSawtoothModel(params);
  const fmt = (v) => formatNumber(Math.round(num(v)));

  const W = 920;
  const H = 380;
  const m = { l: 56, r: 116, t: 30, b: 66 };
  const innerW = W - m.l - m.r;
  const innerH = H - m.t - m.b;
  const plotBottom = m.t + innerH;
  const { yMax, drawPeak } = displayScale(model);
  const py = (v) => m.t + innerH - (clamp(v, 0, yMax) / yMax) * innerH;

  const { cur, rop, ss, demand, orderQty } = model;
  const hasDemand = demand > 0;

  // Day offsets — exact on the current descent (the peak cancels out).
  const dReorder = hasDemand ? Math.max(0, (cur - rop) / demand) : 0;
  const dReplenish = hasDemand ? Math.max(0, (cur - ss) / demand) : 0;
  const dStockout = hasDemand ? cur / demand : 0;
  const cycleDays = hasDemand ? (drawPeak - ss) / demand : 0;

  // Main wave: now → down to safety → restock jump → one repeat descent.
  const verts = hasDemand
    ? [
        [0, cur],
        [dReplenish, ss],
        [dReplenish, drawPeak],
        [dReplenish + cycleDays, ss],
      ]
    : [
        [0, cur],
        [1, cur],
      ];
  const maxDay = Math.max(verts[verts.length - 1][0] || 1, hasDemand ? dStockout * 1.1 : 1);
  const px = (d) => m.l + (d / maxDay) * innerW;
  const line = verts.map(([d, v]) => `${px(d)},${py(v)}`).join(" ");

  const ssY = py(ss);
  const ropY = py(rop);
  const curY = py(cur);
  const peakY = py(drawPeak);

  const showLead = hasDemand && dReplenish - dReorder > 0.01;
  const showRisk = hasDemand && dStockout - dReplenish > 0.01 && cur > ss;
  const dueNow = cur <= rop;

  // Quantity gridlines / left-axis ticks at the decision thresholds. Drop any
  // that would sit within 14px of one already kept so the labels never overlap
  // (the reorder/safety reference lines are drawn separately regardless).
  const yTicks = [];
  [cur, rop, ss, 0]
    .map((v) => Math.round(v))
    .filter((v) => v >= 0 && v <= yMax)
    .forEach((v) => {
      if (!yTicks.some((k) => k === v || Math.abs(py(k) - py(v)) < 14)) yTicks.push(v);
    });
  yTicks.sort((a, b) => a - b);

  // Stock projected onto any day (walks the wave segments, skips the vertical
  // restock jump). Used by the hover crosshair.
  function valueAtDay(day) {
    if (!hasDemand) return cur;
    for (let i = 0; i < verts.length - 1; i += 1) {
      const [d0, v0] = verts[i];
      const [d1, v1] = verts[i + 1];
      if (d1 === d0) continue;
      if (day >= d0 && day <= d1) return v0 + ((day - d0) / (d1 - d0)) * (v1 - v0);
    }
    if (day <= verts[0][0]) return verts[0][1];
    return verts[verts.length - 1][1];
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
    const day = ((xC - m.l) / innerW) * maxDay;
    const value = valueAtDay(day);
    const rect = svg.getBoundingClientRect();
    setHover({
      xC,
      yPx: py(value),
      day,
      value,
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

  // Bottom date markers (all on the accurate current cycle). Built left → right
  // then thinned so labels never collide (keep one per ~70px of width).
  const markers = [];
  if (hasDemand) {
    const candidates = [{ day: 0, role: t("inventory.graph.today"), date: fmtDate(0), kind: "today" }];
    if (!dueNow && dReorder > 0.4) {
      candidates.push({ day: dReorder, role: t("inventory.graph.orderBy"), date: fmtDate(dReorder), kind: "order" });
    }
    if (dReplenish > 0.4) {
      candidates.push({ day: dReplenish, role: t("inventory.graph.restock"), date: fmtDate(dReplenish), kind: "restock" });
    }
    if (showRisk) {
      candidates.push({ day: dStockout, role: t("inventory.graph.stockout"), date: fmtDate(dStockout), kind: "stockout" });
    }
    let lastX = -Infinity;
    candidates.forEach((mk) => {
      const x = px(mk.day);
      if (x - lastX >= 70) {
        markers.push(mk);
        lastX = x;
      }
    });
  }

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
        <rect className="saw-ss-band" x={m.l} y={ssY} width={innerW} height={Math.max(0, plotBottom - ssY)} />

        {/* lead-time band on the current cycle */}
        {showLead ? (
          <rect className="saw-lead-band" x={px(dReorder)} y={m.t} width={Math.max(0, px(dReplenish) - px(dReorder))} height={innerH} />
        ) : null}

        {/* axes */}
        <line className="saw-axis" x1={m.l} y1={m.t} x2={m.l} y2={plotBottom} />
        <line className="saw-axis" x1={m.l} y1={plotBottom} x2={m.l + innerW} y2={plotBottom} />

        {/* threshold reference lines */}
        <line className="saw-peak" x1={m.l} y1={peakY} x2={m.l + innerW} y2={peakY} />
        {rop > 0 ? <line className="saw-rop" x1={m.l} y1={ropY} x2={m.l + innerW} y2={ropY} /> : null}
        {ss > 0 ? <line className="saw-ss" x1={m.l} y1={ssY} x2={m.l + innerW} y2={ssY} /> : null}

        {/* "if not ordered" stockout risk projection */}
        {showRisk ? (
          <polyline className="saw-risk" points={`${px(dReplenish)},${ssY} ${px(dStockout)},${py(0)}`} />
        ) : null}

        {/* main stock trajectory */}
        <polyline className={`saw-line tone-${tone}`} points={line} />

        {/* left-axis quantity tick labels */}
        {yTicks.map((v) => (
          <text key={`t${v}`} className="saw-yt" x={m.l - 8} y={py(v) + 3}>
            {fmt(v)}
          </text>
        ))}
        <text className="saw-axis-label" x={15} y={m.t + innerH / 2} transform={`rotate(-90 15 ${m.t + innerH / 2})`}>
          {t("inventory.graph.quantity")} ({unit || t("inventory.graph.units")})
        </text>

        {/* right-gutter threshold name labels */}
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

        {/* restock arrival annotation */}
        {hasDemand ? (
          <text className="saw-restock-label" x={px(dReplenish) + 5} y={peakY - 6}>
            +{fmt(orderQty)} {unit}
          </text>
        ) : null}

        {/* bottom date markers */}
        {markers.map((mk) => (
          <g key={mk.kind} className={`saw-marker is-${mk.kind}`}>
            <line x1={px(mk.day)} y1={mk.kind === "stockout" ? py(0) : m.t} x2={px(mk.day)} y2={plotBottom} />
            <text className="saw-marker-role" x={px(mk.day)} y={plotBottom + 17}>
              {mk.role}
            </text>
            <text className="saw-marker-date" x={px(mk.day)} y={plotBottom + 31}>
              {mk.date}
            </text>
          </g>
        ))}

        {/* lead-time bracket label */}
        {showLead ? (
          <text className="saw-lead-label" x={(px(dReorder) + px(dReplenish)) / 2} y={m.t + 12}>
            {t("inventory.graph.leadTime")} · {fmt(model.lead)}
            {t("inventory.graph.daySuffix")}
          </text>
        ) : null}

        {/* "now" marker */}
        <circle className={`saw-now tone-${tone}`} cx={px(0)} cy={curY} r="4.5" />
        <text className={`saw-now-label tone-${tone}`} x={px(0) + 9} y={curY - 8}>
          {t("inventory.graph.now")} · {fmt(cur)} {unit}
        </text>

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
          <span className="saw-tip-date">{fmtDate(hover.day)}</span>
          <span className="saw-tip-qty">
            {fmt(hover.value)} {unit}
          </span>
          <span className="saw-tip-sub">{t("inventory.graph.daysFromNow", { n: Math.round(hover.day) })}</span>
          <span className={`saw-tip-status is-${hoverStatus}`}>{hoverStatusLabel}</span>
        </div>
      ) : null}

      {/* Keep the hint visible at all times — the hover tooltip floats above it
          instead of replacing it, so the text no longer flickers in and out. */}
      <p className="saw-hint">{t("inventory.graph.hoverHint")}</p>
    </div>
  );
}
