import PaginationControls from "../PaginationControls";
import { useLanguage } from "../../i18n/LanguageContext";

function PartnerDirectorySection({
  rows,
  selectedRowId,
  isCompact,
  shouldShowViewAll,
  showAllRows,
  pagination,
  headingEyebrowKey,
  headingTitleKey,
  createButtonKey,
  emptyMessageKey,
  onCreate,
  onToggleShowAllRows,
  onPageChange,
  getRowId,
  renderColGroup,
  renderTableHead,
  renderTableRow,
  renderMobileCard,
}) {
  const { t } = useLanguage();

  return (
    <section className="section-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t(headingEyebrowKey)}</p>
          <h3>{t(headingTitleKey)}</h3>
        </div>
        <div className="transaction-table-actions">
          <button className="primary-button" type="button" onClick={onCreate}>
            {t(createButtonKey)}
          </button>
          {shouldShowViewAll ? (
            <button className="secondary-button" type="button" onClick={onToggleShowAllRows}>
              {showAllRows ? t("common.showRecent") : t("common.viewMore")}
            </button>
          ) : null}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="empty-copy">{t(emptyMessageKey)}</p>
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
              {renderColGroup?.()}
              <thead>{renderTableHead?.()}</thead>
              <tbody>
                {rows.map((row, index) =>
                  renderTableRow({
                    row,
                    index,
                    isActive: getRowId(row) === selectedRowId,
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="mobile-record-list">
            {rows.map((row, index) =>
              renderMobileCard({
                row,
                index,
                isActive: getRowId(row) === selectedRowId,
              })
            )}
          </div>
        </div>
      )}

      <PaginationControls
        pagination={pagination}
        itemLabel={t(headingTitleKey)}
        onPageChange={onPageChange}
      />
    </section>
  );
}

export default PartnerDirectorySection;
