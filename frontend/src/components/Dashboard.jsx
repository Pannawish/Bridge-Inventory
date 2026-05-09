import { useMemo, useState } from "react";
import {
  getPurchaseItemDisplayStatus,
  getStoredPurchaseItemStatus,
} from "../purchaseStatus";
import { getStoredSaleItemStatus } from "../saleStatus";
import { getItemBaseQuantity, getProductBaseUnit } from "../unitConversion";
import { getCategoryLeafLabel } from "./CategoryPage";

const SAFETY_STOCK_DAYS = 7;
const ATTENTION_PAGE_SIZE = 6;
const COMMITTED_SALE_ITEM_STATUSES = ["packed", "shipped", "delivered"];
const stockColumnDetails = [
  {
    label: "Product",
    meaning: "Product name and SKU shown together so each row can be identified.",
  },
  {
    label: "Cat.",
    meaning: "The product category assigned in the product master.",
  },
  {
    label: "Health",
    meaning: "Inventory status based on shortage, available stock, reorder point, pending sales, and delayed purchases.",
    formula:
      "Urgent when shortage exists, pending sales exceed available plus pending PO, or available stock is at/below reorder point. Watch when stock is near reorder point, has delayed PO, or pending sales.",
  },
  {
    label: "Avail.",
    meaning: "Stock currently available after committed sales are deducted.",
    formula: "max(0, received purchase quantity - committed sales quantity)",
  },
  {
    label: "Recv.",
    meaning: "Total quantity received from purchase items marked Received.",
    formula: "sum of received purchase item base quantities",
  },
  {
    label: "Comm.",
    meaning: "Sales quantity already committed to stock.",
    formula: "sum of sales item base quantities with status Packed, Shipped, or Delivered",
  },
  {
    label: "Pending",
    meaning: "Sales demand not yet committed to stock.",
    formula: "sum of sales item base quantities with status Pending",
  },
  {
    label: "Shortage",
    meaning: "Quantity oversold beyond received stock.",
    formula: "max(0, committed sales quantity - received purchase quantity)",
  },
  {
    label: "PO",
    meaning: "Incoming purchase quantity that is still pending.",
    formula: "sum of purchase item base quantities with status Pending and not delayed",
  },
  {
    label: "Late PO",
    meaning: "Incoming purchase quantity whose expected delivery date has passed.",
    formula: "sum of pending purchase item base quantities where expected delivery date is before today",
  },
  {
    label: "Demand",
    meaning: "Average daily demand from committed sales history.",
    formula: "sales history quantity / number of days in the sales history date span",
  },
  {
    label: "Safety",
    meaning: "Buffer stock based on recent demand.",
    formula: `average daily demand x ${SAFETY_STOCK_DAYS} days, rounded up`,
  },
  {
    label: "Reorder",
    meaning: "Stock level where the app starts recommending a purchase.",
    formula: "ceil(average lead-time demand + safety stock), or product reorder level when demand data is unavailable",
  },
  {
    label: "Days",
    meaning: "Estimated days until available stock runs out.",
    formula: "floor(available stock / average daily demand), blank when average daily demand is zero",
  },
  {
    label: "Buy",
    meaning: "Suggested quantity to purchase.",
    formula: "max(0, reorder point + pending sales + shortage - available stock - pending PO)",
  },
  {
    label: "Stock Value",
    meaning: "Estimated value of available stock.",
    formula: "available stock x average unit cost from received purchases",
  },
];

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

function formatStockQuantity(value, unit) {
  const formattedValue = formatNumber(value);
  return unit && unit !== "-" ? `${formattedValue} ${unit}` : formattedValue;
}

function getFilterLabel(options, value) {
  return options.find((option) => option.value === value)?.label || value;
}

function StockHeader({ label, fullName }) {
  return (
    <th aria-label={fullName}>
      <span className="dashboard-stock-header-label" title={fullName}>
        {label}
      </span>
    </th>
  );
}

function DashboardKpi({ label, value, helper, tone = "neutral" }) {
  return (
    <article className={`dashboard-kpi-card ${tone}`}>
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{helper}</span>
    </article>
  );
}

