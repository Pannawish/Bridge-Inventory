import { useMemo, useState } from "react";
import { formatMoney as fmt } from "../format";
import { useLanguage } from "../i18n/LanguageContext";

function getItemKey(item, index) {
  return item.line_id || item.id || `q-item-${index}`;
}

/**
 * Step shown after the user clicks Purchase/Sale on a quotation: pick which
 * products to convert and, for each, which recorded supplier to source from.
 */
export default function QuotationConvertSelect({
  quotation,
  type,
  initialSelectedItemKeys = null,
  stockCoverageLines = [],
  onBack,
  onContinue,
}) {
  const { t } = useLanguage();
  const isPurchase = type === "purchase";
  const items = useMemo(
    () => (Array.isArray(quotation.items) ? quotation.items : []),
    [quotation.items]
  );
  const initialSelectedKeySet = useMemo(
    () => (Array.isArray(initialSelectedItemKeys) ? new Set(initialSelectedItemKeys) : null),
    [initialSelectedItemKeys]
  );

  const [selectedKeys, setSelectedKeys] = useState(() => {
    const initial = new Set();
    items.forEach((item, index) => {
      const key = getItemKey(item, index);
      const hasSupplier = (item.supplier_options || []).length > 0;
      if (initialSelectedKeySet && !initialSelectedKeySet.has(key)) {
        return;
      }
      if (!isPurchase || hasSupplier) {
        initial.add(key);
      }
    });
    return initial;
  });
  const [supplierIndexByKey, setSupplierIndexByKey] = useState(() => {
    const map = {};
    items.forEach((item, index) => {
      map[getItemKey(item, index)] = 0;
    });
    return map;
  });
  const [error, setError] = useState("");

  function toggle(key, disabled) {
    if (disabled) {
      return;
    }
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function handleContinue() {
    const rows = [];
    items.forEach((item, index) => {
      const key = getItemKey(item, index);
      if (!selectedKeys.has(key)) {
        return;
      }
      const options = item.supplier_options || [];
      rows.push({ item, option: options[supplierIndexByKey[key]] || null });
    });

    if (!rows.length) {
      setError("Select at least one product.");
      return;
    }
    if (isPurchase && rows.some((row) => !row.option)) {
      setError("Every selected product needs a supplier to build a purchase order.");
      return;
    }

    onContinue(rows);
  }

  return (
    <section className="section-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Quotation {quotation.reference_no}</p>
          <h3>Select Products to {isPurchase ? "Purchase" : "Sell"}</h3>
        </div>
        <button
          className="secondary-button table-action-button"
          type="button"
          onClick={onBack}
        >
          Back
        </button>
      </div>

      <p className="empty-copy">
        {isPurchase
          ? "Pick the supplier for each product. Products are grouped into one purchase order per supplier."
          : "Pick the supplier each product is sourced from. Its cost is recorded on the sales order."}
      </p>
      {isPurchase && items.some((item, index) => (item.supplier_options || []).length === 0) && (
        <div className="notice-banner">
          Some items are greyed out because they have no supplier recorded in the quotation.
          To include them, go back and add a supplier + cost price to those items first.
        </div>
      )}

      <div className="transaction-table-window">
        <div className="table-scroll">
          <table className="transaction-history-table">
            <thead>
              <tr>
                <th />
                <th>Product</th>
                <th>Qty</th>
                <th>{t("quotationDetail.stockColumn")}</th>
                <th>Sale Price</th>
                <th>Supplier (Cost)</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const key = getItemKey(item, index);
                const options = item.supplier_options || [];
                const disabled = isPurchase && options.length === 0;
                const checked = selectedKeys.has(key);
                const stockCoverage = stockCoverageLines[index] || {
                  status: "unknown",
                  metaKey: "quotationDetail.stockUnknownMeta",
                  metaValues: {},
                };

                return (
                  <tr
                    key={key}
                    className={checked ? "partner-table-row active" : "partner-table-row"}
                  >
                    <td>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggle(key, disabled)}
                        title={disabled ? "Add a supplier + cost price to this item in the quotation to include it in a PO" : undefined}
                      />
                    </td>
                    <td>
                      {item.product_name || "—"}
                      {item.sku ? ` (${item.sku})` : ""}
                    </td>
                    <td>
                      {item.quantity} {item.unit}
                    </td>
                    <td>
                      <div className="quotation-detail-stock">
                        <span
                          className={`status-badge health-badge ${
                            stockCoverage.status === "covered"
                              ? "positive"
                              : stockCoverage.status === "short"
                                ? "warning"
                                : "danger"
                          }`}
                        >
                          {stockCoverage.status === "covered"
                            ? t("quotationDetail.stockCovered")
                            : stockCoverage.status === "short"
                              ? t("quotationDetail.stockShort")
                              : t("quotationDetail.stockUnknown")}
                        </span>
                        <span className="quotation-detail-stock-meta">
                          {t(stockCoverage.metaKey, stockCoverage.metaValues)}
                        </span>
                      </div>
                    </td>
                    <td>{fmt(item.sale_price)}</td>
                    <td>
                      {options.length ? (
                        <select
                          value={supplierIndexByKey[key]}
                          onChange={(event) =>
                            setSupplierIndexByKey((current) => ({
                              ...current,
                              [key]: Number(event.target.value),
                            }))
                          }
                        >
                          {options.map((option, optionIndex) => (
                            <option key={option.id || optionIndex} value={optionIndex}>
                              {option.supplier_name || "—"} — {fmt(option.cost_price)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="empty-copy" style={{ color: "var(--danger, #ed4014)" }}>
                          No supplier — cannot include in PO
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="supplier-modal-actions">
        <button className="secondary-button" type="button" onClick={onBack}>
          Cancel
        </button>
        <button className="primary-button" type="button" onClick={handleContinue}>
          Continue
        </button>
      </div>
    </section>
  );
}
