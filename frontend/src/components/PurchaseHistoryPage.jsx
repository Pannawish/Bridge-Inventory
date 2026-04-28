import { useMemo, useState } from "react";
import PurchaseForm from "./PurchaseForm";
import TransactionTable from "./TransactionTable";
import {
  formatStatusLabel,
  getInitialPurchaseItemStatus,
  getPurchaseItemDisplayStatus,
  getPurchaseStatusFromItems,
  getStoredPurchaseItemStatus,
  getTodayString,
  purchaseStatuses,
} from "../purchaseStatus";
import {
  buildConvertedItemFields,
  getProductUnitOptions,
} from "../unitConversion";

const VAT_RATE = 0.07;
const statusOptions = purchaseStatuses;
const vatOptions = [
  { value: "included", label: "VAT Included" },
  { value: "not_included", label: "VAT Not Included" },
  { value: "none", label: "No VAT" },
];
const defaultSupplierOptions = [];

function getToday() {
  return getTodayString();
}

function getDocumentName(documentUrl = "") {
  const [path = ""] = `${documentUrl}`.split("?");
  const name = path.split("/").filter(Boolean).pop();
  return name ? decodeURIComponent(name) : "Attached document";
}

function normalize(value) {
  return `${value ?? ""}`.toLowerCase();
}

function purchaseMatchesQuery(purchase, query) {
  const searchableText = [
    purchase.reference_no,
    purchase.supplier_name,
    purchase.status,
    purchase.transaction_date,
    purchase.note,
    purchase.supplier_tax_invoice,
    ...(purchase.items || []).flatMap((item) => [
      item.product_name,
      item.sku,
      item.unit,
      item.base_unit,
      item.expected_delivery_date,
      item.received_date,
      getPurchaseItemDisplayStatus(item, purchase.status),
      item.lead_time_days,
      item.quantity,
      item.unit_cost,
    ]),
  ]
    .map(normalize)
    .join(" ");

  return searchableText.includes(query);
}

function normalizeSupplierOptions(suppliers = [], currentSupplierName = "") {
  const normalizedSuppliers = suppliers
    .map((supplier) => ({
      id: supplier.id || supplier.companyName,
      companyName: `${supplier.companyName ?? supplier.name ?? ""}`.trim(),
    }))
    .filter((supplier) => supplier.companyName);
  const currentName = currentSupplierName.trim();

  if (
    currentName &&
    !normalizedSuppliers.some(
      (supplier) => supplier.companyName.toLowerCase() === currentName.toLowerCase()
    )
  ) {
    return [{ id: `current-${currentName}`, companyName: currentName }, ...normalizedSuppliers];
  }

  return normalizedSuppliers;
}

