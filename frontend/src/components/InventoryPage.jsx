import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import InventoryDirectorySection from "./inventory/InventoryDirectorySection";
import InventoryControlBoard from "./inventory/InventoryControlBoard";
import InventoryReferenceModal from "./inventory/InventoryReferenceModal";
import InventoryDetailModal from "./inventory/InventoryDetailModal";
import QuickPoDrawer from "./purchase/QuickPoDrawer";
import { getAvailable, getHealth, getReorderLevel } from "./inventory/inventoryUtils";
import useInventoryDirectoryFilters from "../hooks/useInventoryDirectoryFilters";

// Build the items a Purchase-Order prefill expects (same shape the dashboard
// Quick PO hands off), so a reorder raised from the inventory card lands in the
// Purchase form identically to one raised from the dashboard.
function toPrefillItem(row, qty, unitCost) {
  return {
    product_id: row.product_id,
    product_name: row.product_name,
    sku: row.sku || "",
    unit: row.unit || "",
    quantity: qty > 0 ? qty : 1,
    unit_cost: unitCost ?? row.unit_cost ?? row.average_unit_cost ?? "",
  };
}

function InventoryPage({
  dashboard,
  billingNotes = [],
  paymentBatches = [],
  sales = [],
  purchases = [],
  onNavigate,
  focusProductId = null,
  onIntentConsumed,
}) {
  const { t } = useLanguage();
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [referenceOpen, setReferenceOpen] = useState(false);
  const [detailRow, setDetailRow] = useState(null);
  const [quickPoRow, setQuickPoRow] = useState(null);
  const directoryRef = useRef(null);
  const {
    search,
    setSearch,
    filterOpen,
    setFilterOpen,
    healthSet,
    setHealthSet,
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

  // Jump from the Inventory-value drill-down into the manage list, pre-filtered
  // to a single health band and sorted by value, then scroll it into view.
  const applyHealthFilter = (band) => {
    setHealthSet(new Set([band]));
    setSortKey("value");
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        directoryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  };

  // Open the shared Quick PO drawer for a card (Low / Approaching only), deriving
  // the available/reorder figures the drawer reads.
  const handleCreatePo = (row) => {
    setQuickPoRow({
      ...row,
      _available: getAvailable(row),
      _reorder: getReorderLevel(row),
    });
  };

  const handleQuickPoConfirm = ({ vendor, qty, price }) => {
    if (quickPoRow) {
      onNavigate?.({
        tab: "purchase-history",
        prefill: {
          supplier_name: vendor || "",
          items: [toPrefillItem(quickPoRow, qty, price === "" ? quickPoRow.unit_cost : price)],
        },
      });
    }
    setQuickPoRow(null);
  };

  // Deep-link from the dashboard's Popular / Stock-Cycling widgets: open the
  // targeted product's detail straight away, then clear the one-shot intent.
  useEffect(() => {
    if (!focusProductId) {
      return;
    }
    const target = stockReport.find(
      (row) => `${row.product_id}` === `${focusProductId}`
    );
    if (target) {
      setDetailRow({ row: target, health: getHealth(target) });
    }
    onIntentConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusProductId, stockReport]);

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
        onApplyHealthFilter={applyHealthFilter}
        onOpenReference={() => setReferenceOpen(true)}
      />

      <div ref={directoryRef} className="inventory-directory-anchor">
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
        onOpenDetail={setDetailRow}
        onCreatePo={handleCreatePo}
      />
      </div>

      {quickPoRow ? (
        <QuickPoDrawer
          row={quickPoRow}
          onClose={() => setQuickPoRow(null)}
          onConfirm={handleQuickPoConfirm}
        />
      ) : null}

      {detailRow ? (
        <InventoryDetailModal
          row={detailRow.row}
          health={detailRow.health}
          sales={sales}
          purchases={purchases}
          onClose={() => setDetailRow(null)}
        />
      ) : null}

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
