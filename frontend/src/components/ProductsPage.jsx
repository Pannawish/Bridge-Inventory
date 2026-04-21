import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "inventory-management-products";

function createProduct(overrides = {}) {
  return {
    id: `product-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    productDisplayId: 1001,
    sku: "",
    productName: "",
    detail: "",
    pictureUrl: "",
    cost: 0,
    unit: "",
    tax: 1.07,
    amount: 0,
    discount: 0,
    ...overrides,
  };
}

const defaultProducts = [
  createProduct({
    id: "product-1",
    productDisplayId: 1001,
    sku: "NB-A5-001",
    productName: "Notebook A5",
    detail: "Standard A5 spiral notebook, 80 pages, ruled. Suitable for students and office use.",
    pictureUrl: "",
    cost: 18,
    unit: "piece",
    tax: 1.07,
    amount: 4,
    discount: 0.1,
  }),
  createProduct({
    id: "product-2",
    productDisplayId: 1002,
    sku: "PEN-BL-014",
    productName: "Blue Ballpoint Pen",
    detail: "Medium tip blue ballpoint pen. Smooth writing, long-lasting ink.",
    pictureUrl: "",
    cost: 5.5,
    unit: "piece",
    tax: 1.07,
    amount: 8,
    discount: 0.05,
  }),
  createProduct({
    id: "product-3",
    productDisplayId: 1003,
    sku: "STP-MN-009",
    productName: "Mini Stapler",
    detail: "Compact desktop stapler. Accepts standard 26/6 staples. Capacity up to 20 sheets.",
    pictureUrl: "",
    cost: 48,
    unit: "piece",
    tax: 1.07,
    amount: 2,
    discount: 0.15,
  }),
  createProduct({
    id: "product-4",
    productDisplayId: 1004,
    sku: "STK-NT-022",
    productName: "Sticky Notes Set",
    detail: "Pack of 4 sticky note pads, 100 sheets each. Assorted colors.",
    pictureUrl: "",
    cost: 22,
    unit: "pack",
    tax: 1.07,
    amount: 36,
    discount: 0,
  }),
];

function normalizeProduct(product) {
  return {
    id: product.id || `product-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    productDisplayId: Math.max(1, Math.round(Number(product.productDisplayId) || 1001)),
    sku: `${product.sku ?? ""}`,
    productName: `${product.productName ?? ""}`,
    detail: `${product.detail ?? ""}`,
    pictureUrl: `${product.pictureUrl ?? ""}`,
    cost: Math.max(0, Number(product.cost) || 0),
    unit: `${product.unit ?? ""}`,
    tax: Math.max(1, Number(product.tax) || 1.07),
    amount: Math.max(0, Math.round(Number(product.amount) || 0)),
    discount: Math.min(1, Math.max(0, Number(product.discount) || 0)),
  };
}

function loadProducts() {
  if (typeof window === "undefined") {
    return defaultProducts;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return defaultProducts;
    }

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed) || parsed.length === 0) {
      return defaultProducts;
    }

    return parsed.map(normalizeProduct);
  } catch {
    return defaultProducts;
  }
}

