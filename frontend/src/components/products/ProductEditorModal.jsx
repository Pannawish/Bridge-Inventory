// Modal component for product management workflows.

import { useLanguage } from "../../i18n/LanguageContext";
import { getTranslatedProductDisplayName } from "./productEditorHelpers";
import ProductIdentityFields from "./ProductIdentityFields";
import ProductMediaFields from "./ProductMediaFields";
import ProductUnitsFields from "./ProductUnitsFields";
import { markFieldBlurredOnBlurCapture } from "../formBlurValidation";

function ProductEditorModal({
  draftProduct,
  allProducts,
  isDirty = false,
  productFormError,
  productFieldErrors,
  categoryQuery,
  categoryComboboxOpen,
  productCategoryOptions,
  filteredProductCategoryOptions,
  isSkuLocked,
  draftProductPictures,
  selectedDraftPicture,
  draftExistingProduct,
  draftProductHasHistory,
  isDraftProductActive,
  isProductEnableDisabled,
  productEnableDisabledReason,
  isProductDisableDisabled,
  productDisableDisabledReason,
  isProductDeleteDisabled,
  productDeleteDisabledReason,
  onClose,
  onSave,
  onUpdateDraftField,
  onCategoryQueryChange,
  onCategoryFocus,
  onCategoryBlur,
  onValidateDraftField,
  onSelectDraftCategory,
  onGenerateSku,
  onUnlockSkuChange,
  onAddDraftSubName,
  onUpdateDraftSubName,
  onSetDraftSubNameAsMain,
  onRemoveDraftSubName,
  onAddDraftUnitConversion,
  onUpdateDraftUnitConversion,
  onToggleDraftUnitConversion,
  onRemoveDraftUnitConversion,
  onAddDraftPictures,
  onSelectDraftPicture,
  onRemoveDraftPicture,
  onEnableProduct,
  onDisableProduct,
  onDeleteProduct,
}) {
  const { t } = useLanguage();

  if (!draftProduct) {
    return null;
  }

  const isExistingProduct = allProducts.some((product) => product.id === draftProduct.id);

  return (
    <div className="modal-backdrop">
      <div
        className="detail-modal supplier-modal product-editor-modal section-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-modal-title"
      >
        <div className="section-heading supplier-modal-header">
          <div>
            <p className="eyebrow">
              {isExistingProduct ? t("products.editEyebrow") : t("products.newEyebrow")}
            </p>
            <h3 id="product-modal-title">
              {getTranslatedProductDisplayName(draftProduct, t) || t("products.newEyebrow")}
            </h3>
          </div>
          <button
            className="icon-button subtle"
            type="button"
            aria-label={t("common.close")}
            onClick={onClose}
          >
            X
          </button>
        </div>

        {productFormError ? <div className="error-banner">{productFormError}</div> : null}

        <form
          className="form-layout"
          onBlurCapture={markFieldBlurredOnBlurCapture}
          onSubmit={(event) => {
            event.preventDefault();
            onSave();
          }}
        >
          <div className="product-editor-layout">
            <ProductIdentityFields
              draftProduct={draftProduct}
              productFieldErrors={productFieldErrors}
              categoryQuery={categoryQuery}
              categoryComboboxOpen={categoryComboboxOpen}
              productCategoryOptions={productCategoryOptions}
              filteredProductCategoryOptions={filteredProductCategoryOptions}
              isSkuLocked={isSkuLocked}
              onUpdateDraftField={onUpdateDraftField}
              onCategoryQueryChange={onCategoryQueryChange}
              onCategoryFocus={onCategoryFocus}
              onCategoryBlur={onCategoryBlur}
              onValidateDraftField={onValidateDraftField}
              onSelectDraftCategory={onSelectDraftCategory}
              onGenerateSku={onGenerateSku}
              onUnlockSkuChange={onUnlockSkuChange}
              onAddDraftSubName={onAddDraftSubName}
              onUpdateDraftSubName={onUpdateDraftSubName}
              onSetDraftSubNameAsMain={onSetDraftSubNameAsMain}
              onRemoveDraftSubName={onRemoveDraftSubName}
            />

            <ProductUnitsFields
              draftProduct={draftProduct}
              productFieldErrors={productFieldErrors}
              onUpdateDraftField={onUpdateDraftField}
              onValidateDraftField={onValidateDraftField}
              onAddDraftUnitConversion={onAddDraftUnitConversion}
              onUpdateDraftUnitConversion={onUpdateDraftUnitConversion}
              onToggleDraftUnitConversion={onToggleDraftUnitConversion}
              onRemoveDraftUnitConversion={onRemoveDraftUnitConversion}
            />

            <ProductMediaFields
              draftProduct={draftProduct}
              draftProductPictures={draftProductPictures}
              selectedDraftPicture={selectedDraftPicture}
              onAddDraftPictures={onAddDraftPictures}
              onSelectDraftPicture={onSelectDraftPicture}
              onRemoveDraftPicture={onRemoveDraftPicture}
              onUpdateDraftField={onUpdateDraftField}
            />
          </div>

          <div className="supplier-modal-actions">
            {draftExistingProduct ? (
              <div className="product-delete-action">
                {!isDraftProductActive ? (
                  <>
                    <button
                      className="primary-button"
                      type="button"
                      onClick={onEnableProduct}
                      disabled={isProductEnableDisabled}
                      title={productEnableDisabledReason || undefined}
                    >
                      {t("products.enableProductButton")}
                    </button>
                    <span className="field-helper-text product-delete-helper">
                      {productEnableDisabledReason || t("products.enableProductHelper")}
                    </span>
                  </>
                ) : draftProductHasHistory ? (
                  <>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={onDisableProduct}
                      disabled={isProductDisableDisabled}
                      title={productDisableDisabledReason || undefined}
                    >
                      {t("products.disableProductButton")}
                    </button>
                    <span className="field-helper-text product-delete-helper">
                      {productDisableDisabledReason || t("products.disableProductHelper")}
                    </span>
                  </>
                ) : (
                  <>
                    <button
                      className="danger-button"
                      type="button"
                      onClick={onDeleteProduct}
                      disabled={isProductDeleteDisabled}
                      title={productDeleteDisabledReason || undefined}
                    >
                      {t("products.deleteButton")}
                    </button>
                    {productDeleteDisabledReason ? (
                      <span className="field-helper-text product-delete-helper">
                        {productDeleteDisabledReason}
                      </span>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}
            <button className="secondary-button" type="button" onClick={onClose}>
              {t("products.cancelButton")}
            </button>
            <button className="primary-button" type="submit" disabled={!isDirty}>
              {t("products.saveButton")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ProductEditorModal;
