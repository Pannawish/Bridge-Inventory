import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { useLanguage } from "../i18n/LanguageContext";

const FALLBACK_PERIOD_OPTIONS = [
  { value: "1d", label: "Today" },
  { value: "2d", label: "Last 2 days" },
  { value: "5d", label: "Last 5 days" },
  { value: "1w", label: "Last week" },
  { value: "2w", label: "Last 2 weeks" },
  { value: "1m", label: "Last month" },
  { value: "3m", label: "Last 3 months" },
  { value: "6m", label: "Last 6 months" },
  { value: "1y", label: "Last year" },
];
const DEFAULT_PERIOD = "1m";

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

function formatCompact(value) {
  const n = Number(value || 0);
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    return `${sign}฿${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}฿${(abs / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  }
  return `${sign}฿${abs.toFixed(0)}`;
}

function useDashboardSegment(segment, initialData, defaultPeriod) {
  const [period, setPeriod] = useState(initialData?.period || defaultPeriod);
  const [data, setData] = useState(initialData || null);
  const [loading, setLoading] = useState(false);
  const isFirstRun = useRef(true);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      if (initialData && initialData.period === period) {
        return undefined;
      }
    }

    let cancelled = false;
    setLoading(true);
    api
      .getDashboardSegment({ segment, period })
      .then((result) => {
        if (!cancelled) {
          setData(result);
        }
      })
      .catch(() => {
        // Keep the last successful data (e.g. offline / mock mode).
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segment, period]);

  return { period, setPeriod, data, loading };
}

function PeriodSelect({ id, value, options, onChange }) {
  const { t } = useLanguage();
  return (
    <label className="dashboard-period" htmlFor={id}>
      <span className="dashboard-period-label">{t("common.period")}</span>
      <select
        id={id}
        className="dashboard-period-select"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {t(`dashboard.periods.${option.value}`)}
          </option>
        ))}
      </select>
    </label>
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

function FinanceBox({ data, metrics, period, options, onPeriodChange, loading }) {
  const { t } = useLanguage();
  const ar = data?.ar || {};
  const ap = data?.ap || {};
  const netPosition = Number(data?.net_position || 0);
  const grossMargin = Number(data?.gross_margin || 0);
  const totalInventoryValue = Number(metrics?.total_stock_value || 0);

  return (
    <section className={`section-card dashboard-finance-card${loading ? " is-refreshing" : ""}`}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("dashboard.financeEyebrow")}</p>
          <h3>{t("dashboard.financeTitle")}</h3>
        </div>
        <PeriodSelect
          id="finance-period"
          value={period}
          options={options}
          onChange={onPeriodChange}
        />
      </div>

      <div className="dashboard-finance-kpis">
        <DashboardKpi
          label={t("dashboard.arLabel")}
          value={formatCurrency(ar.outstanding)}
          helper={t("dashboard.overdue", { amount: formatCurrency(ar.overdue) })}
          tone={Number(ar.overdue || 0) > 0 ? "warning" : "neutral"}
        />
        <DashboardKpi
          label={t("dashboard.apLabel")}
          value={formatCurrency(ap.outstanding)}
          helper={t("dashboard.overdue", { amount: formatCurrency(ap.overdue) })}
          tone={Number(ap.overdue || 0) > 0 ? "warning" : "neutral"}
        />
        <DashboardKpi
          label={t("dashboard.netPosition")}
          value={formatCurrency(netPosition)}
          helper={t("dashboard.netHelper")}
          tone={netPosition >= 0 ? "positive" : "danger"}
        />
        <DashboardKpi
          label={t("dashboard.inventoryValue")}
          value={formatCurrency(totalInventoryValue)}
          helper={t("dashboard.inventoryValueHelper")}
        />
        <DashboardKpi
          label={t("dashboard.sales")}
          value={formatCurrency(data?.sales_total)}
          helper={t("dashboard.salesCount", { count: formatNumber(data?.sales_count) })}
        />
        <DashboardKpi
          label={t("dashboard.purchases")}
          value={formatCurrency(data?.purchase_total)}
          helper={t("dashboard.purchaseCount", { count: formatNumber(data?.purchase_count) })}
        />
        <DashboardKpi
          label={t("dashboard.grossMargin")}
          value={formatCurrency(grossMargin)}
          helper={t("dashboard.marginOfSales", { pct: formatNumber(data?.margin_pct) })}
          tone={grossMargin < 0 ? "danger" : "positive"}
        />
      </div>
    </section>
  );
}

function TrendBox({ data, period, options, onPeriodChange, loading }) {
  const { t } = useLanguage();
  const series = data?.trend || [];
  const max = Math.max(
    1,
    ...series.flatMap((point) => [point.sales || 0, point.purchases || 0])
  );
  const showValues = series.length > 0 && series.length <= 8;
  const ticks = [1, 0.75, 0.5, 0.25, 0].map((ratio) => ({
    ratio,
    value: max * ratio,
  }));
  const pct = (value) => `${((Number(value) || 0) / max) * 100}%`;

  return (
    <article className={`section-card dashboard-trend-card${loading ? " is-refreshing" : ""}`}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("dashboard.trendEyebrow")}</p>
          <h3>{t("dashboard.trendTitle")}</h3>
        </div>
        <PeriodSelect
          id="trend-period"
          value={period}
          options={options}
          onChange={onPeriodChange}
        />
      </div>
      {series.length === 0 ? (
        <p className="empty-copy">{t("dashboard.noTransactions")}</p>
      ) : (
        <>
          <div className="dashboard-trend-plot">
            <div className="dashboard-trend-axis" aria-hidden="true">
              {ticks.map((tick) => (
                <span key={tick.ratio}>{formatCompact(tick.value)}</span>
              ))}
            </div>
            <div className="dashboard-trend-main">
              <div className="dashboard-trend-graph">
                <div className="dashboard-trend-gridlines" aria-hidden="true">
                  {ticks.map((tick) => (
                    <span key={tick.ratio} />
                  ))}
                </div>
                <div className="dashboard-trend-cols">
                  {series.map((point) => (
                    <div className="dashboard-trend-bars" key={point.key}>
                      <div
                        className="dashboard-trend-bar sales"
                        style={{ height: pct(point.sales) }}
                        title={`Sales ${formatCurrency(point.sales)}`}
                      >
                        {showValues && point.sales > 0 ? (
                          <span className="dashboard-trend-bar-value">
                            {formatCompact(point.sales)}
                          </span>
                        ) : null}
                      </div>
                      <div
                        className="dashboard-trend-bar purchases"
                        style={{ height: pct(point.purchases) }}
                        title={`Purchases ${formatCurrency(point.purchases)}`}
                      >
                        {showValues && point.purchases > 0 ? (
                          <span className="dashboard-trend-bar-value">
                            {formatCompact(point.purchases)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="dashboard-trend-xaxis" aria-hidden="true">
                {series.map((point) => (
                  <span className="dashboard-trend-xlabel" key={point.key}>
                    {point.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="dashboard-trend-legend">
            <span>
              <i className="dashboard-trend-dot sales" /> {t("dashboard.sales")}
            </span>
            <span>
              <i className="dashboard-trend-dot purchases" /> {t("dashboard.purchases")}
            </span>
          </div>
        </>
      )}
    </article>
  );
}

function TopProductsBox({ data, period, options, onPeriodChange, loading }) {
  const { t } = useLanguage();
  const rows = data?.top_products || [];

  return (
    <article className={`section-card dashboard-toplist${loading ? " is-refreshing" : ""}`}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("dashboard.topEyebrow")}</p>
          <h3>{t("dashboard.topTitle")}</h3>
        </div>
        <PeriodSelect
          id="products-period"
          value={period}
          options={options}
          onChange={onPeriodChange}
        />
      </div>
      {rows.length === 0 ? (
        <p className="empty-copy">{t("dashboard.noSales")}</p>
      ) : (
        <ol className="dashboard-toplist-rows">
          {rows.map((row, index) => (
            <li className="dashboard-toplist-row" key={row.product_id || index}>
              <span className="dashboard-toplist-rank">{index + 1}</span>
              <span className="dashboard-toplist-name" title={row.product_name}>
                {row.product_name || "—"}
              </span>
              <span className="dashboard-toplist-value">
                {formatCurrency(row.revenue)}
                <small className={Number(row.margin) < 0 ? "tone-danger" : "tone-positive"}>
                  {t("dashboard.sold", {
                    units: formatNumber(row.units),
                    margin: formatCurrency(row.margin),
                  })}
                </small>
              </span>
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}

function Dashboard({ dashboard }) {
  const overview = dashboard?.overview || {};
  const periodOptions = overview.period_options?.length
    ? overview.period_options
    : FALLBACK_PERIOD_OPTIONS;
  const defaultPeriod = overview.default_period || DEFAULT_PERIOD;

  const finance = useDashboardSegment("finance", overview.finance, defaultPeriod);
  const trend = useDashboardSegment("trend", overview.trend, defaultPeriod);
  const products = useDashboardSegment("products", overview.products, defaultPeriod);

  return (
    <div className="stack-layout dashboard-page">
      <FinanceBox
        data={finance.data}
        metrics={dashboard?.metrics}
        period={finance.period}
        options={periodOptions}
        onPeriodChange={finance.setPeriod}
        loading={finance.loading}
      />
      <section className="dashboard-finance-grid">
        <TrendBox
          data={trend.data}
          period={trend.period}
          options={periodOptions}
          onPeriodChange={trend.setPeriod}
          loading={trend.loading}
        />
        <TopProductsBox
          data={products.data}
          period={products.period}
          options={periodOptions}
          onPeriodChange={products.setPeriod}
          loading={products.loading}
        />
      </section>
    </div>
  );
}

export default Dashboard;
