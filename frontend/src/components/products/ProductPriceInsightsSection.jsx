import { useLanguage } from "../../i18n/LanguageContext";
import { getProductBaseUnit } from "../../unitConversion";
import { formatDate } from "../../format";
import { formatCurrency } from "./productUtils";

function formatMoney(value) {
  return value === null || value === undefined || !Number.isFinite(Number(value))
    ? "—"
    : formatCurrency(value);
}

function formatPercent(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return "";
  }

  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function ProductPriceInsightsSection({
  viewingProduct,
  insights,
  supplierOptions = [],
  customerOptions = [],
  supplierFilter,
  onSupplierFilterChange,
  customerFilter,
  onCustomerFilterChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  filterActive,
  onResetFilters,
}) {
  const { t } = useLanguage();
  const baseUnit = getProductBaseUnit(viewingProduct);
  const buy = insights?.buy ?? {};
  const sell = insights?.sell ?? {};
  const marginLast = insights?.marginLast ?? {};
  const marginAvg = insights?.marginAvg ?? {};

  const marginTone =
    marginLast.amount === null || marginLast.amount === undefined
      ? "neutral"
      : marginLast.amount >= 0
        ? "positive"
        : "negative";

  return (
    <div className="product-detail-section price-insights">
      <div className="price-insights-heading">
        <p className="detail-label">{t("products.priceInsightsTitle")}</p>
        <span className="price-insights-unit">{t("products.priceInsightsPerUnit", { unit: baseUnit })}</span>
      </div>

      <div className="price-insights-filters">
        <label className="price-insights-filter">
          <span>{t("products.priceInsightsSupplierFilter")}</span>
          <select
            value={supplierFilter}
            onChange={(event) => onSupplierFilterChange(event.target.value)}
          >
            <option value="">{t("products.priceInsightsAllSuppliers")}</option>
            {supplierOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label className="price-insights-filter">
          <span>{t("products.priceInsightsCustomerFilter")}</span>
          <select
            value={customerFilter}
            onChange={(event) => onCustomerFilterChange(event.target.value)}
          >
            <option value="">{t("products.priceInsightsAllCustomers")}</option>
            {customerOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label className="price-insights-filter">
          <span>{t("products.priceInsightsDateFrom")}</span>
          <input type="date" value={dateFrom} onChange={(event) => onDateFromChange(event.target.value)} />
        </label>

        <label className="price-insights-filter">
          <span>{t("products.priceInsightsDateTo")}</span>
          <input type="date" value={dateTo} onChange={(event) => onDateToChange(event.target.value)} />
        </label>

        <button
          type="button"
          className="secondary-button price-insights-reset"
          onClick={onResetFilters}
          disabled={!filterActive}
        >
          {t("products.priceInsightsReset")}
        </button>
      </div>

      <div className="price-insights-cards">
        <div className="price-insights-card price-insights-card-buy">
          <p className="price-insights-card-label">{t("products.priceInsightsBuy")}</p>
          <p className="price-insights-card-value">{formatMoney(buy.last)}</p>
          <p className="price-insights-card-meta">
            {buy.lastDate
              ? t("products.priceInsightsLastOn", { date: formatDate(buy.lastDate) })
              : t("products.priceInsightsNoData")}
          </p>
          <p className="price-insights-card-secondary">
            {t("products.priceInsightsAvg", { value: formatMoney(buy.avg) })}
          </p>
        </div>

        <div className={`price-insights-card price-insights-card-margin price-insights-${marginTone}`}>
          <p className="price-insights-card-label">{t("products.priceInsightsMargin")}</p>
          <p className="price-insights-card-value">
            {formatMoney(marginLast.amount)}
            {formatPercent(marginLast.percent) ? (
              <span className="price-insights-percent">{formatPercent(marginLast.percent)}</span>
            ) : null}
          </p>
          <p className="price-insights-card-meta">{t("products.priceInsightsMarginLatest")}</p>
          <p className="price-insights-card-secondary">
            {t("products.priceInsightsMarginTypical", {
              value: formatMoney(marginAvg.amount),
              percent: formatPercent(marginAvg.percent) || "—",
            })}
          </p>
        </div>

        <div className="price-insights-card price-insights-card-sell">
          <p className="price-insights-card-label">{t("products.priceInsightsSell")}</p>
          <p className="price-insights-card-value">{formatMoney(sell.last)}</p>
          <p className="price-insights-card-meta">
            {sell.lastDate
              ? t("products.priceInsightsLastOn", { date: formatDate(sell.lastDate) })
              : t("products.priceInsightsNoData")}
          </p>
          <p className="price-insights-card-secondary">
            {t("products.priceInsightsAvg", { value: formatMoney(sell.avg) })}
          </p>
        </div>
      </div>
    </div>
  );
}

export default ProductPriceInsightsSection;