function formatCurrency(value) {
  return `฿${Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function ProductsPage({ purchases = [], sales = [] }) {
  const [products, setProducts] = useState(() => loadProducts());
  const [viewingProduct, setViewingProduct] = useState(null);
  const [viewingTransaction, setViewingTransaction] = useState(null);
  const [draftProduct, setDraftProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(products.map(normalizeProduct))
    );
  }, [products]);

  useEffect(() => {
    const isOpen = !!(viewingProduct || viewingTransaction || draftProduct);

    if (typeof document === "undefined" || !isOpen) {
      return undefined;
    }

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prev;
    };
  }, [viewingProduct, viewingTransaction, draftProduct]);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredProducts = useMemo(
    () =>
      products.filter((product) => {
        if (!normalizedSearch) {
          return true;
        }

        return (
          product.productName.toLowerCase().includes(normalizedSearch) ||
          product.sku.toLowerCase().includes(normalizedSearch) ||
          `${product.productDisplayId}`.includes(normalizedSearch) ||
          product.unit.toLowerCase().includes(normalizedSearch)
        );
      }),
    [normalizedSearch, products]
  );

  function openProductDetail(product) {
    setViewingProduct(product);
    setViewingTransaction(null);
    setDraftProduct(null);
  }

  function closeAll() {
    setViewingProduct(null);
    setViewingTransaction(null);
  }

  function openTransactionDetail(type, data) {
    setViewingTransaction({ type, data });
  }

  function backToProduct() {
    setViewingTransaction(null);
  }

  function openProductEditor(product) {
    setViewingProduct(null);
    setViewingTransaction(null);
    setDraftProduct({
      ...product,
      cost: product.cost.toString(),
      tax: product.tax.toString(),
      amount: product.amount.toString(),
      discount: product.discount.toString(),
    });
  }

  function closeProductEditor() {
    setDraftProduct(null);
  }

  function updateDraftField(key, value) {
    setDraftProduct((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function handleCreateProduct() {
    const nextDisplayId =
      products.length === 0
        ? 1001
        : Math.max(...products.map((p) => p.productDisplayId)) + 1;

    setViewingProduct(null);
    setViewingTransaction(null);
    setDraftProduct({
      ...createProduct({ productDisplayId: nextDisplayId }),
      cost: "0",
      tax: "1.07",
      amount: "0",
      discount: "0",
    });
  }

  function handleSaveProduct() {
    if (!draftProduct) {
      return;
    }

    const nextProduct = normalizeProduct(draftProduct);
    const exists = products.some((p) => p.id === nextProduct.id);

    setProducts((current) =>
      exists
        ? current.map((p) => (p.id === nextProduct.id ? nextProduct : p))
        : [nextProduct, ...current]
    );
    setDraftProduct(null);
  }

  function handleDeleteProduct() {
    if (!draftProduct) {
      return;
    }

    const exists = products.some((p) => p.id === draftProduct.id);

    if (!exists) {
      setDraftProduct(null);
      return;
    }

    const confirmed = window.confirm(
      `Delete product ${draftProduct.productName || "this product"}?`
    );

    if (!confirmed) {
      return;
    }

    setProducts((current) => current.filter((p) => p.id !== draftProduct.id));
    setDraftProduct(null);
  }

  function getPurchaseHistory(productName) {
    return purchases.flatMap((purchase) =>
      purchase.items
        .filter((item) => item.product_name.toLowerCase() === productName.toLowerCase())
        .map((item) => ({ purchase, item }))
    );
  }

  function getSalesHistory(productName) {
    return sales.flatMap((sale) =>
      sale.items
        .filter((item) => item.product_name.toLowerCase() === productName.toLowerCase())
        .map((item) => ({ sale, item }))
    );
  }

  const summary = {
    totalProducts: products.length,
    totalUnits: products.reduce((sum, p) => sum + p.amount, 0),
    totalValue: products.reduce(
      (sum, p) => sum + p.cost * (1 - p.discount) * p.amount,
      0
    ),
    outOfStock: products.filter((p) => p.amount === 0).length,
  };

  const draftCost = Number(draftProduct?.cost) || 0;
  const draftDiscount = Math.min(1, Math.max(0, Number(draftProduct?.discount) || 0));
  const draftDiscountedCost = draftCost * (1 - draftDiscount);

  const viewPurchaseHistory = viewingProduct
    ? getPurchaseHistory(viewingProduct.productName)
    : [];
  const viewSalesHistory = viewingProduct
    ? getSalesHistory(viewingProduct.productName)
    : [];

  return (
    <div className="stack-layout">
      <section className="inventory-summary-grid">
        <article className="inventory-summary-card">
          <span>Total products</span>
          <strong>{summary.totalProducts}</strong>
        </article>
        <article className="inventory-summary-card">
          <span>Total stock units</span>
          <strong>{summary.totalUnits}</strong>
        </article>
        <article className="inventory-summary-card">
          <span>Total inventory value</span>
          <strong>{formatCurrency(summary.totalValue)}</strong>
        </article>
        <article className="inventory-summary-card">
          <span>Out of stock</span>
          <strong>{summary.outOfStock}</strong>
        </article>
      </section>

      <div className="supplier-layout">
        <section className="section-card supplier-directory-card">
          <div className="section-heading supplier-directory-heading">
            <div>
              <p className="eyebrow">Products</p>
              <h3>Product Catalog</h3>
            </div>
            <button className="primary-button" type="button" onClick={handleCreateProduct}>
              New Product
            </button>
          </div>

          <p className="inventory-note">
            Click a product to view its purchase and sales history.
          </p>

          <div className="supplier-directory-toolbar">
            <label className="stock-search supplier-search">
              <span className="stock-search-icon">S</span>
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by name, SKU, ID, or unit"
              />
            </label>
            <div className="stock-report-summary supplier-search-meta">
              <span>{filteredProducts.length} products shown</span>
            </div>
          </div>

          <div className="supplier-list">
            {filteredProducts.length === 0 ? (
              <p className="empty-copy">No products match the current search.</p>
            ) : (
              filteredProducts.map((product) => {
                const avgPrice = product.cost * (1 - product.discount);

                return (
                  <button
                    key={product.id}
                    type="button"
                    className="supplier-list-item product-list-card"
                    onClick={() => openProductDetail(product)}
                  >
                    <strong className="product-card-name">
                      {product.productName || "Unnamed Product"}
                    </strong>
                    <div className="product-card-stats">
                      <div className="product-card-stat">
                        <span>SKU</span>
                        <strong>{product.sku || "—"}</strong>
                      </div>
                      <div className="product-card-stat">
                        <span>Total Units</span>
                        <strong>
                          {product.amount}
                          {product.unit ? ` ${product.unit}` : ""}
                        </strong>
                      </div>
                      <div className="product-card-stat">
                        <span>Avg Price</span>
                        <strong>{formatCurrency(avgPrice)}</strong>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>
      </div>

      {(viewingProduct || viewingTransaction) ? (
        <div className="modal-backdrop">
          {viewingTransaction ? (
            <div
              className="detail-modal product-detail-modal section-card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="transaction-detail-title"
            >
              <div className="section-heading supplier-modal-header">
                <div>
                  <p className="eyebrow">
                    {viewingTransaction.type === "purchase" ? "Purchase Transaction" : "Sales Transaction"}
                  </p>
                  <h3 id="transaction-detail-title">
                    {viewingTransaction.type === "purchase"
                      ? viewingTransaction.data.reference_no
                      : viewingTransaction.data.reference_no}
                  </h3>
                </div>
                <div className="product-detail-header-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={backToProduct}
                  >
                    ← Back
                  </button>
                  <button
                    className="icon-button subtle"
                    type="button"
                    aria-label="Close"
                    onClick={closeAll}
                  >
                    X
                  </button>
                </div>
              </div>

              <div className="product-detail-body">
                {viewingTransaction.type === "purchase" ? (
                  <>
                    <div className="detail-grid">
                      <div>
                        <p className="detail-label">Reference</p>
                        <p>{viewingTransaction.data.reference_no}</p>
                      </div>
                      <div>
                        <p className="detail-label">Supplier</p>
                        <p>{viewingTransaction.data.supplier_name}</p>
                      </div>
                      <div>
                        <p className="detail-label">Date</p>
                        <p>{viewingTransaction.data.transaction_date}</p>
                      </div>
                      <div>
                        <p className="detail-label">Status</p>
                        <p>
                          <span className={`status-badge status-${viewingTransaction.data.status}`}>
                            {viewingTransaction.data.status}
                          </span>
                        </p>
                      </div>
                      <div>
                        <p className="detail-label">Total Amount</p>
                        <p>{formatCurrency(viewingTransaction.data.total_amount)}</p>
                      </div>
                      {viewingTransaction.data.note ? (
                        <div className="full-width">
                          <p className="detail-label">Note</p>
                          <p>{viewingTransaction.data.note}</p>
                        </div>
                      ) : null}
                    </div>

                    <div className="product-detail-section">
                      <p className="detail-label">Items in this Purchase</p>
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Product</th>
                              <th>Qty</th>
                              <th>Unit Cost</th>
                              <th>Line Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {viewingTransaction.data.items.map((item) => {
                              const isHighlighted =
                                viewingProduct &&
                                item.product_name.toLowerCase() ===
                                  viewingProduct.productName.toLowerCase();
                              return (
                                <tr
                                  key={item.id}
                                  className={isHighlighted ? "transaction-row-highlight" : ""}
                                >
                                  <td>{item.product_name}</td>
                                  <td>{item.quantity}</td>
                                  <td>{formatCurrency(item.unit_cost)}</td>
                                  <td>{formatCurrency(item.quantity * item.unit_cost)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="detail-grid">
                      <div>
                        <p className="detail-label">Reference</p>
                        <p>{viewingTransaction.data.reference_no}</p>
                      </div>
                      <div>
                        <p className="detail-label">Customer</p>
                        <p>{viewingTransaction.data.customer_name}</p>
                      </div>
                      <div>
                        <p className="detail-label">Date</p>
                        <p>{viewingTransaction.data.transaction_date}</p>
                      </div>
                      <div>
                        <p className="detail-label">Status</p>
                        <p>
                          <span className={`status-badge status-${viewingTransaction.data.status}`}>
                            {viewingTransaction.data.status}
                          </span>
                        </p>
                      </div>
                      <div>
                        <p className="detail-label">Total Amount</p>
                        <p>{formatCurrency(viewingTransaction.data.total_amount)}</p>
                      </div>
                      {viewingTransaction.data.payment_received_date ? (
                        <div>
                          <p className="detail-label">Payment Received</p>
                          <p>{viewingTransaction.data.payment_received_date}</p>
                        </div>
                      ) : null}
                      {viewingTransaction.data.note ? (
                        <div className="full-width">
                          <p className="detail-label">Note</p>
                          <p>{viewingTransaction.data.note}</p>
                        </div>
                      ) : null}
                    </div>

                    <div className="product-detail-section">
                      <p className="detail-label">Items in this Sale</p>
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Product</th>
                              <th>Qty</th>
                              <th>Unit Price</th>
                              <th>Line Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {viewingTransaction.data.items.map((item) => {
                              const isHighlighted =
                                viewingProduct &&
                                item.product_name.toLowerCase() ===
                                  viewingProduct.productName.toLowerCase();
                              return (
                                <tr
                                  key={item.id}
                                  className={isHighlighted ? "transaction-row-highlight" : ""}
                                >
                                  <td>{item.product_name}</td>
                                  <td>{item.quantity}</td>
                                  <td>{formatCurrency(item.unit_price)}</td>
                                  <td>{formatCurrency(item.quantity * item.unit_price)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div
              className="detail-modal product-detail-modal section-card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="product-history-title"
            >
              <div className="section-heading supplier-modal-header">
                <div>
                  <p className="eyebrow">Product History</p>
                  <h3 id="product-history-title">{viewingProduct.productName || "Product"}</h3>
                </div>
                <div className="product-detail-header-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => openProductEditor(viewingProduct)}
                  >
                    Edit
                  </button>
                  <button
                    className="icon-button subtle"
                    type="button"
                    aria-label="Close"
                    onClick={closeAll}
                  >
                    X
                  </button>
                </div>
              </div>

              <div className="product-history-info-strip">
                <div className="product-history-stat">
                  <span>SKU</span>
                  <strong>{viewingProduct.sku || "—"}</strong>
                </div>
                <div className="product-history-stat">
                  <span>Total Units</span>
                  <strong>
                    {viewingProduct.amount}
                    {viewingProduct.unit ? ` ${viewingProduct.unit}` : ""}
                  </strong>
                </div>
                <div className="product-history-stat">
                  <span>Avg Price</span>
                  <strong>
                    {formatCurrency(viewingProduct.cost * (1 - viewingProduct.discount))}
                  </strong>
                </div>
                <div className="product-history-stat">
                  <span>Discount</span>
                  <strong>{Math.round(viewingProduct.discount * 100)}%</strong>
                </div>
              </div>

              <div className="product-detail-body">
                <div className="product-detail-section">
                  <p className="detail-label">Purchase History</p>
                  {viewPurchaseHistory.length === 0 ? (
                    <p className="empty-copy">No purchase history found for this product.</p>
                  ) : (
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Reference</th>
                            <th>Supplier</th>
                            <th>Date</th>
                            <th>Qty</th>
                            <th>Unit Cost</th>
                            <th>Line Total</th>
                            <th>Status</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {viewPurchaseHistory.map(({ purchase, item }) => (
                            <tr key={`${purchase.id}-${item.id}`}>
                              <td>{purchase.reference_no}</td>
                              <td>{purchase.supplier_name}</td>
                              <td>{purchase.transaction_date}</td>
                              <td>{item.quantity}</td>
                              <td>{formatCurrency(item.unit_cost)}</td>
                              <td>{formatCurrency(item.quantity * item.unit_cost)}</td>
                              <td>
                                <span className={`status-badge status-${purchase.status}`}>
                                  {purchase.status}
                                </span>
                              </td>
                              <td>
                                <button
                                  className="table-action-button"
                                  type="button"
                                  onClick={() => openTransactionDetail("purchase", purchase)}
                                >
                                  View
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="product-detail-section">
                  <p className="detail-label">Sales History</p>
                  {viewSalesHistory.length === 0 ? (
                    <p className="empty-copy">No sales history found for this product.</p>
                  ) : (
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Reference</th>
                            <th>Customer</th>
                            <th>Date</th>
                            <th>Qty</th>
                            <th>Unit Price</th>
                            <th>Line Total</th>
                            <th>Status</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {viewSalesHistory.map(({ sale, item }) => (
                            <tr key={`${sale.id}-${item.id}`}>
                              <td>{sale.reference_no}</td>
                              <td>{sale.customer_name}</td>
                              <td>{sale.transaction_date}</td>
                              <td>{item.quantity}</td>
                              <td>{formatCurrency(item.unit_price)}</td>
                              <td>{formatCurrency(item.quantity * item.unit_price)}</td>
                              <td>
                                <span className={`status-badge status-${sale.status}`}>
                                  {sale.status}
                                </span>
                              </td>
                              <td>
                                <button
                                  className="table-action-button"
                                  type="button"
                                  onClick={() => openTransactionDetail("sale", sale)}
                                >
                                  View
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {draftProduct ? (
        <div className="modal-backdrop">
          <div
            className="detail-modal supplier-modal section-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-modal-title"
          >
            <div className="section-heading supplier-modal-header">
              <div>
                <p className="eyebrow">
                  {products.some((p) => p.id === draftProduct.id) ? "Edit Product" : "New Product"}
                </p>
                <h3 id="product-modal-title">
                  {draftProduct.productName || "New Product"}
                </h3>
              </div>
              <button
                className="icon-button subtle"
                type="button"
                aria-label="Close"
                onClick={closeProductEditor}
              >
                X
              </button>
            </div>

            <form
              className="form-layout"
              onSubmit={(event) => {
                event.preventDefault();
                handleSaveProduct();
              }}
            >
              <div className="form-grid">
                <label className="full-width">
                  Product Name
                  <input
                    autoFocus
                    value={draftProduct.productName}
                    onChange={(event) => updateDraftField("productName", event.target.value)}
                    placeholder="Product name"
                  />
                </label>

                <label>
                  SKU
                  <input
                    value={draftProduct.sku}
                    onChange={(event) => updateDraftField("sku", event.target.value)}
                    placeholder="e.g. NB-A5-001"
                  />
                </label>

                <label>
                  Product ID
                  <input
                    type="number"
                    value={draftProduct.productDisplayId}
                    onChange={(event) =>
                      updateDraftField("productDisplayId", event.target.value)
                    }
                    placeholder="e.g. 1232"
                    min="1"
                  />
                </label>

                <label>
                  Cost (฿)
                  <input
                    type="number"
                    value={draftProduct.cost}
                    onChange={(event) => updateDraftField("cost", event.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </label>

                <label>
                  Unit
                  <input
                    value={draftProduct.unit}
                    onChange={(event) => updateDraftField("unit", event.target.value)}
                    placeholder="e.g. piece, kg, meter"
                  />
                </label>

                <label>
                  Tax Multiplier
                  <input
                    type="number"
                    value={draftProduct.tax}
                    onChange={(event) => updateDraftField("tax", event.target.value)}
                    placeholder="e.g. 1.07 for 7% VAT"
                    min="1"
                    step="0.01"
                  />
                </label>

                <label>
                  Amount in Stock
                  <input
                    type="number"
                    value={draftProduct.amount}
                    onChange={(event) => updateDraftField("amount", event.target.value)}
                    placeholder="0"
                    min="0"
                    step="1"
                  />
                </label>

                <label>
                  Supplier Discount (0.00 – 1.00)
                  <input
                    type="number"
                    value={draftProduct.discount}
                    onChange={(event) => updateDraftField("discount", event.target.value)}
                    placeholder="e.g. 0.10 for 10% off"
                    min="0"
                    max="1"
                    step="0.01"
                  />
                </label>

                <div className="full-width product-price-preview">
                  <p className="detail-label">Price Preview</p>
                  <div className="product-price-row">
                    <span>Original cost</span>
                    <strong>{formatCurrency(draftCost)}</strong>
                  </div>
                  {draftDiscount > 0 ? (
                    <div className="product-price-row">
                      <span>After {Math.round(draftDiscount * 100)}% supplier discount</span>
                      <strong className="product-price-discounted">
                        {formatCurrency(draftDiscountedCost)}
                      </strong>
                    </div>
                  ) : null}
                </div>

                <label className="full-width">
                  Picture URL
                  <input
                    value={draftProduct.pictureUrl}
                    onChange={(event) => updateDraftField("pictureUrl", event.target.value)}
                    placeholder="https://example.com/image.jpg"
                  />
                </label>

                {draftProduct.pictureUrl ? (
                  <div className="full-width">
                    <img
                      src={draftProduct.pictureUrl}
                      alt="Product preview"
                      className="product-picture-preview"
                      onError={(event) => {
                        event.target.style.display = "none";
                      }}
                    />
                  </div>
                ) : null}

                <label className="full-width">
                  Product Detail
                  <textarea
                    rows="4"
                    value={draftProduct.detail}
                    onChange={(event) => updateDraftField("detail", event.target.value)}
                    placeholder="Product description, specifications, or notes"
                  />
                </label>
              </div>

              <div className="supplier-modal-actions">
                <button className="danger-button" type="button" onClick={handleDeleteProduct}>
                  Delete Product
                </button>
                <button className="secondary-button" type="button" onClick={closeProductEditor}>
                  Cancel
                </button>
                <button className="primary-button" type="submit">
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default ProductsPage;
