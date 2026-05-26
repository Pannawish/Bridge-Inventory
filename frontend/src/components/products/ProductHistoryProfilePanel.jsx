import { getProductBaseUnit } from "../../unitConversion";
import { useLanguage } from "../../i18n/LanguageContext";
import {
  formatCurrency,
  formatStockQuantity,
  getDocumentName,
  getProductCategoryLabel,
  getProductPictures,
  getProductSubNames,
  getSelectedProductPicture,
} from "./productUtils";
import { getTranslatedProductDisplayName } from "./productEditorHelpers";

function ProductHistoryProfilePanel({
  viewingProduct,
  viewingPictureId,
  onViewingPictureChange,
  categories,
  viewingProductMetrics,
}) {
  const { t } = useLanguage();
  const viewingProductPictures = getProductPictures(viewingProduct);
  const selectedViewingPicture =
    viewingProductPictures.find((picture) => picture.id === viewingPictureId) ||
    getSelectedProductPicture(viewingProduct);

  return (
    <>
      <div className="product-history-info-strip">
        <div className="product-history-stat">
          <span>{t("products.statSKU")}</span>
          <strong>{viewingProduct.sku || "—"}</strong>
        </div>
        <div className="product-history-stat">
          <span>{t("products.statCategory")}</span>
          <strong>{getProductCategoryLabel(viewingProduct, categories) || "—"}</strong>
        </div>
        <div className="product-history-stat">
          <span>{t("products.statTotalUnits")}</span>
          <strong>{formatStockQuantity(viewingProductMetrics?.totalUnits ?? 0, viewingProduct)}</strong>
        </div>
        <div className="product-history-stat">
          <span>{t("products.statAvgPrice")}</span>
          <strong>{formatCurrency(viewingProductMetrics?.avgPrice ?? 0)}</strong>
        </div>
      </div>

      <div className="product-profile-panel">
        <div className="product-profile-media">
          {selectedViewingPicture?.url ? (
            <img
              src={selectedViewingPicture.url}
              alt={getTranslatedProductDisplayName(viewingProduct, t)}
              className="product-profile-image"
              onError={(event) => {
                event.target.style.display = "none";
              }}
            />
          ) : (
            <div className="product-profile-placeholder">{t("products.noImage")}</div>
          )}
          {viewingProductPictures.length > 1 ? (
            <div className="product-picture-links compact">
              {viewingProductPictures.map((picture) => (
                <button
                  className={
                    selectedViewingPicture?.id === picture.id
                      ? "product-picture-link active"
                      : "product-picture-link"
                  }
                  type="button"
                  key={picture.id}
                  onClick={() => onViewingPictureChange(picture.id)}
                >
                  {picture.name || getDocumentName(picture.url, t)}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="product-profile-copy">
          <div>
            <p className="detail-label">{t("products.mainNameLabel")}</p>
            <strong>{getTranslatedProductDisplayName(viewingProduct, t)}</strong>
          </div>
          <div>
            <p className="detail-label">{t("products.subNamesLabel")}</p>
            {getProductSubNames(viewingProduct).length ? (
              <div className="item-pill-list">
                {getProductSubNames(viewingProduct).map((subName) => (
                  <span key={subName} className="item-pill">
                    {subName}
                  </span>
                ))}
              </div>
            ) : (
              <strong>—</strong>
            )}
          </div>
          <div>
            <p className="detail-label">{t("products.categoryLabel")}</p>
            <strong>{getProductCategoryLabel(viewingProduct, categories) || "—"}</strong>
          </div>
          <div>
            <p className="detail-label">{t("products.baseStockUnitLabel")}</p>
            <strong>{getProductBaseUnit(viewingProduct)}</strong>
          </div>
          <div>
            <p className="detail-label">{t("products.productDetailLabel")}</p>
            <p className="product-detail-text">{viewingProduct.detail || "—"}</p>
          </div>
        </div>
      </div>
    </>
  );
}

export default ProductHistoryProfilePanel;
