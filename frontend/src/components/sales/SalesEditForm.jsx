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
  buildProductOptions,
  computeAmount,
  computeVatSummary,
  createEditForm,
  createEditItems,
  defaultCustomerOptions,
  getComputedPaymentDate,
  getProductUnit,
  getSalesItemRemovalMessage,
  getTransactionDocuments,
  normalizeCustomerOptions,
  vatOptionValues,
} from "./salesHistoryUtils";
import SalesEditDetailsSection from "./SalesEditDetailsSection";
import SalesEditLineItemsSection from "./SalesEditLineItemsSection";
import SalesEditTotalsSection from "./SalesEditTotalsSection";

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
        <SalesEditDetailsSection
          sale={sale}
          form={form}
          customerQuery={customerQuery}
          customerOpen={customerOpen}
          customerError={customerError}
          filteredCustomers={filteredCustomers}
          saleStockMessage={saleStockMessage}
          visibleDocuments={visibleDocuments}
          paymentDate={getComputedPaymentDate(form)}
          onUpdateForm={updateForm}
          onCustomerQueryChange={(value) => {
            setCustomerQuery(value);
            updateForm("customer_name", "");
            setCustomerError("");
            setCustomerOpen(true);
          }}
          onCustomerOpen={() => setCustomerOpen(true)}
          onCustomerClose={() => {
            window.setTimeout(() => setCustomerOpen(false), 120);
          }}
          onSelectCustomer={selectCustomer}
          onStatusChange={handleStatusChange}
          onPaymentTermTypeChange={(next) => {
            setForm((currentForm) => ({
              ...currentForm,
              payment_term_type: next,
              payment_term_days: next === "debit" ? "" : currentForm.payment_term_days,
            }));
          }}
          onPaymentTermDaysChange={(value) => updateForm("payment_term_days", value)}
          onAddDocuments={(documents) => {
            updateForm("new_documents", [...form.new_documents, ...documents]);
            updateForm("remove_document", false);
          }}
          onDeleteVisibleDocument={(documentId) =>
            updateForm("remove_document_ids", [...form.remove_document_ids, documentId])
          }
          onRemoveNewDocument={(documentIndex) =>
            updateForm(
              "new_documents",
              form.new_documents.filter((_, index) => index !== documentIndex)
            )
          }
          onRemoveAllDocuments={() => {
            updateForm(
              "remove_document_ids",
              getTransactionDocuments(sale, t).map((document) => document.id)
            );
            updateForm("new_documents", []);
          }}
          onUndoRemoveDocuments={() => updateForm("remove_document_ids", [])}
        />

        <SalesEditLineItemsSection
          sale={sale}
          items={items}
          products={products}
          productOptions={productOptions}
          onAddItem={addItem}
          onRemoveItem={removeItem}
          onUpdateItem={updateItem}
          onUpdateItemProduct={updateItemProduct}
          onAddDiscount={addDiscount}
          onRemoveDiscount={removeDiscount}
          onUpdateDiscount={updateDiscount}
        />

        <SalesEditTotalsSection
          sale={sale}
          vatMode={vatMode}
          vatOptions={vatOptions}
          vatSummary={vatSummary}
          onVatModeChange={setVatMode}
        />

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
