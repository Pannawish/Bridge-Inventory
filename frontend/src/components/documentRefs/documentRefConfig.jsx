import { api } from "../../api";
import { formatDate, formatMoney as fmt } from "../../format";
import { getStatusLabel } from "../../i18n/statusLabels";
import PaymentLineAmount from "../PaymentLineAmount";

export function renderDiscounts(discounts) {
  if (!Array.isArray(discounts)) {
    return "—";
  }
  const active = discounts.filter((value) => Number(value) > 0);
  if (!active.length) {
    return "—";
  }
  return active.map((value) => `${Number(value)}%`).join("|");
}

function getBaseQuantity(item) {
  if (item?.base_quantity !== undefined && item?.base_quantity !== null) {
    return Number(item.base_quantity) || 0;
  }

  const quantity = Number(item?.quantity) || 0;
  const factor = Number(item?.conversion_factor) || 1;
  return quantity * factor;
}

function getItemConversionFactor(item) {
  const rawFactor = Number(item?.conversion_factor);
  if (Number.isFinite(rawFactor) && rawFactor > 0) {
    return rawFactor;
  }

  const quantity = Number(item?.quantity) || 0;
  const baseQuantity = getBaseQuantity(item);
  return quantity > 0 && baseQuantity > 0 ? baseQuantity / quantity : 1;
}

function formatOptionalMoney(value) {
  return value === null || value === undefined || !Number.isFinite(Number(value))
    ? "—"
    : fmt(value);
}

function formatQuantityWithUnit(quantity, unit) {
  const numericQuantity = Number(quantity);
  const normalizedUnit = `${unit || ""}`.trim();

  if (!Number.isFinite(numericQuantity)) {
    return "—";
  }

  return normalizedUnit ? `${numericQuantity} ${normalizedUnit}` : `${numericQuantity}`;
}

function getSaleBaseUnitPrice(item) {
  const unitPrice = Number(item?.unit_price);
  if (!Number.isFinite(unitPrice)) {
    return null;
  }

  return unitPrice / getItemConversionFactor(item);
}

function getSaleBaseUnitPriceAfterDiscount(item) {
  const baseQuantity = getBaseQuantity(item);
  if (baseQuantity <= 0) {
    return null;
  }

  return (Number(item?.amount) || 0) / baseQuantity;
}

function getPurchaseBaseUnitCost(item) {
  const unitCost = Number(item?.unit_cost);
  if (!Number.isFinite(unitCost)) {
    return null;
  }

  return unitCost / getItemConversionFactor(item);
}

function getPurchaseBaseUnitCostAfterDiscount(item) {
  const baseQuantity = getBaseQuantity(item);
  if (baseQuantity <= 0) {
    return null;
  }

  return (Number(item?.amount) || 0) / baseQuantity;
}

function quotationLink(id, referenceNo) {
  return id ? [{ id, reference_no: referenceNo || "" }] : [];
}

function buildPartySummary(profile, t, { includeProcurement = false } = {}) {
  if (!profile) {
    return "—";
  }

  const lines = [];

  if (profile.company_name) {
    lines.push(profile.company_name);
  }
  if (profile.taxpayer_id) {
    lines.push(`${t("documentRef.taxId")}: ${profile.taxpayer_id}`);
  }
  if (profile.branch) {
    lines.push(`${t("documentRef.branch")}: ${profile.branch}`);
  }

  const address = profile.location || profile.shipping_address;
  if (address) {
    lines.push(`${t("documentRef.address")}: ${address}`);
  }

  if (includeProcurement && (profile.procurement_name || profile.procurement_tel)) {
    const contactBits = [profile.procurement_name, profile.procurement_tel].filter(Boolean);
    lines.push(`${t("documentRef.contact")}: ${contactBits.join(" · ")}`);
  } else if (profile.tel) {
    lines.push(`${t("documentRef.phone")}: ${profile.tel}`);
  }

  if (profile.email) {
    lines.push(`${t("documentRef.email")}: ${profile.email}`);
  }

  return lines.length ? lines.join("\n") : "—";
}

function getPrintablePurchaseItems(doc) {
  const activeItems = (doc.items || []).filter((item) => item.item_status !== "cancelled");
  return activeItems.length ? activeItems : doc.items || [];
}

function getPrintableSaleItems(doc) {
  const activeItems = (doc.items || []).filter(
    (item) => !["cancelled", "returned"].includes(item.item_status)
  );
  return activeItems.length ? activeItems : doc.items || [];
}

