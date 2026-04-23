import { useEffect, useState } from "react";
import { api } from "./api";
import ChatPanel from "./components/ChatPanel";
import Dashboard from "./components/Dashboard";
import CustomerPage from "./components/CustomerPage";
import { mockDashboard, mockPurchases, mockSales } from "./mockData";
import PurchaseHistoryPage from "./components/PurchaseHistoryPage";
import SalesHistoryPage from "./components/SalesHistoryPage";
import SupplierPage from "./components/SupplierPage";
import ProductsPage from "./components/ProductsPage";
import CategoryPage from "./components/CategoryPage";
import { applyPurchaseStatusToItems } from "./purchaseStatus";
import { applySaleStatusToItems } from "./saleStatus";

function getCollectionRows(result, fallback = []) {
  if (Array.isArray(result)) {
    return result;
  }

  if (Array.isArray(result?.results)) {
    return result.results;
  }

  return fallback;
}

const tabs = [
  {
    id: "dashboard",
    label: "Dashboard",
    shortLabel: "D",
    description: "Overview, stock health, and daily movement.",
  },
  {
    id: "purchase-history",
    label: "Purchases",
    shortLabel: "PH",
    description: "Search and review purchase records.",
  },
  {
    id: "sales-history",
    label: "Sales",
    shortLabel: "SH",
    description: "Search and review sales records.",
  },
  {
    id: "suppliers",
    label: "Supplier",
    shortLabel: "SP",
    description: "Supplier contact records, branches, and shipping details.",
  },
  {
    id: "customers",
    label: "Customer",
    shortLabel: "CU",
    description: "Customer contact records, branches, billing notes, and shipping details.",
  },
  {
    id: "products",
    label: "Products",
    shortLabel: "PR",
    description: "Product catalog with pricing, stock levels, and supplier discounts.",
  },
  {
    id: "categories",
    label: "Categories",
    shortLabel: "CA",
    description: "Manage product categories and prevent duplicate names.",
  },
  {
    id: "chat",
    label: "AI Chat",
    shortLabel: "A",
    description: "Ask inventory questions and review quick insights.",
  },
];