function buildSupplierFilterOptions(purchases, suppliers = []) {
  const optionMap = new Map();

  normalizeSupplierOptions(suppliers).forEach((supplier) => {
    optionMap.set(supplier.companyName.toLowerCase(), supplier);
  });

  purchases.forEach((purchase) => {
    const companyName = `${purchase.supplier_name ?? ""}`.trim();

    if (companyName) {
      optionMap.set(companyName.toLowerCase(), {
        id: `purchase-supplier-${companyName}`,
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

function computeAmount(item) {
  const qty = Number(item.quantity) || 0;
  const cost = Number(item.unit_cost) || 0;
  const multiplier = (item.discounts || []).reduce((acc, discount) => {
    const clamped = Math.min(100, Math.max(0, Number(discount) || 0));
    return acc * (1 - clamped / 100);
  }, 1);

  return qty * cost * multiplier;
}

function computeLeadTimeDays(transactionDate, expectedDeliveryDate) {
  if (!transactionDate || !expectedDeliveryDate) {
    return "";
  }

  const start = new Date(`${transactionDate}T00:00:00`);
  const end = new Date(`${expectedDeliveryDate}T00:00:00`);
  const diffMs = end.getTime() - start.getTime();

  if (!Number.isFinite(diffMs)) {
    return "";
  }

  return Math.max(0, Math.round(diffMs / 86400000));
}

function fmt(value) {
  return `฿${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getPurchaseItemRemovalMessage(purchase, item, itemIndex) {
  const displayStatus = getPurchaseItemDisplayStatus(item, purchase.status);
  const quantity = `${item.quantity || 0} ${item.unit || ""}`.trim();
  const baseQuantity = item.base_quantity
    ? ` (${item.base_quantity} ${item.base_unit || item.unit || "base units"})`
    : "";
  const impact =
    displayStatus === "received"
      ? "This item is already received. Removing it will remove its received quantity from inventory calculations, delete its received-date history, and recalculate this purchase total and status."
      : "This item is not fully received yet. Removing it will delete the expected incoming stock line, delivery planning data, and recalculate this purchase total and status.";

  return [
    `Remove purchase item ${itemIndex + 1} from ${purchase.reference_no || "this purchase"}?`,
    "",
    `Product: ${item.product_name || "Unnamed item"}`,
    `SKU: ${item.sku || "—"}`,
    `Quantity: ${quantity || "—"}${baseQuantity}`,
    `Status: ${formatStatusLabel(displayStatus)}`,
    `Expected delivery: ${item.expected_delivery_date || "—"}`,
    `Received date: ${item.received_date || "—"}`,
    `Line amount: ${fmt(computeAmount(item))}`,
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

function getProductName(product) {
  return product.name || product.productName || product.product_name || product.sku || `Product ${product.id}`;
}

function getProductSearchNames(product) {
  const mainName = `${getProductName(product)}`.trim();
  const subNames = Array.isArray(product.subNames) ? product.subNames : [];

  return [mainName, ...subNames]
    .map((name) => `${name ?? ""}`.trim())
    .filter(
      (name, index, names) =>
        name && names.findIndex((item) => item.toLowerCase() === name.toLowerCase()) === index
    );
}

function getProductSku(product) {
  return product.sku || product.SKU || "";
}

function findProductForItem(item, products = []) {
  if (item.product_id) {
    const matchedById = products.find((product) => `${product.id}` === `${item.product_id}`);

    if (matchedById) {
      return matchedById;
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

function getPurchaseProductQuery(productName, sku) {
  return sku ? `${productName} (${sku})` : productName;
}

function createEditItems(purchase, products = []) {
  const sourceItems = purchase.items?.length ? purchase.items : [];

  if (!sourceItems.length) {
    return [
      {
        id: `purchase-${purchase.id}-item-new`,
        product_id: "",
        product_query: "",
        product_name: "",
        sku: "",
        unit: "pcs",
        base_unit: "pcs",
        conversion_factor: 1,
        base_quantity: 1,
        expected_delivery_date: "",
        item_status: getInitialPurchaseItemStatus(purchase.status),
        received_date: "",
        quantity: 1,
        unit_cost: "",
        discounts: [0],
      },
    ];
  }

  return sourceItems.map((item, index) => {
    const selectedProduct = findProductForItem(item, products);
    const productName = selectedProduct ? getProductName(selectedProduct) : item.product_name || "";
    const sku = selectedProduct ? getProductSku(selectedProduct) : item.sku || "";

    return {
      id: item.id || `purchase-${purchase.id}-item-${index}`,
      product_id: selectedProduct?.id || item.product_id || "",
      product_query: getPurchaseProductQuery(productName, sku),
      product_name: productName,
      sku,
      unit: item.unit || "pcs",
      expected_delivery_date: item.expected_delivery_date || "",
      item_status: getStoredPurchaseItemStatus(item, purchase.status),
      received_date: item.received_date || "",
      quantity: item.quantity ?? 1,
      unit_cost: item.unit_cost ?? "",
      base_unit: item.base_unit || item.unit || "pcs",
      conversion_factor: item.conversion_factor || 1,
      base_quantity: item.base_quantity ?? item.quantity ?? 1,
      discounts: Array.isArray(item.discounts)
        ? item.discounts
        : Number(item.discount) > 0
          ? [item.discount]
          : [0],
    };
  });
}

function createEditForm(purchase) {
  return {
    reference_no: purchase.reference_no || "",
    supplier_name: purchase.supplier_name || "",
    status: purchase.status || "ordered",
    transaction_date: purchase.transaction_date || getToday(),
    note: purchase.note || "",
    document: null,
    remove_document: false,
  };
}

function PurchaseEditForm({
  purchase,
  products = [],
  suppliers = defaultSupplierOptions,
  onCancel,
  onSave,
}) {
  const [form, setForm] = useState(() => createEditForm(purchase));
  const [items, setItems] = useState(() => createEditItems(purchase, products));
  const [vatMode, setVatMode] = useState(purchase.vat_mode || "not_included");
  const [supplierQuery, setSupplierQuery] = useState(purchase.supplier_name || "");
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [supplierError, setSupplierError] = useState("");
  const [openProductIndex, setOpenProductIndex] = useState(null);
  const [itemErrors, setItemErrors] = useState({});
  const [formError, setFormError] = useState("");

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

  const itemTotal = items.reduce((sum, item) => sum + computeAmount(item), 0);
  const vatSummary = computeVatSummary(itemTotal, vatMode);
  const productOptions = products;

  function getFilteredProducts(query) {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return productOptions;
    }

    return productOptions.filter((product) => {
      const matchesName = getProductSearchNames(product).some((name) =>
        name.toLowerCase().includes(normalizedQuery)
      );
      const sku = getProductSku(product).toLowerCase();
      const displayId = `${product.productDisplayId || product.id || ""}`.toLowerCase();

      return matchesName || sku.includes(normalizedQuery) || displayId.includes(normalizedQuery);
    });
  }

  function updateForm(key, value) {
    setForm((currentForm) => ({ ...currentForm, [key]: value }));
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
    const productName = getProductName(product);
    const sku = getProductSku(product);
    const unitOptions = getProductUnitOptions(product, "purchase");

    setItems((currentItems) =>
      currentItems.map((item, index) =>
        index === itemIndex
          ? {
              ...item,
              product_id: product.id,
              product_query: getPurchaseProductQuery(productName, sku),
              product_name: productName,
              sku,
              unit: unitOptions.some((conversion) => conversion.unit === item.unit)
                ? item.unit
                : unitOptions[0]?.unit || item.unit || "pcs",
            }
          : item
      )
    );
    setItemErrors((currentErrors) => ({ ...currentErrors, [itemIndex]: "" }));
    setOpenProductIndex(null);
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
        id: `purchase-${purchase.id}-item-${Date.now()}`,
        product_id: "",
        product_query: "",
        product_name: "",
        sku: "",
        unit: "pcs",
        expected_delivery_date: "",
        item_status: "pending",
        received_date: "",
        quantity: 1,
        unit_cost: "",
        discounts: [0],
      },
    ]);
  }

  function removeItem(itemIndex) {
    const item = items[itemIndex];
    const confirmed = window.confirm(
      getPurchaseItemRemovalMessage(purchase, item || {}, itemIndex)
    );

    if (!confirmed) {
      return;
    }

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

  function handleSubmit(event) {
    event.preventDefault();
    setFormError("");

    const supplierName = resolveSupplierName();

    if (!supplierName) {
      setSupplierError("Select an existing supplier from the list.");
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
        nextItemErrors[index] = "Select an existing product from the list.";
        return nextItems;
      }

      if (!item.quantity || !item.unit_cost) {
        return nextItems;
      }

        const amount = computeAmount(item);
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
      setFormError("Select an existing product for every purchase item.");
      return;
    }

    if (!normalizedItems.length) {
      setFormError("Add at least one complete purchase item.");
      return;
    }

    const nextPurchase = {
      ...purchase,
      reference_no: form.reference_no,
      supplier_name: supplierName,
      status: form.status,
      transaction_date: form.transaction_date,
      note: form.note,
      document: form.document,
      remove_document: form.remove_document,
      document_url: form.remove_document
        ? ""
        : form.document
          ? URL.createObjectURL(form.document)
          : purchase.document_url,
      items: normalizedItems,
      vat_mode: vatMode,
      total_before_vat: vatSummary.total,
      vat_amount: vatSummary.vat,
      grand_total: vatSummary.grandTotal,
      total_amount: vatSummary.grandTotal,
    };

    onSave({
      ...nextPurchase,
      status: getPurchaseStatusFromItems(nextPurchase),
    });
  }

  return (
    <section className="section-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Purchase Edit</p>
          <h3>Edit Purchase Transaction</h3>
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
              placeholder="PO-001"
            />
          </label>

          <label className="supplier-combobox-field">
            Supplier Name
            <div className="supplier-combobox">
              <input
                value={supplierQuery}
                onChange={(event) => {
                  setSupplierQuery(event.target.value);
                  updateForm("supplier_name", "");
                  setSupplierError("");
                  setSupplierOpen(true);
                }}
                onFocus={() => setSupplierOpen(true)}
                onBlur={() => {
                  window.setTimeout(() => setSupplierOpen(false), 120);
                }}
                placeholder="Search existing supplier"
                autoComplete="off"
                aria-expanded={supplierOpen}
                aria-controls="edit-purchase-supplier-list"
                aria-invalid={supplierError ? "true" : "false"}
              />

              {supplierOpen ? (
                <div className="supplier-combobox-menu" id="edit-purchase-supplier-list" role="listbox">
                  {filteredSuppliers.length ? (
                    filteredSuppliers.map((supplier) => (
                      <button
                        key={supplier.id}
                        type="button"
                        className={
                          supplier.companyName === form.supplier_name
                            ? "supplier-combobox-option active"
                            : "supplier-combobox-option"
                        }
                        onMouseDown={(event) => {
                          event.preventDefault();
                          selectSupplier(supplier);
                        }}
                        role="option"
                        aria-selected={supplier.companyName === form.supplier_name}
                      >
                        {supplier.companyName}
                      </button>
                    ))
                  ) : (
                    <div className="supplier-combobox-empty">
                      No supplier found. Add it in Supplier page first.
                    </div>
                  )}
                </div>
              ) : null}
            </div>
            {supplierError ? <span className="field-error-text">{supplierError}</span> : null}
          </label>

          <label>
            Status
            <select
              value={form.status}
              onChange={(event) => updateForm("status", event.target.value)}
            >
              {statusOptions.map((status) => (
                <option
                  key={status}
                  value={status}
                  disabled={status === "partially_received"}
                >
                  {formatStatusLabel(status)}
                </option>
              ))}
            </select>
          </label>

          <label>
            Transaction Date
            <input
              type="date"
              value={form.transaction_date}
              onChange={(event) => updateForm("transaction_date", event.target.value)}
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

          <label className="full-width">
            Document
            <input
              type="file"
              onChange={(event) => {
                updateForm("document", event.target.files?.[0] || null);
                updateForm("remove_document", false);
              }}
            />
          </label>

          <div className="transaction-document-editor full-width">
            {form.document ? (
              <>
                <div className="transaction-document-meta">
                  <strong>New document selected</strong>
                  <span>{form.document.name}</span>
                </div>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => updateForm("document", null)}
                >
                  Clear File
                </button>
              </>
            ) : purchase.document_url && !form.remove_document ? (
              <>
                <div className="transaction-document-meta">
                  <strong>Current document</strong>
                  <a href={purchase.document_url} target="_blank" rel="noreferrer">
                    {getDocumentName(purchase.document_url)}
                  </a>
                </div>
                <button
                  className="danger-button"
                  type="button"
                  onClick={() => updateForm("remove_document", true)}
                >
                  Delete Document
                </button>
              </>
            ) : form.remove_document ? (
              <>
                <div className="transaction-document-meta">
                  <strong>Document marked for deletion</strong>
                  <span>Save this transaction to remove the attached document.</span>
                </div>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => updateForm("remove_document", false)}
                >
                  Undo
                </button>
              </>
            ) : (
              <div className="transaction-document-meta">
                <strong>No document attached</strong>
                <span>Choose a file above to attach one.</span>
              </div>
            )}
          </div>
        </div>

        <div className="line-items-card">
          <div className="line-items-header">
            <h4>Purchase Items</h4>
            <button className="secondary-button" type="button" onClick={addItem}>
              Add Item
            </button>
          </div>

          {items.map((item, index) => {
            const amount = computeAmount(item);
            const filteredProducts = getFilteredProducts(item.product_query || "");
            const selectedProduct = findProductForItem(item, products);
            const unitOptions = selectedProduct
              ? getProductUnitOptions(selectedProduct, "purchase")
              : [];
            const conversionPreview = selectedProduct
              ? buildConvertedItemFields(selectedProduct, item.quantity, item.unit, "purchase")
              : null;

            return (
              <div className="line-item-row purchase-line-item-row" key={item.id}>
                <div className="line-item-index" aria-label={`Item ${index + 1}`}>
                  {index + 1}
                </div>

                <label className="purchase-item-field purchase-item-product purchase-product-field">
                  <span>Product</span>
                  <div className="supplier-combobox">
                    <input
                      value={item.product_query || ""}
                      onChange={(event) => updateProductQuery(index, event.target.value)}
                      onFocus={() => setOpenProductIndex(index)}
                      onBlur={() => {
                        window.setTimeout(() => setOpenProductIndex(null), 120);
                      }}
                      placeholder="Search existing product"
                      autoComplete="off"
                      aria-expanded={openProductIndex === index}
                      aria-controls={`edit-purchase-product-list-${item.id}`}
                      aria-invalid={itemErrors[index] ? "true" : "false"}
                      required
                    />

                    {openProductIndex === index ? (
                      <div
                        className="supplier-combobox-menu"
                        id={`edit-purchase-product-list-${item.id}`}
                        role="listbox"
                      >
                        {filteredProducts.length ? (
                          filteredProducts.map((product) => {
                            const productName = getProductName(product);
                            const sku = getProductSku(product);

                            return (
                              <button
                                key={product.id}
                                type="button"
                                className={
                                  `${product.id}` === `${item.product_id}`
                                    ? "supplier-combobox-option active"
                                    : "supplier-combobox-option"
                                }
                                onMouseDown={(event) => {
                                  event.preventDefault();
                                  selectProduct(index, product);
                                }}
                                role="option"
                                aria-selected={`${product.id}` === `${item.product_id}`}
                              >
                                {getPurchaseProductQuery(productName, sku)}
                              </button>
                            );
                          })
                        ) : (
                          <div className="supplier-combobox-empty">
                            No product found. Add it in Product page first.
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                  {itemErrors[index] ? (
                    <span className="field-error-text">{itemErrors[index]}</span>
                  ) : null}
                </label>

                <label className="purchase-item-field purchase-item-sku">
                  <span>SKU</span>
                  <input
                    value={item.sku}
                    readOnly
                    placeholder="SKU"
                  />
                </label>

                <label className="purchase-item-field purchase-item-unit">
                  <span>Unit</span>
                  <select
                    value={item.unit}
                    onChange={(event) => updateItem(index, "unit", event.target.value)}
                    disabled={!selectedProduct}
                  >
                    {unitOptions.length ? (
                      unitOptions.map((conversion) => (
                        <option key={conversion.unit} value={conversion.unit}>
                          {conversion.unit}
                        </option>
                      ))
                    ) : (
                      <option value={item.unit || "pcs"}>{item.unit || "pcs"}</option>
                    )}
                  </select>
                  {conversionPreview ? (
                    <span className="unit-conversion-preview">
                      {conversionPreview.base_quantity} {conversionPreview.base_unit}
                    </span>
                  ) : null}
                </label>

                <label className="purchase-item-field purchase-item-delivery">
                  <span>Expected Delivery</span>
                  <input
                    type="date"
                    value={item.expected_delivery_date}
                    onChange={(event) =>
                      updateItem(index, "expected_delivery_date", event.target.value)
                    }
                    min={form.transaction_date}
                  />
                </label>

                <label className="purchase-item-field purchase-item-qty">
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

                <label className="purchase-item-field purchase-item-cost">
                  <span>Unit Cost</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unit_cost}
                    onChange={(event) => updateItem(index, "unit_cost", event.target.value)}
                    placeholder="0.00"
                    required
                  />
                </label>

                <div className="purchase-item-field purchase-item-discounts">
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

                <div className="purchase-item-field purchase-item-amount">
                  <span>Amount</span>
                  <div className="sales-line-amount">
                    {fmt(amount)}
                  </div>
                </div>

                <button
                  className="danger-button purchase-item-remove"
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
          <div>
            <p className="purchase-vat-label">VAT Setting</p>
            <div className="purchase-vat-options" role="radiogroup" aria-label="Edit purchase VAT setting">
              {vatOptions.map((option) => (
                <label
                  key={option.value}
                  className={vatMode === option.value ? "purchase-vat-option active" : "purchase-vat-option"}
                >
                  <input
                    type="radio"
                    name={`edit-purchase-vat-mode-${purchase.id}`}
                    value={option.value}
                    checked={vatMode === option.value}
                    onChange={(event) => setVatMode(event.target.value)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        </section>

        <div className="sales-summary-card">
          <div className="sales-summary-row">
            <span>Total</span>
            <span>{fmt(vatSummary.total)}</span>
          </div>
          <div className="sales-summary-row">
            <span>VAT (7%)</span>
            <span>{fmt(vatSummary.vat)}</span>
          </div>
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
            Save Purchase
          </button>
        </div>
      </form>
    </section>
  );
}

function PurchaseHistoryPage({
  products,
  suppliers = defaultSupplierOptions,
  purchases,
  onCreatePurchase,
  onPurchaseStatusChange,
  onPurchaseItemStatusChange,
  onPurchaseUpdate,
  onPurchaseDelete,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState(statusOptions);
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [supplierFilterQuery, setSupplierFilterQuery] = useState("");
  const [supplierFilterOpen, setSupplierFilterOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [editingPurchase, setEditingPurchase] = useState(null);
  const [showNewPurchaseForm, setShowNewPurchaseForm] = useState(false);
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const supplierOptions = useMemo(
    () => buildSupplierFilterOptions(purchases, suppliers),
    [purchases, suppliers]
  );
  const filteredSupplierOptions = useMemo(() => {
    const normalizedQuery = supplierFilterQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return supplierOptions;
    }

    return supplierOptions.filter((supplier) =>
      supplier.companyName.toLowerCase().includes(normalizedQuery)
    );
  }, [supplierFilterQuery, supplierOptions]);

  const filteredPurchases = useMemo(() => {
    return purchases.filter((purchase) => {
      const matchesSearch = normalizedSearch
        ? purchaseMatchesQuery(purchase, normalizedSearch)
        : true;
      const matchesStatus = selectedStatuses.includes(purchase.status);
      const matchesSupplier = selectedSupplier
        ? purchase.supplier_name === selectedSupplier
        : true;
      const matchesDateRange = transactionMatchesDateRange(
        purchase.transaction_date,
        dateFrom,
        dateTo
      );

      return matchesSearch && matchesStatus && matchesSupplier && matchesDateRange;
    }).sort(sortRecentTransactions);
  }, [dateFrom, dateTo, normalizedSearch, purchases, selectedStatuses, selectedSupplier]);

  function selectSupplierFilter(supplier) {
    setSelectedSupplier(supplier.companyName);
    setSupplierFilterQuery(supplier.companyName);
    setSupplierFilterOpen(false);
  }

  function toggleStatus(status) {
    setSelectedStatuses((currentStatuses) =>
      currentStatuses.includes(status)
        ? currentStatuses.filter((currentStatus) => currentStatus !== status)
        : [...currentStatuses, status]
    );
  }

  function resetFilters() {
    setSearchTerm("");
    setSelectedStatuses(statusOptions);
    setSelectedSupplier("");
    setSupplierFilterQuery("");
    setDateFrom("");
    setDateTo("");
    setFilterOpen(false);
    setSupplierFilterOpen(false);
  }

  async function handleSave(updatedPurchase) {
    const saved = await onPurchaseUpdate?.(updatedPurchase);

    if (saved === false) {
      return;
    }

    setEditingPurchase(null);
  }

  async function handleCreatePurchase(formData) {
    const saved = await onCreatePurchase?.(formData);

    if (saved === false) {
      return false;
    }

    setShowNewPurchaseForm(false);
    return true;
  }

  async function handleDelete(deletedPurchase) {
    const deleted = await onPurchaseDelete?.(deletedPurchase);

    if (deleted === false) {
      return;
    }

    setEditingPurchase((currentPurchase) =>
      currentPurchase?.id === deletedPurchase.id ? null : currentPurchase
    );
  }

  if (showNewPurchaseForm) {
    return (
      <div className="stack-layout">
        <PurchaseForm
          products={products}
          suppliers={suppliers}
          purchases={purchases}
          onSubmit={handleCreatePurchase}
          onCancel={() => setShowNewPurchaseForm(false)}
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
            <h3>Find Purchase Records</h3>
          </div>
        </div>

        <div className="supplier-directory-toolbar">
          <label className="stock-search supplier-search">
            <span className="stock-search-icon">S</span>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search reference, supplier, status, date, note, or item"
            />
          </label>
          <div className="stock-report-summary supplier-search-meta">
            <span>
              {filteredPurchases.length} of {purchases.length} purchases shown
            </span>
          </div>
        </div>

        <div className="history-filter-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={() => setFilterOpen((currentValue) => !currentValue)}
          >
            Filter
          </button>
          <button className="secondary-button" type="button" onClick={resetFilters}>
            Reset Filter
          </button>
        </div>

        {filterOpen ? (
          <div className="history-filter-panel">
            <div className="history-filter-grid">
              <label className="history-filter-field supplier-combobox-field">
                <span className="history-filter-title">Supplier</span>
                <div className="supplier-combobox">
                  <input
                    type="search"
                    value={supplierFilterQuery}
                    onChange={(event) => {
                      setSupplierFilterQuery(event.target.value);
                      setSelectedSupplier("");
                      setSupplierFilterOpen(true);
                    }}
                    onFocus={() => setSupplierFilterOpen(true)}
                    onBlur={() => {
                      window.setTimeout(() => setSupplierFilterOpen(false), 120);
                    }}
                    placeholder="Search supplier"
                    autoComplete="off"
                    aria-expanded={supplierFilterOpen}
                    aria-controls="purchase-history-supplier-filter"
                  />

                  {supplierFilterOpen ? (
                    <div
                      className="supplier-combobox-menu"
                      id="purchase-history-supplier-filter"
                      role="listbox"
                    >
                      {filteredSupplierOptions.length ? (
                        filteredSupplierOptions.map((supplier) => (
                          <button
                            key={supplier.id}
                            type="button"
                            className={
                              supplier.companyName === selectedSupplier
                                ? "supplier-combobox-option active"
                                : "supplier-combobox-option"
                            }
                            onMouseDown={(event) => {
                              event.preventDefault();
                              selectSupplierFilter(supplier);
                            }}
                            role="option"
                            aria-selected={supplier.companyName === selectedSupplier}
                          >
                            {supplier.companyName}
                          </button>
                        ))
                      ) : (
                        <div className="supplier-combobox-empty">No supplier found.</div>
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
            </div>

            <p className="history-filter-title">Purchase Status</p>
            <div className="history-filter-options">
              {statusOptions.map((status) => (
                <label className="history-filter-option" key={status}>
                  <input
                    type="checkbox"
                    checked={selectedStatuses.includes(status)}
                    onChange={() => toggleStatus(status)}
                  />
                  <span>{formatStatusLabel(status)}</span>
                </label>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {editingPurchase ? (
        <PurchaseEditForm
          key={editingPurchase.id}
          purchase={editingPurchase}
          products={products}
          suppliers={suppliers}
          onCancel={() => setEditingPurchase(null)}
          onSave={handleSave}
        />
      ) : null}

      <TransactionTable
        rows={filteredPurchases}
        products={products}
        type="purchase"
        onPurchaseStatusChange={onPurchaseStatusChange}
        onPurchaseItemStatusChange={onPurchaseItemStatusChange}
        onEditRow={setEditingPurchase}
        onDeleteRow={handleDelete}
        compactRows={5}
        enableViewAll
        headerActions={
          <button
            className="primary-button"
            type="button"
            onClick={() => {
              setEditingPurchase(null);
              setShowNewPurchaseForm(true);
            }}
          >
            New Purchase
          </button>
        }
      />
    </div>
  );
}

export default PurchaseHistoryPage;
