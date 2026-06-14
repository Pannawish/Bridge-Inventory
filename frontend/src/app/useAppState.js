import { useEffect, useState } from "react";
import { api } from "../api";
import { buildAppMessageHelpers } from "./appMessageUtils";
import { useAppChat } from "../hooks/useAppChat";
import { useAppFinancialActions } from "../hooks/useAppFinancialActions";
import { useAppTransactionActions } from "../hooks/useAppTransactionActions";
import { useLanguage } from "../i18n/LanguageContext";
import { useAppMasterDataActions } from "../hooks/useAppMasterDataActions";
import { useInventoryData } from "../hooks/useInventoryData";

export function useAppState() {
  const { language, t } = useLanguage();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("sidebarCollapsed") === "true";
    } catch {
      return false;
    }
  });
  const [notice, setNotice] = useState("");
  const [creditNotePrompt, setCreditNotePrompt] = useState(null);

  // Auto-dismiss the success toast so the user never has to close it manually.
  useEffect(() => {
    if (!notice) {
      return undefined;
    }
    const timeoutId = window.setTimeout(() => setNotice(""), 5000);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);
  // Deep-link intent set by the dashboard, consumed by the target tab's page
  // (e.g. open a specific sale, or a new PO/quote prefilled with items).
  const [dashboardIntent, setDashboardIntent] = useState(null);
  const {
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
  } = useInventoryData();

  // Auto-dismiss the error/warning toast after the same 5s as the success toast,
  // so every notification clears itself without a manual close.
  useEffect(() => {
    if (!error) {
      return undefined;
    }
    const timeoutId = window.setTimeout(() => setError(""), 5000);
    return () => window.clearTimeout(timeoutId);
  }, [error, setError]);

  const { formatSaleStockMessage, buildEntityNotice, buildStatusUpdatedNotice, buildStatusChangeConfirm } =
    buildAppMessageHelpers({
      t,
      language,
    });
  const { chatBusy, messages, handleAskChat } = useAppChat({
    api,
    t,
    setError,
  });

  async function handleLoadProductHistory(productId) {
    return api.getProductHistory(productId);
  }

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }

    if (sidebarOpen) {
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = previousOverflow;
      };
    }

    return undefined;
  }, [sidebarOpen]);

  useEffect(() => {
    try {
      localStorage.setItem("sidebarCollapsed", String(sidebarCollapsed));
    } catch {
      // ignore persistence failures
    }
  }, [sidebarCollapsed]);

  function showWarning(message) {
    setNotice("");
    setError("");
    if (!message) {
      return;
    }

    // Surface the warning through the app's error toast (app-toast-stack) only —
    // no window.alert. The setTimeout(0) lets the cleared toast unmount and
    // re-mount so the same message re-fires/re-animates when repeated.
    window.setTimeout(() => {
      setError(message);
    }, 0);
  }

  function handleTabSelect(tabId) {
    setActiveTab(tabId);
    setSidebarOpen(false);
  }

  // Dashboard → other-module deep link. Stores the intent and switches tabs;
  // the destination page reads the intent and clears it via setDashboardIntent.
  function navigateFromDashboard(intent) {
    if (!intent || !intent.tab) {
      return;
    }
    setDashboardIntent(intent);
    setActiveTab(intent.tab);
    setSidebarOpen(false);
  }

  const {
    handleSupplierSave,
    handleSupplierDelete,
    handleCustomerSave,
    handleCustomerDelete,
    handleCategorySave,
    handleCategoryDelete,
    handleProductSave,
    handleProductReorderUpdate,
    handleProductDelete,
    handleQuotationSave,
    handleQuotationDelete,
  } = useAppMasterDataActions({
    api,
    suppliers,
    setSuppliers,
    setSupplierRows,
    usingMockSuppliers,
    customers,
    setCustomers,
    setCustomerRows,
    usingMockCustomers,
    categories,
    setCategories,
    usingMockCategories,
    products,
    setProducts,
    setProductRows,
    usingMockProducts,
    quotations,
    setQuotations,
    usingMockQuotations,
    setNotice,
    setError,
    buildEntityNotice,
  });
  const {
    handleBillingNoteCreate,
    handleBillingNoteUpdate,
    handleBillingNoteDelete,
    handlePaymentBatchCreate,
    handlePaymentBatchUpdate,
    handlePaymentBatchDelete,
    handleCreditNoteCreate,
    handleCreditNoteUpdate,
    handleCreditNoteDelete,
  } = useAppFinancialActions({
    api,
    usingMockBillingNotes,
    setBillingNotes,
    setBillingNoteRows,
    refreshBillingNoteEligibility,
    usingMockPaymentBatches,
    setPaymentBatches,
    setPaymentBatchRows,
    refreshPaymentBatchEligibility,
    usingMockCreditNotes,
    setCreditNotes,
    setCreditNoteRows,
    refreshCreditNoteEligibility,
    loadBillingNotePage,
    setNotice,
    setError,
    buildEntityNotice,
  });
  const {
    handlePurchaseCreateFromHistory,
    handleQuotationPurchaseCreate,
    handleSalesCreateFromHistory,
    handlePurchaseStatusChange,
    handlePurchaseItemStatusChange,
    handlePurchaseUpdate,
    handlePurchaseDelete,
    handleSaleStatusChange,
    handleSaleUpdate,
    handleSaleDelete,
    handleCreditNotePromptCreate,
  } = useAppTransactionActions({
    api,
    products,
    purchases,
    sales,
    creditNotes,
    usingMockPurchases,
    usingMockSales,
    setPurchases,
    setPurchaseRows,
    setSales,
    setSaleRows,
    setCreditNotePrompt,
    setActiveTab,
    setNotice,
    setError,
    loadData,
    refreshBillingNoteEligibility,
    refreshPaymentBatchEligibility,
    buildEntityNotice,
    buildStatusUpdatedNotice,
    buildStatusChangeConfirm,
    formatSaleStockMessage,
    showWarning,
    t,
    handleCreditNoteCreate,
  });

  return {
    activeTab,
    setActiveTab,
    sidebarOpen,
    setSidebarOpen,
    sidebarCollapsed,
    setSidebarCollapsed,
    notice,
    setNotice,
    creditNotePrompt,
    setCreditNotePrompt,
    dashboardIntent,
    setDashboardIntent,
    navigateFromDashboard,
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
    t,
    chatBusy,
    messages,
    handleAskChat,
    handleLoadProductHistory,
    showWarning,
    handleTabSelect,
    handleSupplierSave,
    handleSupplierDelete,
    handleCustomerSave,
    handleCustomerDelete,
    handleCategorySave,
    handleCategoryDelete,
    handleProductSave,
    handleProductReorderUpdate,
    handleProductDelete,
    handleQuotationSave,
    handleQuotationDelete,
    handleBillingNoteCreate,
    handleBillingNoteUpdate,
    handleBillingNoteDelete,
    handlePaymentBatchCreate,
    handlePaymentBatchUpdate,
    handlePaymentBatchDelete,
    handleCreditNoteCreate,
    handleCreditNoteUpdate,
    handleCreditNoteDelete,
    handlePurchaseCreateFromHistory,
    handleQuotationPurchaseCreate,
    handleSalesCreateFromHistory,
    handlePurchaseStatusChange,
    handlePurchaseItemStatusChange,
    handlePurchaseUpdate,
    handlePurchaseDelete,
    handleSaleStatusChange,
    handleSaleUpdate,
    handleSaleDelete,
    handleCreditNotePromptCreate,
  };
}
