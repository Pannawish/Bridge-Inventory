import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "inventory-management-products";
const VAT_RATE = 0.07;

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

function computeItemAmount(item) {
  const qty = Number(item.quantity) || 0;
  const price = Number(item.unit_price ?? item.unit_cost) || 0;

  if (item.amount !== undefined && item.amount !== null) {
    return Number(item.amount) || 0;
  }

  if (Array.isArray(item.discounts)) {
    const multiplier = item.discounts.reduce((acc, discount) => {
      const clamped = Math.min(100, Math.max(0, Number(discount) || 0));
      return acc * (1 - clamped / 100);
    }, 1);
    return qty * price * multiplier;
  }

  const discount = Math.min(100, Math.max(0, Number(item.discount) || 0));
  return qty * price * (1 - discount / 100);
}

function renderDiscounts(item) {
  if (Array.isArray(item.discounts)) {
    const activeDiscounts = item.discounts.filter((discount) => Number(discount) > 0);

    if (activeDiscounts.length) {
      return activeDiscounts.map((discount) => `${Number(discount)}%`).join(" → ");
    }
  }

  if (Number(item.discount) > 0) {
    return `${Number(item.discount)}%`;
  }

  return "—";
}

function computeVatSummary(items, vatMode) {
  const itemTotal = items.reduce((sum, item) => sum + computeItemAmount(item), 0);

  if (vatMode === "included") {
    const subtotal = itemTotal / (1 + VAT_RATE);
    const vat = itemTotal - subtotal;
    return { subtotal, vat, grandTotal: itemTotal };
  }

  if (vatMode === "none") {
    return { subtotal: itemTotal, vat: 0, grandTotal: itemTotal };
  }

  const vat = itemTotal * VAT_RATE;
  return { subtotal: itemTotal, vat, grandTotal: itemTotal + vat };
}

