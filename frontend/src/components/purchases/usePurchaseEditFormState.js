// React hook for purchase workflow state and actions.

import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import {
  getInitialPurchaseItemStatus,
  getPurchaseStatusFromItems,
} from "../../purchaseStatus";
import { buildConvertedItemFields } from "../../unitConversion";
import { isProductActive } from "../products/productUtils";
import {
  computeAmount,
  computeLeadTimeDays,
  computeVatSummary,
  createEditForm,
  createEditItems,
  defaultSupplierOptions,
  findProductForItem,
  getProductName,
  getProductSearchNames,
  getProductSku,
  getPurchaseItemRemovalMessage,
  getToday,
  getTransactionDocuments,
  normalizeSupplierOptions,
} from "./purchaseHistoryUtils";
import {
  updateItemHelper,
  updateProductQueryHelper,
  selectProductHelper,
  addDiscountHelper,
  removeDiscountHelper,
  updateDiscountHelper,
  addItemHelper,
} from "./purchaseEditFormStateHelpers";

export function usePurchaseEditFormState({
  purchase,
  products = [],
  suppliers = defaultSupplierOptions,
  onCancel,
  onSave,
}) {
  const { t } = useLanguage();
  const [form, setForm] = useState(() => createEditForm(purchase));
  const [items, setItems] = useState(() => createEditItems(purchase, products));
  const [vatMode, setVatMode] = useState(purchase.vat_mode || "not_included");
  const [supplierQuery, setSupplierQuery] = useState(purchase.supplier_name || "");
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [supplierError, setSupplierError] = useState("");
  const [openProductIndex, setOpenProductIndex] = useState(null);
  const [itemErrors, setItemErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  function markDirty() {
    setIsDirty(true);
    setSaveSuccess(false);
  }

  useEffect(() => {
    if (!saveSuccess) return;
    const timer = setTimeout(() => setSaveSuccess(false), 2500);
    return () => clearTimeout(timer);
  }, [saveSuccess]);

  const filteredSuppliers = useMemo(() => {
    const normalizedQuery = supplierQuery.trim().toLowerCase();
    const supplierOptions = normalizeSupplierOptions(suppliers, purchase.supplier_name || "");

    if (!normalizedQuery) {
      return supplierOptions;
    }

    return supplierOptions.filter((supplier) =>
      supplier.companyName.toLowerCase().includes(normalizedQuery)
    );
  }, [purchase.supplier_name, supplierQuery, suppliers]);

  const itemTotal = items.reduce((sum, item) => sum + computeAmount(item, purchase), 0);
  const vatSummary = computeVatSummary(itemTotal, vatMode);
  const visibleDocuments = useMemo(
    () =>
      getTransactionDocuments(purchase, t).filter(
        (document) => !form.remove_document_ids.includes(document.id)
      ),
    [purchase, t, form.remove_document_ids]
  );

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

  function updateForm(key, value) {
    markDirty();
    setForm((currentForm) => ({ ...currentForm, [key]: value }));
  }

  function updateItem(itemIndex, key, value) {
    markDirty();
    setItems((currentItems) => updateItemHelper(currentItems, itemIndex, key, value));
  }

  function updateProductQuery(itemIndex, value) {
    markDirty();
    setItems((currentItems) => updateProductQueryHelper(currentItems, itemIndex, value));
    setItemErrors((currentErrors) => ({ ...currentErrors, [itemIndex]: "" }));
    setOpenProductIndex(itemIndex);
  }

  function selectProduct(itemIndex, product) {
    if (!isProductActive(product)) {
      return;
    }
    markDirty();
    setItems((currentItems) => selectProductHelper(currentItems, itemIndex, product));
    setItemErrors((currentErrors) => ({ ...currentErrors, [itemIndex]: "" }));
    setOpenProductIndex(null);
  }

  function addDiscount(itemIndex) {
    markDirty();
    setItems((currentItems) => addDiscountHelper(currentItems, itemIndex));
  }

  function removeDiscount(itemIndex, discountIndex) {
    markDirty();
    setItems((currentItems) => removeDiscountHelper(currentItems, itemIndex, discountIndex));
  }

  function updateDiscount(itemIndex, discountIndex, value) {
    markDirty();
    setItems((currentItems) => updateDiscountHelper(currentItems, itemIndex, discountIndex, value));
  }

  function addItem() {
    markDirty();
    setItems((currentItems) => addItemHelper(currentItems, purchase.id));
  }

  function removeItem(itemIndex) {
    const item = items[itemIndex];
    const confirmed = window.confirm(
      getPurchaseItemRemovalMessage(purchase, item || {}, itemIndex, t)
    );

    if (!confirmed) {
      return;
    }

    markDirty();
    setItems((currentItems) => currentItems.filter((_, index) => index !== itemIndex));
    setItemErrors((currentErrors) => {
      const nextErrors = {};

      Object.entries(currentErrors).forEach(([key, value]) => {
        const currentIndex = Number(key);

        if (currentIndex < itemIndex) {
          nextErrors[currentIndex] = value;
        } else if (currentIndex > itemIndex) {
          nextErrors[currentIndex - 1] = value;
        }
      });

      return nextErrors;
    });
  }

  function selectSupplier(supplier) {
    markDirty();
    setForm((currentForm) => ({
      ...currentForm,
      supplier_name: supplier.companyName,
    }));
    setSupplierQuery(supplier.companyName);
    setSupplierError("");
    setSupplierOpen(false);
  }

  function resolveSupplierName() {
    const selectedSupplier = suppliers.find(
      (supplier) => supplier.companyName === form.supplier_name
    );

    if (selectedSupplier) {
      return selectedSupplier.companyName;
    }

    const exactMatch = suppliers.find(
      (supplier) =>
        supplier.companyName.toLowerCase() === supplierQuery.trim().toLowerCase()
    );

    return exactMatch?.companyName || "";
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");

    const supplierName = resolveSupplierName();

    if (!supplierName) {
      setSupplierError(t("purchaseForm.errorSelectSupplier"));
      setSupplierOpen(true);
      return;
    }

    const nextItemErrors = {};
    const normalizedItems = items.reduce((nextItems, item, index) => {
      const hasAnyValue =
        item.product_query ||
        item.product_name ||
        item.sku ||
        item.quantity ||
        item.unit_cost ||
        item.expected_delivery_date;

      if (!hasAnyValue) {
        return nextItems;
      }

      const selectedProduct = findProductForItem(item, products);

      if (!selectedProduct) {
        nextItemErrors[index] = t("purchaseForm.errorSelectProduct");
        return nextItems;
      }

      if (!item.quantity || !item.unit_cost) {
        return nextItems;
      }

      const amount = computeAmount(item, purchase);
      const convertedFields = buildConvertedItemFields(
        selectedProduct,
        item.quantity,
        item.unit,
        "purchase"
      );
      const itemStatus =
        form.status === "received" ||
        form.status === "cancelled" ||
        form.status === "ordered" ||
        form.status === "draft"
          ? getInitialPurchaseItemStatus(form.status)
          : item.item_status || getInitialPurchaseItemStatus(form.status);

      return [
        ...nextItems,
        {
          id: item.id,
          product_id: selectedProduct.id,
          product_name: getProductName(selectedProduct),
          sku: getProductSku(selectedProduct),
          ...convertedFields,
          expected_delivery_date: item.expected_delivery_date || "",
          item_status: itemStatus,
          received_date: itemStatus === "received" ? item.received_date || getToday() : "",
          lead_time_days: computeLeadTimeDays(
            form.transaction_date,
            item.expected_delivery_date
          ),
          quantity: Number(item.quantity) || 0,
          unit_cost: Number(item.unit_cost) || 0,
          discounts: item.discounts || [0],
          amount,
          line_total: amount,
        },
      ];
    }, []);

    if (Object.keys(nextItemErrors).length) {
      setItemErrors(nextItemErrors);
      setOpenProductIndex(Number(Object.keys(nextItemErrors)[0]));
      setFormError(t("purchaseForm.errorSelectProductAll"));
      return;
    }

    if (!normalizedItems.length) {
      setFormError(t("purchaseForm.errorAddItem"));
      return;
    }

    const nextPurchase = {
      ...purchase,
      reference_no: form.reference_no,
      supplier_name: supplierName,
      supplier_tax_invoice: form.supplier_tax_invoice,
      status: form.status,
      transaction_date: form.transaction_date,
      note: form.note,
      new_documents: form.new_documents,
      remove_document_ids: form.remove_document_ids,
      remove_document: form.remove_document,
      documents: [
        ...visibleDocuments,
        ...form.new_documents.map((document, index) => ({
          id: `new-document-${index}`,
          name: document.name,
          url: "",
        })),
      ],
      document_url: form.remove_document
        ? ""
        : visibleDocuments[0]?.url || purchase.document_url,
      items: normalizedItems,
      vat_mode: vatMode,
      total_before_vat: vatSummary.total,
      vat_amount: vatSummary.vat,
      grand_total: vatSummary.grandTotal,
      total_amount: vatSummary.grandTotal,
    };

    setIsSubmitting(true);
    const saved = await onSave?.({
      ...nextPurchase,
      status: getPurchaseStatusFromItems(nextPurchase),
    });
    setIsSubmitting(false);
    if (saved === false) return;
    setIsDirty(false);
    setSaveSuccess(true);
  }

  const vatOptions = useMemo(
    () => [
      { value: "included", label: t("purchaseForm.vatIncluded") },
      { value: "not_included", label: t("purchaseForm.vatExcluded") },
    ],
    [t]
  );

  function handleVatModeChange(value) {
    markDirty();
    setVatMode(value);
  }

  function handleSupplierQueryChange(value) {
    markDirty();
    setSupplierQuery(value);
  }

  return {
    form,
    items,
    vatMode,
    supplierQuery,
    supplierOpen,
    supplierError,
    openProductIndex,
    itemErrors,
    formError,
    isDirty,
    isSubmitting,
    saveSuccess,
    filteredSuppliers,
    vatSummary,
    visibleDocuments,
    getFilteredProducts,
    updateForm,
    setVatMode: handleVatModeChange,
    setSupplierQuery: handleSupplierQueryChange,
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
  };
}
