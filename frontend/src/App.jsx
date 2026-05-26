import ActiveTabContent from "./app/ActiveTabContent";
import AppShell from "./app/AppShell";
import CreditNotePrompt from "./components/CreditNotePrompt";
import { useAppState } from "./app/useAppState";

function App() {
  const state = useAppState();

  return (
    <>
      <AppShell
        activeTab={state.activeTab}
        sidebarOpen={state.sidebarOpen}
        sidebarCollapsed={state.sidebarCollapsed}
        notice={state.notice}
        error={state.error}
        loading={state.loading}
        onToggleSidebarCollapsed={() => state.setSidebarCollapsed((collapsed) => !collapsed)}
        onCloseSidebar={() => state.setSidebarOpen(false)}
        onOpenSidebar={() => state.setSidebarOpen(true)}
        onSelectTab={state.handleTabSelect}
        onCloseNotice={() => state.setNotice("")}
        onCloseError={() => state.setError("")}
        t={state.t}
      >
        <ActiveTabContent
          activeTab={state.activeTab}
          dashboard={state.dashboard}
          products={state.products}
          productRows={state.productRows}
          productPagination={state.productPagination}
          categories={state.categories}
          suppliers={state.suppliers}
          supplierRows={state.supplierRows}
          supplierPagination={state.supplierPagination}
          customers={state.customers}
          customerRows={state.customerRows}
          customerPagination={state.customerPagination}
          purchases={state.purchases}
          purchaseRows={state.purchaseRows}
          purchasePagination={state.purchasePagination}
          sales={state.sales}
          saleRows={state.saleRows}
          salePagination={state.salePagination}
          quotations={state.quotations}
          billingNotes={state.billingNotes}
          billingNoteRows={state.billingNoteRows}
          billingNotePagination={state.billingNotePagination}
          billingNoteEligibleSales={state.billingNoteEligibleSales}
          billingNoteSummary={state.billingNoteSummary}
          billingNoteNextReferenceNo={state.billingNoteNextReferenceNo}
          paymentBatches={state.paymentBatches}
          paymentBatchRows={state.paymentBatchRows}
          paymentBatchPagination={state.paymentBatchPagination}
          paymentBatchEligiblePurchases={state.paymentBatchEligiblePurchases}
          paymentBatchSummary={state.paymentBatchSummary}
          paymentBatchNextReferenceNo={state.paymentBatchNextReferenceNo}
          creditNotes={state.creditNotes}
          creditNoteRows={state.creditNoteRows}
          creditNotePagination={state.creditNotePagination}
          creditNoteEligibleSales={state.creditNoteEligibleSales}
          creditNoteNextReferenceNo={state.creditNoteNextReferenceNo}
          usingMockPurchases={state.usingMockPurchases}
          usingMockSales={state.usingMockSales}
          loadSupplierPage={state.loadSupplierPage}
          loadCustomerPage={state.loadCustomerPage}
          loadProductPage={state.loadProductPage}
          loadPurchasePage={state.loadPurchasePage}
          loadSalePage={state.loadSalePage}
          loadBillingNotePage={state.loadBillingNotePage}
          loadPaymentBatchPage={state.loadPaymentBatchPage}
          loadCreditNotePage={state.loadCreditNotePage}
          handleLoadProductHistory={state.handleLoadProductHistory}
          handlePurchaseCreateFromHistory={state.handlePurchaseCreateFromHistory}
          handlePurchaseStatusChange={state.handlePurchaseStatusChange}
          handlePurchaseItemStatusChange={state.handlePurchaseItemStatusChange}
          handlePurchaseUpdate={state.handlePurchaseUpdate}
          handlePurchaseDelete={state.handlePurchaseDelete}
          handleQuotationSave={state.handleQuotationSave}
          handleQuotationDelete={state.handleQuotationDelete}
          handleQuotationPurchaseCreate={state.handleQuotationPurchaseCreate}
          handleSalesCreateFromHistory={state.handleSalesCreateFromHistory}
          handleSaleStatusChange={state.handleSaleStatusChange}
          handleSaleUpdate={state.handleSaleUpdate}
          handleSaleDelete={state.handleSaleDelete}
          showWarning={state.showWarning}
          handleBillingNoteCreate={state.handleBillingNoteCreate}
          handleBillingNoteUpdate={state.handleBillingNoteUpdate}
          handleBillingNoteDelete={state.handleBillingNoteDelete}
          handlePaymentBatchCreate={state.handlePaymentBatchCreate}
          handlePaymentBatchUpdate={state.handlePaymentBatchUpdate}
          handlePaymentBatchDelete={state.handlePaymentBatchDelete}
          handleCreditNoteCreate={state.handleCreditNoteCreate}
          handleCreditNoteUpdate={state.handleCreditNoteUpdate}
          handleCreditNoteDelete={state.handleCreditNoteDelete}
          handleSupplierSave={state.handleSupplierSave}
          handleSupplierDelete={state.handleSupplierDelete}
          handleCustomerSave={state.handleCustomerSave}
          handleCustomerDelete={state.handleCustomerDelete}
          handleProductSave={state.handleProductSave}
          handleProductDelete={state.handleProductDelete}
          handleCategorySave={state.handleCategorySave}
          handleCategoryDelete={state.handleCategoryDelete}
          messages={state.messages}
          handleAskChat={state.handleAskChat}
          chatBusy={state.chatBusy}
          onViewPurchasesTab={() => state.setActiveTab("purchase-history")}
        />
      </AppShell>

      {state.creditNotePrompt ? (
        <CreditNotePrompt
          sale={state.creditNotePrompt.sale}
          newlyCancelledLines={state.creditNotePrompt.newlyCancelledLines}
          billingNotes={state.billingNotes}
          creditNotes={state.creditNotes}
          nextReferenceNo={state.creditNoteNextReferenceNo}
          onClose={() => state.setCreditNotePrompt(null)}
          onCreate={state.handleCreditNotePromptCreate}
        />
      ) : null}
    </>
  );
}

export default App;
