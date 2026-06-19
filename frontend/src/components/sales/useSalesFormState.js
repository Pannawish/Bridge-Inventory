import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../api";
import { computePaymentDate } from "../../format";
import { useLanguage } from "../../i18n/LanguageContext";
import { applySaleStatusToItems, getSaleStatusFromItems } from "../../saleStatus";
import { formatSaleStockIssueMessage, getSaleStockIssues } from "../../saleStock";
import { buildConvertedItemFields } from "../../unitConversion";
import { getActiveTransactionDiscount } from "../transactionDiscounts";
import { isProductActive } from "../products/productUtils";
import {
  allocationsMatchItemQuantity,
  createEmptyAllocationRow,
  getComputedAllocationSnapshot,
} from "./salesAllocationUtils";
import {
  computeAmount,
  computeVatSummary,
  createInitialForm,
  createInitialItems,
  emptyItem,
  getCustomerPaymentTerms,
  getNextSalesReference,
  getNextSalesReferenceAfter,
  vatOptionValues,
} from "./salesFormUtils";
import {
  addDiscountToItems,
  appendEmptyItem,
  buildBelowCostConfirmationMessage,
  buildSaleSubmissionItems,
  buildStockPreviewItems,
  getBelowCostItems,
  removeDiscountFromItems,
  removeItemAtIndex,
  reorderItems as reorderDraftItems,
  resolveCustomerName as resolveSelectedCustomerName,
  selectProductItems,
  updateDiscountInItems,
  updateItemValue,
  updateProductQueryItems,
  updateSupplierItems,
} from "./salesFormStateHelpers";

