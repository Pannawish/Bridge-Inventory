export default function AllItemsDiscountControl({
  enabled,
  value,
  onEnabledChange,
  onValueChange,
}) {
  return (
    <section className="purchase-vat-card transaction-wide-discount-card">
      <div className="purchase-vat-card-header">
        <p className="purchase-vat-label">All Items Discount</p>
        <label className="vat-toggle">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => onEnabledChange(event.target.checked)}
          />
          <span className="vat-toggle-track" />
          <span className="vat-toggle-text">{enabled ? "On" : "Off"}</span>
        </label>
      </div>

      {enabled ? (
        <label className="transaction-wide-discount-field">
          <span>Discount</span>
          <div className="sales-discount-entry">
            <input
              className="sales-discount-input"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={value}
              onChange={(event) => onValueChange(event.target.value)}
              placeholder="0"
              required
            />
            <span className="sales-discount-pct">%</span>
          </div>
        </label>
      ) : null}
    </section>
  );
}
