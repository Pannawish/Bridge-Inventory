import { useMemo, useState } from "react";
import {
  getPurchaseItemDisplayStatus,
  getStoredPurchaseItemStatus,
} from "../purchaseStatus";

function formatCurrency(value) {
  return `฿${Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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
  if (item.available_stock <= 0 || item.available_stock <= item.reorder_level) {
    return { label: "Urgent", tone: "danger" };
  }

  if (
    item.available_stock <= item.reorder_level + item.predicted_7_day_demand ||
    item.delayed_purchase_units > 0
  ) {
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

function normalizeSku(value) {
  return `${value ?? ""}`.trim().toLowerCase();
}

function normalizeName(value) {
  return `${value ?? ""}`.trim().toLowerCase();
}

function parseUtcDate(value) {
  if (!value) {
    return null;
  }

  const [year, month, day] = `${value}`.split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return Date.UTC(year, month - 1, day);
}

function computeDateDiffInDays(startDate, endDate) {
  const startTime = parseUtcDate(startDate);
  const endTime = parseUtcDate(endDate);

  if (startTime === null || endTime === null) {
    return null;
  }

  return Math.max(0, Math.round((endTime - startTime) / 86400000));
}

function getMovementKey(item) {
  return normalizeSku(item.sku) || normalizeName(item.product_name);
}

function getProductKey(product) {
  return normalizeSku(getProductSku(product)) || normalizeName(getProductName(product));
}

function getStockItemKey(stockItem) {
  return normalizeSku(stockItem.sku) || normalizeName(stockItem.product_name);
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

function computeAmount(item) {
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

function createEmptyStockRow(key, overrides = {}) {
  return {
    product_id: overrides.product_id || key,
    product_name: overrides.product_name || "Unnamed Product",
    sku: overrides.sku || "",
    category: overrides.category || "-",
    reorder_level: Number(overrides.reorder_level) || 0,
    predicted_7_day_demand: Number(overrides.predicted_7_day_demand) || 0,
    received_purchase_units: 0,
    received_purchase_value: 0,
    allocated_sales_units: 0,
    pending_purchase_units: 0,
    delayed_purchase_units: 0,
    lead_time_sample_days: 0,
    lead_time_sample_count: 0,
  };
}

function getOrCreateStockRow(rowMap, key, overrides = {}) {
  const safeKey = key || normalizeName(overrides.product_name) || `${rowMap.size + 1}`;

  if (!rowMap.has(safeKey)) {
    rowMap.set(safeKey, createEmptyStockRow(safeKey, overrides));
  }

  const row = rowMap.get(safeKey);

  row.product_name = row.product_name || overrides.product_name || "Unnamed Product";
  row.sku = row.sku || overrides.sku || "";
  row.category = row.category === "-" ? overrides.category || "-" : row.category;
  row.reorder_level = Math.max(row.reorder_level, Number(overrides.reorder_level) || 0);
  row.predicted_7_day_demand =
    row.predicted_7_day_demand || Number(overrides.predicted_7_day_demand) || 0;

  return row;
}

function buildStockSeedRows(products, stockReport, lowStockItems) {
  const rowMap = new Map();

  products.forEach((product) => {
    const stockItem = stockReport.find((item) => matchesProduct(item, product)) || {};
    const lowStockItem = lowStockItems.find((item) => matchesProduct(item, product)) || {};
    const key = getProductKey(product);

    getOrCreateStockRow(rowMap, key, {
      product_id: product.id,
      product_name: getProductName(product),
      sku: getProductSku(product),
      category: getProductCategory(product) || stockItem.category || "-",
      reorder_level: lowStockItem.reorder_level || stockItem.reorder_level || 0,
      predicted_7_day_demand: stockItem.predicted_7_day_demand || 0,
    });
  });

  stockReport.forEach((stockItem) => {
    const lowStockItem =
      lowStockItems.find(
        (item) =>
          `${item.product_id}` === `${stockItem.product_id}` ||
          normalizeName(item.product_name) === normalizeName(stockItem.product_name)
      ) || {};

    getOrCreateStockRow(rowMap, getStockItemKey(stockItem), {
      product_id: stockItem.product_id,
      product_name: stockItem.product_name,
      sku: stockItem.sku,
      category: stockItem.category || "-",
      reorder_level: lowStockItem.reorder_level || stockItem.reorder_level || 0,
      predicted_7_day_demand: stockItem.predicted_7_day_demand || 0,
    });
  });

  return rowMap;
}

function createProductStockRows(products, stockReport, lowStockItems, purchases, sales) {
  const rowMap = buildStockSeedRows(products, stockReport, lowStockItems);

  purchases.forEach((purchase) => {
    (purchase.items || []).forEach((item) => {
      const key = getMovementKey(item);

      if (!key) {
        return;
      }

      const row = getOrCreateStockRow(rowMap, key, {
        product_name: item.product_name,
        sku: item.sku,
        category: "-",
      });
      const quantity = Number(item.quantity) || 0;
      const storedStatus = getStoredPurchaseItemStatus(item, purchase.status);
      const displayStatus = getPurchaseItemDisplayStatus(item, purchase.status);

      if (storedStatus === "received") {
        row.received_purchase_units += quantity;
        row.received_purchase_value += computeAmount(item);

        const leadTimeDays = computeDateDiffInDays(
          purchase.transaction_date,
          item.received_date
        );

        if (leadTimeDays !== null) {
          row.lead_time_sample_days += leadTimeDays;
          row.lead_time_sample_count += 1;
        }
      } else if (displayStatus === "delayed") {
        row.delayed_purchase_units += quantity;
      } else if (storedStatus === "pending") {
        row.pending_purchase_units += quantity;
      }
    });
  });

  sales.forEach((sale) => {
    if (sale.status === "cancelled" || sale.status === "draft") {
      return;
    }

    (sale.items || []).forEach((item) => {
      const key = getMovementKey(item);

      if (!key) {
        return;
      }

      const row = getOrCreateStockRow(rowMap, key, {
        product_name: item.product_name,
        sku: item.sku,
        category: "-",
      });

      row.allocated_sales_units += Number(item.quantity) || 0;
    });
  });

  return [...rowMap.values()].map((item) => {
    const availableStock = item.received_purchase_units - item.allocated_sales_units;
    const avgUnitCost =
      item.received_purchase_units > 0
        ? item.received_purchase_value / item.received_purchase_units
        : 0;
    const averageLeadTimeDays =
      item.lead_time_sample_count > 0
        ? item.lead_time_sample_days / item.lead_time_sample_count
        : null;
    const averageDailyDemand = (Number(item.predicted_7_day_demand) || 0) / 7;
    const reorderLevelFromActualLeadTime =
      averageLeadTimeDays !== null && averageDailyDemand > 0
        ? Math.ceil(averageDailyDemand * averageLeadTimeDays)
        : null;
    const stockValue = availableStock * avgUnitCost;
    const reorderLevel =
      reorderLevelFromActualLeadTime !== null
        ? reorderLevelFromActualLeadTime
        : item.reorder_level;
    const recommendedPurchase = Math.max(
      0,
      reorderLevel - availableStock - item.pending_purchase_units
    );
    const daysUntilStockout =
      averageDailyDemand > 0
        ? Math.floor(availableStock / averageDailyDemand)
        : null;
    const row = {
      ...item,
      available_stock: availableStock,
      current_stock: availableStock,
      reorder_level: reorderLevel,
      average_unit_cost: avgUnitCost,
      average_lead_time_days:
        averageLeadTimeDays !== null ? Number(averageLeadTimeDays.toFixed(1)) : null,
      stock_value: stockValue,
      total_cost: stockValue,
      incoming_purchase_units: item.pending_purchase_units + item.delayed_purchase_units,
      days_until_stockout: daysUntilStockout,
      recommended_restock: recommendedPurchase,
    };

    return {
      ...row,
      health: getStockHealth(row),
    };
  });
}

function Dashboard({ dashboard, products = [], purchases = [], sales = [] }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("low-to-high");
  const metrics = dashboard.metrics || {};
  const lowStockItems = dashboard.low_stock_items || [];
  const stockReport = dashboard.stock_report || [];
  const stockRows = useMemo(
    () => createProductStockRows(products, stockReport, lowStockItems, purchases, sales),
    [lowStockItems, products, purchases, sales, stockReport]
  );
  const stockMetrics = useMemo(
    () => ({
      totalProducts: stockRows.length || metrics.total_products,
      totalStockUnits: stockRows.reduce((sum, item) => sum + item.available_stock, 0),
      totalStockValue: stockRows.reduce((sum, item) => sum + item.stock_value, 0),
      lowStockCount: stockRows.filter((item) => item.health.label === "Urgent").length,
    }),
    [metrics.total_products, stockRows]
  );
  const attentionRows = stockRows
    .filter((item) => item.health.label === "Urgent")
    .sort((leftItem, rightItem) => leftItem.available_stock - rightItem.available_stock);
  const strongestStock = Math.max(...attentionRows.map((item) => item.reorder_level || 0), 1);
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
        return rightItem.available_stock - leftItem.available_stock;
      }

      return leftItem.available_stock - rightItem.available_stock;
    });
  return (
    <div className="stack-layout">
      <section className="metrics-grid">
        <StatCard
          label="Products"
          value={formatNumber(stockMetrics.totalProducts)}
          helper="Total items in the system"
          trend={12}
        />
        <StatCard
          label="Stock Units"
          value={formatNumber(stockMetrics.totalStockUnits)}
          helper="Received purchases minus active sales"
          trend={8}
        />
        <StatCard
          label="Stock Value"
          value={formatCurrency(stockMetrics.totalStockValue)}
          helper="Available stock x average received cost"
          trend={16}
        />
        <StatCard
          label="Low Stock"
          value={formatNumber(stockMetrics.lowStockCount)}
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

          {attentionRows.length === 0 ? (
            <p className="empty-copy">No low-stock products yet.</p>
          ) : (
            <div className="attention-list">
              {attentionRows.map((item) => (
                <div className="attention-row" key={item.product_id}>
                  <div className="attention-meta">
                    <strong>{item.product_name}</strong>
                    <span>
                      Available {item.available_stock} / Reorder {item.reorder_level}
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
          Available stock is calculated from received purchase items minus active sales.
          Reorder point now uses each product's actual received lead time from purchase date to
          item received date. Pending and delayed purchase items are tracked separately as incoming
          stock.
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
          <span>Available stock sorted {sortOrder === "low-to-high" ? "ascending" : "descending"}</span>
        </div>

        <div className="table-scroll desktop-table">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Health</th>
                <th>Available</th>
                <th>Received</th>
                <th>Active Sales</th>
                <th>Pending PO</th>
                <th>Delayed PO</th>
                <th>Reorder Point</th>
                <th>Days Left</th>
                <th>Suggested Purchase</th>
                <th>Stock Value</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan="12">
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
                    <td>{formatNumber(item.available_stock)}</td>
                    <td>{formatNumber(item.received_purchase_units)}</td>
                    <td>{formatNumber(item.allocated_sales_units)}</td>
                    <td>{formatNumber(item.pending_purchase_units)}</td>
                    <td>{formatNumber(item.delayed_purchase_units)}</td>
                    <td>{formatNumber(item.reorder_level)}</td>
                    <td>{formatNumber(item.days_until_stockout)}</td>
                    <td>{formatNumber(item.recommended_restock)}</td>
                    <td>{formatCurrency(item.stock_value)}</td>
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
                    <span>Available</span>
                    <strong>{formatNumber(item.available_stock)}</strong>
                  </div>
                  <div>
                    <span>Received</span>
                    <strong>{formatNumber(item.received_purchase_units)}</strong>
                  </div>
                  <div>
                    <span>Active Sales</span>
                    <strong>{formatNumber(item.allocated_sales_units)}</strong>
                  </div>
                  <div>
                    <span>Pending PO</span>
                    <strong>{formatNumber(item.pending_purchase_units)}</strong>
                  </div>
                  <div>
                    <span>Delayed PO</span>
                    <strong>{formatNumber(item.delayed_purchase_units)}</strong>
                  </div>
                  <div>
                    <span>Reorder Point</span>
                    <strong>{formatNumber(item.reorder_level)}</strong>
                  </div>
                  <div>
                    <span>Days Left</span>
                    <strong>{formatNumber(item.days_until_stockout)}</strong>
                  </div>
                  <div>
                    <span>Suggested Purchase</span>
                    <strong>{formatNumber(item.recommended_restock)}</strong>
                  </div>
                  <div>
                    <span>Stock Value</span>
                    <strong>{formatCurrency(item.stock_value)}</strong>
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
