// Section component for supplier management forms or detail views.

import { useLanguage } from "../../i18n/LanguageContext";
import { getSelectedValue } from "./supplierUtils";
import PartnerDirectorySection from "../partners/PartnerDirectorySection";

function SupplierDirectorySection({
  filteredSuppliers,
  selectedSupplierId,
  isCompact,
  shouldShowViewAll,
  showAllRows,
  pagination,
  onOpenSupplierEditor,
  onCreateSupplier,
  onToggleShowAllRows,
  onPageChange,
}) {
  const { t } = useLanguage();

  return (
    <PartnerDirectorySection
      rows={filteredSuppliers}
      selectedRowId={selectedSupplierId}
      isCompact={isCompact}
      shouldShowViewAll={shouldShowViewAll}
      showAllRows={showAllRows}
      pagination={pagination}
      headingEyebrowKey="supplier.historyEyebrow"
      headingTitleKey="supplier.historyTitle"
      createButtonKey="supplier.newSupplier"
      emptyMessageKey="supplier.noMatch"
      onCreate={onCreateSupplier}
      onToggleShowAllRows={onToggleShowAllRows}
      onPageChange={onPageChange}
      getRowId={(supplier) => supplier.id}
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
          <th>{t("supplier.colSupplier")}</th>
          <th>{t("supplier.colContact")}</th>
          <th>{t("supplier.colLocation")}</th>
          <th>{t("supplier.colProfile")}</th>
          <th />
        </tr>
      )}
      renderTableRow={({ row: supplier, index, isActive }) => (
        <tr
          key={supplier.id}
          className={isActive ? "partner-table-row active" : "partner-table-row"}
        >
          <td className="table-index-cell">{index + 1}</td>
          <td>
            <div className="transaction-reference-cell">
              <strong>{supplier.companyName || t("supplier.unnamedSupplier")}</strong>
              <span>
                {supplier.taxpayerId
                  ? t("supplier.taxIdLabel", { id: supplier.taxpayerId })
                  : t("supplier.taxIdNotSet")}
              </span>
            </div>
          </td>
          <td>
            <div className="cell-stack">
              <strong>{supplier.procurementName || "-"}</strong>
              <span>{supplier.procurementTel || "-"}</span>
            </div>
          </td>
          <td>
            <div className="cell-stack">
              <strong>{getSelectedValue(supplier.locations, supplier.selectedLocationIndex)}</strong>
              <span>
                {getSelectedValue(
                  supplier.shippingAddresses,
                  supplier.selectedShippingAddressIndex
                )}
              </span>
            </div>
          </td>
          <td>
            <div className="cell-stack">
              <strong>{getSelectedValue(supplier.branches, supplier.selectedBranchIndex)}</strong>
              <span>{supplier.remark || supplier.billingNoteDate || t("supplier.noInternalNote")}</span>
            </div>
          </td>
          <td>
            <button
              className="table-action-button"
              type="button"
              onClick={() => onOpenSupplierEditor(supplier)}
            >
              {t("common.view")}
            </button>
          </td>
        </tr>
      )}
      renderMobileCard={({ row: supplier, index }) => (
        <article className="mobile-record-card" key={`mobile-supplier-${supplier.id}`}>
          <div className="mobile-record-header">
            <div className="mobile-record-title">
              <span className="mobile-record-index">{index + 1}</span>
              <div className="cell-stack">
                <strong>{supplier.companyName || t("supplier.unnamedSupplier")}</strong>
                <span>
                  {supplier.taxpayerId
                    ? t("supplier.taxIdLabel", { id: supplier.taxpayerId })
                    : t("supplier.taxIdNotSet")}
                </span>
              </div>
            </div>
          </div>

          <div className="mobile-record-grid">
            <div>
              <span>{t("supplier.colProcurementName")}</span>
              <strong>{supplier.procurementName || "-"}</strong>
            </div>
            <div>
              <span>{t("supplier.colProcurementTel")}</span>
              <strong>{supplier.procurementTel || "-"}</strong>
            </div>
            <div>
              <span>{t("supplier.colLocation")}</span>
              <strong>{getSelectedValue(supplier.locations, supplier.selectedLocationIndex)}</strong>
            </div>
            <div>
              <span>{t("supplier.colBranch")}</span>
              <strong>{getSelectedValue(supplier.branches, supplier.selectedBranchIndex)}</strong>
            </div>
          </div>

          <button
            className="secondary-button table-action-button mobile-record-button"
            type="button"
            onClick={() => onOpenSupplierEditor(supplier)}
          >
            {t("common.view")}
          </button>
        </article>
      )}
    />
  );
}

export default SupplierDirectorySection;
