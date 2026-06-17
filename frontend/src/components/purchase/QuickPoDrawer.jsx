import { useState } from "react";
import { formatNumber as formatLocaleNumber, formatDate, formatMoney } from "../../format";
import { useLanguage } from "../../i18n/LanguageContext";

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

// Round an order quantity up to whole purchase packs (a box of 12, a ream of
// 500…) so the buyer orders in the unit the supplier actually sells. Returns the
// rounded base quantity plus how many packs that is; factor ≤ 1 means the
// product is bought in its base unit, so the quantity passes through untouched.
function roundToPack(baseQty, pack) {
  const factor = num(pack?.factor);
  if (!(factor > 1) || !(baseQty > 0)) return { baseQty, packs: null };
  const packs = Math.ceil(baseQty / factor);
  return { baseQty: packs * factor, packs };
}

// Confirm-before-create Quick PO. The supplier is picked from the suppliers this
// product has actually been bought from before (cheapest-first), and the unit
// price follows the chosen supplier's last cost. Quantity defaults to the
// recommended restock rounded up to whole purchase packs. Shows what's already
// on the way, the cheapest-price delta, pack/cover hints and the order-up-to
// target, then hands off to the Purchase form prefilled (review-before-create).
//
// Shared by the Dashboard reorder widget and the Inventory manage cards, so a
// product reorders identically wherever it's actioned. The row needs `_available`
// and `_reorder` derived once by the caller (the dashboard precomputes them; the
// inventory page maps them from getAvailable/getReorderLevel).
function QuickPoDrawer({ row, onClose, onConfirm }) {
  const { t } = useLanguage();

  const options = Array.isArray(row.supplier_options) ? row.supplier_options : [];
  const hasOptions = options.length > 0;
  // Options arrive cheapest-first from the backend, so [0] is the best price.
  const cheapestCost = hasOptions ? num(options[0].last_cost) : null;
  const pack = row.purchase_pack || null;
  const packFactor = num(pack?.factor);
  const hasPack = packFactor > 1;
  const dailyDemand = num(row.average_daily_demand) || num(row.predicted_7_day_demand) / 7;
  const incoming = num(row.incoming_purchase_units);
  const available = num(row._available);

  const [supplierIndex, setSupplierIndex] = useState(0);
  const [vendor, setVendor] = useState(row.best_supplier_name || ""); // free-text fallback
  const selected = hasOptions ? options[Math.min(supplierIndex, options.length - 1)] : null;
  const supplierName = hasOptions ? (selected ? selected.supplier_name : "") : vendor;

  const [qty, setQty] = useState(() => {
    const restock = num(row.recommended_restock);
    return String(roundToPack(restock > 0 ? restock : 1, pack).baseQty);
  });
  const [price, setPrice] = useState(() => {
    const seed = selected ? selected.last_cost : row.best_supplier_cost ?? row.unit_cost ?? row.average_unit_cost;
    return seed === null || seed === undefined ? "" : String(seed);
  });

  const qtyNum = num(qty);
  const priceNum = num(price);
  const lineTotal = qtyNum * priceNum;
  const packsDisplay = hasPack && qtyNum > 0 ? qtyNum / packFactor : null;
  const coverDays = dailyDemand > 0 ? Math.round(qtyNum / dailyDemand) : null;
  const bringsTo = available + qtyNum;
  const overPct =
    cheapestCost && cheapestCost > 0 && priceNum > cheapestCost
      ? Math.round(((priceNum - cheapestCost) / cheapestCost) * 100)
      : 0;
  const lastDate = selected && selected.last_date ? formatDate(selected.last_date) : null;

  function handleSupplierChange(event) {
    const idx = Number(event.target.value);
    setSupplierIndex(idx);
    const opt = options[idx];
    if (opt && opt.last_cost != null) setPrice(String(opt.last_cost));
  }

  function handleSubmit(event) {
    event.preventDefault();
    onConfirm({ vendor: supplierName, qty: qtyNum, price: price === "" ? "" : priceNum });
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

        <div className="dash-drawer-context is-2col">
          <div>
            <span>{t("dashboard.quickPo.current")}</span>
            <strong>{formatUnits(available)} {row.unit || ""}</strong>
          </div>
          <div>
            <span>{t("dashboard.quickPo.reorderPoint")}</span>
            <strong>{formatUnits(row._reorder)} {row.unit || ""}</strong>
          </div>
        </div>

        {incoming > 0 ? (
          <p className="dash-drawer-incoming">
            ⬇ {t("dashboard.quickPo.onTheWay", { qty: formatUnits(incoming), unit: row.unit || "" })}
          </p>
        ) : null}

        <form className="dash-drawer-body" onSubmit={handleSubmit}>
          <label className="dash-drawer-field">
            <span>{t("dashboard.quickPo.supplier")}</span>
            {hasOptions ? (
              <>
                <select className="dash-drawer-select" value={supplierIndex} onChange={handleSupplierChange}>
                  {options.map((opt, idx) => (
                    <option key={opt.supplier_name} value={idx}>
                      {opt.supplier_name} · {formatMoney(opt.last_cost)}
                      {opt.last_date ? ` · ${formatDate(opt.last_date)}` : ""}
                      {idx === 0 ? ` · ${t("dashboard.quickPo.bestPrice")}` : ""}
                    </option>
                  ))}
                </select>
                {overPct > 0 ? (
                  <span className="dash-drawer-warn">{t("dashboard.quickPo.vsCheapest", { pct: overPct })}</span>
                ) : null}
              </>
            ) : (
              <input
                type="text"
                value={vendor}
                onChange={(event) => setVendor(event.target.value)}
                placeholder={t("dashboard.quickPo.noSupplierHistory")}
              />
            )}
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
              <span className="dash-drawer-meta">
                {packsDisplay != null
                  ? `${t("dashboard.quickPo.packHint", { packs: formatUnits(packsDisplay), unit: pack.unit })} · `
                  : ""}
                {coverDays != null ? t("dashboard.quickPo.coverHint", { days: formatLocaleNumber(coverDays) }) : ""}
              </span>
              <span className="dash-drawer-meta">
                {t("dashboard.quickPo.bringsTo", { qty: formatUnits(bringsTo), unit: row.unit || "" })}
              </span>
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
              {lastDate ? (
                <span className="dash-drawer-meta">{t("dashboard.quickPo.lastBought", { date: lastDate })}</span>
              ) : null}
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

export default QuickPoDrawer;
