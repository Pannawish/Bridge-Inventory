import { useEffect, useState } from "react";
import { api } from "./api";
import {
  PAGE_SIZE,
  buildBillingNotePayload,
  buildCreditNotePayload,
  buildPaymentBatchPayload,
  buildPurchaseUpdatePayload,
  buildSaleUpdatePayload,
  countCancelledSaleItems,
  countPendingCreditNoteLines,
  findUncreditedCancelledSaleLines,
  isMockQuotationId,
  mergeSavedQuotation,
  removeMockQuotationId,
} from "./app/appUtils";
import { tabs } from "./app/tabs";
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
import { useLanguage } from "./i18n/LanguageContext";
import { useInventoryData } from "./hooks/useInventoryData";
import { applyPurchaseStatusToItems } from "./purchaseStatus";
import { applySaleStatusToItems } from "./saleStatus";
import { formatSaleStockIssueMessage, getSaleStockIssues } from "./saleStock";

function isBrowserFile(value) {
  return typeof File !== "undefined" && value instanceof File;
}

function appendProductJson(formData, key, value) {
  formData.append(key, JSON.stringify(Array.isArray(value) ? value : []));
}

function isProductActive(product) {
  return product?.isActive ?? product?.is_active ?? true;
}

function buildProductSavePayload(product) {
  const formData = new FormData();
  const productPictures = Array.isArray(product.productPictures) ? product.productPictures : [];
  const newPictures = productPictures.filter((picture) => isBrowserFile(picture.file));
  const selectedPictureId = `${product.selectedPictureId || ""}`;
  const selectedNewPictureIndex = newPictures.findIndex(
    (picture) => picture.id === selectedPictureId
  );

  [
    "id",
    "productDisplayId",
    "sku",
    "productName",
    "stockBaseUnit",
    "defaultPurchaseUnit",
    "defaultSalesUnit",
    "categoryId",
    "category",
    "detail",
    "isActive",
  ].forEach((field) => {
    if (product[field] !== undefined) {
      formData.append(field, product[field] ?? "");
    }
  });

  appendProductJson(formData, "previousSkus", product.previousSkus);
  appendProductJson(formData, "subNames", product.subNames);
  appendProductJson(formData, "unitConversions", product.unitConversions);

  newPictures.forEach((picture) => {
    formData.append("pictures", picture.file);
  });

  if (Array.isArray(product.removePictureIds) && product.removePictureIds.length) {
    appendProductJson(formData, "remove_picture_ids", product.removePictureIds);
  }

  if (selectedNewPictureIndex >= 0) {
    formData.append("selected_picture_index", selectedNewPictureIndex);
  } else if (selectedPictureId) {
    formData.append("selected_picture_id", selectedPictureId);
  }

  return formData;
}

