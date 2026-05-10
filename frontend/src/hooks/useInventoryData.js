import { useCallback, useState } from "react";
import { api } from "../api";
import { getDefaultCustomers } from "../components/CustomerPage";
import { getDefaultSuppliers } from "../components/SupplierPage";
import { getDefaultProducts } from "../components/ProductsPage";
import { getDefaultCategories } from "../components/CategoryPage";
import {
  mockBillingNotes,
  mockDashboard,
  mockPaymentBatches,
  mockPurchases,
  mockQuotations,
  mockSales,
} from "../mockData";
import {
  buildListParams,
  getCollectionPagination,
  getCollectionRows,
  mergeQuotationRowsWithMocks,
} from "../app/appUtils";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadSupplierPage = useCallback(async (params = {}) => {
    try {
      const response = await api.getSuppliers(buildListParams(params));
      setSupplierRows(getCollectionRows(response));
      setSupplierPagination(getCollectionPagination(response));
      return response;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }, []);

  const loadCustomerPage = useCallback(async (params = {}) => {
    try {
      const response = await api.getCustomers(buildListParams(params));
      setCustomerRows(getCollectionRows(response));
      setCustomerPagination(getCollectionPagination(response));
      return response;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }, []);

  const loadProductPage = useCallback(async (params = {}) => {
    try {
      const response = await api.getProducts(buildListParams(params));
      setProductRows(getCollectionRows(response));
      setProductPagination(getCollectionPagination(response));
      return response;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }, []);

  const loadPurchasePage = useCallback(async (params = {}) => {
    try {
      const response = await api.getPurchases(buildListParams(params));
      setPurchaseRows(getCollectionRows(response));
      setPurchasePagination(getCollectionPagination(response));
      return response;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }, []);

  const loadSalePage = useCallback(async (params = {}) => {
    try {
      const response = await api.getSales(buildListParams(params));
      setSaleRows(getCollectionRows(response));
      setSalePagination(getCollectionPagination(response));
      return response;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }, []);

  const loadBillingNotePage = useCallback(async (params = {}) => {
    try {
      const response = await api.getBillingNotes(buildListParams(params));
      const rows = getCollectionRows(response);
      setBillingNotes(rows);
      setBillingNoteRows(rows);
      setBillingNotePagination(getCollectionPagination(response));
      return response;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }, []);

  const loadPaymentBatchPage = useCallback(async (params = {}) => {
    try {
      const response = await api.getPaymentBatches(buildListParams(params));
      const rows = getCollectionRows(response);
      setPaymentBatches(rows);
      setPaymentBatchRows(rows);
      setPaymentBatchPagination(getCollectionPagination(response));
      return response;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }, []);

  const loadBillingNoteEligibility = useCallback(async () => {
    const response = await api.getEligibleBillingNoteSales();
    setBillingNoteEligibleSales(Array.isArray(response?.sales) ? response.sales : []);
    setBillingNoteSummary(response?.summary || null);
    setBillingNoteNextReferenceNo(response?.next_reference_no || "");
    return response;
  }, []);

  const loadPaymentBatchEligibility = useCallback(async () => {
    const response = await api.getEligiblePaymentBatchPurchases();
    setPaymentBatchEligiblePurchases(
      Array.isArray(response?.purchases) ? response.purchases : []
    );
    setPaymentBatchSummary(response?.summary || null);
    setPaymentBatchNextReferenceNo(response?.next_reference_no || "");
    return response;
  }, []);

  const refreshBillingNoteEligibility = useCallback(async () => {
    try {
      await loadBillingNoteEligibility();
    } catch (requestError) {
      setError(requestError.message);
    }
  }, [loadBillingNoteEligibility]);

  const refreshPaymentBatchEligibility = useCallback(async () => {
    try {
      await loadPaymentBatchEligibility();
    } catch (requestError) {
      setError(requestError.message);
    }
  }, [loadPaymentBatchEligibility]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    const results = await Promise.allSettled([
      api.getDashboard(),
      api.getSupplierLookups(),
      api.getCustomerLookups(),
      api.getCategories(),
      api.getProductLookups(),
      api.getQuotations(),
      api.getEligibleBillingNoteSales(),
      api.getEligiblePaymentBatchPurchases(),
      api.getSuppliers(buildListParams()),
      api.getCustomers(buildListParams()),
      api.getProducts(buildListParams()),
      api.getPurchases(buildListParams()),
      api.getSales(buildListParams()),
      api.getBillingNotes(buildListParams()),
      api.getPaymentBatches(buildListParams()),
    ]);

    const [
      dashboardResult,
      supplierResult,
      customerResult,
      categoryResult,
      productResult,
      quotationResult,
      billingNoteEligibilityResult,
      paymentBatchEligibilityResult,
      supplierPageResult,
      customerPageResult,
      productPageResult,
      purchasePageResult,
      salePageResult,
      billingNotePageResult,
      paymentBatchPageResult,
    ] = results;
    const failures = [];

    if (dashboardResult.status === "fulfilled") {
      setDashboard(dashboardResult.value);
    } else {
      setDashboard(mockDashboard);
      failures.push("dashboard");
    }

    if (supplierResult.status === "fulfilled") {
      const supplierRowsAll = getCollectionRows(supplierResult.value);
      setSuppliers(supplierRowsAll);
      setUsingMockSuppliers(false);
      if (supplierPageResult.status === "fulfilled") {
        setSupplierRows(getCollectionRows(supplierPageResult.value));
        setSupplierPagination(getCollectionPagination(supplierPageResult.value));
      } else {
        setSupplierRows(supplierRowsAll);
        setSupplierPagination(null);
      }
    } else {
      setSuppliers(getDefaultSuppliers());
      setSupplierRows(getDefaultSuppliers());
      setSupplierPagination(null);
      setUsingMockSuppliers(true);
      failures.push("suppliers");
    }

    if (customerResult.status === "fulfilled") {
      const customerRowsAll = getCollectionRows(customerResult.value);
      setCustomers(customerRowsAll);
      setUsingMockCustomers(false);
      if (customerPageResult.status === "fulfilled") {
        setCustomerRows(getCollectionRows(customerPageResult.value));
        setCustomerPagination(getCollectionPagination(customerPageResult.value));
      } else {
        setCustomerRows(customerRowsAll);
        setCustomerPagination(null);
      }
    } else {
      setCustomers(getDefaultCustomers());
      setCustomerRows(getDefaultCustomers());
      setCustomerPagination(null);
      setUsingMockCustomers(true);
      failures.push("customers");
    }

    if (categoryResult.status === "fulfilled") {
      setCategories(getCollectionRows(categoryResult.value));
      setUsingMockCategories(false);
    } else {
      setCategories(getDefaultCategories());
      setUsingMockCategories(true);
      failures.push("categories");
    }

    if (productResult.status === "fulfilled") {
      const productRowsAll = getCollectionRows(productResult.value);
      setProducts(productRowsAll);
      setUsingMockProducts(false);
      if (productPageResult.status === "fulfilled") {
        setProductRows(getCollectionRows(productPageResult.value));
        setProductPagination(getCollectionPagination(productPageResult.value));
      } else {
        setProductRows(productRowsAll);
        setProductPagination(null);
      }
    } else {
      setProducts(getDefaultProducts());
      setProductRows(getDefaultProducts());
      setProductPagination(null);
      setUsingMockProducts(true);
      failures.push("products");
    }

    if (purchasePageResult.status === "fulfilled") {
      const purchaseRowsAll = getCollectionRows(purchasePageResult.value);
      setPurchases(purchaseRowsAll);
      setPurchaseRows(purchaseRowsAll);
      setPurchasePagination(getCollectionPagination(purchasePageResult.value));
      setUsingMockPurchases(false);
    } else {
      setPurchases(mockPurchases);
      setPurchaseRows(mockPurchases);
      setPurchasePagination(null);
      setUsingMockPurchases(true);
      failures.push("purchases");
    }

    if (salePageResult.status === "fulfilled") {
      const saleRowsAll = getCollectionRows(salePageResult.value);
      setSales(saleRowsAll);
      setSaleRows(saleRowsAll);
      setSalePagination(getCollectionPagination(salePageResult.value));
      setUsingMockSales(false);
    } else {
      setSales(mockSales);
      setSaleRows(mockSales);
      setSalePagination(null);
      setUsingMockSales(true);
      failures.push("sales");
    }

    if (quotationResult.status === "fulfilled") {
      const quotationRows = getCollectionRows(quotationResult.value);
      setQuotations(mergeQuotationRowsWithMocks(quotationRows));
      setUsingMockQuotations(false);
    } else {
      setQuotations(mockQuotations);
      setUsingMockQuotations(true);
      failures.push("quotations");
    }

    if (billingNoteEligibilityResult.status === "fulfilled") {
      setBillingNoteEligibleSales(
        Array.isArray(billingNoteEligibilityResult.value?.sales)
          ? billingNoteEligibilityResult.value.sales
          : []
      );
      setBillingNoteSummary(billingNoteEligibilityResult.value?.summary || null);
      setBillingNoteNextReferenceNo(
        billingNoteEligibilityResult.value?.next_reference_no || ""
      );
    } else {
      setBillingNoteEligibleSales(mockSales);
      setBillingNoteSummary(null);
      setBillingNoteNextReferenceNo("");
      failures.push("billing-note-eligibility");
    }

    if (billingNotePageResult.status === "fulfilled") {
      const billingNoteRowsAll = getCollectionRows(billingNotePageResult.value);
      setBillingNotes(billingNoteRowsAll);
      setBillingNoteRows(billingNoteRowsAll);
      setBillingNotePagination(getCollectionPagination(billingNotePageResult.value));
      setUsingMockBillingNotes(false);
    } else {
      setBillingNotes(mockBillingNotes);
      setBillingNoteRows(mockBillingNotes);
      setBillingNotePagination(null);
      setUsingMockBillingNotes(true);
      failures.push("billing-notes");
    }

    if (paymentBatchEligibilityResult.status === "fulfilled") {
      setPaymentBatchEligiblePurchases(
        Array.isArray(paymentBatchEligibilityResult.value?.purchases)
          ? paymentBatchEligibilityResult.value.purchases
          : []
      );
      setPaymentBatchSummary(paymentBatchEligibilityResult.value?.summary || null);
      setPaymentBatchNextReferenceNo(
        paymentBatchEligibilityResult.value?.next_reference_no || ""
      );
    } else {
      setPaymentBatchEligiblePurchases(mockPurchases);
      setPaymentBatchSummary(null);
      setPaymentBatchNextReferenceNo("");
      failures.push("payment-batch-eligibility");
    }

    if (paymentBatchPageResult.status === "fulfilled") {
      const paymentBatchRowsAll = getCollectionRows(paymentBatchPageResult.value);
      setPaymentBatches(paymentBatchRowsAll);
      setPaymentBatchRows(paymentBatchRowsAll);
      setPaymentBatchPagination(getCollectionPagination(paymentBatchPageResult.value));
      setUsingMockPaymentBatches(false);
    } else {
      setPaymentBatches(mockPaymentBatches);
      setPaymentBatchRows(mockPaymentBatches);
      setPaymentBatchPagination(null);
      setUsingMockPaymentBatches(true);
      failures.push("payment-batches");
    }

    if (failures.length) {
      setError(
        failures.includes("dashboard")
          ? "Backend not connected. Showing mock dashboard data."
          : "Some backend data is unavailable."
      );
    }

    setLoading(false);
  }, []);

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
    loading,
    error,
    setError,
    loadData,
    loadSupplierPage,
    loadCustomerPage,
    loadProductPage,
    loadPurchasePage,
    loadSalePage,
    loadBillingNotePage,
    loadPaymentBatchPage,
    refreshBillingNoteEligibility,
    refreshPaymentBatchEligibility,
  };
}
