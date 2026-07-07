// Helper utilities for application shell behavior.

import { mockQuotations } from "../mockData";

export const PAGE_SIZE = 25;

export function getCollectionRows(result, fallback = []) {
  if (Array.isArray(result)) {
    return result;
  }

  if (Array.isArray(result?.results)) {
    return result.results;
  }

  return fallback;
}

export function getCollectionPagination(result) {
  if (!Array.isArray(result?.results)) {
    return null;
  }

  return {
    count: Number(result.count || 0),
    next: result.next || null,
    previous: result.previous || null,
    page: Number(result.page || 1),
    page_size: Number(result.page_size || PAGE_SIZE),
    total_pages: Number(result.total_pages || 1),
  };
}

export function buildListParams({
  page = 1,
  pageSize = PAGE_SIZE,
  search = "",
  statuses = "",
  status = "",
  supplier = "",
  customer = "",
  product = "",
  category = "",
  stockFilter = "",
  profileFilter = "",
  dateFrom = "",
  dateTo = "",
  amountMin = "",
  amountMax = "",
  vatMode = "",
} = {}) {
  return {
    page,
    page_size: pageSize,
    search: search.trim(),
    status: Array.isArray(statuses) ? statuses.join(",") : statuses || status,
    supplier,
    customer,
    product,
    category,
    stock_filter: stockFilter,
    profile_filter: profileFilter,
    date_from: dateFrom,
    date_to: dateTo,
    amount_min: amountMin,
    amount_max: amountMax,
    vat_mode: vatMode,
  };
}

export function isMockQuotationId(quotationId) {
  return mockQuotations.some((quotation) => `${quotation.id}` === `${quotationId}`);
}

export function removeMockQuotationId(quotation) {
  if (!isMockQuotationId(quotation?.id)) {
    return quotation;
  }

  const { id, ...quotationPayload } = quotation;
  return quotationPayload;
}

export function mergeSavedQuotation(currentRows, sourceQuotation, savedQuotation, wasUpdate) {
  if (wasUpdate) {
    return currentRows.map((row) =>
      `${row.id}` === `${savedQuotation.id}` ? savedQuotation : row
    );
  }

  const shouldKeepSourceQuotation = isMockQuotationId(sourceQuotation?.id);

  return [
    savedQuotation,
    ...currentRows.filter(
      (row) =>
        (shouldKeepSourceQuotation || `${row.id}` !== `${sourceQuotation.id}`) &&
        `${row.id}` !== `${savedQuotation.id}`
    ),
  ];
}

export function mergeQuotationRowsWithMocks(quotationRows = [], includeMocks = true) {
  if (!includeMocks) {
    return quotationRows;
  }

  const realIds = new Set(quotationRows.map((quotation) => `${quotation.id}`));
  const visibleMocks = mockQuotations.filter(
    (quotation) => !realIds.has(`${quotation.id}`)
  );

  return [...quotationRows, ...visibleMocks];
}

function buildTransactionFormData(record, fields) {
  const formData = new FormData();

  fields.forEach((field) => {
    if (record[field] !== undefined) {
      formData.append(field, record[field] ?? "");
    }
  });

  formData.append("items", JSON.stringify(record.items || []));
  formData.append("vat_mode", record.vat_mode || "not_included");
  formData.append("bill_discount", record.bill_discount ?? record.billDiscount ?? 0);
  formData.append("total_before_vat", record.total_before_vat ?? 0);
  formData.append("vat_amount", record.vat_amount ?? 0);
  formData.append("grand_total", record.grand_total ?? record.total_amount ?? 0);

  (record.new_documents || []).forEach((document) => {
    if (document instanceof File) {
      formData.append("documents", document);
    }
  });

  if (record.document instanceof File) {
    formData.append("documents", record.document);
  }

  if (record.remove_document) {
    formData.append("remove_document", "true");
  }

  if (record.remove_document_ids?.length) {
    formData.append("remove_document_ids", JSON.stringify(record.remove_document_ids));
  }

  return formData;
}

