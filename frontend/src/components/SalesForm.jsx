import { useEffect, useMemo, useRef, useState } from "react";
import { applySaleStatusToItems, getSaleStatusFromItems } from "../saleStatus";
import { formatSaleStockIssueMessage, getSaleStockIssues } from "../saleStock";
import {
  buildConvertedItemFields,
  getProductDefaultSalesUnit,
  getProductUnitOptions,
} from "../unitConversion";

const VAT_RATE = 0.07;
const vatOptions = [
  { value: "included", label: "VAT Included" },
  { value: "not_included", label: "VAT Not Included" },
  { value: "none", label: "No VAT" },
];
const defaultCustomerOptions = [];

function getToday() {
  return new Date().toISOString().split("T")[0];
}

function getSalesReferencePrefix(date = new Date()) {
  const buddhistYear = date.getFullYear() + 543;
  const yearSuffix = `${buddhistYear}`.slice(-2);
  const month = `${date.getMonth() + 1}`.padStart(2, "0");

  return `TI-${yearSuffix}${month}`;
}

function getNextSalesReference(sales = [], date = new Date()) {
  const prefix = getSalesReferencePrefix(date);
  const referencePattern = new RegExp(`^${prefix}-(\\d{3})$`);
  const maxSerial = sales.reduce((max, sale) => {
    const match = `${sale.reference_no || ""}`.match(referencePattern);

    if (!match) {
      return max;
    }

    return Math.max(max, Number(match[1]));
  }, 0);
  const nextSerial = maxSerial >= 999 ? 1 : maxSerial + 1;

  return `${prefix}-${`${nextSerial}`.padStart(3, "0")}`;
}

function createInitialForm(referenceNo) {
  return {
    reference_no: referenceNo,
    customer_name: "",
    status: "draft",
    payment_timing: "instant",
    payment_received_date: getToday(),
    transaction_date: getToday(),
    note: "",
    documents: [],
  };
}