function useSalesFormState({
  products,
  customers,
  purchases,
  sales,
  enableStockValidation,
  onSubmit,
  prefill,
}) {
  const { language, t } = useLanguage();
  const nextReferenceNo = useMemo(() => getNextSalesReference(sales), [sales]);
  const lastGeneratedReference = useRef(nextReferenceNo);
  const [form, setForm] = useState(() => createInitialForm(nextReferenceNo, prefill || {}));
  const [items, setItems] = useState(() => createInitialItems(prefill || {}));
  const [vatMode, setVatMode] = useState(prefill?.vat_mode || "not_included");
  const [allItemsDiscountEnabled, setAllItemsDiscountEnabled] = useState(false);
  const [allItemsDiscountValue, setAllItemsDiscountValue] = useState("0");
  const [customerQuery, setCustomerQuery] = useState(prefill?.customer_name || "");
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerError, setCustomerError] = useState("");
  const [statusError, setStatusError] = useState("");
  const [openProductIndex, setOpenProductIndex] = useState(null);
  const [itemErrors, setItemErrors] = useState({});
  const [draggedItemIndex, setDraggedItemIndex] = useState(null);
  const [stockLayersByProductId, setStockLayersByProductId] = useState({});

  function getStockLayerKey(productId) {
    return `${productId || ""}:new`;
  }

  function getItemConversionFactor(item) {
    const selectedProduct = products.find(
      (product) => `${product.id}` === `${item.product_id}`
    );
    const convertedFields = selectedProduct
      ? buildConvertedItemFields(selectedProduct, 1, item.unit, "sale")
      : null;
    return Number(convertedFields?.conversion_factor) || 1;
  }

  function getStockLayersForItem(item) {
    return stockLayersByProductId[getStockLayerKey(item.product_id)] || [];
  }

  function applyAllocationCostSnapshot(item) {
    const nextSnapshot = getComputedAllocationSnapshot(
      item,
      getStockLayersForItem(item),
      getItemConversionFactor(item)
    );

    return {
      ...item,
      supplier_name: nextSnapshot.supplier_name,
      unit_cost: nextSnapshot.unit_cost,
    };
  }

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
    if (!form.customer_name || form.payment_term_type || form.payment_term_days) {
      return;
    }

    const matchedCustomer = customers.find(
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

      return {
        ...currentForm,
        ...nextTerms,
      };
    });
  }, [customers, form.customer_name, form.payment_term_days, form.payment_term_type]);

  const stockPreviewItems = useMemo(
    () => buildStockPreviewItems(items, products),
    [items, products]
  );

  const saleStockIssues = useMemo(
    () =>
      enableStockValidation
        ? getSaleStockIssues(
            {
              status: form.status,
              items: stockPreviewItems,
            },
            products,
            purchases,
            sales
          )
        : [],
    [enableStockValidation, form.status, products, purchases, sales, stockPreviewItems]
  );

  const saleStockMessage =
    !["draft", "cancelled", "returned"].includes(form.status) && saleStockIssues.length
      ? formatSaleStockIssueMessage(saleStockIssues, {
          t,
          locale: language === "th" ? "th-TH" : "en-US",
        })
      : "";

  useEffect(() => {
    if (!saleStockIssues.length) {
      setStatusError("");
    }
  }, [saleStockIssues]);

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
  const vatOptions = vatOptionValues.map((value) => ({
    value,
    label: value === "included" ? t("salesForm.vatIncluded") : t("salesForm.vatExcluded"),
  }));

  useEffect(() => {
    const productIds = [
      ...new Set(items.map((item) => item.product_id).filter(Boolean)),
    ];
    productIds.forEach((productId) => {
      if (!stockLayersByProductId[getStockLayerKey(productId)]) {
        loadStockLayers(productId);
      }
    });
  }, [items, stockLayersByProductId]);

  useEffect(() => {
    setItems((currentItems) => {
      let changed = false;
      const nextItems = currentItems.map((item) => {
        const nextItem = applyAllocationCostSnapshot(item);
        if (
          nextItem.unit_cost !== item.unit_cost ||
          nextItem.supplier_name !== item.supplier_name
        ) {
          changed = true;
        }
        return nextItem;
      });

      return changed ? nextItems : currentItems;
    });
  }, [stockLayersByProductId, products]);

  function updateForm(key, value) {
    setForm((currentForm) => ({ ...currentForm, [key]: value }));
  }

  function handleStatusChange(nextStatus) {
    const nextIssues = enableStockValidation
      ? getSaleStockIssues(
          {
            status: nextStatus,
            items: stockPreviewItems,
          },
          products,
          purchases,
          sales
        )
      : [];

    if (!["draft", "cancelled", "returned"].includes(nextStatus) && nextIssues.length) {
      const message = formatSaleStockIssueMessage(nextIssues, {
        t,
        locale: language === "th" ? "th-TH" : "en-US",
      });
      // Block the promotion: keep the current status (the select reverts) and
      // explain why via the inline banner. No silent downgrade, no window.alert.
      setStatusError(message);
      return;
    }

    setStatusError("");
    updateForm("status", nextStatus);
  }

  function updateItem(itemIndex, key, value) {
    setItems((currentItems) =>
      currentItems.map((item, index) => {
        if (index !== itemIndex) {
          return item;
        }

        return applyAllocationCostSnapshot({ ...item, [key]: value });
      })
    );
  }

  async function loadStockLayers(productId) {
    const cacheKey = getStockLayerKey(productId);
    if (!productId || stockLayersByProductId[cacheKey]) {
      return;
    }

    try {
      const response = await api.getProductStockLayers(productId);
      setStockLayersByProductId((currentLayers) => ({
        ...currentLayers,
        [cacheKey]: Array.isArray(response?.layers) ? response.layers : [],
      }));
    } catch {
      setStockLayersByProductId((currentLayers) => ({
        ...currentLayers,
        [cacheKey]: [],
      }));
    }
  }

  function updateProductQuery(itemIndex, value) {
    setItems((currentItems) => updateProductQueryItems(currentItems, itemIndex, value));
    setItemErrors((currentErrors) => ({ ...currentErrors, [itemIndex]: "" }));
    setOpenProductIndex(itemIndex);
  }

  function selectProduct(itemIndex, product) {
    if (!isProductActive(product)) {
      return;
    }

    setItems((currentItems) =>
      selectProductItems(currentItems, itemIndex, product, purchases)
    );
    loadStockLayers(product.id);
    setItemErrors((currentErrors) => ({ ...currentErrors, [itemIndex]: "" }));
    setOpenProductIndex(null);
  }

  function updateSupplier(itemIndex, supplierName) {
    setItems((currentItems) =>
      updateSupplierItems(currentItems, itemIndex, supplierName, purchases)
    );
  }

  function updateAllocationMode(itemIndex, mode) {
    setItems((currentItems) =>
      currentItems.map((item, index) => {
        if (index !== itemIndex) {
          return item;
        }

        if (mode === "auto") {
          return {
            ...item,
            allocation_mode: "auto",
            allocations: [],
          };
        }

        return {
          ...item,
          allocation_mode: "manual",
          allocations:
            item.allocations && item.allocations.length
              ? item.allocations
              : [createEmptyAllocationRow()],
        };
      })
    );
  }

  function addAllocation(itemIndex) {
    setItems((currentItems) =>
      currentItems.map((item, index) =>
        index === itemIndex
          ? {
              ...item,
              allocations: [...(item.allocations || []), createEmptyAllocationRow()],
            }
          : item
      )
    );
  }

  function removeAllocation(itemIndex, rowId) {
    setItems((currentItems) =>
      currentItems.map((item, index) => {
        if (index !== itemIndex) {
          return item;
        }

        const nextAllocations = (item.allocations || []).filter(
          (allocation) => allocation.row_id !== rowId
        );
        return applyAllocationCostSnapshot({
          ...item,
          allocations: nextAllocations.length ? nextAllocations : [createEmptyAllocationRow()],
        });
      })
    );
  }

  function updateAllocation(itemIndex, rowId, key, value) {
    setItems((currentItems) =>
      currentItems.map((item, index) => {
        if (index !== itemIndex) {
          return item;
        }

        const nextAllocations = (item.allocations || []).map((allocation) =>
          allocation.row_id === rowId ? { ...allocation, [key]: value } : allocation
        );
        return applyAllocationCostSnapshot({
          ...item,
          allocations: nextAllocations,
        });
      })
    );
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

  function selectCustomer(customer) {
    const nextTerms = getCustomerPaymentTerms(customer);
    setForm((currentForm) => ({
      ...currentForm,
      customer_name: customer.companyName,
      ...nextTerms,
    }));
    setCustomerQuery(customer.companyName);
    setCustomerError("");
    setCustomerOpen(false);
  }

  function resolveCustomerName() {
    return resolveSelectedCustomerName(customers, form.customer_name, customerQuery);
  }

  function handleCustomerBlur() {
    const customerName = resolveCustomerName();
    setCustomerError(customerName ? "" : t("salesForm.errorSelectCustomer"));
  }

  function handleProductBlur(index) {
    setItemErrors((currentErrors) => ({
      ...currentErrors,
      [index]: items[index]?.product_id ? "" : t("salesForm.errorSelectProduct"),
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setItemErrors({});

    const customerName = resolveCustomerName();
    const requestedStatus =
      !["draft", "cancelled", "returned"].includes(form.status) && saleStockIssues.length
        ? "draft"
        : form.status;

    if (!customerName) {
      setCustomerError(t("salesForm.errorSelectCustomer"));
      setCustomerOpen(true);
      return;
    }

    const nextItemErrors = {};
    items.forEach((item, index) => {
      if (!item.product_id) {
        nextItemErrors[index] = t("salesForm.errorSelectProduct");
        return;
      }

      if (item.allocation_mode === "manual" && !allocationsMatchItemQuantity(item)) {
        nextItemErrors[index] = t("salesForm.errorAllocationMismatch");
      }
    });

    if (Object.keys(nextItemErrors).length) {
      setItemErrors(nextItemErrors);
      setOpenProductIndex(Number(Object.keys(nextItemErrors)[0]));
      return;
    }

    const belowCostItems = getBelowCostItems(items, activeAllItemsDiscount);

    if (belowCostItems.length) {
      const confirmed = window.confirm(
        buildBelowCostConfirmationMessage(belowCostItems, activeAllItemsDiscount, t)
      );

      if (!confirmed) {
        return;
      }
    }

    const formData = new FormData();
    formData.append("reference_no", form.reference_no);
    formData.append("customer_name", customerName);
    formData.append("customer_po_reference", form.customer_po_reference);
    formData.append("status", requestedStatus);
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

    const filteredItems = buildSaleSubmissionItems(
      items,
      products,
      activeAllItemsDiscount,
      stockLayersByProductId
    );

    const saleWithItems = applySaleStatusToItems(
      {
        status: requestedStatus,
        items: filteredItems,
      },
      requestedStatus
    );
    formData.set("status", getSaleStatusFromItems(saleWithItems));
    formData.append("items", JSON.stringify(saleWithItems.items));

    const saved = await onSubmit(formData);

    if (saved === false) {
      return;
    }

    const nextReference = getNextSalesReferenceAfter(lastGeneratedReference.current);
    lastGeneratedReference.current = nextReference;
    setForm(createInitialForm(nextReference));
    setItems([emptyItem()]);
    setVatMode("not_included");
    setAllItemsDiscountEnabled(false);
    setAllItemsDiscountValue("0");
    setCustomerQuery("");
    setCustomerError("");
    setStatusError("");
    setOpenProductIndex(null);
    setItemErrors({});
    setDraggedItemIndex(null);
  }

  return {
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
    updateAllocationMode,
    addAllocation,
    removeAllocation,
    updateAllocation,
    stockLayersByProductId,
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
    handleCustomerBlur,
    handleProductBlur,
    handleSubmit,
  };
}

export default useSalesFormState;
