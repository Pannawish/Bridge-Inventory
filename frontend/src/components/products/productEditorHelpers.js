import { getItemBaseQuantity } from "../../unitConversion";
import {
  computeItemAmount,
  formatCurrency,
  getProductDisplayName,
} from "./productUtils";

export function createProduct(overrides = {}) {
  return {
    id: `product-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    productDisplayId: 1001,
    sku: "",
    previousSkus: [],
    productName: "",
    subNames: [],
    stockBaseUnit: "pcs",
    defaultPurchaseUnit: "pcs",
    defaultSalesUnit: "pcs",
    unitConversions: [
      { unit: "pcs", factorToBase: 1, allowPurchase: true, allowSale: true },
    ],
    categoryId: "",
    category: "",
    detail: "",
    isActive: true,
    productPictures: [],
    selectedPictureId: "",
    removePictureIds: [],
    ...overrides,
  };
}

export function createDraftPicture(file) {
  const objectUrl =
    typeof URL !== "undefined" && typeof URL.createObjectURL === "function"
      ? URL.createObjectURL(file)
      : "";

  return {
    id: `new-picture-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: file.name,
    url: objectUrl,
    file,
    isNew: true,
    isSelected: false,
  };
}

export function getTranslatedProductDisplayName(product, t) {
  return getProductDisplayName(
    product,
    t("products.productFallback", { id: product?.id || "" })
  );
}

export function computePurchaseBaseUnitCostBeforeDiscount(item) {
  const unitCost = Number(item.unit_cost);
  if (!Number.isFinite(unitCost)) {
    return null;
  }

  const quantity = Number(item.quantity) || 0;
  const baseQuantity = getItemBaseQuantity(item);
  const conversionFactor = Number(item.conversion_factor ?? item.conversionFactor);
  const resolvedFactor =
    Number.isFinite(conversionFactor) && conversionFactor > 0
      ? conversionFactor
      : quantity > 0 && baseQuantity > 0
        ? baseQuantity / quantity
        : 1;

  return unitCost / resolvedFactor;
}

export function computePurchaseBaseUnitCostAfterDiscount(item, purchase) {
  const baseQuantity = getItemBaseQuantity(item);
  if (baseQuantity <= 0) {
    return null;
  }

  return computeItemAmount(item, purchase) / baseQuantity;
}

export function formatOptionalCurrency(value) {
  return value === null || value === undefined || !Number.isFinite(Number(value))
    ? "—"
    : formatCurrency(value);
}
