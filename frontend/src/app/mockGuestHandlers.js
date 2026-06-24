import { getProductDisplayName } from "../components/products/productUtils";

function escapeHtml(value) {
  return `${value ?? ""}`
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function getPartnerName(row) {
  return row?.companyName || row?.company_name || row?.name || "";
}

function getProductName(row) {
  return getProductDisplayName(row, row?.product_name || row?.name || row?.sku || "");
}

function getPeriodLabel(payload, t) {
  if (payload?.period_type === "custom") {
    return t("aiReport.previewCustomPeriod", {
      from: payload.date_from || "-",
      to: payload.date_to || "-",
    });
  }
  return t("aiReport.periodAll");
}

function sumRows(rows, resolver) {
  return rows.reduce((total, row) => total + Number(resolver(row) || 0), 0);
}

function buildProductTotals(rows, documentKey) {
  const totals = new Map();
  rows.forEach((document) => {
    (document.items || []).forEach((item) => {
      const key = item.product_id || item.productId || item.sku || item.product_name;
      if (!key) {
        return;
      }
      const current = totals.get(key) || {
        label: item.sku ? `${item.product_name} (${item.sku})` : item.product_name,
        value: 0,
      };
      current.value += Number(item.amount || 0);
      current[documentKey] = (current[documentKey] || 0) + 1;
      totals.set(key, current);
    });
  });

  return [...totals.values()]
    .sort((left, right) => right.value - left.value)
    .slice(0, 6);
}

function buildMonthlySales(rows) {
  const totals = new Map();
  rows.forEach((sale) => {
    const month = `${sale.transaction_date || ""}`.slice(0, 7) || "No date";
    totals.set(month, Number(totals.get(month) || 0) + Number(sale.grand_total || sale.total_amount || 0));
  });
  return [...totals.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => left.label.localeCompare(right.label))
    .slice(-6);
}

function renderMetric(label, value) {
  return `
    <section class="metric">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </section>`;
}

function renderBars(rows) {
  const maxValue = Math.max(...rows.map((row) => Number(row.value || 0)), 1);
  return rows
    .map((row) => {
      const width = Math.max(6, Math.round((Number(row.value || 0) / maxValue) * 100));
      return `
        <div class="bar-row">
          <span>${escapeHtml(row.label)}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div>
          <strong>${escapeHtml(formatCurrency(row.value))}</strong>
        </div>`;
    })
    .join("");
}

export function buildGuestAiReportResponse({
  payload,
  suppliers = [],
  customers = [],
  products = [],
  purchases = [],
  sales = [],
  t,
}) {
  const entityId = `${payload?.entity_id || ""}`;
  const scopeType = payload?.scope_type || "supplier";
  const supplier = suppliers.find((row) => `${row.id}` === entityId);
  const customer = customers.find((row) => `${row.id}` === entityId);
  const product = products.find((row) => `${row.id}` === entityId);
  const selectedName =
    scopeType === "product"
      ? getProductName(product)
      : getPartnerName(scopeType === "customer" ? customer : supplier);
  const selectedSupplierName = getPartnerName(supplier);

  const targetPurchases =
    scopeType === "supplier"
      ? purchases.filter((row) => `${row.supplier_id}` === entityId)
      : scopeType === "product"
        ? purchases.filter((row) => (row.items || []).some((item) => `${item.product_id}` === entityId))
        : purchases;
  const targetSales =
    scopeType === "customer"
      ? sales.filter((row) => `${row.customer_id}` === entityId)
      : scopeType === "product"
        ? sales.filter((row) => (row.items || []).some((item) => `${item.product_id}` === entityId))
        : sales.filter((row) =>
            (row.items || []).some((item) => item.supplier_name === selectedSupplierName)
          );

  const purchaseTotal = sumRows(targetPurchases, (row) => {
    if (scopeType !== "product") {
      return row.grand_total || row.total_amount;
    }
    return sumRows(
      row.items || [],
      (item) => (`${item.product_id}` === entityId ? item.amount : 0)
    );
  });
  const salesTotal = sumRows(targetSales, (row) => {
    if (scopeType === "customer") {
      return row.grand_total || row.total_amount;
    }
    return sumRows(
      row.items || [],
      (item) =>
        (scopeType === "product" && `${item.product_id}` === entityId) ||
        (scopeType === "supplier" && item.supplier_name === selectedSupplierName)
          ? item.amount
          : 0
    );
  });
  const openPurchases = targetPurchases.filter((row) =>
    ["draft", "ordered", "partially_received"].includes(row.status)
  ).length;
  const openSales = targetSales.filter((row) =>
    ["draft", "packed", "partially_packed", "shipped", "partially_shipped"].includes(row.status)
  ).length;
  const chartRows =
    scopeType === "product"
      ? buildMonthlySales(targetSales)
      : buildProductTotals(scopeType === "customer" ? targetSales : targetPurchases, scopeType);

  const title = `${t(`aiReport.scope${scopeType[0].toUpperCase()}${scopeType.slice(1)}`)} ${t("aiReport.title")}`;
  const generatedAt = new Date().toLocaleString();

  return {
    html: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root { font-family: Inter, Arial, sans-serif; color: #172033; background: #eef2f6; }
    body { margin: 0; padding: 28px; }
    .report { max-width: 1060px; margin: 0 auto; background: #fff; border: 1px solid #dbe3ee; border-radius: 4px; box-shadow: 0 18px 36px rgba(24,33,50,.08); }
    header { padding: 28px 32px; border-bottom: 1px solid #e4eaf2; display: flex; justify-content: space-between; gap: 20px; align-items: flex-start; }
    h1 { margin: 4px 0 8px; font-size: 28px; letter-spacing: 0; }
    .eyebrow, .muted { color: #647085; margin: 0; font-size: 13px; }
    .print-btn { border: 1px solid #172033; background: #172033; color: white; padding: 10px 14px; border-radius: 4px; cursor: pointer; }
    main { padding: 28px 32px 34px; display: grid; gap: 24px; }
    .metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .metric { border: 1px solid #dfe5ee; border-radius: 4px; padding: 14px; background: #fbfcfe; }
    .metric span { display: block; color: #647085; font-size: 12px; margin-bottom: 8px; }
    .metric strong { font-size: 20px; }
    .panel { border: 1px solid #dfe5ee; border-radius: 4px; padding: 18px; }
    .panel h2 { margin: 0 0 14px; font-size: 18px; }
    .bar-row { display: grid; grid-template-columns: minmax(160px, 280px) 1fr minmax(120px, auto); gap: 14px; align-items: center; margin: 12px 0; }
    .bar-track { height: 12px; border-radius: 4px; background: #e8eef6; overflow: hidden; }
    .bar-fill { height: 100%; background: linear-gradient(90deg, #2563eb, #059669); }
    .note { margin: 0; color: #43516a; line-height: 1.55; }
    @media print { body { background: white; padding: 0; } .report { box-shadow: none; border: 0; } .print-btn { display: none; } }
    @media (max-width: 760px) { body { padding: 12px; } header, main { padding: 20px; } .metrics { grid-template-columns: 1fr 1fr; } .bar-row { grid-template-columns: 1fr; gap: 6px; } }
  </style>
</head>
<body>
  <article class="report">
    <header>
      <div>
        <p class="eyebrow">${escapeHtml(t("aiReport.mockPrepared"))}</p>
        <h1>${escapeHtml(selectedName || title)}</h1>
        <p class="muted">${escapeHtml(getPeriodLabel(payload, t))} · ${escapeHtml(generatedAt)}</p>
      </div>
      <button class="print-btn" onclick="window.print()">${escapeHtml(t("aiReport.mockPrint"))}</button>
    </header>
    <main>
      <section class="metrics">
        ${renderMetric(t("aiReport.mockMetricSales"), formatCurrency(salesTotal))}
        ${renderMetric(t("aiReport.mockMetricPurchases"), formatCurrency(purchaseTotal))}
        ${renderMetric(t("aiReport.mockMetricOpenSales"), openSales)}
        ${renderMetric(t("aiReport.mockMetricOpenPurchases"), openPurchases)}
      </section>
      <section class="panel">
        <h2>${escapeHtml(t("aiReport.mockSummaryTitle"))}</h2>
        <p class="note">${escapeHtml(t("aiReport.mockRecommendationText"))}</p>
      </section>
      <section class="panel">
        <h2>${escapeHtml(t("aiReport.mockChartTitle"))}</h2>
        ${chartRows.length ? renderBars(chartRows) : `<p class="note">${escapeHtml(t("aiReport.noOptions"))}</p>`}
      </section>
      <p class="muted">${escapeHtml(t("aiReport.mockSourceNote"))}</p>
    </main>
  </article>
</body>
</html>`,
  };
}
