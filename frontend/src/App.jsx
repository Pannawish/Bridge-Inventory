import { useEffect, useState } from "react";
import { api } from "./api";
import {
  PAGE_SIZE,
  buildPurchaseUpdatePayload,
  buildSaleUpdatePayload,
  countCancelledSaleItems,
  countPendingCreditNoteLines,
  findUncreditedCancelledSaleLines,
} from "./app/appUtils";
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
import { useLanguage } from "./i18n/LanguageContext";
import { useAppMasterDataActions } from "./hooks/useAppMasterDataActions";
import { useInventoryData } from "./hooks/useInventoryData";
import { applyPurchaseStatusToItems } from "./purchaseStatus";
import { applySaleStatusToItems } from "./saleStatus";
import { formatSaleStockIssueMessage, getSaleStockIssues } from "./saleStock";

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

  function shouldKeepSaleAsDraft(status) {
    return !["draft", "cancelled", "returned"].includes(`${status || "draft"}`);
  }

  function buildDraftSale(sale) {
    return applySaleStatusToItems(sale, "draft");
  }

  function normalizeSaleForAvailableStock(sale, options = {}) {
    const requestedStatus = sale?.status || "draft";

    if (!shouldKeepSaleAsDraft(requestedStatus)) {
      return { sale, issues: [], forcedDraft: false };
    }

    if (!usingMockPurchases || !usingMockSales) {
      return { sale, issues: [], forcedDraft: false };
    }

    const issues = getSaleStockIssues(sale, products, purchases, sales, options);

    if (!issues.length) {
      return { sale, issues: [], forcedDraft: false };
    }

    return {
      sale: buildDraftSale(sale),
      issues,
      forcedDraft: true,
    };
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

  async function handlePurchaseCreateFromHistory(formData) {
    setError("");

    try {
      await api.createPurchase(formData);
      setNotice(t("app.messages.purchaseTransactionSaved"));
      setActiveTab("purchase-history");
      await loadData();
      return true;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  // Quotation multi-PO wizard: create one purchase order without leaving the wizard.
  async function handleQuotationPurchaseCreate(formData) {
    setError("");

    try {
      const saved = await api.createPurchase(formData);
      setNotice(
        buildEntityNotice(
          "app.messages.entityCreated",
          "purchaseOrder",
          saved?.reference_no || ""
        )
      );
      await loadData();
      return saved;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function handleSalesCreateFromHistory(formData) {
    setError("");

    const requestedSale = {
      status: `${formData.get("status") || "draft"}`,
      items: JSON.parse(`${formData.get("items") || "[]"}`),
    };
    const { sale: normalizedSale, issues, forcedDraft } = normalizeSaleForAvailableStock(
      requestedSale
    );

    if (forcedDraft) {
      formData.set("status", normalizedSale.status);
      formData.set("items", JSON.stringify(normalizedSale.items || []));
    }

    try {
      await api.createSale(formData);
      setNotice(
        forcedDraft
          ? t("app.messages.salesTransactionSavedAsDraft", {
              reason: formatSaleStockMessage(issues),
            })
          : t("app.messages.salesTransactionSaved")
      );
      setActiveTab("sales-history");
      await loadData();
      return true;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function handlePurchaseStatusChange(purchaseId, nextStatus) {
    const purchase = purchases.find((row) => row.id === purchaseId);

    if (!purchase || purchase.status === nextStatus) {
      return;
    }

    if (nextStatus === "partially_received") {
      setNotice(t("app.messages.partiallyReceivedAuto"));
      return;
    }

    const confirmed = window.confirm(
      buildStatusChangeConfirm(
        "purchase",
        purchase.reference_no,
        purchase.status,
        nextStatus
      )
    );

    if (!confirmed) {
      return;
    }

    setError("");

    if (usingMockPurchases) {
      const updatedPurchase = applyPurchaseStatusToItems(purchase, nextStatus);

      setPurchases((currentRows) =>
        currentRows.map((row) =>
          row.id === purchaseId ? updatedPurchase : row
        )
      );
      setPurchaseRows((currentRows) =>
        currentRows.map((row) =>
          row.id === purchaseId ? updatedPurchase : row
        )
      );
      setNotice(
        buildStatusUpdatedNotice(
          "purchase",
          purchase.reference_no,
          updatedPurchase.status
        )
      );
      return;
    }

    try {
      await api.updatePurchaseStatus(purchaseId, nextStatus);
      setNotice(buildStatusUpdatedNotice("purchase", purchase.reference_no, nextStatus));
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function handlePurchaseItemStatusChange(updatedPurchase) {
    if (usingMockPurchases) {
      setPurchases((currentRows) =>
        currentRows.map((row) => (row.id === updatedPurchase.id ? updatedPurchase : row))
      );
      setPurchaseRows((currentRows) =>
        currentRows.map((row) => (row.id === updatedPurchase.id ? updatedPurchase : row))
      );
      setNotice(
        buildEntityNotice(
          "app.messages.entityUpdated",
          "purchase",
          updatedPurchase.reference_no || updatedPurchase.id
        )
      );
      return true;
    }

    try {
      const savedPurchase = await api.updatePurchase(updatedPurchase.id, updatedPurchase);

      setPurchases((currentRows) =>
        currentRows.map((row) =>
          row.id === updatedPurchase.id ? savedPurchase || updatedPurchase : row
        )
      );
      setPurchaseRows((currentRows) =>
        currentRows.map((row) =>
          row.id === updatedPurchase.id ? savedPurchase || updatedPurchase : row
        )
      );
      setNotice(
        buildEntityNotice(
          "app.messages.entityUpdated",
          "purchase",
          updatedPurchase.reference_no || updatedPurchase.id
        )
      );
      await loadData();
      return true;
    } catch (requestError) {
      showWarning(requestError.message || t("app.messages.purchaseUpdateFailed"));
      return false;
    }
  }

  async function handleSaleStatusChange(saleId, nextStatus) {
    const sale = sales.find((row) => row.id === saleId);

    if (!sale || sale.status === nextStatus) {
      return;
    }

    if (shouldKeepSaleAsDraft(nextStatus) && usingMockPurchases && usingMockSales) {
      const nextSale = applySaleStatusToItems({ ...sale, status: nextStatus }, nextStatus);
      const issues = getSaleStockIssues(nextSale, products, purchases, sales, {
        excludeSaleId: sale.id,
        currentSale: sale,
      });

      if (issues.length) {
        showWarning(formatSaleStockMessage(issues));
        return;
      }
    }

    const confirmed = window.confirm(
      buildStatusChangeConfirm("sale", sale.reference_no, sale.status, nextStatus)
    );

    if (!confirmed) {
      return;
    }

    setError("");

    if (usingMockSales) {
      const updatedSale = applySaleStatusToItems(sale, nextStatus);

      setSales((currentRows) =>
        currentRows.map((row) => (row.id === saleId ? updatedSale : row))
      );
      setSaleRows((currentRows) =>
        currentRows.map((row) => (row.id === saleId ? updatedSale : row))
      );
      setNotice(buildStatusUpdatedNotice("sale", sale.reference_no, updatedSale.status));
      maybeOpenCreditNotePrompt(sale, updatedSale);
      return;
    }

    try {
      const updatedSale = await api.updateSaleStatus(saleId, nextStatus);
      setNotice(buildStatusUpdatedNotice("sale", sale.reference_no, nextStatus));
      await loadData();
      maybeOpenCreditNotePrompt(sale, updatedSale);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function handleSaleUpdate(updatedSale) {
    setError("");
    const previousSale = sales.find((row) => row.id === updatedSale.id);
    const { sale: normalizedSale, issues, forcedDraft } = normalizeSaleForAvailableStock(
      updatedSale,
      {
        excludeSaleId: updatedSale.id,
        currentSale: previousSale,
      }
    );
    const successNotice = forcedDraft
      ? t("app.messages.saleSavedAsDraft", {
          ref: updatedSale.reference_no || updatedSale.id,
          reason: formatSaleStockMessage(issues),
        })
      : buildEntityNotice(
          "app.messages.entityUpdated",
          "sale",
          updatedSale.reference_no || updatedSale.id
        );

    if (usingMockSales) {
      setSales((currentRows) =>
        currentRows.map((row) => (row.id === normalizedSale.id ? normalizedSale : row))
      );
      setSaleRows((currentRows) =>
        currentRows.map((row) => (row.id === normalizedSale.id ? normalizedSale : row))
      );
      setNotice(successNotice);
      maybeOpenCreditNotePrompt(previousSale, normalizedSale);
      return true;
    }

    try {
      const savedSale = await api.updateSale(
        normalizedSale.id,
        buildSaleUpdatePayload(normalizedSale)
      );
      const resolvedSale = savedSale || normalizedSale;
      setSales((currentRows) =>
        currentRows.map((row) =>
          row.id === normalizedSale.id ? resolvedSale : row
        )
      );
      setSaleRows((currentRows) =>
        currentRows.map((row) =>
          row.id === normalizedSale.id ? resolvedSale : row
        )
      );
      setNotice(successNotice);
      await refreshBillingNoteEligibility();
      await loadData();
      maybeOpenCreditNotePrompt(previousSale, resolvedSale);
      return true;
    } catch (requestError) {
      showWarning(requestError.message || t("app.messages.saleUpdateFailed"));
      return false;
    }
  }

  function maybeOpenCreditNotePrompt(previousSale, nextSale) {
    if (!nextSale) {
      return;
    }
    const prevCount = countCancelledSaleItems(previousSale);
    const nextCount = countCancelledSaleItems(nextSale);
    if (nextCount <= prevCount) {
      return;
    }
    const lines = findUncreditedCancelledSaleLines(nextSale, creditNotes);
    if (!lines.length) {
      return;
    }
    setCreditNotePrompt({
      sale: nextSale,
      newlyCancelledLines: lines,
    });
  }

  async function handleCreditNotePromptCreate(payload) {
    const created = await handleCreditNoteCreate(payload);
    if (created === false) {
      return false;
    }
    setCreditNotePrompt(null);
    return created;
  }

  async function handlePurchaseUpdate(updatedPurchase) {
    if (usingMockPurchases) {
      setPurchases((currentRows) =>
        currentRows.map((row) => (row.id === updatedPurchase.id ? updatedPurchase : row))
      );
      setPurchaseRows((currentRows) =>
        currentRows.map((row) => (row.id === updatedPurchase.id ? updatedPurchase : row))
      );
      setNotice(
        buildEntityNotice(
          "app.messages.entityUpdated",
          "purchase",
          updatedPurchase.reference_no || updatedPurchase.id
        )
      );
      return true;
    }

    try {
      const savedPurchase = await api.updatePurchase(
        updatedPurchase.id,
        buildPurchaseUpdatePayload(updatedPurchase)
      );
      setPurchases((currentRows) =>
        currentRows.map((row) =>
          row.id === updatedPurchase.id ? savedPurchase || updatedPurchase : row
        )
      );
      setPurchaseRows((currentRows) =>
        currentRows.map((row) =>
          row.id === updatedPurchase.id ? savedPurchase || updatedPurchase : row
        )
      );
      setNotice(
        buildEntityNotice(
          "app.messages.entityUpdated",
          "purchase",
          updatedPurchase.reference_no || updatedPurchase.id
        )
      );
      await refreshPaymentBatchEligibility();
      await loadData();
      return true;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function handleSaleDelete(deletedSale) {
    if (usingMockSales) {
      setSales((currentRows) => currentRows.filter((row) => row.id !== deletedSale.id));
      setSaleRows((currentRows) => currentRows.filter((row) => row.id !== deletedSale.id));
      setNotice(
        buildEntityNotice(
          "app.messages.entityDeleted",
          "sale",
          deletedSale.reference_no || deletedSale.id
        )
      );
      return true;
    }

    try {
      await api.deleteSale(deletedSale.id);
      setSales((currentRows) => currentRows.filter((row) => row.id !== deletedSale.id));
      setSaleRows((currentRows) => currentRows.filter((row) => row.id !== deletedSale.id));
      setNotice(
        buildEntityNotice(
          "app.messages.entityDeleted",
          "sale",
          deletedSale.reference_no || deletedSale.id
        )
      );
      await refreshBillingNoteEligibility();
      await loadData();
      return true;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function handlePurchaseDelete(deletedPurchase) {
    if (usingMockPurchases) {
      setPurchases((currentRows) =>
        currentRows.filter((row) => row.id !== deletedPurchase.id)
      );
      setPurchaseRows((currentRows) =>
        currentRows.filter((row) => row.id !== deletedPurchase.id)
      );
      setNotice(
        buildEntityNotice(
          "app.messages.entityDeleted",
          "purchase",
          deletedPurchase.reference_no || deletedPurchase.id
        )
      );
      await refreshPaymentBatchEligibility();
      return true;
    }

    try {
      await api.deletePurchase(deletedPurchase.id);
      setPurchases((currentRows) =>
        currentRows.filter((row) => row.id !== deletedPurchase.id)
      );
      setPurchaseRows((currentRows) =>
        currentRows.filter((row) => row.id !== deletedPurchase.id)
      );
      setNotice(
        buildEntityNotice(
          "app.messages.entityDeleted",
          "purchase",
          deletedPurchase.reference_no || deletedPurchase.id
        )
      );
      await loadData();
      return true;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

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
