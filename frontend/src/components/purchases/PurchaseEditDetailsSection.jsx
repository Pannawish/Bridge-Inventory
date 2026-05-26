import { useLanguage } from "../../i18n/LanguageContext";
import { getStatusLabel } from "../../i18n/statusLabels";
import { purchaseStatuses } from "../../purchaseStatus";

function PurchaseEditDetailsSection({
  form,
  supplierQuery,
  supplierOpen,
  supplierError,
  filteredSuppliers,
  visibleDocuments,
  onUpdateForm,
  onSupplierQueryChange,
  onSupplierOpen,
  onSupplierClose,
  onSelectSupplier,
  onAddDocuments,
  onDeleteVisibleDocument,
  onRemoveNewDocument,
  onRemoveAllDocuments,
  onUndoRemoveDocuments,
}) {
  const { t } = useLanguage();

  return (
    <div className="form-grid">
      <label>
        {t("purchaseForm.referenceLabel")}
        <input
          value={form.reference_no}
          onChange={(event) => onUpdateForm("reference_no", event.target.value)}
          placeholder={t("purchaseForm.referencePlaceholder")}
        />
      </label>

      <label className="supplier-combobox-field">
        <span className="required-label">{t("purchaseForm.supplierNameLabel")}</span>
        <div className="supplier-combobox">
          <input
            value={supplierQuery}
            onChange={(event) => onSupplierQueryChange(event.target.value)}
            onFocus={onSupplierOpen}
            onBlur={onSupplierClose}
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
                      onSelectSupplier(supplier);
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
          onChange={(event) => onUpdateForm("supplier_tax_invoice", event.target.value)}
          placeholder={t("purchaseForm.taxInvoicePlaceholder")}
        />
      </label>

      <label>
        <span className="required-label">{t("purchaseForm.statusLabel")}</span>
        <select value={form.status} onChange={(event) => onUpdateForm("status", event.target.value)}>
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
          onChange={(event) => onUpdateForm("transaction_date", event.target.value)}
        />
      </label>

      <label className="full-width">
        {t("purchaseForm.noteLabel")}
        <textarea
          rows="3"
          value={form.note}
          onChange={(event) => onUpdateForm("note", event.target.value)}
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
              onChange={(event) => onAddDocuments(Array.from(event.target.files || []))}
            />
          </label>
        </div>

        {visibleDocuments.length || form.new_documents.length ? (
          <>
            <div className="transaction-document-list">
              {visibleDocuments.map((document) => (
                <span className="transaction-document-row" key={document.id}>
                  <a href={document.url} target="_blank" rel="noreferrer">
                    {document.name}
                  </a>
                  <button
                    className="text-danger-button"
                    type="button"
                    onClick={() => onDeleteVisibleDocument(document.id)}
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
                    onClick={() => onRemoveNewDocument(index)}
                  >
                    {t("purchaseForm.documentRemove")}
                  </button>
                </span>
              ))}
            </div>
            <div className="transaction-document-actions">
              <button className="secondary-button" type="button" onClick={onRemoveAllDocuments}>
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
            <button className="secondary-button" type="button" onClick={onUndoRemoveDocuments}>
              {t("purchaseForm.documentUndo")}
            </button>
          </div>
        ) : (
          <p className="transaction-document-empty">{t("purchaseForm.documentsEmpty")}</p>
        )}
      </div>
    </div>
  );
}

export default PurchaseEditDetailsSection;
