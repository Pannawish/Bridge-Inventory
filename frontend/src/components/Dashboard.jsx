import { useEffect, useMemo, useState } from "react";
import { loadProducts } from "./ProductsPage";

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value || 0));
}

function formatNumber(value) {
  if (value === null || value === undefined) {
    return "-";
  }

  return Number(value).toLocaleString();
}

function StatCard({ label, value, helper, trend }) {
  return (
    <article className="stat-card">
      <div className="stat-card-top">
        <span className="stat-icon">{label.slice(0, 1)}</span>
        <span className={trend > 0 ? "trend-pill positive" : "trend-pill"}>
          {trend > 0 ? "+" : ""}
          {trend}%
        </span>
      </div>
      <p>{label}</p>
      <h3>{value}</h3>
      <span>{helper}</span>
    </article>
  );
}

function DashboardChart() {
  const points = [
    [0, 78],
    [45, 54],
    [90, 60],
    [135, 35],
    [180, 48],
    [225, 26],
    [270, 42],
    [315, 30],
    [360, 38],
  ];
  const polyline = points.map((point) => point.join(",")).join(" ");

  return (
    <div className="trend-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Sales View</p>
          <h3>Total Sales</h3>
        </div>
        <div className="trend-summary">
          <strong>$84,994.80</strong>
          <span>+16% from last month</span>
        </div>
      </div>

      <svg viewBox="0 0 360 100" className="trend-graphic" role="img" aria-label="Sales trend">
        <defs>
          <linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(65, 104, 255, 0.20)" />
            <stop offset="100%" stopColor="rgba(65, 104, 255, 0.02)" />
          </linearGradient>
        </defs>
        <path d="M0 100 L0 78 L45 54 L90 60 L135 35 L180 48 L225 26 L270 42 L315 30 L360 38 L360 100 Z" fill="url(#trendFill)" />
        <polyline points={polyline} fill="none" stroke="#4168ff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>

      <div className="chart-axis">
        <span>Sat</span>
        <span>Sun</span>
        <span>Mon</span>
        <span>Tue</span>
        <span>Wed</span>
        <span>Thu</span>
        <span>Fri</span>
      </div>
    </div>
  );
}

function getStockHealth(item) {
  if ((item.days_until_stockout || 0) <= 7) {
    return { label: "Urgent", tone: "danger" };
  }

  if ((item.days_until_stockout || 0) <= 21) {
    return { label: "Watch", tone: "warning" };
  }

  return { label: "Healthy", tone: "positive" };
}

function getProductName(product) {
  return product.name || product.productName || product.product_name || product.sku || `Product ${product.id}`;
}

function getProductSku(product) {
  return product.sku || product.SKU || "";
}

function getProductCategory(product) {
  return product.category || product.product_category || "";
}

function matchesProduct(stockItem, product) {
  const productIds = [product.id, product.productDisplayId]
    .filter((value) => value !== undefined && value !== null)
    .map((value) => `${value}`);
  const productSku = getProductSku(product).toLowerCase();
  const productName = getProductName(product).toLowerCase();

  return (
    productIds.includes(`${stockItem.product_id}`) ||
    (productSku && `${stockItem.sku || ""}`.toLowerCase() === productSku) ||
    (productName && `${stockItem.product_name || ""}`.toLowerCase() === productName)
  );
}

