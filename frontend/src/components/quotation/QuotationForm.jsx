import { useMemo, useState } from "react";
import EligiblePartyCombobox from "../EligiblePartyCombobox";
import { getProductDefaultSalesUnit, getProductUnitConversions } from "../../unitConversion";
import { formatMoney as fmt } from "../../format";
import { useLanguage } from "../../i18n/LanguageContext";
import {
  getAverageCostForSelectedUnit,
  getAverageRecentSalePriceForSelectedUnit,
} from "../productPriceMetrics";
import { isProductActive } from "../products/productUtils";
import {
  VAT_OPTION_VALUES,
  computeAmount,
  computeValidUntilDate,
  computeVatSummary,
  createEditForm,
  createEditItems,
  createInitialForm,
  emptyItem,
  emptySupplierOption,
  findProductForItem,
  formatDisplayDate,
  getNextQuotationReference,
  getProductName,
  getProductSearchNames,
  getProductSku,
  isVatEnabled,
  normalizeDiscounts,
  normalizePartnerOptions,
} from "./quotationUtils";
import { buildConvertedItemFields } from "../../unitConversion";

function QuotationForm({
  quotation = null,
  quotations = [],
  products = [],
  suppliers = [],
  customers = [],
  onSave,
  onCancel,
}) {
  const { t } = useLanguage();
  const vatOptions = VAT_OPTION_VALUES.map((value) => ({
    value,
    label: value === "included" ? t("quotation.vatIncluded") : t("quotation.vatExcluded"),
  }));
  const isEditing = Boolean(quotation);
  const initialReference = quotation?.reference_no || getNextQuotationReference(quotations);
  const [form, setForm] = useState(() =>
    quotation ? createEditForm(quotation) : createInitialForm(initialReference)
  );
  const [items, setItems] = useState(() =>
    quotation ? createEditItems(quotation) : [emptyItem()]
  );
  const [formError, setFormError] = useState("");
  const [openProductIndex, setOpenProductIndex] = useState(null);
  const [itemErrors, setItemErrors] = useState({});
  const customerOptions = useMemo(
    () =>
      normalizePartnerOptions(customers, form.customer_name).map(
        (customer) => customer.companyName
      ),
    [customers, form.customer_name]
  );
  const supplierOptions = useMemo(
    () => normalizePartnerOptions(suppliers).map((supplier) => supplier.companyName),
    [suppliers]
  );
  const itemTotal = items.reduce((sum, item) => sum + computeAmount(item, "sale_price"), 0);
  const vatSummary = computeVatSummary(itemTotal, form.vat_mode);
  const validUntilDate = useMemo(
    () =>
      computeValidUntilDate(
        form.quotation_date,
        form.valid_until_days,
        form.valid_until_day_type
      ),
    [form.quotation_date, form.valid_until_days, form.valid_until_day_type]
  );

  function getTranslatedProductName(product) {
    return getProductName(product, t("products.productFallback", { id: product?.id || "" }));
  }

  function updateForm(key, value) {
    setForm((currentForm) => ({ ...currentForm, [key]: value }));
  }

  function handleQuotationDateChange(value) {
    updateForm("quotation_date", value);
  }

  function handleValidUntilDaysChange(rawValue) {
    if (rawValue === "") {
      updateForm("valid_until_days", "");
      return;
    }

    const nextDays = parseInt(rawValue, 10);
    if (Number.isNaN(nextDays)) {
      return;
    }

    const clampedDays = Math.min(100, Math.max(0, nextDays));
    setForm((currentForm) => ({
      ...currentForm,
      valid_until_days: clampedDays,
      valid_until_day_type:
        clampedDays === 0
          ? "no_valid_date"
          : currentForm.valid_until_day_type === "no_valid_date"
            ? "calendar"
            : currentForm.valid_until_day_type,
    }));
  }

  function handleValidUntilDayTypeChange(dayType) {
    setForm((currentForm) => ({
      ...currentForm,
      valid_until_day_type: dayType,
      valid_until_days:
        dayType === "no_valid_date"
          ? 0
          : Number(currentForm.valid_until_days) === 0
            ? 30
            : currentForm.valid_until_days,
    }));
  }

  function updateItem(itemIndex, key, value) {
    setItems((currentItems) =>
      currentItems.map((item, index) =>
        index === itemIndex ? { ...item, [key]: value } : item
      )
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

    const productName = getTranslatedProductName(product);
    const sku = getProductSku(product);

    setItems((currentItems) =>
      currentItems.map((item, index) =>
        index === itemIndex
          ? {
              ...item,
              product_id: product.id,
              product_query: sku ? `${productName} (${sku})` : productName,
              product_name: productName,
              sku,
              unit: getProductDefaultSalesUnit(product),
            }
          : item
      )
    );
    setItemErrors((currentErrors) => ({ ...currentErrors, [itemIndex]: "" }));
    setOpenProductIndex(null);
  }

  function addItem() {
    setItems((currentItems) => [...currentItems, emptyItem()]);
  }

  function removeItem(itemIndex) {
    setItems((currentItems) => currentItems.filter((_, index) => index !== itemIndex));
  }

  function addSupplierOption(itemIndex) {
    setItems((currentItems) =>
      currentItems.map((item, index) =>
        index === itemIndex
          ? {
              ...item,
              supplier_options: [...(item.supplier_options || []), emptySupplierOption()],
            }
          : item
      )
    );
  }

  function removeSupplierOption(itemIndex, optionIndex) {
    setItems((currentItems) =>
      currentItems.map((item, index) =>
        index === itemIndex
          ? {
              ...item,
              supplier_options: (item.supplier_options || []).filter(
                (_, currentOptionIndex) => currentOptionIndex !== optionIndex
              ),
            }
          : item
      )
    );
  }

  function updateSupplierOption(itemIndex, optionIndex, key, value) {
    setItems((currentItems) =>
      currentItems.map((item, index) =>
        index === itemIndex
          ? {
              ...item,
              supplier_options: (item.supplier_options || []).map(
                (option, currentOptionIndex) =>
                  currentOptionIndex === optionIndex ? { ...option, [key]: value } : option
              ),
            }
          : item
      )
    );
  }

  function addDiscount(itemIndex) {
    setItems((currentItems) =>
      currentItems.map((item, index) =>
        index === itemIndex ? { ...item, discounts: [...normalizeDiscounts(item), ""] } : item
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
          discounts: nextDiscounts.length ? nextDiscounts : [""],
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
    setItemErrors({});

    if (!form.quotation_date) {
      setFormError(t("quotation.errorDateRequired"));
      return;
    }

    const validUntilDays = Number(form.valid_until_days);
    const isNoValidDate = form.valid_until_day_type === "no_valid_date";
    if (!isNoValidDate && (Number.isNaN(validUntilDays) || validUntilDays < 1 || validUntilDays > 100)) {
      setFormError(t("quotation.errorValidUntilDays"));
      return;
    }
    if (!isNoValidDate && !validUntilDate) {
      setFormError(t("quotation.errorValidUntilCompute"));
      return;
    }

    for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
      const options = items[itemIndex].supplier_options || [];
      for (const option of options) {
        const hasSupplierName = `${option.supplier_name ?? ""}`.trim();
        const missingCost =
          option.cost_price === "" ||
          option.cost_price === null ||
          option.cost_price === undefined;
        if (hasSupplierName && missingCost) {
          setFormError(
            t("quotation.errorSupplierCostPrice", {
              supplier: option.supplier_name,
              index: itemIndex + 1,
            })
          );
          return;
        }
      }
    }

    const normalizedItems = items.map((item, index) => {
      const selectedProduct = products.find((product) => `${product.id}` === `${item.product_id}`);

      if (!selectedProduct) {
        setItemErrors({ [index]: t("quotation.errorSelectProduct") });
        setOpenProductIndex(index);
        throw new Error(t("quotation.errorSelectProduct"));
      }

      if (!item.quantity || Number(item.quantity) <= 0) {
        throw new Error(t("quotation.errorQuantityRequired", { index: index + 1 }));
      }

      if (item.sale_price === "" || item.sale_price === null || item.sale_price === undefined) {
        throw new Error(t("quotation.errorSalePriceRequired", { index: index + 1 }));
      }

      const discounts = normalizeDiscounts(item);
      const convertedFields = buildConvertedItemFields(
        selectedProduct,
        item.quantity,
        item.unit,
        "sale"
      );

      const supplierOptionRows = (item.supplier_options || [])
        .filter((option) => `${option.supplier_name ?? ""}`.trim())
        .map((option) => ({
          supplier_name: `${option.supplier_name}`.trim(),
          cost_price: option.cost_price,
        }));

      return {
        line_id: item.line_id,
        product_id: selectedProduct.id,
        product_name: getTranslatedProductName(selectedProduct),
        sku: getProductSku(selectedProduct),
        ...convertedFields,
        quantity: Number(item.quantity) || 0,
        sale_price: item.sale_price,
        discounts,
        supplier_options: supplierOptionRows,
        sale_amount: computeAmount(item, "sale_price"),
      };
    });

    try {
      const savedQuotation = await onSave({
        ...(quotation || {}),
        reference_no: form.reference_no,
        quotation_date: form.quotation_date,
        valid_until_days: Number(form.valid_until_days),
        valid_until_day_type: form.valid_until_day_type,
        valid_until_date: form.valid_until_day_type === "no_valid_date" ? null : validUntilDate,
        customer_name: form.customer_name,
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
          <p className="eyebrow">
            {isEditing ? t("quotation.editEyebrow") : t("quotation.entryEyebrow")}
          </p>
          <h3>{isEditing ? t("quotation.editTitle") : t("quotation.newTitle")}</h3>
        </div>
        {onCancel ? (
          <button className="secondary-button table-action-button" type="button" onClick={onCancel}>
            {t("quotation.cancelButton")}
          </button>
        ) : null}
      </div>

      {formError ? <div className="error-banner">{formError}</div> : null}

      <form className="form-layout" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label>
            {t("quotation.referenceLabel")}
            <input
              value={form.reference_no}
              readOnly={!isEditing}
              onChange={(event) => updateForm("reference_no", event.target.value)}
              placeholder={initialReference}
            />
          </label>

          <label>
            <span className="required-label">{t("quotation.dateLabel")}</span>
            <input
              type="date"
              value={form.quotation_date}
              onChange={(event) => handleQuotationDateChange(event.target.value)}
              required
            />
          </label>

          <div className="valid-until-field">
            <span className="required-label">{t("quotation.validUntilLabel")}</span>
            <div className="valid-until-days-row">
              <input
                type="number"
                className="valid-until-days-input"
                min="0"
                max="100"
                step="1"
                value={form.valid_until_days}
                onChange={(event) => handleValidUntilDaysChange(event.target.value)}
              />
              <span className="valid-until-days-unit">{t("quotation.days")}</span>
            </div>
            <div
              className="valid-until-type-options"
              role="radiogroup"
              aria-label={t("quotation.validUntilTypeAriaLabel")}
            >
              {[
                { value: "calendar", label: t("quotation.calendarDays") },
                { value: "business", label: t("quotation.businessDays") },
                { value: "no_valid_date", label: t("quotation.noValidDate") },
              ].map((option) => (
                <label
                  key={option.value}
                  className={
                    form.valid_until_day_type === option.value
                      ? "valid-until-day-option active"
                      : "valid-until-day-option"
                  }
                >
                  <input
                    type="radio"
                    name="valid_until_day_type"
                    value={option.value}
                    checked={form.valid_until_day_type === option.value}
                    onChange={() => handleValidUntilDayTypeChange(option.value)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
            <p className="valid-until-computed-date">
              {t("quotation.expiresLabel")}{" "}
              <strong>
                {form.valid_until_day_type === "no_valid_date" || !validUntilDate
                  ? "—"
                  : formatDisplayDate(validUntilDate)}
              </strong>
            </p>
          </div>

          <EligiblePartyCombobox
            id="quotation-customer"
            label={t("quotation.customerLabel")}
            value={form.customer_name}
            options={customerOptions}
            placeholder={t("quotation.searchCustomerPlaceholder")}
            emptyMessage={t("quotation.noCustomerFound")}
            onChange={(nextCustomerName) => updateForm("customer_name", nextCustomerName)}
          />

          <label className="full-width">
            {t("quotation.noteLabel")}
            <textarea
              rows="3"
              value={form.note}
              onChange={(event) => updateForm("note", event.target.value)}
            />
          </label>
        </div>

        <div className="line-items-card">
          <div className="line-items-header">
            <h4>{t("quotation.itemsTitle")}</h4>
            <button className="secondary-button" type="button" onClick={addItem}>
              {t("quotation.addItem")}
            </button>
          </div>

          {items.map((item, index) => {
            const selectedProduct = findProductForItem(item, products);
            const filteredProducts = getFilteredProducts(item.product_query);
            const unitOptions = selectedProduct ? getProductUnitConversions(selectedProduct) : [];
            const saleAmount = computeAmount(item, "sale_price");
            const averageCostForSelectedUnit = getAverageCostForSelectedUnit(
              selectedProduct,
              item.unit
            );
            const recentAverageSalePriceForSelectedUnit =
              getAverageRecentSalePriceForSelectedUnit(selectedProduct, item.unit);

            return (
              <div className="line-item-row quotation-line-item-row" key={item.line_id}>
                <div
                  className="line-item-index"
                  aria-label={t("quotation.itemAriaLabel", { index: index + 1 })}
                >
                  {index + 1}
                </div>

                <label className="purchase-item-field quotation-item-product">
                  <span className="required-label">{t("quotation.colProduct")}</span>
                  <div className="supplier-combobox">
                    <input
                      value={item.product_query}
                      onChange={(event) => updateProductQuery(index, event.target.value)}
                      onFocus={() => setOpenProductIndex(index)}
                      onBlur={() => {
                        window.setTimeout(() => setOpenProductIndex(null), 120);
                      }}
                      placeholder={t("quotation.searchProductPlaceholder")}
                      autoComplete="off"
                      aria-expanded={openProductIndex === index}
                      aria-controls={`quotation-product-list-${item.line_id}`}
                      aria-invalid={itemErrors[index] ? "true" : "false"}
                      required
                    />

                    {openProductIndex === index ? (
                      <div
                        className="supplier-combobox-menu"
                        id={`quotation-product-list-${item.line_id}`}
                        role="listbox"
                      >
                        {filteredProducts.length ? (
                          filteredProducts.map((product) => {
                            const productName = getTranslatedProductName(product);
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
                                <span>{sku ? `${productName} (${sku})` : productName}</span>
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
                            {t("quotation.noProductFound")}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                  {itemErrors[index] ? (
                    <span className="field-error-text">{itemErrors[index]}</span>
                  ) : null}
                </label>

                <label className="purchase-item-field quotation-item-unit">
                  <span className="required-label">{t("quotation.colUnit")}</span>
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
                  <span className="required-label">{t("quotation.colQty")}</span>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(event) => updateItem(index, "quantity", event.target.value)}
                    required
                  />
                </label>

                <label className="purchase-item-field quotation-item-sale">
                  <span className="required-label">{t("quotation.colSalePrice")}</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.sale_price}
                    onChange={(event) => updateItem(index, "sale_price", event.target.value)}
                    placeholder="0.00"
                    required
                  />
                  {averageCostForSelectedUnit ? (
                    <span className="field-helper-text">
                      {t("common.avgCostForUnit", {
                        amount: fmt(averageCostForSelectedUnit),
                        unit: item.unit || getProductDefaultSalesUnit(selectedProduct),
                      })}
                    </span>
                  ) : null}
                  {recentAverageSalePriceForSelectedUnit ? (
                    <span className="field-helper-text">
                      {t("common.avgRecentSalePriceForUnit", {
                        amount: fmt(recentAverageSalePriceForSelectedUnit),
                        unit: item.unit || getProductDefaultSalesUnit(selectedProduct),
                      })}
                    </span>
                  ) : null}
                </label>

                <div className="purchase-item-field quotation-item-discounts">
                  <span>{t("quotation.colDiscounts")}</span>
                  <div className="sales-discount-cell">
                    {normalizeDiscounts(item).map((discount, discountIndex) => (
                      <div key={discountIndex} className="sales-discount-entry">
                        {discountIndex > 0 ? (
                          <span className="sales-discount-chain-label">
                            {t("quotation.discountThen")}
                          </span>
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
                            aria-label={t("quotation.removeDiscount")}
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
                      {t("quotation.addDiscount")}
                    </button>
                  </div>
                </div>

                <div className="purchase-item-field quotation-item-amount">
                  <span>{t("quotation.colSaleAmount")}</span>
                  <div className="sales-line-amount">{fmt(saleAmount)}</div>
                </div>

                <button
                  className="danger-button quotation-item-remove"
                  type="button"
                  onClick={() => removeItem(index)}
                  disabled={items.length === 1}
                >
                  {t("quotation.removeItem")}
                </button>

                <div className="purchase-item-field quotation-item-suppliers">
                  <span>{t("quotation.suppliersLabel")}</span>
                  <div className="quotation-supplier-list">
                    {(item.supplier_options || []).map((option, optionIndex) => (
                      <div className="quotation-supplier-row" key={option.option_id}>
                        <EligiblePartyCombobox
                          id={`quotation-item-${item.line_id}-supplier-${option.option_id}`}
                          label={t("quotation.supplierLabel")}
                          value={option.supplier_name}
                          options={supplierOptions}
                          placeholder={t("quotation.searchSupplierPlaceholder")}
                          emptyMessage={t("quotation.noSupplierFound")}
                          onChange={(nextSupplierName) =>
                            updateSupplierOption(index, optionIndex, "supplier_name", nextSupplierName)
                          }
                        />
                        <label className="quotation-supplier-cost">
                          <span>{t("quotation.colCostPrice")}</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={option.cost_price}
                            onChange={(event) =>
                              updateSupplierOption(index, optionIndex, "cost_price", event.target.value)
                            }
                            placeholder="0.00"
                          />
                        </label>
                        <button
                          className="danger-button quotation-supplier-remove"
                          type="button"
                          onClick={() => removeSupplierOption(index, optionIndex)}
                        >
                          {t("quotation.removeSupplierOption")}
                        </button>
                      </div>
                    ))}
                    <button
                      className="secondary-button quotation-supplier-add"
                      type="button"
                      onClick={() => addSupplierOption(index)}
                    >
                      {t("quotation.addSupplierOption")}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <section className="purchase-vat-card">
          <div className="purchase-vat-card-header">
            <p className="purchase-vat-label">{t("quotation.vatSetting")}</p>
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
                {isVatEnabled(form.vat_mode) ? t("quotation.vatOn") : t("quotation.vatOff")}
              </span>
            </label>
          </div>
          {isVatEnabled(form.vat_mode) ? (
            <div
              className="purchase-vat-options"
              role="radiogroup"
              aria-label={t("quotation.vatAriaLabel")}
            >
              {vatOptions.map((option) => (
                <label
                  key={option.value}
                  className={
                    form.vat_mode === option.value
                      ? "purchase-vat-option active"
                      : "purchase-vat-option"
                  }
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
                <span>{t("quotation.subtotal")}</span>
                <span>{fmt(vatSummary.total)}</span>
              </div>
              <div className="sales-summary-row">
                <span>{t("quotation.vat")}</span>
                <span>{fmt(vatSummary.vat)}</span>
              </div>
            </>
          ) : null}
          <div className="sales-summary-row sales-summary-grand">
            <strong>{t("quotation.grandTotal")}</strong>
            <strong>{fmt(vatSummary.grandTotal)}</strong>
          </div>
        </div>

        <div className="supplier-modal-actions">
          {onCancel ? (
            <button className="secondary-button" type="button" onClick={onCancel}>
              {t("quotation.cancelButton")}
            </button>
          ) : null}
          <button className="primary-button" type="submit">
            {isEditing ? t("quotation.saveButton") : t("quotation.createButton")}
          </button>
        </div>
      </form>
    </section>
  );
}

export default QuotationForm;
