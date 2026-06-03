import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { isProductActive } from "../products/productUtils";
import { getProductDefaultSalesUnit } from "../../unitConversion";
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
  getProductSearchNames,
  getProductSku,
  normalizeDiscounts,
  normalizePartnerOptions,
} from "./quotationUtils";
import {
  getTranslatedProductName,
  validateQuotationForm,
  buildNormalizedItems,
} from "./quotationFormStateHelpers";
import { getCustomerPaymentTerms, getFilteredCustomers } from "../sales/salesFormUtils";

export function useQuotationFormState({
  quotation = null,
  quotations = [],
  products = [],
  suppliers = [],
  customers = [],
  onSave,
  onCancel,
}) {
  const { t } = useLanguage();
  const vatOptions = useMemo(
    () =>
      VAT_OPTION_VALUES.map((value) => ({
        value,
        label: value === "included" ? t("quotation.vatIncluded") : t("quotation.vatExcluded"),
      })),
    [t]
  );
  const isEditing = Boolean(quotation);
  const initialReference = useMemo(
    () => quotation?.reference_no || getNextQuotationReference(quotations),
    [quotation, quotations]
  );
  const [form, setForm] = useState(() =>
    quotation ? createEditForm(quotation) : createInitialForm(initialReference)
  );
  const [items, setItems] = useState(() =>
    quotation ? createEditItems(quotation) : [emptyItem()]
  );
  const [formError, setFormError] = useState("");
  const [openProductIndex, setOpenProductIndex] = useState(null);
  const [itemErrors, setItemErrors] = useState({});
  const [customerQuery, setCustomerQuery] = useState(quotation?.customer_name || "");
  const [customerOpen, setCustomerOpen] = useState(false);

  const normalizedCustomers = useMemo(
    () => normalizePartnerOptions(customers, form.customer_name),
    [customers, form.customer_name]
  );

  useEffect(() => {
    if (!form.customer_name || form.payment_term_type || form.payment_term_days) {
      return;
    }

    const matchedCustomer = normalizedCustomers.find(
      (customer) =>
        `${customer.companyName ?? ""}`.trim().toLowerCase() ===
        `${form.customer_name}`.trim().toLowerCase()
    );

    if (!matchedCustomer) {
      return;
    }

    const nextTerms = getCustomerPaymentTerms(matchedCustomer);
    if (!nextTerms.payment_term_type && !nextTerms.payment_term_days) {
      return;
    }

    setForm((currentForm) => {
      if (
        `${currentForm.customer_name}`.trim().toLowerCase() !==
          `${matchedCustomer.companyName ?? ""}`.trim().toLowerCase() ||
        currentForm.payment_term_type ||
        currentForm.payment_term_days
      ) {
        return currentForm;
      }
      return { ...currentForm, ...nextTerms };
    });
  }, [normalizedCustomers, form.customer_name, form.payment_term_type, form.payment_term_days]);

  const customerOptions = useMemo(
    () => normalizedCustomers,
    [normalizedCustomers]
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

  function selectCustomer(customer) {
    const nextTerms = getCustomerPaymentTerms(customer);
    setForm((currentForm) => ({
      ...currentForm,
      customer_name: customer.companyName,
      ...nextTerms,
    }));
    setCustomerQuery(customer.companyName);
    setCustomerOpen(false);
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

    const productName = getTranslatedProductName(product, t);
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

    const validationResult = validateQuotationForm(form, items, validUntilDate, t);
    if (validationResult) {
      setFormError(validationResult.error);
      return;
    }

    let normalizedItems;
    try {
      const result = buildNormalizedItems(items, products, t);
      if (result.error) {
        if (result.itemErrors) {
          setItemErrors(result.itemErrors);
        }
        if (result.openProductIndex !== undefined) {
          setOpenProductIndex(result.openProductIndex);
        }
        setFormError(result.error);
        return;
      }
      normalizedItems = result.normalizedItems;
    } catch (error) {
      setFormError(error.message);
      return;
    }

    try {
      const savedQuotation = await onSave({
        ...(quotation || {}),
        reference_no: form.reference_no,
        quotation_date: form.quotation_date,
        valid_until_days: Number(form.valid_until_days),
        valid_until_day_type: form.valid_until_day_type,
        valid_until_date: form.valid_until_day_type === "no_valid_date" ? null : validUntilDate,
        customer_name: form.customer_name,
        payment_term_type: form.payment_term_type,
        payment_term_days: form.payment_term_type === "credit" ? form.payment_term_days : "",
        shipping_date: form.shipping_date || null,
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

      onCancel?.();
    } catch (error) {
      setFormError(error.message);
    }
  }

  return {
    form,
    items,
    formError,
    openProductIndex,
    itemErrors,
    vatOptions,
    isEditing,
    initialReference,
    customerOptions,
    customerQuery,
    setCustomerQuery,
    customerOpen,
    setCustomerOpen,
    selectCustomer,
    getFilteredCustomers: (query) => getFilteredCustomers(customerOptions, query),
    supplierOptions,
    vatSummary,
    validUntilDate,
    setOpenProductIndex,
    getFilteredProducts,
    getTranslatedProductName: (prod) => getTranslatedProductName(prod, t),
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
  };
}
