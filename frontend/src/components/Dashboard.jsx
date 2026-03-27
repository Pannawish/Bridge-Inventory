import { useState } from "react";

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

function Dashboard({ dashboard }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("high-to-low");
  const metrics = dashboard.metrics || {};
  const lowStockItems = dashboard.low_stock_items || [];
  const stockReport = dashboard.stock_report || [];
  const strongestStock = Math.max(...lowStockItems.map((item) => item.reorder_level || 0), 1);
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredStockReport = [...stockReport]
    .filter((item) => {
      if (!normalizedSearch) {
        return true;
      }

      return (
        item.product_name?.toLowerCase().includes(normalizedSearch) ||
        item.sku?.toLowerCase().includes(normalizedSearch)
      );
    })
    .filter((item) => {
      if (stockFilter === "all") {
        return true;
      }

      if (stockFilter === "urgent") {
        return item.days_until_stockout <= 7;
      }

      if (stockFilter === "watch") {
        return item.days_until_stockout > 7 && item.days_until_stockout <= 21;
      }

      return item.days_until_stockout > 21;
    })
    .sort((leftItem, rightItem) => {
      if (sortOrder === "low-to-high") {
        return leftItem.current_stock - rightItem.current_stock;
      }

      return rightItem.current_stock - leftItem.current_stock;
    });

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
            <p className="eyebrow">Stock Report</p>
            <h3>Stock Overview and Prediction</h3>
          </div>
          <div className="mini-stat-list compact">
            <div>
              <span>Purchase Total</span>
              <strong>{formatCurrency(metrics.purchase_total)}</strong>
            </div>
            <div>
              <span>Sales Total</span>
              <strong>{formatCurrency(metrics.sales_total)}</strong>
            </div>
          </div>
        </div>

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
                <option value="high-to-low">High to Low</option>
                <option value="low-to-high">Low to High</option>
              </select>
            </label>
          </div>
        </div>

        <div className="stock-report-summary">
          <span>{filteredStockReport.length} items shown</span>
          <span>Sorted by current stock</span>
        </div>

        <div className="table-scroll desktop-table">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Health</th>
                <th>Current Stock</th>
                <th>7-Day Demand</th>
                <th>Days Left</th>
                <th>Recommended Restock</th>
              </tr>
            </thead>
            <tbody>
              {filteredStockReport.length === 0 ? (
                <tr>
                  <td colSpan="6">
                    <p className="empty-copy">No products match the current search or filter.</p>
                  </td>
                </tr>
              ) : (
                filteredStockReport.map((item) => {
                  const stockHealth = getStockHealth(item);

                  return (
                    <tr key={item.product_id}>
                      <td>
                        <div className="cell-stack">
                          <strong>{item.product_name}</strong>
                          <span>{item.sku}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`status-badge health-badge ${stockHealth.tone}`}>
                          {stockHealth.label}
                        </span>
                      </td>
                      <td>{formatNumber(item.current_stock)}</td>
                      <td>{formatNumber(item.predicted_7_day_demand)}</td>
                      <td>{formatNumber(item.days_until_stockout)}</td>
                      <td>{formatNumber(item.recommended_restock)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="mobile-stock-list">
          {filteredStockReport.length === 0 ? (
            <p className="empty-copy">No products match the current search or filter.</p>
          ) : (
            filteredStockReport.map((item) => {
              const stockHealth = getStockHealth(item);

              return (
                <article className="mobile-stock-card" key={`mobile-${item.product_id}`}>
                  <div className="mobile-stock-header">
                    <div className="cell-stack">
                      <strong>{item.product_name}</strong>
                      <span>{item.sku}</span>
                    </div>
                    <span className={`status-badge health-badge ${stockHealth.tone}`}>
                      {stockHealth.label}
                    </span>
                  </div>

                  <div className="mobile-stock-grid">
                    <div>
                      <span>Current Stock</span>
                      <strong>{formatNumber(item.current_stock)}</strong>
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
                      <span>Restock</span>
                      <strong>{formatNumber(item.recommended_restock)}</strong>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

export default Dashboard;
