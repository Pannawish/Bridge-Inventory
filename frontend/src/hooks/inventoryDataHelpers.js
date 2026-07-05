import { getDefaultCustomers } from "../components/CustomerPage";
import { getDefaultSuppliers } from "../components/SupplierPage";
import { getDefaultProducts } from "../components/ProductsPage";
import { getDefaultCategories } from "../components/CategoryPage";
import { withinRange } from "../components/FilterControls";
import { filterCustomersHelper } from "../components/customers/customerPageHelpers";
import { filterSuppliersHelper } from "../components/suppliers/supplierPageHelpers";
import {
  getProductAllNames,
  getProductCategoryLabel,
  getProductMetrics,
  getProductPreviousSkus,
} from "../components/products/productUtils";
import {
  purchaseMatchesQuery,
  transactionMatchesDateRange as purchaseTransactionMatchesDateRange,
} from "../components/purchases/purchaseHistoryUtils";
import {
  saleMatchesQuery,
  transactionMatchesDateRange as saleTransactionMatchesDateRange,
} from "../components/sales/salesHistoryUtils";
import {
  billingNoteInDateRange,
  billingNoteMatchesQuery,
} from "../components/billing/billingNoteUtils";
import {
  paymentBatchInDateRange,
  paymentBatchMatchesQuery,
} from "../components/payments/paymentBatchUtils";
import {
  creditNoteInDateRange,
  creditNoteMatchesQuery,
} from "../components/credits/creditNoteUtils";
import { getSaleStockIssues } from "../saleStock";
import {
  mockBillingNotes,
  mockBillingNoteNextReferenceNo,
  mockBillingNoteSummary,
  mockDashboard,
  mockCreditNoteNextReferenceNo,
  mockCreditNotes,
  mockEligibleBillingNoteSales,
  mockEligibleCreditNoteSales,
  mockEligiblePaymentBatchPurchases,
  mockPaymentBatchNextReferenceNo,
  mockPaymentBatches,
  mockPaymentBatchSummary,
  mockPurchases,
  mockSales,
} from "../mockData";
import {
  buildListParams,
  getCollectionPagination,
  getCollectionRows,
  mergeQuotationRowsWithMocks,
  PAGE_SIZE,
} from "../app/appUtils";

export function createPagedCollectionLoader({
  request,
  setRows,
  setPagination,
  setError,
  setCollection,
  isUsingMock,
  getMockRows,
  resolveLocalRows,
}) {
  return async function loadPage(params = {}) {
    const requestParams = buildListParams(params);

    if (isUsingMock?.()) {
      return applyLocalPagedCollection({
        params: requestParams,
        setRows,
        setPagination,
        setCollection,
        getMockRows,
        resolveLocalRows,
      });
    }

    try {
      const response = await request(requestParams);
      const rows = getCollectionRows(response);
      if (setCollection) {
        setCollection(rows);
      }
      setRows(rows);
      setPagination(getCollectionPagination(response));
      return response;
    } catch (requestError) {
      if (getMockRows) {
        setError(requestError.message);
        return applyLocalPagedCollection({
          params: requestParams,
          setRows,
          setPagination,
          setCollection,
          getMockRows,
          resolveLocalRows,
        });
      }

      setError(requestError.message);
      return false;
    }
  };
}

function normalizeSearch(value) {
  return `${value ?? ""}`.trim().toLowerCase();
}

function passthroughT(value) {
  return value;
}

function parseStatusValues(value) {
  const rows = `${value ?? ""}`
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (!rows.length) {
    return null;
  }

  if (rows.includes("__none__")) {
    return [];
  }

  return rows;
}