function emptyItem() {
  return {
    line_id: `sales-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    product_id: "",
    item_status: "pending",
    shipped_date: "",
    delivered_date: "",
    unit: "pcs",
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

function getProductName(product) {
  return product.name || product.productName || product.product_name || product.sku || `Product ${product.id}`;
}

function getProductSku(product) {
  return product.sku || product.SKU || "";
}

function getProductUnit(product) {
  return getProductDefaultSalesUnit(product);
}

function showStockAlert(message) {
  if (message && typeof window !== "undefined") {
    window.alert(message);
  }
}

function SalesForm({
  products,
  customers = defaultCustomerOptions,
  purchases = [],
  sales = [],
  onSubmit,
  onCancel = null,
}) {
  const nextReferenceNo = useMemo(
    () => getNextSalesReference(sales),
    [sales]
  );
  const lastGeneratedReference = useRef(nextReferenceNo);
  const [form, setForm] = useState(() => createInitialForm(nextReferenceNo));
  const [items, setItems] = useState([emptyItem()]);
  const [vatMode, setVatMode] = useState("not_included");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerError, setCustomerError] = useState("");
  const [statusError, setStatusError] = useState("");
  const [draggedItemIndex, setDraggedItemIndex] = useState(null);
  const filteredCustomers = useMemo(() => {
    const normalizedQuery = customerQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return customers;
    }

    return customers.filter((customer) =>
      customer.companyName.toLowerCase().includes(normalizedQuery)
    );
  }, [customerQuery, customers]);

  useEffect(() => {
    setForm((currentForm) => {
      const shouldRefreshReference =
        !currentForm.reference_no ||
        currentForm.reference_no === lastGeneratedReference.current;

      lastGeneratedReference.current = nextReferenceNo;

      if (!shouldRefreshReference) {
        return currentForm;
      }

      return { ...currentForm, reference_no: nextReferenceNo };
    });
  }, [nextReferenceNo]);

  const stockPreviewItems = useMemo(
    () =>
      items
        .filter((item) => item.product_id && item.quantity)
        .map((item) => {
          const selectedProduct = products.find(
            (product) => `${product.id}` === `${item.product_id}`
          );

          return {
            product_id: item.product_id,
            product_name: selectedProduct ? getProductName(selectedProduct) : item.product_name,
            sku: selectedProduct ? getProductSku(selectedProduct) : item.sku,
            ...(selectedProduct
              ? buildConvertedItemFields(selectedProduct, item.quantity, item.unit, "sale")
              : {
                  unit: item.unit || "pcs",
                  base_unit: item.unit || "pcs",
                  conversion_factor: 1,
                  base_quantity: Number(item.quantity) || 0,
                }),
            quantity: Number(item.quantity) || 0,
          };
        }),
    [items, products]
  );
  const saleStockIssues = useMemo(
    () =>
      getSaleStockIssues(
        {
          status: form.status,
          items: stockPreviewItems,
        },
        products,
        purchases,
        sales
      ),
    [form.status, products, purchases, sales, stockPreviewItems]
  );
  const saleStockMessage =
    !["draft", "cancelled"].includes(form.status) && saleStockIssues.length
      ? formatSaleStockIssueMessage(saleStockIssues)
      : "";

  useEffect(() => {
    if (!saleStockIssues.length) {
      setStatusError("");
    }
  }, [saleStockIssues]);

  function updateForm(key, value) {
    setForm((currentForm) => ({ ...currentForm, [key]: value }));
  }

  function handleStatusChange(nextStatus) {
    const nextIssues = getSaleStockIssues(
      {
        status: nextStatus,
        items: stockPreviewItems,
      },
      products,
      purchases,
      sales
    );

    if (!["draft", "cancelled"].includes(nextStatus) && nextIssues.length) {
      const message = formatSaleStockIssueMessage(nextIssues);
      updateForm("status", "draft");
      setStatusError(message);
      showStockAlert(message);
      return;
    }

    setStatusError("");
    updateForm("status", nextStatus);
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

  function updateProduct(itemIndex, productId) {
    const selectedProduct = products.find((product) => `${product.id}` === `${productId}`);

    setItems((current) =>
      current.map((item, i) =>
        i === itemIndex
          ? {
              ...item,
              product_id: productId,
              unit: selectedProduct ? getProductUnit(selectedProduct) : "pcs",
            }
          : item
      )
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

  function reorderItems(fromIndex, toIndex) {
    if (fromIndex === toIndex) {
      return;
    }

    setItems((currentItems) => {
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= currentItems.length ||
        toIndex >= currentItems.length
      ) {
        return currentItems;
      }

      const nextItems = [...currentItems];
      const [movedItem] = nextItems.splice(fromIndex, 1);
      nextItems.splice(toIndex, 0, movedItem);
      return nextItems;
    });
  }

  function handleItemDragStart(event, index) {
    setDraggedItemIndex(index);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", `${index}`);
  }

  function handleItemDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  function handleItemDrop(event, index) {
    event.preventDefault();
    event.stopPropagation();
    const transferredIndex = Number(event.dataTransfer.getData("text/plain"));
    const fromIndex =
      draggedItemIndex !== null ? draggedItemIndex : transferredIndex;

    if (Number.isInteger(fromIndex)) {
      reorderItems(fromIndex, index);
    }

    setDraggedItemIndex(null);
  }

  function handleItemDragEnd() {
    setDraggedItemIndex(null);
  }

  function selectCustomer(customer) {
    setForm((currentForm) => ({
      ...currentForm,
      customer_name: customer.companyName,
    }));
    setCustomerQuery(customer.companyName);
    setCustomerError("");
    setCustomerOpen(false);
  }

  function resolveCustomerName() {
    const selectedCustomer = customers.find(
      (customer) => customer.companyName === form.customer_name
    );

    if (selectedCustomer) {
      return selectedCustomer.companyName;
    }

    const exactMatch = customers.find(
      (customer) =>
        customer.companyName.toLowerCase() === customerQuery.trim().toLowerCase()
    );

    return exactMatch?.companyName || "";
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const customerName = resolveCustomerName();
    const requestedStatus =
      !["draft", "cancelled"].includes(form.status) && saleStockIssues.length
        ? "draft"
        : form.status;

    if (!customerName) {
      setCustomerError("Select an existing customer from the list.");
      setCustomerOpen(true);
      return;
    }

    const formData = new FormData();
    formData.append("reference_no", form.reference_no);
    formData.append("customer_name", customerName);
    formData.append("status", requestedStatus);
    formData.append("transaction_date", form.transaction_date);
    formData.append("payment_received_date", form.payment_received_date);
    formData.append("note", form.note);
    formData.append("vat_mode", vatMode);
    formData.append("total_before_vat", vatSummary.total);
    formData.append("vat_amount", vatSummary.vat);
    formData.append("grand_total", vatSummary.grandTotal);

    form.documents.forEach((document) => {
      formData.append("documents", document);
    });

    const filteredItems = items
      .filter((item) => item.product_id && item.quantity && item.unit_price)
      .map((item) => {
        const { line_id, ...itemPayload } = item;
        const selectedProduct = products.find(
          (product) => `${product.id}` === `${item.product_id}`
        );

        return {
          ...itemPayload,
          product_name: selectedProduct ? getProductName(selectedProduct) : item.product_name,
          sku: selectedProduct ? getProductSku(selectedProduct) : item.sku,
          ...(selectedProduct
            ? buildConvertedItemFields(selectedProduct, item.quantity, item.unit, "sale")
            : {}),
          amount: computeAmount(item),
        };
      });
    const saleWithItems = applySaleStatusToItems(
      {
        status: requestedStatus,
        items: filteredItems,
      },
      requestedStatus
    );
    formData.set("status", getSaleStatusFromItems(saleWithItems));
    formData.append("items", JSON.stringify(saleWithItems.items));

    const saved = await onSubmit(formData);

    if (saved === false) {
      return;
    }

    setForm(createInitialForm(lastGeneratedReference.current));
    setItems([emptyItem()]);
    setVatMode("not_included");
    setCustomerQuery("");
    setCustomerError("");
    setStatusError("");
    setDraggedItemIndex(null);
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
        {onCancel ? (
          <button className="secondary-button" type="button" onClick={onCancel}>
            Close
          </button>
        ) : null}
      </div>

      <form className="form-layout" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label>
            Reference No.
            <input
              value={form.reference_no}
              readOnly
              placeholder={nextReferenceNo}
            />
          </label>

          <label className="supplier-combobox-field">
            Customer Name
            <div className="supplier-combobox">
              <input
                value={customerQuery}
                onChange={(event) => {
                  setCustomerQuery(event.target.value);
                  updateForm("customer_name", "");
                  setCustomerError("");
                  setCustomerOpen(true);
                }}
                onFocus={() => setCustomerOpen(true)}
                onBlur={() => {
                  window.setTimeout(() => setCustomerOpen(false), 120);
                }}
                placeholder="Search existing customer"
                autoComplete="off"
                aria-expanded={customerOpen}
                aria-controls="sales-customer-list"
                aria-invalid={customerError ? "true" : "false"}
              />

              {customerOpen ? (
                <div className="supplier-combobox-menu" id="sales-customer-list" role="listbox">
                  {filteredCustomers.length ? (
                    filteredCustomers.map((customer) => (
                      <button
                        key={customer.id}
                        type="button"
                        className={
                          customer.companyName === form.customer_name
                            ? "supplier-combobox-option active"
                            : "supplier-combobox-option"
                        }
                        onMouseDown={(event) => {
                          event.preventDefault();
                          selectCustomer(customer);
                        }}
                        role="option"
                        aria-selected={customer.companyName === form.customer_name}
                      >
                        {customer.companyName}
                      </button>
                    ))
                  ) : (
                    <div className="supplier-combobox-empty">
                      No customer found. Add it in Customer page first.
                    </div>
                  )}
                </div>
              ) : null}
            </div>
            {customerError ? <span className="field-error-text">{customerError}</span> : null}
          </label>

          <label>
            Status
            <select
              value={form.status}
              onChange={(event) => handleStatusChange(event.target.value)}
            >
              <option value="draft">Draft</option>
              <option value="packed">Packed</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
            {statusError || saleStockMessage ? (
              <span className="field-error-text">{statusError || saleStockMessage}</span>
            ) : null}
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

          <div className="transaction-document-panel full-width">
            <div className="transaction-document-panel-header">
              <div>
                <strong>Documents</strong>
                <span>
                  {form.documents.length
                    ? `${form.documents.length} selected`
                    : "No documents selected"}
                </span>
              </div>
              <label className="document-upload-button">
                Add Files
                <input
                  type="file"
                  multiple
                  onChange={(event) =>
                    updateForm("documents", [
                      ...form.documents,
                      ...Array.from(event.target.files || []),
                    ])
                  }
                />
              </label>
            </div>

            {form.documents.length ? (
              <div className="transaction-document-list">
                {form.documents.map((document, index) => (
                  <span className="transaction-document-row" key={`${document.name}-${index}`}>
                    <span>{document.name}</span>
                    <button
                      className="text-danger-button"
                      type="button"
                      onClick={() =>
                        updateForm(
                          "documents",
                          form.documents.filter((_, documentIndex) => documentIndex !== index)
                        )
                      }
                    >
                      Remove
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="transaction-document-empty">Attach invoices, receipts, or related files.</p>
            )}
          </div>
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
            const selectedProduct = products.find(
              (product) => `${product.id}` === `${item.product_id}`
            );
            const unitOptions = selectedProduct
              ? getProductUnitOptions(selectedProduct, "sale")
              : [];
            const conversionPreview = selectedProduct
              ? buildConvertedItemFields(selectedProduct, item.quantity, item.unit, "sale")
              : null;

            return (
              <div
                className={
                  draggedItemIndex !== null && draggedItemIndex !== index
                    ? "line-item-row sales-line-item-row is-drop-target"
                    : "line-item-row sales-line-item-row"
                }
                key={item.line_id}
                onDragOverCapture={handleItemDragOver}
                onDropCapture={(event) => handleItemDrop(event, index)}
              >
                <div
                  className={
                    draggedItemIndex === index
                      ? "line-item-index is-dragging"
                      : "line-item-index"
                  }
                  draggable={items.length > 1}
                  title={items.length > 1 ? "Drag to reorder" : "Item order"}
                  aria-label={`Item ${index + 1}. Drag to reorder`}
                  onDragStart={(event) => handleItemDragStart(event, index)}
                  onDragEnd={handleItemDragEnd}
                >
                  {index + 1}
                </div>

                <label className="purchase-item-field sales-item-product">
                  <span>Product</span>
                  <select
                    value={item.product_id}
                    onChange={(event) => updateProduct(index, event.target.value)}
                    required
                  >
                    <option value="">Select product</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {getProductSku(product)
                          ? `${getProductName(product)} (${getProductSku(product)})`
                          : getProductName(product)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="purchase-item-field sales-item-unit">
                  <span>Unit</span>
                  <select
                    value={item.unit}
                    onChange={(event) => updateItem(index, "unit", event.target.value)}
                    disabled={!selectedProduct}
                  >
                    {unitOptions.length ? (
                      unitOptions.map((conversion) => (
                        <option key={conversion.unit} value={conversion.unit}>
                          {conversion.unit}
                        </option>
                      ))
                    ) : (
                      <option value={item.unit || "pcs"}>{item.unit || "pcs"}</option>
                    )}
                  </select>
                  {conversionPreview ? (
                    <span className="unit-conversion-preview">
                      {conversionPreview.base_quantity} {conversionPreview.base_unit}
                    </span>
                  ) : null}
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

        <button className="primary-button" type="submit">
          Save Sale
        </button>
      </form>
    </section>
  );
}

export default SalesForm;
