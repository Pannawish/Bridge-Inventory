import { useSalesEditFormState } from "./useSalesEditFormState";
import SalesEditDetailsSection from "./SalesEditDetailsSection";
import SalesEditLineItemsSection from "./SalesEditLineItemsSection";
import SalesEditTotalsSection from "./SalesEditTotalsSection";
import { defaultCustomerOptions } from "./salesHistoryUtils";

function SalesEditForm({
  sale,
  products,
  customers = defaultCustomerOptions,
  purchases = [],
  sales = [],
  enableStockValidation = true,
  onCancel,
  onSave,
}) {
  const {
    form,
    items,
    vatMode,
    customerQuery,
    customerOpen,
    customerError,
    formError,
    filteredCustomers,
    productOptions,
    stockLayersByItemKey,
    vatSummary,
    saleStockMessage,
    visibleDocuments,
    updateForm,
    setVatMode,
    setCustomerQuery,
    setCustomerError,
    setCustomerOpen,
    handleStatusChange,
    selectCustomer,
    updateItem,
    updateItemProduct,
    updateAllocationMode,
    addAllocation,
    removeAllocation,
    updateAllocation,
    addDiscount,
    removeDiscount,
    updateDiscount,
    addItem,
    removeItem,
    handleSubmit,
    vatOptions,
    t,
  } = useSalesEditFormState({
    sale,
    products,
    customers,
    purchases,
    sales,
    enableStockValidation,
    onCancel,
    onSave,
  });

  return (
    <section className="section-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("salesForm.editEyebrow")}</p>
          <h3>{t("salesForm.editTitle")}</h3>
        </div>
        <button className="secondary-button table-action-button" type="button" onClick={onCancel}>
          {t("salesForm.cancelButton")}
        </button>
      </div>

      {formError ? <div className="error-banner">{formError}</div> : null}

      <form className="form-layout" onSubmit={handleSubmit}>
        <SalesEditDetailsSection
          sale={sale}
          form={form}
          customerQuery={customerQuery}
          customerOpen={customerOpen}
          customerError={customerError}
          filteredCustomers={filteredCustomers}
          saleStockMessage={saleStockMessage}
          visibleDocuments={visibleDocuments}
          paymentDate={form.payment_date}
          onUpdateForm={updateForm}
          onCustomerQueryChange={(value) => {
            setCustomerQuery(value);
            updateForm("customer_name", "");
            setCustomerError("");
            setCustomerOpen(true);
          }}
          onCustomerOpen={() => setCustomerOpen(true)}
          onCustomerClose={() => {
            window.setTimeout(() => setCustomerOpen(false), 120);
          }}
          onSelectCustomer={selectCustomer}
          onStatusChange={handleStatusChange}
          onPaymentTermTypeChange={(next) => {
            updateForm("payment_term_type", next);
            if (next === "cash") {
              updateForm("payment_term_days", "");
            }
          }}
          onPaymentTermDaysChange={(value) => updateForm("payment_term_days", value)}
          onAddDocuments={(documents) => {
            updateForm("new_documents", [...form.new_documents, ...documents]);
            updateForm("remove_document", false);
          }}
          onDeleteVisibleDocument={(documentId) =>
            updateForm("remove_document_ids", [...form.remove_document_ids, documentId])
          }
          onRemoveNewDocument={(documentIndex) =>
            updateForm(
              "new_documents",
              form.new_documents.filter((_, index) => index !== documentIndex)
            )
          }
          onRemoveAllDocuments={() => {
            updateForm(
              "remove_document_ids",
              visibleDocuments.map((document) => document.id)
            );
            updateForm("new_documents", []);
          }}
          onUndoRemoveDocuments={() => updateForm("remove_document_ids", [])}
        />

        <SalesEditLineItemsSection
          sale={sale}
          items={items}
          products={products}
          productOptions={productOptions}
          stockLayersByItemKey={stockLayersByItemKey}
          onAddItem={addItem}
          onRemoveItem={removeItem}
          onUpdateItem={updateItem}
          onUpdateItemProduct={updateItemProduct}
          onUpdateAllocationMode={updateAllocationMode}
          onAddAllocation={addAllocation}
          onRemoveAllocation={removeAllocation}
          onUpdateAllocation={updateAllocation}
          onAddDiscount={addDiscount}
          onRemoveDiscount={removeDiscount}
          onUpdateDiscount={updateDiscount}
        />

        <SalesEditTotalsSection
          sale={sale}
          vatMode={vatMode}
          vatOptions={vatOptions}
          vatSummary={vatSummary}
          onVatModeChange={setVatMode}
        />

        <div className="supplier-modal-actions">
          <button className="secondary-button" type="button" onClick={onCancel}>
            {t("salesForm.cancelButton")}
          </button>
          <button className="primary-button" type="submit">
            {t("salesForm.saveButton")}
          </button>
        </div>
      </form>
    </section>
  );
}

export default SalesEditForm;
