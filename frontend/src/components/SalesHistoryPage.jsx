import { useEffect, useMemo, useState } from "react";
import PaginationControls from "./PaginationControls";
import SalesForm from "./SalesForm";
import StatusFilterGroup from "./StatusFilterGroup";
import TransactionTable from "./TransactionTable";
import {
  applySaleStatusToItems,
  getSaleStatusFromItems,
  getStoredSaleItemStatus,
  saleStatuses,
} from "../saleStatus";
import { formatSaleStockIssueMessage, getSaleStockIssues } from "../saleStock";
import {
  buildConvertedItemFields,
  getProductDefaultSalesUnit,
  getProductUnitOptions,
} from "../unitConversion";
import { computePaymentDate, formatMoney as fmt } from "../format";
import {
  FilterPresets,
  ActiveFilterChips,
  RangeField,
  withinRange,
} from "./FilterControls";

const VAT_RATE = 0.07;
const statusOptions = saleStatuses;
const saleStatusPresets = [
  { label: "All", statuses: statusOptions },
  {
    label: "Open",
    statuses: [
      "draft",
      "partially_packed",
      "packed",
      "partially_shipped",
      "shipped",
      "partially_delivered",
    ],
  },
  { label: "Delivered", statuses: ["delivered"] },
  { label: "Cancelled / Returned", statuses: ["cancelled", "returned"] },
];
const vatOptions = [
  { value: "included", label: "Include VAT" },
  { value: "not_included", label: "Exclude VAT" },
];
const defaultCustomerOptions = [];

function getToday() {
  return new Date().toISOString().split("T")[0];
}

function daysAgoString(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDocumentName(documentUrl = "") {
  const [path = ""] = `${documentUrl}`.split("?");
  const name = path.split("/").filter(Boolean).pop();
  return name ? decodeURIComponent(name) : "Attached document";
}

function getTransactionDocuments(sale) {
  if (Array.isArray(sale.documents) && sale.documents.length) {
    return sale.documents;
  }

  return sale.document_url
    ? [
        {
          id: "__legacy_document__",
          name: getDocumentName(sale.document_url),
          url: sale.document_url,
        },
      ]
    : [];
}

function normalize(value) {
  return `${value ?? ""}`.toLowerCase();
}

function saleMatchesQuery(sale, query) {
  const searchableText = [
    sale.reference_no,
    sale.customer_name,
    sale.status,
    sale.transaction_date,
    sale.payment_date,
    sale.payment_term_type,
    sale.payment_term_days,
    sale.customer_po_reference,
    sale.note,
    ...(sale.items || []).flatMap((item) => [
      item.product_name,
      item.sku,
      item.unit,
      item.base_unit,
      item.category,
      item.item_status,
      item.shipped_date,
      item.delivered_date,
      item.quantity,
      item.unit_price,
    ]),
  ]
    .map(normalize)
    .join(" ");

  return searchableText.includes(query);
}

function normalizeCustomerOptions(customers = [], currentCustomerName = "") {
  const normalizedCustomers = customers
    .map((customer) => ({
      id: customer.id || customer.companyName,
      companyName: `${customer.companyName ?? customer.name ?? ""}`.trim(),
    }))
    .filter((customer) => customer.companyName);
  const currentName = currentCustomerName.trim();

  if (
    currentName &&
    !normalizedCustomers.some(
      (customer) => customer.companyName.toLowerCase() === currentName.toLowerCase()
    )
  ) {
    return [{ id: `current-${currentName}`, companyName: currentName }, ...normalizedCustomers];
  }

  return normalizedCustomers;
}

function buildCustomerFilterOptions(sales, customers = []) {
  const optionMap = new Map();

  normalizeCustomerOptions(customers).forEach((customer) => {
    optionMap.set(customer.companyName.toLowerCase(), customer);
  });

  sales.forEach((sale) => {
    const companyName = `${sale.customer_name ?? ""}`.trim();

    if (companyName) {
      optionMap.set(companyName.toLowerCase(), {
        id: `sale-customer-${companyName}`,
        companyName,
      });
    }
  });

  return [...optionMap.values()].sort((a, b) =>
    a.companyName.localeCompare(b.companyName)
  );
}

function transactionMatchesDateRange(transactionDate, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) {
    return true;
  }

  if (!transactionDate) {
    return false;
  }

  if (dateFrom && transactionDate < dateFrom) {
    return false;
  }

  if (dateTo && transactionDate > dateTo) {
    return false;
  }

  return true;
}

function sortRecentTransactions(a, b) {
  const dateCompare = `${b.transaction_date || ""}`.localeCompare(`${a.transaction_date || ""}`);

  if (dateCompare !== 0) {
    return dateCompare;
  }

  return (Number(b.id) || 0) - (Number(a.id) || 0);
}

function getBillDiscountValue(transaction) {
  return Math.min(
    100,
    Math.max(0, Number(transaction?.bill_discount ?? transaction?.billDiscount ?? 0) || 0)
  );
}

