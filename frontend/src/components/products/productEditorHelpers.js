// Helper utilities for product management behavior.

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

// Attachments accepted for a product: common image formats plus PDF. Used both
// for the file-picker `accept` and to filter dropped/selected files.
export const ATTACHABLE_FILE_ACCEPT =
  "image/jpeg,image/jpg,image/png,image/webp,image/gif,application/pdf,.pdf";

export function isAttachableFile(file) {
  const type = (file?.type || "").toLowerCase();
  const name = (file?.name || "").toLowerCase();
  return type.startsWith("image/") || type === "application/pdf" || name.endsWith(".pdf");
}

// A saved or draft attachment is a PDF if its file type, filename, or URL says so.
export function isPdfAttachment(picture) {
  const type = (picture?.file?.type || "").toLowerCase();
  const name = (picture?.name || "").toLowerCase();
  const url = (picture?.url || "").toLowerCase().split("?")[0];
  return type === "application/pdf" || name.endsWith(".pdf") || url.endsWith(".pdf");
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
