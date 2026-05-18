import { useMemo, useRef, useState } from "react";
import EligiblePartyCombobox from "./EligiblePartyCombobox";
import PurchaseForm from "./PurchaseForm";
import SalesForm from "./SalesForm";
import {
  buildConvertedItemFields,
  getProductDefaultSalesUnit,
  getProductUnitConversions,
} from "../unitConversion";
import { formatMoney as fmt } from "../format";

const VAT_RATE = 0.07;
const vatOptions = [
  { value: "included", label: "VAT Included" },
  { value: "not_included", label: "VAT Not Included" },
];

function getToday() {
  return formatDateInputValue(new Date());
}

function formatDateInputValue(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDays(dateString, days) {
  const [year, month, day] = `${dateString}`.split("-").map(Number);
  const date =
    year && month && day ? new Date(year, month - 1, day) : new Date();

  date.setDate(date.getDate() + days);
  return formatDateInputValue(date);
}

function getQuotationReferencePrefix(date = new Date()) {
  const buddhistYear = date.getFullYear() + 543;
  const yearSuffix = `${buddhistYear}`.slice(-2);
  const month = `${date.getMonth() + 1}`.padStart(2, "0");

  return `QT-${yearSuffix}${month}`;
}

function getReferenceDate(dateString = "") {
  const [year, month, day] = `${dateString}`.split("-").map(Number);
  const parsedDate =
    year && month && day ? new Date(year, month - 1, day) : new Date();

  return Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
}

function getNextQuotationReference(quotations = [], dateString = getToday()) {
  const prefix = getQuotationReferencePrefix(getReferenceDate(dateString));
  const referencePattern = new RegExp(`^${prefix}-(\\d+)$`);
  const maxSerial = quotations.reduce((max, quotation) => {
    const match = `${quotation.reference_no || ""}`.match(referencePattern);

    if (!match) {
      return max;
    }

    return Math.max(max, Number(match[1]));
  }, 0);
  const nextSerial = maxSerial + 1;

  return `${prefix}-${`${nextSerial}`.padStart(3, "0")}`;
}

function emptyItem() {
  return {
    line_id: `quotation-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    product_id: "",
    product_name: "",
    sku: "",
    unit: "pcs",
    quantity: 1,
    sale_price: "",
    cost_price: "",
    discounts: [0],
  };
}

function getProductName(product) {
  return product?.name || product?.productName || product?.product_name || product?.sku || `Product ${product?.id}`;
}

function getProductSku(product) {
  return product?.sku || product?.SKU || "";
}

function findProductForItem(item, products = []) {
  if (item.product_id) {
    const byId = products.find((product) => `${product.id}` === `${item.product_id}`);

    if (byId) {
      return byId;
    }
  }

  const sku = `${item.sku || ""}`.trim().toLowerCase();
  if (sku) {
    const bySku = products.find((product) => getProductSku(product).toLowerCase() === sku);

    if (bySku) {
      return bySku;
    }
  }

  const productName = `${item.product_name || ""}`.trim().toLowerCase();
  return products.find((product) => getProductName(product).toLowerCase() === productName);
}

function normalizeDiscounts(item) {
  if (Array.isArray(item.discounts) && item.discounts.length) {
    return item.discounts;
  }

  if (Number(item.discount) > 0) {
    return [item.discount];
  }

  return [0];
}

function computeAmount(item, priceKey = "sale_price") {
  const qty = Number(item.quantity) || 0;
  const price = Number(item[priceKey]) || 0;
  const multiplier = normalizeDiscounts(item).reduce((acc, discount) => {
    const clamped = Math.min(100, Math.max(0, Number(discount) || 0));
    return acc * (1 - clamped / 100);
  }, 1);

  return qty * price * multiplier;
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


function normalizePartnerOptions(partners = [], currentName = "") {
  const normalizedPartners = partners
    .map((partner) => ({
      id: partner.id || partner.companyName,
      companyName: `${partner.companyName ?? partner.name ?? ""}`.trim(),
    }))
    .filter((partner) => partner.companyName);
  const selectedName = currentName.trim();

  if (
    selectedName &&
    !normalizedPartners.some(
      (partner) => partner.companyName.toLowerCase() === selectedName.toLowerCase()
    )
  ) {
    return [{ id: `current-${selectedName}`, companyName: selectedName }, ...normalizedPartners];
  }

  return normalizedPartners;
}

function createInitialForm(referenceNo) {
  const today = getToday();

  return {
    reference_no: referenceNo,
    quotation_date: today,
    valid_until_date: addDays(today, 30),
    customer_name: "",
    supplier_name: "",
    vat_mode: "not_included",
    note: "",
  };
}

function createEditForm(quotation) {
  return {
    reference_no: quotation.reference_no || "",
    quotation_date: quotation.quotation_date || getToday(),
    valid_until_date: quotation.valid_until_date || "",
    customer_name: quotation.customer_name || "",
    supplier_name: quotation.supplier_name || "",
    vat_mode: quotation.vat_mode || "not_included",
    note: quotation.note || "",
  };
}

function createEditItems(quotation) {
  const sourceItems = Array.isArray(quotation.items) ? quotation.items : [];

  if (!sourceItems.length) {
    return [emptyItem()];
  }

  return sourceItems.map((item, index) => ({
    ...emptyItem(),
    line_id: item.line_id || item.id || `quotation-edit-${quotation.id}-${index}`,
    product_id: item.product_id || item.productId || "",
    product_name: item.product_name || item.productName || item.name || "",
    sku: item.sku || item.SKU || "",
    unit: item.unit || "pcs",
    quantity: item.quantity ?? 1,
    sale_price: item.sale_price ?? item.unit_price ?? "",
    cost_price: item.cost_price ?? item.unit_cost ?? "",
    discounts: normalizeDiscounts(item),
  }));
}

function getItemCount(items = []) {
  return items.length.toLocaleString("en-US");
}

function quotationMatchesQuery(quotation, query) {
  const searchableText = [
    quotation.reference_no,
    quotation.quotation_date,
    quotation.valid_until_date,
    quotation.customer_name,
    quotation.supplier_name,
    quotation.vat_mode,
    quotation.note,
    ...(quotation.items || []).flatMap((item) => [
      item.product_name,
      item.sku,
      item.unit,
      item.quantity,
      item.sale_price,
      item.cost_price,
    ]),
  ]
    .map((value) => `${value ?? ""}`.toLowerCase())
    .join(" ");

  return searchableText.includes(query);
}

function sortRecentQuotations(a, b) {
  const dateCompare = `${b.quotation_date || ""}`.localeCompare(`${a.quotation_date || ""}`);

  if (dateCompare !== 0) {
    return dateCompare;
  }

  return `${b.created_at || b.id || ""}`.localeCompare(`${a.created_at || a.id || ""}`);
}

function getQuotationState(quotation) {
  if (quotation.valid_until_date && quotation.valid_until_date < getToday()) {
    return "Expired";
  }

  return "Valid";
}

function quotationMatchesDateRange(quotationDate, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) {
    return true;
  }

  if (!quotationDate) {
    return false;
  }

  if (dateFrom && quotationDate < dateFrom) {
    return false;
  }

  if (dateTo && quotationDate > dateTo) {
    return false;
  }

  return true;
}

function getQuotationPartnerOptions(quotations, key, partners = []) {
  const optionMap = new Map();

  normalizePartnerOptions(partners).forEach((partner) => {
    optionMap.set(partner.companyName.toLowerCase(), partner.companyName);
  });

  quotations.forEach((quotation) => {
    const companyName = `${quotation[key] ?? ""}`.trim();

    if (companyName) {
      optionMap.set(companyName.toLowerCase(), companyName);
    }
  });

  return [...optionMap.values()].sort((left, right) => left.localeCompare(right));
}

function buildPurchasePrefill(quotation) {
  return {
    supplier_name: quotation.supplier_name || "",
    transaction_date: quotation.quotation_date || getToday(),
    vat_mode: quotation.vat_mode || "not_included",
    note: quotation.note || "",
    items: (quotation.items || []).map((item) => ({
      product_id: item.product_id || "",
      product_name: item.product_name || "",
      sku: item.sku || "",
      unit: item.unit || "pcs",
      quantity: item.quantity ?? 1,
      unit_cost: item.cost_price ?? "",
      discounts: normalizeDiscounts(item),
    })),
  };
}

function buildSalesPrefill(quotation) {
  return {
    customer_name: quotation.customer_name || "",
    transaction_date: quotation.quotation_date || getToday(),
    vat_mode: quotation.vat_mode || "not_included",
    note: quotation.note || "",
    items: (quotation.items || []).map((item) => ({
      product_id: item.product_id || "",
      product_name: item.product_name || "",
      sku: item.sku || "",
      unit: item.unit || "pcs",
      quantity: item.quantity ?? 1,
      unit_price: item.sale_price ?? "",
      discounts: normalizeDiscounts(item),
    })),
  };
}

function QuotationForm({
  quotation = null,
  quotations = [],
  products = [],
  suppliers = [],
  customers = [],
  onSave,
  onCancel,
}) {
  const isEditing = Boolean(quotation);
  const initialReference = quotation?.reference_no || getNextQuotationReference(quotations);
  const lastGeneratedReference = useRef(initialReference);
  const [form, setForm] = useState(() =>
    quotation ? createEditForm(quotation) : createInitialForm(initialReference)
  );
  const [items, setItems] = useState(() =>
    quotation ? createEditItems(quotation) : [emptyItem()]
  );
  const [formError, setFormError] = useState("");
  const customerOptions = useMemo(
    () => normalizePartnerOptions(customers, form.customer_name).map(
      (customer) => customer.companyName
    ),
    [customers, form.customer_name]
  );
  const supplierOptions = useMemo(
    () => normalizePartnerOptions(suppliers, form.supplier_name).map(
      (supplier) => supplier.companyName
    ),
    [form.supplier_name, suppliers]
  );
  const itemTotal = items.reduce((sum, item) => sum + computeAmount(item, "sale_price"), 0);
  const vatSummary = computeVatSummary(itemTotal, form.vat_mode);

  function updateForm(key, value) {
    setForm((currentForm) => ({ ...currentForm, [key]: value }));
  }

  function handleQuotationDateChange(value) {
    setForm((currentForm) => {
      const nextReference = getNextQuotationReference(quotations, value);
      const shouldRefreshReference =
        !isEditing && currentForm.reference_no === lastGeneratedReference.current;

      lastGeneratedReference.current = nextReference;

      return {
        ...currentForm,
        reference_no: shouldRefreshReference ? nextReference : currentForm.reference_no,
        quotation_date: value,
        valid_until_date:
          currentForm.valid_until_date && currentForm.valid_until_date < value
            ? value
            : currentForm.valid_until_date,
      };
    });
  }

  function updateItem(itemIndex, key, value) {
    setItems((currentItems) =>
      currentItems.map((item, index) =>
        index === itemIndex ? { ...item, [key]: value } : item
      )
    );
  }

  function updateProduct(itemIndex, productId) {
    const selectedProduct = products.find((product) => `${product.id}` === `${productId}`);

    setItems((currentItems) =>
      currentItems.map((item, index) =>
        index === itemIndex
          ? {
              ...item,
              product_id: selectedProduct?.id || "",
              product_name: selectedProduct ? getProductName(selectedProduct) : "",
              sku: selectedProduct ? getProductSku(selectedProduct) : "",
              unit: selectedProduct ? getProductDefaultSalesUnit(selectedProduct) : "pcs",
            }
          : item
      )
    );
  }

  function addItem() {
    setItems((currentItems) => [...currentItems, emptyItem()]);
  }

  function removeItem(itemIndex) {
    setItems((currentItems) => currentItems.filter((_, index) => index !== itemIndex));
  }

  function addDiscount(itemIndex) {
    setItems((currentItems) =>
      currentItems.map((item, index) =>
        index === itemIndex
          ? { ...item, discounts: [...normalizeDiscounts(item), 0] }
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

        const nextDiscounts = normalizeDiscounts(item).filter(
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

    if (!form.quotation_date) {
      setFormError("Quotation date is required.");
      return;
    }

    if (!form.valid_until_date) {
      setFormError("Valid until date is required.");
      return;
    }

    if (form.valid_until_date < form.quotation_date) {
      setFormError("Valid until date cannot be before quotation date.");
      return;
    }

    const normalizedItems = items.map((item, index) => {
      const selectedProduct = findProductForItem(item, products);

      if (!selectedProduct) {
        throw new Error(`Select an existing product for item ${index + 1}.`);
      }

      if (!item.quantity || Number(item.quantity) <= 0) {
        throw new Error(`Enter quantity for item ${index + 1}.`);
      }

      if (item.sale_price === "" || item.sale_price === null || item.sale_price === undefined) {
        throw new Error(`Enter sale price for item ${index + 1}.`);
      }

      const discounts = normalizeDiscounts(item);
      const convertedFields = buildConvertedItemFields(
        selectedProduct,
        item.quantity,
        item.unit,
        "sale"
      );

      return {
        line_id: item.line_id,
        product_id: selectedProduct.id,
        product_name: getProductName(selectedProduct),
        sku: getProductSku(selectedProduct),
        ...convertedFields,
        quantity: Number(item.quantity) || 0,
        sale_price: item.sale_price,
        cost_price: item.cost_price === undefined || item.cost_price === null ? "" : item.cost_price,
        discounts,
        sale_amount: computeAmount(item, "sale_price"),
        cost_amount: item.cost_price === "" ? 0 : computeAmount(item, "cost_price"),
      };
    });

    try {
      const savedQuotation = await onSave({
        ...(quotation || {}),
        reference_no: form.reference_no,
        quotation_date: form.quotation_date,
        valid_until_date: form.valid_until_date,
        customer_name: form.customer_name,
        supplier_name: form.supplier_name,
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

      if (isEditing) {
        onCancel();
      } else {
        onCancel?.();
      }
    } catch (error) {
      setFormError(error.message);
    }
  }

  return (
    <section className="section-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{isEditing ? "Quotation Edit" : "Quotation Entry"}</p>
          <h3>{isEditing ? "Edit Quotation" : "New Quotation"}</h3>
        </div>
        {onCancel ? (
          <button className="secondary-button table-action-button" type="button" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </div>

      {formError ? <div className="error-banner">{formError}</div> : null}

      <form className="form-layout" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label>
            Quotation Number
            <input
              value={form.reference_no}
              readOnly={!isEditing}
              onChange={(event) => updateForm("reference_no", event.target.value)}
              placeholder={initialReference}
            />
          </label>

          <label>
            <span className="required-label">Quotation Date</span>
            <input
              type="date"
              value={form.quotation_date}
              onChange={(event) => handleQuotationDateChange(event.target.value)}
              required
            />
          </label>

          <label>
            <span className="required-label">Valid Until Date</span>
            <input
              type="date"
              value={form.valid_until_date}
              min={form.quotation_date}
              onChange={(event) => updateForm("valid_until_date", event.target.value)}
              required
            />
          </label>

          <EligiblePartyCombobox
            id="quotation-customer"
            label="Customer Name"
            value={form.customer_name}
            options={customerOptions}
            placeholder="Search customer"
            emptyMessage="No customers found."
            onChange={(nextCustomerName) => updateForm("customer_name", nextCustomerName)}
          />

          <EligiblePartyCombobox
            id="quotation-supplier"
            label="Supplier Name"
            value={form.supplier_name}
            options={supplierOptions}
            placeholder="Search supplier"
            emptyMessage="No suppliers found."
            onChange={(nextSupplierName) => updateForm("supplier_name", nextSupplierName)}
          />

          <label className="full-width">
            Note
            <textarea
              rows="3"
              value={form.note}
              onChange={(event) => updateForm("note", event.target.value)}
            />
          </label>
        </div>

        <div className="line-items-card">
          <div className="line-items-header">
            <h4>Quotation Items</h4>
            <button className="secondary-button" type="button" onClick={addItem}>
              Add Item
            </button>
          </div>

          {items.map((item, index) => {
            const selectedProduct = findProductForItem(item, products);
            const unitOptions = selectedProduct ? getProductUnitConversions(selectedProduct) : [];
            const saleAmount = computeAmount(item, "sale_price");

            return (
              <div className="line-item-row quotation-line-item-row" key={item.line_id}>
                <div className="line-item-index" aria-label={`Item ${index + 1}`}>
                  {index + 1}
                </div>

                <label className="purchase-item-field quotation-item-product">
                  <span className="required-label">Product</span>
                  <select
                    value={item.product_id}
                    onChange={(event) => updateProduct(index, event.target.value)}
                    required
                  >
                    <option value="">Select product</option>
                    {products.map((product) => {
                      const sku = getProductSku(product);

                      return (
                        <option key={product.id} value={product.id}>
                          {sku ? `${getProductName(product)} (${sku})` : getProductName(product)}
                        </option>
                      );
                    })}
                  </select>
                </label>

                <label className="purchase-item-field quotation-item-unit">
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
                </label>

                <label className="purchase-item-field quotation-item-qty">
                  <span className="required-label">Qty</span>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(event) => updateItem(index, "quantity", event.target.value)}
                    required
                  />
                </label>

                <label className="purchase-item-field quotation-item-sale">
                  <span className="required-label">Sale Price</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.sale_price}
                    onChange={(event) => updateItem(index, "sale_price", event.target.value)}
                    placeholder="0.00"
                    required
                  />
                </label>

                <label className="purchase-item-field quotation-item-cost">
                  <span>Cost Price</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.cost_price}
                    onChange={(event) => updateItem(index, "cost_price", event.target.value)}
                    placeholder="Optional"
                  />
                </label>

                <div className="purchase-item-field quotation-item-discounts">
                  <span>Discounts</span>
                  <div className="sales-discount-cell">
                    {normalizeDiscounts(item).map((discount, discountIndex) => (
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
                        {normalizeDiscounts(item).length > 1 ? (
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

                <div className="purchase-item-field quotation-item-amount">
                  <span>Sale Amount</span>
                  <div className="sales-line-amount">{fmt(saleAmount)}</div>
                </div>

                <button
                  className="danger-button quotation-item-remove"
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
                checked={isVatEnabled(form.vat_mode)}
                onChange={(event) =>
                  updateForm("vat_mode", event.target.checked ? "not_included" : "none")
                }
              />
              <span className="vat-toggle-track" />
              <span className="vat-toggle-text">
                {isVatEnabled(form.vat_mode) ? "On" : "Off"}
              </span>
            </label>
          </div>
          {isVatEnabled(form.vat_mode) ? (
            <div className="purchase-vat-options" role="radiogroup" aria-label="Quotation VAT setting">
              {vatOptions.map((option) => (
                <label
                  key={option.value}
                  className={form.vat_mode === option.value ? "purchase-vat-option active" : "purchase-vat-option"}
                >
                  <input
                    type="radio"
                    name={`quotation-vat-mode-${quotation?.id || "new"}`}
                    value={option.value}
                    checked={form.vat_mode === option.value}
                    onChange={(event) => updateForm("vat_mode", event.target.value)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          ) : null}
        </section>

        <div className="sales-summary-card">
          {isVatEnabled(form.vat_mode) ? (
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
          {onCancel ? (
            <button className="secondary-button" type="button" onClick={onCancel}>
              Cancel
            </button>
          ) : null}
          <button className="primary-button" type="submit">
            {isEditing ? "Save Quotation" : "Create Quotation"}
          </button>
        </div>
      </form>
    </section>
  );
}

function QuotationPage({
  quotations = [],
  products = [],
  suppliers = [],
  customers = [],
  purchases = [],
  sales = [],
  enableSaleStockValidation = true,
  onSaveQuotation,
  onDeleteQuotation,
  onCreatePurchase,
  onCreateSale,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [vatFilter, setVatFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [viewingQuotation, setViewingQuotation] = useState(null);
  const [editingQuotation, setEditingQuotation] = useState(null);
  const [showNewQuotationForm, setShowNewQuotationForm] = useState(false);
  const [showAllRows, setShowAllRows] = useState(false);
  const [conversion, setConversion] = useState(null);
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const customerOptions = useMemo(
    () => getQuotationPartnerOptions(quotations, "customer_name", customers),
    [customers, quotations]
  );
  const supplierOptions = useMemo(
    () => getQuotationPartnerOptions(quotations, "supplier_name", suppliers),
    [quotations, suppliers]
  );
  const activeFilterCount =
    (selectedCustomer ? 1 : 0) +
    (selectedSupplier ? 1 : 0) +
    (stateFilter === "all" ? 0 : 1) +
    (vatFilter === "all" ? 0 : 1) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0);
  const filteredQuotations = useMemo(
    () =>
      quotations
        .filter((quotation) => {
          const matchesSearch = normalizedSearch
            ? quotationMatchesQuery(quotation, normalizedSearch)
            : true;
          const matchesCustomer = selectedCustomer
            ? quotation.customer_name === selectedCustomer
            : true;
          const matchesSupplier = selectedSupplier
            ? quotation.supplier_name === selectedSupplier
            : true;
          const matchesState =
            stateFilter === "all" ||
            getQuotationState(quotation).toLowerCase() === stateFilter;
          const matchesVat = vatFilter === "all" || quotation.vat_mode === vatFilter;
          const matchesDateRange = quotationMatchesDateRange(
            quotation.quotation_date,
            dateFrom,
            dateTo
          );

          return (
            matchesSearch &&
            matchesCustomer &&
            matchesSupplier &&
            matchesState &&
            matchesVat &&
            matchesDateRange
          );
        })
        .sort(sortRecentQuotations),
    [
      dateFrom,
      dateTo,
      normalizedSearch,
      quotations,
      selectedCustomer,
      selectedSupplier,
      stateFilter,
      vatFilter,
    ]
  );
  const compactRows = 5;
  const shouldShowViewAll = filteredQuotations.length > compactRows;
  const isCompact = shouldShowViewAll && !showAllRows;
  function resetFilters() {
    setSearchTerm("");
    setSelectedCustomer("");
    setSelectedSupplier("");
    setStateFilter("all");
    setVatFilter("all");
    setDateFrom("");
    setDateTo("");
    setFilterOpen(false);
  }

  async function handleDelete(quotation) {
    const confirmed = window.confirm(
      `Delete quotation ${quotation.reference_no || quotation.id}? This action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    const deleted = await onDeleteQuotation?.(quotation);

    if (deleted === false) {
      return;
    }

    setViewingQuotation((current) => (current?.id === quotation.id ? null : current));
    setEditingQuotation((currentQuotation) =>
      currentQuotation?.id === quotation.id ? null : currentQuotation
    );
  }

  async function handlePurchaseCreate(formData) {
    const saved = await onCreatePurchase?.(formData);

    if (saved === false) {
      return false;
    }

    setConversion(null);
    return true;
  }

  async function handleSaleCreate(formData) {
    const saved = await onCreateSale?.(formData);

    if (saved === false) {
      return false;
    }

    setConversion(null);
    return true;
  }

  async function handleSaveQuotation(quotation) {
    const saved = await onSaveQuotation?.(quotation);

    if (saved === false) {
      return false;
    }

    setShowNewQuotationForm(false);
    setEditingQuotation(null);
    return saved;
  }

  if (showNewQuotationForm) {
    return (
      <div className="stack-layout">
        <QuotationForm
          key="new-quotation"
          quotations={quotations}
          products={products}
          suppliers={suppliers}
          customers={customers}
          onSave={handleSaveQuotation}
          onCancel={() => setShowNewQuotationForm(false)}
        />
      </div>
    );
  }

  if (editingQuotation) {
    return (
      <div className="stack-layout">
        <QuotationForm
          key={editingQuotation.id}
          quotation={editingQuotation}
          quotations={quotations}
          products={products}
          suppliers={suppliers}
          customers={customers}
          onSave={handleSaveQuotation}
          onCancel={() => setEditingQuotation(null)}
        />
      </div>
    );
  }

  if (conversion?.type === "purchase") {
    return (
      <div className="stack-layout">
        <section className="section-card quotation-link-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Quotation Link</p>
              <h3>Create Purchase from {conversion.quotation.reference_no}</h3>
            </div>
            <button className="secondary-button" type="button" onClick={() => setConversion(null)}>
              Back
            </button>
          </div>
        </section>
        <PurchaseForm
          key={`purchase-from-${conversion.quotation.id}`}
          products={products}
          suppliers={suppliers}
          purchases={purchases}
          prefill={buildPurchasePrefill(conversion.quotation)}
          onSubmit={handlePurchaseCreate}
          onCancel={() => setConversion(null)}
        />
      </div>
    );
  }

  if (conversion?.type === "sale") {
    return (
      <div className="stack-layout">
        <section className="section-card quotation-link-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Quotation Link</p>
              <h3>Create Sale from {conversion.quotation.reference_no}</h3>
            </div>
            <button className="secondary-button" type="button" onClick={() => setConversion(null)}>
              Back
            </button>
          </div>
        </section>
        <SalesForm
          key={`sale-from-${conversion.quotation.id}`}
          products={products}
          customers={customers}
          purchases={purchases}
          sales={sales}
          enableStockValidation={enableSaleStockValidation}
          prefill={buildSalesPrefill(conversion.quotation)}
          onSubmit={handleSaleCreate}
          onCancel={() => setConversion(null)}
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
            <h3>Find Quotation Records</h3>
          </div>
        </div>

        <div className="supplier-directory-toolbar">
          <label className="stock-search supplier-search">
            <span className="stock-search-icon">Q</span>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search quotation, customer, supplier, date, note, or item"
            />
          </label>
          <div className="stock-report-summary supplier-search-meta">
            <span>
              {filteredQuotations.length} of {quotations.length} quotations shown
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

        {filterOpen ? (
          <div className="history-filter-panel">
            <div className="history-filter-grid">
              <label className="history-filter-field">
                <span className="history-filter-title">Customer</span>
                <select
                  value={selectedCustomer}
                  onChange={(event) => setSelectedCustomer(event.target.value)}
                >
                  <option value="">All customers</option>
                  {customerOptions.map((customerName) => (
                    <option key={customerName} value={customerName}>
                      {customerName}
                    </option>
                  ))}
                </select>
              </label>

              <label className="history-filter-field">
                <span className="history-filter-title">Supplier</span>
                <select
                  value={selectedSupplier}
                  onChange={(event) => setSelectedSupplier(event.target.value)}
                >
                  <option value="">All suppliers</option>
                  {supplierOptions.map((supplierName) => (
                    <option key={supplierName} value={supplierName}>
                      {supplierName}
                    </option>
                  ))}
                </select>
              </label>

              <label className="history-filter-field">
                <span className="history-filter-title">State</span>
                <select
                  value={stateFilter}
                  onChange={(event) => setStateFilter(event.target.value)}
                >
                  <option value="all">All states</option>
                  <option value="valid">Valid</option>
                  <option value="expired">Expired</option>
                </select>
              </label>

              <label className="history-filter-field">
                <span className="history-filter-title">VAT</span>
                <select
                  value={vatFilter}
                  onChange={(event) => setVatFilter(event.target.value)}
                >
                  <option value="all">All VAT settings</option>
                  <option value="included">VAT included</option>
                  <option value="not_included">VAT not included</option>
                  <option value="none">No VAT</option>
                </select>
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
          </div>
        ) : null}
      </section>

      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">History</p>
            <h3>Quotations</h3>
          </div>
          <div className="transaction-table-actions">
            <button
              className="primary-button"
              type="button"
              onClick={() => {
                setEditingQuotation(null);
                setConversion(null);
                setShowNewQuotationForm(true);
              }}
            >
              Create Quotation
            </button>
            {shouldShowViewAll ? (
              <button
                className="secondary-button"
                type="button"
                onClick={() => setShowAllRows((currentValue) => !currentValue)}
              >
                {showAllRows ? "Show Recent" : "View More"}
              </button>
            ) : null}
          </div>
        </div>

        {filteredQuotations.length ? (
          <div
            className={
              isCompact
                ? "transaction-table-window quotation-table-window compact-history"
                : "transaction-table-window quotation-table-window"
            }
          >
            <div className="table-scroll desktop-table">
              <table className="transaction-history-table transaction-history-table-quotation">
                <colgroup>
                  <col className="quotation-col-index" />
                  <col className="quotation-col-reference" />
                  <col className="quotation-col-party" />
                  <col className="quotation-col-party" />
                  <col className="quotation-col-dates" />
                  <col className="quotation-col-items" />
                  <col className="quotation-col-total" />
                  <col className="quotation-col-actions" />
                </colgroup>
                <thead>
                  <tr>
                    <th className="table-index-cell">#</th>
                    <th>Quotation</th>
                    <th>Customer</th>
                    <th>Supplier</th>
                    <th>Dates</th>
                    <th>Items</th>
                    <th>Total</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filteredQuotations.map((quotation, index) => {
                    const itemCount = getItemCount(quotation.items || []);

                    return (
                      <tr key={quotation.id || quotation.reference_no}>
                        <td className="table-index-cell">{index + 1}</td>
                        <td>
                          <div className="transaction-reference-cell">
                            <strong>{quotation.reference_no || "—"}</strong>
                            <span className={`quotation-state-pill ${getQuotationState(quotation).toLowerCase()}`}>
                              {getQuotationState(quotation)}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="cell-stack">
                            <strong>{quotation.customer_name || "—"}</strong>
                            <span>Customer</span>
                          </div>
                        </td>
                        <td>
                          <div className="cell-stack">
                            <strong>{quotation.supplier_name || "—"}</strong>
                            <span>Supplier</span>
                          </div>
                        </td>
                        <td>
                          <div className="cell-stack">
                            <span className="quotation-date-value">
                              {quotation.quotation_date || "—"}
                            </span>
                            <span>Valid until {quotation.valid_until_date || "—"}</span>
                          </div>
                        </td>
                        <td>
                          <div className="history-item-summary history-item-quantity-only">
                            <span className="history-item-count">{itemCount}</span>
                          </div>
                        </td>
                        <td>
                          <strong>{fmt(quotation.grand_total)}</strong>
                        </td>
                        <td>
                          <button
                            className="table-action-button"
                            type="button"
                            onClick={() => setViewingQuotation(quotation)}
                          >
                            Detail
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mobile-record-list">
              {filteredQuotations.map((quotation, index) => {
                const itemCount = getItemCount(quotation.items || []);

                return (
                  <article className="mobile-record-card" key={`mobile-quotation-${quotation.id || quotation.reference_no}`}>
                    <div className="mobile-record-header">
                      <div className="mobile-record-title">
                        <span className="mobile-record-index">{index + 1}</span>
                        <div className="cell-stack">
                          <strong>{quotation.reference_no || "—"}</strong>
                          <span>{quotation.customer_name || "—"}</span>
                        </div>
                      </div>
                      <span className={`quotation-state-pill ${getQuotationState(quotation).toLowerCase()}`}>
                        {getQuotationState(quotation)}
                      </span>
                    </div>

                    <div className="mobile-record-grid">
                      <div>
                        <span>Supplier</span>
                        <strong>{quotation.supplier_name || "—"}</strong>
                      </div>
                      <div>
                        <span>Date</span>
                        <strong>{quotation.quotation_date || "—"}</strong>
                      </div>
                      <div>
                        <span>Valid Until</span>
                        <strong>{quotation.valid_until_date || "—"}</strong>
                      </div>
                      <div>
                        <span>Total</span>
                        <strong>{fmt(quotation.grand_total)}</strong>
                      </div>
                      <div className="full-width-mobile">
                        <span>Items</span>
                        <div className="history-item-summary mobile-history-item-summary history-item-quantity-only">
                          <span className="history-item-count">{itemCount}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      className="secondary-button table-action-button mobile-record-button"
                      type="button"
                      onClick={() => setViewingQuotation(quotation)}
                    >
                      Detail
                    </button>
                  </article>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="empty-copy">No quotations saved yet.</p>
        )}

      </section>

      {viewingQuotation ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setViewingQuotation(null)}
        >
          <div
            className="detail-modal section-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="quotation-detail-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">Quotation Detail</p>
                <h3 id="quotation-detail-title">{viewingQuotation.reference_no}</h3>
              </div>
              <div className="transaction-detail-actions">
                <button
                  className="edit-button table-action-button"
                  type="button"
                  onClick={() => {
                    setViewingQuotation(null);
                    setEditingQuotation(viewingQuotation);
                    setShowNewQuotationForm(false);
                    setConversion(null);
                  }}
                >
                  Edit
                </button>
                <button
                  className="table-action-button"
                  type="button"
                  onClick={() => {
                    setViewingQuotation(null);
                    setEditingQuotation(null);
                    setShowNewQuotationForm(false);
                    setConversion({ type: "purchase", quotation: viewingQuotation });
                  }}
                >
                  Purchase
                </button>
                <button
                  className="table-action-button"
                  type="button"
                  onClick={() => {
                    setViewingQuotation(null);
                    setEditingQuotation(null);
                    setShowNewQuotationForm(false);
                    setConversion({ type: "sale", quotation: viewingQuotation });
                  }}
                >
                  Sale
                </button>
                <button
                  className="secondary-button table-action-button"
                  type="button"
                  onClick={() => setViewingQuotation(null)}
                >
                  Close
                </button>
              </div>
            </div>

            <div className="detail-grid">
              <div>
                <p className="detail-label">Customer</p>
                <strong>{viewingQuotation.customer_name || "—"}</strong>
              </div>
              <div>
                <p className="detail-label">Supplier</p>
                <strong>{viewingQuotation.supplier_name || "—"}</strong>
              </div>
              <div>
                <p className="detail-label">Quotation Date</p>
                <strong>{viewingQuotation.quotation_date || "—"}</strong>
              </div>
              <div>
                <p className="detail-label">Valid Until</p>
                <strong>{viewingQuotation.valid_until_date || "—"}</strong>
              </div>
              <div>
                <p className="detail-label">Status</p>
                <strong>
                  <span className={`quotation-state-pill ${getQuotationState(viewingQuotation).toLowerCase()}`}>
                    {getQuotationState(viewingQuotation)}
                  </span>
                </strong>
              </div>
              <div className="full-width">
                <p className="detail-label">Note</p>
                <strong>{viewingQuotation.note || "—"}</strong>
              </div>
            </div>

            <div className="detail-items">
              <p className="detail-label">Items</p>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th className="table-index-cell">#</th>
                      <th>Product</th>
                      <th>SKU</th>
                      <th>Qty</th>
                      <th>Unit</th>
                      <th>Sale Price</th>
                      <th>Cost Price</th>
                      <th>Discounts</th>
                      <th>Sale Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(viewingQuotation.items || []).map((item, index) => {
                      const discounts = normalizeDiscounts(item);
                      const activeDiscounts = discounts.filter((d) => Number(d) > 0);
                      const discountLabel = activeDiscounts.length
                        ? activeDiscounts.map((d) => `${Number(d)}%`).join(" → ")
                        : "—";

                      return (
                        <tr key={item.line_id || index}>
                          <td className="table-index-cell">{index + 1}</td>
                          <td>{item.product_name || "—"}</td>
                          <td>{item.sku || "—"}</td>
                          <td>{item.quantity ?? "—"}</td>
                          <td>{item.unit || "—"}</td>
                          <td>{item.sale_price !== "" && item.sale_price != null ? fmt(item.sale_price) : "—"}</td>
                          <td>{item.cost_price !== "" && item.cost_price != null ? fmt(item.cost_price) : "—"}</td>
                          <td><span className="tx-discount-label">{discountLabel}</span></td>
                          <td>{fmt(computeAmount(item, "sale_price"))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {(() => {
              const itemTotal = (viewingQuotation.items || []).reduce(
                (sum, item) => sum + computeAmount(item, "sale_price"),
                0
              );
              const vatSummary = computeVatSummary(itemTotal, viewingQuotation.vat_mode);
              const showVat = isVatEnabled(viewingQuotation.vat_mode);

              return (
                <div className="tx-sales-summary">
                  {showVat ? (
                    <>
                      <div className="tx-summary-row">
                        <span>Total</span>
                        <span>{fmt(vatSummary.total)}</span>
                      </div>
                      <div className="tx-summary-row">
                        <span>VAT (7%)</span>
                        <span>{fmt(vatSummary.vat)}</span>
                      </div>
                    </>
                  ) : null}
                  <div className="tx-summary-row tx-summary-grand">
                    <strong>Grand Total</strong>
                    <strong>{fmt(vatSummary.grandTotal)}</strong>
                  </div>
                </div>
              );
            })()}

            <div className="transaction-detail-footer">
              <button
                className="danger-button"
                type="button"
                onClick={() => handleDelete(viewingQuotation)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default QuotationPage;
