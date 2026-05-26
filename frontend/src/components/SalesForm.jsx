import AllItemsDiscountControl from "./AllItemsDiscountControl";
import SalesFormDetailsSection from "./sales/SalesFormDetailsSection";
import SalesLineItemsSection from "./sales/SalesLineItemsSection";
import SalesFormTotalsSection from "./sales/SalesFormTotalsSection";
import { defaultCustomerOptions } from "./sales/salesFormUtils";
import useSalesFormState from "./sales/useSalesFormState";
import { useLanguage } from "../i18n/LanguageContext";

function SalesForm({
  products,
  customers = defaultCustomerOptions,
  suppliers = [],
  purchases = [],
  sales = [],
  enableStockValidation = true,
  onSubmit,
  onCancel = null,
  prefill = null,
}) {
  const { t } = useLanguage();
  const {
    nextReferenceNo,
    form,
    items,
    vatMode,
    setVatMode,
    allItemsDiscountEnabled,
    setAllItemsDiscountEnabled,
    allItemsDiscountValue,
    setAllItemsDiscountValue,
    customerQuery,
    setCustomerQuery,
    customerOpen,
    setCustomerOpen,
    customerError,
    setCustomerError,
    statusError,
    openProductIndex,
    setOpenProductIndex,
    itemErrors,
    draggedItemIndex,
    activeAllItemsDiscount,
    saleStockMessage,
    paymentDate,
    vatOptions,
    vatSummary,
    updateForm,
    handleStatusChange,
    updateItem,
    updateProductQuery,
    selectProduct,
    updateSupplier,
    addDiscount,
    removeDiscount,
    updateDiscount,
    addItem,
    removeItem,
    handleItemDragStart,
    handleItemDragOver,
    handleItemDrop,
    handleItemDragEnd,
    selectCustomer,
    handleSubmit,
  } = useSalesFormState({
    products,
    customers,
    purchases,
    sales,
    enableStockValidation,
    onSubmit,
    prefill,
  });

  return (
    <section className="section-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("salesForm.eyebrow")}</p>
          <h3>{t("salesForm.newTitle")}</h3>
        </div>
        {onCancel ? (
          <button className="secondary-button" type="button" onClick={onCancel}>
            {t("salesForm.closeButton")}
          </button>
        ) : null}
      </div>

      <form className="form-layout" onSubmit={handleSubmit}>
        <SalesFormDetailsSection
          form={form}
          nextReferenceNo={nextReferenceNo}
          customers={customers}
          customerQuery={customerQuery}
          customerOpen={customerOpen}
          customerError={customerError}
          statusError={statusError}
          saleStockMessage={saleStockMessage}
          paymentDate={paymentDate}
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
          onPaymentTermTypeChange={(value) => {
            setForm((currentForm) => ({
              ...currentForm,
              payment_term_type: value,
              payment_term_days: value === "debit" ? "" : currentForm.payment_term_days,
            }));
          }}
          onPaymentTermDaysChange={(value) =>
            setForm((currentForm) => ({ ...currentForm, payment_term_days: value }))
          }
          onStatusChange={handleStatusChange}
          onDocumentsAdd={(documents) =>
            updateForm("documents", [...form.documents, ...documents])
          }
          onDocumentRemove={(documentIndex) =>
            updateForm(
              "documents",
              form.documents.filter((_, index) => index !== documentIndex)
            )
          }
        />

        <SalesLineItemsSection
          items={items}
          products={products}
          suppliers={suppliers}
          activeAllItemsDiscount={activeAllItemsDiscount}
          openProductIndex={openProductIndex}
          itemErrors={itemErrors}
          draggedItemIndex={draggedItemIndex}
          onAddItem={addItem}
          onRemoveItem={removeItem}
          onUpdateItem={updateItem}
          onUpdateProductQuery={updateProductQuery}
          onSetOpenProductIndex={setOpenProductIndex}
          onSelectProduct={selectProduct}
          onUpdateSupplier={updateSupplier}
          onAddDiscount={addDiscount}
          onRemoveDiscount={removeDiscount}
          onUpdateDiscount={updateDiscount}
          onItemDragStart={handleItemDragStart}
          onItemDragOver={handleItemDragOver}
          onItemDrop={handleItemDrop}
          onItemDragEnd={handleItemDragEnd}
        />

        <AllItemsDiscountControl
          enabled={allItemsDiscountEnabled}
          value={allItemsDiscountValue}
          onEnabledChange={setAllItemsDiscountEnabled}
          onValueChange={setAllItemsDiscountValue}
        />

        <SalesFormTotalsSection
          vatMode={vatMode}
          vatOptions={vatOptions}
          vatSummary={vatSummary}
          onVatModeChange={setVatMode}
        />

        <button className="primary-button" type="submit">
          {t("salesForm.saveButton")}
        </button>
      </form>
    </section>
  );
}

export default SalesForm;
