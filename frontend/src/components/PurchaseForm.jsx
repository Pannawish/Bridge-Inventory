// React component for shared component: purchase form.

import AllItemsDiscountControl from "./AllItemsDiscountControl";
import PurchaseFormDetailsSection from "./purchases/PurchaseFormDetailsSection";
import PurchaseLineItemsSection from "./purchases/PurchaseLineItemsSection";
import PurchaseFormTotalsSection from "./purchases/PurchaseFormTotalsSection";
import { defaultSupplierOptions } from "./purchases/purchaseFormUtils";
import usePurchaseFormState from "./purchases/usePurchaseFormState";
import { useLanguage } from "../i18n/LanguageContext";
import { markFieldBlurredOnBlurCapture } from "./formBlurValidation";

function PurchaseForm({
  products = [],
  suppliers = defaultSupplierOptions,
  onSubmit,
  purchases = [],
  onCancel = null,
  prefill = null,
}) {
  const { t } = useLanguage();
  const {
    nextReferenceNo,
    form,
    setForm,
    items,
    vatMode,
    setVatMode,
    allItemsDiscountEnabled,
    setAllItemsDiscountEnabled,
    allItemsDiscountValue,
    setAllItemsDiscountValue,
    supplierQuery,
    setSupplierQuery,
    supplierOpen,
    setSupplierOpen,
    supplierError,
    setSupplierError,
    openProductIndex,
    setOpenProductIndex,
    itemErrors,
    draggedItemIndex,
    vatOptions,
    paymentDate,
    vatSummary,
    activeAllItemsDiscount,
    updateForm,
    updateItem,
    updateProductQuery,
    selectProduct,
    addDiscount,
    removeDiscount,
    updateDiscount,
    addItem,
    removeItem,
    handleItemDragStart,
    handleItemDragOver,
    handleItemDrop,
    handleItemDragEnd,
    selectSupplier,
    handleSupplierBlur,
    handleProductBlur,
    handleSubmit,
  } = usePurchaseFormState({
    products,
    suppliers,
    onSubmit,
    purchases,
    prefill,
  });

  return (
    <section className="section-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("purchaseForm.eyebrow")}</p>
          <h3>{t("purchaseForm.newTitle")}</h3>
        </div>
        {onCancel ? (
          <button className="secondary-button" type="button" onClick={onCancel}>
            {t("purchaseForm.closeButton")}
          </button>
        ) : null}
      </div>

      <form className="form-layout" onSubmit={handleSubmit} onBlurCapture={markFieldBlurredOnBlurCapture}>
        <PurchaseFormDetailsSection
          form={form}
          nextReferenceNo={nextReferenceNo}
          suppliers={suppliers}
          supplierQuery={supplierQuery}
          supplierOpen={supplierOpen}
          supplierError={supplierError}
          paymentDate={paymentDate}
          onUpdateForm={updateForm}
          onSupplierQueryChange={(value) => {
            setSupplierQuery(value);
            setForm((currentForm) => ({ ...currentForm, supplier_name: "" }));
            setSupplierError("");
            setSupplierOpen(true);
          }}
          onSupplierOpen={() => setSupplierOpen(true)}
          onSupplierClose={() => {
            window.setTimeout(() => {
              setSupplierOpen(false);
              handleSupplierBlur();
            }, 120);
          }}
          onSelectSupplier={selectSupplier}
          onPaymentTermTypeChange={(value) => {
            setForm((currentForm) => ({
              ...currentForm,
              payment_term_type: value,
              payment_term_days: value === "cash" ? "" : currentForm.payment_term_days,
            }));
          }}
          onPaymentTermDaysChange={(value) =>
            setForm((currentForm) => ({ ...currentForm, payment_term_days: value }))
          }
          onDocumentsAdd={(documents) =>
            setForm((currentForm) => ({
              ...currentForm,
              documents: [...currentForm.documents, ...documents],
            }))
          }
          onDocumentRemove={(documentIndex) =>
            setForm((currentForm) => ({
              ...currentForm,
              documents: currentForm.documents.filter((_, index) => index !== documentIndex),
            }))
          }
        />

        <PurchaseLineItemsSection
          form={form}
          items={items}
          products={products}
          activeAllItemsDiscount={activeAllItemsDiscount}
          openProductIndex={openProductIndex}
          itemErrors={itemErrors}
          draggedItemIndex={draggedItemIndex}
          onAddItem={addItem}
          onRemoveItem={removeItem}
          onUpdateItem={updateItem}
          onUpdateProductQuery={updateProductQuery}
          onSetOpenProductIndex={setOpenProductIndex}
          onProductBlur={handleProductBlur}
          onSelectProduct={selectProduct}
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

        <PurchaseFormTotalsSection
          vatMode={vatMode}
          vatOptions={vatOptions}
          vatSummary={vatSummary}
          onVatModeChange={setVatMode}
        />

        <button className="primary-button" type="submit">
          {t("purchaseForm.saveButton")}
        </button>
      </form>
    </section>
  );
}

export default PurchaseForm;
