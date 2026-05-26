import { useMemo, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { isProductActive } from "../products/productUtils";
import {
  VAT_OPTION_VALUES,
  computeAmount,
  computeValidUntilDate,
  computeVatSummary,
  createEditForm,
  createEditItems,
  createInitialForm,
  emptyItem,
  emptySupplierOption,
  getNextQuotationReference,
  getProductName,
  getProductSearchNames,
  getProductSku,
  normalizeDiscounts,
  normalizePartnerOptions,
} from "./quotationUtils";
import { buildConvertedItemFields } from "../../unitConversion";
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
  const { t } = useLanguage();
  const vatOptions = VAT_OPTION_VALUES.map((value) => ({
    value,
    label: value === "included" ? t("quotation.vatIncluded") : t("quotation.vatExcluded"),
  }));
  const isEditing = Boolean(quotation);
  const initialReference = quotation?.reference_no || getNextQuotationReference(quotations);
  const [form, setForm] = useState(() =>
    quotation ? createEditForm(quotation) : createInitialForm(initialReference)
  );
  const [items, setItems] = useState(() =>
    quotation ? createEditItems(quotation) : [emptyItem()]
  );
  const [formError, setFormError] = useState("");
  const [openProductIndex, setOpenProductIndex] = useState(null);
  const [itemErrors, setItemErrors] = useState({});
  const customerOptions = useMemo(
    () =>
      normalizePartnerOptions(customers, form.customer_name).map(
        (customer) => customer.companyName
      ),
    [customers, form.customer_name]
  );
  const supplierOptions = useMemo(
    () => normalizePartnerOptions(suppliers).map((supplier) => supplier.companyName),
    [suppliers]
  );
  const itemTotal = items.reduce((sum, item) => sum + computeAmount(item, "sale_price"), 0);
  const vatSummary = computeVatSummary(itemTotal, form.vat_mode);
  const validUntilDate = useMemo(
    () =>
      computeValidUntilDate(
        form.quotation_date,
        form.valid_until_days,
        form.valid_until_day_type
      ),
    [form.quotation_date, form.valid_until_days, form.valid_until_day_type]
  );

  function getTranslatedProductName(product) {
    return getProductName(product, t("products.productFallback", { id: product?.id || "" }));
  }

  function updateForm(key, value) {
    setForm((currentForm) => ({ ...currentForm, [key]: value }));
  }

  function handleQuotationDateChange(value) {
    updateForm("quotation_date", value);
  }

  function handleValidUntilDaysChange(rawValue) {
    if (rawValue === "") {
      updateForm("valid_until_days", "");
      return;
    }

    const nextDays = parseInt(rawValue, 10);
    if (Number.isNaN(nextDays)) {
      return;
    }

    const clampedDays = Math.min(100, Math.max(0, nextDays));
    setForm((currentForm) => ({
      ...currentForm,
      valid_until_days: clampedDays,
      valid_until_day_type:
        clampedDays === 0
          ? "no_valid_date"
          : currentForm.valid_until_day_type === "no_valid_date"
            ? "calendar"
            : currentForm.valid_until_day_type,
    }));
  }

  function handleValidUntilDayTypeChange(dayType) {
    setForm((currentForm) => ({
      ...currentForm,
      valid_until_day_type: dayType,
      valid_until_days:
        dayType === "no_valid_date"
          ? 0
          : Number(currentForm.valid_until_days) === 0
            ? 30
            : currentForm.valid_until_days,
    }));
  }

  function updateItem(itemIndex, key, value) {
    setItems((currentItems) =>
      currentItems.map((item, index) =>
        index === itemIndex ? { ...item, [key]: value } : item
      )
    );
  }

  function getFilteredProducts(query) {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return products;
    }

    return products.filter((product) => {
      const matchesName = getProductSearchNames(product).some((name) =>
        name.toLowerCase().includes(normalizedQuery)
      );
      const sku = getProductSku(product).toLowerCase();
      const displayId = `${product.productDisplayId || product.id || ""}`.toLowerCase();

      return matchesName || sku.includes(normalizedQuery) || displayId.includes(normalizedQuery);
    });
  }

  function updateProductQuery(itemIndex, value) {
    setItems((currentItems) =>
      currentItems.map((item, index) =>
        index === itemIndex
          ? {
              ...item,
              product_id: "",
              product_query: value,
              product_name: "",
              sku: "",
              unit: "pcs",
            }
          : item
      )
    );
    setItemErrors((currentErrors) => ({ ...currentErrors, [itemIndex]: "" }));
    setOpenProductIndex(itemIndex);
  }

  function selectProduct(itemIndex, product) {
    if (!isProductActive(product)) {
      return;
    }

    const productName = getTranslatedProductName(product);
    const sku = getProductSku(product);

    setItems((currentItems) =>
      currentItems.map((item, index) =>
        index === itemIndex
          ? {
              ...item,
              product_id: product.id,
              product_query: sku ? `${productName} (${sku})` : productName,
              product_name: productName,
              sku,
              unit: getProductDefaultSalesUnit(product),
            }
          : item
      )
    );
    setItemErrors((currentErrors) => ({ ...currentErrors, [itemIndex]: "" }));
    setOpenProductIndex(null);
  }

  function addItem() {
    setItems((currentItems) => [...currentItems, emptyItem()]);
  }

  function removeItem(itemIndex) {
    setItems((currentItems) => currentItems.filter((_, index) => index !== itemIndex));
  }

  function addSupplierOption(itemIndex) {
    setItems((currentItems) =>
      currentItems.map((item, index) =>
        index === itemIndex
          ? {
              ...item,
              supplier_options: [...(item.supplier_options || []), emptySupplierOption()],
            }
          : item
      )
    );
  }

  function removeSupplierOption(itemIndex, optionIndex) {
    setItems((currentItems) =>
      currentItems.map((item, index) =>
        index === itemIndex
          ? {
              ...item,
              supplier_options: (item.supplier_options || []).filter(
                (_, currentOptionIndex) => currentOptionIndex !== optionIndex
              ),
            }
          : item
      )
    );
  }

  function updateSupplierOption(itemIndex, optionIndex, key, value) {
    setItems((currentItems) =>
      currentItems.map((item, index) =>
        index === itemIndex
          ? {
              ...item,
              supplier_options: (item.supplier_options || []).map(
                (option, currentOptionIndex) =>
                  currentOptionIndex === optionIndex ? { ...option, [key]: value } : option
              ),
            }
          : item
      )
    );
  }

  function addDiscount(itemIndex) {
    setItems((currentItems) =>
      currentItems.map((item, index) =>
        index === itemIndex ? { ...item, discounts: [...normalizeDiscounts(item), ""] } : item
      )
    );
  }

  function removeDiscount(itemIndex, discountIndex) {
    setItems((currentItems) =>
      currentItems.map((item, index) => {
        if (index !== itemIndex) {
          return item;
        }

        const nextDiscounts = normalizeDiscounts(item).filter(
          (_, currentDiscountIndex) => currentDiscountIndex !== discountIndex
        );

        return {
          ...item,
          discounts: nextDiscounts.length ? nextDiscounts : [""],
        };
      })
    );
  }

  function updateDiscount(itemIndex, discountIndex, value) {
    setItems((currentItems) =>
      currentItems.map((item, index) => {
        if (index !== itemIndex) {
          return item;
        }

        const nextDiscounts = normalizeDiscounts(item).map((discount, currentDiscountIndex) =>
          currentDiscountIndex === discountIndex ? value : discount
        );

        return { ...item, discounts: nextDiscounts };
      })
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    setItemErrors({});

    if (!form.quotation_date) {
      setFormError(t("quotation.errorDateRequired"));
      return;
    }

    const validUntilDays = Number(form.valid_until_days);
    const isNoValidDate = form.valid_until_day_type === "no_valid_date";
    if (!isNoValidDate && (Number.isNaN(validUntilDays) || validUntilDays < 1 || validUntilDays > 100)) {
      setFormError(t("quotation.errorValidUntilDays"));
      return;
    }
    if (!isNoValidDate && !validUntilDate) {
      setFormError(t("quotation.errorValidUntilCompute"));
      return;
    }

    for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
      const options = items[itemIndex].supplier_options || [];
      for (const option of options) {
        const hasSupplierName = `${option.supplier_name ?? ""}`.trim();
        const missingCost =
          option.cost_price === "" ||
          option.cost_price === null ||
          option.cost_price === undefined;
        if (hasSupplierName && missingCost) {
          setFormError(
            t("quotation.errorSupplierCostPrice", {
              supplier: option.supplier_name,
              index: itemIndex + 1,
            })
          );
          return;
        }
      }
    }

    const normalizedItems = items.map((item, index) => {
      const selectedProduct = products.find((product) => `${product.id}` === `${item.product_id}`);

      if (!selectedProduct) {
        setItemErrors({ [index]: t("quotation.errorSelectProduct") });
        setOpenProductIndex(index);
        throw new Error(t("quotation.errorSelectProduct"));
      }

      if (!item.quantity || Number(item.quantity) <= 0) {
        throw new Error(t("quotation.errorQuantityRequired", { index: index + 1 }));
      }

      if (item.sale_price === "" || item.sale_price === null || item.sale_price === undefined) {
        throw new Error(t("quotation.errorSalePriceRequired", { index: index + 1 }));
      }

      const discounts = normalizeDiscounts(item);
      const convertedFields = buildConvertedItemFields(
        selectedProduct,
        item.quantity,
        item.unit,
        "sale"
      );

      const supplierOptionRows = (item.supplier_options || [])
        .filter((option) => `${option.supplier_name ?? ""}`.trim())
        .map((option) => ({
          supplier_name: `${option.supplier_name}`.trim(),
          cost_price: option.cost_price,
        }));

      return {
        line_id: item.line_id,
        product_id: selectedProduct.id,
        product_name: getTranslatedProductName(selectedProduct),
        sku: getProductSku(selectedProduct),
        ...convertedFields,
        quantity: Number(item.quantity) || 0,
        sale_price: item.sale_price,
        discounts,
        supplier_options: supplierOptionRows,
        sale_amount: computeAmount(item, "sale_price"),
      };
    });

    try {
      const savedQuotation = await onSave({
        ...(quotation || {}),
        reference_no: form.reference_no,
        quotation_date: form.quotation_date,
        valid_until_days: Number(form.valid_until_days),
        valid_until_day_type: form.valid_until_day_type,
        valid_until_date: form.valid_until_day_type === "no_valid_date" ? null : validUntilDate,
        customer_name: form.customer_name,
        vat_mode: form.vat_mode,
        note: form.note,
        items: normalizedItems,
        total_before_vat: vatSummary.total,
        vat_amount: vatSummary.vat,
        grand_total: vatSummary.grandTotal,
      });

      if (savedQuotation === false) {
        return;
      }

      if (isEditing) {
        onCancel();
      } else {
        onCancel?.();
      }
    } catch (error) {
      setFormError(error.message);
    }
  }

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
