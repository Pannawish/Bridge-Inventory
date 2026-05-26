import { getDefaultCustomers } from "../components/CustomerPage";
import { getDefaultSuppliers } from "../components/SupplierPage";
import { getDefaultProducts } from "../components/ProductsPage";
import { getDefaultCategories } from "../components/CategoryPage";
import {
  mockBillingNotes,
  mockDashboard,
  mockPaymentBatches,
  mockPurchases,
  mockSales,
} from "../mockData";
import {
  buildListParams,
  getCollectionPagination,
  getCollectionRows,
  mergeQuotationRowsWithMocks,
} from "../app/appUtils";

export function createPagedCollectionLoader({
  request,
  setRows,
  setPagination,
  setError,
  setCollection,
}) {
  return async function loadPage(params = {}) {
    try {
      const response = await request(buildListParams(params));
      const rows = getCollectionRows(response);
      if (setCollection) {
        setCollection(rows);
      }
      setRows(rows);
      setPagination(getCollectionPagination(response));
      return response;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  };
}

export function createEligibilityLoader({
  request,
  applyResponse,
}) {
  return async function loadEligibility() {
    const response = await request();
    applyResponse(response);
    return response;
  };
}

export function createEligibilityRefresher({
  loadEligibility,
  setError,
}) {
  return async function refreshEligibility() {
    try {
      await loadEligibility();
    } catch (requestError) {
      setError(requestError.message);
    }
  };
}

export function createInitialDataRequests(api) {
  return [
    api.getDashboard(),
    api.getSupplierLookups(),
    api.getCustomerLookups(),
    api.getCategories(),
    api.getProductLookups({ include_disabled: "true" }),
    api.getQuotations(),
    api.getEligibleBillingNoteSales(),
    api.getEligiblePaymentBatchPurchases(),
    api.getEligibleCreditNoteSales(),
    api.getSuppliers(buildListParams()),
    api.getCustomers(buildListParams()),
    api.getProducts(buildListParams()),
    api.getPurchases(buildListParams()),
    api.getSales(buildListParams()),
    api.getBillingNotes(buildListParams()),
    api.getPaymentBatches(buildListParams()),
    api.getCreditNotes(buildListParams()),
  ];
}

function applyLookupWithFallback({
  result,
  setAll,
  setRows,
  setPagination,
  setUsingMock,
  realFallbackRows,
  mockFallbackRows,
  failureKey,
  failures,
}) {
  if (result.status === "fulfilled") {
    const rows = getCollectionRows(result.value);
    setAll(rows);
    setUsingMock(false);
    if (realFallbackRows?.status === "fulfilled") {
      setRows(getCollectionRows(realFallbackRows.value));
      setPagination(getCollectionPagination(realFallbackRows.value));
    } else {
      setRows(rows);
      setPagination(null);
    }
    return;
  }

  const fallbackRows = typeof mockFallbackRows === "function" ? mockFallbackRows() : mockFallbackRows;
  setAll(fallbackRows);
  setRows(fallbackRows);
  setPagination(null);
  setUsingMock(true);
  failures.push(failureKey);
}

function applyPageCollectionWithFallback({
  result,
  setAll,
  setRows,
  setPagination,
  setUsingMock,
  mockRows,
  failureKey,
  failures,
}) {
  if (result.status === "fulfilled") {
    const rows = getCollectionRows(result.value);
    setAll(rows);
    setRows(rows);
    setPagination(getCollectionPagination(result.value));
    setUsingMock(false);
    return;
  }

  setAll(mockRows);
  setRows(mockRows);
  setPagination(null);
  setUsingMock(true);
  failures.push(failureKey);
}

export function applyInitialDataResults({
  results,
  setters,
}) {
  const [
    dashboardResult,
    supplierResult,
    customerResult,
    categoryResult,
    productResult,
    quotationResult,
    billingNoteEligibilityResult,
    paymentBatchEligibilityResult,
    creditNoteEligibilityResult,
    supplierPageResult,
    customerPageResult,
    productPageResult,
    purchasePageResult,
    salePageResult,
    billingNotePageResult,
    paymentBatchPageResult,
    creditNotePageResult,
  ] = results;
  const failures = [];

  if (dashboardResult.status === "fulfilled") {
    setters.setDashboard(dashboardResult.value);
  } else {
    setters.setDashboard(mockDashboard);
    failures.push("dashboard");
  }

  applyLookupWithFallback({
    result: supplierResult,
    setAll: setters.setSuppliers,
    setRows: setters.setSupplierRows,
    setPagination: setters.setSupplierPagination,
    setUsingMock: setters.setUsingMockSuppliers,
    realFallbackRows: supplierPageResult,
    mockFallbackRows: getDefaultSuppliers,
    failureKey: "suppliers",
    failures,
  });

  applyLookupWithFallback({
    result: customerResult,
    setAll: setters.setCustomers,
    setRows: setters.setCustomerRows,
    setPagination: setters.setCustomerPagination,
    setUsingMock: setters.setUsingMockCustomers,
    realFallbackRows: customerPageResult,
    mockFallbackRows: getDefaultCustomers,
    failureKey: "customers",
    failures,
  });

  if (categoryResult.status === "fulfilled") {
    setters.setCategories(getCollectionRows(categoryResult.value));
    setters.setUsingMockCategories(false);
  } else {
    setters.setCategories(getDefaultCategories());
    setters.setUsingMockCategories(true);
    failures.push("categories");
  }

  applyLookupWithFallback({
    result: productResult,
    setAll: setters.setProducts,
    setRows: setters.setProductRows,
    setPagination: setters.setProductPagination,
    setUsingMock: setters.setUsingMockProducts,
    realFallbackRows: productPageResult,
    mockFallbackRows: getDefaultProducts,
    failureKey: "products",
    failures,
  });

  applyPageCollectionWithFallback({
    result: purchasePageResult,
    setAll: setters.setPurchases,
    setRows: setters.setPurchaseRows,
    setPagination: setters.setPurchasePagination,
    setUsingMock: setters.setUsingMockPurchases,
    mockRows: mockPurchases,
    failureKey: "purchases",
    failures,
  });

  applyPageCollectionWithFallback({
    result: salePageResult,
    setAll: setters.setSales,
    setRows: setters.setSaleRows,
    setPagination: setters.setSalePagination,
    setUsingMock: setters.setUsingMockSales,
    mockRows: mockSales,
    failureKey: "sales",
    failures,
  });

  if (quotationResult.status === "fulfilled") {
    const quotationRows = getCollectionRows(quotationResult.value);
    setters.setQuotations(mergeQuotationRowsWithMocks(quotationRows, false));
    setters.setUsingMockQuotations(false);
  } else {
    setters.setQuotations(
      productResult.status === "fulfilled" ? [] : mergeQuotationRowsWithMocks([], true)
    );
    setters.setUsingMockQuotations(true);
    failures.push("quotations");
  }

  if (billingNoteEligibilityResult.status === "fulfilled") {
    setters.setBillingNoteEligibleSales(
      Array.isArray(billingNoteEligibilityResult.value?.sales)
        ? billingNoteEligibilityResult.value.sales
        : []
    );
    setters.setBillingNoteSummary(billingNoteEligibilityResult.value?.summary || null);
    setters.setBillingNoteNextReferenceNo(
      billingNoteEligibilityResult.value?.next_reference_no || ""
    );
  } else {
    setters.setBillingNoteEligibleSales(mockSales);
    setters.setBillingNoteSummary(null);
    setters.setBillingNoteNextReferenceNo("");
    failures.push("billing-note-eligibility");
  }

  applyPageCollectionWithFallback({
    result: billingNotePageResult,
    setAll: setters.setBillingNotes,
    setRows: setters.setBillingNoteRows,
    setPagination: setters.setBillingNotePagination,
    setUsingMock: setters.setUsingMockBillingNotes,
    mockRows: mockBillingNotes,
    failureKey: "billing-notes",
    failures,
  });

  if (paymentBatchEligibilityResult.status === "fulfilled") {
    setters.setPaymentBatchEligiblePurchases(
      Array.isArray(paymentBatchEligibilityResult.value?.purchases)
        ? paymentBatchEligibilityResult.value.purchases
        : []
    );
    setters.setPaymentBatchSummary(paymentBatchEligibilityResult.value?.summary || null);
    setters.setPaymentBatchNextReferenceNo(
      paymentBatchEligibilityResult.value?.next_reference_no || ""
    );
  } else {
    setters.setPaymentBatchEligiblePurchases(mockPurchases);
    setters.setPaymentBatchSummary(null);
    setters.setPaymentBatchNextReferenceNo("");
    failures.push("payment-batch-eligibility");
  }

  applyPageCollectionWithFallback({
    result: paymentBatchPageResult,
    setAll: setters.setPaymentBatches,
    setRows: setters.setPaymentBatchRows,
    setPagination: setters.setPaymentBatchPagination,
    setUsingMock: setters.setUsingMockPaymentBatches,
    mockRows: mockPaymentBatches,
    failureKey: "payment-batches",
    failures,
  });

  if (creditNoteEligibilityResult.status === "fulfilled") {
    setters.setCreditNoteEligibleSales(
      Array.isArray(creditNoteEligibilityResult.value?.sales)
        ? creditNoteEligibilityResult.value.sales
        : []
    );
    setters.setCreditNoteNextReferenceNo(
      creditNoteEligibilityResult.value?.next_reference_no || ""
    );
  } else {
    setters.setCreditNoteEligibleSales([]);
    setters.setCreditNoteNextReferenceNo("");
    failures.push("credit-note-eligibility");
  }

  if (creditNotePageResult.status === "fulfilled") {
    const rows = getCollectionRows(creditNotePageResult.value);
    setters.setCreditNotes(rows);
    setters.setCreditNoteRows(rows);
    setters.setCreditNotePagination(getCollectionPagination(creditNotePageResult.value));
    setters.setUsingMockCreditNotes(false);
  } else {
    setters.setCreditNotes([]);
    setters.setCreditNoteRows([]);
    setters.setCreditNotePagination(null);
    setters.setUsingMockCreditNotes(true);
    failures.push("credit-notes");
  }

  return failures;
}
