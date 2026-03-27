import { useEffect, useState } from "react";
import { api } from "./api";
import ChatPanel from "./components/ChatPanel";
import Dashboard from "./components/Dashboard";
import { mockDashboard, mockPurchases, mockSales } from "./mockData";
import PurchaseForm from "./components/PurchaseForm";
import SalesForm from "./components/SalesForm";
import TransactionTable from "./components/TransactionTable";

const tabs = [
  { id: "dashboard", label: "Dashboard" },
  { id: "purchases", label: "Purchases" },
  { id: "sales", label: "Sales" },
  { id: "chat", label: "AI Chat" },
];

function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [dashboard, setDashboard] = useState(null);
  const [products, setProducts] = useState([]);
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
      api.getProducts(),
      api.getPurchases(),
      api.getSales(),
    ]);

    const [dashboardResult, productResult, purchaseResult, salesResult] = results;
    const failures = [];

    if (dashboardResult.status === "fulfilled") {
      setDashboard(dashboardResult.value);
    } else {
      setDashboard(mockDashboard);
      failures.push("dashboard");
    }

    if (productResult.status === "fulfilled") {
      setProducts(productResult.value.results || []);
    } else {
      setProducts([]);
      failures.push("products");
    }

    if (purchaseResult.status === "fulfilled") {
      setPurchases(purchaseResult.value.results || []);
      setUsingMockPurchases(false);
    } else {
      setPurchases(mockPurchases);
      setUsingMockPurchases(true);
      failures.push("purchases");
    }

    if (salesResult.status === "fulfilled") {
      setSales(salesResult.value.results || []);
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

  async function handlePurchaseCreate(formData) {
    await api.createPurchase(formData);
    setNotice("Purchase transaction saved.");
    setActiveTab("purchases");
    await loadData();
  }

  async function handleSalesCreate(formData) {
    await api.createSale(formData);
    setNotice("Sales transaction saved.");
    setActiveTab("sales");
    await loadData();
  }

  async function handlePurchaseStatusChange(purchaseId, nextStatus) {
    const purchase = purchases.find((row) => row.id === purchaseId);

    if (!purchase || purchase.status === nextStatus) {
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
      setPurchases((currentRows) =>
        currentRows.map((row) =>
          row.id === purchaseId ? { ...row, status: nextStatus } : row
        )
      );
      setNotice(`Purchase ${purchase.reference_no} status updated to ${nextStatus}.`);
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
      setSales((currentRows) =>
        currentRows.map((row) => (row.id === saleId ? { ...row, status: nextStatus } : row))
      );
      setNotice(`Sale ${sale.reference_no} status updated to ${nextStatus}.`);
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
        <div>
          <p className="sidebar-label">Simple Project</p>
          <h1>Inventory Management</h1>
          <p className="sidebar-copy">
            Demo with React, Django, and a
            read-only AI helper.
          </p>
        </div>
        {/*
        <div className="sidebar-note">
          <h3>Main Objectives</h3>
          <ul>
            <li>Record purchase and sales transactions with status and files.</li>
            <li>Create product records directly during purchase entry.</li>
            <li>Let users query the system in natural language.</li>
          </ul>
        </div>
        */}

        <button className="secondary-button" onClick={loadData} type="button">
          Refresh Data
        </button>
      </aside>

      <main className="main-panel">
        <header className="hero-panel">
          <div>
            <p className="eyebrow">Dashboard</p>
            <h2>Keep the workflow small, visible, and easy to explain.</h2>
            <p className="hero-copy">
              Stock is calculated from purchase and sales history, and
              prediction uses a simple 30-day sales average.
            </p>
          </div>

          {notice ? <div className="notice-banner">{notice}</div> : null}
        </header>

        {error ? <div className="error-banner">{error}</div> : null}

        <nav className="tab-bar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={tab.id === activeTab ? "tab-button active" : "tab-button"}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {loading ? (
          <section className="section-card loading-card">
            <p>Loading inventory data...</p>
          </section>
        ) : (
          <>
            {activeTab === "dashboard" && dashboard ? (
              <Dashboard dashboard={dashboard} />
            ) : null}

            {activeTab === "purchases" ? (
              <div className="stack-layout">
                <PurchaseForm onSubmit={handlePurchaseCreate} />
                <TransactionTable
                  rows={purchases}
                  type="purchase"
                  onPurchaseStatusChange={handlePurchaseStatusChange}
                />
              </div>
            ) : null}

            {activeTab === "sales" ? (
              <div className="stack-layout">
                <SalesForm products={products} onSubmit={handleSalesCreate} />
                <TransactionTable
                  rows={sales}
                  type="sale"
                  onSaleStatusChange={handleSaleStatusChange}
                />
              </div>
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
