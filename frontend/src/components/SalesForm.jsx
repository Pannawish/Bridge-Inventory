import { useEffect, useMemo, useRef, useState } from "react";
import { applySaleStatusToItems, getSaleStatusFromItems } from "../saleStatus";
import { formatSaleStockIssueMessage, getSaleStockIssues } from "../saleStock";
import {
  buildConvertedItemFields,
  getProductDefaultSalesUnit,
  getUnitValueFromBaseValue,
  getProductUnitOptions,
} from "../unitConversion";
import { computePaymentDate, formatMoney as fmt } from "../format";
import AllItemsDiscountControl from "./AllItemsDiscountControl";
import {
  computeDiscountedAmount,
  getActiveTransactionDiscount,
  getEffectiveDiscounts,
} from "./transactionDiscounts";
import { useLanguage } from "../i18n/LanguageContext";

const VAT_RATE = 0.07;
const vatOptions = [
  { value: "included", label: "Include VAT" },
  { value: "not_included", label: "Exclude VAT" },
];
const defaultCustomerOptions = [];

function getToday() {
  return new Date().toISOString().split("T")[0];
}

function getSalesReferencePrefix(date = new Date()) {
  const buddhistYear = date.getFullYear() + 543;
  const yearSuffix = `${buddhistYear}`.slice(-2);
  const month = `${date.getMonth() + 1}`.padStart(2, "0");

  return `TI-${yearSuffix}${month}`;
}

function getNextSalesReference(sales = [], date = new Date()) {
  const prefix = getSalesReferencePrefix(date);
  const referencePattern = new RegExp(`^${prefix}-(\\d+)$`);
  const maxSerial = sales.reduce((max, sale) => {
    const match = `${sale.reference_no || ""}`.match(referencePattern);

    if (!match) {
      return max;
    }

    return Math.max(max, Number(match[1]));
  }, 0);
  const nextSerial = maxSerial + 1;

  return `${prefix}-${`${nextSerial}`.padStart(3, "0")}`;
}

function getNextSalesReferenceAfter(referenceNo, date = new Date()) {
  const prefix = getSalesReferencePrefix(date);
  const match = `${referenceNo || ""}`.match(new RegExp(`^${prefix}-(\\d+)$`));

  if (!match) {
    return getNextSalesReference([], date);
  }

  const nextSerial = Number(match[1]) + 1;
  return `${prefix}-${`${nextSerial}`.padStart(3, "0")}`;
}

function createInitialForm(referenceNo, prefill = {}) {
  return {
    reference_no: referenceNo,
    customer_name: prefill.customer_name || "",
    customer_po_reference: prefill.customer_po_reference || "",
    status: "draft",
    transaction_date: prefill.transaction_date || prefill.quotation_date || getToday(),
    note: prefill.note || "",
    documents: [],
    payment_term_type: prefill.payment_term_type || "",
    payment_term_days: prefill.payment_term_days || "",
  };
}

