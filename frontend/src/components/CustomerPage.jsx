import CustomerDirectorySection from "./customers/CustomerDirectorySection";
import CustomerEditorModal from "./customers/CustomerEditorModal";
import { useCustomerPageState } from "./customers/useCustomerPageState";
import { CUSTOMER_PROFILE_OPTIONS, getDefaultCustomers } from "./customers/customerUtils";
import PartnerPageShell from "./partners/PartnerPageShell";

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
    isDraftCustomerDirty,
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
    resetFilters,
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
  } = useCustomerPageState({
    customers,
    allCustomers,
    pagination,
    onPageRequest,
    onSaveCustomer,
    onDeleteCustomer,
  });

  return (
    <PartnerPageShell
      entityKey="customer"
      allProfilesLabelKey="customer.allCustomers"
      searchTerm={searchTerm}
      onSearchTermChange={setSearchTerm}
      isServerPaginated={isServerPaginated}
      filteredCount={filteredCustomers.length}
      totalCount={totalCustomerCount}
      localCount={customers.length}
      filterOpen={filterOpen}
      activeFilterCount={activeFilterCount}
      onToggleFilterOpen={() => setFilterOpen((currentValue) => !currentValue)}
      onResetFilters={resetFilters}
      quickPresets={quickPresets}
      activeChips={activeChips}
      profileFilter={profileFilter}
      onProfileFilterChange={setProfileFilter}
      profileOptions={CUSTOMER_PROFILE_OPTIONS}
    >
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
          isDirty={isDraftCustomerDirty}
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
    </PartnerPageShell>
  );
}

export default CustomerPage;
