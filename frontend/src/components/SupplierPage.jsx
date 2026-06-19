import SupplierDirectorySection from "./suppliers/SupplierDirectorySection";
import SupplierEditorModal from "./suppliers/SupplierEditorModal";
import { useSupplierPageState } from "./suppliers/useSupplierPageState";
import { SUPPLIER_PROFILE_OPTIONS, getDefaultSuppliers } from "./suppliers/supplierUtils";
import PartnerPageShell from "./partners/PartnerPageShell";

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
    isDraftSupplierDirty,
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
    resetFilters,
    setSearchTerm,
    setFilterOpen,
    setProfileFilter,
    setShowAllRows,
    setFormErrors,
    openSupplierEditor,
    closeSupplierEditor,
    updateDraftSupplier,
    updateTextField,
    validateTextField,
    updateOptionIndex,
    updateOptionValue,
    validateOptionField,
    addOption,
    deleteOption,
    handleCreateSupplier,
    handleSaveSupplier,
    handleDeleteSupplier,
    getPageRequestParams,
  } = useSupplierPageState({
    suppliers,
    allSuppliers,
    pagination,
    onPageRequest,
    onSaveSupplier,
    onDeleteSupplier,
  });

  return (
    <PartnerPageShell
      entityKey="supplier"
      allProfilesLabelKey="supplier.allSuppliers"
      searchTerm={searchTerm}
      onSearchTermChange={setSearchTerm}
      isServerPaginated={isServerPaginated}
      filteredCount={filteredSuppliers.length}
      totalCount={totalSupplierCount}
      localCount={suppliers.length}
      filterOpen={filterOpen}
      activeFilterCount={activeFilterCount}
      onToggleFilterOpen={() => setFilterOpen((currentValue) => !currentValue)}
      onResetFilters={resetFilters}
      quickPresets={quickPresets}
      activeChips={activeChips}
      profileFilter={profileFilter}
      onProfileFilterChange={setProfileFilter}
      profileOptions={SUPPLIER_PROFILE_OPTIONS}
    >
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
          isDirty={isDraftSupplierDirty}
          onClose={closeSupplierEditor}
          onSave={handleSaveSupplier}
          onDelete={handleDeleteSupplier}
          onUpdateTextField={updateTextField}
          onValidateTextField={validateTextField}
          onUpdateDraftSupplier={updateDraftSupplier}
          onUpdateOptionIndex={updateOptionIndex}
          onUpdateOptionValue={updateOptionValue}
          onValidateOptionField={validateOptionField}
          onAddOption={addOption}
          onDeleteOption={deleteOption}
          onSetFormErrors={setFormErrors}
        />
      ) : null}
    </PartnerPageShell>
  );
}

export default SupplierPage;
