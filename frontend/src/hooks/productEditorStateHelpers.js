// Helper utilities for shared application hook behavior.

import { createDraftPicture, isAttachableFile } from "../components/products/productEditorHelpers";
import {
  getCategoryPathSkuCode,
  getProductPictures,
  normalizeSku,
  normalizeUniqueNames,
} from "../components/products/productUtils";

/**
 * Pure helper to update a single draft field.
 */
export function updateDraftFieldHelper(
  prev,
  key,
  value,
  allProducts,
  categories,
  generateStructuredSku
) {
  if (!prev) {
    return prev;
  }

  const nextProduct = { ...prev, [key]: value };

  if (key === "categoryId" && !value) {
    const isExistingProduct = allProducts.some((product) => `${product.id}` === `${prev.id}`);

    return {
      ...nextProduct,
      sku: isExistingProduct ? nextProduct.sku : "",
    };
  }

  if (key === "categoryId" && getCategoryPathSkuCode(categories, value)) {
    const isExistingProduct = allProducts.some((product) => `${product.id}` === `${prev.id}`);
    const shouldRegenerateSku = !isExistingProduct || !normalizeSku(nextProduct.sku);

    if (!shouldRegenerateSku) {
      return nextProduct;
    }

    return {
      ...nextProduct,
      sku: generateStructuredSku(nextProduct),
    };
  }

  return nextProduct;
}

/**
 * Pure helper to add pictures to the product draft.
 */
export function addDraftPicturesHelper(prev, files) {
  if (!prev) {
    return prev;
  }

  const nextPictures = Array.from(files || [])
    .filter(isAttachableFile)
    .map(createDraftPicture);

  if (!nextPictures.length) {
    return prev;
  }

  const currentPictures = getProductPictures(prev);
  const selectedPictureId = prev.selectedPictureId || nextPictures[0].id;

  return {
    ...prev,
    productPictures: [...currentPictures, ...nextPictures].map((picture) => ({
      ...picture,
      isSelected: picture.id === selectedPictureId,
    })),
    selectedPictureId,
  };
}

/**
 * Pure helper to select a specific picture in the product draft.
 */
export function selectDraftPictureHelper(prev, pictureId) {
  if (!prev) {
    return prev;
  }

  return {
    ...prev,
    selectedPictureId: pictureId,
    productPictures: getProductPictures(prev).map((picture) => ({
      ...picture,
      isSelected: picture.id === pictureId,
    })),
  };
}

/**
 * Pure helper to remove a picture from the product draft.
 */
export function removeDraftPictureHelper(prev, pictureId) {
  if (!prev) {
    return prev;
  }

  const currentPictures = getProductPictures(prev);
  const removedPicture = currentPictures.find((picture) => picture.id === pictureId);
  const nextPictures = currentPictures.filter((picture) => picture.id !== pictureId);
  const currentSelectedRemoved = prev.selectedPictureId === pictureId;
  const selectedPictureId = currentSelectedRemoved
    ? nextPictures[0]?.id || ""
    : prev.selectedPictureId;
  const removePictureIds =
    removedPicture && !removedPicture.isNew
      ? [...(prev.removePictureIds || []), removedPicture.id]
      : prev.removePictureIds || [];

  return {
    ...prev,
    productPictures: nextPictures.map((picture) => ({
      ...picture,
      isSelected: picture.id === selectedPictureId,
    })),
    selectedPictureId,
    removePictureIds,
  };
}

/**
 * Pure helper to update a subname value by index.
 */
export function updateDraftSubNameHelper(prev, index, value) {
  if (!prev) {
    return prev;
  }

  const nextSubNames = [...(prev.subNames || [])];
  nextSubNames[index] = value;
  return { ...prev, subNames: nextSubNames };
}

/**
 * Pure helper to add an empty subname.
 */
export function addDraftSubNameHelper(prev) {
  if (!prev) {
    return prev;
  }

  return { ...prev, subNames: [...(prev.subNames || []), ""] };
}

/**
 * Pure helper to remove a subname by index.
 */
export function removeDraftSubNameHelper(prev, index) {
  if (!prev) {
    return prev;
  }

  return {
    ...prev,
    subNames: (prev.subNames || []).filter((_, itemIndex) => itemIndex !== index),
  };
}

/**
 * Pure helper to set a subname as the main name and shift the main name to subnames.
 */
export function setDraftSubNameAsMainHelper(prev) {
  if (!prev) {
    return prev;
  }

  return (index) => {
    const currentSubNames = [...(prev.subNames || [])];
    const selectedSubName = `${currentSubNames[index] ?? ""}`.trim();

    if (!selectedSubName) {
      return prev;
    }

    const currentMainName = `${prev.productName ?? ""}`.trim();
    const nextSubNames = currentSubNames.filter((_, itemIndex) => itemIndex !== index);

    if (currentMainName) {
      nextSubNames.unshift(currentMainName);
    }

    return {
      ...prev,
      productName: selectedSubName,
      subNames: normalizeUniqueNames(nextSubNames),
    };
  };
}

/**
 * Pure helper to update unit conversion by index.
 */
export function updateDraftUnitConversionHelper(prev, index, key, value) {
  if (!prev) {
    return prev;
  }

  const nextConversions = [...(prev.unitConversions || [])];
  nextConversions[index] = {
    ...nextConversions[index],
    [key]: value,
  };

  return { ...prev, unitConversions: nextConversions };
}

/**
 * Pure helper to toggle unit conversion field by index.
 */
export function toggleDraftUnitConversionHelper(prev, index, key) {
  if (!prev) {
    return prev;
  }

  const nextConversions = [...(prev.unitConversions || [])];
  nextConversions[index] = {
    ...nextConversions[index],
    [key]: !nextConversions[index]?.[key],
  };

  return { ...prev, unitConversions: nextConversions };
}

/**
 * Pure helper to add an empty unit conversion option.
 */
export function addDraftUnitConversionHelper(prev) {
  if (!prev) {
    return prev;
  }

  return {
    ...prev,
    unitConversions: [
      ...(prev.unitConversions || []),
      { unit: "", factorToBase: 1, allowPurchase: true, allowSale: true },
    ],
  };
}

/**
 * Pure helper to remove a unit conversion option by index, respecting the base unit.
 */
export function removeDraftUnitConversionHelper(prev, index, stockBaseUnit) {
  if (!prev) {
    return prev;
  }

  const nextConversions = (prev.unitConversions || []).filter(
    (conversion, itemIndex) =>
      itemIndex !== index ||
      `${conversion.unit}`.toLowerCase() === stockBaseUnit.toLowerCase()
  );

  return { ...prev, unitConversions: nextConversions };
}
