import { useLanguage } from "../../i18n/LanguageContext";

function ProductIdentityFields({
  draftProduct,
  categoryQuery,
  categoryComboboxOpen,
  productCategoryOptions,
  filteredProductCategoryOptions,
  isSkuLocked,
  onUpdateDraftField,
  onCategoryQueryChange,
  onCategoryFocus,
  onCategoryBlur,
  onSelectDraftCategory,
  onGenerateSku,
  onUnlockSkuChange,
  onAddDraftSubName,
  onUpdateDraftSubName,
  onSetDraftSubNameAsMain,
  onRemoveDraftSubName,
}) {
  const { t } = useLanguage();

  return (
    <section className="product-editor-section">
      <div className="product-editor-section-heading">
        <div>
          <p className="eyebrow">{t("products.identityEyebrow")}</p>
          <h4>{t("products.identityTitle")}</h4>
        </div>
        <span>{t("products.identityHint")}</span>
      </div>

      <div className="product-editor-grid">
        <label className="full-width">
          <span className="required-label">{t("products.mainNameLabel")}</span>
          <input
            autoFocus
            value={draftProduct.productName}
            onChange={(event) => onUpdateDraftField("productName", event.target.value)}
            placeholder={t("products.mainNamePlaceholder")}
          />
        </label>

        <label className="supplier-combobox-field full-width">
          <span className="required-label">{t("products.categoryLabel")}</span>
          <div className="supplier-combobox">
            <input
              type="search"
              value={categoryQuery}
              onChange={(event) => onCategoryQueryChange(event.target.value)}
              onFocus={onCategoryFocus}
              onBlur={onCategoryBlur}
              placeholder={
                productCategoryOptions.length
                  ? t("products.searchCategoryPlaceholder")
                  : t("products.noCategoryPlaceholder")
              }
              autoComplete="off"
              aria-expanded={categoryComboboxOpen}
              aria-controls="product-editor-category-list"
            />

            {categoryComboboxOpen ? (
              <div
                className="supplier-combobox-menu"
                id="product-editor-category-list"
                role="listbox"
              >
                {filteredProductCategoryOptions.length ? (
                  filteredProductCategoryOptions.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      className={
                        category.id === draftProduct.categoryId
                          ? "supplier-combobox-option active"
                          : "supplier-combobox-option"
                      }
                      onMouseDown={(event) => {
                        event.preventDefault();
                        onSelectDraftCategory(category);
                      }}
                      role="option"
                      aria-selected={category.id === draftProduct.categoryId}
                    >
                      {category.label}
                    </button>
                  ))
                ) : (
                  <div className="supplier-combobox-empty">
                    {t("products.noCategoryFound")}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </label>

        <label className="supplier-option-field product-editor-wide-field">
          <span className="required-label">{t("products.skuLabel")}</span>
          <div className="product-sku-edit-row">
            <input
              value={draftProduct.sku}
              onChange={(event) => onUpdateDraftField("sku", event.target.value)}
              onBlur={() => {
                if (!isSkuLocked) {
                  onUpdateDraftField("sku", `${draftProduct.sku ?? ""}`.trim());
                }
              }}
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder={t("products.skuPlaceholder")}
              disabled={isSkuLocked}
            />
            <button
              className="secondary-button"
              type="button"
              onClick={onGenerateSku}
              disabled={isSkuLocked}
            >
              {t("products.generateButton")}
            </button>
            {isSkuLocked ? (
              <button
                className="table-action-button"
                type="button"
                onClick={onUnlockSkuChange}
              >
                {t("products.changeSkuButton")}
              </button>
            ) : null}
          </div>
          <span className="field-helper-text">
            {isSkuLocked ? t("products.skuHelperLocked") : t("products.skuHelperUnlocked")}
          </span>
        </label>
      </div>

      <div className="supplier-option-field product-editor-subsection">
        <div className="product-name-editor-header">
          <div>
            <p className="detail-label">{t("products.subNamesLabel")}</p>
            <p className="inventory-note product-name-editor-note">
              {t("products.subNamesNote")}
            </p>
          </div>
          <button className="secondary-button" type="button" onClick={onAddDraftSubName}>
            {t("products.addSubNameButton")}
          </button>
        </div>

        {(draftProduct.subNames || []).length === 0 ? (
          <p className="empty-copy">{t("products.noSubNamesYet")}</p>
        ) : (
          (draftProduct.subNames || []).map((subName, index) => (
            <div className="supplier-option-edit-row" key={`product-sub-name-${index}`}>
              <input
                value={subName}
                onChange={(event) => onUpdateDraftSubName(index, event.target.value)}
                placeholder={t("products.subNamePlaceholder", { n: index + 1 })}
              />
              <div className="supplier-option-edit-actions">
                <button
                  className="table-action-button"
                  type="button"
                  onClick={() => onSetDraftSubNameAsMain(index)}
                >
                  {t("products.useAsMainButton")}
                </button>
                <button
                  className="icon-button subtle"
                  type="button"
                  aria-label={t("products.removeSubNameAriaLabel", { n: index + 1 })}
                  onClick={() => onRemoveDraftSubName(index)}
                >
                  X
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export default ProductIdentityFields;
