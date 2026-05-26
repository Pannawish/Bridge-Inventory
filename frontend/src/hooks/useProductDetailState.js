import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import {
  createLocalPagination,
  getPaginatedRows,
  getProductPurchaseHistoryEntries,
  getProductSalesHistoryEntries,
} from "../components/products/productHistoryHelpers";
import { getProductMetrics, getSelectedProductPicture } from "../components/products/productUtils";

function useProductDetailState({
  purchases,
  sales,
  onLoadProductHistory,
}) {
  const [viewingProduct, setViewingProduct] = useState(null);
  const [viewingTransaction, setViewingTransaction] = useState(null);
  const [viewingPictureId, setViewingPictureId] = useState("");
  const [productHistoryById, setProductHistoryById] = useState({});
  const [productHistoryLoadingId, setProductHistoryLoadingId] = useState("");
  const [productHistoryError, setProductHistoryError] = useState("");
  const [purchaseHistoryPage, setPurchaseHistoryPage] = useState(1);
  const [salesHistoryPage, setSalesHistoryPage] = useState(1);

  useEffect(() => {
    setPurchaseHistoryPage(1);
    setSalesHistoryPage(1);
  }, [viewingProduct?.id]);

  const [stockLayers, setStockLayers] = useState([]);
  const [stockLayersLoading, setStockLayersLoading] = useState(false);
  const [stockLayersError, setStockLayersError] = useState("");

  useEffect(() => {
    if (!viewingProduct?.id) {
      setStockLayers([]);
      setStockLayersLoading(false);
      setStockLayersError("");
      return;
    }

    let isMounted = true;
    async function fetchLayers() {
      setStockLayersLoading(true);
      setStockLayersError("");
      try {
        const data = await api.getProductStockLayers(viewingProduct.id);
        if (isMounted) {
          setStockLayers(data?.layers || []);
        }
      } catch (err) {
        if (isMounted) {
          setStockLayersError(err.message || "Failed to load stock sources.");
        }
      } finally {
        if (isMounted) {
          setStockLayersLoading(false);
        }
      }
    }

    fetchLayers();

    return () => {
      isMounted = false;
    };
  }, [viewingProduct?.id]);

  async function loadProductHistory(product) {
    const productId = `${product?.id ?? ""}`;

    if (!productId || productHistoryById[productId]) {
      return productHistoryById[productId] || null;
    }

    if (!onLoadProductHistory) {
      return null;
    }

    setProductHistoryLoadingId(productId);
    setProductHistoryError("");

    try {
      const history = await onLoadProductHistory(productId);
      const normalizedHistory = {
        purchases: Array.isArray(history?.purchases) ? history.purchases : [],
        sales: Array.isArray(history?.sales) ? history.sales : [],
        hasTransactionHistory: Boolean(history?.has_transaction_history),
      };

      setProductHistoryById((current) => ({
        ...current,
        [productId]: normalizedHistory,
      }));
      return normalizedHistory;
    } catch (requestError) {
      setProductHistoryError(requestError.message);
      return null;
    } finally {
      setProductHistoryLoadingId("");
    }
  }

  function openProductDetail(product) {
    const selectedPicture = getSelectedProductPicture(product);

    setViewingProduct(product);
    setViewingPictureId(selectedPicture?.id || "");
    setViewingTransaction(null);
    loadProductHistory(product);
  }

  function closeProductDetail() {
    setViewingProduct(null);
    setViewingTransaction(null);
    setViewingPictureId("");
  }

  function openTransactionDetail(type, data) {
    setViewingTransaction({ type, data });
  }

  function backToProduct() {
    setViewingTransaction(null);
  }

  const viewingHistory = viewingProduct ? productHistoryById[`${viewingProduct.id}`] : null;
  const viewPurchaseHistory = useMemo(
    () =>
      viewingProduct
        ? viewingHistory
          ? getProductPurchaseHistoryEntries(viewingProduct, viewingHistory.purchases)
          : getProductPurchaseHistoryEntries(viewingProduct, purchases)
        : [],
    [purchases, viewingHistory, viewingProduct]
  );
  const viewSalesHistory = useMemo(
    () =>
      viewingProduct
        ? viewingHistory
          ? getProductSalesHistoryEntries(viewingProduct, viewingHistory.sales)
          : getProductSalesHistoryEntries(viewingProduct, sales)
        : [],
    [sales, viewingHistory, viewingProduct]
  );
  const purchaseHistoryPagination = useMemo(
    () => createLocalPagination(viewPurchaseHistory.length, purchaseHistoryPage),
    [purchaseHistoryPage, viewPurchaseHistory.length]
  );
  const salesHistoryPagination = useMemo(
    () => createLocalPagination(viewSalesHistory.length, salesHistoryPage),
    [salesHistoryPage, viewSalesHistory.length]
  );
  const paginatedPurchaseHistory = useMemo(
    () => getPaginatedRows(viewPurchaseHistory, purchaseHistoryPagination),
    [purchaseHistoryPagination, viewPurchaseHistory]
  );
  const paginatedSalesHistory = useMemo(
    () => getPaginatedRows(viewSalesHistory, salesHistoryPagination),
    [salesHistoryPagination, viewSalesHistory]
  );
  const viewingProductMetrics = useMemo(
    () =>
      viewingProduct
        ? getProductMetrics(
            viewingProduct,
            viewingHistory?.purchases || purchases,
            viewingHistory?.sales || sales
          )
        : null,
    [purchases, sales, viewingHistory, viewingProduct]
  );

  return {
    viewingProduct,
    viewingTransaction,
    viewingPictureId,
    productHistoryById,
    productHistoryLoadingId,
    productHistoryError,
    purchaseHistoryPagination,
    salesHistoryPagination,
    paginatedPurchaseHistory,
    paginatedSalesHistory,
    viewingProductMetrics,
    loadProductHistory,
    openProductDetail,
    closeProductDetail,
    openTransactionDetail,
    backToProduct,
    setViewingPictureId,
    setPurchaseHistoryPage,
    setSalesHistoryPage,
    setViewingProduct,
    setViewingTransaction,
    setProductHistoryById,
    stockLayers,
    stockLayersLoading,
    stockLayersError,
  };
}

export default useProductDetailState;
