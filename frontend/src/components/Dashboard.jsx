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

function StatCard({ label, value, helper }) {
  return (
    <article className="stat-card">
      <p>{label}</p>
      <h3>{value}</h3>
      <span>{helper}</span>
    </article>
  );
}

function Dashboard({ dashboard }) {
  const metrics = dashboard.metrics || {};
  const lowStockItems = dashboard.low_stock_items || [];
  const stockReport = dashboard.stock_report || [];

  return (
    <div className="stack-layout">
      <section className="metrics-grid">
        <StatCard
          label="Products"
          value={formatNumber(metrics.total_products)}
          helper="Total items in the system"
        />
        <StatCard
          label="Stock Units"
          value={formatNumber(metrics.total_stock_units)}
          helper="Available units based on transaction status"
        />
        <StatCard
          label="Stock Value"
          value={formatCurrency(metrics.total_stock_value)}
          helper="Current stock x unit price"
        />
        <StatCard
          label="Low Stock"
          value={formatNumber(metrics.low_stock_count)}
          helper="Products at or below reorder level"
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
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Current</th>
                    <th>Reorder</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockItems.map((item) => (
                    <tr key={item.product_id}>
                      <td>{item.product_name}</td>
                      <td>{item.current_stock}</td>
                      <td>{item.reorder_level}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="section-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Money Flow</p>
              <h3>Transaction Totals</h3>
            </div>
          </div>

          <div className="mini-stat-list">
            <div>
              <span>Purchase Total</span>
              <strong>{formatCurrency(metrics.purchase_total)}</strong>
            </div>
            <div>
              <span>Sales Total</span>
              <strong>{formatCurrency(metrics.sales_total)}</strong>
            </div>
            <div>
              <span>Prediction Method</span>
              <strong>30-day average sales</strong>
            </div>
          </div>
        </article>
      </section>

      <section className="section-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Stock Report</p>
              <h3>Stock Overview and Prediction</h3>
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