export function buildPurchaseUpdatePayload(purchase) {
  return buildTransactionFormData(purchase, [
    "reference_no",
    "supplier_name",
    "supplier_tax_invoice",
    "status",
    "transaction_date",
    "payment_term_type",
    "payment_term_days",
    "payment_date",
    "note",
  ]);
}

export function buildSaleUpdatePayload(sale) {
  return buildTransactionFormData(sale, [
    "reference_no",
    "customer_name",
    "customer_po_reference",
    "status",
    "payment_term_type",
    "payment_term_days",
    "payment_date",
    "transaction_date",
    "note",
  ]);
}

export function buildBillingNotePayload(billingNote) {
  return {
    reference_no: billingNote.reference_no || "",
    customer_name: billingNote.customer_name || "",
    billing_note_date: billingNote.billing_note_date || null,
    expected_payment_date: billingNote.expected_payment_date || null,
    actual_payment_date: billingNote.actual_payment_date || null,
    status: billingNote.status || "issued",
    bank_reference: billingNote.bank_reference || "",
    note: billingNote.note || "",
    lines: (billingNote.lines || []).map((line) => ({
      sale: line.sale,
      received: !!line.received,
      received_date: line.received_date || null,
      amount: line.amount,
    })),
  };
}

export function buildPaymentBatchPayload(paymentBatch) {
  return {
    reference_no: paymentBatch.reference_no || "",
    supplier_name: paymentBatch.supplier_name || "",
    batch_date: paymentBatch.batch_date || null,
    planned_payment_date: paymentBatch.planned_payment_date || null,
    actual_payment_date: paymentBatch.actual_payment_date || null,
    status: paymentBatch.status || "scheduled",
    bank_reference: paymentBatch.bank_reference || "",
    note: paymentBatch.note || "",
    lines: (paymentBatch.lines || []).map((line) => ({
      purchase: line.purchase,
      paid: !!line.paid,
      paid_date: line.paid_date || null,
      amount: line.amount,
    })),
  };
}

export function buildCreditNotePayload(creditNote) {
  return {
    reference_no: creditNote.reference_no || "",
    customer_name: creditNote.customer_name || "",
    sale: creditNote.sale || null,
    billing_note: creditNote.billing_note || null,
    credit_note_date: creditNote.credit_note_date || null,
    status: creditNote.status || "issued",
    note: creditNote.note || "",
    lines: (creditNote.lines || []).map((line) => ({
      sale_item: line.sale_item || null,
      product_name: line.product_name || "",
      sku: line.sku || "",
      quantity: line.quantity,
      unit_price: line.unit_price,
      amount: line.amount,
    })),
  };
}

export function countCancelledSaleItems(sale) {
  return (sale?.items || []).filter(
    (item) => item.item_status === "cancelled" || item.item_status === "returned"
  )
    .length;
}

export function getCreditedSaleItemIds(creditNotes = []) {
  const credited = new Set();
  (creditNotes || []).forEach((note) => {
    if (note.status === "cancelled") {
      return;
    }
    (note.lines || []).forEach((line) => {
      if (line.sale_item) {
        credited.add(line.sale_item);
      }
    });
  });
  return credited;
}

export function findUncreditedCancelledSaleLines(sale, creditNotes = []) {
  const credited = getCreditedSaleItemIds(creditNotes);
  return (sale?.items || [])
    .filter(
      (item) =>
        (item.item_status === "cancelled" || item.item_status === "returned") &&
        item.id !== undefined &&
        item.id !== null &&
        !credited.has(item.id)
    )
    .map((item) => ({
      sale_item: item.id,
      product_name: item.product_name,
      sku: item.sku,
      quantity: item.quantity,
      unit_price: item.unit_price,
      amount: item.amount,
    }));
}

export function countPendingCreditNoteLines(eligibleSales = []) {
  return (eligibleSales || []).reduce(
    (sum, sale) => sum + (sale.cancelled_lines || []).length,
    0
  );
}
