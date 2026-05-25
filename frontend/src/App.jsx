import { useEffect, useState } from "react";
import { api } from "./api";
import { PAGE_SIZE } from "./app/appUtils";
import { tabs, tabGroups } from "./app/tabs";
import ChatPanel from "./components/ChatPanel";
import Dashboard from "./components/Dashboard";
import CustomerPage from "./components/CustomerPage";
import PurchaseHistoryPage from "./components/PurchaseHistoryPage";
import SalesHistoryPage from "./components/SalesHistoryPage";
import SupplierPage from "./components/SupplierPage";
import ProductsPage from "./components/ProductsPage";
import CategoryPage from "./components/CategoryPage";
import InventoryPage from "./components/InventoryPage";
import QuotationPage from "./components/QuotationPage";
import BillingNotePage from "./components/BillingNotePage";
import PaymentBatchPage from "./components/PaymentBatchPage";
import CreditNotePage from "./components/CreditNotePage";
import CreditNotePrompt from "./components/CreditNotePrompt";
import SettingsPage from "./components/SettingsPage";
import TabIcon from "./components/TabIcon";
import { useAppFinancialActions } from "./hooks/useAppFinancialActions";
import { useAppTransactionActions } from "./hooks/useAppTransactionActions";
import { useLanguage } from "./i18n/LanguageContext";
import { useAppMasterDataActions } from "./hooks/useAppMasterDataActions";
import { useInventoryData } from "./hooks/useInventoryData";
import { formatSaleStockIssueMessage } from "./saleStock";

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
  const [chatBusy, setChatBusy] = useState(false);
  const [creditNotePrompt, setCreditNotePrompt] = useState(null);
  const [messages, setMessages] = useState([
    { role: "assistant", content: t("app.messages.chatIntro") },
  ]);
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

  const activeTabMeta = tabs.find((tab) => tab.id === activeTab) || tabs[0];
  const tabBadges = {};

  function formatMessage(key, values = {}) {
    return t(key, values).replace(/\s{2,}/g, " ").trim();
  }

  function getStatusLabel(status) {
    const key = `common.statusLabels.${status}`;
    const label = t(key);
    return label === key ? status : label;
  }

  function getEntityLabel(entityKey) {
    return t(`app.entities.${entityKey}`);
  }

  function formatSaleStockMessage(issues) {
    return formatSaleStockIssueMessage(issues, {
      t,
      locale: language === "th" ? "th-TH" : "en-US",
    });
  }

  function buildEntityNotice(messageKey, entityKey, ref) {
    return formatMessage(messageKey, {
      entity: getEntityLabel(entityKey),
      ref: ref || "",
    });
  }

  function buildStatusUpdatedNotice(entityKey, ref, status) {
    return formatMessage("app.messages.statusUpdated", {
      entity: getEntityLabel(entityKey),
      ref: ref || "",
      status: getStatusLabel(status),
    });
  }

  function buildStatusChangeConfirm(entityKey, ref, fromStatus, toStatus) {
    return formatMessage("app.messages.statusChangeConfirm", {
      entity: getEntityLabel(entityKey),
      ref: ref || "",
      from: getStatusLabel(fromStatus),
      to: getStatusLabel(toStatus),
    });
  }

  useEffect(() => {
    setMessages((current) => {
      if (current.length !== 1 || current[0]?.role !== "assistant") {
        return current;
      }

      const nextContent = t("app.messages.chatIntro");

      if (current[0].content === nextContent) {
        return current;
      }

      return [{ role: "assistant", content: nextContent }];
    });
  }, [t]);

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

  async function handleAskChat(question) {
    const nextMessages = [...messages, { role: "user", content: question }];
    setMessages(nextMessages);
    setChatBusy(true);
    setError("");

    try {
      const response = await api.askChat(question);
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: response.answer || "No answer returned.",
          model: response.used_model,
        },
      ]);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setChatBusy(false);
    }
  }

  return (
    <div
      className={`app-shell${sidebarOpen ? " sidebar-open" : ""}${
        sidebarCollapsed ? " sidebar-collapsed" : ""
      }`}
    >
      <aside className={sidebarOpen ? "sidebar is-open" : "sidebar"}>
        <div className="sidebar-content">
          <div className="sidebar-top">
            <button
              type="button"
              className="sidebar-collapse-toggle"
              aria-label={sidebarCollapsed ? t("sidebar.expandMenu") : t("sidebar.collapseMenu")}
              aria-expanded={!sidebarCollapsed}
              onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
                focusable="false"
              >
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <h1>{t("app.title")}</h1>
            <button
              type="button"
              className="sidebar-close-button"
              aria-label={t("sidebar.closeMenu")}
              onClick={() => setSidebarOpen(false)}
            >
              X
            </button>
          </div>

          <nav className="sidebar-nav">
            {tabGroups.map((group) => {
              const groupTabs = tabs.filter((tab) => tab.group === group.id);
              if (!groupTabs.length) {
                return null;
              }
              return (
                <div className="sidebar-nav-group" key={group.id}>
                  <p className="sidebar-nav-group-label">{t(group.labelKey)}</p>
                  {groupTabs.map((tab) => {
                    const badgeCount = tabBadges[tab.id] || 0;
                    const tabLabel = t(`tabs.${tab.id}`);
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        title={tabLabel}
                        className={tab.id === activeTab ? "sidebar-nav-button active" : "sidebar-nav-button"}
                        onClick={() => handleTabSelect(tab.id)}
                      >
                        <span className="sidebar-nav-icon">
                          <TabIcon tabId={tab.id} />
                        </span>
                        <span className="sidebar-nav-text">{tabLabel}</span>
                        {badgeCount > 0 ? (
                          <span
                            className="sidebar-nav-badge"
                            aria-label={`${badgeCount} pending`}
                          >
                            {badgeCount}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </nav>

          <div className="sidebar-footer">
            <button
              type="button"
              title={t("sidebar.settings")}
              className={
                activeTab === "settings"
                  ? "sidebar-nav-button active"
                  : "sidebar-nav-button"
              }
              onClick={() => handleTabSelect("settings")}
            >
              <span className="sidebar-nav-icon">
                <TabIcon tabId="settings" />
              </span>
              <span className="sidebar-nav-text">{t("sidebar.settings")}</span>
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen ? (
        <div
          className="sidebar-backdrop"
          role="presentation"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <main className="main-panel">
        <header className="mobile-topbar">
          <button
            type="button"
            className="mobile-menu-button"
            aria-label={t("sidebar.openMenu")}
            onClick={() => setSidebarOpen(true)}
          >
            <span />
            <span />
            <span />
          </button>
          <div className="mobile-topbar-title">
            <span className="mobile-topbar-eyebrow">{t("app.title")}</span>
            <strong>{activeTab === "settings" ? t("settings.title") : t(`tabs.${activeTabMeta.id}`)}</strong>
          </div>
        </header>

        {notice ? (
          <div className="notice-banner">
            <span>{notice}</span>
            <button
              className="banner-close-button"
              type="button"
              aria-label={t("common.close")}
              onClick={() => setNotice("")}
            >
              X
            </button>
          </div>
        ) : null}
        {error ? <div className="error-banner">{error}</div> : null}

        {loading ? (
          <section className="section-card loading-card">
            <p>{t("app.loadingInventoryData")}</p>
          </section>
        ) : (
          <>
            {activeTab === "dashboard" && dashboard ? (
              <Dashboard dashboard={dashboard} />
            ) : null}

            {activeTab === "inventory" ? (
              <InventoryPage dashboard={dashboard} />
            ) : null}

            {activeTab === "purchase-history" ? (
              <PurchaseHistoryPage
                products={products}
                suppliers={suppliers}
                purchases={purchaseRows}
                allPurchases={purchases}
                pagination={purchasePagination}
                onPageRequest={loadPurchasePage}
                onCreatePurchase={handlePurchaseCreateFromHistory}
                onPurchaseStatusChange={handlePurchaseStatusChange}
                onPurchaseItemStatusChange={handlePurchaseItemStatusChange}
                onPurchaseUpdate={handlePurchaseUpdate}
                onPurchaseDelete={handlePurchaseDelete}
              />
            ) : null}

            {activeTab === "quotations" ? (
              <QuotationPage
                quotations={quotations}
                products={products}
                suppliers={suppliers}
                customers={customers}
                purchases={purchases}
                sales={sales}
                enableSaleStockValidation={usingMockPurchases && usingMockSales}
                onSaveQuotation={handleQuotationSave}
                onDeleteQuotation={handleQuotationDelete}
                onCreatePurchaseFromQuotation={handleQuotationPurchaseCreate}
                onViewPurchases={() => setActiveTab("purchase-history")}
                onCreateSale={handleSalesCreateFromHistory}
              />
            ) : null}

            {activeTab === "sales-history" ? (
              <SalesHistoryPage
                sales={saleRows}
                allSales={sales}
                products={products}
                suppliers={suppliers}
                purchases={usingMockPurchases ? purchases : []}
                enableStockValidation={usingMockPurchases && usingMockSales}
                pagination={salePagination}
                customers={customers}
                onPageRequest={loadSalePage}
                onCreateSale={handleSalesCreateFromHistory}
                onSaleStatusChange={handleSaleStatusChange}
                onSaleUpdate={handleSaleUpdate}
                onSaleDelete={handleSaleDelete}
                onWarning={showWarning}
              />
            ) : null}

            {activeTab === "billing-notes" ? (
              <BillingNotePage
                billingNotes={billingNoteRows}
                allBillingNotes={billingNotes}
                customers={customers}
                sales={billingNoteEligibleSales}
                summary={billingNoteSummary}
                nextReferenceNo={billingNoteNextReferenceNo}
                pagination={billingNotePagination}
                onPageRequest={loadBillingNotePage}
                onCreateBillingNote={handleBillingNoteCreate}
                onUpdateBillingNote={handleBillingNoteUpdate}
                onDeleteBillingNote={handleBillingNoteDelete}
              />
            ) : null}

            {activeTab === "payment-batches" ? (
              <PaymentBatchPage
                paymentBatches={paymentBatchRows}
                allPaymentBatches={paymentBatches}
                suppliers={suppliers}
                purchases={paymentBatchEligiblePurchases}
                summary={paymentBatchSummary}
                nextReferenceNo={paymentBatchNextReferenceNo}
                pagination={paymentBatchPagination}
                onPageRequest={loadPaymentBatchPage}
                onCreatePaymentBatch={handlePaymentBatchCreate}
                onUpdatePaymentBatch={handlePaymentBatchUpdate}
                onDeletePaymentBatch={handlePaymentBatchDelete}
              />
            ) : null}

            {activeTab === "credit-notes" ? (
              <CreditNotePage
                creditNotes={creditNoteRows}
                allCreditNotes={creditNotes}
                billingNotes={billingNotes}
                sales={creditNoteEligibleSales}
                nextReferenceNo={creditNoteNextReferenceNo}
                pagination={creditNotePagination}
                onPageRequest={loadCreditNotePage}
                onCreateCreditNote={handleCreditNoteCreate}
                onUpdateCreditNote={handleCreditNoteUpdate}
                onDeleteCreditNote={handleCreditNoteDelete}
              />
            ) : null}

            {activeTab === "suppliers" ? (
              <SupplierPage
                suppliers={supplierRows}
                allSuppliers={suppliers}
                pagination={supplierPagination}
                onPageRequest={loadSupplierPage}
                onSaveSupplier={handleSupplierSave}
                onDeleteSupplier={handleSupplierDelete}
              />
            ) : null}

            {activeTab === "customers" ? (
              <CustomerPage
                customers={customerRows}
                allCustomers={customers}
                pagination={customerPagination}
                onPageRequest={loadCustomerPage}
                onSaveCustomer={handleCustomerSave}
                onDeleteCustomer={handleCustomerDelete}
              />
            ) : null}

            {activeTab === "products" ? (
              <ProductsPage
                products={productRows}
                allProducts={products}
                categories={categories}
                purchases={usingMockPurchases ? purchases : []}
                sales={usingMockSales ? sales : []}
                pagination={productPagination}
                onPageRequest={loadProductPage}
                onLoadProductHistory={handleLoadProductHistory}
                onSaveProduct={handleProductSave}
                onDeleteProduct={handleProductDelete}
              />
            ) : null}

            {activeTab === "categories" ? (
              <CategoryPage
                categories={categories}
                products={products}
                onSaveCategory={handleCategorySave}
                onDeleteCategory={handleCategoryDelete}
              />
            ) : null}

            {activeTab === "chat" ? (
              <ChatPanel messages={messages} onAsk={handleAskChat} busy={chatBusy} />
            ) : null}

            {activeTab === "settings" ? <SettingsPage /> : null}
          </>
        )}
      </main>

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
    </div>
  );
}

export default App;
