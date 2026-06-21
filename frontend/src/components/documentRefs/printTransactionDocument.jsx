import { renderToStaticMarkup } from "react-dom/server";
import { LanguageProvider } from "../../i18n/LanguageContext";
import { buildDocConfig } from "./documentRefConfig";
import PrintableTransactionDocument from "./PrintableTransactionDocument";

const PRINT_STYLES = `
  :root {
    color-scheme: light;
    font-family: "Helvetica Neue", Arial, sans-serif;
    line-height: 1.4;
    color: #111827;
    background: #ffffff;
  }

  * {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  @page {
    size: A4 portrait;
    margin: 10mm;
  }

  html {
    width: 210mm;
    min-width: 210mm;
    background: #ffffff;
  }

  body {
    margin: 0;
    background: #ffffff;
    color: #111827;
    font-size: 11px;
    width: 190mm;
    min-width: 190mm;
    max-width: 190mm;
  }

  .print-shell {
    width: 190mm;
    min-width: 190mm;
    max-width: 190mm;
    margin: 0 auto;
  }

  .print-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 24px;
    margin-bottom: 20px;
    padding-bottom: 12px;
    border-bottom: 1px solid #d1d5db;
  }

  .print-brand {
    margin: 0 0 4px;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #6b7280;
  }

  .print-header h1 {
    margin: 0;
    font-size: 18px;
    line-height: 1.2;
  }

  .print-reference {
    margin: 4px 0 0;
    font-size: 12px;
    font-weight: 700;
  }

  .print-meta {
    width: 42mm;
    min-width: 42mm;
    text-align: right;
  }

  .print-meta p {
    margin: 0 0 4px;
    font-size: 11px;
    color: #6b7280;
  }

  .print-meta strong {
    font-size: 13px;
  }

  .detail-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 4mm;
    margin-bottom: 4mm;
  }

  .detail-grid > div {
    min-width: 0;
    padding: 3mm 3.5mm;
    border: 1px solid #d1d5db;
  }

  .detail-grid > .full-width {
    grid-column: 1 / -1;
  }

  .detail-label {
    margin: 0 0 6px;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #6b7280;
  }

  .detail-grid strong {
    display: block;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .status-badge {
    display: inline-block;
    padding: 2px 8px;
    border: 1px solid #cbd5e1;
    font-size: 11px;
    font-weight: 700;
    color: #111827;
    background: #f8fafc;
  }

  .detail-items {
    margin-bottom: 4mm;
  }

  .table-scroll {
    overflow: visible;
    width: 190mm;
  }

  .detail-item-table {
    width: 190mm;
    border-collapse: collapse;
    table-layout: fixed;
  }

  .detail-item-table th,
  .detail-item-table td {
    padding: 1.8mm 2.2mm;
    border: 1px solid #d1d5db;
    vertical-align: top;
    text-align: left;
    word-break: break-word;
    overflow-wrap: anywhere;
  }

  .detail-item-table th {
    background: #f3f4f6;
    font-size: 8.5px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .detail-item-table th:first-child,
  .detail-item-table td:first-child {
    width: 8mm;
    text-align: center;
  }

  .detail-item-table tbody tr {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .detail-item-cancelled {
    color: #6b7280;
    background: #f9fafb;
  }

  .detail-item-amount-cancelled {
    text-decoration: line-through;
  }

  .payment-batch-amount-cell {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .payment-batch-original-amount,
  .payment-batch-reason,
  .payment-batch-discrepancy {
    font-size: 10px;
    color: #6b7280;
  }

  .tx-sales-summary {
    margin-left: auto;
    width: 80mm;
    border: 1px solid #d1d5db;
  }

  .tx-summary-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 2.5mm 3mm;
    border-top: 1px solid #e5e7eb;
  }

  .tx-summary-row:first-child {
    border-top: 0;
  }

  .tx-summary-grand {
    background: #f3f4f6;
  }

  .tx-summary-cancelled {
    color: #991b1b;
  }

  .tx-summary-credit span:last-child {
    color: #991b1b;
  }

  .tx-summary-payable {
    background: #eff6ff;
  }

  .doc-ref-modal-related {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 4mm;
    margin-top: 4mm;
  }

  .doc-ref-related-group {
    padding: 3mm 3.5mm;
    border: 1px solid #d1d5db;
  }

  .doc-ref-group-label {
    margin: 0 0 6px;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #6b7280;
  }

  .doc-ref-print-links {
    white-space: pre-wrap;
    word-break: break-word;
  }

  @media screen {
    body {
      width: auto;
      min-width: 0;
      max-width: none;
      padding: 16px;
    }

    .print-shell {
      width: 190mm;
      max-width: calc(100vw - 32px);
      min-width: 0;
    }

    .table-scroll {
      width: 100%;
    }

    .detail-item-table {
      width: 100%;
    }
  }
`;

function escapeHtml(value) {
  return `${value || ""}`
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function printTransactionDocument({
  docType,
  doc,
  referenceNo,
  t,
}) {
  if (typeof window === "undefined" || !doc) {
    return false;
  }

  const config = buildDocConfig(t)[docType];
  if (!config) {
    return false;
  }

  const locale =
    typeof document !== "undefined" && document.documentElement.lang?.startsWith("th")
      ? "th-TH"
      : "en-US";
  const printedAt = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());
  const title = `${config.label} ${referenceNo || doc.reference_no || doc.id || ""}`.trim();
  const markup = renderToStaticMarkup(
    <LanguageProvider>
      <PrintableTransactionDocument
        config={config}
        doc={doc}
        referenceNo={referenceNo}
        printedAt={printedAt}
        t={t}
      />
    </LanguageProvider>
  );
  const printWindow = window.open("", "_blank");

  if (!printWindow) {
    return false;
  }

  function triggerPrint() {
    try {
      printWindow.focus();
      printWindow.print();
    } catch {
      // Let the opened document remain visible so the user can print manually.
    }
  }

  printWindow.onload = () => {
    printWindow.setTimeout(triggerPrint, 250);
  };

  printWindow.document.write(`<!doctype html>
<html lang="${escapeHtml(document.documentElement.lang || "en")}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>${PRINT_STYLES}</style>
  </head>
  <body>
    ${markup}
  </body>
</html>`);
  printWindow.document.close();
  window.setTimeout(triggerPrint, 800);
  return true;
}
