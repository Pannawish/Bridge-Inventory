import { useMemo, useState } from "react";
import { formatMoney as fmt } from "../../format";
import { useLanguage } from "../../i18n/LanguageContext";
import { getStatusLabel } from "../../i18n/statusLabels";
import {
  getInitialPurchaseItemStatus,
  getPurchaseStatusFromItems,
  purchaseStatuses,
} from "../../purchaseStatus";
import { buildConvertedItemFields, getProductUnitOptions } from "../../unitConversion";
import { isProductActive } from "../products/productUtils";
import {
  computeAmount,
  computeLeadTimeDays,
  computeVatSummary,
  createEditForm,
  createEditItems,
  defaultSupplierOptions,
  findProductForItem,
  getDocumentName,
  getProductName,
  getProductSearchNames,
  getProductSku,
  getPurchaseItemRemovalMessage,
  getPurchaseProductQuery,
  getToday,
  getTransactionDocuments,
  isVatEnabled,
  normalizeSupplierOptions,
  renderBillDiscount,
} from "./purchaseHistoryUtils";

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
  const visibleDocuments = getTransactionDocuments(purchase, t).filter(
    (document) => !form.remove_document_ids.includes(document.id)
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
    if (!isProductActive(product)) {
      return;
    }
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
              {purchaseStatuses.map((status) => (
                <option key={status} value={status} disabled={status === "partially_received"}>
                  {getStatusLabel(t, status)}
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
                    ? t("transactionTable.attachedCount", {
                        count: visibleDocuments.length + form.new_documents.length,
                      })
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
                            const disabled = !isProductActive(product);

                            return (
                              <button
                                key={product.id}
                                type="button"
                                className={`supplier-combobox-option${
                                  `${product.id}` === `${item.product_id}` ? " active" : ""
                                }${disabled ? " supplier-combobox-option-disabled" : ""}`}
                                onMouseDown={(event) => {
                                  event.preventDefault();
                                  selectProduct(index, product);
                                }}
                                role="option"
                                aria-selected={`${product.id}` === `${item.product_id}`}
                                aria-disabled={disabled}
                                title={disabled ? t("products.disabledOptionHint") : undefined}
                              >
                                <span>{getPurchaseProductQuery(productName, sku)}</span>
                                {disabled ? (
                                  <span className="combobox-option-tag">
                                    {t("products.disabledBadge")}
                                  </span>
                                ) : null}
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
                  <div className="sales-line-amount">{fmt(amount)}</div>
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

export default PurchaseEditForm;
