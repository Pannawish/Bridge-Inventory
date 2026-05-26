import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { withinRange } from "./FilterControls";
import InventoryOverviewSection from "./inventory/InventoryOverviewSection";
import InventoryProductStockRow from "./inventory/InventoryProductStockRow";
import InventoryReferenceModal from "./inventory/InventoryReferenceModal";
import {
  buildMovementClassifier,
  DAYS_OPTIONS,
  formatUnits,
  getBuyQuantity,
  getHealth,
  getStockValue,
  getSupplierOptions,
  HEALTH_KEYS,
  MOVEMENT_KEYS,
  SORT_OPTIONS,
  sortRows,
  toggleInSet,
} from "./inventory/inventoryUtils";

function InventoryPage({ dashboard }) {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [healthSet, setHealthSet] = useState(() => new Set());
  const [movementSet, setMovementSet] = useState(() => new Set());
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [valueMin, setValueMin] = useState("");
  const [valueMax, setValueMax] = useState("");
  const [daysWithin, setDaysWithin] = useState("all");
  const [needsReorderOnly, setNeedsReorderOnly] = useState(false);
  const [sortKey, setSortKey] = useState("priority");
  const [referenceOpen, setReferenceOpen] = useState(false);

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

  const stockReport = useMemo(
    () => (Array.isArray(dashboard?.stock_report) ? dashboard.stock_report : []),
    [dashboard]
  );

  const classifyMovement = useMemo(
    () => buildMovementClassifier(stockReport),
    [stockReport]
  );

  // Decorate every row once with its health + movement so filtering, the KPI
  // summary, and the table all read the same classification.
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

  const movementCounts = useMemo(() => {
    return decoratedRows.reduce(
      (counts, { movement }) => {
        counts[movement] = (counts[movement] || 0) + 1;
        return counts;
      },
      { fast: 0, slow: 0, dead: 0 }
    );
  }, [decoratedRows]);

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

  function scrollToTop() {
    if (typeof window === "undefined") {
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="stack-layout inventory-page">
      <InventoryOverviewSection
        stockReportCount={stockReport.length}
        summary={summary}
        movementCounts={movementCounts}
        onOpenReference={() => setReferenceOpen(true)}
      />

      <section className="section-card">
        <div className="supplier-directory-toolbar">
          <label className="stock-search supplier-search">
            <span className="stock-search-icon">S</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("inventory.searchPlaceholder")}
            />
          </label>
          <div className="stock-report-summary supplier-search-meta">
            <span>
              {t("inventory.shownCount", {
                shown: filteredRows.length,
                total: stockReport.length,
              })}
            </span>
          </div>
        </div>

        <div className="history-filter-actions">
          <button
            className="secondary-button product-filter-toggle"
            type="button"
            aria-expanded={filterOpen}
            onClick={() => setFilterOpen((value) => !value)}
          >
            {t("common.filter")}
            {activeFilterCount ? <span>{activeFilterCount}</span> : null}
          </button>
          <label className="history-filter-field inv-sort-inline">
            <span className="history-filter-title">{t("inventory.sortLabel")}</span>
            <select value={sortKey} onChange={(event) => setSortKey(event.target.value)}>
              {SORT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {t(`inventory.sort.${option}`)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="history-filter-presets">
          <span className="history-filter-presets-label">{t("inventory.filters.quickLabel")}</span>
          {quickPresets.map((preset) => (
            <button
              key={preset.key}
              type="button"
              className={`history-filter-preset${preset.active ? " active" : ""}`}
              aria-pressed={preset.active}
              onClick={preset.onClick}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {activeChips.length ? (
          <div className="history-filter-chipbar">
            {activeChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                className="history-filter-chip"
                onClick={chip.onRemove}
                title={t("inventory.filters.removeFilter")}
              >
                <span className="history-filter-chip-label">{chip.label}</span>
                <span className="history-filter-chip-remove" aria-hidden="true">×</span>
              </button>
            ))}
            <button type="button" className="history-filter-clear-all" onClick={resetFilters}>
              {t("inventory.filters.clearAll")}
            </button>
          </div>
        ) : null}

        {filterOpen ? (
          <div className="history-filter-panel inv-filter-panel">
            <div className="history-filter-grid">
              <div className="history-filter-field">
                <span className="history-filter-title">{t("inventory.filterHealth")}</span>
                <div className="inv-chip-group">
                  {HEALTH_KEYS.map((key) => (
                    <button
                      key={key}
                      type="button"
                      className={`history-filter-preset${healthSet.has(key) ? " active" : ""}`}
                      aria-pressed={healthSet.has(key)}
                      onClick={() => toggleInSet(setHealthSet, key)}
                    >
                      {t(`inventory.health.${key}`)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="history-filter-field">
                <span className="history-filter-title">{t("inventory.filterMovement")}</span>
                <div className="inv-chip-group">
                  {MOVEMENT_KEYS.map((key) => (
                    <button
                      key={key}
                      type="button"
                      className={`history-filter-preset${movementSet.has(key) ? " active" : ""}`}
                      aria-pressed={movementSet.has(key)}
                      onClick={() => toggleInSet(setMovementSet, key)}
                    >
                      {t(`inventory.movement.${key}`)}
                    </button>
                  ))}
                </div>
              </div>

              <label className="history-filter-field">
                <span className="history-filter-title">{t("inventory.filterCategory")}</span>
                <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                  <option value="all">{t("inventory.allCategories")}</option>
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>

              <label className="history-filter-field">
                <span className="history-filter-title">{t("inventory.filters.supplier")}</span>
                <select value={supplierFilter} onChange={(event) => setSupplierFilter(event.target.value)}>
                  <option value="all">{t("inventory.filters.allSuppliers")}</option>
                  {supplierFilterOptions.map((supplier) => (
                    <option key={supplier} value={supplier}>
                      {supplier}
                    </option>
                  ))}
                </select>
              </label>

              <label className="history-filter-field">
                <span className="history-filter-title">{t("inventory.filters.days")}</span>
                <select value={daysWithin} onChange={(event) => setDaysWithin(event.target.value)}>
                  <option value="all">{t("inventory.filters.daysAny")}</option>
                  {DAYS_OPTIONS.map((value) => (
                    <option key={value} value={value}>
                      {t(`inventory.filters.days${value}`)}
                    </option>
                  ))}
                </select>
              </label>

              <div className="history-filter-field">
                <span className="history-filter-title">{t("inventory.filters.reorderNeed")}</span>
                <div className="inv-chip-group">
                  <button
                    type="button"
                    className={`history-filter-preset${needsReorderOnly ? " active" : ""}`}
                    aria-pressed={needsReorderOnly}
                    onClick={() => setNeedsReorderOnly((value) => !value)}
                  >
                    {t("inventory.filters.needsReorderOnly")}
                  </button>
                </div>
              </div>

              <div className="history-filter-field">
                <span className="history-filter-title">{t("inventory.filters.value")}</span>
                <div className="history-filter-range">
                  <span className="history-filter-range-prefix">฿</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    value={valueMin}
                    onChange={(event) => setValueMin(event.target.value)}
                    placeholder={t("inventory.filters.min")}
                  />
                  <span className="history-filter-range-sep">–</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    value={valueMax}
                    onChange={(event) => setValueMax(event.target.value)}
                    placeholder={t("inventory.filters.max")}
                  />
                </div>
              </div>
            </div>

            <div className="history-filter-actions">
              <button className="secondary-button" type="button" onClick={resetFilters}>
                {t("common.reset")}
              </button>
              <button className="primary-button" type="button" onClick={() => setFilterOpen(false)}>
                {t("inventory.filters.done")}
              </button>
            </div>
          </div>
        ) : null}

        {filteredRows.length === 0 ? (
          <p className="empty-copy">{t("inventory.noMatch")}</p>
        ) : (
          <div className="inv-card-list">
            {filteredRows.map(({ row, health, movement }) => (
              <InventoryProductStockRow
                key={row.product_id}
                row={row}
                health={health}
                movement={movement}
              />
            ))}
          </div>
        )}
      </section>

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
