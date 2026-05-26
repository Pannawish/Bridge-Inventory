import { useEffect, useMemo, useRef, useState } from "react";
import { computePaymentDate, formatMoney as fmt } from "../../format";
import { useLanguage } from "../../i18n/LanguageContext";
import { applySaleStatusToItems, getSaleStatusFromItems } from "../../saleStatus";
import { formatSaleStockIssueMessage, getSaleStockIssues } from "../../saleStock";
import { buildConvertedItemFields } from "../../unitConversion";
import { getActiveTransactionDiscount } from "../transactionDiscounts";
import { isProductActive } from "../products/productUtils";
import {
  computeAmount,
  computeVatSummary,
  createInitialForm,
  createInitialItems,
  emptyItem,
  getCustomerPaymentTerms,
  getLatestSupplierCost,
  getLineLoss,
  getNextSalesReference,
  getNextSalesReferenceAfter,
  getProductName,
  getProductSku,
  getProductUnit,
  showStockAlert,
  vatOptionValues,
} from "./salesFormUtils";

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
    () =>
      items
        .filter((item) => item.product_id && item.quantity)
        .map((item) => {
          const selectedProduct = products.find(
            (product) => `${product.id}` === `${item.product_id}`
          );

          return {
            product_id: item.product_id,
            product_name: selectedProduct ? getProductName(selectedProduct) : item.product_name,
            sku: selectedProduct ? getProductSku(selectedProduct) : item.sku,
            ...(selectedProduct
              ? buildConvertedItemFields(selectedProduct, item.quantity, item.unit, "sale")
              : {
                  unit: item.unit || "pcs",
                  base_unit: item.unit || "pcs",
                  conversion_factor: 1,
                  base_quantity: Number(item.quantity) || 0,
                }),
            quantity: Number(item.quantity) || 0,
          };
        }),
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
      updateForm("status", "draft");
      setStatusError(message);
      showStockAlert(message);
      return;
    }

    setStatusError("");
    updateForm("status", nextStatus);
  }

  function updateItem(itemIndex, key, value) {
    setItems((currentItems) =>
      currentItems.map((item, index) =>
        index === itemIndex ? { ...item, [key]: value } : item
      )
    );
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

    const productName = getProductName(product);
    const sku = getProductSku(product);

    setItems((currentItems) =>
      currentItems.map((item, index) => {
        if (index !== itemIndex) {
          return item;
        }

        const nextItem = {
          ...item,
          product_id: product.id,
          product_query: sku ? `${productName} (${sku})` : productName,
          product_name: productName,
          sku,
          unit: getProductUnit(product),
        };
        const suggestedCost = getLatestSupplierCost(
          purchases,
          product.id,
          item.supplier_name
        );

        if (suggestedCost != null) {
          nextItem.unit_cost = `${suggestedCost}`;
        }

        return nextItem;
      })
    );
    setItemErrors((currentErrors) => ({ ...currentErrors, [itemIndex]: "" }));
    setOpenProductIndex(null);
  }

  function updateSupplier(itemIndex, supplierName) {
    setItems((currentItems) =>
      currentItems.map((item, index) => {
        if (index !== itemIndex) {
          return item;
        }

        const nextItem = { ...item, supplier_name: supplierName };
        const suggestedCost = getLatestSupplierCost(
          purchases,
          item.product_id,
          supplierName
        );

        if (suggestedCost != null) {
          nextItem.unit_cost = `${suggestedCost}`;
        }

        return nextItem;
      })
    );
  }

  function addDiscount(itemIndex) {
    setItems((currentItems) =>
      currentItems.map((item, index) =>
        index === itemIndex
          ? { ...item, discounts: [...item.discounts, ""] }
          : item
      )
    );
  }

  function removeDiscount(itemIndex, discountIndex) {
    setItems((currentItems) =>
      currentItems.map((item, index) => {
        if (index !== itemIndex) {
          return item;
        }

        const nextDiscounts = item.discounts.filter(
          (_, currentDiscountIndex) => currentDiscountIndex !== discountIndex
        );
        return { ...item, discounts: nextDiscounts.length === 0 ? [""] : nextDiscounts };
      })
    );
  }

  function updateDiscount(itemIndex, discountIndex, value) {
    setItems((currentItems) =>
      currentItems.map((item, index) => {
        if (index !== itemIndex) {
          return item;
        }

        const nextDiscounts = item.discounts.map((discount, currentDiscountIndex) =>
          currentDiscountIndex === discountIndex ? value : discount
        );
        return { ...item, discounts: nextDiscounts };
      })
    );
  }

  function addItem() {
    setItems((currentItems) => [...currentItems, emptyItem()]);
  }

  function removeItem(index) {
    setItems((currentItems) => currentItems.filter((_, itemIndex) => itemIndex !== index));
  }

  function reorderItems(fromIndex, toIndex) {
    if (fromIndex === toIndex) {
      return;
    }

    setItems((currentItems) => {
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= currentItems.length ||
        toIndex >= currentItems.length
      ) {
        return currentItems;
      }

      const nextItems = [...currentItems];
      const [movedItem] = nextItems.splice(fromIndex, 1);
      nextItems.splice(toIndex, 0, movedItem);
      return nextItems;
    });
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
    const selectedCustomer = customers.find(
      (customer) => customer.companyName === form.customer_name
    );

    if (selectedCustomer) {
      return selectedCustomer.companyName;
    }

    const exactMatch = customers.find(
      (customer) =>
        customer.companyName.toLowerCase() === customerQuery.trim().toLowerCase()
    );

    return exactMatch?.companyName || "";
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
      }
    });

    if (Object.keys(nextItemErrors).length) {
      setItemErrors(nextItemErrors);
      setOpenProductIndex(Number(Object.keys(nextItemErrors)[0]));
      return;
    }

    const belowCostItems = items.filter(
      (item) =>
        item.product_id &&
        item.quantity &&
        item.unit_price &&
        getLineLoss(item, activeAllItemsDiscount) > 0
    );

    if (belowCostItems.length) {
      const lines = belowCostItems
        .map(
          (item) =>
            `• ${item.product_name || t("salesForm.unnamedItem")} - ${t("salesForm.belowCostBy")} ${fmt(
              getLineLoss(item, activeAllItemsDiscount)
            )}`
        )
        .join("\n");
      const confirmed = window.confirm(
        `${belowCostItems.length} ${t("salesForm.belowCostConfirm")}\n\n${lines}\n\n${t("salesForm.belowCostSaveAnyway")}`
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

    const filteredItems = items
      .filter((item) => item.product_id && item.quantity && item.unit_price)
      .map((item) => {
        const { line_id, ...itemPayload } = item;
        const selectedProduct = products.find(
          (product) => `${product.id}` === `${item.product_id}`
        );

        return {
          ...itemPayload,
          product_name: selectedProduct ? getProductName(selectedProduct) : item.product_name,
          sku: selectedProduct ? getProductSku(selectedProduct) : item.sku,
          discounts: item.discounts,
          ...(selectedProduct
            ? buildConvertedItemFields(selectedProduct, item.quantity, item.unit, "sale")
            : {}),
          amount: computeAmount(item, activeAllItemsDiscount),
        };
      });

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
  };
}

export default useSalesFormState;
