import { useState } from "react";

const VAT_RATE = 0.07;
const vatOptions = [
  { value: "included", label: "VAT Included" },
  { value: "not_included", label: "VAT Not Included" },
  { value: "none", label: "No VAT" },
];

function getToday() {
  return new Date().toISOString().split("T")[0];
}

function createInitialForm() {
  return {
    reference_no: "",
    customer_name: "",
    status: "delivered",
    payment_timing: "instant",
    payment_received_date: getToday(),
    transaction_date: getToday(),
    note: "",
    document: null,
  };
}

function emptyItem() {
  return {
    product_id: "",
    quantity: 1,
    unit_price: "",
    discounts: [0],
  };
}

function computeAmount(item) {
  const qty = Number(item.quantity) || 0;
  const price = Number(item.unit_price) || 0;
  const multiplier = (item.discounts || []).reduce((acc, d) => {
    const clamped = Math.min(100, Math.max(0, Number(d) || 0));
    return acc * (1 - clamped / 100);
  }, 1);
  return qty * price * multiplier;
}

function fmt(v) {
  return `฿${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function computeVatSummary(itemTotal, vatMode) {
  if (vatMode === "included") {
    const totalBeforeVat = itemTotal / (1 + VAT_RATE);
    const vat = itemTotal - totalBeforeVat;
    return {
      total: totalBeforeVat,
      vat,
      grandTotal: itemTotal,
    };
  }

  if (vatMode === "not_included") {
    const vat = itemTotal * VAT_RATE;
    return {
      total: itemTotal,
      vat,
      grandTotal: itemTotal + vat,
    };
  }

  return {
    total: itemTotal,
    vat: 0,
    grandTotal: itemTotal,
  };
}

function SalesForm({ products, onSubmit }) {
  const [form, setForm] = useState(createInitialForm());
  const [items, setItems] = useState([emptyItem()]);
  const [vatMode, setVatMode] = useState("not_included");

  function updateForm(key, value) {
    setForm((currentForm) => ({ ...currentForm, [key]: value }));
  }

  function handlePaymentTimingChange(event) {
    const nextTiming = event.target.value;

    setForm((currentForm) => ({
      ...currentForm,
      payment_timing: nextTiming,
      payment_received_date:
        nextTiming === "instant"
          ? getToday()
          : currentForm.payment_timing === "instant"
            ? ""
            : currentForm.payment_received_date,
    }));
  }

  function updateItem(itemIndex, key, value) {
    setItems((current) =>
      current.map((item, i) => (i === itemIndex ? { ...item, [key]: value } : item))
    );
  }

  function addDiscount(itemIndex) {
    setItems((current) =>
      current.map((item, i) =>
        i === itemIndex
          ? { ...item, discounts: [...item.discounts, 0] }
          : item
      )
    );
  }

  function removeDiscount(itemIndex, discountIndex) {
    setItems((current) =>
      current.map((item, i) => {
        if (i !== itemIndex) return item;
        const next = item.discounts.filter((_, di) => di !== discountIndex);
        return { ...item, discounts: next.length === 0 ? [0] : next };
      })
    );
  }

  function updateDiscount(itemIndex, discountIndex, value) {
    setItems((current) =>
      current.map((item, i) => {
        if (i !== itemIndex) return item;
        const next = item.discounts.map((d, di) => (di === discountIndex ? value : d));
        return { ...item, discounts: next };
      })
    );
  }

  function addItem() {
    setItems((current) => [...current, emptyItem()]);
  }

  function removeItem(index) {
    setItems((current) => current.filter((_, i) => i !== index));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const formData = new FormData();
    formData.append("reference_no", form.reference_no);
    formData.append("customer_name", form.customer_name);
    formData.append("status", form.status);
    formData.append("transaction_date", form.transaction_date);
    formData.append("payment_received_date", form.payment_received_date);
    formData.append("note", form.note);
    formData.append("vat_mode", vatMode);
    formData.append("total_before_vat", vatSummary.total);
    formData.append("vat_amount", vatSummary.vat);
    formData.append("grand_total", vatSummary.grandTotal);

    if (form.document) {
      formData.append("document", form.document);
    }

    const filteredItems = items
      .filter((item) => item.product_id && item.quantity && item.unit_price)
      .map((item) => ({ ...item, amount: computeAmount(item) }));
    formData.append("items", JSON.stringify(filteredItems));

    await onSubmit(formData);

    setForm(createInitialForm());
    setItems([emptyItem()]);
    setVatMode("not_included");
  }

  const itemTotal = items.reduce((sum, item) => sum + computeAmount(item), 0);
  const vatSummary = computeVatSummary(itemTotal, vatMode);

  return (
    <section className="section-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Sales Entry</p>
          <h3>Add Sales Transaction</h3>
        </div>
      </div>

      <form className="form-layout" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label>
            Reference No.
            <input
              value={form.reference_no}
              onChange={(event) => updateForm("reference_no", event.target.value)}
              placeholder="SO-001"
            />
          </label>

          <label>
            Customer Name
            <input
              value={form.customer_name}
              onChange={(event) => updateForm("customer_name", event.target.value)}
              required
            />
          </label>

          <label>
            Status
            <select
              value={form.status}
              onChange={(event) => updateForm("status", event.target.value)}
            >
              <option value="draft">Draft</option>
              <option value="packed">Packed</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>

          <label>
            Transaction Date
            <input
              type="date"
              value={form.transaction_date}
              onChange={(event) => updateForm("transaction_date", event.target.value)}
            />
          </label>

          <label>
            Money Receive
            <select value={form.payment_timing} onChange={handlePaymentTimingChange}>
              <option value="instant">Instantly</option>
              <option value="later">Later</option>
            </select>
          </label>

          <label>
            Money Receive Date
            <input
              type="date"
              value={form.payment_received_date}
              min={getToday()}
              onChange={(event) => updateForm("payment_received_date", event.target.value)}
              disabled={form.payment_timing === "instant"}
              required={form.payment_timing === "later"}
            />
          </label>

          <label className="full-width">
            Notes
            <textarea
              rows="3"
              value={form.note}
              onChange={(event) => updateForm("note", event.target.value)}
            />
          </label>

          <label className="full-width">
            Document
            <input
              type="file"
              onChange={(event) => updateForm("document", event.target.files?.[0] || null)}
            />
          </label>
        </div>

        <div className="line-items-card">
          <div className="line-items-header">
            <h4>Sales Items</h4>
            <button className="secondary-button" type="button" onClick={addItem}>
              Add Item
            </button>
          </div>

          {items.map((item, index) => {
            const amount = computeAmount(item);

            return (
              <div className="line-item-row sales-line-item-row" key={index}>
                <label className="purchase-item-field sales-item-product">
                  <span>Product</span>
                  <select
                    value={item.product_id}
                    onChange={(event) => updateItem(index, "product_id", event.target.value)}
                    required
                  >
                    <option value="">Select product</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="purchase-item-field sales-item-qty">
                  <span>Qty</span>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(event) => updateItem(index, "quantity", event.target.value)}
                    placeholder="Qty"
                    required
                  />
                </label>

                <label className="purchase-item-field sales-item-price">
                  <span>Unit Price</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unit_price}
                    onChange={(event) => updateItem(index, "unit_price", event.target.value)}
                    placeholder="0.00"
                    required
                  />
                </label>

                <div className="purchase-item-field sales-item-discounts">
                  <span>Discounts</span>
                  <div className="sales-discount-cell">
                    {item.discounts.map((d, di) => (
                      <div key={di} className="sales-discount-entry">
                        {di > 0 && (
                          <span className="sales-discount-chain-label">then</span>
                        )}
                        <input
                          className="sales-discount-input"
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={d}
                          onChange={(event) => updateDiscount(index, di, event.target.value)}
                          placeholder="0"
                        />
                        <span className="sales-discount-pct">%</span>
                        {item.discounts.length > 1 && (
                          <button
                            className="sales-discount-remove"
                            type="button"
                            aria-label="Remove discount"
                            onClick={() => removeDiscount(index, di)}
                          >
                            X
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      className="sales-discount-add"
                      type="button"
                      onClick={() => addDiscount(index)}
                    >
                      + Add
                    </button>
                  </div>
                </div>

                <div className="purchase-item-field sales-item-amount">
                  <span>Amount</span>
                  <div className="sales-line-amount">
                    {fmt(amount)}
                  </div>
                </div>

                <button
                  className="danger-button sales-item-remove"
                  type="button"
                  onClick={() => removeItem(index)}
                  disabled={items.length === 1}
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>

        <section className="purchase-vat-card">
          <div>
            <p className="purchase-vat-label">VAT Setting</p>
            <div className="purchase-vat-options" role="radiogroup" aria-label="Sales VAT setting">
              {vatOptions.map((option) => (
                <label
                  key={option.value}
                  className={vatMode === option.value ? "purchase-vat-option active" : "purchase-vat-option"}
                >
                  <input
                    type="radio"
                    name="sales-vat-mode"
                    value={option.value}
                    checked={vatMode === option.value}
                    onChange={(event) => setVatMode(event.target.value)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        </section>

        <div className="sales-summary-card">
          <div className="sales-summary-row">
            <span>Total</span>
            <span>{fmt(vatSummary.total)}</span>
          </div>
          <div className="sales-summary-row">
            <span>VAT (7%)</span>
            <span>{fmt(vatSummary.vat)}</span>
          </div>
          <div className="sales-summary-row sales-summary-grand">
            <strong>Grand Total</strong>
            <strong>{fmt(vatSummary.grandTotal)}</strong>
          </div>
        </div>

        <button className="primary-button" type="submit" disabled={!products.length}>
          Save Sale
        </button>
      </form>
    </section>
  );
}

export default SalesForm;
