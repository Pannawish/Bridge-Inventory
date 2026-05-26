import { useCallback, useMemo, useState } from "react";
import { api } from "../api";
import {
  createEligibilityLoader,
  createEligibilityRefresher,
  createInitialDataRequests,
  createPagedCollectionLoader,
  applyInitialDataResults,
} from "./inventoryDataHelpers";
import { buildInventoryDataSetters } from "./inventoryDataSetters";

export function useInventoryData() {
  const [dashboard, setDashboard] = useState(null);
  const [products, setProducts] = useState([]);
  const [productRows, setProductRows] = useState([]);
  const [productPagination, setProductPagination] = useState(null);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [supplierRows, setSupplierRows] = useState([]);
  const [supplierPagination, setSupplierPagination] = useState(null);
  const [usingMockSuppliers, setUsingMockSuppliers] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [customerRows, setCustomerRows] = useState([]);
  const [customerPagination, setCustomerPagination] = useState(null);
  const [usingMockCustomers, setUsingMockCustomers] = useState(false);
  const [purchases, setPurchases] = useState([]);
  const [purchaseRows, setPurchaseRows] = useState([]);
  const [purchasePagination, setPurchasePagination] = useState(null);
  const [usingMockPurchases, setUsingMockPurchases] = useState(false);
  const [sales, setSales] = useState([]);
  const [saleRows, setSaleRows] = useState([]);
  const [salePagination, setSalePagination] = useState(null);
  const [usingMockSales, setUsingMockSales] = useState(false);
  const [quotations, setQuotations] = useState([]);
  const [usingMockQuotations, setUsingMockQuotations] = useState(false);
  const [usingMockCategories, setUsingMockCategories] = useState(false);
  const [usingMockProducts, setUsingMockProducts] = useState(false);
  const [billingNotes, setBillingNotes] = useState([]);
  const [billingNoteRows, setBillingNoteRows] = useState([]);
  const [billingNotePagination, setBillingNotePagination] = useState(null);
  const [billingNoteEligibleSales, setBillingNoteEligibleSales] = useState([]);
  const [billingNoteSummary, setBillingNoteSummary] = useState(null);
  const [billingNoteNextReferenceNo, setBillingNoteNextReferenceNo] = useState("");
  const [usingMockBillingNotes, setUsingMockBillingNotes] = useState(false);
  const [paymentBatches, setPaymentBatches] = useState([]);
  const [paymentBatchRows, setPaymentBatchRows] = useState([]);
  const [paymentBatchPagination, setPaymentBatchPagination] = useState(null);
  const [paymentBatchEligiblePurchases, setPaymentBatchEligiblePurchases] = useState([]);
  const [paymentBatchSummary, setPaymentBatchSummary] = useState(null);
  const [paymentBatchNextReferenceNo, setPaymentBatchNextReferenceNo] = useState("");
  const [usingMockPaymentBatches, setUsingMockPaymentBatches] = useState(false);
  const [creditNotes, setCreditNotes] = useState([]);
  const [creditNoteRows, setCreditNoteRows] = useState([]);
  const [creditNotePagination, setCreditNotePagination] = useState(null);
  const [creditNoteEligibleSales, setCreditNoteEligibleSales] = useState([]);
  const [creditNoteNextReferenceNo, setCreditNoteNextReferenceNo] = useState("");
  const [usingMockCreditNotes, setUsingMockCreditNotes] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const inventoryDataSetters = useMemo(
    () =>
      buildInventoryDataSetters({
        setDashboard,
        setProducts,
        setProductRows,
        setProductPagination,
        setCategories,
        setSuppliers,
        setSupplierRows,
        setSupplierPagination,
        setUsingMockSuppliers,
        setCustomers,
        setCustomerRows,
        setCustomerPagination,
        setUsingMockCustomers,
        setPurchases,
        setPurchaseRows,
        setPurchasePagination,
        setUsingMockPurchases,
        setSales,
        setSaleRows,
        setSalePagination,
        setUsingMockSales,
        setQuotations,
        setUsingMockQuotations,
        setUsingMockCategories,
        setUsingMockProducts,
        setBillingNotes,
        setBillingNoteRows,
        setBillingNotePagination,
        setBillingNoteEligibleSales,
        setBillingNoteSummary,
        setBillingNoteNextReferenceNo,
        setUsingMockBillingNotes,
        setPaymentBatches,
        setPaymentBatchRows,
        setPaymentBatchPagination,
        setPaymentBatchEligiblePurchases,
        setPaymentBatchSummary,
        setPaymentBatchNextReferenceNo,
        setUsingMockPaymentBatches,
        setCreditNotes,
        setCreditNoteRows,
        setCreditNotePagination,
        setCreditNoteEligibleSales,
        setCreditNoteNextReferenceNo,
        setUsingMockCreditNotes,
      }),
    []
  );

  const loadSupplierPage = useCallback(
    createPagedCollectionLoader({
      request: api.getSuppliers,
      setRows: setSupplierRows,
      setPagination: setSupplierPagination,
      setError,
    }),
    []
  );

  const loadCustomerPage = useCallback(
    createPagedCollectionLoader({
      request: api.getCustomers,
      setRows: setCustomerRows,
      setPagination: setCustomerPagination,
      setError,
    }),
    []
  );

  const loadProductPage = useCallback(
    createPagedCollectionLoader({
      request: api.getProducts,
      setRows: setProductRows,
      setPagination: setProductPagination,
      setError,
    }),
    []
  );

  const reloadDashboard = useCallback(async (period = "month") => {
    try {
      const response = await api.getDashboard({ period });
      setDashboard(response);
      return response;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }, []);

  const loadPurchasePage = useCallback(
    createPagedCollectionLoader({
      request: api.getPurchases,
      setRows: setPurchaseRows,
      setPagination: setPurchasePagination,
      setError,
    }),
    []
  );

  const loadSalePage = useCallback(
    createPagedCollectionLoader({
      request: api.getSales,
      setRows: setSaleRows,
      setPagination: setSalePagination,
      setError,
    }),
    []
  );

  const loadBillingNotePage = useCallback(
    createPagedCollectionLoader({
      request: api.getBillingNotes,
      setCollection: setBillingNotes,
      setRows: setBillingNoteRows,
      setPagination: setBillingNotePagination,
      setError,
    }),
    []
  );

  const loadPaymentBatchPage = useCallback(
    createPagedCollectionLoader({
      request: api.getPaymentBatches,
      setCollection: setPaymentBatches,
      setRows: setPaymentBatchRows,
      setPagination: setPaymentBatchPagination,
      setError,
    }),
    []
  );

  const loadBillingNoteEligibility = useCallback(
    createEligibilityLoader({
      request: api.getEligibleBillingNoteSales,
      applyResponse: (response) => {
        setBillingNoteEligibleSales(Array.isArray(response?.sales) ? response.sales : []);
        setBillingNoteSummary(response?.summary || null);
        setBillingNoteNextReferenceNo(response?.next_reference_no || "");
      },
    }),
    []
  );

  const loadPaymentBatchEligibility = useCallback(
    createEligibilityLoader({
      request: api.getEligiblePaymentBatchPurchases,
      applyResponse: (response) => {
        setPaymentBatchEligiblePurchases(
          Array.isArray(response?.purchases) ? response.purchases : []
        );
        setPaymentBatchSummary(response?.summary || null);
        setPaymentBatchNextReferenceNo(response?.next_reference_no || "");
      },
    }),
    []
  );

  const loadCreditNotePage = useCallback(
    createPagedCollectionLoader({
      request: api.getCreditNotes,
      setCollection: setCreditNotes,
      setRows: setCreditNoteRows,
      setPagination: setCreditNotePagination,
      setError,
    }),
    []
  );

  const loadCreditNoteEligibility = useCallback(
    createEligibilityLoader({
      request: api.getEligibleCreditNoteSales,
      applyResponse: (response) => {
        setCreditNoteEligibleSales(Array.isArray(response?.sales) ? response.sales : []);
        setCreditNoteNextReferenceNo(response?.next_reference_no || "");
      },
    }),
    []
  );

  const refreshBillingNoteEligibility = useCallback(
    createEligibilityRefresher({
      loadEligibility: loadBillingNoteEligibility,
      setError,
    }),
    [loadBillingNoteEligibility]
  );

  const refreshPaymentBatchEligibility = useCallback(
    createEligibilityRefresher({
      loadEligibility: loadPaymentBatchEligibility,
      setError,
    }),
    [loadPaymentBatchEligibility]
  );

  const refreshCreditNoteEligibility = useCallback(
    createEligibilityRefresher({
      loadEligibility: loadCreditNoteEligibility,
      setError,
    }),
    [loadCreditNoteEligibility]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    const results = await Promise.allSettled(createInitialDataRequests(api));
    const failures = applyInitialDataResults({
      results,
      setters: inventoryDataSetters,
    });

    if (failures.length) {
      setError(
        failures.includes("dashboard")
          ? "Backend not connected. Showing mock dashboard data."
          : "Some backend data is unavailable."
      );
    }

    setLoading(false);
  }, [inventoryDataSetters]);

  return {
    dashboard,
    products,
    setProducts,
    productRows,
    setProductRows,
    productPagination,
    categories,
    setCategories,
    suppliers,
    setSuppliers,
    supplierRows,
    setSupplierRows,
    supplierPagination,
    usingMockSuppliers,
    customers,
    setCustomers,
    customerRows,
    setCustomerRows,
    customerPagination,
    usingMockCustomers,
    purchases,
    setPurchases,
    purchaseRows,
    setPurchaseRows,
    purchasePagination,
    usingMockPurchases,
    sales,
    setSales,
    saleRows,
    setSaleRows,
    salePagination,
    usingMockSales,
    quotations,
    setQuotations,
    usingMockQuotations,
    usingMockCategories,
    usingMockProducts,
    billingNotes,
    setBillingNotes,
    billingNoteRows,
    setBillingNoteRows,
    billingNotePagination,
    billingNoteEligibleSales,
    billingNoteSummary,
    billingNoteNextReferenceNo,
    usingMockBillingNotes,
    paymentBatches,
    setPaymentBatches,
    paymentBatchRows,
    setPaymentBatchRows,
    paymentBatchPagination,
    paymentBatchEligiblePurchases,
    paymentBatchSummary,
    paymentBatchNextReferenceNo,
    usingMockPaymentBatches,
    creditNotes,
    setCreditNotes,
    creditNoteRows,
    setCreditNoteRows,
    creditNotePagination,
    creditNoteEligibleSales,
    creditNoteNextReferenceNo,
    usingMockCreditNotes,
    loading,
    error,
    setError,
    loadData,
    reloadDashboard,
    loadSupplierPage,
    loadCustomerPage,
    loadProductPage,
    loadPurchasePage,
    loadSalePage,
    loadBillingNotePage,
    loadPaymentBatchPage,
    loadCreditNotePage,
    refreshBillingNoteEligibility,
    refreshPaymentBatchEligibility,
    refreshCreditNoteEligibility,
  };
}
