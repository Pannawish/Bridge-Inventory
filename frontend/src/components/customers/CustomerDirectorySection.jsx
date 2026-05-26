import PaginationControls from "../PaginationControls";
import { useLanguage } from "../../i18n/LanguageContext";
import { getSelectedValue } from "./customerUtils";

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
    <section className="section-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("customer.historyEyebrow")}</p>
          <h3>{t("customer.historyTitle")}</h3>
        </div>
        <div className="transaction-table-actions">
          <button className="primary-button" type="button" onClick={onCreateCustomer}>
            {t("customer.newCustomer")}
          </button>
          {shouldShowViewAll ? (
            <button
              className="secondary-button"
              type="button"
              onClick={onToggleShowAllRows}
            >
              {showAllRows ? t("common.showRecent") : t("common.viewMore")}
            </button>
          ) : null}
        </div>
      </div>

      {filteredCustomers.length === 0 ? (
        <p className="empty-copy">{t("customer.noMatch")}</p>
      ) : (
        <div
          className={
            isCompact
              ? "transaction-table-window partner-table-window compact-history"
              : "transaction-table-window partner-table-window"
          }
        >
          <div className="table-scroll desktop-table">
            <table className="transaction-history-table">
              <colgroup>
                <col className="history-col-index" />
                <col className="partner-col-name" />
                <col className="partner-col-contact" />
                <col className="partner-col-location" />
                <col className="partner-col-profile" />
                <col className="history-col-action" />
              </colgroup>
              <thead>
                <tr>
                  <th className="table-index-cell">#</th>
                  <th>{t("customer.colCustomer")}</th>
                  <th>{t("customer.colContact")}</th>
                  <th>{t("customer.colLocation")}</th>
                  <th>{t("customer.colProfile")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((customer, index) => {
                  const isActive = customer.id === selectedCustomerId;

                  return (
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
                          <strong>
                            {getSelectedValue(customer.locations, customer.selectedLocationIndex)}
                          </strong>
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
                          <strong>
                            {getSelectedValue(customer.branches, customer.selectedBranchIndex)}
                          </strong>
                          <span>
                            {customer.remark ||
                              customer.billingNoteDate ||
                              t("customer.noInternalNote")}
                          </span>
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
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mobile-record-list">
            {filteredCustomers.map((customer, index) => (
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
            ))}
          </div>
        </div>
      )}

      <PaginationControls
        pagination={pagination}
        itemLabel={t("customer.historyTitle")}
        onPageChange={onPageChange}
      />
    </section>
  );
}

export default CustomerDirectorySection;
