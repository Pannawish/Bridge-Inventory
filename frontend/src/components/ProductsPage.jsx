import { useEffect, useMemo, useState } from "react";
import { loadCategories } from "./CategoryPage";

const STORAGE_KEY = "inventory-management-products";
const VAT_RATE = 0.07;

function createProduct(overrides = {}) {
  return {
    id: `product-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    productDisplayId: 1001,
    sku: "",
    productName: "",
    category: "",
    detail: "",
    pictureUrl: "",
    ...overrides,
  };
}

const defaultProducts = [
  createProduct({
    id: "product-1",
    productDisplayId: 1001,
    sku: "NB-A5-001",
    productName: "Notebook A5",
    category: "Stationery",
    detail: "Standard A5 spiral notebook, 80 pages, ruled. Suitable for students and office use.",
    pictureUrl: "",
  }),
  createProduct({
    id: "product-2",
    productDisplayId: 1002,
    sku: "PEN-BL-014",
    productName: "Blue Ballpoint Pen",
    category: "Writing Tools",
    detail: "Medium tip blue ballpoint pen. Smooth writing, long-lasting ink.",
    pictureUrl: "",
  }),
  createProduct({
    id: "product-3",
    productDisplayId: 1003,
    sku: "STP-MN-009",
    productName: "Mini Stapler",
    category: "Desk Accessories",
    detail: "Compact desktop stapler. Accepts standard 26/6 staples. Capacity up to 20 sheets.",
    pictureUrl: "",
  }),
  createProduct({
    id: "product-4",
    productDisplayId: 1004,
    sku: "STK-NT-022",
    productName: "Sticky Notes Set",
    category: "Paper Goods",
    detail: "Pack of 4 sticky note pads, 100 sheets each. Assorted colors.",
    pictureUrl: "",
  }),
];

function normalizeProduct(product) {
  return {
    id: product.id || `product-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    productDisplayId: Math.max(1, Math.round(Number(product.productDisplayId) || 1001)),
    sku: `${product.sku ?? ""}`,
    productName: `${product.productName ?? ""}`,
    category: `${product.category ?? ""}`,
    detail: `${product.detail ?? ""}`,
    pictureUrl: `${product.pictureUrl ?? ""}`,
  };
}

