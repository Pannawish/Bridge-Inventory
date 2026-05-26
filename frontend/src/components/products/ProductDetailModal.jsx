import { useLanguage } from "../../i18n/LanguageContext";
import ProductHistoryProfilePanel from "./ProductHistoryProfilePanel";
import ProductHistoryTableSection from "./ProductHistoryTableSection";
import ProductTransactionDetailModal from "./ProductTransactionDetailModal";
import { getTranslatedProductDisplayName } from "./productEditorHelpers";

function ProductHistoryModal({
  viewingProduct,
  viewingPictureId,
  onViewingPictureChange,
  categories,
  viewingProductMetrics,
  productHistoryLoadingId,
  productHistoryError,
  viewPurchaseHistory,
  purchaseHistoryPagination,
  onPurchaseHistoryPageChange,
  viewSalesHistory,
  salesHistoryPagination,
  onSalesHistoryPageChange,
  onOpenTransactionDetail,
  onOpenProductEditor,
  onClose,
}) {
  const { t } = useLanguage();

  return (
    <div
      className="detail-modal product-detail-modal section-card"
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-history-title"
    >
      <div className="section-heading supplier-modal-header">
        <div>
          <p className="eyebrow">{t("products.purchaseHistoryEyebrow")}</p>
          <h3 id="product-history-title">
            {getTranslatedProductDisplayName(viewingProduct, t)}
          </h3>
        </div>
        <div className="product-detail-header-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={() => onOpenProductEditor(viewingProduct)}
          >
            {t("common.edit")}
          </button>
          <button
            className="icon-button subtle"
            type="button"
            aria-label={t("common.close")}
            onClick={onClose}
          >
            X
          </button>
        </div>
      </div>

      <div className="product-detail-body">
        <ProductHistoryProfilePanel
          viewingProduct={viewingProduct}
          viewingPictureId={viewingPictureId}
          onViewingPictureChange={onViewingPictureChange}
          categories={categories}
          viewingProductMetrics={viewingProductMetrics}
        />

        {productHistoryLoadingId === `${viewingProduct.id}` ? (
          <div className="notice-banner">{t("products.loadingTransactionHistory")}</div>
        ) : null}
        {productHistoryError ? <div className="error-banner">{productHistoryError}</div> : null}

        <ProductHistoryTableSection
          type="purchase"
          viewingProduct={viewingProduct}
          historyRows={viewPurchaseHistory}
          pagination={purchaseHistoryPagination}
          onPageChange={onPurchaseHistoryPageChange}
          onOpenTransactionDetail={onOpenTransactionDetail}
        />

        <ProductHistoryTableSection
          type="sale"
          viewingProduct={viewingProduct}
          historyRows={viewSalesHistory}
          pagination={salesHistoryPagination}
          onPageChange={onSalesHistoryPageChange}
          onOpenTransactionDetail={onOpenTransactionDetail}
        />
      </div>
    </div>
  );
}

function ProductDetailModal(props) {
  const { viewingProduct, viewingTransaction } = props;

  if (!viewingProduct && !viewingTransaction) {
    return null;
  }

  return (
    <div className="modal-backdrop">
      {viewingTransaction ? (
        <ProductTransactionDetailModal {...props} />
      ) : (
        <ProductHistoryModal {...props} />
      )}
    </div>
  );
}

export default ProductDetailModal;
