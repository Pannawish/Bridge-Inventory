export function normalizeUnit(value, fallback = "pcs") {
  const unit = `${value ?? ""}`.trim();
  return unit || fallback;
}

function normalizeConversionUnit(conversion) {
  return normalizeUnit(conversion.unit ?? conversion.name ?? conversion.uom, "");
}

function normalizeFactor(value) {
  const factor = Number(value);
  return Number.isFinite(factor) && factor > 0 ? factor : 1;
}

function normalizeConversion(conversion, baseUnit) {
  return {
    unit: normalizeConversionUnit(conversion) || baseUnit,
    factorToBase: normalizeFactor(
      conversion.factorToBase ??
        conversion.factor_to_base ??
        conversion.conversion_factor ??
        conversion.factor
    ),
    allowPurchase: conversion.allowPurchase ?? conversion.allow_purchase ?? true,
    allowSale: conversion.allowSale ?? conversion.allow_sale ?? true,
  };
}

export function getProductBaseUnit(product) {
  return normalizeUnit(
    product?.stockBaseUnit ??
      product?.stock_base_unit ??
      product?.baseUnit ??
      product?.base_unit ??
      product?.unit ??
      product?.uom ??
      product?.unit_name
  );
}

export function getProductDefaultPurchaseUnit(product) {
  return normalizeUnit(
    product?.defaultPurchaseUnit ?? product?.default_purchase_unit,
    getProductBaseUnit(product)
  );
}

export function getProductDefaultSalesUnit(product) {
  return normalizeUnit(
    product?.defaultSalesUnit ?? product?.default_sales_unit,
    getProductBaseUnit(product)
  );
}

export function getProductUnitConversions(product) {
  const baseUnit = getProductBaseUnit(product);
  const sourceConversions =
    product?.unitConversions ??
    product?.unit_conversions ??
    product?.conversions ??
    [];
  const conversions = Array.isArray(sourceConversions)
    ? sourceConversions.map((conversion) => normalizeConversion(conversion, baseUnit))
    : [];
  const conversionMap = new Map();

  [{ unit: baseUnit, factorToBase: 1, allowPurchase: true, allowSale: true }, ...conversions]
    .forEach((conversion) => {
      const key = normalizeUnit(conversion.unit).toLowerCase();

      if (!conversionMap.has(key)) {
        conversionMap.set(key, {
          ...conversion,
          unit: normalizeUnit(conversion.unit, baseUnit),
          factorToBase: normalizeFactor(conversion.factorToBase),
        });
      }
    });

  return [...conversionMap.values()];
}

export function getProductUnitOptions(product, mode = "purchase") {
  const defaultUnit =
    mode === "sale"
      ? getProductDefaultSalesUnit(product)
      : getProductDefaultPurchaseUnit(product);
  const options = getProductUnitConversions(product).filter((conversion) =>
    mode === "sale" ? conversion.allowSale : conversion.allowPurchase
  );

  if (!options.some((option) => option.unit.toLowerCase() === defaultUnit.toLowerCase())) {
    const defaultConversion = getProductUnitConversions(product).find(
      (conversion) => conversion.unit.toLowerCase() === defaultUnit.toLowerCase()
    );
    options.unshift(defaultConversion || {
      unit: defaultUnit,
      factorToBase: 1,
      allowPurchase: true,
      allowSale: true,
    });
  }

  return options;
}

export function getConversionForUnit(product, unit, mode = "purchase") {
  const selectedUnit = normalizeUnit(unit, mode === "sale"
    ? getProductDefaultSalesUnit(product)
    : getProductDefaultPurchaseUnit(product));
  const options = getProductUnitOptions(product, mode);

  return (
    options.find((option) => option.unit.toLowerCase() === selectedUnit.toLowerCase()) ||
    getProductUnitConversions(product).find(
      (conversion) => conversion.unit.toLowerCase() === selectedUnit.toLowerCase()
    ) ||
    options[0] ||
    { unit: getProductBaseUnit(product), factorToBase: 1 }
  );
}

export function roundQuantity(value) {
  const quantity = Number(value) || 0;
  return Number(quantity.toFixed(6));
}

export function buildConvertedItemFields(product, quantity, unit, mode = "purchase") {
  const conversion = getConversionForUnit(product, unit, mode);
  const baseUnit = getProductBaseUnit(product);
  const conversionFactor = normalizeFactor(conversion.factorToBase);

  return {
    unit: conversion.unit,
    base_unit: baseUnit,
    conversion_factor: conversionFactor,
    base_quantity: roundQuantity((Number(quantity) || 0) * conversionFactor),
  };
}

export function getItemBaseQuantity(item) {
  if (item?.base_quantity !== undefined && item?.base_quantity !== null) {
    return Number(item.base_quantity) || 0;
  }

  if (item?.conversion_factor !== undefined && item?.conversion_factor !== null) {
    return roundQuantity((Number(item.quantity) || 0) * (Number(item.conversion_factor) || 1));
  }

  return Number(item?.quantity) || 0;
}
