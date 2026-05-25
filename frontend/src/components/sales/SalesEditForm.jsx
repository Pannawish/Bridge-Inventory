import { useMemo, useState } from "react";
import { formatMoney as fmt } from "../../format";
import { useLanguage } from "../../i18n/LanguageContext";
import { getStatusLabel } from "../../i18n/statusLabels";
import {
  applySaleStatusToItems,
  getSaleStatusFromItems,
  getStoredSaleItemStatus,
} from "../../saleStatus";
import { formatSaleStockIssueMessage, getSaleStockIssues } from "../../saleStock";
import {
  buildConvertedItemFields,
  getProductUnitOptions,
} from "../../unitConversion";
import {
  buildProductOptions,
  computeAmount,
  computeVatSummary,
  createEditForm,
  createEditItems,
  defaultCustomerOptions,
  findProductForSaleItem,
  getComputedPaymentDate,
  getDocumentName,
  getProductUnit,
  getSalesItemRemovalMessage,
  getTransactionDocuments,
  isVatEnabled,
  normalizeCustomerOptions,
  renderBillDiscount,
  statusOptions,
  vatOptionValues,
} from "./salesHistoryUtils";

function showStockAlert(message) {
  if (message && typeof window !== "undefined") {
    window.alert(message);
  }
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
  const saleStockMessage =
    !["draft", "cancelled", "returned"].includes(form.status) && saleStockIssues.length
      ? formatSaleStockIssueMessage(saleStockIssues, {
          t,
          locale: language === "th" ? "th-TH" : "en-US",
        })
      : "";
  const visibleDocuments = getTransactionDocuments(sale, t).filter(
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

  const vatOptions = vatOptionValues.map((v) => ({
    value: v,
    label: v === "included" ? t("salesForm.vatIncluded") : t("salesForm.vatExcluded"),
  }));

  return (
    <section className="section-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("salesForm.editEyebrow")}</p>
          <h3>{t("salesForm.editTitle")}</h3>
        </div>
        <button className="secondary-button table-action-button" type="button" onClick={onCancel}>
          {t("salesForm.cancelButton")}
        </button>
      </div>

      {formError ? <div className="error-banner">{formError}</div> : null}

      <form className="form-layout" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label>
            {t("salesForm.referenceLabel")}
            <input
              value={form.reference_no}
              onChange={(event) => updateForm("reference_no", event.target.value)}
              placeholder={t("salesForm.referencePlaceholder")}
            />
          </label>

          <label className="supplier-combobox-field">
            {t("salesForm.customerNameLabel")}
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
                placeholder={t("salesForm.searchCustomerPlaceholder")}
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
                      {t("salesForm.noCustomerFound")}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
            {customerError ? <span className="field-error-text">{customerError}</span> : null}
          </label>

          <label>
            {t("salesForm.statusLabel")}
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
            {t("salesForm.dateLabel")}
            <input
              type="date"
              value={form.transaction_date}
              onChange={(event) => updateForm("transaction_date", event.target.value)}
            />
          </label>

          <label>
            {t("salesForm.paymentTermLabel")}
            <select
              value={form.payment_term_type}
              onChange={(event) => {
                const next = event.target.value;
                setForm((currentForm) => ({
                  ...currentForm,
                  payment_term_type: next,
                  payment_term_days: next === "debit" ? "" : currentForm.payment_term_days,
                }));
              }}
            >
              <option value="">{t("purchaseForm.paymentTermPlaceholder")}</option>
              <option value="debit">{t("salesForm.paymentTermDebit")}</option>
              <option value="credit">{t("salesForm.paymentTermCredit")}</option>
            </select>
          </label>

          {form.payment_term_type === "credit" ? (
            <label>
              {t("salesForm.creditTermLabel")}
              <select
                value={form.payment_term_days}
                onChange={(event) => updateForm("payment_term_days", event.target.value)}
              >
                <option value="">{t("salesForm.creditTermPlaceholder")}</option>
                <option value="30 days">{t("salesForm.creditTerm30")}</option>
                <option value="60 days">{t("salesForm.creditTerm60")}</option>
                <option value="90 days">{t("salesForm.creditTerm90")}</option>
              </select>
            </label>
          ) : null}

          <label>
            {t("salesForm.paymentDateLabel")}
            <input
              type="date"
              value={getComputedPaymentDate(form)}
              readOnly
              placeholder={t("purchaseForm.paymentDatePlaceholder")}
            />
          </label>

          <label>
            {t("salesForm.poReferenceLabel")}
            <input
              value={form.customer_po_reference}
              onChange={(event) => updateForm("customer_po_reference", event.target.value)}
              placeholder={t("salesForm.poReferencePlaceholder")}
            />
          </label>

          <label className="full-width">
            {t("salesForm.noteLabel")}
            <textarea
              rows="3"
              value={form.note}
              onChange={(event) => updateForm("note", event.target.value)}
            />
          </label>

          <div className="transaction-document-panel full-width">
            <div className="transaction-document-panel-header">
              <div>
                <strong>{t("salesForm.documentsLabel")}</strong>
                <span>
                  {visibleDocuments.length + form.new_documents.length
                    ? t("transactionTable.attachedCount", {
                        count: visibleDocuments.length + form.new_documents.length,
                      })
                    : t("salesForm.noDocumentsAttached")}
                </span>
              </div>
              <label className="document-upload-button">
                {t("salesForm.documentsAddFiles")}
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
                        {t("salesForm.documentDelete")}
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
                        {t("salesForm.documentRemove")}
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
                        getTransactionDocuments(sale, t).map((document) => document.id)
                      );
                      updateForm("new_documents", []);
                    }}
                  >
                    {t("salesForm.documentRemoveAll")}
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
              <p className="transaction-document-empty">{t("salesForm.documentsEmpty")}</p>
            )}
          </div>
        </div>

        <div className="line-items-card">
          <div className="line-items-header">
            <h4>{t("salesForm.itemsTitle")}</h4>
            <button className="secondary-button" type="button" onClick={addItem}>
              {t("salesForm.addItem")}
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
                <div className="line-item-index" aria-label={t("purchaseForm.itemAriaLabel", { index: index + 1 })}>
                  {index + 1}
                </div>

                <label className="purchase-item-field sales-item-product">
                  <span>{t("salesForm.colProduct")}</span>
                  <select
                    value={item.product_value}
                    onChange={(event) => updateItemProduct(index, event.target.value)}
                    required
                  >
                    <option value="">{t("salesForm.selectProduct")}</option>
                    {productOptions.map((product) => (
                      <option key={product.value} value={product.value}>
                        {product.sku ? `${product.name} (${product.sku})` : product.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="purchase-item-field sales-item-unit">
                  <span>{t("salesForm.colUnit")}</span>
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
                      placeholder={t("salesForm.unitPlaceholder")}
                    />
                  )}
                  {conversionPreview ? (
                    <span className="unit-conversion-preview">
                      {conversionPreview.base_quantity} {conversionPreview.base_unit}
                    </span>
                  ) : null}
                </label>

                <label className="purchase-item-field sales-item-qty">
                  <span>{t("salesForm.colQty")}</span>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(event) => updateItem(index, "quantity", event.target.value)}
                    placeholder={t("salesForm.qtyPlaceholder")}
                    required
                  />
                </label>

                <label className="purchase-item-field sales-item-price">
                  <span>{t("salesForm.colUnitPrice")}</span>
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
                  <span>{t("salesForm.colDiscounts")}</span>
                  <div className="sales-discount-cell">
                    {(item.discounts || [0]).map((discount, discountIndex) => (
                      <div key={discountIndex} className="sales-discount-entry">
                        {discountIndex > 0 ? (
                          <span className="sales-discount-chain-label">{t("salesForm.discountThen")}</span>
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
                            aria-label={t("salesForm.removeDiscount")}
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
                      {t("salesForm.addDiscount")}
                    </button>
                  </div>
                </div>

                <div className="purchase-item-field sales-item-amount">
                  <span>{t("salesForm.colAmount")}</span>
                  <div className="sales-line-amount">{fmt(amount)}</div>
                </div>

                <button
                  className="danger-button sales-item-remove"
                  type="button"
                  onClick={() => removeItem(index)}
                  disabled={items.length === 1}
                >
                  {t("salesForm.removeItem")}
                </button>
              </div>
            );
          })}
        </div>

        <section className="purchase-vat-card">
          <div className="purchase-vat-card-header">
            <p className="purchase-vat-label">{t("salesForm.vatSetting")}</p>
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
                {isVatEnabled(vatMode) ? t("salesForm.vatOn") : t("salesForm.vatOff")}
              </span>
            </label>
          </div>
          {isVatEnabled(vatMode) ? (
            <div className="purchase-vat-options" role="radiogroup" aria-label={t("salesForm.vatAriaLabel")}>
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
              <span>{t("transactionTable.billDiscount")}</span>
              <span>{renderBillDiscount(sale)}</span>
            </div>
          ) : null}
          {isVatEnabled(vatMode) ? (
            <>
              <div className="sales-summary-row">
                <span>{t("salesForm.subtotal")}</span>
                <span>{fmt(vatSummary.total)}</span>
              </div>
              <div className="sales-summary-row">
                <span>{t("salesForm.vat")}</span>
                <span>{fmt(vatSummary.vat)}</span>
              </div>
            </>
          ) : null}
          <div className="sales-summary-row sales-summary-grand">
            <strong>{t("salesForm.grandTotal")}</strong>
            <strong>{fmt(vatSummary.grandTotal)}</strong>
          </div>
        </div>

        <div className="supplier-modal-actions">
          <button className="secondary-button" type="button" onClick={onCancel}>
            {t("salesForm.cancelButton")}
          </button>
          <button className="primary-button" type="submit">
            {t("salesForm.saveButton")}
          </button>
        </div>
      </form>
    </section>
  );
}

export default SalesEditForm;
