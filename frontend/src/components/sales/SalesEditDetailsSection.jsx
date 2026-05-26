import { useLanguage } from "../../i18n/LanguageContext";
import { getStatusLabel } from "../../i18n/statusLabels";
import { statusOptions } from "./salesHistoryUtils";

function SalesEditDetailsSection({
  sale,
  form,
  customerQuery,
  customerOpen,
  customerError,
  filteredCustomers,
  saleStockMessage,
  visibleDocuments,
  paymentDate,
  onUpdateForm,
  onCustomerQueryChange,
  onCustomerOpen,
  onCustomerClose,
  onSelectCustomer,
  onStatusChange,
  onPaymentTermTypeChange,
  onPaymentTermDaysChange,
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
        {t("salesForm.referenceLabel")}
        <input
          value={form.reference_no}
          onChange={(event) => onUpdateForm("reference_no", event.target.value)}
          placeholder={t("salesForm.referencePlaceholder")}
        />
      </label>

      <label className="supplier-combobox-field">
        {t("salesForm.customerNameLabel")}
        <div className="supplier-combobox">
          <input
            value={customerQuery}
            onChange={(event) => onCustomerQueryChange(event.target.value)}
            onFocus={onCustomerOpen}
            onBlur={onCustomerClose}
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
                      onSelectCustomer(customer);
                    }}
                    role="option"
                    aria-selected={customer.companyName === form.customer_name}
                  >
                    {customer.companyName}
                  </button>
                ))
              ) : (
                <div className="supplier-combobox-empty">{t("salesForm.noCustomerFound")}</div>
              )}
            </div>
          ) : null}
        </div>
        {customerError ? <span className="field-error-text">{customerError}</span> : null}
      </label>

      <label>
        {t("salesForm.statusLabel")}
        <select value={form.status} onChange={(event) => onStatusChange(event.target.value)}>
          {statusOptions.map((status) => (
            <option key={status} value={status} disabled={status.startsWith("partially_")}>
              {getStatusLabel(t, status)}
            </option>
          ))}
        </select>
        {saleStockMessage ? <span className="field-error-text">{saleStockMessage}</span> : null}
      </label>

      <label>
        {t("salesForm.dateLabel")}
        <input
          type="date"
          value={form.transaction_date}
          onChange={(event) => onUpdateForm("transaction_date", event.target.value)}
        />
      </label>

      <label>
        {t("salesForm.paymentTermLabel")}
        <select
          value={form.payment_term_type}
          onChange={(event) => onPaymentTermTypeChange(event.target.value)}
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
            onChange={(event) => onPaymentTermDaysChange(event.target.value)}
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
          value={paymentDate}
          readOnly
          placeholder={t("purchaseForm.paymentDatePlaceholder")}
        />
      </label>

      <label>
        {t("salesForm.poReferenceLabel")}
        <input
          value={form.customer_po_reference}
          onChange={(event) => onUpdateForm("customer_po_reference", event.target.value)}
          placeholder={t("salesForm.poReferencePlaceholder")}
        />
      </label>

      <label className="full-width">
        {t("salesForm.noteLabel")}
        <textarea rows="3" value={form.note} onChange={(event) => onUpdateForm("note", event.target.value)} />
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
                    onClick={() => onRemoveNewDocument(index)}
                  >
                    {t("salesForm.documentRemove")}
                  </button>
                </span>
              ))}
            </div>
            <div className="transaction-document-actions">
              <button className="secondary-button" type="button" onClick={onRemoveAllDocuments}>
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
            <button className="secondary-button" type="button" onClick={onUndoRemoveDocuments}>
              {t("purchaseForm.documentUndo")}
            </button>
          </div>
        ) : (
          <p className="transaction-document-empty">{t("salesForm.documentsEmpty")}</p>
        )}
      </div>
    </div>
  );
}

export default SalesEditDetailsSection;