function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [dashboard, setDashboard] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [usingMockPurchases, setUsingMockPurchases] = useState(false);
  const [sales, setSales] = useState([]);
  const [usingMockSales, setUsingMockSales] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Ask about low stock, recent sales, or which products need restocking.",
    },
  ]);

  async function loadData() {
    setLoading(true);
    setError("");

    const results = await Promise.allSettled([
      api.getDashboard(),
      api.getSuppliers(),
      api.getCustomers(),
      api.getCategories(),
      api.getProducts(),
      api.getPurchases(),
      api.getSales(),
    ]);

    const [
      dashboardResult,
      supplierResult,
      customerResult,
      categoryResult,
      productResult,
      purchaseResult,
      salesResult,
    ] = results;
    const failures = [];

    if (dashboardResult.status === "fulfilled") {
      setDashboard(dashboardResult.value);
    } else {
      setDashboard(mockDashboard);
      failures.push("dashboard");
    }

    if (supplierResult.status === "fulfilled") {
      setSuppliers(getCollectionRows(supplierResult.value));
    } else {
      setSuppliers([]);
      failures.push("suppliers");
    }

    if (customerResult.status === "fulfilled") {
      setCustomers(getCollectionRows(customerResult.value));
    } else {
      setCustomers([]);
      failures.push("customers");
    }

    if (categoryResult.status === "fulfilled") {
      setCategories(getCollectionRows(categoryResult.value));
    } else {
      setCategories([]);
      failures.push("categories");
    }

    if (productResult.status === "fulfilled") {
      setProducts(getCollectionRows(productResult.value));
    } else {
      setProducts([]);
      failures.push("products");
    }

    if (purchaseResult.status === "fulfilled") {
      setPurchases(getCollectionRows(purchaseResult.value));
      setUsingMockPurchases(false);
    } else {
      setPurchases(mockPurchases);
      setUsingMockPurchases(true);
      failures.push("purchases");
    }

    if (salesResult.status === "fulfilled") {
      setSales(getCollectionRows(salesResult.value));
      setUsingMockSales(false);
    } else {
      setSales(mockSales);
      setUsingMockSales(true);
      failures.push("sales");
    }

    if (failures.length) {
      setError(
        failures.includes("dashboard")
          ? "Backend not connected. Showing mock dashboard data."
          : "Some backend data is unavailable."
      );
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  function handleTabSelect(tabId) {
    setActiveTab(tabId);
  }

  async function handlePurchaseCreateFromHistory(formData) {
    await api.createPurchase(formData);
    setNotice("Purchase transaction saved.");
    setActiveTab("purchase-history");
    await loadData();
  }

  async function handleSalesCreateFromHistory(formData) {
    await api.createSale(formData);
    setNotice("Sales transaction saved.");
    setActiveTab("sales-history");
    await loadData();
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

  function handlePurchaseItemStatusChange(updatedPurchase) {
    if (usingMockPurchases) {
      setPurchases((currentRows) =>
        currentRows.map((row) => (row.id === updatedPurchase.id ? updatedPurchase : row))
      );
      setNotice(`Purchase ${updatedPurchase.reference_no || updatedPurchase.id} updated.`);
      return;
    }

    api
      .updatePurchase(updatedPurchase.id, updatedPurchase)
      .then((savedPurchase) => {
        setPurchases((currentRows) =>
          currentRows.map((row) =>
            row.id === updatedPurchase.id ? savedPurchase || updatedPurchase : row
          )
        );
        setNotice(`Purchase ${updatedPurchase.reference_no || updatedPurchase.id} updated.`);
      })
      .catch((requestError) => {
        setError(requestError.message);
      });
  }

  async function handleSaleStatusChange(saleId, nextStatus) {
    const sale = sales.find((row) => row.id === saleId);

    if (!sale || sale.status === nextStatus) {
      return;
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
      setNotice(`Sale ${sale.reference_no} status updated to ${updatedSale.status}.`);
      return;
    }

    try {
      await api.updateSaleStatus(saleId, nextStatus);
      setNotice(`Sale ${sale.reference_no} status updated to ${nextStatus}.`);
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function handleSaleUpdate(updatedSale) {
    if (usingMockSales) {
      setSales((currentRows) =>
        currentRows.map((row) => (row.id === updatedSale.id ? updatedSale : row))
      );
      setNotice(`Sale ${updatedSale.reference_no || updatedSale.id} updated.`);
      return true;
    }

    try {
      const savedSale = await api.updateSale(updatedSale.id, updatedSale);
      setSales((currentRows) =>
        currentRows.map((row) => (row.id === updatedSale.id ? savedSale || updatedSale : row))
      );
      setNotice(`Sale ${updatedSale.reference_no || updatedSale.id} updated.`);
      return true;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function handlePurchaseUpdate(updatedPurchase) {
    if (usingMockPurchases) {
      setPurchases((currentRows) =>
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
      setNotice(`Purchase ${updatedPurchase.reference_no || updatedPurchase.id} updated.`);
      return true;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function handleSaleDelete(deletedSale) {
    if (usingMockSales) {
      setSales((currentRows) => currentRows.filter((row) => row.id !== deletedSale.id));
      setNotice(`Sale ${deletedSale.reference_no || deletedSale.id} deleted.`);
      return true;
    }

    try {
      await api.deleteSale(deletedSale.id);
      setSales((currentRows) => currentRows.filter((row) => row.id !== deletedSale.id));
      setNotice(`Sale ${deletedSale.reference_no || deletedSale.id} deleted.`);
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
      setNotice(`Purchase ${deletedPurchase.reference_no || deletedPurchase.id} deleted.`);
      return true;
    }

    try {
      await api.deletePurchase(deletedPurchase.id);
      setPurchases((currentRows) =>
        currentRows.filter((row) => row.id !== deletedPurchase.id)
      );
      setNotice(`Purchase ${deletedPurchase.reference_no || deletedPurchase.id} deleted.`);
      return true;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function handleSupplierSave(nextSupplier) {
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
      setNotice(`Supplier ${resolvedSupplier.companyName || resolvedSupplier.id} saved.`);
      return resolvedSupplier;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function handleSupplierDelete(deletedSupplier) {
    try {
      await api.deleteSupplier(deletedSupplier.id);
      setSuppliers((currentRows) => currentRows.filter((row) => row.id !== deletedSupplier.id));
      setNotice(`Supplier ${deletedSupplier.companyName || deletedSupplier.id} deleted.`);
      return true;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function handleCustomerSave(nextCustomer) {
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
      setNotice(`Customer ${resolvedCustomer.companyName || resolvedCustomer.id} saved.`);
      return resolvedCustomer;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function handleCustomerDelete(deletedCustomer) {
    try {
      await api.deleteCustomer(deletedCustomer.id);
      setCustomers((currentRows) => currentRows.filter((row) => row.id !== deletedCustomer.id));
      setNotice(`Customer ${deletedCustomer.companyName || deletedCustomer.id} deleted.`);
      return true;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function handleCategorySave(nextCategory) {
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
    try {
      const exists = products.some((row) => `${row.id}` === `${nextProduct.id}`);
      const savedProduct = exists
        ? await api.updateProduct(nextProduct.id, nextProduct)
        : await api.createProduct(nextProduct);
      const resolvedProduct = savedProduct || nextProduct;

      setProducts((currentRows) =>
        currentRows.some((row) => `${row.id}` === `${nextProduct.id}`)
          ? currentRows.map((row) =>
              `${row.id}` === `${nextProduct.id}` ? resolvedProduct : row
            )
          : [resolvedProduct, ...currentRows]
      );
      setNotice(`Product ${resolvedProduct.productName || resolvedProduct.id} saved.`);
      return resolvedProduct;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function handleProductDelete(deletedProduct) {
    try {
      await api.deleteProduct(deletedProduct.id);
      setProducts((currentRows) => currentRows.filter((row) => row.id !== deletedProduct.id));
      setNotice(`Product ${deletedProduct.productName || deletedProduct.id} deleted.`);
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
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-content">
          <div className="sidebar-top">
            <div className="brand-lockup">
              <div className="brand-mark">IM</div>
              <div>
                <h1>Inventory</h1>
              </div>
            </div>
          </div>

          <nav className="sidebar-nav">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={tab.id === activeTab ? "sidebar-nav-button active" : "sidebar-nav-button"}
                onClick={() => handleTabSelect(tab.id)}
              >
                <span className="sidebar-nav-icon">{tab.shortLabel}</span>
                <span className="sidebar-nav-text">{tab.label}</span>
              </button>
            ))}
          </nav>

          <div className="sidebar-support">
            <button className="secondary-button sidebar-refresh-button" onClick={loadData} type="button">
              Refresh Data
            </button>
          </div>
        </div>
      </aside>

      <main className="main-panel">
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
              <Dashboard
                dashboard={dashboard}
                products={products}
                purchases={purchases}
                sales={sales}
              />
            ) : null}

            {activeTab === "purchase-history" ? (
              <PurchaseHistoryPage
                products={products}
                suppliers={suppliers}
                purchases={purchases}
                onCreatePurchase={handlePurchaseCreateFromHistory}
                onPurchaseStatusChange={handlePurchaseStatusChange}
                onPurchaseItemStatusChange={handlePurchaseItemStatusChange}
                onPurchaseUpdate={handlePurchaseUpdate}
                onPurchaseDelete={handlePurchaseDelete}
              />
            ) : null}

            {activeTab === "sales-history" ? (
              <SalesHistoryPage
                sales={sales}
                products={products}
                customers={customers}
                onCreateSale={handleSalesCreateFromHistory}
                onSaleStatusChange={handleSaleStatusChange}
                onSaleUpdate={handleSaleUpdate}
                onSaleDelete={handleSaleDelete}
              />
            ) : null}

            {activeTab === "suppliers" ? (
              <SupplierPage
                suppliers={suppliers}
                onSaveSupplier={handleSupplierSave}
                onDeleteSupplier={handleSupplierDelete}
              />
            ) : null}

            {activeTab === "customers" ? (
              <CustomerPage
                customers={customers}
                onSaveCustomer={handleCustomerSave}
                onDeleteCustomer={handleCustomerDelete}
              />
            ) : null}

            {activeTab === "products" ? (
              <ProductsPage
                products={products}
                categories={categories}
                purchases={purchases}
                sales={sales}
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
          </>
        )}
      </main>
    </div>
  );
}

export default App;
