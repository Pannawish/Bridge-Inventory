// Utility module for shared component: product price metrics.

import { getUnitValueFromBaseValue } from "../unitConversion";

function getMetricValueForSelectedUnit(product, unit, metricKeys) {
  if (!product) {
    return null;
  }

  const baseMetricValue = Number(
    metricKeys.reduce((value, key) => {
      if (value !== undefined && value !== null) {
        return value;
      }

      return product?.[key];
    }, null) ?? 0
  );
  if (!Number.isFinite(baseMetricValue) || baseMetricValue <= 0) {
    return null;
  }

  return getUnitValueFromBaseValue(product, unit, baseMetricValue, "sale");
}

export function getAverageCostForSelectedUnit(product, unit) {
  return getMetricValueForSelectedUnit(product, unit, [
    "average_unit_cost",
    "averageUnitCost",
  ]);
}

export function getAverageRecentSalePriceForSelectedUnit(product, unit) {
  return getMetricValueForSelectedUnit(product, unit, [
    "average_recent_sale_price",
    "averageRecentSalePrice",
  ]);
}
