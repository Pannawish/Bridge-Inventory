import { formatNumber } from "../../format";
import { useLanguage } from "../../i18n/LanguageContext";

// ════════════════════════════════════════════════════════════════════════
// Shared inventory "sawtooth" reorder-point model, rendered two ways:
//   • ReorderSawtoothMini — minimal, value-labelled (dashboard, fixed 3-up)
//   • ReorderSawtoothFull — labelled textbook chart (inventory detail modal)
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
// teeth and every reference line stay readable.
function displayScale(model) {
  const { cur, rop, ss } = model;
  const yMax = Math.max(rop / 0.58, cur * 1.12, ss / 0.45, 1);
  return { yMax, drawPeak: yMax * 0.94 };
}

// Project the wave as [x, value] vertices from "now" (current stock, mid-cycle).
// `span` is the x-distance of one full cycle (1 for the normalised mini, real
// days for the full chart); `peak` is the display order-up-to level.
function projectVertices(model, { cycles, peak, span }) {
  const { cur, ss } = model;
  const remaining = peak > ss ? clamp((cur - ss) / (peak - ss), 0, 1) : 0;
  const pts = [[0, cur]];
  let x = remaining * span;
  pts.push([x, ss], [x, peak]);
  for (let k = 0; k < cycles; k += 1) {
    x += span;
    pts.push([x, ss], [x, peak]);
  }
  x += span * 0.5;
  pts.push([x, (ss + peak) / 2]);
  return pts;
}

// ── Mini (dashboard) ────────────────────────────────────────────────────
export function ReorderSawtoothMini({ tone = "accent", unit = "", ...params }) {
  const model = buildSawtoothModel(params);
  const fmt = (v) => formatNumber(Math.round(num(v)));
  const W = 200;
  const H = 60;
  const padX = 4;
  const padTop = 8;
  const padBot = 7;
  const { yMax, drawPeak } = displayScale(model);
  const py = (v) => H - padBot - (clamp(v, 0, yMax) / yMax) * (H - padTop - padBot);

  let line;
  if (model.demand > 0) {
    const verts = projectVertices(model, { cycles: 2, peak: drawPeak, span: 1 });
    const maxX = verts[verts.length - 1][0] || 1;
    const px = (x) => padX + (x / maxX) * (W - padX * 2);
    line = verts.map(([x, v]) => `${px(x)},${py(v)}`).join(" ");
  } else {
    line = `${padX},${py(model.cur)} ${W - padX},${py(model.cur)}`;
  }

  const ssY = py(model.ss);
  const ropY = py(model.rop);
  const curY = py(model.cur);
  const topPct = (yPx) => `${clamp((yPx / H) * 100, 7, 93)}%`;

  return (
    <div className="saw-mini-wrap">
      <svg className="saw saw-mini" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        <rect className="saw-ss-band" x={padX} y={ssY} width={W - padX * 2} height={Math.max(0, H - padBot - ssY)} />
        {model.rop > 0 ? <line className="saw-rop" x1={padX} y1={ropY} x2={W - padX} y2={ropY} /> : null}
        {model.ss > 0 ? <line className="saw-ss" x1={padX} y1={ssY} x2={W - padX} y2={ssY} /> : null}
        <polyline className={`saw-line tone-${tone}`} points={line} vectorEffect="non-scaling-stroke" />
        <line className={`saw-now-guide tone-${tone}`} x1={padX} y1={curY} x2={W - padX} y2={curY} />
        <circle className={`saw-now tone-${tone}`} cx={padX + 1.5} cy={curY} r="2.6" />
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
    </div>
  );
}

