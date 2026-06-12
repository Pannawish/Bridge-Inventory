import { useEffect, useMemo, useRef, useState } from "react";
import { computePaymentDate } from "../../format";
import { useLanguage } from "../../i18n/LanguageContext";
import {
  getInitialPurchaseItemStatus,
  getTodayString,
} from "../../purchaseStatus";
import { getActiveTransactionDiscount } from "../transactionDiscounts";
import { isProductActive } from "../products/productUtils";
import {
  computeAmount,
  computeVatSummary,
  createInitialForm,
  createInitialItems,
  emptyItem,
  getNextPurchaseReference,
  getNextPurchaseReferenceAfter,
  getSupplierPaymentTerms,
  vatOptionValues,
} from "./purchaseFormUtils";
import {
  addDiscountToItems,
  appendEmptyItem,
  buildPurchaseSubmissionItems,
  removeDiscountFromItems,
  removeItemAtIndex,
  reorderItems as reorderDraftItems,
  resolveSupplierName as resolveSelectedSupplierName,
  selectProductItems,
  updateDiscountInItems,
  updateItemValue,
  updateProductQueryItems,
} from "./purchaseFormStateHelpers";

function usePurchaseFormState({
  products,
  suppliers,
  onSubmit,
  purchases,
  prefill,
}) {
  const nextReferenceNo = useMemo(() => getNextPurchaseReference(purchases), [purchases]);
  const lastGeneratedReference = useRef(nextReferenceNo);
  const [form, setForm] = useState(() =>
    createInitialForm(prefill?.reference_no || nextReferenceNo, prefill || {})
  );
  const [items, setItems] = useState(() => createInitialItems(prefill || {}));
  const [vatMode, setVatMode] = useState(prefill?.vat_mode || "not_included");
  const [allItemsDiscountEnabled, setAllItemsDiscountEnabled] = useState(false);
  const [allItemsDiscountValue, setAllItemsDiscountValue] = useState("0");
  const [supplierQuery, setSupplierQuery] = useState(prefill?.supplier_name || "");
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [supplierError, setSupplierError] = useState("");
  const [openProductIndex, setOpenProductIndex] = useState(null);
  const [itemErrors, setItemErrors] = useState({});
  const [draggedItemIndex, setDraggedItemIndex] = useState(null);
  const { t } = useLanguage();
  const vatOptions = vatOptionValues.map((value) => ({
    value,
    label: value === "included" ? t("purchaseForm.vatIncluded") : t("purchaseForm.vatExcluded"),
  }));

  useEffect(() => {
    setForm((currentForm) => {
      const shouldRefreshReference =
        !currentForm.reference_no ||
        currentForm.reference_no === lastGeneratedReference.current;

      lastGeneratedReference.current = nextReferenceNo;

      if (!shouldRefreshReference) {
        return currentForm;
      }

      return { ...currentForm, reference_no: nextReferenceNo };
    });
  }, [nextReferenceNo]);

  useEffect(() => {
    if (!form.supplier_name || form.payment_term_type || form.payment_term_days) {
      return;
    }

    const matchedSupplier = suppliers.find(
      (supplier) =>
        `${supplier.companyName ?? ""}`.trim().toLowerCase() ===
        `${form.supplier_name}`.trim().toLowerCase()
    );

    if (!matchedSupplier) {
      return;
    }

    const nextTerms = getSupplierPaymentTerms(matchedSupplier);

    if (!nextTerms.payment_term_type && !nextTerms.payment_term_days) {
      return;
    }

    setForm((currentForm) => {
      if (
        `${currentForm.supplier_name}`.trim().toLowerCase() !==
          `${matchedSupplier.companyName ?? ""}`.trim().toLowerCase() ||
        currentForm.payment_term_type ||
        currentForm.payment_term_days
      ) {
        return currentForm;
      }

      return {
        ...currentForm,
        ...nextTerms,
      };
    });
  }, [form.payment_term_days, form.payment_term_type, form.supplier_name, suppliers]);

  const activeAllItemsDiscount = getActiveTransactionDiscount(
    allItemsDiscountEnabled,
    allItemsDiscountValue
  );
  const itemTotal = items.reduce(
    (sum, item) => sum + computeAmount(item, activeAllItemsDiscount),
    0
  );
  const vatSummary = computeVatSummary(itemTotal, vatMode);
  const paymentDate = computePaymentDate(
    form.transaction_date,
    form.payment_term_type,
    form.payment_term_days
  );

  function updateForm(key, value) {
    setForm((currentForm) => ({ ...currentForm, [key]: value }));
  }

  function updateItem(index, key, value) {
    setItems((currentItems) => updateItemValue(currentItems, index, key, value));
  }

  function updateProductQuery(index, value) {
    setItems((currentItems) => updateProductQueryItems(currentItems, index, value));
    setItemErrors((currentErrors) => ({ ...currentErrors, [index]: "" }));
    setOpenProductIndex(index);
  }

  function selectProduct(index, product) {
    if (!isProductActive(product)) {
      return;
    }

    setItems((currentItems) => selectProductItems(currentItems, index, product));
    setItemErrors((currentErrors) => ({ ...currentErrors, [index]: "" }));
    setOpenProductIndex(null);
  }

  function addDiscount(itemIndex) {
    setItems((currentItems) => addDiscountToItems(currentItems, itemIndex));
  }

  function removeDiscount(itemIndex, discountIndex) {
    setItems((currentItems) =>
      removeDiscountFromItems(currentItems, itemIndex, discountIndex)
    );
  }

  function updateDiscount(itemIndex, discountIndex, value) {
    setItems((currentItems) =>
      updateDiscountInItems(currentItems, itemIndex, discountIndex, value)
    );
  }

  function addItem() {
    setItems((currentItems) => appendEmptyItem(currentItems));
  }

  function removeItem(index) {
    setItems((currentItems) => removeItemAtIndex(currentItems, index));
  }

  function reorderItems(fromIndex, toIndex) {
    setItems((currentItems) => reorderDraftItems(currentItems, fromIndex, toIndex));
    setItemErrors({});
    setOpenProductIndex(null);
  }

  function handleItemDragStart(event, index) {
    setDraggedItemIndex(index);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", `${index}`);
  }

  function handleItemDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  function handleItemDrop(event, index) {
    event.preventDefault();
    event.stopPropagation();
    const transferredIndex = Number(event.dataTransfer.getData("text/plain"));
    const fromIndex = draggedItemIndex !== null ? draggedItemIndex : transferredIndex;

    if (Number.isInteger(fromIndex)) {
      reorderItems(fromIndex, index);
    }

    setDraggedItemIndex(null);
  }

  function handleItemDragEnd() {
    setDraggedItemIndex(null);
  }

  function selectSupplier(supplier) {
    const nextTerms = getSupplierPaymentTerms(supplier);
    setForm((currentForm) => ({
      ...currentForm,
      supplier_name: supplier.companyName,
      ...nextTerms,
    }));
    setSupplierQuery(supplier.companyName);
    setSupplierError("");
    setSupplierOpen(false);
  }

  function resolveSupplierName() {
    return resolveSelectedSupplierName(suppliers, form.supplier_name, supplierQuery);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const supplierName = resolveSupplierName();

    if (!supplierName) {
      setSupplierError(t("purchaseForm.errorSelectSupplier"));
      setSupplierOpen(true);
      return;
    }

    const { filteredItems, nextItemErrors } = buildPurchaseSubmissionItems({
      items,
      products,
      transactionDate: form.transaction_date,
      status: form.status,
      activeAllItemsDiscount,
      getInitialPurchaseItemStatus,
      getTodayString,
    });

    const translatedItemErrors = Object.fromEntries(
      Object.entries(nextItemErrors).map(([index, code]) => [
        index,
        code === "missing_delivery"
          ? t("purchaseForm.errorSelectDelivery")
          : t("purchaseForm.errorSelectProduct"),
      ])
    );

    if (Object.keys(translatedItemErrors).length) {
      setItemErrors(translatedItemErrors);
      setOpenProductIndex(Number(Object.keys(nextItemErrors)[0]));
      return;
    }

    const formData = new FormData();
    formData.append("reference_no", form.reference_no);
    formData.append("supplier_name", supplierName);
    formData.append("supplier_tax_invoice", form.supplier_tax_invoice);
    formData.append("status", form.status);
    formData.append("transaction_date", form.transaction_date);
    formData.append("note", form.note);
    formData.append("vat_mode", vatMode);
    formData.append("bill_discount", activeAllItemsDiscount ?? 0);
    formData.append("payment_term_type", form.payment_term_type);
    formData.append(
      "payment_term_days",
      form.payment_term_type === "credit" ? form.payment_term_days : ""
    );
    formData.append("payment_date", paymentDate);
    formData.append("total_before_vat", vatSummary.total);
    formData.append("vat_amount", vatSummary.vat);
    formData.append("grand_total", vatSummary.grandTotal);

    form.documents.forEach((document) => {
      formData.append("documents", document);
    });

    formData.append("items", JSON.stringify(filteredItems));

    const saved = await onSubmit(formData);

    if (saved === false) {
      return;
    }

    const nextReference = getNextPurchaseReferenceAfter(lastGeneratedReference.current);
    lastGeneratedReference.current = nextReference;
    setForm(createInitialForm(nextReference));
    setItems([emptyItem()]);
    setVatMode("not_included");
    setAllItemsDiscountEnabled(false);
    setAllItemsDiscountValue("0");
    setSupplierQuery("");
    setSupplierError("");
    setOpenProductIndex(null);
    setItemErrors({});
    setDraggedItemIndex(null);
  }

  return {
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
    handleSubmit,
  };
}

export default usePurchaseFormState;