function createProductStockRows(products, stockReport, lowStockItems) {
  const usedStockIndexes = new Set();
  const rowsFromProducts = products.map((product) => {
    const stockIndex = stockReport.findIndex((stockItem) =>
      matchesProduct(stockItem, product)
    );
    const stockItem = stockIndex >= 0 ? stockReport[stockIndex] : {};

    if (stockIndex >= 0) {
      usedStockIndexes.add(stockIndex);
    }

    const lowStockItem =
      lowStockItems.find((item) => matchesProduct(item, product)) || {};
    const currentStock = Number(stockItem.current_stock ?? 0);
    const unitCost = Number(stockItem.unit_cost ?? product.unit_cost ?? 0);

    return {
      product_id: product.id,
      product_name: getProductName(product),
      sku: getProductSku(product),
      category: getProductCategory(product) || stockItem.category || "-",
      unit_cost: unitCost,
      current_stock: currentStock,
      reorder_level: lowStockItem.reorder_level || stockItem.reorder_level || 0,
      predicted_7_day_demand: stockItem.predicted_7_day_demand ?? 0,
      days_until_stockout: stockItem.days_until_stockout ?? 0,
      recommended_restock: stockItem.recommended_restock ?? 0,
      total_cost: currentStock * unitCost,
    };
  });
  const unmatchedStockRows = stockReport
    .filter((_, index) => !usedStockIndexes.has(index))
    .map((stockItem) => {
      const lowStockItem =
        lowStockItems.find(
          (item) =>
            `${item.product_id}` === `${stockItem.product_id}` ||
            `${item.product_name || ""}`.toLowerCase() ===
              `${stockItem.product_name || ""}`.toLowerCase()
        ) || {};
      const currentStock = Number(stockItem.current_stock ?? 0);
      const unitCost = Number(stockItem.unit_cost ?? 0);

      return {
        ...stockItem,
        category: stockItem.category || "-",
        reorder_level: lowStockItem.reorder_level || stockItem.reorder_level || 0,
        total_cost: currentStock * unitCost,
      };
    });

  return [...rowsFromProducts, ...unmatchedStockRows].map((item) => ({
    ...item,
    health: getStockHealth(item),
  }));
}

