// Utility module for application shell: product payload.

function isBrowserFile(value) {
  return typeof File !== "undefined" && value instanceof File;
}

function appendProductJson(formData, key, value) {
  formData.append(key, JSON.stringify(Array.isArray(value) ? value : []));
}

export function buildProductSavePayload(product) {
  const formData = new FormData();
  const productPictures = Array.isArray(product.productPictures) ? product.productPictures : [];
  const newPictures = productPictures.filter((picture) => isBrowserFile(picture.file));
  const selectedPictureId = `${product.selectedPictureId || ""}`;
  const selectedNewPictureIndex = newPictures.findIndex(
    (picture) => picture.id === selectedPictureId
  );

  [
    "id",
    "productDisplayId",
    "sku",
    "productName",
    "stockBaseUnit",
    "defaultPurchaseUnit",
    "defaultSalesUnit",
    "categoryId",
    "category",
    "detail",
    "isActive",
  ].forEach((field) => {
    if (product[field] !== undefined) {
      formData.append(field, product[field] ?? "");
    }
  });

  // reorder_level is the one writable field the API keeps in snake_case (no
  // camelCase alias), so map it explicitly. Only send a real number so a blank
  // never clobbers the stored point.
  if (
    product.reorderLevel !== undefined &&
    product.reorderLevel !== null &&
    `${product.reorderLevel}` !== ""
  ) {
    formData.append("reorder_level", product.reorderLevel);
  }

  appendProductJson(formData, "previousSkus", product.previousSkus);
  appendProductJson(formData, "subNames", product.subNames);
  appendProductJson(formData, "unitConversions", product.unitConversions);

  newPictures.forEach((picture) => {
    formData.append("pictures", picture.file);
  });

  if (Array.isArray(product.removePictureIds) && product.removePictureIds.length) {
    appendProductJson(formData, "remove_picture_ids", product.removePictureIds);
  }

  if (selectedNewPictureIndex >= 0) {
    formData.append("selected_picture_index", selectedNewPictureIndex);
  } else if (selectedPictureId) {
    formData.append("selected_picture_id", selectedPictureId);
  }

  return formData;
}