function getAveragePrice(product) {
  return Number(product.cost) || 0;
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
      (sum, p) => sum + p.cost * p.amount,
      0
    ),
    outOfStock: products.filter((p) => p.amount === 0).length,
  };

  const draftCost = Number(draftProduct?.cost) || 0;

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
                const avgPrice = getAveragePrice(product);

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
                {(() => {
                  const isPurchase = viewingTransaction.type === "purchase";
                  const transaction = viewingTransaction.data;
                  const summary = computeVatSummary(transaction.items || [], transaction.vat_mode);

                  return (
                    <>
                      <div className="detail-grid">
                        <div>
                          <p className="detail-label">{isPurchase ? "Supplier" : "Customer"}</p>
                          <strong>
                            {isPurchase
                              ? transaction.supplier_name || "—"
                              : transaction.customer_name || "—"}
                          </strong>
                        </div>
                        <div>
                          <p className="detail-label">Status</p>
                          <strong>
                            <span className={`status-badge status-${transaction.status}`}>
                              {transaction.status}
                            </span>
                          </strong>
                        </div>
                        <div>
                          <p className="detail-label">Transaction Date</p>
                          <strong>{transaction.transaction_date || "—"}</strong>
                        </div>
                        {!isPurchase ? (
                          <div>
                            <p className="detail-label">Payment Receive Date</p>
                            <strong>{transaction.payment_received_date || "—"}</strong>
                          </div>
                        ) : null}
                        <div>
                          <p className="detail-label">Document</p>
                          {transaction.document_url ? (
                            <a href={transaction.document_url} target="_blank" rel="noreferrer">
                              Open document
                            </a>
                          ) : (
                            <strong>—</strong>
                          )}
                        </div>
                        <div className="full-width">
                          <p className="detail-label">Notes</p>
                          <strong>{transaction.note || "—"}</strong>
                        </div>
                      </div>

                      <div className="product-detail-section detail-items">
                        <p className="detail-label">Items</p>
                        <div className="table-scroll">
                          {isPurchase ? (
                            <table>
                              <thead>
                                <tr>
                                  <th>Product</th>
                                  <th>SKU</th>
                                  <th>Category</th>
                                  <th>Unit</th>
                                  <th>Qty</th>
                                  <th>Unit Cost</th>
                                  <th>Discounts</th>
                                  <th>Amount</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(transaction.items || []).map((item) => {
                                  const isHighlighted =
                                    viewingProduct &&
                                    item.product_name.toLowerCase() ===
                                      viewingProduct.productName.toLowerCase();
                                  const amount = computeItemAmount(item);

                                  return (
                                    <tr
                                      key={item.id}
                                      className={isHighlighted ? "transaction-row-highlight" : ""}
                                    >
                                      <td>{item.product_name}</td>
                                      <td>{item.sku || "—"}</td>
                                      <td>{item.category || "—"}</td>
                                      <td>{item.unit || "—"}</td>
                                      <td>{item.quantity}</td>
                                      <td>
                                        {item.unit_cost !== undefined && item.unit_cost !== null
                                          ? formatCurrency(item.unit_cost)
                                          : "—"}
                                      </td>
                                      <td>
                                        <span className="tx-discount-label">
                                          {renderDiscounts(item)}
                                        </span>
                                      </td>
                                      <td>{formatCurrency(amount)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          ) : (
                            <table>
                              <thead>
                                <tr>
                                  <th>Product</th>
                                  <th>Qty</th>
                                  <th>Unit Price</th>
                                  <th>Discounts</th>
                                  <th>Amount</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(transaction.items || []).map((item) => {
                                  const isHighlighted =
                                    viewingProduct &&
                                    item.product_name.toLowerCase() ===
                                      viewingProduct.productName.toLowerCase();
                                  const amount = computeItemAmount(item);

                                  return (
                                    <tr
                                      key={item.id}
                                      className={isHighlighted ? "transaction-row-highlight" : ""}
                                    >
                                      <td>{item.product_name}</td>
                                      <td>{item.quantity}</td>
                                      <td>
                                        {item.unit_price !== undefined && item.unit_price !== null
                                          ? formatCurrency(item.unit_price)
                                          : "—"}
                                      </td>
                                      <td>
                                        <span className="tx-discount-label">
                                          {renderDiscounts(item)}
                                        </span>
                                      </td>
                                      <td>{formatCurrency(amount)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </div>

                      <div className="tx-sales-summary">
                        <div className="tx-summary-row">
                          <span>{isPurchase ? "Total" : "Subtotal"}</span>
                          <span>{formatCurrency(summary.subtotal)}</span>
                        </div>
                        <div className="tx-summary-row">
                          <span>VAT (7%)</span>
                          <span>{formatCurrency(summary.vat)}</span>
                        </div>
                        <div className="tx-summary-row tx-summary-grand">
                          <strong>Grand Total</strong>
                          <strong>{formatCurrency(summary.grandTotal)}</strong>
                        </div>
                      </div>
                    </>
                  );
                })()}
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
                    {formatCurrency(getAveragePrice(viewingProduct))}
                  </strong>
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
                            <th>Discounts</th>
                            <th>Amount</th>
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
                              <td>
                                {item.unit_cost !== undefined && item.unit_cost !== null
                                  ? formatCurrency(item.unit_cost)
                                  : "—"}
                              </td>
                              <td>
                                <span className="tx-discount-label">
                                  {renderDiscounts(item)}
                                </span>
                              </td>
                              <td>{formatCurrency(computeItemAmount(item))}</td>
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
                                  Details
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
                            <th>Discounts</th>
                            <th>Amount</th>
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
                              <td>
                                {item.unit_price !== undefined && item.unit_price !== null
                                  ? formatCurrency(item.unit_price)
                                  : "—"}
                              </td>
                              <td>
                                <span className="tx-discount-label">
                                  {renderDiscounts(item)}
                                </span>
                              </td>
                              <td>{formatCurrency(computeItemAmount(item))}</td>
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
                                  Details
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

                <div className="full-width product-price-preview">
                  <p className="detail-label">Price Preview</p>
                  <div className="product-price-row">
                    <span>Average price</span>
                    <strong>{formatCurrency(draftCost)}</strong>
                  </div>
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
