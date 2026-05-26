import { useMemo, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import {
  applySaleStatusToItems,
  getSaleStatusFromItems,
  getStoredSaleItemStatus,
} from "../../saleStatus";
import { formatSaleStockIssueMessage, getSaleStockIssues } from "../../saleStock";
import { buildConvertedItemFields } from "../../unitConversion";
import {
  computeAmount,
  computeVatSummary,
  createEditForm,
  createEditItems,
  defaultCustomerOptions,
  getComputedPaymentDate,
  getSalesItemRemovalMessage,
  getTransactionDocuments,
  normalizeCustomerOptions,
  vatOptionValues,
} from "./salesHistoryUtils";
import {
  updateItemHelper,
  updateItemProductHelper,
  addDiscountHelper,
  removeDiscountHelper,
  updateDiscountHelper,
  addItemHelper,
} from "./salesEditFormStateHelpers";

function showStockAlert(message) {
  if (message && typeof window !== "undefined") {
    window.alert(message);
  }
}

export function useSalesEditFormState({
  sale,
  products,
  customers = defaultCustomerOptions,
  purchases = [],
  sales = [],
  enableStockValidation = true,
  onCancel,
  onSave,
}) {
  const { language, t } = useLanguage();
  const [form, setForm] = useState(() => createEditForm(sale));
  const [items, setItems] = useState(() => createEditItems(sale, products));
  const [vatMode, setVatMode] = useState(sale.vat_mode || "not_included");
  const [customerQuery, setCustomerQuery] = useState(sale.customer_name || "");
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerError, setCustomerError] = useState("");
  const [formError, setFormError] = useState("");

  const filteredCustomers = useMemo(() => {
    const normalizedQuery = customerQuery.trim().toLowerCase();
    const customerOptions = normalizeCustomerOptions(customers, sale.customer_name || "");

    if (!normalizedQuery) {
      return customerOptions;
    }

    return customerOptions.filter((customer) =>
      customer.companyName.toLowerCase().includes(normalizedQuery)
    );
  }, [customerQuery, customers, sale.customer_name]);

  const productOptions = useMemo(
    () => buildProductOptions(products, items),
    [items, products]
  );

  // Helper inside useMemo to resolve dynamic product option list
  function buildProductOptions(productsList, itemsList) {
    const activeProducts = productsList.filter((product) => product.isActive);
    const existingIds = new Set(
      itemsList.map((item) => `${item.product_id}`).filter(Boolean)
    );

    const merged = [
      ...activeProducts,
      ...productsList.filter(
        (product) => !product.isActive && existingIds.has(`${product.id}`)
      ),
    ];

    return merged.map((product) => ({
      value: product.productDisplayId || product.id,
      id: product.id,
      sku: product.sku || "",
      name: product.productName || "",
      label: product.sku
        ? `${product.productName || ""} (${product.sku})`
        : product.productName || "",
    }));
  }

  const itemTotal = items.reduce((sum, item) => sum + computeAmount(item, sale), 0);
  const vatSummary = computeVatSummary(itemTotal, vatMode);

  const stockPreviewItems = useMemo(
    () =>
      items
        .filter((item) => item.product_name && item.quantity)
        .map((item) => {
          const selectedProduct = products.find(
            (product) => `${product.id}` === `${item.product_id}`
          );

          return {
            product_id: item.product_id || undefined,
            product_name: item.product_name,
            sku: item.sku,
            item_status: getStoredSaleItemStatus(item, form.status),
            ...(selectedProduct
              ? buildConvertedItemFields(selectedProduct, item.quantity, item.unit, "sale")
              : {
                  unit: item.unit || "pcs",
                  base_unit: item.base_unit || item.unit || "pcs",
                  conversion_factor: Number(item.conversion_factor) || 1,
                  base_quantity:
                    (Number(item.quantity) || 0) * (Number(item.conversion_factor) || 1),
                }),
            quantity: Number(item.quantity) || 0,
          };
        }),
    [items, products, form.status]
  );

  const saleStockIssues = useMemo(
    () =>
      enableStockValidation
        ? getSaleStockIssues(
            {
              ...sale,
              status: form.status,
              items: stockPreviewItems,
            },
            products,
            purchases,
            sales,
            { excludeSaleId: sale.id, currentSale: sale }
          )
        : [],
    [enableStockValidation, form.status, products, purchases, sale, sales, stockPreviewItems]
  );

  const saleStockMessage = useMemo(
    () =>
      !["draft", "cancelled", "returned"].includes(form.status) && saleStockIssues.length
        ? formatSaleStockIssueMessage(saleStockIssues, {
            t,
            locale: language === "th" ? "th-TH" : "en-US",
          })
        : "",
    [form.status, saleStockIssues, t, language]
  );

  const visibleDocuments = useMemo(
    () =>
      getTransactionDocuments(sale, t).filter(
        (document) => !form.remove_document_ids.includes(document.id)
      ),
    [sale, t, form.remove_document_ids]
  );

  function updateForm(key, value) {
    setForm((currentForm) => ({ ...currentForm, [key]: value }));
  }

  function handleStatusChange(nextStatus) {
    const nextIssues = enableStockValidation
      ? getSaleStockIssues(
          {
            ...sale,
            status: nextStatus,
            items: stockPreviewItems,
          },
          products,
          purchases,
          sales,
          { excludeSaleId: sale.id, currentSale: sale }
        )
      : [];

    if (!["draft", "cancelled", "returned"].includes(nextStatus) && nextIssues.length) {
      const message = formatSaleStockIssueMessage(nextIssues, {
        t,
        locale: language === "th" ? "th-TH" : "en-US",
      });
      updateForm("status", "draft");
      setFormError(message);
      showStockAlert(message);
      return;
    }

    setFormError("");
    updateForm("status", nextStatus);
  }

  function selectCustomer(customer) {
    setForm((currentForm) => ({
      ...currentForm,
      customer_name: customer.companyName,
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

  function updateItem(itemIndex, key, value) {
    setItems((currentItems) => updateItemHelper(currentItems, itemIndex, key, value));
  }

  function updateItemProduct(itemIndex, productValue) {
    setItems((currentItems) =>
      updateItemProductHelper(currentItems, itemIndex, productValue, productOptions, products)
    );
  }

  function addDiscount(itemIndex) {
    setItems((currentItems) => addDiscountHelper(currentItems, itemIndex));
  }

  function removeDiscount(itemIndex, discountIndex) {
    setItems((currentItems) => removeDiscountHelper(currentItems, itemIndex, discountIndex));
  }

  function updateDiscount(itemIndex, discountIndex, value) {
    setItems((currentItems) => updateDiscountHelper(currentItems, itemIndex, discountIndex, value));
  }

  function addItem() {
    setItems((currentItems) => addItemHelper(currentItems, sale.id));
  }

  function removeItem(itemIndex) {
    const item = items[itemIndex];
    const confirmed = window.confirm(
      getSalesItemRemovalMessage(sale, item || {}, itemIndex, t)
    );

    if (!confirmed) {
      return;
    }

    setItems((currentItems) => currentItems.filter((_, index) => index !== itemIndex));
  }

  function handleSubmit(event) {
    event.preventDefault();
    setFormError("");

    const customerName = resolveCustomerName();

    if (!customerName) {
      setCustomerError(t("salesForm.errorSelectCustomer"));
      setCustomerOpen(true);
      return;
    }

    const normalizedItems = items
      .filter((item) => item.product_name && item.quantity && item.unit_price)
      .map((item) => {
        const amount = computeAmount(item, sale);
        const selectedProduct = products.find(
          (product) => `${product.id}` === `${item.product_id}`
        );
        const convertedFields = selectedProduct
          ? buildConvertedItemFields(selectedProduct, item.quantity, item.unit, "sale")
          : {
              unit: item.unit || "pcs",
              base_unit: item.base_unit || item.unit || "pcs",
              conversion_factor: Number(item.conversion_factor) || 1,
              base_quantity:
                (Number(item.quantity) || 0) * (Number(item.conversion_factor) || 1),
            };

        return {
          id: item.id,
          product_id: item.product_id || undefined,
          product_name: item.product_name,
          sku: item.sku,
          ...convertedFields,
          item_status: getStoredSaleItemStatus(item, form.status),
          shipped_date: item.shipped_date || "",
          delivered_date: item.delivered_date || "",
          quantity: Number(item.quantity) || 0,
          unit_price: Number(item.unit_price) || 0,
          discounts: item.discounts || [0],
          amount,
          line_total: amount,
        };
      });

    if (!normalizedItems.length) {
      setFormError(t("salesForm.errorAddItem"));
      return;
    }

    const requestedStatus =
      !["draft", "cancelled", "returned"].includes(form.status) && saleStockIssues.length
        ? "draft"
        : form.status;
    const shouldApplyRequestedStatus =
      requestedStatus !== (sale.status || "draft") || requestedStatus !== form.status;
    const saleWithItems = shouldApplyRequestedStatus
      ? applySaleStatusToItems(
          {
            ...sale,
            status: requestedStatus,
            items: normalizedItems,
          },
          requestedStatus
        )
      : {
          ...sale,
          items: normalizedItems,
          status: getSaleStatusFromItems({
            ...sale,
            items: normalizedItems,
          }),
        };

    onSave({
      ...saleWithItems,
      reference_no: form.reference_no,
      customer_name: customerName,
      customer_po_reference: form.customer_po_reference,
      status: getSaleStatusFromItems(saleWithItems),
      payment_term_type: form.payment_term_type,
      payment_term_days: form.payment_term_type === "credit" ? form.payment_term_days : "",
      payment_date: getComputedPaymentDate(form),
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
        : visibleDocuments[0]?.url || sale.document_url,
      items: saleWithItems.items,
      vat_mode: vatMode,
      total_before_vat: vatSummary.total,
      vat_amount: vatSummary.vat,
      grand_total: vatSummary.grandTotal,
      total_amount: vatSummary.grandTotal,
    });
  }

  const vatOptions = useMemo(
    () =>
      vatOptionValues.map((v) => ({
        value: v,
        label: v === "included" ? t("salesForm.vatIncluded") : t("salesForm.vatExcluded"),
      })),
    [t]
  );

  return {
    form,
    items,
    vatMode,
    customerQuery,
    customerOpen,
    customerError,
    formError,
    filteredCustomers,
    productOptions,
    itemTotal,
    vatSummary,
    stockPreviewItems,
    saleStockIssues,
    saleStockMessage,
    visibleDocuments,
    updateForm,
    setVatMode,
    setCustomerQuery,
    setCustomerError,
    setCustomerOpen,
    setFormError,
    handleStatusChange,
    selectCustomer,
    resolveCustomerName,
    updateItem,
    updateItemProduct,
    addDiscount,
    removeDiscount,
    updateDiscount,
    addItem,
    removeItem,
    handleSubmit,
    vatOptions,
    t,
  };
}
