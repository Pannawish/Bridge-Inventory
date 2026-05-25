import { useEffect, useState } from "react";
import { api } from "./api";
import ActiveTabContent from "./app/ActiveTabContent";
import { buildAppMessageHelpers } from "./app/appMessageUtils";
import AppShell from "./app/AppShell";
import CreditNotePrompt from "./components/CreditNotePrompt";
import { useAppChat } from "./hooks/useAppChat";
import { useAppFinancialActions } from "./hooks/useAppFinancialActions";
import { useAppTransactionActions } from "./hooks/useAppTransactionActions";
import { useLanguage } from "./i18n/LanguageContext";
import { useAppMasterDataActions } from "./hooks/useAppMasterDataActions";
import { useInventoryData } from "./hooks/useInventoryData";

function App() {
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

    if (typeof window !== "undefined") {
      window.alert(message);
    }

    window.setTimeout(() => {
      setError(message);
    }, 0);
  }

  function handleTabSelect(tabId) {
    setActiveTab(tabId);
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

  return (
    <>
      <AppShell
        activeTab={activeTab}
        sidebarOpen={sidebarOpen}
        sidebarCollapsed={sidebarCollapsed}
        notice={notice}
        error={error}
        loading={loading}
        onToggleSidebarCollapsed={() => setSidebarCollapsed((collapsed) => !collapsed)}
        onCloseSidebar={() => setSidebarOpen(false)}
        onOpenSidebar={() => setSidebarOpen(true)}
        onSelectTab={handleTabSelect}
        onCloseNotice={() => setNotice("")}
        t={t}
      >
        <ActiveTabContent
          activeTab={activeTab}
          dashboard={dashboard}
          products={products}
          productRows={productRows}
          productPagination={productPagination}
          categories={categories}
          suppliers={suppliers}
          supplierRows={supplierRows}
          supplierPagination={supplierPagination}
          customers={customers}
          customerRows={customerRows}
          customerPagination={customerPagination}
          purchases={purchases}
          purchaseRows={purchaseRows}
          purchasePagination={purchasePagination}
          sales={sales}
          saleRows={saleRows}
          salePagination={salePagination}
          quotations={quotations}
          billingNotes={billingNotes}
          billingNoteRows={billingNoteRows}
          billingNotePagination={billingNotePagination}
          billingNoteEligibleSales={billingNoteEligibleSales}
          billingNoteSummary={billingNoteSummary}
          billingNoteNextReferenceNo={billingNoteNextReferenceNo}
          paymentBatches={paymentBatches}
          paymentBatchRows={paymentBatchRows}
          paymentBatchPagination={paymentBatchPagination}
          paymentBatchEligiblePurchases={paymentBatchEligiblePurchases}
          paymentBatchSummary={paymentBatchSummary}
          paymentBatchNextReferenceNo={paymentBatchNextReferenceNo}
          creditNotes={creditNotes}
          creditNoteRows={creditNoteRows}
          creditNotePagination={creditNotePagination}
          creditNoteEligibleSales={creditNoteEligibleSales}
          creditNoteNextReferenceNo={creditNoteNextReferenceNo}
          usingMockPurchases={usingMockPurchases}
          usingMockSales={usingMockSales}
          loadSupplierPage={loadSupplierPage}
          loadCustomerPage={loadCustomerPage}
          loadProductPage={loadProductPage}
          loadPurchasePage={loadPurchasePage}
          loadSalePage={loadSalePage}
          loadBillingNotePage={loadBillingNotePage}
          loadPaymentBatchPage={loadPaymentBatchPage}
          loadCreditNotePage={loadCreditNotePage}
          handleLoadProductHistory={handleLoadProductHistory}
          handlePurchaseCreateFromHistory={handlePurchaseCreateFromHistory}
          handlePurchaseStatusChange={handlePurchaseStatusChange}
          handlePurchaseItemStatusChange={handlePurchaseItemStatusChange}
          handlePurchaseUpdate={handlePurchaseUpdate}
          handlePurchaseDelete={handlePurchaseDelete}
          handleQuotationSave={handleQuotationSave}
          handleQuotationDelete={handleQuotationDelete}
          handleQuotationPurchaseCreate={handleQuotationPurchaseCreate}
          handleSalesCreateFromHistory={handleSalesCreateFromHistory}
          handleSaleStatusChange={handleSaleStatusChange}
          handleSaleUpdate={handleSaleUpdate}
          handleSaleDelete={handleSaleDelete}
          showWarning={showWarning}
          handleBillingNoteCreate={handleBillingNoteCreate}
          handleBillingNoteUpdate={handleBillingNoteUpdate}
          handleBillingNoteDelete={handleBillingNoteDelete}
          handlePaymentBatchCreate={handlePaymentBatchCreate}
          handlePaymentBatchUpdate={handlePaymentBatchUpdate}
          handlePaymentBatchDelete={handlePaymentBatchDelete}
          handleCreditNoteCreate={handleCreditNoteCreate}
          handleCreditNoteUpdate={handleCreditNoteUpdate}
          handleCreditNoteDelete={handleCreditNoteDelete}
          handleSupplierSave={handleSupplierSave}
          handleSupplierDelete={handleSupplierDelete}
          handleCustomerSave={handleCustomerSave}
          handleCustomerDelete={handleCustomerDelete}
          handleProductSave={handleProductSave}
          handleProductDelete={handleProductDelete}
          handleCategorySave={handleCategorySave}
          handleCategoryDelete={handleCategoryDelete}
          messages={messages}
          handleAskChat={handleAskChat}
          chatBusy={chatBusy}
          onViewPurchasesTab={() => setActiveTab("purchase-history")}
        />
      </AppShell>

      {creditNotePrompt ? (
        <CreditNotePrompt
          sale={creditNotePrompt.sale}
          newlyCancelledLines={creditNotePrompt.newlyCancelledLines}
          billingNotes={billingNotes}
          creditNotes={creditNotes}
          nextReferenceNo={creditNoteNextReferenceNo}
          onClose={() => setCreditNotePrompt(null)}
          onCreate={handleCreditNotePromptCreate}
        />
      ) : null}
    </>
  );
}

export default App;
