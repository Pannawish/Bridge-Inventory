import { useLanguage } from "../../i18n/LanguageContext";
import { getDocumentName } from "./productUtils";
import { ATTACHABLE_FILE_ACCEPT, isPdfAttachment } from "./productEditorHelpers";

function ProductMediaFields({
  draftProduct,
  draftProductPictures,
  selectedDraftPicture,
  onAddDraftPictures,
  onSelectDraftPicture,
  onRemoveDraftPicture,
  onUpdateDraftField,
}) {
  const { t } = useLanguage();

  return (
    <section className="product-editor-section">
      <div className="product-editor-section-heading">
        <div>
          <p className="eyebrow">{t("products.detailSectionEyebrow")}</p>
          <h4>{t("products.detailSectionTitle")}</h4>
        </div>
        <span>{t("products.detailSectionHint")}</span>
      </div>

      <div className="product-editor-grid">
        <div className="transaction-document-panel product-picture-upload-panel full-width">
          <div className="transaction-document-panel-header">
            <div>
              <strong>{t("products.pictureLabel")}</strong>
              <span>
                {draftProductPictures.length
                  ? t("products.picturesAttached", {
                      count: draftProductPictures.length,
                      plural: draftProductPictures.length === 1 ? "" : "s",
                    })
                  : t("products.noPicturesAttached")}
              </span>
            </div>
            <label className="document-upload-button">
              {t("products.addPicturesButton")}
              <input
                type="file"
                accept={ATTACHABLE_FILE_ACCEPT}
                multiple
                onChange={(event) => {
                  // Snapshot the FileList into a real array BEFORE clearing the
                  // input. The picker resets synchronously, which empties the live
                  // FileList before React's state updater reads it — that was the
                  // "upload twice / preview doesn't show" bug.
                  const files = Array.from(event.target.files || []);
                  event.target.value = "";
                  onAddDraftPictures(files);
                }}
              />
            </label>
          </div>

          {selectedDraftPicture?.url ? (
            isPdfAttachment(selectedDraftPicture) ? (
              <iframe
                src={selectedDraftPicture.url}
                title={selectedDraftPicture.name || t("products.pictureLabel")}
                className="product-picture-preview product-picture-preview-pdf"
              />
            ) : (
              <img
                src={selectedDraftPicture.url}
                alt={t("products.pictureLabel")}
                className="product-picture-preview"
                onError={(event) => {
                  event.target.style.display = "none";
                }}
              />
            )
          ) : (
            <p className="transaction-document-empty">{t("products.noPictureSelected")}</p>
          )}

          {draftProductPictures.length ? (
            <div className="product-picture-list">
              {draftProductPictures.map((picture) => (
                <span className="product-picture-row" key={picture.id}>
                  <button
                    className={
                      selectedDraftPicture?.id === picture.id
                        ? "product-picture-link active"
                        : "product-picture-link"
                    }
                    type="button"
                    onClick={() => onSelectDraftPicture(picture.id)}
                  >
                    {picture.name || getDocumentName(picture.url, t)}
                  </button>
                  <button
                    className="text-danger-button"
                    type="button"
                    onClick={() => onRemoveDraftPicture(picture.id)}
                  >
                    {t("products.removeButton")}
                  </button>
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <label className="full-width">
          {t("products.productDetailLabel")}
          <textarea
            rows="4"
            value={draftProduct.detail}
            onChange={(event) => onUpdateDraftField("detail", event.target.value)}
            placeholder={t("products.productDetailPlaceholder")}
          />
        </label>
      </div>
    </section>
  );
}

export default ProductMediaFields;