function buildLocalPagedResponse(rows = [], params = {}) {
  const count = rows.length;
  const pageSize = Math.max(1, Number(params.page_size || PAGE_SIZE) || PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  const page = Math.min(Math.max(1, Number(params.page || 1) || 1), totalPages);
  const start = (page - 1) * pageSize;

  return {
    count,
    next: null,
    previous: null,
    page,
    page_size: pageSize,
    total_pages: totalPages,
    results: rows.slice(start, start + pageSize),
  };
}

function applyLocalPagedCollection({
  params,
  setRows,
  setPagination,
  setCollection,
  getMockRows,
  resolveLocalRows,
}) {
  const allRows = typeof getMockRows === "function" ? getMockRows() : [];
  const filteredRows = resolveLocalRows ? resolveLocalRows(allRows, params) : allRows;
  const response = buildLocalPagedResponse(filteredRows, params);

  if (setCollection) {
    setCollection(allRows);
  }

  setRows(getCollectionRows(response));
  setPagination(getCollectionPagination(response));
  return response;
}

function buildInitialLocalPagination(rows) {
  return buildLocalPagedResponse(rows, { page: 1, page_size: PAGE_SIZE });
}

export function filterLocalSuppliers(rows, params) {
  return filterSuppliersHelper({
    suppliers: rows,
    normalizedSearch: normalizeSearch(params.search),
    profileFilter: params.profile_filter || "all",
    isServerPaginated: false,
  });
}

export function filterLocalCustomers(rows, params) {
  return filterCustomersHelper({
    customers: rows,
    normalizedSearch: normalizeSearch(params.search),
    profileFilter: params.profile_filter || "all",
    isServerPaginated: false,
  });
}

export function filterLocalProducts(rows, params, context = {}) {
  const normalizedSearch = normalizeSearch(params.search);
  const categoryFilter = params.category || "all";
  const stockFilter = params.stock_filter || "all";
  const categories = context.categories || [];
  const purchases = context.purchases || [];
  const sales = context.sales || [];

  return rows.filter((product) => {
    const metrics = getProductMetrics(product, purchases, sales);
    const categoryLabel = getProductCategoryLabel(product, categories);
    const matchesSearch =
      !normalizedSearch ||
      getProductAllNames(product).some((name) =>
        `${name}`.toLowerCase().includes(normalizedSearch)
      ) ||
      `${categoryLabel}`.toLowerCase().includes(normalizedSearch) ||
      `${product.sku ?? ""}`.toLowerCase().includes(normalizedSearch) ||
      getProductPreviousSkus(product).some((sku) =>
        `${sku}`.toLowerCase().includes(normalizedSearch)
      ) ||
      `${product.productDisplayId ?? ""}`.includes(normalizedSearch);

    if (!matchesSearch) {
      return false;
    }

    if (categoryFilter !== "all" && categoryLabel !== categoryFilter) {
      return false;
    }

    if (stockFilter === "in-stock") {
      return metrics.totalUnits > 0;
    }
    if (stockFilter === "out-of-stock") {
      return metrics.totalUnits <= 0;
    }
    if (stockFilter === "low-stock") {
      const reorderLevel = Number(product.reorderLevel ?? product.reorder_level ?? 0) || 0;
      return metrics.totalUnits > 0 && reorderLevel > 0 && metrics.totalUnits <= reorderLevel;
    }
    if (stockFilter === "selling") {
      return metrics.activeSalesCount > 0;
    }
    if (stockFilter === "no-sales") {
      return metrics.activeSalesCount === 0;
    }
    if (stockFilter === "no-purchases") {
      return metrics.receivedPurchaseCount === 0;
    }

    return true;
  });
}

export function filterLocalPurchases(rows, params) {
  const normalizedSearch = normalizeSearch(params.search);
  const statusValues = parseStatusValues(params.status);
  const supplier = `${params.supplier || ""}`.trim();
  const product = `${params.product || ""}`.trim();
  const dateFrom = params.date_from || "";
  const dateTo = params.date_to || "";
  const amountMin = params.amount_min || "";
  const amountMax = params.amount_max || "";
  const vatMode = params.vat_mode || "";

  return rows.filter((purchase) => {
    if (normalizedSearch && !purchaseMatchesQuery(purchase, normalizedSearch)) {
      return false;
    }
    if (statusValues && !statusValues.includes(purchase.status)) {
      return false;
    }
    if (supplier && purchase.supplier_name !== supplier) {
      return false;
    }
    if (
      product &&
      !(purchase.items || []).some(
        (item) => `${item.product ?? item.product_id ?? ""}` === product
      )
    ) {
      return false;
    }
    if (!purchaseTransactionMatchesDateRange(purchase.transaction_date, dateFrom, dateTo)) {
      return false;
    }
    if (!withinRange(purchase.grand_total, amountMin, amountMax)) {
      return false;
    }
    if (vatMode && purchase.vat_mode !== vatMode) {
      return false;
    }
    return true;
  });
}

export function filterLocalSales(rows, params, context = {}) {
  const normalizedSearch = normalizeSearch(params.search);
  const statusValues = parseStatusValues(params.status);
  const customer = `${params.customer || ""}`.trim();
  const product = `${params.product || ""}`.trim();
  const dateFrom = params.date_from || "";
  const dateTo = params.date_to || "";
  const amountMin = params.amount_min || "";
  const amountMax = params.amount_max || "";
  const vatMode = params.vat_mode || "";
  const stockFilter = params.stock_filter || "";
  const products = context.products || [];
  const purchases = context.purchases || [];

  return rows.filter((sale) => {
    if (normalizedSearch && !saleMatchesQuery(sale, normalizedSearch)) {
      return false;
    }
    if (statusValues && !statusValues.includes(sale.status)) {
      return false;
    }
    if (customer && sale.customer_name !== customer) {
      return false;
    }
    if (
      product &&
      !(sale.items || []).some(
        (item) => `${item.product ?? item.product_id ?? ""}` === product
      )
    ) {
      return false;
    }
    if (!saleTransactionMatchesDateRange(sale.transaction_date, dateFrom, dateTo)) {
      return false;
    }
    if (!withinRange(sale.grand_total, amountMin, amountMax)) {
      return false;
    }
    if (vatMode && sale.vat_mode !== vatMode) {
      return false;
    }
    if (
      stockFilter === "insufficient_stock" &&
      getSaleStockIssues(sale, products, purchases, rows, {
        excludeSaleId: sale.id,
        currentSale: sale,
      }).length === 0
    ) {
      return false;
    }

    return true;
  });
}

export function filterLocalBillingNotes(rows, params) {
  const normalizedSearch = normalizeSearch(params.search);
  const status = params.status || "all";
  const customer = `${params.customer || ""}`.trim();
  const dateFrom = params.date_from || "";
  const dateTo = params.date_to || "";
  const amountMin = params.amount_min || "";
  const amountMax = params.amount_max || "";

  return rows.filter((note) => {
    if (normalizedSearch && !billingNoteMatchesQuery(note, normalizedSearch, passthroughT)) {
      return false;
    }
    if (status !== "all" && status && note.status !== status) {
      return false;
    }
    if (customer && note.customer_name !== customer) {
      return false;
    }
    if (!billingNoteInDateRange(note, dateFrom, dateTo)) {
      return false;
    }
    if (!withinRange(note.total_amount, amountMin, amountMax)) {
      return false;
    }
    return true;
  });
}

export function filterLocalPaymentBatches(rows, params) {
  const normalizedSearch = normalizeSearch(params.search);
  const status = params.status || "all";
  const supplier = `${params.supplier || ""}`.trim();
  const dateFrom = params.date_from || "";
  const dateTo = params.date_to || "";
  const amountMin = params.amount_min || "";
  const amountMax = params.amount_max || "";

  return rows.filter((batch) => {
    if (normalizedSearch && !paymentBatchMatchesQuery(batch, normalizedSearch, passthroughT)) {
      return false;
    }
    if (status !== "all" && status && batch.status !== status) {
      return false;
    }
    if (supplier && batch.supplier_name !== supplier) {
      return false;
    }
    if (!paymentBatchInDateRange(batch, dateFrom, dateTo)) {
      return false;
    }
    if (!withinRange(batch.total_amount, amountMin, amountMax)) {
      return false;
    }
    return true;
  });
}

export function filterLocalCreditNotes(rows, params) {
  const normalizedSearch = normalizeSearch(params.search);
  const status = params.status || "all";
  const customer = `${params.customer || ""}`.trim();
  const dateFrom = params.date_from || "";
  const dateTo = params.date_to || "";
  const amountMin = params.amount_min || "";
  const amountMax = params.amount_max || "";

  return rows.filter((note) => {
    if (normalizedSearch && !creditNoteMatchesQuery(note, normalizedSearch, passthroughT)) {
      return false;
    }
    if (status !== "all" && status && note.status !== status) {
      return false;
    }
    if (customer && note.customer_name !== customer) {
      return false;
    }
    if (!creditNoteInDateRange(note, dateFrom, dateTo)) {
      return false;
    }
    if (!withinRange(note.total_amount, amountMin, amountMax)) {
      return false;
    }
    return true;
  });
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

// A 401/403 means the logged-in user's role simply isn't allowed this data (once
// the backend enforces permissions). That's not an outage and not guest/offline
// mode — render the section EMPTY (its tab is hidden anyway), never mock data and
// never a "data unavailable" / demo-mode warning.
function resultWasBlocked(result) {
  const status = result?.reason?.status;
  return result?.status === "rejected" && (status === 401 || status === 403);
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

  if (resultWasBlocked(result)) {
    setAll([]);
    setRows([]);
    setPagination(buildInitialLocalPagination([]));
    setUsingMock(false);
    return;
  }

  const fallbackRows = typeof mockFallbackRows === "function" ? mockFallbackRows() : mockFallbackRows;
  const fallbackResponse = buildInitialLocalPagination(fallbackRows);
  setAll(fallbackRows);
  setRows(getCollectionRows(fallbackResponse));
  setPagination(getCollectionPagination(fallbackResponse));
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

  if (resultWasBlocked(result)) {
    setAll([]);
    setRows([]);
    setPagination(buildInitialLocalPagination([]));
    setUsingMock(false);
    return;
  }

  const fallbackResponse = buildInitialLocalPagination(mockRows);
  setAll(mockRows);
  setRows(getCollectionRows(fallbackResponse));
  setPagination(getCollectionPagination(fallbackResponse));
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
  } else if (resultWasBlocked(categoryResult)) {
    setters.setCategories([]);
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
  } else if (resultWasBlocked(quotationResult)) {
    setters.setQuotations([]);
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
    setters.setBillingNoteEligibleSales(mockEligibleBillingNoteSales);
    setters.setBillingNoteSummary(mockBillingNoteSummary);
    setters.setBillingNoteNextReferenceNo(mockBillingNoteNextReferenceNo);
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
    setters.setPaymentBatchEligiblePurchases(mockEligiblePaymentBatchPurchases);
    setters.setPaymentBatchSummary(mockPaymentBatchSummary);
    setters.setPaymentBatchNextReferenceNo(mockPaymentBatchNextReferenceNo);
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
    setters.setCreditNoteEligibleSales(mockEligibleCreditNoteSales);
    setters.setCreditNoteNextReferenceNo(mockCreditNoteNextReferenceNo);
    failures.push("credit-note-eligibility");
  }

  if (creditNotePageResult.status === "fulfilled") {
    const rows = getCollectionRows(creditNotePageResult.value);
    setters.setCreditNotes(rows);
    setters.setCreditNoteRows(rows);
    setters.setCreditNotePagination(getCollectionPagination(creditNotePageResult.value));
    setters.setUsingMockCreditNotes(false);
  } else {
    setters.setCreditNotes(mockCreditNotes);
    const fallbackResponse = buildInitialLocalPagination(mockCreditNotes);
    setters.setCreditNoteRows(getCollectionRows(fallbackResponse));
    setters.setCreditNotePagination(getCollectionPagination(fallbackResponse));
    setters.setUsingMockCreditNotes(true);
    failures.push("credit-notes");
  }

  return failures;
}

export function applyMockInitialData(setters) {
  const mockOnlyResult = { status: "rejected", reason: "mock-only" };
  applyInitialDataResults({
    results: Array.from({ length: 17 }, () => mockOnlyResult),
    setters,
  });
}
