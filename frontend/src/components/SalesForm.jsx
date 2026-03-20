import { useState } from "react";

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
  };
}

function SalesForm({ products, onSubmit }) {
  const [form, setForm] = useState(createInitialForm());
  const [items, setItems] = useState([emptyItem()]);

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

  function updateItem(index, key, value) {
    setItems((currentItems) =>
      currentItems.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item
      )
    );
  }

  function addItem() {
    setItems((currentItems) => [...currentItems, emptyItem()]);
  }

  function removeItem(index) {
    setItems((currentItems) => currentItems.filter((_, itemIndex) => itemIndex !== index));
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

    if (form.document) {
      formData.append("document", form.document);
    }

    const filteredItems = items.filter((item) => item.product_id && item.quantity && item.unit_price);
    formData.append("items", JSON.stringify(filteredItems));

    await onSubmit(formData);

    setForm(createInitialForm());
    setItems([emptyItem()]);
  }

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

          {items.map((item, index) => (
            <div className="line-item-row" key={`${item.product_id}-${index}`}>
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

              <input
                type="number"
                min="1"
                value={item.quantity}
                onChange={(event) => updateItem(index, "quantity", event.target.value)}
                placeholder="Quantity"
                required
              />

              <input
                type="number"
                min="0"
                step="0.01"
                value={item.unit_price}
                onChange={(event) => updateItem(index, "unit_price", event.target.value)}
                placeholder="Unit Price"
                required
              />

              <button
                className="danger-button"
                type="button"
                onClick={() => removeItem(index)}
                disabled={items.length === 1}
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <button className="primary-button" type="submit" disabled={!products.length}>
          Save Sale
        </button>
      </form>
    </section>
  );
}

export default SalesForm;
