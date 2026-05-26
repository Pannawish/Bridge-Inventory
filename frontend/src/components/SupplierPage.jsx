import { FilterPresets, ActiveFilterChips } from "./FilterControls";
import SupplierDirectorySection from "./suppliers/SupplierDirectorySection";
import SupplierEditorModal from "./suppliers/SupplierEditorModal";
import { useSupplierPageState } from "./suppliers/useSupplierPageState";
import { SUPPLIER_PROFILE_OPTIONS, getDefaultSuppliers } from "./suppliers/supplierUtils";

// Keep stable public exports for backwards-compatibility
export { getDefaultSuppliers } from "./suppliers/supplierUtils";

function SupplierPage({
  suppliers = getDefaultSuppliers(),
  allSuppliers = suppliers,
  pagination = null,
  onPageRequest,
  onSaveSupplier,
  onDeleteSupplier,
}) {
  const {
    selectedSupplierId,
    draftSupplier,
    searchTerm,
    filterOpen,
    profileFilter,
    showAllRows,
    formErrors,
    isServerPaginated,
    activeFilterCount,
    filteredSuppliers,
    shouldShowViewAll,
    isCompact,
    totalSupplierCount,
    quickPresets,
    activeChips,
    setSearchTerm,
    setFilterOpen,
    setProfileFilter,
    setShowAllRows,
    setFormErrors,
    openSupplierEditor,
    closeSupplierEditor,
    updateDraftSupplier,
    updateTextField,
    updateOptionIndex,
    updateOptionValue,
    addOption,
    deleteOption,
    handleCreateSupplier,
    handleSaveSupplier,
    handleDeleteSupplier,
    getPageRequestParams,
    t,
  } = useSupplierPageState({
    suppliers,
    allSuppliers,
    pagination,
    onPageRequest,
    onSaveSupplier,
    onDeleteSupplier,
  });

  return (
    <div className="stack-layout">
      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("supplier.eyebrow")}</p>
            <h3>{t("supplier.findTitle")}</h3>
          </div>
        </div>

        <div className="supplier-directory-toolbar">
          <label className="stock-search supplier-search">
            <span className="stock-search-icon">S</span>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={t("supplier.searchPlaceholder")}
            />
          </label>
          <div className="stock-report-summary supplier-search-meta">
            <span>
              {isServerPaginated
                ? t("supplier.pageCountServer", {
                    count: filteredSuppliers.length,
                    total: totalSupplierCount,
                  })
                : t("supplier.pageCountLocal", {
                    count: filteredSuppliers.length,
                    total: suppliers.length,
                  })}
            </span>
          </div>
        </div>

        <div className="history-filter-actions">
          <button
            className="secondary-button product-filter-toggle"
            type="button"
            aria-expanded={filterOpen}
            onClick={() => setFilterOpen((currentValue) => !currentValue)}
          >
            {t("common.filter")}
            {activeFilterCount ? <span>{activeFilterCount}</span> : null}
          </button>
          <button className="secondary-button" type="button" onClick={() => {
            setSearchTerm("");
            setProfileFilter("all");
            setFilterOpen(false);
          }}>
            {t("common.resetFilter")}
          </button>
        </div>

        <FilterPresets presets={quickPresets} />
        <ActiveFilterChips chips={activeChips} onClearAll={() => {
          setSearchTerm("");
          setProfileFilter("all");
          setFilterOpen(false);
        }} />

        {filterOpen ? (
          <div className="history-filter-panel">
            <div className="history-filter-grid">
              <label className="history-filter-field">
                <span className="history-filter-title">{t("supplier.profileFilter")}</span>
                <select
                  value={profileFilter}
                  onChange={(event) => setProfileFilter(event.target.value)}
                >
                  <option value="all">{t("supplier.allSuppliers")}</option>
                  {SUPPLIER_PROFILE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {t(option.labelKey)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        ) : null}
      </section>

      <SupplierDirectorySection
        filteredSuppliers={filteredSuppliers}
        selectedSupplierId={selectedSupplierId}
        isCompact={isCompact}
        shouldShowViewAll={shouldShowViewAll}
        showAllRows={showAllRows}
        pagination={pagination}
        onOpenSupplierEditor={openSupplierEditor}
        onCreateSupplier={handleCreateSupplier}
        onToggleShowAllRows={() => setShowAllRows((currentValue) => !currentValue)}
        onPageChange={(page) => onPageRequest?.(getPageRequestParams(page))}
      />

      {draftSupplier ? (
        <SupplierEditorModal
          draftSupplier={draftSupplier}
          formErrors={formErrors}
          onClose={closeSupplierEditor}
          onSave={handleSaveSupplier}
          onDelete={handleDeleteSupplier}
          onUpdateTextField={updateTextField}
          onUpdateDraftSupplier={updateDraftSupplier}
          onUpdateOptionIndex={updateOptionIndex}
          onUpdateOptionValue={updateOptionValue}
          onAddOption={addOption}
          onDeleteOption={deleteOption}
          onSetFormErrors={setFormErrors}
        />
      ) : null}
    </div>
  );
}

export default SupplierPage;
