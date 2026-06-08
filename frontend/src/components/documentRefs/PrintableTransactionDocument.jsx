import DocumentRefContent from "./DocumentRefContent";

function PrintableTransactionDocument({
  config,
  doc,
  referenceNo,
  printedAt,
  t,
}) {
  return (
    <main className="print-shell">
      <header className="print-header">
        <div>
          <p className="print-brand">Bridge Inventory</p>
          <h1>{config.label}</h1>
          <p className="print-reference">{referenceNo || doc.reference_no || doc.id || "—"}</p>
        </div>
        <div className="print-meta">
          <p>{t("documentRef.printedAt")}</p>
          <strong>{printedAt}</strong>
        </div>
      </header>

      <DocumentRefContent config={config} doc={doc} t={t} printMode />
    </main>
  );
}

export default PrintableTransactionDocument;
