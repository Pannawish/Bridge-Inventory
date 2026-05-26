import { getProductSku } from "./quotationUtils";
import { useQuotationFormState } from "./useQuotationFormState";
import QuotationFormDetailsSection from "./QuotationFormDetailsSection";
import QuotationLineItemsSection from "./QuotationLineItemsSection";
import QuotationFormTotalsSection from "./QuotationFormTotalsSection";

function QuotationForm({
  quotation = null,
  quotations = [],
  products = [],
  suppliers = [],
  customers = [],
  onSave,
  onCancel,
}) {
  const {
    form,
    items,
    formError,
    openProductIndex,
    itemErrors,
    vatOptions,
    isEditing,
    initialReference,
    customerOptions,
    supplierOptions,
    vatSummary,
    validUntilDate,
    setOpenProductIndex,
    getFilteredProducts,
    getTranslatedProductName,
    updateForm,
    handleQuotationDateChange,
    handleValidUntilDaysChange,
    handleValidUntilDayTypeChange,
    updateItem,
    updateProductQuery,
    selectProduct,
    addItem,
    removeItem,
    addSupplierOption,
    removeSupplierOption,
    updateSupplierOption,
    addDiscount,
    removeDiscount,
    updateDiscount,
    handleSubmit,
    t,
  } = useQuotationFormState({
    quotation,
    quotations,
    products,
    suppliers,
    customers,
    onSave,
    onCancel,
  });

  return (
    <section className="section-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">
            {isEditing ? t("quotation.editEyebrow") : t("quotation.entryEyebrow")}
          </p>
          <h3>{isEditing ? t("quotation.editTitle") : t("quotation.newTitle")}</h3>
        </div>
        {onCancel ? (
          <button className="secondary-button table-action-button" type="button" onClick={onCancel}>
            {t("quotation.cancelButton")}
          </button>
        ) : null}
      </div>

      {formError ? <div className="error-banner">{formError}</div> : null}

      <form className="form-layout" onSubmit={handleSubmit}>
        <QuotationFormDetailsSection
          form={form}
          isEditing={isEditing}
          initialReference={initialReference}
          customerOptions={customerOptions}
          validUntilDate={validUntilDate}
          onUpdateForm={updateForm}
          onQuotationDateChange={handleQuotationDateChange}
          onValidUntilDaysChange={handleValidUntilDaysChange}
          onValidUntilDayTypeChange={handleValidUntilDayTypeChange}
        />

        <QuotationLineItemsSection
          items={items}
          products={products}
          supplierOptions={supplierOptions}
          openProductIndex={openProductIndex}
          itemErrors={itemErrors}
          getFilteredProducts={getFilteredProducts}
          getTranslatedProductName={getTranslatedProductName}
          getProductSku={getProductSku}
          onAddItem={addItem}
          onRemoveItem={removeItem}
          onUpdateItem={updateItem}
          onUpdateProductQuery={updateProductQuery}
          onSetOpenProductIndex={setOpenProductIndex}
          onSelectProduct={selectProduct}
          onAddSupplierOption={addSupplierOption}
          onRemoveSupplierOption={removeSupplierOption}
          onUpdateSupplierOption={updateSupplierOption}
          onAddDiscount={addDiscount}
          onRemoveDiscount={removeDiscount}
          onUpdateDiscount={updateDiscount}
        />

        <QuotationFormTotalsSection
          vatMode={form.vat_mode}
          vatOptions={vatOptions}
          vatSummary={vatSummary}
          radioName={`quotation-vat-mode-${quotation?.id || "new"}`}
          onVatModeChange={(value) => updateForm("vat_mode", value)}
        />

        <div className="supplier-modal-actions">
          {onCancel ? (
            <button className="secondary-button" type="button" onClick={onCancel}>
              {t("quotation.cancelButton")}
            </button>
          ) : null}
          <button className="primary-button" type="submit">
            {isEditing ? t("quotation.saveButton") : t("quotation.createButton")}
          </button>
        </div>
      </form>
    </section>
  );
}

export default QuotationForm;
