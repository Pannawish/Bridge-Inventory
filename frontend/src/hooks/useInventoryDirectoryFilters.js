import { useMemo, useState } from "react";
import { withinRange } from "../components/FilterControls";
import {
  buildMovementClassifier,
  getBuyQuantity,
  getHealth,
  getStockValue,
  getSupplierOptions,
  sortRows,
  toggleInSet,
} from "../components/inventory/inventoryUtils";

function useInventoryDirectoryFilters({ dashboard, t }) {
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [healthSet, setHealthSet] = useState(() => new Set());
  const [movementSet, setMovementSet] = useState(() => new Set());
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [valueMin, setValueMin] = useState("");
  const [valueMax, setValueMax] = useState("");
  const [daysWithin, setDaysWithin] = useState("all");
  const [needsReorderOnly, setNeedsReorderOnly] = useState(false);
  const [sortKey, setSortKey] = useState("priority");

  const stockReport = useMemo(
    () => (Array.isArray(dashboard?.stock_report) ? dashboard.stock_report : []),
    [dashboard]
  );

  const classifyMovement = useMemo(
    () => buildMovementClassifier(stockReport),
    [stockReport]
  );

  const decoratedRows = useMemo(
    () =>
      stockReport.map((row) => ({
        row,
        health: getHealth(row),
        movement: classifyMovement(row),
      })),
    [stockReport, classifyMovement]
  );

  const categoryOptions = useMemo(() => {
    const set = new Set(
      stockReport.map((row) => `${row.category ?? ""}`.trim()).filter(Boolean)
    );
    return Array.from(set).sort((left, right) => left.localeCompare(right));
  }, [stockReport]);

  const supplierFilterOptions = useMemo(() => {
    const set = new Set();
    stockReport.forEach((row) => {
      getSupplierOptions(row).forEach((option) => {
        if (option.supplier_name) {
          set.add(option.supplier_name);
        }
      });
    });
    return Array.from(set).sort((left, right) => left.localeCompare(right));
  }, [stockReport]);

  const summary = useMemo(() => {
    let inventoryValue = 0;
    let attention = 0;
    let approaching = 0;
    let deadCount = 0;
    let deadValue = 0;
    decoratedRows.forEach(({ row, health }) => {
      inventoryValue += getStockValue(row);
      if (health === "low") attention += 1;
      if (health === "watch") approaching += 1;
      if (health === "dead") {
        deadCount += 1;
        deadValue += getStockValue(row);
      }
    });
    return { inventoryValue, attention, approaching, deadCount, deadValue };
  }, [decoratedRows]);

  const movementCounts = useMemo(
    () =>
      decoratedRows.reduce(
        (counts, { movement }) => {
          counts[movement] = (counts[movement] || 0) + 1;
          return counts;
        },
        { fast: 0, slow: 0, dead: 0 }
      ),
    [decoratedRows]
  );

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const daysLimit = daysWithin === "all" ? null : Number(daysWithin);
    const matches = decoratedRows.filter(({ row, health, movement }) => {
      if (healthSet.size && !healthSet.has(health)) return false;
      if (movementSet.size && !movementSet.has(movement)) return false;
      if (categoryFilter !== "all" && `${row.category ?? ""}`.trim() !== categoryFilter) {
        return false;
      }
      if (
        supplierFilter !== "all" &&
        !getSupplierOptions(row).some((option) => option.supplier_name === supplierFilter)
      ) {
        return false;
      }
      if ((valueMin || valueMax) && !withinRange(getStockValue(row), valueMin, valueMax)) {
        return false;
      }
      if (daysLimit !== null) {
        const days = row.days_until_stockout;
        if (days === null || days === undefined || days > daysLimit) return false;
      }
      if (needsReorderOnly && getBuyQuantity(row) <= 0) return false;
      if (!normalizedSearch) return true;

      const haystack = [
        row.product_name,
        row.sku,
        row.category,
        ...getSupplierOptions(row).map((option) => option.supplier_name),
      ]
        .map((value) => `${value ?? ""}`.toLowerCase())
        .join(" ");
      return haystack.includes(normalizedSearch);
    });

    return sortRows(
      matches.map((entry) => entry.row),
      sortKey
    ).map((row) => ({
      row,
      health: getHealth(row),
      movement: classifyMovement(row),
    }));
  }, [
    decoratedRows,
    search,
    healthSet,
    movementSet,
    categoryFilter,
    supplierFilter,
    valueMin,
    valueMax,
    daysWithin,
    needsReorderOnly,
    sortKey,
    classifyMovement,
  ]);

  const activeFilterCount =
    (healthSet.size ? 1 : 0) +
    (movementSet.size ? 1 : 0) +
    (categoryFilter !== "all" ? 1 : 0) +
    (supplierFilter !== "all" ? 1 : 0) +
    (valueMin || valueMax ? 1 : 0) +
    (daysWithin !== "all" ? 1 : 0) +
    (needsReorderOnly ? 1 : 0);

  const quickPresets = [
    {
      key: "needs",
      label: t("inventory.filters.presetNeedsReorder"),
      active: needsReorderOnly,
      onClick: () => setNeedsReorderOnly((value) => !value),
    },
    {
      key: "low",
      label: t("inventory.health.low"),
      active: healthSet.has("low"),
      onClick: () => toggleInSet(setHealthSet, "low"),
    },
    {
      key: "dead",
      label: t("inventory.health.dead"),
      active: healthSet.has("dead"),
      onClick: () => toggleInSet(setHealthSet, "dead"),
    },
    {
      key: "fast",
      label: t("inventory.filters.presetFastMovers"),
      active: movementSet.has("fast"),
      onClick: () => toggleInSet(setMovementSet, "fast"),
    },
  ];

  const activeChips = [];
  healthSet.forEach((value) =>
    activeChips.push({
      key: `health-${value}`,
      label: t(`inventory.health.${value}`),
      onRemove: () => toggleInSet(setHealthSet, value),
    })
  );
  movementSet.forEach((value) =>
    activeChips.push({
      key: `movement-${value}`,
      label: t(`inventory.movement.${value}`),
      onRemove: () => toggleInSet(setMovementSet, value),
    })
  );
  if (categoryFilter !== "all") {
    activeChips.push({
      key: "category",
      label: t("inventory.filters.chipCategory", { value: categoryFilter }),
      onRemove: () => setCategoryFilter("all"),
    });
  }
  if (supplierFilter !== "all") {
    activeChips.push({
      key: "supplier",
      label: t("inventory.filters.chipSupplier", { value: supplierFilter }),
      onRemove: () => setSupplierFilter("all"),
    });
  }
  if (valueMin && valueMax) {
    activeChips.push({
      key: "value",
      label: t("inventory.filters.chipValueRange", { min: valueMin, max: valueMax }),
      onRemove: () => {
        setValueMin("");
        setValueMax("");
      },
    });
  } else if (valueMin) {
    activeChips.push({
      key: "value",
      label: t("inventory.filters.chipValueMin", { min: valueMin }),
      onRemove: () => setValueMin(""),
    });
  } else if (valueMax) {
    activeChips.push({
      key: "value",
      label: t("inventory.filters.chipValueMax", { max: valueMax }),
      onRemove: () => setValueMax(""),
    });
  }
  if (daysWithin !== "all") {
    activeChips.push({
      key: "days",
      label: t("inventory.filters.chipDays", { days: daysWithin }),
      onRemove: () => setDaysWithin("all"),
    });
  }
  if (needsReorderOnly) {
    activeChips.push({
      key: "reorder",
      label: t("inventory.filters.chipNeedsReorder"),
      onRemove: () => setNeedsReorderOnly(false),
    });
  }

  function resetFilters() {
    setSearch("");
    setHealthSet(new Set());
    setMovementSet(new Set());
    setCategoryFilter("all");
    setSupplierFilter("all");
    setValueMin("");
    setValueMax("");
    setDaysWithin("all");
    setNeedsReorderOnly(false);
  }

  return {
    search,
    setSearch,
    filterOpen,
    setFilterOpen,
    healthSet,
    movementSet,
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
    summary,
    movementCounts,
    filteredRows,
    activeFilterCount,
    quickPresets,
    activeChips,
    resetFilters,
    setHealthSet,
    setMovementSet,
  };
}

export default useInventoryDirectoryFilters;
