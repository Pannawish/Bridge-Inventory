// React hook for shared application hook state and actions.

import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import {
  createLocalPagination,
  getPaginatedRows,
  getProductPurchaseHistoryEntries,
  getProductSalesHistoryEntries,
} from "../components/products/productHistoryHelpers";
import {
  buildPartyOptions,
  computePriceInsights,
  filterHistoryEntries,
} from "../components/products/productPriceInsights";
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
  const [historySupplierFilter, setHistorySupplierFilter] = useState("");
  const [historyCustomerFilter, setHistoryCustomerFilter] = useState("");
  const [historyDateFrom, setHistoryDateFrom] = useState("");
  const [historyDateTo, setHistoryDateTo] = useState("");

  useEffect(() => {
    setPurchaseHistoryPage(1);
    setSalesHistoryPage(1);
    setHistorySupplierFilter("");
    setHistoryCustomerFilter("");
    setHistoryDateFrom("");
    setHistoryDateTo("");
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

    if (purchases.length || sales.length) {
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
  }, [purchases.length, sales.length, viewingProduct?.id]);

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
  const purchasePartyOptions = useMemo(
    () => buildPartyOptions(viewPurchaseHistory, "purchase"),
    [viewPurchaseHistory]
  );
  const salesPartyOptions = useMemo(
    () => buildPartyOptions(viewSalesHistory, "sale"),
    [viewSalesHistory]
  );

  const filteredPurchaseHistory = useMemo(
    () =>
      filterHistoryEntries(viewPurchaseHistory, "purchase", {
        party: historySupplierFilter,
        dateFrom: historyDateFrom,
        dateTo: historyDateTo,
      }),
    [historyDateFrom, historyDateTo, historySupplierFilter, viewPurchaseHistory]
  );
  const filteredSalesHistory = useMemo(
    () =>
      filterHistoryEntries(viewSalesHistory, "sale", {
        party: historyCustomerFilter,
        dateFrom: historyDateFrom,
        dateTo: historyDateTo,
      }),
    [historyCustomerFilter, historyDateFrom, historyDateTo, viewSalesHistory]
  );

  // Reset to the first page whenever the active scope changes.
  useEffect(() => {
    setPurchaseHistoryPage(1);
  }, [historySupplierFilter, historyDateFrom, historyDateTo]);
  useEffect(() => {
    setSalesHistoryPage(1);
  }, [historyCustomerFilter, historyDateFrom, historyDateTo]);

  const priceInsights = useMemo(
    () => computePriceInsights(filteredPurchaseHistory, filteredSalesHistory),
    [filteredPurchaseHistory, filteredSalesHistory]
  );
  const historyFilterActive = Boolean(
    historySupplierFilter || historyCustomerFilter || historyDateFrom || historyDateTo
  );

  const purchaseHistoryPagination = useMemo(
    () => createLocalPagination(filteredPurchaseHistory.length, purchaseHistoryPage),
    [purchaseHistoryPage, filteredPurchaseHistory.length]
  );
  const salesHistoryPagination = useMemo(
    () => createLocalPagination(filteredSalesHistory.length, salesHistoryPage),
    [salesHistoryPage, filteredSalesHistory.length]
  );
  const paginatedPurchaseHistory = useMemo(
    () => getPaginatedRows(filteredPurchaseHistory, purchaseHistoryPagination),
    [purchaseHistoryPagination, filteredPurchaseHistory]
  );
  const paginatedSalesHistory = useMemo(
    () => getPaginatedRows(filteredSalesHistory, salesHistoryPagination),
    [salesHistoryPagination, filteredSalesHistory]
  );

  function resetHistoryFilters() {
    setHistorySupplierFilter("");
    setHistoryCustomerFilter("");
    setHistoryDateFrom("");
    setHistoryDateTo("");
  }
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
    priceInsights,
    purchasePartyOptions,
    salesPartyOptions,
    historySupplierFilter,
    setHistorySupplierFilter,
    historyCustomerFilter,
    setHistoryCustomerFilter,
    historyDateFrom,
    setHistoryDateFrom,
    historyDateTo,
    setHistoryDateTo,
    historyFilterActive,
    resetHistoryFilters,
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
