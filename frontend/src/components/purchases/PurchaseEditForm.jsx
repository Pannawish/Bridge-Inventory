import { useMemo, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import {
  getInitialPurchaseItemStatus,
  getPurchaseStatusFromItems,
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
  getProductName,
  getProductSearchNames,
  getProductSku,
  getPurchaseItemRemovalMessage,
  getPurchaseProductQuery,
  getToday,
  getTransactionDocuments,
  normalizeSupplierOptions,
} from "./purchaseHistoryUtils";
import PurchaseEditDetailsSection from "./PurchaseEditDetailsSection";
import PurchaseEditLineItemsSection from "./PurchaseEditLineItemsSection";
import PurchaseEditTotalsSection from "./PurchaseEditTotalsSection";

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
        <PurchaseEditDetailsSection
          form={form}
          supplierQuery={supplierQuery}
          supplierOpen={supplierOpen}
          supplierError={supplierError}
          filteredSuppliers={filteredSuppliers}
          visibleDocuments={visibleDocuments}
          onUpdateForm={updateForm}
          onSupplierQueryChange={(value) => {
            setSupplierQuery(value);
            updateForm("supplier_name", "");
            setSupplierError("");
            setSupplierOpen(true);
          }}
          onSupplierOpen={() => setSupplierOpen(true)}
          onSupplierClose={() => {
            window.setTimeout(() => setSupplierOpen(false), 120);
          }}
          onSelectSupplier={selectSupplier}
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
              getTransactionDocuments(purchase, t).map((document) => document.id)
            );
            updateForm("new_documents", []);
          }}
          onUndoRemoveDocuments={() => updateForm("remove_document_ids", [])}
        />

        <PurchaseEditLineItemsSection
          form={form}
          items={items}
          products={products}
          openProductIndex={openProductIndex}
          itemErrors={itemErrors}
          getFilteredProducts={getFilteredProducts}
          onAddItem={addItem}
          onRemoveItem={removeItem}
          onUpdateItem={updateItem}
          onUpdateProductQuery={updateProductQuery}
          onSetOpenProductIndex={setOpenProductIndex}
          onSelectProduct={selectProduct}
          onAddDiscount={addDiscount}
          onRemoveDiscount={removeDiscount}
          onUpdateDiscount={updateDiscount}
        />

        <PurchaseEditTotalsSection
          purchase={purchase}
          vatMode={vatMode}
          vatOptions={vatOptions}
          vatSummary={vatSummary}
          onVatModeChange={setVatMode}
        />

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
