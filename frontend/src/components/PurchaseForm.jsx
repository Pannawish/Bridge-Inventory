import { useState } from "react";

const today = new Date().toISOString().split("T")[0];

function emptyItem() {
  return {
    product_name: "",
    sku: "",
    category: "",
    unit: "pcs",
    quantity: 1,
    unit_cost: "",
  };
}

function PurchaseForm({ onSubmit }) {
  const [form, setForm] = useState({
    reference_no: "",
    supplier_name: "",
    status: "ordered",
    transaction_date: today,
    note: "",
    document: null,
  });
  const [items, setItems] = useState([emptyItem()]);

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
    formData.append("supplier_name", form.supplier_name);
    formData.append("status", form.status);
    formData.append("transaction_date", form.transaction_date);
    formData.append("note", form.note);

    if (form.document) {
      formData.append("document", form.document);
    }

    const filteredItems = items.filter(
      (item) =>
        item.product_name &&
        item.sku &&
        item.quantity &&
        item.unit_cost
    );
    formData.append("items", JSON.stringify(filteredItems));

    await onSubmit(formData);

    setForm({
      reference_no: "",
      supplier_name: "",
      status: "ordered",
      transaction_date: today,
      note: "",
      document: null,
    });
    setItems([emptyItem()]);
  }

  return (
    <section className="section-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Purchase Entry</p>
          <h3>Add Purchase Transaction</h3>
        </div>
      </div>

      <form className="form-layout" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label>
            Reference No.
            <input
              value={form.reference_no}
              onChange={(event) =>
                setForm({ ...form, reference_no: event.target.value })
              }
              placeholder="PO-001"
            />
          </label>

          <label>
            Supplier Name
            <input
              value={form.supplier_name}
              onChange={(event) =>
                setForm({ ...form, supplier_name: event.target.value })
              }
              required
            />
          </label>

          <label>
            Status
            <select
              value={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.value })}
            >
              <option value="draft">Draft</option>
              <option value="ordered">Ordered</option>
              <option value="received">Received</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>

          <label>
            Date
            <input
              type="date"
              value={form.transaction_date}
              onChange={(event) =>
                setForm({ ...form, transaction_date: event.target.value })
              }
            />
          </label>

          <label className="full-width">
            Notes
            <textarea
              rows="3"
              value={form.note}
              onChange={(event) => setForm({ ...form, note: event.target.value })}
            />
          </label>

          <label className="full-width">
            Document
            <input
              type="file"
              onChange={(event) =>
                setForm({ ...form, document: event.target.files?.[0] || null })
              }
            />
          </label>
        </div>

        <div className="line-items-card">
          <div className="line-items-header">
            <h4>Purchase Items</h4>
            <button className="secondary-button" type="button" onClick={addItem}>
              Add Item
            </button>
          </div>

          {items.map((item, index) => (
            <div className="line-item-row" key={`${item.sku || "new-item"}-${index}`}>
              <input
                value={item.product_name}
                onChange={(event) =>
                  updateItem(index, "product_name", event.target.value)
                }
                placeholder="Product Name"
                required
              />

              <input
                value={item.sku}
                onChange={(event) => updateItem(index, "sku", event.target.value)}
                placeholder="SKU"
                required
              />

              <input
                value={item.category}
                onChange={(event) => updateItem(index, "category", event.target.value)}
                placeholder="Category"
              />

              <input
                value={item.unit}
                onChange={(event) => updateItem(index, "unit", event.target.value)}
                placeholder="Unit"
              />

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
                value={item.unit_cost}
                onChange={(event) => updateItem(index, "unit_cost", event.target.value)}
                placeholder="Unit Cost"
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

        <button className="primary-button" type="submit">
          Save Purchase
        </button>
      </form>
    </section>
  );
}

export default PurchaseForm;