function buildPurchasePayableTotals(doc, t) {
  const grand = Number(doc.grand_total) || 0;
  const payable = Number(doc.payable_total);
  const hasPayableReduction =
    Number.isFinite(payable) && grand - payable > 0.005;

  const totals = [
    { label: t("common.total"), value: fmt(doc.total_before_vat) },
    { label: t("documentRef.paymentTermVAT"), value: fmt(doc.vat_amount) },
    {
      label: hasPayableReduction
        ? t("documentRef.originalTotal")
        : t("common.grandTotal"),
      value: fmt(doc.grand_total),
      strong: true,
    },
  ];

  if (hasPayableReduction) {
    const cancelledCount = (doc.items || []).filter(
      (item) => item.item_status === "cancelled"
    ).length;
    totals.push({
      label: t("documentRef.cancelledAmount", { count: cancelledCount }),
      value: `−${fmt(grand - payable)}`,
      className: "tx-summary-cancelled",
    });
    totals.push({
      label: t("documentRef.amountPayable"),
      value: fmt(payable),
      strong: true,
      className: "tx-summary-payable",
    });
  }

  return totals;
}

export function buildDocConfig(t) {
  function paymentTerm(type, days) {
    if (type === "credit") return t("documentRef.creditTermCredit", { days: days || "" });
    if (type === "cash") return t("documentRef.creditTermDebit");
    return "—";
  }

  return {
    quotation: {
      label: t("documentRef.quotation"),
      fetch: (id) => api.getQuotation(id),
      header: (doc) => [
        { label: t("documentRef.dateLabel"), value: formatDate(doc.quotation_date) },
        { label: t("documentRef.validUntil"), value: formatDate(doc.valid_until_date) },
        { label: t("documentRef.customer"), value: doc.customer_name || "—" },
        { label: t("documentRef.supplier"), value: doc.supplier_name || "—" },
        { label: t("documentRef.noteLabel"), value: doc.note || "—", fullWidth: true },
      ],
      items: (doc) => ({
        columns: [
          "#",
          t("documentRef.colProduct"),
          t("documentRef.colSKU"),
          t("documentRef.colQty"),
          t("documentRef.colUnit"),
          t("documentRef.colSalePrice"),
          t("documentRef.colDiscounts"),
          t("documentRef.colAmount"),
        ],
        rows: (doc.items || []).map((item, index) => [
          index + 1,
          item.product_name || "—",
          item.sku || "—",
          item.quantity,
          item.unit || "—",
          fmt(item.sale_price),
          renderDiscounts(item.discounts),
          fmt(item.sale_amount),
        ]),
      }),
      totals: (doc) => [
        { label: t("common.subtotal"), value: fmt(doc.total_before_vat) },
        { label: t("documentRef.paymentTermVAT"), value: fmt(doc.vat_amount) },
        { label: t("common.grandTotal"), value: fmt(doc.grand_total), strong: true },
      ],
      refs: (doc) => [
        {
          label: t("documentRef.purchaseOrders"),
          docType: "purchase",
          links: doc.derived_purchase_links || [],
        },
        {
          label: t("documentRef.salesCreated"),
          docType: "sale",
          links: doc.derived_sale_links || [],
        },
      ],
      printHeader: (doc) => [
        {
          label: t("documentRef.customer"),
          value: buildPartySummary(doc.customer_profile, t),
          fullWidth: true,
        },
        { label: t("documentRef.dateLabel"), value: formatDate(doc.quotation_date) },
        { label: t("documentRef.validUntil"), value: formatDate(doc.valid_until_date) },
        { label: t("documentRef.shippingDate"), value: formatDate(doc.shipping_date) },
        {
          label: t("documentRef.colPaymentTerm"),
          value: paymentTerm(doc.payment_term_type, doc.payment_term_days),
        },
        { label: t("documentRef.noteLabel"), value: doc.note || "—", fullWidth: true },
      ],
      printItems: (doc) => ({
        columns: [
          "#",
          t("documentRef.colProduct"),
          t("documentRef.colSKU"),
          t("documentRef.colQty"),
          t("documentRef.colUnit"),
          t("documentRef.colSalePrice"),
          t("documentRef.colDiscounts"),
          t("documentRef.colAmount"),
        ],
        rows: (doc.items || []).map((item, index) => [
          index + 1,
          item.product_name || "—",
          item.sku || "—",
          item.quantity,
          item.unit || "—",
          fmt(item.sale_price),
          renderDiscounts(item.discounts),
          fmt(item.sale_amount),
        ]),
      }),
      printRefs: () => [],
    },
    purchase: {
      label: t("documentRef.purchase"),
      fetch: (id) => api.getPurchase(id),
      header: (doc) => [
        { label: t("documentRef.dateLabel"), value: formatDate(doc.transaction_date) },
        { label: t("documentRef.supplier"), value: doc.supplier_name || "—" },
        { label: t("documentRef.status"), status: doc.status },
        { label: t("documentRef.supplierTaxInvoice"), value: doc.supplier_tax_invoice || "—" },
        { label: t("documentRef.noteLabel"), value: doc.note || "—", fullWidth: true },
      ],
      items: (doc) => ({
        columns: [
          "#",
          t("documentRef.colProduct"),
          t("documentRef.colSKU"),
          t("documentRef.colExpected"),
          t("documentRef.colItemStatus"),
          t("documentRef.colReceived"),
          t("documentRef.colQty"),
          t("documentRef.colBaseQty"),
          t("documentRef.colBaseCost"),
          t("documentRef.colBaseCostAfterDisc"),
          t("documentRef.colUnitCost"),
          t("documentRef.colDiscounts"),
          t("documentRef.colAmount"),
        ],
        rows: (doc.items || []).map((item, index) => [
          index + 1,
          item.product_name || "—",
          item.sku || "—",
          formatDate(item.expected_delivery_date),
          getStatusLabel(t, item.item_status),
          formatDate(item.received_date),
          formatQuantityWithUnit(item.quantity, item.unit),
          formatQuantityWithUnit(item.base_quantity, item.base_unit),
          formatOptionalMoney(getPurchaseBaseUnitCost(item)),
          formatOptionalMoney(getPurchaseBaseUnitCostAfterDiscount(item)),
          fmt(item.unit_cost),
          renderDiscounts(item.discounts),
          item.item_status === "cancelled" ? (
            <span className="detail-item-amount-cancelled">{fmt(item.amount)}</span>
          ) : (
            fmt(item.amount)
          ),
        ]),
        rowClassNames: (doc.items || []).map((item) =>
          item.item_status === "cancelled" ? "detail-item-cancelled" : undefined
        ),
      }),
      totals: (doc) => buildPurchasePayableTotals(doc, t),
      refs: (doc) => [
        {
          label: t("documentRef.sourceQuotation"),
          docType: "quotation",
          links: quotationLink(doc.source_quotation_id, doc.source_quotation_reference_no),
        },
        {
          label: t("documentRef.paymentBatchLabel"),
          docType: "payment-batch",
          links: doc.payment_batch_links || [],
        },
      ],
      printHeader: (doc) => [
        {
          label: t("documentRef.supplier"),
          value: buildPartySummary(doc.supplier_profile, t, { includeProcurement: true }),
          fullWidth: true,
        },
        { label: t("documentRef.dateLabel"), value: formatDate(doc.transaction_date) },
        {
          label: t("documentRef.colPaymentTerm"),
          value: paymentTerm(doc.payment_term_type, doc.payment_term_days),
        },
        { label: t("documentRef.colPaymentDue"), value: formatDate(doc.payment_date) },
        { label: t("documentRef.noteLabel"), value: doc.note || "—", fullWidth: true },
      ],
      printItems: (doc) => ({
        columns: [
          "#",
          t("documentRef.colProduct"),
          t("documentRef.colSKU"),
          t("documentRef.colQty"),
          t("documentRef.colUnit"),
          t("documentRef.colExpected"),
          t("documentRef.colUnitCost"),
          t("documentRef.colDiscounts"),
          t("documentRef.colAmount"),
        ],
        rows: getPrintablePurchaseItems(doc).map((item, index) => [
          index + 1,
          item.product_name || "—",
          item.sku || "—",
          item.quantity,
          item.unit || "—",
          formatDate(item.expected_delivery_date),
          fmt(item.unit_cost),
          renderDiscounts(item.discounts),
          fmt(item.amount),
        ]),
      }),
      printRefs: () => [],
    },
    sale: {
      label: t("documentRef.sale"),
      fetch: (id) => api.getSale(id),
      header: (doc) => [
        { label: t("documentRef.dateLabel"), value: formatDate(doc.transaction_date) },
        { label: t("documentRef.customer"), value: doc.customer_name || "—" },
        { label: t("documentRef.status"), status: doc.status },
        { label: t("documentRef.customerPORef"), value: doc.customer_po_reference || "—" },
        { label: t("documentRef.noteLabel"), value: doc.note || "—", fullWidth: true },
      ],
      items: (doc) => ({
        columns: [
          "#",
          t("documentRef.colProduct"),
          t("documentRef.colSKU"),
          t("documentRef.colItemStatus"),
          t("documentRef.colShipped"),
          t("documentRef.colDelivered"),
          t("documentRef.colQty"),
          t("documentRef.colBaseQty"),
          t("documentRef.colBaseUnitPrice"),
          t("documentRef.colBaseUnitPriceAfterDisc"),
          t("documentRef.colUnitPrice"),
          t("documentRef.supplier"),
          t("documentRef.colUnitCost"),
          t("documentRef.colDiscounts"),
          t("documentRef.colAmount"),
        ],
        rows: (doc.items || []).map((item, index) => [
          index + 1,
          item.product_name || "—",
          item.sku || "—",
          getStatusLabel(t, item.item_status),
          formatDate(item.shipped_date),
          formatDate(item.delivered_date),
          formatQuantityWithUnit(item.quantity, item.unit),
          formatQuantityWithUnit(item.base_quantity, item.base_unit),
          formatOptionalMoney(getSaleBaseUnitPrice(item)),
          formatOptionalMoney(getSaleBaseUnitPriceAfterDiscount(item)),
          fmt(item.unit_price),
          item.supplier_name || "—",
          Number(item.unit_cost) > 0 ? fmt(item.unit_cost) : "—",
          renderDiscounts(item.discounts),
          fmt(item.amount),
        ]),
      }),
      totals: (doc) => [
        { label: t("common.subtotal"), value: fmt(doc.total_before_vat) },
        { label: t("documentRef.paymentTermVAT"), value: fmt(doc.vat_amount) },
        { label: t("common.grandTotal"), value: fmt(doc.grand_total), strong: true },
      ],
      refs: (doc) => [
        {
          label: t("documentRef.sourceQuotation"),
          docType: "quotation",
          links: quotationLink(doc.source_quotation_id, doc.source_quotation_reference_no),
        },
        {
          label: t("documentRef.billingNotes"),
          docType: "billing-note",
          links: doc.billing_note_links || [],
        },
        {
          label: t("documentRef.creditNotes"),
          docType: "credit-note",
          links: doc.credit_note_links || [],
        },
      ],
      printHeader: (doc) => [
        {
          label: t("documentRef.customer"),
          value: buildPartySummary(doc.customer_profile, t),
          fullWidth: true,
        },
        { label: t("documentRef.dateLabel"), value: formatDate(doc.transaction_date) },
        { label: t("documentRef.customerPORef"), value: doc.customer_po_reference || "—" },
        {
          label: t("documentRef.colPaymentTerm"),
          value: paymentTerm(doc.payment_term_type, doc.payment_term_days),
        },
        { label: t("documentRef.colPaymentDue"), value: formatDate(doc.payment_date) },
        { label: t("documentRef.noteLabel"), value: doc.note || "—", fullWidth: true },
      ],
      printItems: (doc) => ({
        columns: [
          "#",
          t("documentRef.colProduct"),
          t("documentRef.colSKU"),
          t("documentRef.colQty"),
          t("documentRef.colUnit"),
          t("documentRef.colUnitPrice"),
          t("documentRef.colDiscounts"),
          t("documentRef.colAmount"),
        ],
        rows: getPrintableSaleItems(doc).map((item, index) => [
          index + 1,
          item.product_name || "—",
          item.sku || "—",
          item.quantity,
          item.unit || "—",
          fmt(item.unit_price),
          renderDiscounts(item.discounts),
          fmt(item.amount),
        ]),
      }),
      printRefs: () => [],
    },
    "billing-note": {
      label: t("documentRef.billingNote"),
      fetch: (id) => api.getBillingNote(id),
      header: (doc) => [
        { label: t("documentRef.dateLabel"), value: formatDate(doc.billing_note_date) },
        { label: t("documentRef.customer"), value: doc.customer_name || "—" },
        { label: t("documentRef.status"), status: doc.status },
        { label: t("documentRef.expectedPayment"), value: formatDate(doc.expected_payment_date) },
        { label: t("documentRef.actualPayment"), value: formatDate(doc.actual_payment_date) },
        { label: t("documentRef.bankReference"), value: doc.bank_reference || "—" },
        { label: t("documentRef.noteLabel"), value: doc.note || "—", fullWidth: true },
      ],
      items: (doc) => ({
        columns: [
          "#",
          t("documentRef.colReference"),
          t("documentRef.colSaleDate"),
          t("documentRef.colPaymentTerm"),
          t("documentRef.colPaymentDue"),
          t("documentRef.colReceived"),
          t("documentRef.colReceivedDate"),
          t("documentRef.colAmount"),
        ],
        rows: (doc.lines || []).map((line, index) => [
          index + 1,
          line.sale_reference_no || line.sale || "—",
          formatDate(line.sale_transaction_date),
          paymentTerm(line.sale_payment_term_type, line.sale_payment_term_days),
          formatDate(line.sale_payment_date),
          line.received ? t("common.yes") : t("common.no"),
          formatDate(line.received_date),
          fmt(line.amount),
        ]),
      }),
      totals: (doc) => [
        { label: t("documentRef.totalBilled"), value: fmt(doc.total_amount) },
        { label: t("documentRef.netAfterCredits"), value: fmt(doc.net_amount), strong: true },
      ],
      refs: (doc) => [
        {
          label: t("documentRef.sales"),
          docType: "sale",
          links: (doc.lines || []).map((line) => ({
            id: line.sale_id || line.sale,
            reference_no: line.sale_reference_no || "",
          })),
        },
        {
          label: t("documentRef.creditNotes"),
          docType: "credit-note",
          links: (doc.credit_notes || []).map((cn) => ({
            id: cn.id,
            reference_no: cn.reference_no || "",
          })),
        },
      ],
      printHeader: (doc) => [
        {
          label: t("documentRef.customer"),
          value: buildPartySummary(doc.customer_profile, t),
          fullWidth: true,
        },
        { label: t("documentRef.dateLabel"), value: formatDate(doc.billing_note_date) },
        { label: t("documentRef.expectedPayment"), value: formatDate(doc.expected_payment_date) },
        { label: t("documentRef.noteLabel"), value: doc.note || "—", fullWidth: true },
      ],
      printItems: (doc) => ({
        columns: [
          "#",
          t("documentRef.colReference"),
          t("documentRef.colSaleDate"),
          t("documentRef.colPaymentDue"),
          t("documentRef.colAmount"),
        ],
        rows: (doc.lines || []).map((line, index) => [
          index + 1,
          line.sale_reference_no || line.sale || "—",
          formatDate(line.sale_transaction_date),
          formatDate(line.sale_payment_date),
          fmt(line.amount),
        ]),
      }),
      printRefs: (doc) =>
        (doc.credit_notes || []).length > 0
          ? [
              {
                label: t("documentRef.creditNotes"),
                docType: "credit-note",
                links: (doc.credit_notes || []).map((cn) => ({
                  id: cn.id,
                  reference_no: cn.reference_no || "",
                })),
              },
            ]
          : [],
    },
    "payment-batch": {
      label: t("documentRef.paymentBatch"),
      fetch: (id) => api.getPaymentBatch(id),
      header: (doc) => [
        { label: t("documentRef.dateLabel"), value: formatDate(doc.batch_date) },
        { label: t("documentRef.supplier"), value: doc.supplier_name || "—" },
        { label: t("documentRef.status"), status: doc.status },
        { label: t("documentRef.plannedPayment"), value: formatDate(doc.planned_payment_date) },
        { label: t("documentRef.actualPayment"), value: formatDate(doc.actual_payment_date) },
        { label: t("documentRef.bankReference"), value: doc.bank_reference || "—" },
        { label: t("documentRef.noteLabel"), value: doc.note || "—", fullWidth: true },
      ],
      items: (doc) => ({
        columns: [
          "#",
          t("documentRef.colReference"),
          t("documentRef.colPODate"),
          t("documentRef.colPaymentTerm"),
          t("documentRef.colPaymentDue"),
          t("documentRef.colPaid"),
          t("documentRef.colPaidDate"),
          t("documentRef.colAmount"),
        ],
        rows: (doc.lines || []).map((line, index) => [
          index + 1,
          line.purchase_reference_no || line.purchase || "—",
          formatDate(line.purchase_transaction_date),
          paymentTerm(line.purchase_payment_term_type, line.purchase_payment_term_days),
          formatDate(line.purchase_payment_date),
          line.paid ? t("common.yes") : t("common.no"),
          formatDate(line.paid_date),
          <PaymentLineAmount key={line.id || index} line={line} />,
        ]),
      }),
      totals: (doc) => [{ label: t("common.total"), value: fmt(doc.total_amount), strong: true }],
      refs: (doc) => [
        {
          label: t("documentRef.purchases"),
          docType: "purchase",
          links: (doc.lines || []).map((line) => ({
            id: line.purchase_id || line.purchase,
            reference_no: line.purchase_reference_no || "",
          })),
        },
      ],
      printHeader: (doc) => [
        {
          label: t("documentRef.supplier"),
          value: buildPartySummary(doc.supplier_profile, t, { includeProcurement: true }),
          fullWidth: true,
        },
        { label: t("documentRef.dateLabel"), value: formatDate(doc.batch_date) },
        { label: t("documentRef.plannedPayment"), value: formatDate(doc.planned_payment_date) },
        { label: t("documentRef.actualPayment"), value: formatDate(doc.actual_payment_date) },
        { label: t("documentRef.bankReference"), value: doc.bank_reference || "—" },
        { label: t("documentRef.noteLabel"), value: doc.note || "—", fullWidth: true },
      ],
      printItems: (doc) => ({
        columns: [
          "#",
          t("documentRef.colReference"),
          t("documentRef.colPODate"),
          t("documentRef.colPaymentDue"),
          t("documentRef.colAmount"),
        ],
        rows: (doc.lines || []).map((line, index) => [
          index + 1,
          line.purchase_reference_no || line.purchase || "—",
          formatDate(line.purchase_transaction_date),
          formatDate(line.purchase_payment_date),
          fmt(line.amount),
        ]),
      }),
      printRefs: () => [],
    },
    "credit-note": {
      label: t("documentRef.creditNote"),
      fetch: (id) => api.getCreditNote(id),
      header: (doc) => [
        { label: t("documentRef.dateLabel"), value: formatDate(doc.credit_note_date) },
        { label: t("documentRef.customer"), value: doc.customer_name || "—" },
        { label: t("documentRef.status"), status: doc.status },
        { label: t("documentRef.noteLabel"), value: doc.note || "—", fullWidth: true },
      ],
      items: (doc) => ({
        columns: [
          "#",
          t("documentRef.colProduct"),
          t("documentRef.colSKU"),
          t("documentRef.colQty"),
          t("documentRef.colUnitPrice"),
          t("documentRef.colAmount"),
        ],
        rows: (doc.lines || []).map((line, index) => [
          index + 1,
          line.product_name || "—",
          line.sku || "—",
          line.quantity,
          fmt(line.unit_price),
          fmt(line.amount),
        ]),
      }),
      totals: (doc) => [{ label: t("documentRef.totalCredited"), value: fmt(doc.total_amount), strong: true }],
      refs: (doc) => [
        {
          label: t("documentRef.sourceSale"),
          docType: "sale",
          links: doc.sale ? [{ id: doc.sale, reference_no: doc.sale_reference_no || "" }] : [],
        },
        {
          label: t("documentRef.billingNoteLabel"),
          docType: "billing-note",
          links: doc.billing_note
            ? [{ id: doc.billing_note, reference_no: doc.billing_note_reference_no || "" }]
            : [],
        },
      ],
      printHeader: (doc) => [
        {
          label: t("documentRef.customer"),
          value: buildPartySummary(doc.customer_profile, t),
          fullWidth: true,
        },
        { label: t("documentRef.dateLabel"), value: formatDate(doc.credit_note_date) },
        { label: t("documentRef.sourceSale"), value: doc.sale_reference_no || "—" },
        { label: t("documentRef.billingNoteLabel"), value: doc.billing_note_reference_no || "—" },
        { label: t("documentRef.noteLabel"), value: doc.note || "—", fullWidth: true },
      ],
      printItems: (doc) => ({
        columns: [
          "#",
          t("documentRef.colProduct"),
          t("documentRef.colSKU"),
          t("documentRef.colQty"),
          t("documentRef.colUnitPrice"),
          t("documentRef.colAmount"),
        ],
        rows: (doc.lines || []).map((line, index) => [
          index + 1,
          line.product_name || "—",
          line.sku || "—",
          line.quantity,
          fmt(line.unit_price),
          fmt(line.amount),
        ]),
      }),
      printRefs: () => [],
    },
  };
}
