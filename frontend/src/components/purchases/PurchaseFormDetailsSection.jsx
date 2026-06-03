import { useMemo } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { getStatusLabel } from "../../i18n/statusLabels";
import { purchaseStatuses } from "../../purchaseStatus";
import TransactionDocumentsPanel from "../transactions/TransactionDocumentsPanel";
import { getFilteredSuppliers } from "./purchaseFormUtils";

function PurchaseFormDetailsSection({
  form,
  nextReferenceNo,
  suppliers,
  supplierQuery,
  supplierOpen,
  supplierError,
  paymentDate,
  onUpdateForm,
  onSupplierQueryChange,
  onSupplierOpen,
  onSupplierClose,
  onSelectSupplier,
  onPaymentTermTypeChange,
  onPaymentTermDaysChange,
  onDocumentsAdd,
  onDocumentRemove,
}) {
  const { t } = useLanguage();
  const filteredSuppliers = useMemo(
    () => getFilteredSuppliers(suppliers, supplierQuery),
    [supplierQuery, suppliers]
  );

  return (
    <div className="form-grid">
      <label>
        {t("purchaseForm.referenceLabel")}
        <input
          value={form.reference_no}
          readOnly
          placeholder={nextReferenceNo}
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
            aria-controls="purchase-supplier-list"
            aria-invalid={supplierError ? "true" : "false"}
          />

          {supplierOpen ? (
            <div className="supplier-combobox-menu" id="purchase-supplier-list" role="listbox">
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
        {t("purchaseForm.paymentTermLabel")}
        <select
          value={form.payment_term_type}
          onChange={(event) => onPaymentTermTypeChange(event.target.value)}
        >
          <option value="">{t("purchaseForm.paymentTermPlaceholder")}</option>
          <option value="cash">{t("purchaseForm.paymentTermDebit")}</option>
          <option value="credit">{t("purchaseForm.paymentTermCredit")}</option>
        </select>
      </label>

      {form.payment_term_type === "credit" ? (
        <label>
          {t("purchaseForm.creditTermLabel")}
          <select
            value={form.payment_term_days}
            onChange={(event) => onPaymentTermDaysChange(event.target.value)}
          >
            <option value="">{t("purchaseForm.creditTermPlaceholder")}</option>
            <option value="30 days">{t("purchaseForm.creditTerm30")}</option>
            <option value="60 days">{t("purchaseForm.creditTerm60")}</option>
            <option value="90 days">{t("purchaseForm.creditTerm90")}</option>
          </select>
        </label>
      ) : null}

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
        <select
          value={form.status}
          onChange={(event) => onUpdateForm("status", event.target.value)}
        >
          {purchaseStatuses.map((status) => (
            <option
              key={status}
              value={status}
              disabled={status === "partially_received"}
            >
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

      <label>
        {t("purchaseForm.paymentDateLabel")}
        <input
          type="date"
          value={paymentDate}
          readOnly
          placeholder={t("purchaseForm.paymentDatePlaceholder")}
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

      <TransactionDocumentsPanel
        documentLabelKey="purchaseForm.documentsLabel"
        summaryCountKey="purchaseForm.documentsSelected"
        summaryEmptyKey="purchaseForm.noDocumentsSelected"
        addFilesLabelKey="purchaseForm.documentsAddFiles"
        emptyMessageKey="purchaseForm.documentsEmpty"
        pendingDocuments={form.documents}
        removePendingLabelKey="purchaseForm.documentRemove"
        onAddDocuments={onDocumentsAdd}
        onRemovePendingDocument={onDocumentRemove}
      />
    </div>
  );
}

export default PurchaseFormDetailsSection;
