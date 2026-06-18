import ChatPanel from "../components/ChatPanel";
import Dashboard from "../components/Dashboard";
import CustomerPage from "../components/CustomerPage";
import PurchaseHistoryPage from "../components/PurchaseHistoryPage";
import SalesHistoryPage from "../components/SalesHistoryPage";
import SupplierPage from "../components/SupplierPage";
import ProductsPage from "../components/ProductsPage";
import CategoryPage from "../components/CategoryPage";
import InventoryPage from "../components/InventoryPage";
import QuotationPage from "../components/QuotationPage";
import BillingNotePage from "../components/BillingNotePage";
import PaymentBatchPage from "../components/PaymentBatchPage";
import CreditNotePage from "../components/CreditNotePage";
import SettingsPage from "../components/SettingsPage";

function ActiveTabContent({
  activeTab,
  dashboard,
  dashboardIntent,
  onDashboardNavigate,
  onConsumeIntent,
  products,
  productRows,
  productPagination,
  categories,
  suppliers,
  supplierRows,
  supplierPagination,
  customers,
  customerRows,
  customerPagination,
  purchases,
  purchaseRows,
  purchasePagination,
  sales,
  saleRows,
  salePagination,
  quotations,
  billingNotes,
  billingNoteRows,
  billingNotePagination,
  billingNoteEligibleSales,
  billingNoteSummary,
  billingNoteNextReferenceNo,
  paymentBatches,
  paymentBatchRows,
  paymentBatchPagination,
  paymentBatchEligiblePurchases,
  paymentBatchSummary,
  paymentBatchNextReferenceNo,
  creditNotes,
  creditNoteRows,
  creditNotePagination,
  creditNoteEligibleSales,
  creditNoteNextReferenceNo,
  usingMockPurchases,
  usingMockSales,
  loadSupplierPage,
  loadCustomerPage,
  loadProductPage,
  loadPurchasePage,
  loadSalePage,
  loadBillingNotePage,
  loadPaymentBatchPage,
  loadCreditNotePage,
  handleLoadProductHistory,
  handlePurchaseCreateFromHistory,
  handlePurchaseStatusChange,
  handlePurchaseItemStatusChange,
  handlePurchaseUpdate,
  handlePurchaseDelete,
  handleQuotationSave,
  handleQuotationDelete,
  handleQuotationPurchaseCreate,
  handleSalesCreateFromHistory,
  handleSaleStatusChange,
  handleSaleUpdate,
  handleSaleDelete,
  showWarning,
  handleBillingNoteCreate,
  handleBillingNoteUpdate,
  handleBillingNoteDelete,
  handlePaymentBatchCreate,
  handlePaymentBatchUpdate,
  handlePaymentBatchDelete,
  handleCreditNoteCreate,
  handleCreditNoteUpdate,
  handleCreditNoteDelete,
  handleSupplierSave,
  handleSupplierDelete,
  handleCustomerSave,
  handleCustomerDelete,
  handleProductSave,
  handleProductReorderUpdate,
  handleProductDelete,
  handleCategorySave,
  handleCategoryDelete,
  messages,
  handleAskChat,
  chatBusy,
  onViewPurchasesTab,
}) {
  if (activeTab === "dashboard" && dashboard) {
    return (
      <Dashboard
        dashboard={dashboard}
        sales={sales}
        purchases={purchases}
        quotations={quotations}
        products={products}
        suppliers={suppliers}
        onNavigate={onDashboardNavigate}
        onUpdateReorderLevel={handleProductReorderUpdate}
      />
    );
  }

  if (activeTab === "inventory") {
    return (
      <InventoryPage
        dashboard={dashboard}
        billingNotes={billingNotes}
        paymentBatches={paymentBatches}
        sales={sales}
        purchases={purchases}
        onLoadProductHistory={handleLoadProductHistory}
        onNavigate={onDashboardNavigate}
        focusProductId={dashboardIntent?.tab === "inventory" ? dashboardIntent.focusProductId : null}
        onIntentConsumed={onConsumeIntent}
      />
    );
  }

  if (activeTab === "purchase-history") {
    return (
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
        prefillDraft={dashboardIntent?.tab === "purchase-history" ? dashboardIntent.prefill : null}
        focusPurchaseId={dashboardIntent?.tab === "purchase-history" ? dashboardIntent.focusId : null}
        statusFilter={dashboardIntent?.tab === "purchase-history" ? dashboardIntent.statusFilter : null}
        onIntentConsumed={onConsumeIntent}
      />
    );
  }

  if (activeTab === "quotations") {
    return (
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
        onViewPurchases={onViewPurchasesTab}
        onCreateSale={handleSalesCreateFromHistory}
        openNewSignal={dashboardIntent?.tab === "quotations" ? dashboardIntent.openNew : null}
        onIntentConsumed={onConsumeIntent}
      />
    );
  }

  if (activeTab === "sales-history") {
    return (
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
        focusSaleId={dashboardIntent?.tab === "sales-history" ? dashboardIntent.focusId : null}
        statusFilter={dashboardIntent?.tab === "sales-history" ? dashboardIntent.statusFilter : null}
        onIntentConsumed={onConsumeIntent}
      />
    );
  }

  if (activeTab === "billing-notes") {
    return (
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
        focusId={dashboardIntent?.tab === "billing-notes" ? dashboardIntent.focusId : null}
        onIntentConsumed={onConsumeIntent}
      />
    );
  }

  if (activeTab === "payment-batches") {
    return (
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
        focusId={dashboardIntent?.tab === "payment-batches" ? dashboardIntent.focusId : null}
        onIntentConsumed={onConsumeIntent}
      />
    );
  }

  if (activeTab === "credit-notes") {
    return (
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
    );
  }

  if (activeTab === "suppliers") {
    return (
      <SupplierPage
        suppliers={supplierRows}
        allSuppliers={suppliers}
        pagination={supplierPagination}
        onPageRequest={loadSupplierPage}
        onSaveSupplier={handleSupplierSave}
        onDeleteSupplier={handleSupplierDelete}
      />
    );
  }

  if (activeTab === "customers") {
    return (
      <CustomerPage
        customers={customerRows}
        allCustomers={customers}
        pagination={customerPagination}
        onPageRequest={loadCustomerPage}
        onSaveCustomer={handleCustomerSave}
        onDeleteCustomer={handleCustomerDelete}
      />
    );
  }

  if (activeTab === "products") {
    return (
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
        focusProductId={dashboardIntent?.tab === "products" ? dashboardIntent.focusProductId : null}
        onIntentConsumed={onConsumeIntent}
      />
    );
  }

  if (activeTab === "categories") {
    return (
      <CategoryPage
        categories={categories}
        products={products}
        onSaveCategory={handleCategorySave}
        onDeleteCategory={handleCategoryDelete}
      />
    );
  }

  if (activeTab === "chat") {
    return <ChatPanel messages={messages} onAsk={handleAskChat} busy={chatBusy} />;
  }

  if (activeTab === "settings") {
    return <SettingsPage />;
  }

  return null;
}

export default ActiveTabContent;