function Dashboard({ dashboard }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("low-to-high");
  const [catalogProducts, setCatalogProducts] = useState(() => loadProducts());
  const metrics = dashboard.metrics || {};
  const lowStockItems = dashboard.low_stock_items || [];
  const stockReport = dashboard.stock_report || [];
  const strongestStock = Math.max(...lowStockItems.map((item) => item.reorder_level || 0), 1);
  const stockRows = useMemo(
    () => createProductStockRows(catalogProducts, stockReport, lowStockItems),
    [catalogProducts, lowStockItems, stockReport]
  );
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredRows = [...stockRows]
    .filter((item) => {
      if (!normalizedSearch) {
        return true;
      }

      return (
        item.product_name?.toLowerCase().includes(normalizedSearch) ||
        item.sku?.toLowerCase().includes(normalizedSearch) ||
        item.category?.toLowerCase().includes(normalizedSearch)
      );
    })
    .filter((item) => {
      if (stockFilter === "all") {
        return true;
      }

      return item.health.label.toLowerCase() === stockFilter;
    })
    .sort((leftItem, rightItem) => {
      if (sortOrder === "high-to-low") {
        return rightItem.current_stock - leftItem.current_stock;
      }

      return leftItem.current_stock - rightItem.current_stock;
    });
  useEffect(() => {
    function refreshProducts() {
      setCatalogProducts(loadProducts());
    }

    window.addEventListener("storage", refreshProducts);
    window.addEventListener("inventory-products-updated", refreshProducts);

    return () => {
      window.removeEventListener("storage", refreshProducts);
      window.removeEventListener("inventory-products-updated", refreshProducts);
    };
  }, []);

  return (
    <div className="stack-layout">
      <section className="metrics-grid">
        <StatCard
          label="Products"
          value={formatNumber(metrics.total_products)}
          helper="Total items in the system"
          trend={12}
        />
        <StatCard
          label="Stock Units"
          value={formatNumber(metrics.total_stock_units)}
          helper="Available units based on transaction status"
          trend={8}
        />
        <StatCard
          label="Stock Value"
          value={formatCurrency(metrics.total_stock_value)}
          helper="Current stock x unit price"
          trend={16}
        />
        <StatCard
          label="Low Stock"
          value={formatNumber(metrics.low_stock_count)}
          helper="Products at or below reorder level"
          trend={-6}
        />
      </section>

      <section className="double-grid">
        <article className="section-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Need Attention</p>
              <h3>Low Stock Products</h3>
            </div>
          </div>

          {lowStockItems.length === 0 ? (
            <p className="empty-copy">No low-stock products yet.</p>
          ) : (
            <div className="attention-list">
              {lowStockItems.map((item) => (
                <div className="attention-row" key={item.product_id}>
                  <div className="attention-meta">
                    <strong>{item.product_name}</strong>
                    <span>
                      Current {item.current_stock} / Reorder {item.reorder_level}
                    </span>
                  </div>
                  <div className="attention-bar-track">
                    <div
                      className="attention-bar-fill"
                      style={{
                        width: `${Math.max(
                          16,
                          (item.reorder_level / strongestStock) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        <DashboardChart />
      </section>

      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Inventory</p>
            <h3>Current Stock Details</h3>
          </div>
        </div>

        <p className="inventory-note">
          Review current stock, reorder points, demand outlook, and which items need
          immediate attention.
        </p>

        <div className="stock-report-toolbar">
          <label className="stock-search">
            <span className="stock-search-icon">S</span>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search product or SKU"
            />
          </label>

          <div className="stock-report-actions">
            <label className="stock-control">
              <span>Filter</span>
              <select value={stockFilter} onChange={(event) => setStockFilter(event.target.value)}>
                <option value="all">All</option>
                <option value="urgent">Urgent</option>
                <option value="watch">Watch</option>
                <option value="healthy">Healthy</option>
              </select>
            </label>

            <label className="stock-control">
              <span>Sort</span>
              <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}>
                <option value="low-to-high">Low to High</option>
                <option value="high-to-low">High to Low</option>
              </select>
            </label>
          </div>
        </div>

        <div className="stock-report-summary">
          <span>{filteredRows.length} products shown</span>
          <span>Current stock sorted {sortOrder === "low-to-high" ? "ascending" : "descending"}</span>
        </div>

        <div className="table-scroll desktop-table">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Health</th>
                <th>Total Cost</th>
                <th>Current Stock</th>
                <th>Reorder Point</th>
                <th>7-Day Demand</th>
                <th>Days Left</th>
                <th>Recommended Restock</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan="9">
                    <p className="empty-copy">No inventory items match the current search or filter.</p>
                  </td>
                </tr>
              ) : (
                filteredRows.map((item) => (
                  <tr key={item.product_id}>
                    <td>
                      <div className="cell-stack">
                        <strong>{item.product_name}</strong>
                        <span>{item.sku}</span>
                      </div>
                    </td>
                    <td>{item.category || "-"}</td>
                    <td>
                      <span className={`status-badge health-badge ${item.health.tone}`}>
                        {item.health.label}
                      </span>
                    </td>
                    <td>{formatCurrency(item.total_cost)}</td>
                    <td>{formatNumber(item.current_stock)}</td>
                    <td>{formatNumber(item.reorder_level)}</td>
                    <td>{formatNumber(item.predicted_7_day_demand)}</td>
                    <td>{formatNumber(item.days_until_stockout)}</td>
                    <td>{formatNumber(item.recommended_restock)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mobile-stock-list">
          {filteredRows.length === 0 ? (
            <p className="empty-copy">No inventory items match the current search or filter.</p>
          ) : (
            filteredRows.map((item) => (
              <article className="mobile-stock-card" key={`dashboard-mobile-${item.product_id}`}>
                <div className="mobile-stock-header">
                  <div className="cell-stack">
                    <strong>{item.product_name}</strong>
                    <span>{item.sku}</span>
                  </div>
                  <span className={`status-badge health-badge ${item.health.tone}`}>
                    {item.health.label}
                  </span>
                </div>

                <div className="mobile-stock-grid">
                  <div>
                    <span>Category</span>
                    <strong>{item.category || "-"}</strong>
                  </div>
                  <div>
                    <span>Total Cost</span>
                    <strong>{formatCurrency(item.total_cost)}</strong>
                  </div>
                  <div>
                    <span>Current Stock</span>
                    <strong>{formatNumber(item.current_stock)}</strong>
                  </div>
                  <div>
                    <span>Reorder Point</span>
                    <strong>{formatNumber(item.reorder_level)}</strong>
                  </div>
                  <div>
                    <span>7-Day Demand</span>
                    <strong>{formatNumber(item.predicted_7_day_demand)}</strong>
                  </div>
                  <div>
                    <span>Days Left</span>
                    <strong>{formatNumber(item.days_until_stockout)}</strong>
                  </div>
                  <div>
                    <span>Suggested Restock</span>
                    <strong>{formatNumber(item.recommended_restock)}</strong>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

export default Dashboard;
