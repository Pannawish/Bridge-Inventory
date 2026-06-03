import { useMemo } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import TransactionDocumentsPanel from "../transactions/TransactionDocumentsPanel";
import { getFilteredCustomers } from "./salesFormUtils";

function SalesFormDetailsSection({
  form,
  nextReferenceNo,
  customers,
  customerQuery,
  customerOpen,
  customerError,
  statusError,
  saleStockMessage,
  paymentDate,
  onUpdateForm,
  onCustomerQueryChange,
  onCustomerOpen,
  onCustomerClose,
  onSelectCustomer,
  onPaymentTermTypeChange,
  onPaymentTermDaysChange,
  onStatusChange,
  onDocumentsAdd,
  onDocumentRemove,
}) {
  const { t } = useLanguage();
  const filteredCustomers = useMemo(
    () => getFilteredCustomers(customers, customerQuery),
    [customerQuery, customers]
  );

  return (
    <div className="form-grid">
      <label>
        {t("salesForm.referenceLabel")}
        <input
          value={form.reference_no}
          readOnly
          placeholder={nextReferenceNo}
        />
      </label>

      <label className="supplier-combobox-field">
        <span className="required-label">{t("salesForm.customerNameLabel")}</span>
        <div className="supplier-combobox">
          <input
            value={customerQuery}
            onChange={(event) => onCustomerQueryChange(event.target.value)}
            onFocus={onCustomerOpen}
            onBlur={onCustomerClose}
            placeholder={t("salesForm.searchCustomerPlaceholder")}
            autoComplete="off"
            aria-expanded={customerOpen}
            aria-controls="sales-customer-list"
            aria-invalid={customerError ? "true" : "false"}
          />

          {customerOpen ? (
            <div className="supplier-combobox-menu" id="sales-customer-list" role="listbox">
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
                <div className="supplier-combobox-empty">
                  {t("salesForm.noCustomerFound")}
                </div>
              )}
            </div>
          ) : null}
        </div>
        {customerError ? <span className="field-error-text">{customerError}</span> : null}
      </label>

      <label>
        {t("salesForm.paymentTermLabel")}
        <select
          value={form.payment_term_type}
          onChange={(event) => onPaymentTermTypeChange(event.target.value)}
        >
          <option value="">{t("purchaseForm.paymentTermPlaceholder")}</option>
          <option value="cash">{t("salesForm.paymentTermDebit")}</option>
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
        <span className="required-label">{t("salesForm.statusLabel")}</span>
        <select
          value={form.status}
          onChange={(event) => onStatusChange(event.target.value)}
        >
          <option value="draft">{t("common.statusLabels.draft")}</option>
          <option value="packed">{t("common.statusLabels.packed")}</option>
          <option value="shipped">{t("common.statusLabels.shipped")}</option>
          <option value="delivered">{t("common.statusLabels.delivered")}</option>
          <option value="cancelled">{t("common.statusLabels.cancelled")}</option>
          <option value="returned">{t("common.statusLabels.returned")}</option>
        </select>
        {statusError || saleStockMessage ? (
          <span className="field-error-text">{statusError || saleStockMessage}</span>
        ) : null}
      </label>

      <label>
        <span className="required-label">{t("salesForm.dateLabel")}</span>
        <input
          type="date"
          value={form.transaction_date}
          onChange={(event) => onUpdateForm("transaction_date", event.target.value)}
        />
      </label>

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
        <textarea
          rows="3"
          value={form.note}
          onChange={(event) => onUpdateForm("note", event.target.value)}
        />
      </label>

      <TransactionDocumentsPanel
        documentLabelKey="salesForm.documentsLabel"
        summaryCountKey="salesForm.documentsSelected"
        summaryEmptyKey="salesForm.noDocumentsSelected"
        addFilesLabelKey="salesForm.documentsAddFiles"
        emptyMessageKey="salesForm.documentsEmpty"
        pendingDocuments={form.documents}
        removePendingLabelKey="salesForm.documentRemove"
        onAddDocuments={onDocumentsAdd}
        onRemovePendingDocument={onDocumentRemove}
      />
    </div>
  );
}

export default SalesFormDetailsSection;