// ── Full (inventory detail) ───────────────────────────────────────────────
function shortDate(dayOffset) {
  const d = new Date();
  d.setDate(d.getDate() + Math.round(dayOffset));
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function ReorderSawtoothFull({ tone = "accent", unit = "", ...params }) {
  const { t } = useLanguage();
  const model = buildSawtoothModel(params);
  const fmt = (v) => formatNumber(Math.round(num(v) * 10) / 10);

  const W = 560;
  const H = 280;
  const m = { l: 46, r: 20, t: 20, b: 56 };
  const innerW = W - m.l - m.r;
  const innerH = H - m.t - m.b;
  const plotBottom = m.t + innerH;
  const { yMax, drawPeak } = displayScale(model);
  const py = (v) => m.t + innerH - (clamp(v, 0, yMax) / yMax) * innerH;

  const hasDemand = model.demand > 0;
  const cycleDays = hasDemand ? (drawPeak - model.ss) / model.demand : 0;
  const verts = hasDemand
    ? projectVertices(model, { cycles: 2, peak: drawPeak, span: cycleDays })
    : [[0, model.cur], [1, model.cur]];
  const maxDay = verts[verts.length - 1][0] || 1;
  const px = (d) => m.l + (d / maxDay) * innerW;
  const line = verts.map(([d, v]) => `${px(d)},${py(v)}`).join(" ");

  const ssY = py(model.ss);
  const ropY = py(model.rop);
  const curY = py(model.cur);

  // Current-cycle reorder crossing (A) and replenishment (B) days for the
  // lead-time bracket; if we're already below the reorder point it's due now.
  const dReorder = hasDemand ? Math.max(0, (model.cur - model.rop) / model.demand) : 0;
  const dReplenish = hasDemand ? Math.max(0, (model.cur - model.ss) / model.demand) : 0;
  const showLead = hasDemand && dReplenish - dReorder > 0.01;

  const tickDays = [0];
  verts.forEach(([d, v], i) => {
    if (i > 0 && v === drawPeak && verts[i - 1][1] === model.ss) tickDays.push(d);
  });

  return (
    <svg
      className="saw saw-full"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={t("inventory.graph.title")}
    >
      {/* axes */}
      <line className="saw-axis" x1={m.l} y1={m.t} x2={m.l} y2={plotBottom} />
      <line className="saw-axis" x1={m.l} y1={plotBottom} x2={m.l + innerW} y2={plotBottom} />
      <text className="saw-axis-label" x={13} y={m.t + innerH / 2} transform={`rotate(-90 13 ${m.t + innerH / 2})`}>
        {t("inventory.graph.quantity")}
      </text>
      <text className="saw-axis-label" x={m.l + innerW / 2} y={H - 6}>
        {t("inventory.graph.time")}
      </text>

      {/* safety-stock zone + reference lines, labelled at the right edge */}
      <rect className="saw-ss-band" x={m.l} y={ssY} width={innerW} height={Math.max(0, plotBottom - ssY)} />
      {model.ss > 0 ? (
        <>
          <line className="saw-ss" x1={m.l} y1={ssY} x2={m.l + innerW} y2={ssY} />
          <text className="saw-line-label is-safety" x={m.l + innerW - 2} y={ssY - 5}>
            {t("inventory.graph.safetyStock")} · {fmt(model.ss)}
          </text>
        </>
      ) : null}
      {model.rop > 0 ? (
        <>
          <line className="saw-rop" x1={m.l} y1={ropY} x2={m.l + innerW} y2={ropY} />
          <text className="saw-line-label is-reorder" x={m.l + innerW - 2} y={ropY - 5}>
            {t("inventory.graph.reorderPoint")} · {fmt(model.rop)}
          </text>
        </>
      ) : null}

      {/* wave */}
      <polyline className={`saw-line tone-${tone}`} points={line} />

      {/* date ticks just under the axis */}
      {tickDays.map((d, i) => (
        <text key={i} className="saw-tick" x={px(d)} y={plotBottom + 14}>
          {shortDate(d)}
        </text>
      ))}

      {/* lead-time bracket on the current cycle */}
      {showLead ? (
        <g className="saw-bracket">
          <line x1={px(dReorder)} y1={plotBottom + 26} x2={px(dReplenish)} y2={plotBottom + 26} />
          <line x1={px(dReorder)} y1={plotBottom + 22} x2={px(dReorder)} y2={plotBottom + 30} />
          <line x1={px(dReplenish)} y1={plotBottom + 22} x2={px(dReplenish)} y2={plotBottom + 30} />
          <text className="saw-bracket-label is-lead" x={(px(dReorder) + px(dReplenish)) / 2} y={plotBottom + 40}>
            {t("inventory.graph.leadTime")} · {fmt(model.lead)}{t("inventory.graph.daySuffix")}
          </text>
        </g>
      ) : null}

      {/* current "now" marker, labelled to the right of the dot */}
      <line className={`saw-now-guide tone-${tone}`} x1={m.l} y1={curY} x2={px(0)} y2={curY} />
      <circle className={`saw-now tone-${tone}`} cx={px(0)} cy={curY} r="4" />
      <text className={`saw-now-label tone-${tone}`} x={px(0) + 8} y={curY - 7}>
        {t("inventory.graph.now")} · {fmt(model.cur)} {unit}
      </text>
    </svg>
  );
}
