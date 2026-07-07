// Section component for customer management forms or detail views.

import { useLanguage } from "../../i18n/LanguageContext";
import { getSelectedValue } from "./customerUtils";
import PartnerDirectorySection from "../partners/PartnerDirectorySection";

function CustomerDirectorySection({
  filteredCustomers,
  selectedCustomerId,
  isCompact,
  shouldShowViewAll,
  showAllRows,
  pagination,
  onOpenCustomerEditor,
  onCreateCustomer,
  onToggleShowAllRows,
  onPageChange,
}) {
  const { t } = useLanguage();

  return (
    <PartnerDirectorySection
      rows={filteredCustomers}
      selectedRowId={selectedCustomerId}
      isCompact={isCompact}
      shouldShowViewAll={shouldShowViewAll}
      showAllRows={showAllRows}
      pagination={pagination}
      headingEyebrowKey="customer.historyEyebrow"
      headingTitleKey="customer.historyTitle"
      createButtonKey="customer.newCustomer"
      emptyMessageKey="customer.noMatch"
      onCreate={onCreateCustomer}
      onToggleShowAllRows={onToggleShowAllRows}
      onPageChange={onPageChange}
      getRowId={(customer) => customer.id}
      renderColGroup={() => (
        <colgroup>
          <col className="history-col-index" />
          <col className="partner-col-name" />
          <col className="partner-col-contact" />
          <col className="partner-col-location" />
          <col className="partner-col-profile" />
          <col className="history-col-action" />
        </colgroup>
      )}
      renderTableHead={() => (
        <tr>
          <th className="table-index-cell">#</th>
          <th>{t("customer.colCustomer")}</th>
          <th>{t("customer.colContact")}</th>
          <th>{t("customer.colLocation")}</th>
          <th>{t("customer.colProfile")}</th>
          <th />
        </tr>
      )}
      renderTableRow={({ row: customer, index, isActive }) => (
        <tr
          key={customer.id}
          className={isActive ? "partner-table-row active" : "partner-table-row"}
        >
          <td className="table-index-cell">{index + 1}</td>
          <td>
            <div className="transaction-reference-cell">
              <strong>{customer.companyName || t("customer.unnamedCustomer")}</strong>
              <span>
                {customer.taxpayerId
                  ? t("customer.taxIdLabel", { id: customer.taxpayerId })
                  : t("customer.taxIdNotSet")}
              </span>
            </div>
          </td>
          <td>
            <div className="cell-stack">
              <strong>{getSelectedValue(customer.emails, customer.selectedEmailIndex)}</strong>
              <span>{getSelectedValue(customer.tels, customer.selectedTelIndex)}</span>
            </div>
          </td>
          <td>
            <div className="cell-stack">
              <strong>{getSelectedValue(customer.locations, customer.selectedLocationIndex)}</strong>
              <span>
                {getSelectedValue(
                  customer.shippingAddresses,
                  customer.selectedShippingAddressIndex
                )}
              </span>
            </div>
          </td>
          <td>
            <div className="cell-stack">
              <strong>{getSelectedValue(customer.branches, customer.selectedBranchIndex)}</strong>
              <span>{customer.remark || customer.billingNoteDate || t("customer.noInternalNote")}</span>
            </div>
          </td>
          <td>
            <button
              className="table-action-button"
              type="button"
              onClick={() => onOpenCustomerEditor(customer)}
            >
              {t("common.view")}
            </button>
          </td>
        </tr>
      )}
      renderMobileCard={({ row: customer, index }) => (
        <article className="mobile-record-card" key={`mobile-customer-${customer.id}`}>
          <div className="mobile-record-header">
            <div className="mobile-record-title">
              <span className="mobile-record-index">{index + 1}</span>
              <div className="cell-stack">
                <strong>{customer.companyName || t("customer.unnamedCustomer")}</strong>
                <span>
                  {customer.taxpayerId
                    ? t("customer.taxIdLabel", { id: customer.taxpayerId })
                    : t("customer.taxIdNotSet")}
                </span>
              </div>
            </div>
          </div>

          <div className="mobile-record-grid">
            <div>
              <span>{t("customer.colEmail")}</span>
              <strong>{getSelectedValue(customer.emails, customer.selectedEmailIndex)}</strong>
            </div>
            <div>
              <span>{t("customer.colPhone")}</span>
              <strong>{getSelectedValue(customer.tels, customer.selectedTelIndex)}</strong>
            </div>
            <div>
              <span>{t("customer.colLocation")}</span>
              <strong>{getSelectedValue(customer.locations, customer.selectedLocationIndex)}</strong>
            </div>
            <div>
              <span>{t("customer.colBranch")}</span>
              <strong>{getSelectedValue(customer.branches, customer.selectedBranchIndex)}</strong>
            </div>
          </div>

          <button
            className="secondary-button table-action-button mobile-record-button"
            type="button"
            onClick={() => onOpenCustomerEditor(customer)}
          >
            {t("common.view")}
          </button>
        </article>
      )}
    />
  );
}

export default CustomerDirectorySection;
