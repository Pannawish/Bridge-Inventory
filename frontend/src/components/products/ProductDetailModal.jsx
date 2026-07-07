// Modal component for product management workflows.

import { useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import DocumentRefModal from "../DocumentRefModal";
import ProductHistoryProfilePanel from "./ProductHistoryProfilePanel";
import ProductStockSourcesSection from "./ProductStockSourcesSection";
import ProductPriceInsightsSection from "./ProductPriceInsightsSection";
import ProductHistoryTableSection from "./ProductHistoryTableSection";
import ProductTransactionDetailModal from "./ProductTransactionDetailModal";
import { getTranslatedProductDisplayName } from "./productEditorHelpers";

function ProductHistoryModal({
  viewingProduct,
  viewingPictureId,
  onViewingPictureChange,
  categories,
  viewingProductMetrics,
  priceInsights,
  purchasePartyOptions,
  salesPartyOptions,
  historySupplierFilter,
  onHistorySupplierFilterChange,
  historyCustomerFilter,
  onHistoryCustomerFilterChange,
  historyDateFrom,
  onHistoryDateFromChange,
  historyDateTo,
  onHistoryDateToChange,
  historyFilterActive,
  onResetHistoryFilters,
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
  stockLayers,
  stockLayersLoading,
  stockLayersError,
}) {
  const { t } = useLanguage();
  // Read-only preview for a PO/TI clicked in the stock-sources / history tables.
  const [docRefModal, setDocRefModal] = useState(null);

  return (
    <>
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

        <ProductStockSourcesSection
          viewingProduct={viewingProduct}
          stockLayers={stockLayers}
          loading={stockLayersLoading}
          error={stockLayersError}
          onOpenDocRef={setDocRefModal}
        />

        <ProductPriceInsightsSection
          viewingProduct={viewingProduct}
          insights={priceInsights}
          supplierOptions={purchasePartyOptions}
          customerOptions={salesPartyOptions}
          supplierFilter={historySupplierFilter}
          onSupplierFilterChange={onHistorySupplierFilterChange}
          customerFilter={historyCustomerFilter}
          onCustomerFilterChange={onHistoryCustomerFilterChange}
          dateFrom={historyDateFrom}
          onDateFromChange={onHistoryDateFromChange}
          dateTo={historyDateTo}
          onDateToChange={onHistoryDateToChange}
          filterActive={historyFilterActive}
          onResetFilters={onResetHistoryFilters}
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
          onOpenDocRef={setDocRefModal}
        />

        <ProductHistoryTableSection
          type="sale"
          viewingProduct={viewingProduct}
          historyRows={viewSalesHistory}
          pagination={salesHistoryPagination}
          onPageChange={onSalesHistoryPageChange}
          onOpenTransactionDetail={onOpenTransactionDetail}
          onOpenDocRef={setDocRefModal}
        />
      </div>
    </div>
    {docRefModal ? (
      <DocumentRefModal
        docType={docRefModal.docType}
        docId={docRefModal.docId}
        referenceNo={docRefModal.referenceNo}
        onClose={() => setDocRefModal(null)}
      />
    ) : null}
    </>
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