function emptyItem() {
  return {
    line_id: `sales-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    product_id: "",
    product_query: "",
    product_name: "",
    sku: "",
    item_status: "pending",
    shipped_date: "",
    delivered_date: "",
    unit: "pcs",
    quantity: 1,
    unit_price: "",
    supplier_name: "",
    unit_cost: "",
    discounts: [""],
  };
}

function createInitialItems(prefill = {}) {
  const sourceItems = Array.isArray(prefill.items) ? prefill.items : [];

  if (!sourceItems.length) {
    return [emptyItem()];
  }

  return sourceItems.map((item, index) => ({
    ...emptyItem(),
    line_id: `sales-prefill-${Date.now()}-${index}`,
    product_id: item.product_id || item.productId || "",
    product_query: item.sku
      ? `${item.product_name || item.productName || item.name || ""} (${item.sku || item.SKU})`
      : item.product_name || item.productName || item.name || "",
    product_name: item.product_name || item.productName || item.name || "",
    sku: item.sku || item.SKU || "",
    unit: item.unit || "pcs",
    quantity: item.quantity ?? 1,
    unit_price: item.unit_price ?? item.sale_price ?? "",
    supplier_name: item.supplier_name || "",
    unit_cost: item.unit_cost ?? item.cost_price ?? "",
    discounts: Array.isArray(item.discounts)
      ? item.discounts
      : Number(item.discount) > 0
        ? [item.discount]
        : [""],
  }));
}

function computeAmount(item, transactionDiscount = null) {
  return computeDiscountedAmount(
    item.quantity,
    item.unit_price,
    getEffectiveDiscounts(item.discounts, transactionDiscount)
  );
}

// Latest unit cost for a product from a given supplier's most recent purchase,
// so the sale line can default to the real cost of stock bought from that
// supplier. The user can still override it.
function getLatestSupplierCost(purchases, productId, supplierName) {
  if (!productId || !supplierName) {
    return null;
  }
  const wantSupplier = `${supplierName}`.trim().toLowerCase();
  let best = null;
  (purchases || []).forEach((purchase) => {
    if (purchase.status === "cancelled") {
      return;
    }
    if (`${purchase.supplier_name ?? ""}`.trim().toLowerCase() !== wantSupplier) {
      return;
    }
    const date = `${purchase.transaction_date ?? ""}`;
    (purchase.items || []).forEach((purchaseItem) => {
      const pid = `${purchaseItem.product_id ?? purchaseItem.productId ?? ""}`;
      if (pid !== `${productId}`) {
        return;
      }
      const cost = Number(purchaseItem.unit_cost);
      if (!Number.isFinite(cost) || cost <= 0) {
        return;
      }
      if (!best || date > best.date) {
        best = { date, cost };
      }
    });
  });
  return best ? best.cost : null;
}

// Loss amount on a line when the realised price (after discounts) is below the
// recorded unit cost. Returns 0 when the line is profitable or cost is unknown.
function getLineLoss(item, transactionDiscount = null) {
  const quantity = Number(item.quantity) || 0;
  const unitCost = Number(item.unit_cost) || 0;
  if (quantity <= 0 || unitCost <= 0 || !item.unit_price) {
    return 0;
  }
  const amount = computeAmount(item, transactionDiscount);
  const lineCost = unitCost * quantity;
  return amount < lineCost ? lineCost - amount : 0;
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

function getProductUnit(product) {
  return getProductDefaultSalesUnit(product);
}

function getAverageCostForSelectedUnit(product, unit) {
  if (!product) {
    return null;
  }

  const baseAverageCost = Number(
    product.average_unit_cost ?? product.averageUnitCost ?? 0
  );
  if (!Number.isFinite(baseAverageCost) || baseAverageCost <= 0) {
    return null;
  }

  return getUnitValueFromBaseValue(product, unit, baseAverageCost, "sale");
}

function getCustomerPaymentTerms(customer) {
  const paymentTermType = customer?.termType || "";
  const paymentTermDays =
    paymentTermType === "credit" ? customer?.billingNoteDate || "" : "";

  return {
    payment_term_type: paymentTermType,
    payment_term_days: paymentTermDays,
  };
}

function showStockAlert(message) {
  if (message && typeof window !== "undefined") {
    window.alert(message);
  }
}

function SalesForm({
  products,
  customers = defaultCustomerOptions,
  suppliers = [],
  purchases = [],
  sales = [],
  enableStockValidation = true,
  onSubmit,
  onCancel = null,
  prefill = null,
}) {
  const { t } = useLanguage();
  const nextReferenceNo = useMemo(
    () => getNextSalesReference(sales),
    [sales]
  );
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
  const filteredCustomers = useMemo(() => {
    const normalizedQuery = customerQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return customers;
    }

    return customers.filter((customer) =>
      customer.companyName.toLowerCase().includes(normalizedQuery)
    );
  }, [customerQuery, customers]);

  const supplierNameOptions = useMemo(
    () =>
      Array.from(
        new Set(
          (suppliers || [])
            .map((supplier) => `${supplier.companyName ?? supplier.name ?? ""}`.trim())
            .filter(Boolean)
        )
      ).sort((left, right) => left.localeCompare(right)),
    [suppliers]
  );

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
      ? formatSaleStockIssueMessage(saleStockIssues)
      : "";

  useEffect(() => {
    if (!saleStockIssues.length) {
      setStatusError("");
    }
  }, [saleStockIssues]);

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
      const message = formatSaleStockIssueMessage(nextIssues);
      updateForm("status", "draft");
      setStatusError(message);
      showStockAlert(message);
      return;
    }

    setStatusError("");
    updateForm("status", nextStatus);
  }

  function updateItem(itemIndex, key, value) {
    setItems((current) =>
      current.map((item, i) => (i === itemIndex ? { ...item, [key]: value } : item))
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
    setItems((current) =>
      current.map((item, i) =>
        i === itemIndex
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

    setItems((current) =>
      current.map((item, i) => {
        if (i !== itemIndex) {
          return item;
        }
        const updated = {
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
          updated.unit_cost = `${suggestedCost}`;
        }
        return updated;
      })
    );
    setItemErrors((currentErrors) => ({ ...currentErrors, [itemIndex]: "" }));
    setOpenProductIndex(null);
  }

  function updateSupplier(itemIndex, supplierName) {
    setItems((current) =>
      current.map((item, i) => {
        if (i !== itemIndex) {
          return item;
        }
        const next = { ...item, supplier_name: supplierName };
        const suggestedCost = getLatestSupplierCost(
          purchases,
          item.product_id,
          supplierName
        );
        if (suggestedCost != null) {
          next.unit_cost = `${suggestedCost}`;
        }
        return next;
      })
    );
  }

  function addDiscount(itemIndex) {
    setItems((current) =>
      current.map((item, i) =>
        i === itemIndex
          ? { ...item, discounts: [...item.discounts, ""] }
          : item
      )
    );
  }

  function removeDiscount(itemIndex, discountIndex) {
    setItems((current) =>
      current.map((item, i) => {
        if (i !== itemIndex) return item;
        const next = item.discounts.filter((_, di) => di !== discountIndex);
        return { ...item, discounts: next.length === 0 ? [""] : next };
      })
    );
  }

  function updateDiscount(itemIndex, discountIndex, value) {
    setItems((current) =>
      current.map((item, i) => {
        if (i !== itemIndex) return item;
        const next = item.discounts.map((d, di) => (di === discountIndex ? value : d));
        return { ...item, discounts: next };
      })
    );
  }

  function addItem() {
    setItems((current) => [...current, emptyItem()]);
  }

  function removeItem(index) {
    setItems((current) => current.filter((_, i) => i !== index));
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
    const fromIndex =
      draggedItemIndex !== null ? draggedItemIndex : transferredIndex;

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
      setCustomerError("Select an existing customer from the list.");
      setCustomerOpen(true);
      return;
    }

    const nextItemErrors = {};
    items.forEach((item, index) => {
      if (!item.product_id) {
        nextItemErrors[index] = "Select an existing product from the list.";
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
            `• ${item.product_name || "Item"} — below cost by ${fmt(
              getLineLoss(item, activeAllItemsDiscount)
            )}`
        )
        .join("\n");
      const confirmed = window.confirm(
        `${belowCostItems.length} item(s) are priced below cost:\n\n${lines}\n\nSave this sale anyway?`
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
    formData.append("payment_term_days", form.payment_term_type === "credit" ? form.payment_term_days : "");
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

  const activeAllItemsDiscount = getActiveTransactionDiscount(
    allItemsDiscountEnabled,
    allItemsDiscountValue
  );
  const itemTotal = items.reduce(
    (sum, item) => sum + computeAmount(item, activeAllItemsDiscount),
    0
  );
  const vatSummary = computeVatSummary(itemTotal, vatMode);
  const paymentDate = computePaymentDate(form.transaction_date, form.payment_term_type, form.payment_term_days);

  return (
    <section className="section-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Sales Entry</p>
          <h3>Add Sales Transaction</h3>
        </div>
        {onCancel ? (
          <button className="secondary-button" type="button" onClick={onCancel}>
            Close
          </button>
        ) : null}
      </div>

      <form className="form-layout" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label>
            Reference No.
            <input
              value={form.reference_no}
              readOnly
              placeholder={nextReferenceNo}
            />
          </label>

          <label className="supplier-combobox-field">
            <span className="required-label">Customer Name</span>
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
                aria-controls="sales-customer-list"
                aria-invalid={customerError ? "true" : "false"}
              />

              {customerOpen ? (
                <div className="supplier-combobox-menu" id="sales-customer-list" role="listbox">
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
                onChange={(event) =>
                  setForm((f) => ({ ...f, payment_term_days: event.target.value }))
                }
              >
                <option value="">— Select credit term —</option>
                <option value="30 days">30 days</option>
                <option value="60 days">60 days</option>
                <option value="90 days">90 days</option>
              </select>
            </label>
          )}

          <label>
            <span className="required-label">Status</span>
            <select
              value={form.status}
              onChange={(event) => handleStatusChange(event.target.value)}
            >
              <option value="draft">Draft</option>
              <option value="packed">Packed</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
              <option value="returned">Returned</option>
            </select>
            {statusError || saleStockMessage ? (
              <span className="field-error-text">{statusError || saleStockMessage}</span>
            ) : null}
          </label>

          <label>
            <span className="required-label">Transaction Date</span>
            <input
              type="date"
              value={form.transaction_date}
              onChange={(event) => updateForm("transaction_date", event.target.value)}
            />
          </label>

          <label>
            Payment Date
            <input
              type="date"
              value={paymentDate}
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
                  {form.documents.length
                    ? `${form.documents.length} selected`
                    : "No documents selected"}
                </span>
              </div>
              <label className="document-upload-button">
                Add Files
                <input
                  type="file"
                  multiple
                  onChange={(event) =>
                    updateForm("documents", [
                      ...form.documents,
                      ...Array.from(event.target.files || []),
                    ])
                  }
                />
              </label>
            </div>

            {form.documents.length ? (
              <div className="transaction-document-list">
                {form.documents.map((document, index) => (
                  <span className="transaction-document-row" key={`${document.name}-${index}`}>
                    <span>{document.name}</span>
                    <button
                      className="text-danger-button"
                      type="button"
                      onClick={() =>
                        updateForm(
                          "documents",
                          form.documents.filter((_, documentIndex) => documentIndex !== index)
                        )
                      }
                    >
                      Remove
                    </button>
                  </span>
                ))}
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
            const amount = computeAmount(item, activeAllItemsDiscount);
            const lineLoss = getLineLoss(item, activeAllItemsDiscount);
            const filteredProducts = getFilteredProducts(item.product_query);
            const selectedProduct = products.find(
              (product) => `${product.id}` === `${item.product_id}`
            );
            const averageCostForSelectedUnit = getAverageCostForSelectedUnit(
              selectedProduct,
              item.unit
            );
            const unitOptions = selectedProduct
              ? getProductUnitOptions(selectedProduct, "sale")
              : [];
            const conversionPreview = selectedProduct
              ? buildConvertedItemFields(selectedProduct, item.quantity, item.unit, "sale")
              : null;

            return (
              <div
                className={
                  draggedItemIndex !== null && draggedItemIndex !== index
                    ? "line-item-row sales-line-item-row is-drop-target"
                    : "line-item-row sales-line-item-row"
                }
                key={item.line_id}
                onDragOverCapture={handleItemDragOver}
                onDropCapture={(event) => handleItemDrop(event, index)}
              >
                <div
                  className={
                    draggedItemIndex === index
                      ? "line-item-index is-dragging"
                      : "line-item-index"
                  }
                  draggable={items.length > 1}
                  title={items.length > 1 ? "Drag to reorder" : "Item order"}
                  aria-label={`Item ${index + 1}. Drag to reorder`}
                  onDragStart={(event) => handleItemDragStart(event, index)}
                  onDragEnd={handleItemDragEnd}
                >
                  {index + 1}
                </div>

                <label className="purchase-item-field sales-item-product">
                  <span className="required-label">Product</span>
                  <div className="supplier-combobox">
                    <input
                      value={item.product_query}
                      onChange={(event) => updateProductQuery(index, event.target.value)}
                      onFocus={() => setOpenProductIndex(index)}
                      onBlur={() => {
                        window.setTimeout(() => setOpenProductIndex(null), 120);
                      }}
                      placeholder="Search existing product"
                      autoComplete="off"
                      aria-expanded={openProductIndex === index}
                      aria-controls={`sales-product-list-${item.line_id}`}
                      aria-invalid={itemErrors[index] ? "true" : "false"}
                      required
                    />

                    {openProductIndex === index ? (
                      <div
                        className="supplier-combobox-menu"
                        id={`sales-product-list-${item.line_id}`}
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
                                {sku ? `${productName} (${sku})` : productName}
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

                <label className="purchase-item-field sales-item-unit">
                  <span className="required-label">Unit</span>
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

                <label className="purchase-item-field sales-item-qty">
                  <span className="required-label">Qty</span>
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
                  <span className="required-label">Unit Price</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unit_price}
                    onChange={(event) => updateItem(index, "unit_price", event.target.value)}
                    placeholder="0.00"
                    required
                  />
                  {averageCostForSelectedUnit ? (
                    <span className="field-helper-text">
                      {t("common.avgCostForUnit", {
                        amount: fmt(averageCostForSelectedUnit),
                        unit: item.unit || getProductUnit(selectedProduct),
                      })}
                    </span>
                  ) : null}
                </label>

                <div className="purchase-item-field sales-item-discounts">
                  <span>Discounts</span>
                  <div className="sales-discount-cell">
                    {item.discounts.map((d, di) => (
                      <div key={di} className="sales-discount-entry">
                        {di > 0 && (
                          <span className="sales-discount-chain-label">then</span>
                        )}
                        <input
                          className="sales-discount-input"
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={d}
                          onChange={(event) => updateDiscount(index, di, event.target.value)}
                          placeholder="0"
                        />
                        <span className="sales-discount-pct">%</span>
                        {item.discounts.length > 1 && (
                          <button
                            className="sales-discount-remove"
                            type="button"
                            aria-label="Remove discount"
                            onClick={() => removeDiscount(index, di)}
                          >
                            X
                          </button>
                        )}
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

                <label className="purchase-item-field sales-item-supplier">
                  <span>Supplier (Source)</span>
                  <input
                    list="sales-supplier-options"
                    value={item.supplier_name}
                    onChange={(event) =>
                      updateSupplier(index, event.target.value)
                    }
                    placeholder="Optional"
                  />
                </label>

                <label className="purchase-item-field sales-item-cost">
                  <span>Unit Cost</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={lineLoss > 0 ? "sales-cost-input below-cost" : undefined}
                    value={item.unit_cost}
                    onChange={(event) =>
                      updateItem(index, "unit_cost", event.target.value)
                    }
                    placeholder="0.00"
                  />
                  {lineLoss > 0 ? (
                    <span className="sales-below-cost-warning">
                      ⚠ Below cost by {fmt(lineLoss)}
                    </span>
                  ) : null}
                </label>

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
          <datalist id="sales-supplier-options">
            {supplierNameOptions.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </div>

        <AllItemsDiscountControl
          enabled={allItemsDiscountEnabled}
          value={allItemsDiscountValue}
          onEnabledChange={setAllItemsDiscountEnabled}
          onValueChange={setAllItemsDiscountValue}
        />

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
            <div className="purchase-vat-options" role="radiogroup" aria-label="Sales VAT setting">
              {vatOptions.map((option) => (
                <label
                  key={option.value}
                  className={vatMode === option.value ? "purchase-vat-option active" : "purchase-vat-option"}
                >
                  <input
                    type="radio"
                    name="sales-vat-mode"
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

        <button className="primary-button" type="submit">
          Save Sale
        </button>
      </form>
    </section>
  );
}

export default SalesForm;