function getStockHealth(item) {
  if (
    item.oversold_units > 0 ||
    item.pending_sales_units > item.available_stock + item.pending_purchase_units
  ) {
    return { label: "Urgent", tone: "danger" };
  }

  if (item.available_stock <= 0 || item.available_stock <= item.reorder_level) {
    return { label: "Urgent", tone: "danger" };
  }

  if (
    item.available_stock <= item.reorder_level + item.predicted_7_day_demand ||
    item.delayed_purchase_units > 0 ||
    item.pending_sales_units > 0
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

function getProductStockUnit(product) {
  return getProductBaseUnit(product);
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

function computeDateSpanDays(dates) {
  const validTimes = dates
    .map(parseUtcDate)
    .filter((time) => time !== null);

  if (validTimes.length <= 1) {
    return validTimes.length;
  }

  const earliestTime = Math.min(...validTimes);
  const latestTime = Math.max(...validTimes);

  return Math.max(1, Math.round((latestTime - earliestTime) / 86400000) + 1);
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

function getMovementQuantity(item) {
  return getItemBaseQuantity(item);
}

function isCommittedSaleItemStatus(status) {
  return COMMITTED_SALE_ITEM_STATUSES.includes(status);
}

function createCommittedSalesRows(sales) {
  return sales.flatMap((sale) =>
    (sale.items || [])
      .filter((item) => isCommittedSaleItemStatus(getStoredSaleItemStatus(item, sale.status)))
      .map((item) => ({ sale, item }))
  );
}

function createEmptyStockRow(key, overrides = {}) {
  return {
    product_id: overrides.product_id || key,
    product_name: overrides.product_name || "Unnamed Product",
    sku: overrides.sku || "",
    category: overrides.category || "-",
    unit: overrides.unit || "-",
    reorder_level: Number(overrides.reorder_level) || 0,
    predicted_7_day_demand: Number(overrides.predicted_7_day_demand) || 0,
    received_purchase_units: 0,
    received_purchase_value: 0,
    allocated_sales_units: 0,
    pending_sales_units: 0,
    oversold_units: 0,
    sales_history_units: 0,
    sales_history_dates: [],
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
  row.unit = row.unit === "-" ? overrides.unit || "-" : row.unit;
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
      unit: getProductStockUnit(product),
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
      unit: stockItem.unit || stockItem.base_unit || "-",
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
        unit: item.base_unit || item.unit,
        category: "-",
      });
      const quantity = getMovementQuantity(item);
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
    (sale.items || []).forEach((item) => {
      const itemStatus = getStoredSaleItemStatus(item, sale.status);

      if (!isCommittedSaleItemStatus(itemStatus) && itemStatus !== "pending") {
        return;
      }

      const key = getMovementKey(item);

      if (!key) {
        return;
      }

      const row = getOrCreateStockRow(rowMap, key, {
        product_name: item.product_name,
        sku: item.sku,
        unit: item.base_unit || item.unit,
        category: "-",
      });

      const quantity = getMovementQuantity(item);

      if (isCommittedSaleItemStatus(itemStatus)) {
        row.allocated_sales_units += quantity;
        row.sales_history_units += quantity;

        if (sale.transaction_date) {
          row.sales_history_dates.push(sale.transaction_date);
        }
      } else if (itemStatus === "pending") {
        row.pending_sales_units += quantity;
      }
    });
  });

  return [...rowMap.values()].map((item) => {
    const rawAvailableStock = item.received_purchase_units - item.allocated_sales_units;
    const availableStock = Math.max(0, rawAvailableStock);
    const oversoldUnits = Math.max(0, -rawAvailableStock);
    const avgUnitCost =
      item.received_purchase_units > 0
        ? item.received_purchase_value / item.received_purchase_units
        : 0;
    const averageLeadTimeDays =
      item.lead_time_sample_count > 0
        ? item.lead_time_sample_days / item.lead_time_sample_count
        : null;
    const salesHistoryDays = computeDateSpanDays(item.sales_history_dates);
    const averageDailyDemand =
      item.sales_history_units > 0 && salesHistoryDays > 0
        ? item.sales_history_units / salesHistoryDays
        : 0;
    const leadTimeDemand =
      averageLeadTimeDays !== null && averageDailyDemand > 0
        ? averageDailyDemand * averageLeadTimeDays
        : 0;
    const safetyStock = averageDailyDemand > 0
      ? averageDailyDemand * SAFETY_STOCK_DAYS
      : 0;
    const stockValue = availableStock * avgUnitCost;
    const calculatedReorderLevel = Math.ceil(leadTimeDemand + safetyStock);
    const reorderLevel = calculatedReorderLevel || item.reorder_level;
    const recommendedPurchase = Math.max(
      0,
      reorderLevel + item.pending_sales_units + oversoldUnits - availableStock - item.pending_purchase_units
    );
    const daysUntilStockout =
      averageDailyDemand > 0
        ? Math.floor(availableStock / averageDailyDemand)
        : null;
    const row = {
      ...item,
      available_stock: availableStock,
      current_stock: availableStock,
      oversold_units: oversoldUnits,
      reorder_level: reorderLevel,
      average_daily_demand: averageDailyDemand,
      average_unit_cost: avgUnitCost,
      average_lead_time_days:
        averageLeadTimeDays !== null ? Number(averageLeadTimeDays.toFixed(1)) : null,
      safety_stock: Math.ceil(safetyStock),
      safety_stock_days: SAFETY_STOCK_DAYS,
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
  const [filterOpen, setFilterOpen] = useState(false);
  const [stockFilter, setStockFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [salesFilter, setSalesFilter] = useState("all");
  const [purchaseFilter, setPurchaseFilter] = useState("all");
  const [stockoutFilter, setStockoutFilter] = useState("all");
  const [sortMetric, setSortMetric] = useState("available_stock");
  const [sortOrder, setSortOrder] = useState("low-to-high");
  const [showStockInfo, setShowStockInfo] = useState(false);
  const [showAllStockRows, setShowAllStockRows] = useState(false);
  const [attentionPage, setAttentionPage] = useState(0);
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
      watchStockCount: stockRows.filter((item) => item.health.label === "Watch").length,
      receivedPurchaseValue: stockRows.reduce(
        (sum, item) => sum + item.received_purchase_value,
        0
      ),
      committedSalesValue: createCommittedSalesRows(sales).reduce(
        (sum, { item }) => sum + computeAmount(item),
        0
      ),
      pendingSalesUnits: stockRows.reduce((sum, item) => sum + item.pending_sales_units, 0),
      pendingPurchaseUnits: stockRows.reduce((sum, item) => sum + item.pending_purchase_units, 0),
      delayedPurchaseUnits: stockRows.reduce((sum, item) => sum + item.delayed_purchase_units, 0),
      shortageUnits: stockRows.reduce((sum, item) => sum + item.oversold_units, 0),
      recommendedRestockUnits: stockRows.reduce((sum, item) => sum + item.recommended_restock, 0),
    }),
    [metrics.total_products, sales, stockRows]
  );
  const attentionRows = stockRows
    .filter((item) => item.health.label === "Urgent")
    .sort((leftItem, rightItem) => leftItem.available_stock - rightItem.available_stock);
  const attentionPageCount = Math.max(1, Math.ceil(attentionRows.length / ATTENTION_PAGE_SIZE));
  const safeAttentionPage = Math.min(attentionPage, attentionPageCount - 1);
  const attentionPageRows = attentionRows.slice(
    safeAttentionPage * ATTENTION_PAGE_SIZE,
    safeAttentionPage * ATTENTION_PAGE_SIZE + ATTENTION_PAGE_SIZE
  );
  const strongestStock = Math.max(...attentionRows.map((item) => item.reorder_level || 0), 1);
  const movementRows = [
    {
      label: "Committed sales",
      value: formatCurrency(stockMetrics.committedSalesValue),
      helper: "Packed, shipped, and delivered items",
    },
    {
      label: "Received purchases",
      value: formatCurrency(stockMetrics.receivedPurchaseValue),
      helper: "Cost value already received into stock",
    },
    {
      label: "Pending sales",
      value: formatStockQuantity(stockMetrics.pendingSalesUnits, "units"),
      helper: "Demand waiting for stock commitment",
    },
    {
      label: "Purchase pipeline",
      value: formatStockQuantity(stockMetrics.pendingPurchaseUnits, "units"),
      helper: `${formatStockQuantity(stockMetrics.delayedPurchaseUnits, "units")} delayed`,
    },
  ];
  const categoryOptions = useMemo(
    () =>
      [...new Set(stockRows.map((item) => item.category).filter((category) => category && category !== "-"))]
        .sort((left, right) => left.localeCompare(right)),
    [stockRows]
  );
  const healthFilterOptions = [
    { value: "all", label: "All health" },
    { value: "urgent", label: "Urgent" },
    { value: "watch", label: "Watch" },
    { value: "healthy", label: "Healthy" },
  ];
  const salesFilterOptions = [
    { value: "all", label: "All sales states" },
    { value: "committed", label: "Has committed sales" },
    { value: "pending", label: "Has pending sales" },
    { value: "oversold", label: "Shortage" },
    { value: "no-demand", label: "No sales demand" },
  ];
  const purchaseFilterOptions = [
    { value: "all", label: "All purchase states" },
    { value: "pending-po", label: "Has pending PO" },
    { value: "delayed-po", label: "Has delayed PO" },
    { value: "needs-po", label: "Needs purchase" },
    { value: "no-pipeline", label: "No purchase pipeline" },
  ];
  const stockoutFilterOptions = [
    { value: "all", label: "All stockout timing" },
    { value: "out-now", label: "Out now" },
    { value: "within-7", label: "Stockout within 7 days" },
    { value: "within-30", label: "Stockout within 30 days" },
    { value: "stable", label: "Stable or no demand" },
  ];
  const sortMetricOptions = [
    { value: "available_stock", label: "Available stock" },
    { value: "pending_sales_units", label: "Pending sales" },
    { value: "oversold_units", label: "Shortage units" },
    { value: "pending_purchase_units", label: "Pending PO" },
    { value: "delayed_purchase_units", label: "Delayed PO" },
    { value: "recommended_restock", label: "Suggested purchase" },
    { value: "stock_value", label: "Stock value" },
    { value: "days_until_stockout", label: "Days left" },
  ];
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
    .filter((item) => categoryFilter === "all" || item.category === categoryFilter)
    .filter((item) => {
      if (salesFilter === "committed") {
        return item.allocated_sales_units > 0;
      }

      if (salesFilter === "pending") {
        return item.pending_sales_units > 0;
      }

      if (salesFilter === "oversold") {
        return item.oversold_units > 0;
      }

      if (salesFilter === "no-demand") {
        return (
          item.allocated_sales_units <= 0 &&
          item.pending_sales_units <= 0 &&
          item.average_daily_demand <= 0
        );
      }

      return true;
    })
    .filter((item) => {
      if (purchaseFilter === "pending-po") {
        return item.pending_purchase_units > 0;
      }

      if (purchaseFilter === "delayed-po") {
        return item.delayed_purchase_units > 0;
      }

      if (purchaseFilter === "needs-po") {
        return item.recommended_restock > 0;
      }

      if (purchaseFilter === "no-pipeline") {
        return item.pending_purchase_units <= 0 && item.delayed_purchase_units <= 0;
      }

      return true;
    })
    .filter((item) => {
      if (stockoutFilter === "out-now") {
        return item.available_stock <= 0 || item.oversold_units > 0;
      }

      if (stockoutFilter === "within-7") {
        return item.days_until_stockout !== null && item.days_until_stockout <= 7;
      }

      if (stockoutFilter === "within-30") {
        return item.days_until_stockout !== null && item.days_until_stockout <= 30;
      }

      if (stockoutFilter === "stable") {
        return item.days_until_stockout === null || item.days_until_stockout > 30;
      }

      return true;
    })
    .sort((leftItem, rightItem) => {
      const leftValue =
        sortMetric === "days_until_stockout" && leftItem.days_until_stockout === null
          ? Number.POSITIVE_INFINITY
          : Number(leftItem[sortMetric]) || 0;
      const rightValue =
        sortMetric === "days_until_stockout" && rightItem.days_until_stockout === null
          ? Number.POSITIVE_INFINITY
          : Number(rightItem[sortMetric]) || 0;

      if (sortOrder === "high-to-low") {
        return rightValue - leftValue;
      }

      return leftValue - rightValue;
    });
  const activeFilterLabels = [
    stockFilter !== "all" ? getFilterLabel(healthFilterOptions, stockFilter) : null,
    categoryFilter !== "all" ? categoryFilter : null,
    salesFilter !== "all" ? getFilterLabel(salesFilterOptions, salesFilter) : null,
    purchaseFilter !== "all" ? getFilterLabel(purchaseFilterOptions, purchaseFilter) : null,
    stockoutFilter !== "all" ? getFilterLabel(stockoutFilterOptions, stockoutFilter) : null,
  ].filter(Boolean);
  const shouldShowStockViewAll = filteredRows.length > 5;
  const isStockTableCompact = shouldShowStockViewAll && !showAllStockRows;
  const clearStockFilters = () => {
    setSearchTerm("");
    setStockFilter("all");
    setCategoryFilter("all");
    setSalesFilter("all");
    setPurchaseFilter("all");
    setStockoutFilter("all");
    setSortMetric("available_stock");
    setSortOrder("low-to-high");
  };
  return (
    <div className="stack-layout dashboard-page">
      <section className="dashboard-summary-grid" aria-label="Dashboard summary">
        <DashboardKpi
          label="Inventory value"
          value={formatCurrency(stockMetrics.totalStockValue)}
          helper="Current available stock value"
        />
        <DashboardKpi
          label="Available units"
          value={formatNumber(stockMetrics.totalStockUnits)}
          helper={`${formatNumber(stockMetrics.totalProducts)} active products`}
        />
        <DashboardKpi
          label="Urgent stock"
          value={formatNumber(stockMetrics.lowStockCount)}
          helper={`${formatNumber(stockMetrics.watchStockCount)} products on watch`}
          tone={stockMetrics.lowStockCount > 0 ? "danger" : "positive"}
        />
        <DashboardKpi
          label="Suggested purchase"
          value={formatStockQuantity(stockMetrics.recommendedRestockUnits, "units")}
          helper={`${formatStockQuantity(stockMetrics.shortageUnits, "units")} shortage`}
          tone={stockMetrics.recommendedRestockUnits > 0 ? "warning" : "positive"}
        />
      </section>

      <section className="dashboard-insight-grid">
        <article className="section-card dashboard-attention-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Need Attention</p>
              <h3>Low Stock Products</h3>
            </div>
            <span className="dashboard-count-pill">{formatNumber(attentionRows.length)}</span>
          </div>

          {attentionRows.length === 0 ? (
            <p className="empty-copy">No low-stock products yet.</p>
          ) : (
            <div className="attention-list">
              {attentionPageRows.map((item) => (
                <div className="attention-row" key={item.product_id}>
                  <div className="attention-meta">
                    <strong>{item.product_name}</strong>
                    <span>
                      Available {formatStockQuantity(item.available_stock, item.unit)} / Reorder{" "}
                      {formatStockQuantity(item.reorder_level, item.unit)}
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
              {attentionPageCount > 1 ? (
                <div className="attention-pagination" aria-label="Low stock product pages">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => setAttentionPage(Math.max(0, safeAttentionPage - 1))}
                    disabled={safeAttentionPage === 0}
                  >
                    Previous
                  </button>
                  <span>
                    Page {formatNumber(safeAttentionPage + 1)} of{" "}
                    {formatNumber(attentionPageCount)}
                  </span>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() =>
                      setAttentionPage(Math.min(attentionPageCount - 1, safeAttentionPage + 1))
                    }
                    disabled={safeAttentionPage >= attentionPageCount - 1}
                  >
                    Next
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </article>

        <article className="section-card dashboard-movement-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Movement</p>
              <h3>Stock Movement Summary</h3>
            </div>
          </div>

          <div className="dashboard-movement-list">
            {movementRows.map((row) => (
              <div className="dashboard-movement-row" key={row.label}>
                <div>
                  <span>{row.label}</span>
                  <p>{row.helper}</p>
                </div>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Inventory</p>
            <h3>Current Stock Details</h3>
          </div>
          <div className="transaction-table-actions">
            {shouldShowStockViewAll ? (
              <button
                className="secondary-button"
                type="button"
                onClick={() => setShowAllStockRows((currentValue) => !currentValue)}
              >
                {showAllStockRows ? "Show Recent" : "View More"}
              </button>
            ) : null}
            <button
              className="secondary-button dashboard-info-button"
              type="button"
              onClick={() => setShowStockInfo(true)}
              aria-label="Show current stock column information"
            >
              i
            </button>
          </div>
        </div>

        <p className="inventory-note">
          Available stock, shortage, pending sales, purchase pipeline, and suggested purchase are
          calculated from your purchase and sales transactions.
        </p>

        <div className="stock-filter-search-row">
          <label className="stock-search">
            <span className="stock-search-icon">S</span>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search product, SKU, or category"
            />
          </label>
          <button
            className="secondary-button"
            type="button"
            onClick={() => setFilterOpen((currentValue) => !currentValue)}
          >
            {filterOpen ? "Hide Filters" : "Filter"}
          </button>
        </div>

        {filterOpen ? (
          <div className="stock-filter-panel">
            <div className="stock-filter-panel-top">
              <div>
                <p className="stock-filter-group-title">Stock Filters</p>
                <p className="stock-filter-helper">
                  Narrow by inventory state, movement pipeline, and sorting.
                </p>
              </div>
              <button className="secondary-button stock-filter-reset" type="button" onClick={clearStockFilters}>
                Reset Filters
              </button>
            </div>

            <div className="stock-filter-groups">
              <div className="stock-filter-group">
                <p className="stock-filter-group-title">Inventory State</p>
                <div className="stock-filter-grid">
                  <label className="stock-control">
                    <span>Health</span>
                    <select value={stockFilter} onChange={(event) => setStockFilter(event.target.value)}>
                      {healthFilterOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                <label className="stock-control">
                  <span>Category</span>
                  <select
                    value={categoryFilter}
                    onChange={(event) => setCategoryFilter(event.target.value)}
                  >
                    <option value="all">All categories</option>
                    {categoryOptions.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="stock-control">
                  <span>Stockout</span>
                  <select
                    value={stockoutFilter}
                    onChange={(event) => setStockoutFilter(event.target.value)}
                  >
                    {stockoutFilterOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="stock-filter-group">
              <p className="stock-filter-group-title">Movement Pipeline</p>
              <div className="stock-filter-grid">
                <label className="stock-control">
                  <span>Sales</span>
                  <select value={salesFilter} onChange={(event) => setSalesFilter(event.target.value)}>
                    {salesFilterOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="stock-control">
                  <span>Purchase</span>
                  <select
                    value={purchaseFilter}
                    onChange={(event) => setPurchaseFilter(event.target.value)}
                  >
                    {purchaseFilterOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="stock-filter-group stock-filter-group-compact">
              <p className="stock-filter-group-title">Sort</p>
              <div className="stock-filter-grid">
                <label className="stock-control">
                  <span>Sort By</span>
                  <select value={sortMetric} onChange={(event) => setSortMetric(event.target.value)}>
                    {sortMetricOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="stock-control">
                  <span>Direction</span>
                  <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}>
                    <option value="low-to-high">Low to High</option>
                    <option value="high-to-low">High to Low</option>
                  </select>
                </label>
              </div>
            </div>
          </div>
        </div>
        ) : null}

        <div className="stock-report-summary">
          <span>{filteredRows.length} products shown</span>
          <span>
            Sorted by {getFilterLabel(sortMetricOptions, sortMetric).toLowerCase()}{" "}
            {sortOrder === "low-to-high" ? "ascending" : "descending"}
          </span>
        </div>

        {activeFilterLabels.length ? (
          <div className="stock-filter-chips" aria-label="Active stock filters">
            {activeFilterLabels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
        ) : null}

        <div
          className={
            isStockTableCompact
              ? "table-scroll desktop-table dashboard-stock-table compact-stock"
              : "table-scroll desktop-table dashboard-stock-table expanded-stock"
          }
        >
          <table>
            <thead>
              <tr>
                <StockHeader label="Product" fullName="Product name and SKU" />
                <StockHeader label="Cat." fullName="Category" />
                <StockHeader label="Health" fullName="Stock health" />
                <StockHeader label="Avail." fullName="Available stock" />
                <StockHeader label="Recv." fullName="Received purchase quantity" />
                <StockHeader label="Comm." fullName="Committed sales quantity" />
                <StockHeader label="Pending" fullName="Pending sales quantity" />
                <StockHeader label="Shortage" fullName="Stock shortage quantity" />
                <StockHeader label="PO" fullName="Pending purchase order quantity" />
                <StockHeader label="Late PO" fullName="Delayed purchase order quantity" />
                <StockHeader label="Demand" fullName="Average daily demand" />
                <StockHeader label="Safety" fullName="Safety stock quantity" />
                <StockHeader label="Reorder" fullName="Reorder point quantity" />
                <StockHeader label="Days" fullName="Estimated days left before stockout" />
                <StockHeader label="Buy" fullName="Suggested purchase quantity" />
                <StockHeader label="Stock Value" fullName="Current stock value" />
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan="16">
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
                    <td>{getCategoryLeafLabel(item.category) || "-"}</td>
                    <td>
                      <span className={`status-badge health-badge ${item.health.tone}`}>
                        {item.health.label}
                      </span>
                    </td>
                    <td>{formatStockQuantity(item.available_stock, item.unit)}</td>
                    <td>{formatStockQuantity(item.received_purchase_units, item.unit)}</td>
                    <td>{formatStockQuantity(item.allocated_sales_units, item.unit)}</td>
                    <td>{formatStockQuantity(item.pending_sales_units, item.unit)}</td>
                    <td>{formatStockQuantity(item.oversold_units, item.unit)}</td>
                    <td>{formatStockQuantity(item.pending_purchase_units, item.unit)}</td>
                    <td>{formatStockQuantity(item.delayed_purchase_units, item.unit)}</td>
                    <td>{formatStockQuantity(item.average_daily_demand, item.unit)}</td>
                    <td>{formatStockQuantity(item.safety_stock, item.unit)}</td>
                    <td>{formatStockQuantity(item.reorder_level, item.unit)}</td>
                    <td>{formatNumber(item.days_until_stockout)}</td>
                    <td>{formatStockQuantity(item.recommended_restock, item.unit)}</td>
                    <td>{formatCurrency(item.stock_value)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className={isStockTableCompact ? "mobile-stock-list compact-stock" : "mobile-stock-list"}>
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
                    <strong>{getCategoryLeafLabel(item.category) || "-"}</strong>
                  </div>
                  <div>
                    <span>Available</span>
                    <strong>{formatStockQuantity(item.available_stock, item.unit)}</strong>
                  </div>
                  <div>
                    <span>Received</span>
                    <strong>{formatStockQuantity(item.received_purchase_units, item.unit)}</strong>
                  </div>
                  <div>
                    <span>Committed Sales</span>
                    <strong>{formatStockQuantity(item.allocated_sales_units, item.unit)}</strong>
                  </div>
                  <div>
                    <span>Pending Sales</span>
                    <strong>{formatStockQuantity(item.pending_sales_units, item.unit)}</strong>
                  </div>
                  <div>
                    <span>Shortage</span>
                    <strong>{formatStockQuantity(item.oversold_units, item.unit)}</strong>
                  </div>
                  <div>
                    <span>Pending PO</span>
                    <strong>{formatStockQuantity(item.pending_purchase_units, item.unit)}</strong>
                  </div>
                  <div>
                    <span>Delayed PO</span>
                    <strong>{formatStockQuantity(item.delayed_purchase_units, item.unit)}</strong>
                  </div>
                  <div>
                    <span>Avg Daily Demand</span>
                    <strong>{formatStockQuantity(item.average_daily_demand, item.unit)}</strong>
                  </div>
                  <div>
                    <span>Safety Stock</span>
                    <strong>{formatStockQuantity(item.safety_stock, item.unit)}</strong>
                  </div>
                  <div>
                    <span>Reorder Point</span>
                    <strong>{formatStockQuantity(item.reorder_level, item.unit)}</strong>
                  </div>
                  <div>
                    <span>Days Left</span>
                    <strong>{formatNumber(item.days_until_stockout)}</strong>
                  </div>
                  <div>
                    <span>Suggested Purchase</span>
                    <strong>{formatStockQuantity(item.recommended_restock, item.unit)}</strong>
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

        {showStockInfo ? (
          <div
            className="modal-backdrop"
            role="presentation"
            onClick={() => setShowStockInfo(false)}
          >
            <div
              className="detail-modal dashboard-stock-info-modal section-card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="stock-info-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Column Reference</p>
                  <h3 id="stock-info-title">Current Stock Details</h3>
                </div>
                <button
                  className="secondary-button table-action-button"
                  type="button"
                  onClick={() => setShowStockInfo(false)}
                >
                  Close
                </button>
              </div>

              <div className="stock-info-grid">
                {stockColumnDetails.map((column) => (
                  <article className="stock-info-item" key={column.label}>
                    <strong>{column.label}</strong>
                    <p>{column.meaning}</p>
                    {column.formula ? (
                      <div>
                        <span>Formula</span>
                        <code>{column.formula}</code>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

export default Dashboard;
