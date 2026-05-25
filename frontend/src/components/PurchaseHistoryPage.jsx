import { useEffect, useMemo, useState } from "react";
import PurchaseForm from "./PurchaseForm";
import PaginationControls from "./PaginationControls";
import StatusFilterGroup from "./StatusFilterGroup";
import TransactionTable from "./TransactionTable";
import { useLanguage } from "../i18n/LanguageContext";
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
import { formatMoney as fmt } from "../format";
import {
  FilterPresets,
  ActiveFilterChips,
  RangeField,
  withinRange,
} from "./FilterControls";

const VAT_RATE = 0.07;
const statusOptions = purchaseStatuses;
const purchaseStatusPresets = [
  { labelKey: "purchaseHistory.presetAll", statuses: statusOptions },
  { labelKey: "purchaseHistory.presetOpen", statuses: ["draft", "ordered", "partially_received"] },
  { labelKey: "purchaseHistory.filterReceived", statuses: ["received"] },
  { labelKey: "purchaseHistory.presetCancelled", statuses: ["cancelled"] },
];
const vatOptions = [
  { value: "included", label: "Include VAT" },
  { value: "not_included", label: "Exclude VAT" },
];
const defaultSupplierOptions = [];

function getToday() {
  return getTodayString();
}

function daysAgoString(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDocumentName(documentUrl = "", t = null) {
  const [path = ""] = `${documentUrl}`.split("?");
  const name = path.split("/").filter(Boolean).pop();
  const fallback = t ? t("transactionTable.attachedDocument") : "Attached document";
  return name ? decodeURIComponent(name) : fallback;
}

function getTransactionDocuments(purchase, t = null) {
  if (Array.isArray(purchase.documents) && purchase.documents.length) {
    return purchase.documents;
  }

  return purchase.document_url
    ? [
        {
          id: "__legacy_document__",
          name: getDocumentName(purchase.document_url, t),
          url: purchase.document_url,
        },
      ]
    : [];
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
  const cost = Number(item.unit_cost) || 0;
  const multiplier = (item.discounts || []).reduce((acc, discount) => {
    const clamped = Math.min(100, Math.max(0, Number(discount) || 0));
    return acc * (1 - clamped / 100);
  }, 1);

  return qty * cost * multiplier * (1 - getBillDiscountValue(transaction) / 100);
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

function getPurchaseItemRemovalMessage(purchase, item, itemIndex, t) {
  const displayStatus = getPurchaseItemDisplayStatus(item, purchase.status);
  const quantity = `${item.quantity || 0} ${item.unit || ""}`.trim();
  const baseQuantity = item.base_quantity
    ? ` (${item.base_quantity} ${item.base_unit || item.unit || t("purchaseForm.baseUnits")})`
    : "";
  const impact =
    displayStatus === "received"
      ? t("purchaseForm.removeImpactReceived")
      : t("purchaseForm.removeImpactPending");

  return [
    t("purchaseForm.removeConfirmTitle", { index: itemIndex + 1, ref: purchase.reference_no || t("purchaseForm.thisPurchase") }),
    "",
    `${t("purchaseForm.removeProduct")} ${item.product_name || t("purchaseForm.unnamedItem")}`,
    `${t("purchaseForm.removeSKU")} ${item.sku || "—"}`,
    `${t("purchaseForm.removeQuantity")} ${quantity || "—"}${baseQuantity}`,
    `${t("purchaseForm.removeStatus")} ${formatStatusLabel(displayStatus)}`,
    `${t("purchaseForm.removeExpectedDelivery")} ${item.expected_delivery_date || "—"}`,
    `${t("purchaseForm.removeReceivedDate")} ${item.received_date || "—"}`,
    `${t("purchaseForm.removeLineAmount")} ${fmt(computeAmount(item, purchase))}`,
    "",
    impact,
    t("purchaseForm.removeCannotUndo"),
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
    supplier_tax_invoice: purchase.supplier_tax_invoice || "",
    status: purchase.status || "ordered",
    transaction_date: purchase.transaction_date || getToday(),
    note: purchase.note || "",
    new_documents: [],
    remove_document_ids: [],
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
  const productOptions = products;
  const visibleDocuments = getTransactionDocuments(purchase, t).filter(
    (document) => !form.remove_document_ids.includes(document.id)
  );

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
      getPurchaseItemRemovalMessage(purchase, item || {}, itemIndex, t)
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

    onSave({
      ...nextPurchase,
      status: getPurchaseStatusFromItems(nextPurchase),
    });
  }

  const vatOptions = [
    { value: "included", label: t("purchaseForm.vatIncluded") },
    { value: "not_included", label: t("purchaseForm.vatExcluded") },
  ];

  return (
    <section className="section-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("purchaseForm.editEyebrow")}</p>
          <h3>{t("purchaseForm.editTitle")}</h3>
        </div>
        <button className="secondary-button table-action-button" type="button" onClick={onCancel}>
          {t("purchaseForm.cancelButton")}
        </button>
      </div>

      {formError ? <div className="error-banner">{formError}</div> : null}

      <form className="form-layout" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label>
            {t("purchaseForm.referenceLabel")}
            <input
              value={form.reference_no}
              onChange={(event) => updateForm("reference_no", event.target.value)}
              placeholder={t("purchaseForm.referencePlaceholder")}
            />
          </label>

          <label className="supplier-combobox-field">
            <span className="required-label">{t("purchaseForm.supplierNameLabel")}</span>
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
                placeholder={t("purchaseForm.searchSupplierPlaceholder")}
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
                      {t("purchaseForm.noSupplierFound")}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
            {supplierError ? <span className="field-error-text">{supplierError}</span> : null}
          </label>

          <label>
            {t("purchaseForm.taxInvoiceLabel")}
            <input
              value={form.supplier_tax_invoice}
              onChange={(event) =>
                updateForm("supplier_tax_invoice", event.target.value)
              }
              placeholder={t("purchaseForm.taxInvoicePlaceholder")}
            />
          </label>

          <label>
            <span className="required-label">{t("purchaseForm.statusLabel")}</span>
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
            <span className="required-label">{t("purchaseForm.dateLabel")}</span>
            <input
              type="date"
              value={form.transaction_date}
              onChange={(event) => updateForm("transaction_date", event.target.value)}
            />
          </label>

          <label className="full-width">
            {t("purchaseForm.noteLabel")}
            <textarea
              rows="3"
              value={form.note}
              onChange={(event) => updateForm("note", event.target.value)}
            />
          </label>

          <div className="transaction-document-panel full-width">
            <div className="transaction-document-panel-header">
              <div>
                <strong>{t("purchaseForm.documentsLabel")}</strong>
                <span>
                  {visibleDocuments.length + form.new_documents.length
                    ? t("transactionTable.attachedCount", { count: visibleDocuments.length + form.new_documents.length })
                    : t("purchaseForm.noDocumentsAttached")}
                </span>
              </div>
              <label className="document-upload-button">
                {t("purchaseForm.documentsAddFiles")}
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
                        {document.name || getDocumentName(document.url, t)}
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
                        {t("purchaseForm.documentDelete")}
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
                        {t("purchaseForm.documentRemove")}
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
                        getTransactionDocuments(purchase, t).map((document) => document.id)
                      );
                      updateForm("new_documents", []);
                    }}
                  >
                    {t("purchaseForm.documentRemoveAll")}
                  </button>
                </div>
              </>
            ) : form.remove_document_ids.length ? (
              <div className="transaction-document-state">
                <div>
                  <strong>{t("purchaseForm.documentMarkedDeletion")}</strong>
                  <span>{t("purchaseForm.documentMarkedDeletionHelp")}</span>
                </div>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => updateForm("remove_document_ids", [])}
                >
                  {t("purchaseForm.documentUndo")}
                </button>
              </div>
            ) : (
              <p className="transaction-document-empty">{t("purchaseForm.documentsEmpty")}</p>
            )}
          </div>
        </div>

        <div className="line-items-card">
          <div className="line-items-header">
            <h4>{t("purchaseForm.itemsTitle")}</h4>
            <button className="secondary-button" type="button" onClick={addItem}>
              {t("purchaseForm.addItem")}
            </button>
          </div>

          {items.map((item, index) => {
            const amount = computeAmount(item, purchase);
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
                <div className="line-item-index" aria-label={t("purchaseForm.itemAriaLabel", { index: index + 1 })}>
                  {index + 1}
                </div>

                <label className="purchase-item-field purchase-item-product purchase-product-field">
                  <span>{t("purchaseForm.colProduct")}</span>
                  <div className="supplier-combobox">
                    <input
                      value={item.product_query || ""}
                      onChange={(event) => updateProductQuery(index, event.target.value)}
                      onFocus={() => setOpenProductIndex(index)}
                      onBlur={() => {
                        window.setTimeout(() => setOpenProductIndex(null), 120);
                      }}
                      placeholder={t("purchaseForm.searchProductPlaceholder")}
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
                            {t("purchaseForm.noProductFound")}
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
                  <span>{t("purchaseForm.colSKU")}</span>
                  <input
                    value={item.sku}
                    readOnly
                    placeholder={t("purchaseForm.skuPlaceholder")}
                  />
                </label>

                <label className="purchase-item-field purchase-item-unit">
                  <span>{t("purchaseForm.colUnit")}</span>
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
                  <span>{t("purchaseForm.colExpectedDelivery")}</span>
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
                  <span>{t("purchaseForm.colQty")}</span>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(event) => updateItem(index, "quantity", event.target.value)}
                    placeholder={t("purchaseForm.qtyPlaceholder")}
                    required
                  />
                </label>

                <label className="purchase-item-field purchase-item-cost">
                  <span>{t("purchaseForm.colUnitCost")}</span>
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
                  <span>{t("purchaseForm.colDiscounts")}</span>
                  <div className="sales-discount-cell">
                    {(item.discounts || [0]).map((discount, discountIndex) => (
                      <div key={discountIndex} className="sales-discount-entry">
                        {discountIndex > 0 ? (
                          <span className="sales-discount-chain-label">{t("purchaseForm.discountThen")}</span>
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
                            aria-label={t("purchaseForm.removeDiscount")}
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
                      {t("purchaseForm.addDiscount")}
                    </button>
                  </div>
                </div>

                <div className="purchase-item-field purchase-item-amount">
                  <span>{t("purchaseForm.colAmount")}</span>
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
                  {t("purchaseForm.removeItem")}
                </button>
              </div>
            );
          })}
        </div>

        <section className="purchase-vat-card">
          <div className="purchase-vat-card-header">
            <p className="purchase-vat-label">{t("purchaseForm.vatSetting")}</p>
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
                {isVatEnabled(vatMode) ? t("purchaseForm.vatOn") : t("purchaseForm.vatOff")}
              </span>
            </label>
          </div>
          {isVatEnabled(vatMode) ? (
            <div className="purchase-vat-options" role="radiogroup" aria-label={t("purchaseForm.vatAriaLabel")}>
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
          ) : null}
        </section>

        <div className="sales-summary-card">
          {renderBillDiscount(purchase) !== "—" ? (
            <div className="sales-summary-row">
              <span>{t("transactionTable.billDiscount")}</span>
              <span>{renderBillDiscount(purchase)}</span>
            </div>
          ) : null}
          {isVatEnabled(vatMode) ? (
            <>
              <div className="sales-summary-row">
                <span>{t("purchaseForm.subtotal")}</span>
                <span>{fmt(vatSummary.total)}</span>
              </div>
              <div className="sales-summary-row">
                <span>{t("purchaseForm.vat")}</span>
                <span>{fmt(vatSummary.vat)}</span>
              </div>
            </>
          ) : null}
          <div className="sales-summary-row sales-summary-grand">
            <strong>{t("purchaseForm.grandTotal")}</strong>
            <strong>{fmt(vatSummary.grandTotal)}</strong>
          </div>
        </div>

        <div className="supplier-modal-actions">
          <button className="secondary-button" type="button" onClick={onCancel}>
            {t("purchaseForm.cancelButton")}
          </button>
          <button className="primary-button" type="submit">
            {t("purchaseForm.saveButton")}
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
  allPurchases = purchases,
  pagination = null,
  onPageRequest,
  onCreatePurchase,
  onPurchaseStatusChange,
  onPurchaseItemStatusChange,
  onPurchaseUpdate,
  onPurchaseDelete,
}) {
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState(statusOptions);
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [supplierFilterQuery, setSupplierFilterQuery] = useState("");
  const [supplierFilterOpen, setSupplierFilterOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [vatFilter, setVatFilter] = useState("all");
  const [editingPurchase, setEditingPurchase] = useState(null);
  const [showNewPurchaseForm, setShowNewPurchaseForm] = useState(false);
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const isServerPaginated = Boolean(pagination && onPageRequest);
  const selectedStatusKey = selectedStatuses.join(",");
  const activeFilterCount =
    (selectedSupplier ? 1 : 0) +
    (selectedStatuses.length === statusOptions.length ? 0 : 1) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0) +
    (amountMin ? 1 : 0) +
    (amountMax ? 1 : 0) +
    (vatFilter === "all" ? 0 : 1);
  const supplierOptions = useMemo(
    () => buildSupplierFilterOptions(allPurchases, suppliers),
    [allPurchases, suppliers]
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
    if (isServerPaginated) {
      return [...purchases].sort(sortRecentTransactions);
    }

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
      const matchesAmount = withinRange(purchase.grand_total, amountMin, amountMax);
      const matchesVat =
        vatFilter === "all" || purchase.vat_mode === vatFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesSupplier &&
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
    purchases,
    selectedStatuses,
    selectedSupplier,
    vatFilter,
  ]);
  const totalPurchaseCount = pagination?.count ?? purchases.length;

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
      supplier: selectedSupplier,
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
    selectedStatusKey,
    selectedSupplier,
    vatFilter,
  ]);

  function selectSupplierFilter(supplier) {
    setSelectedSupplier(supplier.companyName);
    setSupplierFilterQuery(supplier.companyName);
    setSupplierFilterOpen(false);
  }

  function resetFilters() {
    setSearchTerm("");
    setSelectedStatuses(statusOptions);
    setSelectedSupplier("");
    setSupplierFilterQuery("");
    setDateFrom("");
    setDateTo("");
    setAmountMin("");
    setAmountMax("");
    setVatFilter("all");
    setFilterOpen(false);
    setSupplierFilterOpen(false);
  }

  const vatLabels = {
    included: t("purchaseHistory.vatIncluded"),
    not_included: t("purchaseHistory.vatExcluded"),
  };
  const last30Active = dateFrom === daysAgoString(30) && !dateTo;
  const quickPresets = [
    {
      label: t("purchaseHistory.filterLastDays"),
      active: last30Active,
      onClick: () => {
        setDateFrom(last30Active ? "" : daysAgoString(30));
        setDateTo("");
      },
    },
  ].filter(Boolean);
  const activeChips = [
    selectedSupplier && {
      key: "supplier",
      label: t("purchaseHistory.supplierChip", { name: selectedSupplier }),
      onRemove: () => {
        setSelectedSupplier("");
        setSupplierFilterQuery("");
      },
    },
    selectedStatuses.length !== statusOptions.length && {
      key: "status",
      label: t("filterControls.statusChip", {
        label: selectedStatuses.length
          ? selectedStatuses.map(formatStatusLabel).join(", ")
          : t("common.allStatuses"),
      }),
      onRemove: () => setSelectedStatuses(statusOptions),
    },
    vatFilter !== "all" && {
      key: "vat",
      label: t("purchaseHistory.vatChip", { label: vatLabels[vatFilter] || vatFilter }),
      onRemove: () => setVatFilter("all"),
    },
    dateFrom && {
      key: "dateFrom",
      label: t("filterControls.fromChip", { date: dateFrom }),
      onRemove: () => setDateFrom(""),
    },
    dateTo && {
      key: "dateTo",
      label: t("filterControls.toChip", { date: dateTo }),
      onRemove: () => setDateTo(""),
    },
    amountMin && {
      key: "amountMin",
      label: t("filterControls.minChip", { value: amountMin }),
      onRemove: () => setAmountMin(""),
    },
    amountMax && {
      key: "amountMax",
      label: t("filterControls.maxChip", { value: amountMax }),
      onRemove: () => setAmountMax(""),
    },
  ].filter(Boolean);

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
          purchases={allPurchases}
          onSubmit={handleCreatePurchase}
          onCancel={() => setShowNewPurchaseForm(false)}
        />
      </div>
    );
  }

  if (editingPurchase) {
    return (
      <div className="stack-layout">
        <PurchaseEditForm
          key={editingPurchase.id}
          purchase={editingPurchase}
          products={products}
          suppliers={suppliers}
          onCancel={() => setEditingPurchase(null)}
          onSave={handleSave}
        />
      </div>
    );
  }

  const vatOptions = [
    { value: "included", label: t("purchaseHistory.vatIncluded") },
    { value: "not_included", label: t("purchaseHistory.vatExcluded") },
  ];

  return (
    <div className="stack-layout">
      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("purchaseHistory.searchEyebrow")}</p>
            <h3>{t("purchaseHistory.searchTitle")}</h3>
          </div>
        </div>

        <div className="supplier-directory-toolbar">
          <label className="stock-search supplier-search">
            <span className="stock-search-icon">S</span>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={t("purchaseHistory.searchPlaceholder")}
            />
          </label>
          <div className="stock-report-summary supplier-search-meta">
            <span>
              {isServerPaginated
                ? t("purchaseHistory.pageCountServer", { count: filteredPurchases.length, total: totalPurchaseCount })
                : t("purchaseHistory.pageCountLocal", { count: filteredPurchases.length, total: purchases.length })}
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
            {t("filterControls.filter")}
            {activeFilterCount ? <span>{activeFilterCount}</span> : null}
          </button>
          <button className="secondary-button" type="button" onClick={resetFilters}>
            {t("filterControls.resetFilter")}
          </button>
        </div>

        <FilterPresets presets={quickPresets} />
        <ActiveFilterChips chips={activeChips} onClearAll={resetFilters} />

        {filterOpen ? (
          <div className="history-filter-panel">
            <div className="history-filter-grid">
              <label className="history-filter-field supplier-combobox-field">
                <span className="history-filter-title">{t("purchaseHistory.supplierFilter")}</span>
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
                    placeholder={t("purchaseHistory.searchSupplierPlaceholder")}
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
                        <div className="supplier-combobox-empty">{t("purchaseHistory.noSupplierFound")}</div>
                      )}
                    </div>
                  ) : null}
                </div>
              </label>

              <label className="history-filter-field">
                <span className="history-filter-title">{t("purchaseHistory.dateFromLabel")}</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                />
              </label>

              <label className="history-filter-field">
                <span className="history-filter-title">{t("purchaseHistory.dateToLabel")}</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                />
              </label>

              <RangeField
                title={t("purchaseHistory.amountLabel")}
                prefix="฿"
                minValue={amountMin}
                maxValue={amountMax}
                onMinChange={setAmountMin}
                onMaxChange={setAmountMax}
              />

              <label className="history-filter-field">
                <span className="history-filter-title">{t("purchaseHistory.vatLabel")}</span>
                <select
                  value={vatFilter}
                  onChange={(event) => setVatFilter(event.target.value)}
                >
                  <option value="all">{t("purchaseHistory.allVat")}</option>
                  {vatOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <StatusFilterGroup
              title={t("purchaseHistory.statusSectionTitle")}
              statuses={statusOptions}
              selectedStatuses={selectedStatuses}
              presets={purchaseStatusPresets.map((preset) => ({
                ...preset,
                label: t(preset.labelKey),
              }))}
              formatStatusLabel={formatStatusLabel}
              onChange={setSelectedStatuses}
            />
          </div>
        ) : null}
      </section>

      <TransactionTable
        rows={filteredPurchases}
        products={products}
        type="purchase"
        onPurchaseStatusChange={onPurchaseStatusChange}
        onPurchaseItemStatusChange={onPurchaseItemStatusChange}
        onEditRow={setEditingPurchase}
        onDeleteRow={handleDelete}
        compactRows={isServerPaginated ? 0 : 5}
        enableViewAll={!isServerPaginated}
        headerActions={
          <button
            className="primary-button"
            type="button"
            onClick={() => {
              setEditingPurchase(null);
              setShowNewPurchaseForm(true);
            }}
          >
            {t("purchaseHistory.newPurchase")}
          </button>
        }
      />
      <PaginationControls
        pagination={pagination}
        itemLabel={t("purchaseHistory.paginationLabel")}
        onPageChange={(page) => onPageRequest?.(getPageRequestParams(page))}
      />
    </div>
  );
}

export default PurchaseHistoryPage;