function App() {
  const { t } = useLanguage();
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
    {
      role: "assistant",
      content:
        "Ask about low stock, recent sales, or which products need restocking.",
    },
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
  const activeProducts = products.filter(isProductActive);
  const tabBadges = {};

  async function handlePurchaseCreateFromHistory(formData) {
    setError("");

    try {
      await api.createPurchase(formData);
      setNotice("Purchase transaction saved.");
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
      setNotice(`Purchase order ${saved?.reference_no || ""} created.`.trim());
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
          ? `Sales transaction saved as draft. ${formatSaleStockIssueMessage(issues)}`
          : "Sales transaction saved."
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
      setNotice("Partially Received is set automatically after some items are marked received.");
      return;
    }

    const confirmed = window.confirm(
      `Change purchase ${purchase.reference_no} status from ${purchase.status} to ${nextStatus}?`
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
      setNotice(`Purchase ${purchase.reference_no} status updated to ${updatedPurchase.status}.`);
      return;
    }

    try {
      await api.updatePurchaseStatus(purchaseId, nextStatus);
      setNotice(`Purchase ${purchase.reference_no} status updated to ${nextStatus}.`);
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
      setNotice(`Purchase ${updatedPurchase.reference_no || updatedPurchase.id} updated.`);
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
      setNotice(`Purchase ${updatedPurchase.reference_no || updatedPurchase.id} updated.`);
      await loadData();
      return true;
    } catch (requestError) {
      showWarning(requestError.message || "Purchase update failed.");
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
        showWarning(formatSaleStockIssueMessage(issues));
        return;
      }
    }

    const confirmed = window.confirm(
      `Change sale ${sale.reference_no} status from ${sale.status} to ${nextStatus}?`
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
      setNotice(`Sale ${sale.reference_no} status updated to ${updatedSale.status}.`);
      maybeOpenCreditNotePrompt(sale, updatedSale);
      return;
    }

    try {
      const updatedSale = await api.updateSaleStatus(saleId, nextStatus);
      setNotice(`Sale ${sale.reference_no} status updated to ${nextStatus}.`);
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
      ? `Sale ${updatedSale.reference_no || updatedSale.id} saved as draft. ${formatSaleStockIssueMessage(issues)}`
      : `Sale ${updatedSale.reference_no || updatedSale.id} updated.`;

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
      showWarning(requestError.message || "Sale update failed.");
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
      setNotice(`Purchase ${updatedPurchase.reference_no || updatedPurchase.id} updated.`);
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
      setNotice(`Purchase ${updatedPurchase.reference_no || updatedPurchase.id} updated.`);
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
      setNotice(`Sale ${deletedSale.reference_no || deletedSale.id} deleted.`);
      return true;
    }

    try {
      await api.deleteSale(deletedSale.id);
      setSales((currentRows) => currentRows.filter((row) => row.id !== deletedSale.id));
      setSaleRows((currentRows) => currentRows.filter((row) => row.id !== deletedSale.id));
      setNotice(`Sale ${deletedSale.reference_no || deletedSale.id} deleted.`);
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
      setNotice(`Purchase ${deletedPurchase.reference_no || deletedPurchase.id} deleted.`);
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
      setNotice(`Purchase ${deletedPurchase.reference_no || deletedPurchase.id} deleted.`);
      await loadData();
      return true;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function handleSupplierSave(nextSupplier) {
    if (usingMockSuppliers) {
      const resolvedSupplier = nextSupplier;

      setSuppliers((currentRows) =>
        currentRows.some((row) => `${row.id}` === `${nextSupplier.id}`)
          ? currentRows.map((row) =>
              `${row.id}` === `${nextSupplier.id}` ? resolvedSupplier : row
            )
          : [resolvedSupplier, ...currentRows]
      );
      setSupplierRows((currentRows) =>
        currentRows.some((row) => `${row.id}` === `${nextSupplier.id}`)
          ? currentRows.map((row) =>
              `${row.id}` === `${nextSupplier.id}` ? resolvedSupplier : row
            )
          : [resolvedSupplier, ...currentRows].slice(0, PAGE_SIZE)
      );
      setNotice(`Supplier ${resolvedSupplier.companyName || resolvedSupplier.id} saved.`);
      return resolvedSupplier;
    }

    try {
      const exists = suppliers.some((row) => `${row.id}` === `${nextSupplier.id}`);
      const savedSupplier = exists
        ? await api.updateSupplier(nextSupplier.id, nextSupplier)
        : await api.createSupplier(nextSupplier);
      const resolvedSupplier = savedSupplier || nextSupplier;

      setSuppliers((currentRows) =>
        currentRows.some((row) => `${row.id}` === `${nextSupplier.id}`)
          ? currentRows.map((row) =>
              `${row.id}` === `${nextSupplier.id}` ? resolvedSupplier : row
            )
          : [resolvedSupplier, ...currentRows]
      );
      setSupplierRows((currentRows) =>
        currentRows.some((row) => `${row.id}` === `${nextSupplier.id}`)
          ? currentRows.map((row) =>
              `${row.id}` === `${nextSupplier.id}` ? resolvedSupplier : row
            )
          : [resolvedSupplier, ...currentRows].slice(0, PAGE_SIZE)
      );
      setNotice(`Supplier ${resolvedSupplier.companyName || resolvedSupplier.id} saved.`);
      return resolvedSupplier;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function handleSupplierDelete(deletedSupplier) {
    if (usingMockSuppliers) {
      setSuppliers((currentRows) => currentRows.filter((row) => row.id !== deletedSupplier.id));
      setSupplierRows((currentRows) => currentRows.filter((row) => row.id !== deletedSupplier.id));
      setNotice(`Supplier ${deletedSupplier.companyName || deletedSupplier.id} deleted.`);
      return true;
    }

    try {
      await api.deleteSupplier(deletedSupplier.id);
      setSuppliers((currentRows) => currentRows.filter((row) => row.id !== deletedSupplier.id));
      setSupplierRows((currentRows) => currentRows.filter((row) => row.id !== deletedSupplier.id));
      setNotice(`Supplier ${deletedSupplier.companyName || deletedSupplier.id} deleted.`);
      return true;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function handleCustomerSave(nextCustomer) {
    if (usingMockCustomers) {
      const resolvedCustomer = nextCustomer;

      setCustomers((currentRows) =>
        currentRows.some((row) => `${row.id}` === `${nextCustomer.id}`)
          ? currentRows.map((row) =>
              `${row.id}` === `${nextCustomer.id}` ? resolvedCustomer : row
            )
          : [resolvedCustomer, ...currentRows]
      );
      setCustomerRows((currentRows) =>
        currentRows.some((row) => `${row.id}` === `${nextCustomer.id}`)
          ? currentRows.map((row) =>
              `${row.id}` === `${nextCustomer.id}` ? resolvedCustomer : row
            )
          : [resolvedCustomer, ...currentRows].slice(0, PAGE_SIZE)
      );
      setNotice(`Customer ${resolvedCustomer.companyName || resolvedCustomer.id} saved.`);
      return resolvedCustomer;
    }

    try {
      const exists = customers.some((row) => `${row.id}` === `${nextCustomer.id}`);
      const savedCustomer = exists
        ? await api.updateCustomer(nextCustomer.id, nextCustomer)
        : await api.createCustomer(nextCustomer);
      const resolvedCustomer = savedCustomer || nextCustomer;

      setCustomers((currentRows) =>
        currentRows.some((row) => `${row.id}` === `${nextCustomer.id}`)
          ? currentRows.map((row) =>
              `${row.id}` === `${nextCustomer.id}` ? resolvedCustomer : row
            )
          : [resolvedCustomer, ...currentRows]
      );
      setCustomerRows((currentRows) =>
        currentRows.some((row) => `${row.id}` === `${nextCustomer.id}`)
          ? currentRows.map((row) =>
              `${row.id}` === `${nextCustomer.id}` ? resolvedCustomer : row
            )
          : [resolvedCustomer, ...currentRows].slice(0, PAGE_SIZE)
      );
      setNotice(`Customer ${resolvedCustomer.companyName || resolvedCustomer.id} saved.`);
      return resolvedCustomer;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function handleCustomerDelete(deletedCustomer) {
    if (usingMockCustomers) {
      setCustomers((currentRows) => currentRows.filter((row) => row.id !== deletedCustomer.id));
      setCustomerRows((currentRows) => currentRows.filter((row) => row.id !== deletedCustomer.id));
      setNotice(`Customer ${deletedCustomer.companyName || deletedCustomer.id} deleted.`);
      return true;
    }

    try {
      await api.deleteCustomer(deletedCustomer.id);
      setCustomers((currentRows) => currentRows.filter((row) => row.id !== deletedCustomer.id));
      setCustomerRows((currentRows) => currentRows.filter((row) => row.id !== deletedCustomer.id));
      setNotice(`Customer ${deletedCustomer.companyName || deletedCustomer.id} deleted.`);
      return true;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function handleCategorySave(nextCategory) {
    if (usingMockCategories) {
      const resolvedCategory = nextCategory;

      setCategories((currentRows) =>
        currentRows.some((row) => `${row.id}` === `${nextCategory.id}`)
          ? currentRows.map((row) =>
              `${row.id}` === `${nextCategory.id}` ? resolvedCategory : row
            )
          : [resolvedCategory, ...currentRows]
      );
      setNotice(`Category ${resolvedCategory.name || resolvedCategory.id} saved.`);
      return resolvedCategory;
    }

    try {
      const exists = categories.some((row) => `${row.id}` === `${nextCategory.id}`);
      const savedCategory = exists
        ? await api.updateCategory(nextCategory.id, nextCategory)
        : await api.createCategory(nextCategory);
      const resolvedCategory = savedCategory || nextCategory;

      setCategories((currentRows) =>
        currentRows.some((row) => `${row.id}` === `${nextCategory.id}`)
          ? currentRows.map((row) =>
              `${row.id}` === `${nextCategory.id}` ? resolvedCategory : row
            )
          : [resolvedCategory, ...currentRows]
      );
      setNotice(`Category ${resolvedCategory.name || resolvedCategory.id} saved.`);
      return resolvedCategory;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function handleCategoryDelete(deletedCategory) {
    if (usingMockCategories) {
      setCategories((currentRows) => currentRows.filter((row) => row.id !== deletedCategory.id));
      setNotice(`Category ${deletedCategory.name || deletedCategory.id} deleted.`);
      return true;
    }

    try {
      await api.deleteCategory(deletedCategory.id);
      setCategories((currentRows) => currentRows.filter((row) => row.id !== deletedCategory.id));
      setNotice(`Category ${deletedCategory.name || deletedCategory.id} deleted.`);
      return true;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function handleProductSave(nextProduct) {
    if (usingMockProducts) {
      const resolvedProduct = nextProduct;

      setProducts((currentRows) =>
        currentRows.some((row) => `${row.id}` === `${nextProduct.id}`)
          ? currentRows.map((row) =>
              `${row.id}` === `${nextProduct.id}` ? resolvedProduct : row
            )
          : [resolvedProduct, ...currentRows]
      );
      setProductRows((currentRows) =>
        currentRows.some((row) => `${row.id}` === `${nextProduct.id}`)
          ? currentRows.map((row) =>
              `${row.id}` === `${nextProduct.id}` ? resolvedProduct : row
            )
          : [resolvedProduct, ...currentRows].slice(0, PAGE_SIZE)
      );
      setNotice(`Product ${resolvedProduct.productName || resolvedProduct.id} saved.`);
      return resolvedProduct;
    }

    try {
      const exists = products.some((row) => `${row.id}` === `${nextProduct.id}`);
      const productPayload = buildProductSavePayload(nextProduct);
      const savedProduct = exists
        ? await api.updateProduct(nextProduct.id, productPayload)
        : await api.createProduct(productPayload);
      const resolvedProduct = savedProduct || nextProduct;

      setProducts((currentRows) =>
        currentRows.some((row) => `${row.id}` === `${nextProduct.id}`)
          ? currentRows.map((row) =>
              `${row.id}` === `${nextProduct.id}` ? resolvedProduct : row
            )
          : [resolvedProduct, ...currentRows]
      );
      setProductRows((currentRows) =>
        currentRows.some((row) => `${row.id}` === `${nextProduct.id}`)
          ? currentRows.map((row) =>
              `${row.id}` === `${nextProduct.id}` ? resolvedProduct : row
            )
          : [resolvedProduct, ...currentRows].slice(0, PAGE_SIZE)
      );
      setNotice(`Product ${resolvedProduct.productName || resolvedProduct.id} saved.`);
      return resolvedProduct;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function handleProductDelete(deletedProduct) {
    if (usingMockProducts) {
      setProducts((currentRows) => currentRows.filter((row) => row.id !== deletedProduct.id));
      setProductRows((currentRows) => currentRows.filter((row) => row.id !== deletedProduct.id));
      setNotice(`Product ${deletedProduct.productName || deletedProduct.id} deleted.`);
      return true;
    }

    try {
      await api.deleteProduct(deletedProduct.id);
      setProducts((currentRows) => currentRows.filter((row) => row.id !== deletedProduct.id));
      setProductRows((currentRows) => currentRows.filter((row) => row.id !== deletedProduct.id));
      setNotice(`Product ${deletedProduct.productName || deletedProduct.id} deleted.`);
      return true;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function handleQuotationSave(nextQuotation) {
    setError("");

    if (usingMockQuotations) {
      const resolvedQuotation = {
        ...nextQuotation,
        id: nextQuotation.id || `quotation-${Date.now()}`,
      };

      setQuotations((currentRows) =>
        currentRows.some((row) => `${row.id}` === `${resolvedQuotation.id}`)
          ? currentRows.map((row) =>
              `${row.id}` === `${resolvedQuotation.id}` ? resolvedQuotation : row
            )
          : [resolvedQuotation, ...currentRows]
      );
      setNotice(`Quotation ${resolvedQuotation.reference_no || resolvedQuotation.id} saved.`);
      return resolvedQuotation;
    }

    try {
      const isMockQuotation = isMockQuotationId(nextQuotation.id);
      const exists =
        nextQuotation.id &&
        !isMockQuotation &&
        quotations.some((row) => `${row.id}` === `${nextQuotation.id}`);
      const savedQuotation = exists
        ? await api.updateQuotation(nextQuotation.id, nextQuotation)
        : await api.createQuotation(removeMockQuotationId(nextQuotation));
      const resolvedQuotation = savedQuotation || nextQuotation;

      setQuotations((currentRows) =>
        mergeSavedQuotation(currentRows, nextQuotation, resolvedQuotation, exists)
      );
      setNotice(`Quotation ${resolvedQuotation.reference_no || resolvedQuotation.id} saved.`);
      return resolvedQuotation;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function handleQuotationDelete(deletedQuotation) {
    setError("");

    if (usingMockQuotations || isMockQuotationId(deletedQuotation.id)) {
      setQuotations((currentRows) =>
        currentRows.filter((row) => row.id !== deletedQuotation.id)
      );
      setNotice(`Quotation ${deletedQuotation.reference_no || deletedQuotation.id} deleted.`);
      return true;
    }

    try {
      await api.deleteQuotation(deletedQuotation.id);
      setQuotations((currentRows) =>
        currentRows.filter((row) => row.id !== deletedQuotation.id)
      );
      setNotice(`Quotation ${deletedQuotation.reference_no || deletedQuotation.id} deleted.`);
      return true;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function handleBillingNoteCreate(nextBillingNote) {
    setError("");

    if (usingMockBillingNotes) {
      const resolved = {
        ...nextBillingNote,
        id: nextBillingNote.id || `billing-note-mock-${Date.now()}`,
      };
      setBillingNotes((rows) => [resolved, ...rows]);
      setBillingNoteRows((rows) => [resolved, ...rows].slice(0, PAGE_SIZE));
      setNotice(`Billing note ${resolved.reference_no || resolved.id} created.`);
      return resolved;
    }

    try {
      const saved = await api.createBillingNote(buildBillingNotePayload(nextBillingNote));
      setBillingNotes((rows) => [saved, ...rows]);
      setBillingNoteRows((rows) => [saved, ...rows].slice(0, PAGE_SIZE));
      setNotice(`Billing note ${saved.reference_no || saved.id} created.`);
      await refreshBillingNoteEligibility();
      return saved;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function handleBillingNoteUpdate(updated) {
    setError("");

    if (usingMockBillingNotes) {
      setBillingNotes((rows) =>
        rows.map((row) => (row.id === updated.id ? updated : row))
      );
      setBillingNoteRows((rows) =>
        rows.map((row) => (row.id === updated.id ? updated : row))
      );
      setNotice(`Billing note ${updated.reference_no || updated.id} updated.`);
      return updated;
    }

    try {
      const saved = await api.updateBillingNote(
        updated.id,
        buildBillingNotePayload(updated)
      );
      setBillingNotes((rows) =>
        rows.map((row) => (row.id === updated.id ? saved : row))
      );
      setBillingNoteRows((rows) =>
        rows.map((row) => (row.id === updated.id ? saved : row))
      );
      setNotice(`Billing note ${saved.reference_no || saved.id} updated.`);
      await refreshBillingNoteEligibility();
      return saved;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function handleBillingNoteDelete(deleted) {
    setError("");

    if (usingMockBillingNotes) {
      setBillingNotes((rows) => rows.filter((row) => row.id !== deleted.id));
      setBillingNoteRows((rows) => rows.filter((row) => row.id !== deleted.id));
      setNotice(`Billing note ${deleted.reference_no || deleted.id} deleted.`);
      return true;
    }

    try {
      await api.deleteBillingNote(deleted.id);
      setBillingNotes((rows) => rows.filter((row) => row.id !== deleted.id));
      setBillingNoteRows((rows) => rows.filter((row) => row.id !== deleted.id));
      setNotice(`Billing note ${deleted.reference_no || deleted.id} deleted.`);
      await refreshBillingNoteEligibility();
      return true;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function handlePaymentBatchCreate(nextBatch) {
    setError("");

    if (usingMockPaymentBatches) {
      const resolved = {
        ...nextBatch,
        id: nextBatch.id || `payment-batch-mock-${Date.now()}`,
      };
      setPaymentBatches((rows) => [resolved, ...rows]);
      setPaymentBatchRows((rows) => [resolved, ...rows].slice(0, PAGE_SIZE));
      setNotice(`Payment batch ${resolved.reference_no || resolved.id} created.`);
      return resolved;
    }

    try {
      const saved = await api.createPaymentBatch(buildPaymentBatchPayload(nextBatch));
      setPaymentBatches((rows) => [saved, ...rows]);
      setPaymentBatchRows((rows) => [saved, ...rows].slice(0, PAGE_SIZE));
      setNotice(`Payment batch ${saved.reference_no || saved.id} created.`);
      await refreshPaymentBatchEligibility();
      return saved;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function handlePaymentBatchUpdate(updated) {
    setError("");

    if (usingMockPaymentBatches) {
      setPaymentBatches((rows) =>
        rows.map((row) => (row.id === updated.id ? updated : row))
      );
      setPaymentBatchRows((rows) =>
        rows.map((row) => (row.id === updated.id ? updated : row))
      );
      setNotice(`Payment batch ${updated.reference_no || updated.id} updated.`);
      return updated;
    }

    try {
      const saved = await api.updatePaymentBatch(
        updated.id,
        buildPaymentBatchPayload(updated)
      );
      setPaymentBatches((rows) =>
        rows.map((row) => (row.id === updated.id ? saved : row))
      );
      setPaymentBatchRows((rows) =>
        rows.map((row) => (row.id === updated.id ? saved : row))
      );
      setNotice(`Payment batch ${saved.reference_no || saved.id} updated.`);
      await refreshPaymentBatchEligibility();
      return saved;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function handlePaymentBatchDelete(deleted) {
    setError("");

    if (usingMockPaymentBatches) {
      setPaymentBatches((rows) => rows.filter((row) => row.id !== deleted.id));
      setPaymentBatchRows((rows) => rows.filter((row) => row.id !== deleted.id));
      setNotice(`Payment batch ${deleted.reference_no || deleted.id} deleted.`);
      return true;
    }

    try {
      await api.deletePaymentBatch(deleted.id);
      setPaymentBatches((rows) => rows.filter((row) => row.id !== deleted.id));
      setPaymentBatchRows((rows) => rows.filter((row) => row.id !== deleted.id));
      setNotice(`Payment batch ${deleted.reference_no || deleted.id} deleted.`);
      await refreshPaymentBatchEligibility();
      return true;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function handleCreditNoteCreate(nextCreditNote) {
    setError("");

    if (usingMockCreditNotes) {
      const resolved = {
        ...nextCreditNote,
        id: nextCreditNote.id || `credit-note-mock-${Date.now()}`,
      };
      setCreditNotes((rows) => [resolved, ...rows]);
      setCreditNoteRows((rows) => [resolved, ...rows].slice(0, PAGE_SIZE));
      setNotice(`Credit note ${resolved.reference_no || resolved.id} created.`);
      return resolved;
    }

    try {
      const saved = await api.createCreditNote(buildCreditNotePayload(nextCreditNote));
      setCreditNotes((rows) => [saved, ...rows]);
      setCreditNoteRows((rows) => [saved, ...rows].slice(0, PAGE_SIZE));
      setNotice(`Credit note ${saved.reference_no || saved.id} created.`);
      await refreshCreditNoteEligibility();
      await loadBillingNotePage();
      return saved;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function handleCreditNoteUpdate(updated) {
    setError("");

    if (usingMockCreditNotes) {
      setCreditNotes((rows) =>
        rows.map((row) => (row.id === updated.id ? updated : row))
      );
      setCreditNoteRows((rows) =>
        rows.map((row) => (row.id === updated.id ? updated : row))
      );
      setNotice(`Credit note ${updated.reference_no || updated.id} updated.`);
      return updated;
    }

    try {
      const saved = await api.updateCreditNote(
        updated.id,
        buildCreditNotePayload(updated)
      );
      setCreditNotes((rows) =>
        rows.map((row) => (row.id === updated.id ? saved : row))
      );
      setCreditNoteRows((rows) =>
        rows.map((row) => (row.id === updated.id ? saved : row))
      );
      setNotice(`Credit note ${saved.reference_no || saved.id} updated.`);
      await refreshCreditNoteEligibility();
      await loadBillingNotePage();
      return saved;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function handleCreditNoteDelete(deleted) {
    setError("");

    if (usingMockCreditNotes) {
      setCreditNotes((rows) => rows.filter((row) => row.id !== deleted.id));
      setCreditNoteRows((rows) => rows.filter((row) => row.id !== deleted.id));
      setNotice(`Credit note ${deleted.reference_no || deleted.id} deleted.`);
      return true;
    }

    try {
      await api.deleteCreditNote(deleted.id);
      setCreditNotes((rows) => rows.filter((row) => row.id !== deleted.id));
      setCreditNoteRows((rows) => rows.filter((row) => row.id !== deleted.id));
      setNotice(`Credit note ${deleted.reference_no || deleted.id} deleted.`);
      await refreshCreditNoteEligibility();
      await loadBillingNotePage();
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
            {tabs.map((tab) => {
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
              aria-label="Close notice"
              onClick={() => setNotice("")}
            >
              X
            </button>
          </div>
        ) : null}
        {error ? <div className="error-banner">{error}</div> : null}

        {loading ? (
          <section className="section-card loading-card">
            <p>Loading inventory data...</p>
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
                products={activeProducts}
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
                products={activeProducts}
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
                products={activeProducts}
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
