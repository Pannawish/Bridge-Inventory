import {
  getProductPreviousSkus,
  isValidSku,
  isProductActive,
  normalizeProduct,
  normalizeSku,
  normalizeUniqueNames,
} from "./productUtils";
import { getTranslatedProductDisplayName } from "./productEditorHelpers";

/**
 * Runs all product-save validation checks in sequence.
 *
 * Returns { error, normalizedDraft } where error is a translated string
 * if validation failed, or null if all checks pass. normalizedDraft may
 * have its SKU auto-generated if it was empty.
 */
export function validateProductForSave(
  normalizedDraft,
  {
    allProducts,
    productCategoryOptions,
    existingProduct,
    existingProductHasHistory,
    skuChangeUnlocked,
    generateStructuredSku,
    t,
  }
) {
  if (!normalizedDraft.categoryId) {
    return { error: t("products.errorSelectCategory"), normalizedDraft };
  }

  if (!productCategoryOptions.some((category) => category.id === normalizedDraft.categoryId)) {
    return { error: t("products.errorInvalidCategory"), normalizedDraft };
  }

  // Auto-generate SKU when missing
  let draft = normalizedDraft;
  if (!draft.sku) {
    draft = { ...draft, sku: generateStructuredSku(draft) };
  }

  const skuChanged =
    existingProduct && normalizeSku(existingProduct.sku) !== draft.sku;
  const hasUnchangedExistingSku = Boolean(existingProduct && !skuChanged);

  if (!draft.sku) {
    return { error: t("products.errorSkuRequired"), normalizedDraft: draft };
  }

  if (!isValidSku(draft.sku) && !hasUnchangedExistingSku) {
    return { error: t("products.errorSkuInvalid"), normalizedDraft: draft };
  }

  const duplicateProduct = allProducts.find(
    (product) =>
      `${product.id}` !== `${draft.id}` &&
      (normalizeSku(product.sku) === draft.sku ||
        getProductPreviousSkus(product).some((sku) => normalizeSku(sku) === draft.sku))
  );

  if (duplicateProduct) {
    return {
      error: t("products.errorSkuDuplicate", {
        sku: draft.sku,
        name: getTranslatedProductDisplayName(duplicateProduct, t),
      }),
      normalizedDraft: draft,
    };
  }

  if (existingProductHasHistory && skuChanged && !skuChangeUnlocked) {
    return { error: t("products.errorSkuLocked"), normalizedDraft: draft };
  }

  if (!draft.stockBaseUnit) {
    return { error: t("products.errorNoBaseUnit"), normalizedDraft: draft };
  }

  const purchaseUnit = draft.unitConversions.find(
    (conversion) =>
      conversion.unit.toLowerCase() === draft.defaultPurchaseUnit.toLowerCase()
  );
  const salesUnit = draft.unitConversions.find(
    (conversion) =>
      conversion.unit.toLowerCase() === draft.defaultSalesUnit.toLowerCase()
  );

  if (!purchaseUnit?.allowPurchase) {
    return { error: t("products.errorPurchaseUnit"), normalizedDraft: draft };
  }

  if (!salesUnit?.allowSale) {
    return { error: t("products.errorSalesUnit"), normalizedDraft: draft };
  }

  return { error: null, normalizedDraft: draft };
}

/**
 * Builds the final product payload for save, including previousSkus history
 * and category label snapshot.
 */
export function buildSavePayload(normalizedDraft, existingProduct, categoryLabel) {
  const skuChanged =
    existingProduct && normalizeSku(existingProduct.sku) !== normalizedDraft.sku;

  const nextPreviousSkus =
    existingProduct && skuChanged
      ? normalizeUniqueNames([
          ...(normalizedDraft.previousSkus || []),
          normalizeSku(existingProduct.sku),
        ])
      : normalizedDraft.previousSkus;

  return {
    ...normalizedDraft,
    previousSkus: nextPreviousSkus,
    category: categoryLabel,
  };
}

/**
 * Returns an error string if the product cannot be deleted, or empty string
 * if deletion may proceed. The caller still needs to show a confirm dialog.
 */
export function getDeleteGuard(existingProduct, hasTransactionHistory, t) {
  if (!existingProduct) {
    return t("products.errorOnlySavedCanDelete");
  }

  if (hasTransactionHistory) {
    return t("products.hasHistoryDeleteDisabled");
  }

  return "";
}

/**
 * Returns an error string if the product cannot be disabled, or empty string
 * if the disable action may proceed.
 */
export function getDisableGuard(existingProduct, t) {
  if (!existingProduct) {
    return t("products.errorOnlySavedCanDisable");
  }

  if (!isProductActive(existingProduct)) {
    return t("products.errorAlreadyDisabled");
  }

  return "";
}

/**
 * Returns an error string if the product cannot be enabled, or empty string
 * if the enable action may proceed.
 */
export function getEnableGuard(existingProduct, t) {
  if (!existingProduct) {
    return t("products.errorOnlySavedCanEnable");
  }

  if (isProductActive(existingProduct)) {
    return t("products.errorAlreadyEnabled");
  }

  return "";
}

/**
 * Computes the derived action-state flags shown on the product editor modal
 * (delete/disable/enable disabled reasons and whether the SKU field is locked).
 */
export function getDraftActionStates({
  draftProduct,
  draftExistingProduct,
  draftProductHasHistory,
  skuChangeUnlocked,
  productHistoryLoadingId,
  t,
}) {
  const isDraftProductActive = isProductActive(draftExistingProduct || draftProduct);
  const isDraftHistoryLoading =
    Boolean(draftExistingProduct) &&
    productHistoryLoadingId === `${draftExistingProduct.id}`;
  const isSkuLocked = Boolean(
    draftExistingProduct && draftProductHasHistory && !skuChangeUnlocked
  );

  const productDeleteDisabledReason = !draftProduct
    ? ""
    : !draftExistingProduct
      ? t("products.errorOnlySavedCanDelete")
      : isDraftHistoryLoading
        ? t("products.checkingHistoryDelete")
        : "";
  const isProductDeleteDisabled = Boolean(productDeleteDisabledReason);

  const productDisableDisabledReason = !draftProduct
    ? ""
    : !draftExistingProduct
      ? t("products.errorOnlySavedCanDisable")
      : isDraftHistoryLoading
        ? t("products.checkingHistoryDisable")
        : !isDraftProductActive
          ? t("products.errorAlreadyDisabled")
          : "";
  const isProductDisableDisabled = Boolean(productDisableDisabledReason);

  const productEnableDisabledReason = !draftProduct
    ? ""
    : !draftExistingProduct
      ? t("products.errorOnlySavedCanEnable")
      : isDraftProductActive
        ? t("products.errorAlreadyEnabled")
        : "";
  const isProductEnableDisabled = Boolean(productEnableDisabledReason);

  return {
    isDraftProductActive,
    isSkuLocked,
    isProductDeleteDisabled,
    productDeleteDisabledReason,
    isProductDisableDisabled,
    productDisableDisabledReason,
    isProductEnableDisabled,
    productEnableDisabledReason,
  };
}
