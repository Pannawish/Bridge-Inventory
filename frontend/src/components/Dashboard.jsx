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

function Dashboard({ dashboard }) {
  const metrics = dashboard.metrics || {};
  const lowStockItems = dashboard.low_stock_items || [];
  const stockReport = dashboard.stock_report || [];
  const strongestStock = Math.max(...lowStockItems.map((item) => item.reorder_level || 0), 1);

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

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Current Stock</th>
                <th>7-Day Demand</th>
                <th>Days Left</th>
                <th>Recommended Restock</th>
              </tr>
            </thead>
            <tbody>
              {stockReport.map((item) => (
                <tr key={item.product_id}>
                  <td>
                    <div className="cell-stack">
                      <strong>{item.product_name}</strong>
                      <span>{item.sku}</span>
                    </div>
                  </td>
                  <td>{formatNumber(item.current_stock)}</td>
                  <td>{formatNumber(item.predicted_7_day_demand)}</td>
                  <td>{formatNumber(item.days_until_stockout)}</td>
                  <td>{formatNumber(item.recommended_restock)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default Dashboard;