export function loadProducts() {
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

function normalizeSku(value) {
  return `${value ?? ""}`.trim().toLowerCase();
}

function matchesSku(item, sku) {
  const normalizedSku = normalizeSku(sku);

  if (!normalizedSku) {
    return false;
  }

  return normalizeSku(item.sku) === normalizedSku;
}

function getProductMetrics(product, purchases, sales) {
  const purchaseItems = purchases.flatMap((purchase) =>
    (purchase.items || [])
      .filter((item) => matchesSku(item, product.sku))
      .map((item) => ({ transaction: purchase, item }))
  );
  const salesItems = sales.flatMap((sale) =>
    (sale.items || [])
      .filter((item) => matchesSku(item, product.sku))
      .map((item) => ({ transaction: sale, item }))
  );

  const purchasedUnits = purchaseItems.reduce(
    (sum, { item }) => sum + (Number(item.quantity) || 0),
    0
  );
  const soldUnits = salesItems.reduce(
    (sum, { item }) => sum + (Number(item.quantity) || 0),
    0
  );
  const priceRows = [...purchaseItems, ...salesItems];
  const totalPricedUnits = priceRows.reduce(
    (sum, { item }) => sum + (Number(item.quantity) || 0),
    0
  );
  const totalPriceAmount = priceRows.reduce(
    (sum, { item }) => sum + computeItemAmount(item),
    0
  );

  return {
    totalUnits: purchasedUnits - soldUnits,
    avgPrice: totalPricedUnits > 0 ? totalPriceAmount / totalPricedUnits : 0,
    purchaseItems,
    salesItems,
  };
}

function ProductsPage({ purchases = [], sales = [] }) {
  const [products, setProducts] = useState(() => loadProducts());
  const [categories, setCategories] = useState(() => loadCategories());
  const [viewingProduct, setViewingProduct] = useState(null);
  const [viewingTransaction, setViewingTransaction] = useState(null);
  const [draftProduct, setDraftProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(products.map(normalizeProduct))
    );
    window.dispatchEvent(new Event("inventory-products-updated"));
  }, [products]);

  useEffect(() => {
    function refreshCategories() {
      setCategories(loadCategories());
    }

    window.addEventListener("storage", refreshCategories);
    window.addEventListener("inventory-categories-updated", refreshCategories);

    return () => {
      window.removeEventListener("storage", refreshCategories);
      window.removeEventListener("inventory-categories-updated", refreshCategories);
    };
  }, []);

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
          product.category.toLowerCase().includes(normalizedSearch) ||
          product.sku.toLowerCase().includes(normalizedSearch) ||
          `${product.productDisplayId}`.includes(normalizedSearch)
        );
      }),
    [normalizedSearch, products]
  );

  const productsWithMetrics = useMemo(
    () =>
      filteredProducts.map((product) => ({
        product,
        metrics: getProductMetrics(product, purchases, sales),
      })),
    [filteredProducts, purchases, sales]
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
    setDraftProduct(createProduct({ productDisplayId: nextDisplayId }));
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

  function getPurchaseHistory(productSku) {
    return purchases.flatMap((purchase) =>
      (purchase.items || [])
        .filter((item) => matchesSku(item, productSku))
        .map((item) => ({ purchase, item }))
    );
  }

  function getSalesHistory(productSku) {
    return sales.flatMap((sale) =>
      (sale.items || [])
        .filter((item) => matchesSku(item, productSku))
        .map((item) => ({ sale, item }))
    );
  }

  const allProductMetrics = products.map((product) =>
    getProductMetrics(product, purchases, sales)
  );
  const summary = {
    totalProducts: products.length,
    totalUnits: allProductMetrics.reduce((sum, metrics) => sum + metrics.totalUnits, 0),
    totalValue: products.reduce(
      (sum, product, index) =>
        sum + allProductMetrics[index].avgPrice * allProductMetrics[index].totalUnits,
      0
    ),
    outOfStock: allProductMetrics.filter((metrics) => metrics.totalUnits <= 0).length,
  };

  const viewPurchaseHistory = viewingProduct
    ? getPurchaseHistory(viewingProduct.sku)
    : [];
  const viewSalesHistory = viewingProduct
    ? getSalesHistory(viewingProduct.sku)
    : [];
  const viewingProductMetrics = viewingProduct
    ? getProductMetrics(viewingProduct, purchases, sales)
    : null;

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
                placeholder="Search by name, category, SKU, or ID"
              />
            </label>
            <div className="stock-report-summary supplier-search-meta">
              <span>{productsWithMetrics.length} products shown</span>
            </div>
          </div>

          <div className="supplier-list">
            {productsWithMetrics.length === 0 ? (
              <p className="empty-copy">No products match the current search.</p>
            ) : (
              productsWithMetrics.map(({ product, metrics }) => {
                return (
                  <button
                    key={product.id}
                    type="button"
                    className="supplier-list-item product-list-card"
                    onClick={() => openProductDetail(product)}
                  >
                    <strong className="product-card-name">
                      {product.productName || product.sku || "Unnamed Product"}
                    </strong>
                    <div className="product-card-stats">
                      <div className="product-card-stat">
                        <span>SKU</span>
                        <strong>{product.sku || "—"}</strong>
                      </div>
                      <div className="product-card-stat">
                        <span>Category</span>
                        <strong>{product.category || "—"}</strong>
                      </div>
                      <div className="product-card-stat">
                        <span>Total Units</span>
                        <strong>{metrics.totalUnits}</strong>
                      </div>
                      <div className="product-card-stat">
                        <span>Avg Price</span>
                        <strong>{formatCurrency(metrics.avgPrice)}</strong>
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
                                    matchesSku(item, viewingProduct.sku);
                                  const amount = computeItemAmount(item);

                                  return (
                                    <tr
                                      key={item.id}
                                      className={isHighlighted ? "transaction-row-highlight" : ""}
                                    >
                                      <td>{item.product_name}</td>
                                      <td>{item.sku || "—"}</td>
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
                                    matchesSku(item, viewingProduct.sku);
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
                  <h3 id="product-history-title">
                    {viewingProduct.productName || viewingProduct.sku || "Product"}
                  </h3>
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
                  <span>Category</span>
                  <strong>{viewingProduct.category || "—"}</strong>
                </div>
                <div className="product-history-stat">
                  <span>Total Units</span>
                  <strong>{viewingProductMetrics?.totalUnits ?? 0}</strong>
                </div>
                <div className="product-history-stat">
                  <span>Avg Price</span>
                  <strong>
                    {formatCurrency(viewingProductMetrics?.avgPrice ?? 0)}
                  </strong>
                </div>
              </div>

              <div className="product-detail-body">
                <div className="product-profile-panel">
                  {viewingProduct.pictureUrl ? (
                    <img
                      src={viewingProduct.pictureUrl}
                      alt={viewingProduct.productName || "Product"}
                      className="product-profile-image"
                      onError={(event) => {
                        event.target.style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="product-profile-placeholder">No Image</div>
                  )}
                  <div className="product-profile-copy">
                    <div>
                      <p className="detail-label">Product ID</p>
                      <strong>{viewingProduct.productDisplayId}</strong>
                    </div>
                    <div>
                      <p className="detail-label">Category</p>
                      <strong>{viewingProduct.category || "—"}</strong>
                    </div>
                    <div>
                      <p className="detail-label">Product Detail</p>
                      <p className="product-detail-text">
                        {viewingProduct.detail || "—"}
                      </p>
                    </div>
                  </div>
                </div>

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
                  {draftProduct.productName || draftProduct.sku || "New Product"}
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
                  Category
                  <select
                    value={draftProduct.category}
                    onChange={(event) => updateDraftField("category", event.target.value)}
                  >
                    <option value="">Select category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.name}>
                        {category.name}
                      </option>
                    ))}
                  </select>
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
