import { usePurchaseEditFormState } from "./usePurchaseEditFormState";
import PurchaseEditDetailsSection from "./PurchaseEditDetailsSection";
import PurchaseEditLineItemsSection from "./PurchaseEditLineItemsSection";
import PurchaseEditTotalsSection from "./PurchaseEditTotalsSection";
import { defaultSupplierOptions } from "./purchaseHistoryUtils";

function PurchaseEditForm({
  purchase,
  products = [],
  suppliers = defaultSupplierOptions,
  onCancel,
  onSave,
}) {
  const {
    form,
    items,
    vatMode,
    supplierQuery,
    supplierOpen,
    supplierError,
    openProductIndex,
    itemErrors,
    formError,
    filteredSuppliers,
    vatSummary,
    visibleDocuments,
    getFilteredProducts,
    updateForm,
    setVatMode,
    setSupplierQuery,
    setSupplierError,
    setSupplierOpen,
    setOpenProductIndex,
    updateItem,
    updateProductQuery,
    selectProduct,
    addDiscount,
    removeDiscount,
    updateDiscount,
    addItem,
    removeItem,
    selectSupplier,
    handleSubmit,
    vatOptions,
    t,
  } = usePurchaseEditFormState({
    purchase,
    products,
    suppliers,
    onCancel,
    onSave,
  });

  return (
    <section className="section-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("purchaseForm.editEyebrow")}</p>
          <h3>{t("purchaseForm.editTitle")}</h3>
        </div>
        <button className="secondary-button table-action-button" type="button" onClick={onCancel}>
          {t("purchaseForm.cancelButton")}
        </button>
      </div>

      {formError ? <div className="error-banner">{formError}</div> : null}

      <form className="form-layout" onSubmit={handleSubmit}>
        <PurchaseEditDetailsSection
          form={form}
          supplierQuery={supplierQuery}
          supplierOpen={supplierOpen}
          supplierError={supplierError}
          filteredSuppliers={filteredSuppliers}
          visibleDocuments={visibleDocuments}
          onUpdateForm={updateForm}
          onSupplierQueryChange={(value) => {
            setSupplierQuery(value);
            updateForm("supplier_name", "");
            setSupplierError("");
            setSupplierOpen(true);
          }}
          onSupplierOpen={() => setSupplierOpen(true)}
          onSupplierClose={() => {
            window.setTimeout(() => setSupplierOpen(false), 120);
          }}
          onSelectSupplier={selectSupplier}
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

        <PurchaseEditLineItemsSection
          form={form}
          items={items}
          products={products}
          openProductIndex={openProductIndex}
          itemErrors={itemErrors}
          getFilteredProducts={getFilteredProducts}
          onAddItem={addItem}
          onRemoveItem={removeItem}
          onUpdateItem={updateItem}
          onUpdateProductQuery={updateProductQuery}
          onSetOpenProductIndex={setOpenProductIndex}
          onSelectProduct={selectProduct}
          onAddDiscount={addDiscount}
          onRemoveDiscount={removeDiscount}
          onUpdateDiscount={updateDiscount}
        />

        <PurchaseEditTotalsSection
          purchase={purchase}
          vatMode={vatMode}
          vatOptions={vatOptions}
          vatSummary={vatSummary}
          onVatModeChange={setVatMode}
        />

        <div className="supplier-modal-actions">
          <button className="secondary-button" type="button" onClick={onCancel}>
            {t("purchaseForm.cancelButton")}
          </button>
          <button className="primary-button" type="submit">
            {t("purchaseForm.saveButton")}
          </button>
        </div>
      </form>
    </section>
  );
}

export default PurchaseEditForm;
