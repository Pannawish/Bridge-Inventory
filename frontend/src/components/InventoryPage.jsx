import { useEffect, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import InventoryDirectorySection from "./inventory/InventoryDirectorySection";
import InventoryControlBoard from "./inventory/InventoryControlBoard";
import InventoryReferenceModal from "./inventory/InventoryReferenceModal";
import useInventoryDirectoryFilters from "../hooks/useInventoryDirectoryFilters";

function InventoryPage({ dashboard, billingNotes = [], paymentBatches = [], onNavigate }) {
  const { t } = useLanguage();
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [referenceOpen, setReferenceOpen] = useState(false);
  const {
    search,
    setSearch,
    filterOpen,
    setFilterOpen,
    healthSet,
    setHealthSet,
    movementSet,
    setMovementSet,
    categoryFilter,
    setCategoryFilter,
    supplierFilter,
    setSupplierFilter,
    valueMin,
    setValueMin,
    valueMax,
    setValueMax,
    daysWithin,
    setDaysWithin,
    needsReorderOnly,
    setNeedsReorderOnly,
    sortKey,
    setSortKey,
    stockReport,
    categoryOptions,
    supplierFilterOptions,
    filteredRows,
    activeFilterCount,
    quickPresets,
    activeChips,
    resetFilters,
  } = useInventoryDirectoryFilters({
    dashboard,
    t,
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    function handleScroll() {
      setShowScrollTop(window.scrollY > 320);
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  function scrollToTop() {
    if (typeof window === "undefined") {
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="stack-layout inventory-page">
      <InventoryControlBoard
        dashboard={dashboard}
        billingNotes={billingNotes}
        paymentBatches={paymentBatches}
        onNavigate={onNavigate}
        onOpenReference={() => setReferenceOpen(true)}
      />

      <InventoryDirectorySection
        search={search}
        onSearchChange={setSearch}
        stockReportCount={stockReport.length}
        filteredRows={filteredRows}
        filterOpen={filterOpen}
        onToggleFilterOpen={() => setFilterOpen((value) => !value)}
        activeFilterCount={activeFilterCount}
        sortKey={sortKey}
        onSortKeyChange={setSortKey}
        quickPresets={quickPresets}
        activeChips={activeChips}
        onResetFilters={resetFilters}
        healthSet={healthSet}
        setHealthSet={setHealthSet}
        movementSet={movementSet}
        setMovementSet={setMovementSet}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={setCategoryFilter}
        categoryOptions={categoryOptions}
        supplierFilter={supplierFilter}
        onSupplierFilterChange={setSupplierFilter}
        supplierFilterOptions={supplierFilterOptions}
        daysWithin={daysWithin}
        onDaysWithinChange={setDaysWithin}
        needsReorderOnly={needsReorderOnly}
        onToggleNeedsReorderOnly={() => setNeedsReorderOnly((value) => !value)}
        valueMin={valueMin}
        onValueMinChange={setValueMin}
        valueMax={valueMax}
        onValueMaxChange={setValueMax}
        onCloseFilters={() => setFilterOpen(false)}
      />

      {referenceOpen ? <InventoryReferenceModal onClose={() => setReferenceOpen(false)} /> : null}
      {showScrollTop ? (
        <button
          type="button"
          className="inv-scroll-top-button"
          onClick={scrollToTop}
          aria-label={t("inventory.backToTop")}
          title={t("inventory.backToTop")}
        >
          <span aria-hidden="true">↑</span>
          {t("inventory.backToTop")}
        </button>
      ) : null}
    </div>
  );
}

export default InventoryPage;
