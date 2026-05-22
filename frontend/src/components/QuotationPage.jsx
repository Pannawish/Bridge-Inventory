import { useMemo, useState } from "react";
import EligiblePartyCombobox from "./EligiblePartyCombobox";
import SalesForm from "./SalesForm";
import QuotationConvertSelect from "./QuotationConvertSelect";
import MultiPurchaseWizard from "./MultiPurchaseWizard";
import DocumentRefChip from "./DocumentRefChip";
import DocumentRefModal from "./DocumentRefModal";
import { FilterPresets, ActiveFilterChips, RangeField, withinRange } from "./FilterControls";
import {
  buildConvertedItemFields,
  getItemBaseQuantity,
  getProductBaseUnit,
  getProductDefaultSalesUnit,
  getProductUnitConversions,
  getUnitValueFromBaseValue,
} from "../unitConversion";
import { formatDate, formatMoney as fmt } from "../format";
import { useLanguage } from "../i18n/LanguageContext";

const VAT_RATE = 0.07;
const vatOptions = [
  { value: "included", label: "Include VAT" },
  { value: "not_included", label: "Exclude VAT" },
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

function daysAgoInputValue(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return formatDateInputValue(date);
}

function addDays(dateString, days) {
  const [year, month, day] = `${dateString}`.split("-").map(Number);
  const date =
    year && month && day ? new Date(year, month - 1, day) : new Date();

  date.setDate(date.getDate() + days);
  return formatDateInputValue(date);
}

function addBusinessDays(dateString, days) {
  const [year, month, day] = `${dateString}`.split("-").map(Number);
  const date = year && month && day ? new Date(year, month - 1, day) : new Date();
  let added = 0;
  while (added < days) {
    date.setDate(date.getDate() + 1);
    const dow = date.getDay();
    if (dow !== 0 && dow !== 6) added += 1;
  }
  return formatDateInputValue(date);
}

function computeValidUntilDate(quotationDate, days, dayType) {
  const n = Number(days);
  if (!quotationDate || !n || n < 1) return "";
  return dayType === "business"
    ? addBusinessDays(quotationDate, n)
    : addDays(quotationDate, n);
}

function formatDisplayDate(dateString) {
  if (!dateString) return "";
  const [year, month, day] = `${dateString}`.split("-");
  return `${day}/${month}/${year.slice(2)}`;
}

function getNextQuotationReference(quotations = []) {
  const referencePattern = /^QT-(\d{6})$/;
  const maxSerial = quotations.reduce((max, quotation) => {
    const match = `${quotation.reference_no || ""}`.match(referencePattern);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);

  return `QT-${String(maxSerial + 1).padStart(6, "0")}`;
}

function emptySupplierOption() {
  return {
    option_id: `qopt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    supplier_name: "",
    cost_price: "",
  };
}

function emptyItem() {
  return {
    line_id: `quotation-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    product_id: "",
    product_query: "",
    product_name: "",
    sku: "",
    unit: "pcs",
    quantity: 1,
    sale_price: "",
    supplier_options: [],
    discounts: [""],
  };
}

function getProductName(product) {
  return product?.name || product?.productName || product?.product_name || product?.sku || `Product ${product?.id}`;
}

function getProductSearchNames(product) {
  const mainName = `${getProductName(product)}`.trim();
  const subNames = Array.isArray(product?.subNames) ? product.subNames : [];

  return [mainName, ...subNames]
    .map((name) => `${name ?? ""}`.trim())
    .filter(
      (name, index, names) =>
        name && names.findIndex((item) => item.toLowerCase() === name.toLowerCase()) === index
    );
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

  return [""];
}

function getDiscountMultiplier(item) {
  return normalizeDiscounts(item).reduce((acc, discount) => {
    const clamped = Math.min(100, Math.max(0, Number(discount) || 0));
    return acc * (1 - clamped / 100);
  }, 1);
}

function computeAmount(item, priceKey = "sale_price") {
  const qty = Number(item.quantity) || 0;
  const price = Number(item[priceKey]) || 0;

  return qty * price * getDiscountMultiplier(item);
}

function formatStockQuantity(value) {
  return Number(value || 0).toLocaleString("en-US", {
    maximumFractionDigits: 6,
  });
}

function hasValue(value) {
  return value !== undefined && value !== null && `${value}`.trim() !== "";
}

function getQuotationItemBaseQuantity(item, product) {
  if (hasValue(item?.base_quantity)) {
    return getItemBaseQuantity(item);
  }

  if (hasValue(item?.conversion_factor)) {
    return getItemBaseQuantity(item);
  }

  if (!product) {
    return Number(item?.quantity) || 0;
  }

  return buildConvertedItemFields(
    product,
    item?.quantity,
    item?.unit || getProductDefaultSalesUnit(product),
    "sale"
  ).base_quantity;
}

function getQuotationItemBaseUnit(item, product) {
  return item?.base_unit || item?.baseUnit || getProductBaseUnit(product);
}

function getQuotationItemConversionFactor(item, product) {
  const storedFactor = Number(item?.conversion_factor ?? item?.conversionFactor);
  if (Number.isFinite(storedFactor) && storedFactor > 0) {
    return storedFactor;
  }

  const quantity = Number(item?.quantity) || 0;
  const baseQuantity = Number(item?.base_quantity ?? item?.baseQuantity);
  if (quantity > 0 && Number.isFinite(baseQuantity) && baseQuantity > 0) {
    return baseQuantity / quantity;
  }

  if (!product) {
    return 1;
  }

  return buildConvertedItemFields(
    product,
    item?.quantity,
    item?.unit || getProductDefaultSalesUnit(product),
    "sale"
  ).conversion_factor;
}

function getQuotationBaseSalePrice(item, product, afterDiscount = false) {
  if (!hasValue(item?.sale_price)) {
    return null;
  }

  const salePrice = Number(item?.sale_price);
  if (!Number.isFinite(salePrice)) {
    return null;
  }

  const conversionFactor = getQuotationItemConversionFactor(item, product);
  if (!(conversionFactor > 0)) {
    return null;
  }

  const baseSalePrice = salePrice / conversionFactor;
  return afterDiscount ? baseSalePrice * getDiscountMultiplier(item) : baseSalePrice;
}

function formatQuantityWithUnit(quantity, unit) {
  if (!Number.isFinite(Number(quantity))) {
    return "—";
  }

  return `${formatStockQuantity(quantity)} ${unit || ""}`.trim();
}

function formatOptionalMoney(value) {
  return Number.isFinite(Number(value)) ? fmt(value) : "—";
}

function getProductStockQuantity(product) {
  return Number(
    product?.current_stock ??
      product?.currentStock ??
      product?.available_stock ??
      product?.availableStock ??
      0
  ) || 0;
}

function getQuotationStockCoverage(quotation, products = []) {
  const items = Array.isArray(quotation?.items) ? quotation.items : [];

  if (!items.length) {
    return { allSufficient: false, lines: [] };
  }

  const remainingStockByProductId = new Map(
    products.map((product) => [`${product.id}`, getProductStockQuantity(product)])
  );
  const lines = items.map((item) => {
    const product = findProductForItem(item, products);

    if (!product?.id) {
      return {
        status: "unknown",
        isSufficient: false,
        metaKey: "quotationDetail.stockUnknownMeta",
        metaValues: {},
      };
    }

    const productId = `${product.id}`;
    const baseUnit = getQuotationItemBaseUnit(item, product);
    const requestedBaseQuantity = getQuotationItemBaseQuantity(item, product);

    if (!(requestedBaseQuantity > 0)) {
      return {
        status: "unknown",
        isSufficient: false,
        metaKey: "quotationDetail.stockUnknownMeta",
        metaValues: {},
      };
    }

    const availableBaseQuantity = remainingStockByProductId.get(productId) || 0;
    const shortageBaseQuantity = Math.max(0, requestedBaseQuantity - availableBaseQuantity);
    const isSufficient = availableBaseQuantity >= requestedBaseQuantity;

    remainingStockByProductId.set(
      productId,
      Math.max(0, availableBaseQuantity - requestedBaseQuantity)
    );

    return {
      status: isSufficient ? "covered" : "short",
      isSufficient,
      metaKey: isSufficient
        ? "quotationDetail.stockAvailableMeta"
        : "quotationDetail.stockShortageMeta",
      metaValues: isSufficient
        ? {
            available: formatStockQuantity(availableBaseQuantity),
            unit: baseUnit,
          }
        : {
            shortage: formatStockQuantity(shortageBaseQuantity),
            unit: baseUnit,
          },
    };
  });

  return {
    allSufficient: lines.length > 0 && lines.every((line) => line.isSufficient),
    lines,
  };
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

function findPartnerByCompanyName(partners = [], companyName = "") {
  const normalizedName = `${companyName}`.trim().toLowerCase();

  if (!normalizedName) {
    return null;
  }

  return (
    partners.find(
      (partner) =>
        `${partner.companyName ?? partner.name ?? ""}`.trim().toLowerCase() === normalizedName
    ) || null
  );
}

function createInitialForm(referenceNo) {
  const today = getToday();

  return {
    reference_no: referenceNo,
    quotation_date: today,
    valid_until_days: 30,
    valid_until_day_type: "calendar",
    customer_name: "",
    vat_mode: "not_included",
    note: "",
  };
}

function createEditForm(quotation) {
  let days = quotation.valid_until_days;
  if (!days && quotation.quotation_date && quotation.valid_until_date) {
    const start = new Date(quotation.quotation_date);
    const end = new Date(quotation.valid_until_date);
    const diff = Math.round((end - start) / (1000 * 60 * 60 * 24));
    days = Math.min(100, Math.max(1, diff));
  }
  return {
    reference_no: quotation.reference_no || "",
    quotation_date: quotation.quotation_date || getToday(),
    valid_until_days: days || 30,
    valid_until_day_type: quotation.valid_until_day_type || "calendar",
    customer_name: quotation.customer_name || "",
    vat_mode: quotation.vat_mode || "not_included",
    note: quotation.note || "",
  };
}

function normalizeSupplierOptions(item) {
  const sourceOptions = Array.isArray(item?.supplier_options)
    ? item.supplier_options
    : [];

  return sourceOptions.map((option, index) => ({
    option_id: option.id || option.option_id || `qopt-edit-${index}`,
    supplier_name: option.supplier_name || option.supplierName || "",
    cost_price:
      option.cost_price ?? option.costPrice ?? option.cost ?? "",
  }));
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
    product_query: item.sku
      ? `${item.product_name || item.productName || item.name || ""} (${item.sku || item.SKU})`
      : item.product_name || item.productName || item.name || "",
    product_name: item.product_name || item.productName || item.name || "",
    sku: item.sku || item.SKU || "",
    unit: item.unit || "pcs",
    quantity: item.quantity ?? 1,
    sale_price: item.sale_price ?? item.unit_price ?? "",
    supplier_options: normalizeSupplierOptions(item),
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

function getQuotationItemKey(item, index) {
  return item.line_id || item.id || `q-item-${index}`;
}

function getShortQuotationItemKeys(quotation, stockCoverage) {
  const items = Array.isArray(quotation?.items) ? quotation.items : [];

  return items
    .map((item, index) =>
      stockCoverage.lines[index]?.status === "short" ? getQuotationItemKey(item, index) : null
    )
    .filter(Boolean);
}

function buildConversionItemBase(item) {
  return {
    product_id: item.product_id || "",
    product_name: item.product_name || "",
    sku: item.sku || "",
    unit: item.unit || "pcs",
    quantity: item.quantity ?? 1,
    discounts: normalizeDiscounts(item),
  };
}

// rows: [{ item, option }] from QuotationConvertSelect. One purchase order per supplier.
function buildPurchaseGroups(quotation, rows, suppliers = []) {
  const groupsBySupplier = new Map();

  rows.forEach(({ item, option }) => {
    const supplierName = option?.supplier_name || "Unassigned Supplier";

    if (!groupsBySupplier.has(supplierName)) {
      const supplier = findPartnerByCompanyName(suppliers, supplierName);
      const paymentTermType = supplier?.termType || "";
      const paymentTermDays =
        paymentTermType === "credit" ? supplier?.billingNoteDate || "" : "";

      groupsBySupplier.set(supplierName, {
        supplier_name: supplierName,
        prefill: {
          supplier_name: supplierName,
          transaction_date: quotation.quotation_date || getToday(),
          vat_mode: quotation.vat_mode || "not_included",
          payment_term_type: paymentTermType,
          payment_term_days: paymentTermDays,
          note: "",
          items: [],
        },
      });
    }

    groupsBySupplier.get(supplierName).prefill.items.push({
      ...buildConversionItemBase(item),
      unit_cost: option?.cost_price ?? "",
    });
  });

  return [...groupsBySupplier.values()];
}

function buildSalesPrefillFromRows(quotation, rows, customers = []) {
  const customer = findPartnerByCompanyName(customers, quotation.customer_name || "");
  const paymentTermType = customer?.termType || "";
  const paymentTermDays =
    paymentTermType === "credit" ? customer?.billingNoteDate || "" : "";

  return {
    customer_name: quotation.customer_name || "",
    transaction_date: quotation.quotation_date || getToday(),
    vat_mode: quotation.vat_mode || "not_included",
    payment_term_type: paymentTermType,
    payment_term_days: paymentTermDays,
    note: "",
    items: rows.map(({ item, option }) => ({
      ...buildConversionItemBase(item),
      unit_price: item.sale_price ?? "",
      supplier_name: option?.supplier_name || "",
      unit_cost: option?.cost_price ?? "",
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
  const { t } = useLanguage();
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
    () => normalizePartnerOptions(customers, form.customer_name).map(
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
    () => computeValidUntilDate(form.quotation_date, form.valid_until_days, form.valid_until_day_type),
    [form.quotation_date, form.valid_until_days, form.valid_until_day_type]
  );

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
    const n = parseInt(rawValue, 10);
    if (isNaN(n)) return;
    const clamped = Math.min(100, Math.max(0, n));
    setForm((currentForm) => ({
      ...currentForm,
      valid_until_days: clamped,
      valid_until_day_type:
        clamped === 0
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
    const productName = getProductName(product);
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
              supplier_options: [
                ...(item.supplier_options || []),
                emptySupplierOption(),
              ],
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
                  currentOptionIndex === optionIndex
                    ? { ...option, [key]: value }
                    : option
              ),
            }
          : item
      )
    );
  }

  function addDiscount(itemIndex) {
    setItems((currentItems) =>
      currentItems.map((item, index) =>
        index === itemIndex
          ? { ...item, discounts: [...normalizeDiscounts(item), ""] }
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
      setFormError("Quotation date is required.");
      return;
    }

    const days = Number(form.valid_until_days);
    const isNoValidDate = form.valid_until_day_type === "no_valid_date";
    if (!isNoValidDate && (isNaN(days) || days < 1 || days > 100)) {
      setFormError("Valid until days must be between 1 and 100.");
      return;
    }
    if (!isNoValidDate && !validUntilDate) {
      setFormError("Could not compute a valid until date. Check the quotation date.");
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
            `Enter a cost price for supplier "${option.supplier_name}" on item ${itemIndex + 1}.`
          );
          return;
        }
      }
    }

    const normalizedItems = items.map((item, index) => {
      const selectedProduct = products.find((product) => `${product.id}` === `${item.product_id}`);

      if (!selectedProduct) {
        setItemErrors({ [index]: "Select an existing product from the list." });
        setOpenProductIndex(index);
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

      const supplierOptionRows = (item.supplier_options || [])
        .filter((option) => `${option.supplier_name ?? ""}`.trim())
        .map((option) => ({
          supplier_name: `${option.supplier_name}`.trim(),
          cost_price: option.cost_price,
        }));

      return {
        line_id: item.line_id,
        product_id: selectedProduct.id,
        product_name: getProductName(selectedProduct),
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

          <div className="valid-until-field">
            <span className="required-label">Valid Until Date</span>
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
              <span className="valid-until-days-unit">days</span>
            </div>
            <div className="valid-until-type-options" role="radiogroup" aria-label="Valid until day type">
              {[
                { value: "calendar", label: "Calendar days" },
                { value: "business", label: "Business days" },
                { value: "no_valid_date", label: "No Valid Date" },
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
              Expires:{" "}
              <strong>
                {form.valid_until_day_type === "no_valid_date" || !validUntilDate
                  ? "—"
                  : formatDisplayDate(validUntilDate)}
              </strong>
            </p>
          </div>

          <EligiblePartyCombobox
            id="quotation-customer"
            label="Customer Name"
            value={form.customer_name}
            options={customerOptions}
            placeholder="Search customer"
            emptyMessage="No customers found."
            onChange={(nextCustomerName) => updateForm("customer_name", nextCustomerName)}
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
            const filteredProducts = getFilteredProducts(item.product_query);
            const unitOptions = selectedProduct ? getProductUnitConversions(selectedProduct) : [];
            const saleAmount = computeAmount(item, "sale_price");
            const averageCostForSelectedUnit = getAverageCostForSelectedUnit(
              selectedProduct,
              item.unit
            );

            return (
              <div className="line-item-row quotation-line-item-row" key={item.line_id}>
                <div className="line-item-index" aria-label={`Item ${index + 1}`}>
                  {index + 1}
                </div>

                <label className="purchase-item-field quotation-item-product">
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
                  {averageCostForSelectedUnit ? (
                    <span className="field-helper-text">
                      {t("common.avgCostForUnit", {
                        amount: fmt(averageCostForSelectedUnit),
                        unit: item.unit || getProductDefaultSalesUnit(selectedProduct),
                      })}
                    </span>
                  ) : null}
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

                <div className="purchase-item-field quotation-item-suppliers">
                  <span>Suppliers (cost comparison)</span>
                  <div className="quotation-supplier-list">
                    {(item.supplier_options || []).map((option, optionIndex) => (
                      <div className="quotation-supplier-row" key={option.option_id}>
                        <EligiblePartyCombobox
                          id={`quotation-item-${item.line_id}-supplier-${option.option_id}`}
                          label="Supplier"
                          value={option.supplier_name}
                          options={supplierOptions}
                          placeholder="Search supplier"
                          emptyMessage="No suppliers found."
                          onChange={(nextSupplierName) =>
                            updateSupplierOption(
                              index,
                              optionIndex,
                              "supplier_name",
                              nextSupplierName
                            )
                          }
                        />
                        <label className="quotation-supplier-cost">
                          <span>Cost Price</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={option.cost_price}
                            onChange={(event) =>
                              updateSupplierOption(
                                index,
                                optionIndex,
                                "cost_price",
                                event.target.value
                              )
                            }
                            placeholder="0.00"
                          />
                        </label>
                        <button
                          className="danger-button quotation-supplier-remove"
                          type="button"
                          onClick={() => removeSupplierOption(index, optionIndex)}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button
                      className="secondary-button quotation-supplier-add"
                      type="button"
                      onClick={() => addSupplierOption(index)}
                    >
                      + Add Supplier
                    </button>
                  </div>
                </div>
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
  onCreatePurchaseFromQuotation,
  onViewPurchases,
  onCreateSale,
}) {
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [vatFilter, setVatFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [viewingQuotation, setViewingQuotation] = useState(null);
  const [editingQuotation, setEditingQuotation] = useState(null);
  const [showNewQuotationForm, setShowNewQuotationForm] = useState(false);
  const [showAllRows, setShowAllRows] = useState(false);
  const [conversion, setConversion] = useState(null);
  const [docRefModal, setDocRefModal] = useState(null);
  const viewingQuotationStockCoverage = useMemo(
    () => getQuotationStockCoverage(viewingQuotation, products),
    [products, viewingQuotation]
  );
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const customerOptions = useMemo(
    () => getQuotationPartnerOptions(quotations, "customer_name", customers),
    [customers, quotations]
  );
  const activeFilterCount =
    (selectedCustomer ? 1 : 0) +
    (stateFilter === "all" ? 0 : 1) +
    (vatFilter === "all" ? 0 : 1) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0) +
    (amountMin ? 1 : 0) +
    (amountMax ? 1 : 0);
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
          const matchesState =
            stateFilter === "all" ||
            getQuotationState(quotation).toLowerCase() === stateFilter;
          const matchesVat = vatFilter === "all" || quotation.vat_mode === vatFilter;
          const matchesDateRange = quotationMatchesDateRange(
            quotation.quotation_date,
            dateFrom,
            dateTo
          );
          const matchesAmount = withinRange(
            quotation.grand_total,
            amountMin,
            amountMax
          );

          return (
            matchesSearch &&
            matchesCustomer &&
            matchesState &&
            matchesVat &&
            matchesDateRange &&
            matchesAmount
          );
        })
        .sort(sortRecentQuotations),
    [
      amountMin,
      amountMax,
      dateFrom,
      dateTo,
      normalizedSearch,
      quotations,
      selectedCustomer,
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
    setStateFilter("all");
    setVatFilter("all");
    setDateFrom("");
    setDateTo("");
    setAmountMin("");
    setAmountMax("");
    setFilterOpen(false);
  }

  const vatLabels = {
    included: "Include VAT",
    not_included: "Exclude VAT",
    none: "No VAT",
  };
  const quickPresets = [
    {
      label: "Valid only",
      active: stateFilter === "valid",
      onClick: () =>
        setStateFilter((current) => (current === "valid" ? "all" : "valid")),
    },
    {
      label: "Expired",
      active: stateFilter === "expired",
      onClick: () =>
        setStateFilter((current) =>
          current === "expired" ? "all" : "expired"
        ),
    },
    {
      label: "Last 30 days",
      active: dateFrom === daysAgoInputValue(30) && !dateTo,
      onClick: () => {
        const last30 = dateFrom === daysAgoInputValue(30) && !dateTo;
        setDateFrom(last30 ? "" : daysAgoInputValue(30));
        setDateTo("");
      },
    },
  ];
  const activeChips = [
    selectedCustomer && {
      key: "customer",
      label: `Customer: ${selectedCustomer}`,
      onRemove: () => setSelectedCustomer(""),
    },
    stateFilter !== "all" && {
      key: "state",
      label: `State: ${stateFilter === "valid" ? "Valid" : "Expired"}`,
      onRemove: () => setStateFilter("all"),
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

  function handleConvertContinue(rows) {
    setConversion((current) => {
      if (!current) {
        return current;
      }
      if (current.type === "purchase") {
        return {
          ...current,
          step: "purchase-wizard",
          groups: buildPurchaseGroups(current.quotation, rows, suppliers),
        };
      }
      return {
        ...current,
        step: "sale-form",
        salePrefill: buildSalesPrefillFromRows(current.quotation, rows, customers),
      };
    });
  }

  async function handlePurchaseCreate(formData) {
    if (conversion?.quotation?.id && formData instanceof FormData) {
      formData.append("source_quotation_id", conversion.quotation.id);
    }
    return onCreatePurchaseFromQuotation?.(formData);
  }

  async function handleSaleCreate(formData) {
    if (conversion?.quotation?.id && formData instanceof FormData) {
      formData.append("source_quotation_id", conversion.quotation.id);
    }
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

  if (conversion && conversion.step === "purchase-wizard") {
    return (
      <MultiPurchaseWizard
        key={`purchase-wizard-${conversion.quotation.id}`}
        groups={conversion.groups}
        products={products}
        suppliers={suppliers}
        purchases={purchases}
        onCreatePurchase={handlePurchaseCreate}
        onCancel={() => setConversion(null)}
        onViewPurchases={() => {
          setConversion(null);
          onViewPurchases?.();
        }}
      />
    );
  }

  if (conversion && conversion.step === "sale-form") {
    return (
      <div className="stack-layout">
        <section className="section-card quotation-link-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Quotation Link</p>
              <h3>Create Sale from {conversion.quotation.reference_no}</h3>
            </div>
            <button
              className="secondary-button"
              type="button"
              onClick={() => setConversion(null)}
            >
              Back
            </button>
          </div>
        </section>
        <SalesForm
          key={`sale-from-${conversion.quotation.id}`}
          products={products}
          customers={customers}
          suppliers={suppliers}
          purchases={purchases}
          sales={sales}
          enableStockValidation={enableSaleStockValidation}
          prefill={conversion.salePrefill}
          onSubmit={handleSaleCreate}
          onCancel={() => setConversion(null)}
        />
      </div>
    );
  }

  if (conversion) {
    return (
      <div className="stack-layout">
        <QuotationConvertSelect
          key={`convert-${conversion.type}-${conversion.quotation.id}`}
          quotation={conversion.quotation}
          type={conversion.type}
          initialSelectedItemKeys={conversion.initialSelectedItemKeys}
          stockCoverageLines={conversion.stockCoverageLines}
          onBack={() => setConversion(null)}
          onContinue={handleConvertContinue}
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
              placeholder="Search quotation, customer, date, note, or item"
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

        <FilterPresets presets={quickPresets} />
        <ActiveFilterChips chips={activeChips} onClearAll={resetFilters} />

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
                  <option value="included">Include VAT</option>
                  <option value="not_included">Exclude VAT</option>
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

              <RangeField
                title="Amount (฿)"
                prefix="฿"
                minValue={amountMin}
                maxValue={amountMax}
                onMinChange={setAmountMin}
                onMaxChange={setAmountMax}
              />
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
                        <span>Date</span>
                        <strong>{formatDate(quotation.quotation_date)}</strong>
                      </div>
                      <div>
                        <span>Valid Until</span>
                        <strong>{formatDate(quotation.valid_until_date)}</strong>
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
            className="detail-modal transaction-detail-modal section-card"
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
                  disabled={viewingQuotationStockCoverage.allSufficient}
                  title={
                    viewingQuotationStockCoverage.allSufficient
                      ? t("quotationDetail.purchaseDisabledCovered")
                      : ""
                  }
                  onClick={() => {
                    setViewingQuotation(null);
                    setEditingQuotation(null);
                    setShowNewQuotationForm(false);
                    setConversion({
                      type: "purchase",
                      quotation: viewingQuotation,
                      initialSelectedItemKeys: getShortQuotationItemKeys(
                        viewingQuotation,
                        viewingQuotationStockCoverage
                      ),
                      stockCoverageLines: viewingQuotationStockCoverage.lines,
                    });
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
                <p className="detail-label">Quotation Date</p>
                <strong>{formatDate(viewingQuotation.quotation_date)}</strong>
              </div>
              <div>
                <p className="detail-label">Valid Until</p>
                <strong>{formatDate(viewingQuotation.valid_until_date)}</strong>
              </div>
              <div>
                <p className="detail-label">Status</p>
                <strong>
                  <span className={`quotation-state-pill ${getQuotationState(viewingQuotation).toLowerCase()}`}>
                    {getQuotationState(viewingQuotation)}
                  </span>
                </strong>
              </div>
              <div>
                <p className="detail-label">Note</p>
                <strong>{viewingQuotation.note || "—"}</strong>
              </div>
              <div>
                <p className="detail-label">Purchase Orders Created</p>
                {(viewingQuotation.derived_purchase_links || []).length > 0 ? (
                  <div className="doc-ref-chips">
                    {viewingQuotation.derived_purchase_links.map((link) => (
                      <DocumentRefChip
                        key={link.id}
                        label={link.reference_no || link.id}
                        docType="purchase"
                        onClick={() => setDocRefModal({ docType: "purchase", docId: link.id, referenceNo: link.reference_no || link.id })}
                      />
                    ))}
                  </div>
                ) : (
                  <strong>—</strong>
                )}
                <p className="detail-label" style={{ marginTop: "10px" }}>Sales Created</p>
                {(viewingQuotation.derived_sale_links || []).length > 0 ? (
                  <div className="doc-ref-chips">
                    {viewingQuotation.derived_sale_links.map((link) => (
                      <DocumentRefChip
                        key={link.id}
                        label={link.reference_no || link.id}
                        docType="sale"
                        onClick={() => setDocRefModal({ docType: "sale", docId: link.id, referenceNo: link.reference_no || link.id })}
                      />
                    ))}
                  </div>
                ) : (
                  <strong>—</strong>
                )}
              </div>
            </div>

            <div className="detail-items">
              <p className="detail-label">Items</p>
              <div className="table-scroll quotation-detail-scroll">
                <table className="quotation-detail-table">
                  <thead>
                    <tr>
                      <th className="table-index-cell">#</th>
                      <th>Product</th>
                      <th>SKU</th>
                      <th>Qty</th>
                      <th>{t("quotationDetail.baseQtyColumn")}</th>
                      <th>{t("quotationDetail.stockColumn")}</th>
                      <th>Sale Price</th>
                      <th>{t("quotationDetail.baseSalePriceColumn")}</th>
                      <th>{t("quotationDetail.baseSalePriceAfterDiscountColumn")}</th>
                      <th>Suppliers (Cost)</th>
                      <th>Discounts</th>
                      <th>Sale Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(viewingQuotation.items || []).map((item, index) => {
                      const stockCoverage = viewingQuotationStockCoverage.lines[index] || {
                        status: "unknown",
                        metaKey: "quotationDetail.stockUnknownMeta",
                        metaValues: {},
                      };
                      const product = findProductForItem(item, products);
                      const baseUnit = getQuotationItemBaseUnit(item, product);
                      const baseQuantity = getQuotationItemBaseQuantity(item, product);
                      const baseSalePrice = getQuotationBaseSalePrice(item, product);
                      const baseSalePriceAfterDiscount = getQuotationBaseSalePrice(
                        item,
                        product,
                        true
                      );
                      const discounts = normalizeDiscounts(item);
                      const activeDiscounts = discounts.filter((d) => Number(d) > 0);
                      const discountLabel = activeDiscounts.length
                        ? activeDiscounts.map((d) => `${Number(d)}%`).join("|")
                        : "—";
                      const supplierOptionList = Array.isArray(item.supplier_options)
                        ? item.supplier_options
                        : [];

                      return (
                        <tr key={item.line_id || index}>
                          <td className="table-index-cell">{index + 1}</td>
                          <td>{item.product_name || "—"}</td>
                          <td>{item.sku || "—"}</td>
                          <td>{formatQuantityWithUnit(item.quantity, item.unit)}</td>
                          <td>{formatQuantityWithUnit(baseQuantity, baseUnit)}</td>
                          <td>
                            <div className="quotation-detail-stock">
                              <span
                                className={`status-badge health-badge ${
                                  stockCoverage.status === "covered"
                                    ? "positive"
                                    : stockCoverage.status === "short"
                                      ? "warning"
                                      : "danger"
                                }`}
                              >
                                {stockCoverage.status === "covered"
                                  ? t("quotationDetail.stockCovered")
                                  : stockCoverage.status === "short"
                                    ? t("quotationDetail.stockShort")
                                    : t("quotationDetail.stockUnknown")}
                              </span>
                              <span className="quotation-detail-stock-meta">
                                {t(stockCoverage.metaKey, stockCoverage.metaValues)}
                              </span>
                            </div>
                          </td>
                          <td>{item.sale_price !== "" && item.sale_price != null ? fmt(item.sale_price) : "—"}</td>
                          <td>{formatOptionalMoney(baseSalePrice)}</td>
                          <td>{formatOptionalMoney(baseSalePriceAfterDiscount)}</td>
                          <td>
                            {supplierOptionList.length ? (
                              <div className="quotation-supplier-summary">
                                {supplierOptionList.map((option) => (
                                  <span
                                    key={option.id || option.option_id || option.supplier_name}
                                    className="quotation-supplier-chip"
                                  >
                                    {option.supplier_name || "—"}: {fmt(option.cost_price)}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td>
                            <div className="tx-discount-breakdown">
                              <span className="tx-discount-breakdown-row">
                                <span className="tx-discount-type">Item</span>
                                <span className="tx-discount-label">{discountLabel}</span>
                              </span>
                            </div>
                          </td>
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

      {docRefModal && (
        <DocumentRefModal
          docType={docRefModal.docType}
          docId={docRefModal.docId}
          referenceNo={docRefModal.referenceNo}
          onClose={() => setDocRefModal(null)}
        />
      )}
    </div>
  );
}

export default QuotationPage;
