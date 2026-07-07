// Modal component for category management workflows.

import { useLanguage } from "../../i18n/LanguageContext";

function CategoryEditorModal({
  categories,
  draftCategory,
  formError,
  isDirty = false,
  parentCategoryInput,
  isParentCategoryMenuOpen,
  shouldShowRootParentOption,
  filteredParentCategoryOptions,
  onClose,
  onSaveCategory,
  onDeleteCategory,
  onUpdateDraftField,
  onSetFormError,
  onParentCategoryInputChange,
  onParentCategoryFocus,
  onParentCategoryBlur,
  onParentCategoryKeyDown,
  onSelectParentCategory,
}) {
  const { t } = useLanguage();

  return (
    <div className="modal-backdrop">
      <div
        className="detail-modal supplier-modal section-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="category-modal-title"
      >
        <div className="section-heading supplier-modal-header">
          <div>
            <p className="eyebrow">
              {categories.some((category) => category.id === draftCategory.id)
                ? t("category.editEyebrow")
                : t("category.newEyebrow")}
            </p>
            <h3 id="category-modal-title">
              {draftCategory.name || t("category.unnamedCategory")}
            </h3>
          </div>
          <button
            className="icon-button subtle"
            type="button"
            aria-label={t("category.closeLabel")}
            onClick={onClose}
          >
            X
          </button>
        </div>

        {formError ? <div className="error-banner">{formError}</div> : null}

        <form className="form-layout" onSubmit={onSaveCategory}>
          <div className="form-grid">
            <label className="full-width">
              {t("category.categoryNameLabel")}
              <input
                autoFocus
                value={draftCategory.name}
                onChange={(event) => {
                  onUpdateDraftField("name", event.target.value);
                  onSetFormError("");
                }}
                placeholder={t("category.categoryNamePlaceholder")}
                required
              />
            </label>

            <label className="full-width supplier-combobox-field">
              {t("category.parentCategoryLabel")}
              <div className="supplier-combobox">
                <input
                  type="search"
                  role="combobox"
                  aria-expanded={isParentCategoryMenuOpen}
                  aria-controls="category-parent-list"
                  aria-autocomplete="list"
                  value={parentCategoryInput}
                  onChange={(event) => onParentCategoryInputChange(event.target.value)}
                  onFocus={onParentCategoryFocus}
                  onBlur={onParentCategoryBlur}
                  onKeyDown={onParentCategoryKeyDown}
                  placeholder={t("category.parentCategoryPlaceholder")}
                />

                {isParentCategoryMenuOpen ? (
                  <div
                    className="supplier-combobox-menu"
                    id="category-parent-list"
                    role="listbox"
                  >
                    {shouldShowRootParentOption ? (
                      <button
                        className={
                          draftCategory.parentId
                            ? "supplier-combobox-option"
                            : "supplier-combobox-option active"
                        }
                        type="button"
                        role="option"
                        aria-selected={!draftCategory.parentId}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          onSelectParentCategory(null);
                        }}
                      >
                        {t("category.rootCategoryOption")}
                      </button>
                    ) : null}

                    {filteredParentCategoryOptions.map((category) => (
                      <button
                        className={
                          category.id === draftCategory.parentId
                            ? "supplier-combobox-option active"
                            : "supplier-combobox-option"
                        }
                        key={category.id}
                        type="button"
                        role="option"
                        aria-selected={category.id === draftCategory.parentId}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          onSelectParentCategory(category);
                        }}
                      >
                        {category.label}
                      </button>
                    ))}

                    {!shouldShowRootParentOption && filteredParentCategoryOptions.length === 0 ? (
                      <div className="supplier-combobox-empty">
                        {t("category.noMatchingParent")}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <span className="field-helper-text">{t("category.clearForRoot")}</span>
            </label>

            <label className="full-width">
              {t("category.descriptionLabel")}
              <textarea
                rows="3"
                value={draftCategory.description}
                onChange={(event) => onUpdateDraftField("description", event.target.value)}
                placeholder={t("category.descriptionPlaceholder")}
              />
            </label>
          </div>

          <div className="supplier-modal-actions">
            <button className="danger-button" type="button" onClick={onDeleteCategory}>
              {t("category.deleteButton")}
            </button>
            <button className="secondary-button" type="button" onClick={onClose}>
              {t("common.cancel")}
            </button>
            <button className="primary-button" type="submit" disabled={!isDirty}>
              {t("category.saveButton")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CategoryEditorModal;
