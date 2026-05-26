import { FilterPresets, ActiveFilterChips } from "./FilterControls";
import CustomerDirectorySection from "./customers/CustomerDirectorySection";
import CustomerEditorModal from "./customers/CustomerEditorModal";
import { useCustomerPageState } from "./customers/useCustomerPageState";
import { CUSTOMER_PROFILE_OPTIONS, getDefaultCustomers } from "./customers/customerUtils";

// Keep stable public exports for backwards-compatibility
export { getDefaultCustomers } from "./customers/customerUtils";

function CustomerPage({
  customers = getDefaultCustomers(),
  allCustomers = customers,
  pagination = null,
  onPageRequest,
  onSaveCustomer,
  onDeleteCustomer,
}) {
  const {
    selectedCustomerId,
    draftCustomer,
    searchTerm,
    filterOpen,
    profileFilter,
    showAllRows,
    formErrors,
    isServerPaginated,
    activeFilterCount,
    filteredCustomers,
    shouldShowViewAll,
    isCompact,
    totalCustomerCount,
    quickPresets,
    activeChips,
    setSearchTerm,
    setFilterOpen,
    setProfileFilter,
    setShowAllRows,
    setFormErrors,
    openCustomerEditor,
    closeCustomerEditor,
    updateDraftCustomer,
    updateTextField,
    updateOptionIndex,
    updateOptionValue,
    addOption,
    deleteOption,
    handleCreateCustomer,
    handleSaveCustomer,
    handleDeleteCustomer,
    getPageRequestParams,
    t,
  } = useCustomerPageState({
    customers,
    allCustomers,
    pagination,
    onPageRequest,
    onSaveCustomer,
    onDeleteCustomer,
  });

  return (
    <div className="stack-layout">
      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("customer.eyebrow")}</p>
            <h3>{t("customer.findTitle")}</h3>
          </div>
        </div>

        <div className="supplier-directory-toolbar">
          <label className="stock-search supplier-search">
            <span className="stock-search-icon">S</span>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={t("customer.searchPlaceholder")}
            />
          </label>
          <div className="stock-report-summary supplier-search-meta">
            <span>
              {isServerPaginated
                ? t("customer.pageCountServer", {
                    count: filteredCustomers.length,
                    total: totalCustomerCount,
                  })
                : t("customer.pageCountLocal", {
                    count: filteredCustomers.length,
                    total: customers.length,
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
                <span className="history-filter-title">{t("customer.profileFilter")}</span>
                <select
                  value={profileFilter}
                  onChange={(event) => setProfileFilter(event.target.value)}
                >
                  <option value="all">{t("customer.allCustomers")}</option>
                  {CUSTOMER_PROFILE_OPTIONS.map((option) => (
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

      <CustomerDirectorySection
        filteredCustomers={filteredCustomers}
        selectedCustomerId={selectedCustomerId}
        isCompact={isCompact}
        shouldShowViewAll={shouldShowViewAll}
        showAllRows={showAllRows}
        pagination={pagination}
        onOpenCustomerEditor={openCustomerEditor}
        onCreateCustomer={handleCreateCustomer}
        onToggleShowAllRows={() => setShowAllRows((currentValue) => !currentValue)}
        onPageChange={(page) => onPageRequest?.(getPageRequestParams(page))}
      />

      {draftCustomer ? (
        <CustomerEditorModal
          draftCustomer={draftCustomer}
          formErrors={formErrors}
          onClose={closeCustomerEditor}
          onSave={handleSaveCustomer}
          onDelete={handleDeleteCustomer}
          onUpdateTextField={updateTextField}
          onUpdateDraftCustomer={updateDraftCustomer}
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

export default CustomerPage;