function renderBillDiscount(transaction) {
  const discount = getBillDiscountValue(transaction);
  return discount > 0 ? `${discount}%` : "—";
}

function computeAmount(item, transaction = null) {
  const qty = Number(item.quantity) || 0;
  const price = Number(item.unit_price) || 0;
  const multiplier = (item.discounts || []).reduce((acc, discount) => {
    const clamped = Math.min(100, Math.max(0, Number(discount) || 0));
    return acc * (1 - clamped / 100);
  }, 1);

  return qty * price * multiplier * (1 - getBillDiscountValue(transaction) / 100);
}

function formatSalesStatusLabel(status = "") {
  return `${status || "pending"}`
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getSalesItemRemovalMessage(sale, item, itemIndex) {
  const itemStatus = getStoredSaleItemStatus(item, sale.status);
  const quantity = `${item.quantity || 0} ${item.unit || ""}`.trim();
  const baseQuantity = item.base_quantity
    ? ` (${item.base_quantity} ${item.base_unit || item.unit || "base units"})`
    : "";
  const committedStatuses = new Set(["packed", "shipped", "delivered"]);
  const impact = committedStatuses.has(itemStatus)
    ? "This item is already committed to the sales flow. Removing it will release/remove its committed stock usage, delete shipped/delivered date history for this item, and recalculate this sale total and status."
    : "This item is not committed to stock yet. Removing it will delete the customer demand line and recalculate this sale total and status.";

  return [
    `Remove sales item ${itemIndex + 1} from ${sale.reference_no || "this sale"}?`,
    "",
    `Product: ${item.product_name || "Unnamed item"}`,
    `SKU: ${item.sku || "—"}`,
    `Quantity: ${quantity || "—"}${baseQuantity}`,
    `Status: ${formatSalesStatusLabel(itemStatus)}`,
    `Shipped date: ${item.shipped_date || "—"}`,
    `Delivered date: ${item.delivered_date || "—"}`,
    `Line amount: ${fmt(computeAmount(item, sale))}`,
    "",
    impact,
    "This cannot be undone after you save the transaction.",
  ].join("\n");
}

function computeVatSummary(itemTotal, vatMode) {
  if (vatMode === "included") {
    const totalBeforeVat = itemTotal / (1 + VAT_RATE);
    const vat = itemTotal - totalBeforeVat;
    return {
      total: totalBeforeVat,
      vat,
      grandTotal: itemTotal,
    };
  }

  if (vatMode === "not_included") {
    const vat = itemTotal * VAT_RATE;
    return {
      total: itemTotal,
      vat,
      grandTotal: itemTotal + vat,
    };
  }

  return {
    total: itemTotal,
    vat: 0,
    grandTotal: itemTotal,
  };
}

function isVatEnabled(vatMode) {
  return vatMode !== "none";
}

function getProductName(product) {
  return product.name || product.productName || product.product_name || product.sku || `Product ${product.id}`;
}

function getProductSku(product) {
  return product.sku || product.SKU || "";
}

function getProductUnit(product) {
  return getProductDefaultSalesUnit(product);
}

function showStockAlert(message) {
  if (message && typeof window !== "undefined") {
    window.alert(message);
  }
}

function findProductForSaleItem(item, products = []) {
  if (item.product_id) {
    const matchedProduct = products.find(
      (product) => `${product.id}` === `${item.product_id}`
    );

    if (matchedProduct) {
      return matchedProduct;
    }
  }

  const sku = `${item.sku ?? ""}`.trim().toLowerCase();

  if (sku) {
    const matchedBySku = products.find(
      (product) => getProductSku(product).toLowerCase() === sku
    );

    if (matchedBySku) {
      return matchedBySku;
    }
  }

  const productName = `${item.product_name ?? ""}`.trim().toLowerCase();

  return products.find((product) => getProductName(product).toLowerCase() === productName);
}

function createProductValueFromItem(item, products) {
  const matchedProduct = findProductForSaleItem(item, products);

  if (matchedProduct) {
    return `id:${matchedProduct.id}`;
  }

  return item.product_name ? `name:${item.product_name}` : "";
}

function buildProductOptions(products, items) {
  const options = products.map((product) => ({
    value: `id:${product.id}`,
    id: product.id,
    name: getProductName(product),
    sku: getProductSku(product),
  }));

  items.forEach((item) => {
    const name = `${item.product_name ?? ""}`.trim();

    if (
      name &&
      !options.some((option) => option.name.toLowerCase() === name.toLowerCase())
    ) {
      options.push({
        value: `name:${name}`,
        id: "",
        name,
        sku: item.sku || "",
      });
    }
  });

  return options;
}

function createEditItems(sale, products) {
  const sourceItems = sale.items?.length ? sale.items : [];

  if (!sourceItems.length) {
    return [
      {
        id: `sale-${sale.id}-item-new`,
        product_value: "",
        product_id: "",
        product_name: "",
        sku: "",
        unit: "pcs",
        base_unit: "pcs",
        conversion_factor: 1,
        base_quantity: 1,
        item_status: getStoredSaleItemStatus({}, sale.status),
        shipped_date: "",
        delivered_date: "",
        quantity: 1,
        unit_price: "",
        discounts: [0],
      },
    ];
  }

  return sourceItems.map((item, index) => {
    const selectedProduct = findProductForSaleItem(item, products);

    return {
      id: item.id || `sale-${sale.id}-item-${index}`,
      product_value: createProductValueFromItem(item, products),
      product_id: selectedProduct?.id || item.product_id || "",
      product_name: selectedProduct ? getProductName(selectedProduct) : item.product_name || "",
      sku: selectedProduct ? getProductSku(selectedProduct) : item.sku || "",
      unit: item.unit || item.base_unit || "pcs",
      base_unit: item.base_unit || item.unit || "pcs",
      conversion_factor: item.conversion_factor || 1,
      base_quantity: item.base_quantity ?? item.quantity ?? 1,
      item_status: getStoredSaleItemStatus(item, sale.status),
      shipped_date: item.shipped_date || "",
      delivered_date: item.delivered_date || "",
      quantity: item.quantity ?? 1,
      unit_price: item.unit_price ?? "",
      discounts: Array.isArray(item.discounts)
        ? item.discounts
        : Number(item.discount) > 0
          ? [item.discount]
          : [0],
    };
  });
}

function createEditForm(sale) {
  return {
    reference_no: sale.reference_no || "",
    customer_name: sale.customer_name || "",
    customer_po_reference: sale.customer_po_reference || "",
    status: sale.status || "draft",
    payment_term_type: sale.payment_term_type || "",
    payment_term_days: sale.payment_term_days || "",
    transaction_date: sale.transaction_date || getToday(),
    note: sale.note || "",
    new_documents: [],
    remove_document_ids: [],
    remove_document: false,
  };
}

function SalesEditForm({
  sale,
  products,
  customers = defaultCustomerOptions,
  purchases = [],
  sales = [],
  enableStockValidation = true,
  onCancel,
  onSave,
}) {
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
    [items, products]
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
  const saleStockMessage =
    !["draft", "cancelled", "returned"].includes(form.status) && saleStockIssues.length
      ? formatSaleStockIssueMessage(saleStockIssues)
      : "";
  const visibleDocuments = getTransactionDocuments(sale).filter(
    (document) => !form.remove_document_ids.includes(document.id)
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
      const message = formatSaleStockIssueMessage(nextIssues);
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
    setItems((currentItems) =>
      currentItems.map((item, index) =>
        index === itemIndex ? { ...item, [key]: value } : item
      )
    );
  }

  function updateItemProduct(itemIndex, productValue) {
    const selectedProduct = productOptions.find((option) => option.value === productValue);

    setItems((currentItems) =>
      currentItems.map((item, index) =>
        index === itemIndex
          ? {
              ...item,
              product_value: productValue,
              product_id: selectedProduct?.id || "",
              product_name: selectedProduct?.name || "",
              sku: selectedProduct?.sku || "",
              unit: selectedProduct?.id
                ? getProductUnit(products.find((product) => `${product.id}` === `${selectedProduct.id}`))
                : "pcs",
            }
          : item
      )
    );
  }

  function addDiscount(itemIndex) {
    setItems((currentItems) =>
      currentItems.map((item, index) =>
        index === itemIndex
          ? { ...item, discounts: [...(item.discounts || [0]), 0] }
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

        const nextDiscounts = (item.discounts || [0]).filter(
          (_, currentDiscountIndex) => currentDiscountIndex !== discountIndex
        );

        return {
          ...item,
          discounts: nextDiscounts.length ? nextDiscounts : [0],
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

        const nextDiscounts = (item.discounts || [0]).map((discount, currentDiscountIndex) =>
          currentDiscountIndex === discountIndex ? value : discount
        );

        return { ...item, discounts: nextDiscounts };
      })
    );
  }

  function addItem() {
    setItems((currentItems) => [
      ...currentItems,
      {
        id: `sale-${sale.id}-item-${Date.now()}`,
        product_value: "",
        product_id: "",
        product_name: "",
        sku: "",
        unit: "pcs",
        base_unit: "pcs",
        conversion_factor: 1,
        base_quantity: 1,
        item_status: "pending",
        shipped_date: "",
        delivered_date: "",
        quantity: 1,
        unit_price: "",
        discounts: [0],
      },
    ]);
  }

  function removeItem(itemIndex) {
    const item = items[itemIndex];
    const confirmed = window.confirm(
      getSalesItemRemovalMessage(sale, item || {}, itemIndex)
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
      setCustomerError("Select an existing customer from the list.");
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
      setFormError("Add at least one complete sales item.");
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
      payment_date: computePaymentDate(form.transaction_date, form.payment_term_type, form.payment_term_days),
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

  return (
    <section className="section-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Sales Edit</p>
          <h3>Edit Sales Transaction</h3>
        </div>
        <button className="secondary-button table-action-button" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>

      {formError ? <div className="error-banner">{formError}</div> : null}

      <form className="form-layout" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label>
            Reference No.
            <input
              value={form.reference_no}
              onChange={(event) => updateForm("reference_no", event.target.value)}
              placeholder="SO-001"
            />
          </label>

          <label className="supplier-combobox-field">
            Customer Name
            <div className="supplier-combobox">
              <input
                value={customerQuery}
                onChange={(event) => {
                  setCustomerQuery(event.target.value);
                  updateForm("customer_name", "");
                  setCustomerError("");
                  setCustomerOpen(true);
                }}
                onFocus={() => setCustomerOpen(true)}
                onBlur={() => {
                  window.setTimeout(() => setCustomerOpen(false), 120);
                }}
                placeholder="Search existing customer"
                autoComplete="off"
                aria-expanded={customerOpen}
                aria-controls="edit-sales-customer-list"
                aria-invalid={customerError ? "true" : "false"}
              />

              {customerOpen ? (
                <div className="supplier-combobox-menu" id="edit-sales-customer-list" role="listbox">
                  {filteredCustomers.length ? (
                    filteredCustomers.map((customer) => (
                      <button
                        key={customer.id}
                        type="button"
                        className={
                          customer.companyName === form.customer_name
                            ? "supplier-combobox-option active"
                            : "supplier-combobox-option"
                        }
                        onMouseDown={(event) => {
                          event.preventDefault();
                          selectCustomer(customer);
                        }}
                        role="option"
                        aria-selected={customer.companyName === form.customer_name}
                      >
                        {customer.companyName}
                      </button>
                    ))
                  ) : (
                    <div className="supplier-combobox-empty">
                      No customer found. Add it in Customer page first.
                    </div>
                  )}
                </div>
              ) : null}
            </div>
            {customerError ? <span className="field-error-text">{customerError}</span> : null}
          </label>

          <label>
            Status
            <select
              value={form.status}
              onChange={(event) => handleStatusChange(event.target.value)}
            >
              {statusOptions.map((status) => (
                <option
                  key={status}
                  value={status}
                  disabled={status.startsWith("partially_")}
                >
                  {status}
                </option>
              ))}
            </select>
            {saleStockMessage ? (
              <span className="field-error-text">{saleStockMessage}</span>
            ) : null}
          </label>

          <label>
            Transaction Date
            <input
              type="date"
              value={form.transaction_date}
              onChange={(event) => updateForm("transaction_date", event.target.value)}
            />
          </label>

          <label>
            Payment Term
            <select
              value={form.payment_term_type}
              onChange={(event) => {
                const next = event.target.value;
                setForm((f) => ({
                  ...f,
                  payment_term_type: next,
                  payment_term_days: next === "debit" ? "" : f.payment_term_days,
                }));
              }}
            >
              <option value="">— Select payment term —</option>
              <option value="debit">Debit</option>
              <option value="credit">Credit</option>
            </select>
          </label>

          {form.payment_term_type === "credit" && (
            <label>
              Credit Term
              <select
                value={form.payment_term_days}
                onChange={(event) => updateForm("payment_term_days", event.target.value)}
              >
                <option value="">— Select credit term —</option>
                <option value="30 days">30 days</option>
                <option value="60 days">60 days</option>
                <option value="90 days">90 days</option>
              </select>
            </label>
          )}

          <label>
            Payment Date
            <input
              type="date"
              value={computePaymentDate(form.transaction_date, form.payment_term_type, form.payment_term_days)}
              readOnly
              placeholder="Set payment term above"
            />
          </label>

          <label>
            Customer's PO Reference
            <input
              value={form.customer_po_reference}
              onChange={(event) => updateForm("customer_po_reference", event.target.value)}
              placeholder="Optional customer PO reference"
            />
          </label>

          <label className="full-width">
            Notes
            <textarea
              rows="3"
              value={form.note}
              onChange={(event) => updateForm("note", event.target.value)}
            />
          </label>

          <div className="transaction-document-panel full-width">
            <div className="transaction-document-panel-header">
              <div>
                <strong>Documents</strong>
                <span>
                  {visibleDocuments.length + form.new_documents.length
                    ? `${visibleDocuments.length + form.new_documents.length} attached`
                    : "No documents attached"}
                </span>
              </div>
              <label className="document-upload-button">
                Add Files
                <input
                  type="file"
                  multiple
                  onChange={(event) => {
                    updateForm("new_documents", [
                      ...form.new_documents,
                      ...Array.from(event.target.files || []),
                    ]);
                    updateForm("remove_document", false);
                  }}
                />
              </label>
            </div>

            {visibleDocuments.length || form.new_documents.length ? (
              <>
                <div className="transaction-document-list">
                  {visibleDocuments.map((document) => (
                    <span className="transaction-document-row" key={document.id}>
                      <a href={document.url} target="_blank" rel="noreferrer">
                        {document.name || getDocumentName(document.url)}
                      </a>
                      <button
                        className="text-danger-button"
                        type="button"
                        onClick={() =>
                          updateForm("remove_document_ids", [
                            ...form.remove_document_ids,
                            document.id,
                          ])
                        }
                      >
                        Delete
                      </button>
                    </span>
                  ))}
                  {form.new_documents.map((document, index) => (
                    <span className="transaction-document-row" key={`${document.name}-${index}`}>
                      <span>{document.name}</span>
                      <button
                        className="text-danger-button"
                        type="button"
                        onClick={() =>
                          updateForm(
                            "new_documents",
                            form.new_documents.filter((_, documentIndex) => documentIndex !== index)
                          )
                        }
                      >
                        Remove
                      </button>
                    </span>
                  ))}
                </div>
                <div className="transaction-document-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => {
                      updateForm(
                        "remove_document_ids",
                        getTransactionDocuments(sale).map((document) => document.id)
                      );
                      updateForm("new_documents", []);
                    }}
                  >
                    Remove All
                  </button>
                </div>
              </>
            ) : form.remove_document_ids.length ? (
              <div className="transaction-document-state">
                <div>
                  <strong>Documents marked for deletion</strong>
                  <span>Save this transaction to remove the selected documents.</span>
                </div>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => updateForm("remove_document_ids", [])}
                >
                  Undo
                </button>
              </div>
            ) : (
              <p className="transaction-document-empty">Attach invoices, receipts, or related files.</p>
            )}
          </div>
        </div>

        <div className="line-items-card">
          <div className="line-items-header">
            <h4>Sales Items</h4>
            <button className="secondary-button" type="button" onClick={addItem}>
              Add Item
            </button>
          </div>

          {items.map((item, index) => {
            const amount = computeAmount(item, sale);
            const selectedProduct = products.find(
              (product) => `${product.id}` === `${item.product_id}`
            );
            const unitOptions = selectedProduct
              ? getProductUnitOptions(selectedProduct, "sale")
              : [];
            const conversionPreview = selectedProduct
              ? buildConvertedItemFields(selectedProduct, item.quantity, item.unit, "sale")
              : null;

            return (
              <div className="line-item-row sales-line-item-row" key={item.id}>
                <div className="line-item-index" aria-label={`Item ${index + 1}`}>
                  {index + 1}
                </div>

                <label className="purchase-item-field sales-item-product">
                  <span>Product</span>
                  <select
                    value={item.product_value}
                    onChange={(event) => updateItemProduct(index, event.target.value)}
                    required
                  >
                    <option value="">Select product</option>
                    {productOptions.map((product) => (
                      <option key={product.value} value={product.value}>
                        {product.sku ? `${product.name} (${product.sku})` : product.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="purchase-item-field sales-item-unit">
                  <span>Unit</span>
                  {selectedProduct ? (
                    <select
                      value={item.unit}
                      onChange={(event) => updateItem(index, "unit", event.target.value)}
                    >
                      {unitOptions.map((conversion) => (
                        <option key={conversion.unit} value={conversion.unit}>
                          {conversion.unit}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={item.unit}
                      onChange={(event) => updateItem(index, "unit", event.target.value)}
                      placeholder="Unit"
                    />
                  )}
                  {conversionPreview ? (
                    <span className="unit-conversion-preview">
                      {conversionPreview.base_quantity} {conversionPreview.base_unit}
                    </span>
                  ) : null}
                </label>

                <label className="purchase-item-field sales-item-qty">
                  <span>Qty</span>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(event) => updateItem(index, "quantity", event.target.value)}
                    placeholder="Qty"
                    required
                  />
                </label>

                <label className="purchase-item-field sales-item-price">
                  <span>Unit Price</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unit_price}
                    onChange={(event) => updateItem(index, "unit_price", event.target.value)}
                    placeholder="0.00"
                    required
                  />
                </label>

                <div className="purchase-item-field sales-item-discounts">
                  <span>Discounts</span>
                  <div className="sales-discount-cell">
                    {(item.discounts || [0]).map((discount, discountIndex) => (
                      <div key={discountIndex} className="sales-discount-entry">
                        {discountIndex > 0 ? (
                          <span className="sales-discount-chain-label">then</span>
                        ) : null}
                        <input
                          className="sales-discount-input"
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={discount}
                          onChange={(event) =>
                            updateDiscount(index, discountIndex, event.target.value)
                          }
                          placeholder="0"
                        />
                        <span className="sales-discount-pct">%</span>
                        {(item.discounts || [0]).length > 1 ? (
                          <button
                            className="sales-discount-remove"
                            type="button"
                            aria-label="Remove discount"
                            onClick={() => removeDiscount(index, discountIndex)}
                          >
                            X
                          </button>
                        ) : null}
                      </div>
                    ))}
                    <button
                      className="sales-discount-add"
                      type="button"
                      onClick={() => addDiscount(index)}
                    >
                      + Add
                    </button>
                  </div>
                </div>

                <div className="purchase-item-field sales-item-amount">
                  <span>Amount</span>
                  <div className="sales-line-amount">
                    {fmt(amount)}
                  </div>
                </div>

                <button
                  className="danger-button sales-item-remove"
                  type="button"
                  onClick={() => removeItem(index)}
                  disabled={items.length === 1}
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>

        <section className="purchase-vat-card">
          <div className="purchase-vat-card-header">
            <p className="purchase-vat-label">VAT Setting</p>
            <label className="vat-toggle">
              <input
                type="checkbox"
                checked={isVatEnabled(vatMode)}
                onChange={(event) =>
                  setVatMode(event.target.checked ? "not_included" : "none")
                }
              />
              <span className="vat-toggle-track" />
              <span className="vat-toggle-text">
                {isVatEnabled(vatMode) ? "On" : "Off"}
              </span>
            </label>
          </div>
          {isVatEnabled(vatMode) ? (
            <div className="purchase-vat-options" role="radiogroup" aria-label="Edit sales VAT setting">
              {vatOptions.map((option) => (
                <label
                  key={option.value}
                  className={vatMode === option.value ? "purchase-vat-option active" : "purchase-vat-option"}
                >
                  <input
                    type="radio"
                    name={`edit-sales-vat-mode-${sale.id}`}
                    value={option.value}
                    checked={vatMode === option.value}
                    onChange={(event) => setVatMode(event.target.value)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          ) : null}
        </section>

        <div className="sales-summary-card">
          {renderBillDiscount(sale) !== "—" ? (
            <div className="sales-summary-row">
              <span>Bill Discount</span>
              <span>{renderBillDiscount(sale)}</span>
            </div>
          ) : null}
          {isVatEnabled(vatMode) ? (
            <>
              <div className="sales-summary-row">
                <span>Total</span>
                <span>{fmt(vatSummary.total)}</span>
              </div>
              <div className="sales-summary-row">
                <span>VAT (7%)</span>
                <span>{fmt(vatSummary.vat)}</span>
              </div>
            </>
          ) : null}
          <div className="sales-summary-row sales-summary-grand">
            <strong>Grand Total</strong>
            <strong>{fmt(vatSummary.grandTotal)}</strong>
          </div>
        </div>

        <div className="supplier-modal-actions">
          <button className="secondary-button" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button className="primary-button" type="submit">
            Save Sale
          </button>
        </div>
      </form>
    </section>
  );
}

function SalesHistoryPage({
  sales,
  allSales = sales,
  products = [],
  suppliers = [],
  purchases = [],
  enableStockValidation = true,
  pagination = null,
  customers = defaultCustomerOptions,
  onPageRequest,
  onCreateSale,
  onSaleStatusChange,
  onSaleUpdate,
  onSaleDelete,
  onWarning,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState(statusOptions);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [customerFilterQuery, setCustomerFilterQuery] = useState("");
  const [customerFilterOpen, setCustomerFilterOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [vatFilter, setVatFilter] = useState("all");
  const [editingSale, setEditingSale] = useState(null);
  const [showNewSaleForm, setShowNewSaleForm] = useState(false);
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const isServerPaginated = Boolean(pagination && onPageRequest);
  const selectedStatusKey = selectedStatuses.join(",");
  const activeFilterCount =
    (selectedCustomer ? 1 : 0) +
    (selectedStatuses.length === statusOptions.length ? 0 : 1) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0) +
    (amountMin ? 1 : 0) +
    (amountMax ? 1 : 0) +
    (vatFilter === "all" ? 0 : 1);
  const customerOptions = useMemo(
    () => buildCustomerFilterOptions(allSales, customers),
    [allSales, customers]
  );
  const filteredCustomerOptions = useMemo(() => {
    const normalizedQuery = customerFilterQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return customerOptions;
    }

    return customerOptions.filter((customer) =>
      customer.companyName.toLowerCase().includes(normalizedQuery)
    );
  }, [customerFilterQuery, customerOptions]);

  const filteredSales = useMemo(() => {
    if (isServerPaginated) {
      return [...sales].sort(sortRecentTransactions);
    }

    return sales.filter((sale) => {
      const matchesSearch = normalizedSearch
        ? saleMatchesQuery(sale, normalizedSearch)
        : true;
      const matchesStatus = selectedStatuses.includes(sale.status);
      const matchesCustomer = selectedCustomer
        ? sale.customer_name === selectedCustomer
        : true;
      const matchesDateRange = transactionMatchesDateRange(
        sale.transaction_date,
        dateFrom,
        dateTo
      );
      const matchesAmount = withinRange(sale.grand_total, amountMin, amountMax);
      const matchesVat = vatFilter === "all" || sale.vat_mode === vatFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesCustomer &&
        matchesDateRange &&
        matchesAmount &&
        matchesVat
      );
    }).sort(sortRecentTransactions);
  }, [
    amountMin,
    amountMax,
    dateFrom,
    dateTo,
    isServerPaginated,
    normalizedSearch,
    sales,
    selectedCustomer,
    selectedStatuses,
    vatFilter,
  ]);
  const totalSalesCount = pagination?.count ?? sales.length;

  function getPageRequestParams(page = 1) {
    return {
      page,
      search: searchTerm,
      statuses:
        selectedStatuses.length === statusOptions.length
          ? ""
          : selectedStatuses.length
            ? selectedStatuses
            : "__none__",
      customer: selectedCustomer,
      dateFrom,
      dateTo,
      amountMin,
      amountMax,
      vatMode: vatFilter === "all" ? "" : vatFilter,
    };
  }

  useEffect(() => {
    if (!isServerPaginated) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      onPageRequest(getPageRequestParams(1));
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [
    amountMin,
    amountMax,
    dateFrom,
    dateTo,
    isServerPaginated,
    onPageRequest,
    searchTerm,
    selectedCustomer,
    selectedStatusKey,
    vatFilter,
  ]);

  function selectCustomerFilter(customer) {
    setSelectedCustomer(customer.companyName);
    setCustomerFilterQuery(customer.companyName);
    setCustomerFilterOpen(false);
  }

  function resetFilters() {
    setSearchTerm("");
    setSelectedStatuses(statusOptions);
    setSelectedCustomer("");
    setCustomerFilterQuery("");
    setDateFrom("");
    setDateTo("");
    setAmountMin("");
    setAmountMax("");
    setVatFilter("all");
    setFilterOpen(false);
    setCustomerFilterOpen(false);
  }

  const vatLabels = { included: "Include VAT", not_included: "Exclude VAT" };
  const last30Active = dateFrom === daysAgoString(30) && !dateTo;
  const quickPresets = [
    {
      label: "Last 30 days",
      active: last30Active,
      onClick: () => {
        setDateFrom(last30Active ? "" : daysAgoString(30));
        setDateTo("");
      },
    },
  ].filter(Boolean);
  const activeChips = [
    selectedCustomer && {
      key: "customer",
      label: `Customer: ${selectedCustomer}`,
      onRemove: () => {
        setSelectedCustomer("");
        setCustomerFilterQuery("");
      },
    },
    selectedStatuses.length !== statusOptions.length && {
      key: "status",
      label: `Status: ${
        selectedStatuses.length
          ? selectedStatuses.map(formatSalesStatusLabel).join(", ")
          : "None"
      }`,
      onRemove: () => setSelectedStatuses(statusOptions),
    },
    vatFilter !== "all" && {
      key: "vat",
      label: `VAT: ${vatLabels[vatFilter] || vatFilter}`,
      onRemove: () => setVatFilter("all"),
    },
    dateFrom && {
      key: "dateFrom",
      label: `From ${dateFrom}`,
      onRemove: () => setDateFrom(""),
    },
    dateTo && {
      key: "dateTo",
      label: `To ${dateTo}`,
      onRemove: () => setDateTo(""),
    },
    amountMin && {
      key: "amountMin",
      label: `Min ฿${amountMin}`,
      onRemove: () => setAmountMin(""),
    },
    amountMax && {
      key: "amountMax",
      label: `Max ฿${amountMax}`,
      onRemove: () => setAmountMax(""),
    },
  ].filter(Boolean);

  async function handleSave(updatedSale) {
    const saved = await onSaleUpdate?.(updatedSale);

    if (saved === false) {
      return;
    }

    setEditingSale(null);
  }

  async function handleCreateSale(formData) {
    const saved = await onCreateSale?.(formData);

    if (saved === false) {
      return false;
    }

    setShowNewSaleForm(false);
    return true;
  }

  async function handleDelete(deletedSale) {
    const deleted = await onSaleDelete?.(deletedSale);

    if (deleted === false) {
      return;
    }

    setEditingSale((currentSale) =>
      currentSale?.id === deletedSale.id ? null : currentSale
    );
  }

  if (showNewSaleForm) {
    return (
      <div className="stack-layout">
        <SalesForm
          products={products}
          customers={customers}
          suppliers={suppliers}
          purchases={purchases}
          sales={allSales}
          enableStockValidation={enableStockValidation}
          onSubmit={handleCreateSale}
          onCancel={() => setShowNewSaleForm(false)}
        />
      </div>
    );
  }

  if (editingSale) {
    return (
      <div className="stack-layout">
        <SalesEditForm
          key={editingSale.id}
          sale={editingSale}
          products={products}
          customers={customers}
          purchases={purchases}
          sales={allSales}
          enableStockValidation={enableStockValidation}
          onCancel={() => setEditingSale(null)}
          onSave={handleSave}
        />
      </div>
    );
  }

  return (
    <div className="stack-layout">
      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">History Search</p>
            <h3>Find Sales Records</h3>
          </div>
        </div>

        <div className="supplier-directory-toolbar">
          <label className="stock-search supplier-search">
            <span className="stock-search-icon">S</span>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search reference, customer, status, date, note, or item"
            />
          </label>
          <div className="stock-report-summary supplier-search-meta">
            <span>
              {isServerPaginated
                ? `${filteredSales.length} on this page of ${totalSalesCount} sales`
                : `${filteredSales.length} of ${sales.length} sales shown`}
            </span>
          </div>
        </div>

        <div className="history-filter-actions">
          <button
            className="secondary-button product-filter-toggle"
            type="button"
            aria-expanded={filterOpen}
            onClick={() => setFilterOpen((currentValue) => !currentValue)}
          >
            Filter
            {activeFilterCount ? <span>{activeFilterCount}</span> : null}
          </button>
          <button className="secondary-button" type="button" onClick={resetFilters}>
            Reset Filter
          </button>
        </div>

        <FilterPresets presets={quickPresets} />
        <ActiveFilterChips chips={activeChips} onClearAll={resetFilters} />

        {filterOpen ? (
          <div className="history-filter-panel">
            <div className="history-filter-grid">
              <label className="history-filter-field supplier-combobox-field">
                <span className="history-filter-title">Customer</span>
                <div className="supplier-combobox">
                  <input
                    type="search"
                    value={customerFilterQuery}
                    onChange={(event) => {
                      setCustomerFilterQuery(event.target.value);
                      setSelectedCustomer("");
                      setCustomerFilterOpen(true);
                    }}
                    onFocus={() => setCustomerFilterOpen(true)}
                    onBlur={() => {
                      window.setTimeout(() => setCustomerFilterOpen(false), 120);
                    }}
                    placeholder="Search customer"
                    autoComplete="off"
                    aria-expanded={customerFilterOpen}
                    aria-controls="sales-history-customer-filter"
                  />

                  {customerFilterOpen ? (
                    <div
                      className="supplier-combobox-menu"
                      id="sales-history-customer-filter"
                      role="listbox"
                    >
                      {filteredCustomerOptions.length ? (
                        filteredCustomerOptions.map((customer) => (
                          <button
                            key={customer.id}
                            type="button"
                            className={
                              customer.companyName === selectedCustomer
                                ? "supplier-combobox-option active"
                                : "supplier-combobox-option"
                            }
                            onMouseDown={(event) => {
                              event.preventDefault();
                              selectCustomerFilter(customer);
                            }}
                            role="option"
                            aria-selected={customer.companyName === selectedCustomer}
                          >
                            {customer.companyName}
                          </button>
                        ))
                      ) : (
                        <div className="supplier-combobox-empty">No customer found.</div>
                      )}
                    </div>
                  ) : null}
                </div>
              </label>

              <label className="history-filter-field">
                <span className="history-filter-title">Date From</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                />
              </label>

              <label className="history-filter-field">
                <span className="history-filter-title">Date To</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                />
              </label>

              <RangeField
                title="Amount (฿)"
                prefix="฿"
                minValue={amountMin}
                maxValue={amountMax}
                onMinChange={setAmountMin}
                onMaxChange={setAmountMax}
              />

              <label className="history-filter-field">
                <span className="history-filter-title">VAT</span>
                <select
                  value={vatFilter}
                  onChange={(event) => setVatFilter(event.target.value)}
                >
                  <option value="all">All VAT settings</option>
                  {vatOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <StatusFilterGroup
              title="Sales Status"
              statuses={statusOptions}
              selectedStatuses={selectedStatuses}
              presets={saleStatusPresets}
              formatStatusLabel={formatSalesStatusLabel}
              onChange={setSelectedStatuses}
            />
          </div>
        ) : null}
      </section>

      <TransactionTable
        rows={filteredSales}
        products={products}
        purchases={purchases}
        sales={allSales}
        enableSaleStockPrecheck={enableStockValidation}
        type="sale"
        onSaleStatusChange={onSaleStatusChange}
        onSaleUpdate={onSaleUpdate}
        onWarning={onWarning}
        onEditRow={setEditingSale}
        onDeleteRow={handleDelete}
        compactRows={isServerPaginated ? 0 : 5}
        enableViewAll={!isServerPaginated}
        headerActions={
          <button
            className="primary-button"
            type="button"
            onClick={() => {
              setEditingSale(null);
              setShowNewSaleForm(true);
            }}
          >
            New Sale
          </button>
        }
      />
      <PaginationControls
        pagination={pagination}
        itemLabel="sales"
        onPageChange={(page) => onPageRequest?.(getPageRequestParams(page))}
      />
    </div>
  );
}

export default SalesHistoryPage;
