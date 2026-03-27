import { useState } from "react";

function formatCurrency(value) {
  if (value === null || value === undefined) {
    return "-";
  }

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

function getStockHealth(item) {
  if ((item.days_until_stockout || 0) <= 7) {
    return { label: "Urgent", tone: "danger" };
  }

  if ((item.days_until_stockout || 0) <= 21) {
    return { label: "Watch", tone: "warning" };
  }

  return { label: "Healthy", tone: "positive" };
}

function InventoryPage({ dashboard }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("low-to-high");
  const lowStockItems = dashboard.low_stock_items || [];
  const stockReport = dashboard.stock_report || [];
  const reorderMap = Object.fromEntries(
    lowStockItems.map((item) => [item.product_id, item.reorder_level])
  );
  const stockRows = stockReport.map((item) => ({
    ...item,
    reorder_level: reorderMap[item.product_id] || 0,
    total_cost: (item.current_stock || 0) * (item.unit_cost || 0),
    health: getStockHealth(item),
  }));
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

  const summary = {
    totalProducts: stockRows.length,
    totalUnits: stockRows.reduce((sum, item) => sum + (item.current_stock || 0), 0),
    urgentCount: stockRows.filter((item) => item.health.label === "Urgent").length,
    recommendedRestock: stockRows.reduce(
      (sum, item) => sum + (item.recommended_restock || 0),
      0
    ),
  };

  return (
    <div className="stack-layout">
      <section className="inventory-summary-grid">
        <article className="inventory-summary-card">
          <span>Products in stock</span>
          <strong>{formatNumber(summary.totalProducts)}</strong>
        </article>
        <article className="inventory-summary-card">
          <span>Total units available</span>
          <strong>{formatNumber(summary.totalUnits)}</strong>
        </article>
        <article className="inventory-summary-card">
          <span>Urgent restock items</span>
          <strong>{formatNumber(summary.urgentCount)}</strong>
        </article>
        <article className="inventory-summary-card">
          <span>Suggested restock units</span>
          <strong>{formatNumber(summary.recommendedRestock)}</strong>
        </article>
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
              <article className="mobile-stock-card" key={`inventory-mobile-${item.product_id}`}>
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

export default InventoryPage;
