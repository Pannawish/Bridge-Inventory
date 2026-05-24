import { useEffect, useMemo, useState } from "react";
import { formatMoney as fmt } from "../format";
import { useLanguage } from "../i18n/LanguageContext";
import { withinRange } from "./FilterControls";

// ── Field readers ─────────────────────────────────────────
// The backend stock report is authoritative, but the mock fallback exposes a
// smaller shape, so every read falls back to a sensible derived value.

function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getAvailable(row) {
  return num(row.available_stock ?? row.current_stock);
}

function getDailyDemand(row) {
  if (row.average_daily_demand !== undefined && row.average_daily_demand !== null) {
    return num(row.average_daily_demand);
  }
  return num(row.predicted_7_day_demand) / 7;
}

function getReorderLevel(row) {
  return num(row.reorder_level);
}

function getStockValue(row) {
  if (row.stock_value !== undefined && row.stock_value !== null) {
    return num(row.stock_value);
  }
  return getAvailable(row) * num(row.average_unit_cost ?? row.unit_cost);
}

function getBuyQuantity(row) {
  return num(row.recommended_restock);
}

function getSupplierOptions(row) {
  return Array.isArray(row.supplier_options) ? row.supplier_options : [];
}

// ── Classification ────────────────────────────────────────
// Health mirrors the "Health" rule in the column reference: shortage / demand
// pressure / at-reorder is Low, near-reorder or delayed/pending is Approaching,
// no-sales-but-stocked is Dead, otherwise Healthy.

const WATCH_MULTIPLIER = 1.25;
const HEALTH_ORDER = { low: 0, watch: 1, dead: 2, healthy: 3 };

function getHealth(row) {
  const available = getAvailable(row);
  const reorder = getReorderLevel(row);
  const demand = getDailyDemand(row);
  const oversold = num(row.oversold_units);
  const pendingSales = num(row.pending_sales_units);
  const incomingPo = num(row.incoming_purchase_units ?? row.pending_purchase_units);
  const delayedPo = num(row.delayed_purchase_units);
  const salesHistory = num(row.sales_history_units);

  if (oversold > 0) return "low";
  if (pendingSales > 0 && pendingSales > available + incomingPo) return "low";

  const hasNoSalesSignal = salesHistory <= 0 && demand <= 0 && pendingSales <= 0;
  if (hasNoSalesSignal) return "dead";

  if (reorder > 0 && available <= reorder) return "low";
  if (reorder > 0 && available <= reorder * WATCH_MULTIPLIER) return "watch";
  if (delayedPo > 0 || pendingSales > 0) return "watch";
  return "healthy";
}

function buildMovementClassifier(rows) {
  const sellingDemands = rows.map(getDailyDemand).filter((demand) => demand > 0);
  const averageDemand = sellingDemands.length
    ? sellingDemands.reduce((sum, demand) => sum + demand, 0) / sellingDemands.length
    : 0;

  return (row) => {
    const demand = getDailyDemand(row);
    if (demand <= 0) return "dead";
    return demand >= averageDemand ? "fast" : "slow";
  };
}

const SORT_OPTIONS = ["priority", "demand", "value", "days", "buy"];

function sortRows(rows, sortKey) {
  const copy = [...rows];
  if (sortKey === "demand") {
    copy.sort((a, b) => getDailyDemand(b) - getDailyDemand(a));
  } else if (sortKey === "value") {
    copy.sort((a, b) => getStockValue(b) - getStockValue(a));
  } else if (sortKey === "days") {
    copy.sort((a, b) => {
      const aDays = a.days_until_stockout;
      const bDays = b.days_until_stockout;
      if (aDays === null || aDays === undefined) return 1;
      if (bDays === null || bDays === undefined) return -1;
      return aDays - bDays;
    });
  } else if (sortKey === "buy") {
    copy.sort((a, b) => getBuyQuantity(b) - getBuyQuantity(a));
  } else {
    copy.sort(
      (a, b) =>
        HEALTH_ORDER[getHealth(a)] - HEALTH_ORDER[getHealth(b)] ||
        getBuyQuantity(b) - getBuyQuantity(a)
    );
  }
  return copy;
}

function formatUnits(value) {
  return Number(value || 0).toLocaleString("en-US");
}

function HealthBadge({ health }) {
  const { t } = useLanguage();
  return (
    <span className={`inv-health-badge inv-health-${health}`}>
      <i className="inv-health-dot" aria-hidden="true" />
      {t(`inventory.health.${health}`)}
    </span>
  );
}

function MovementBadge({ movement }) {
  const { t } = useLanguage();
  return (
    <span className={`inv-move-badge inv-move-${movement}`}>
      {t(`inventory.movement.${movement}`)}
    </span>
  );
}

function ReferenceTable({ title, subtitle, rows }) {
  const { t } = useLanguage();
  return (
    <section className="section-card inv-ref-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{title}</p>
          <h4>{subtitle}</h4>
        </div>
      </div>
      <div className="table-scroll">
        <table className="detail-item-table inv-ref-table">
          <thead>
            <tr>
              <th>{t("inventory.refColHeader")}</th>
              <th>{t("inventory.refDescHeader")}</th>
              <th>{t("inventory.refFormulaHeader")}</th>
            </tr>
          </thead>
          <tbody>
            {(Array.isArray(rows) ? rows : []).map((row) => (
              <tr key={row.col}>
                <td><strong>{row.col}</strong></td>
                <td>{row.desc}</td>
                <td className="inv-ref-formula">{row.formula}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function InventoryReferenceModal({ onClose }) {
  const { t } = useLanguage();
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="detail-modal inv-ref-modal section-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inv-ref-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("inventory.refEyebrow")}</p>
            <h3 id="inv-ref-title">{t("inventory.refTitle")}</h3>
            <p className="inv-ref-subtitle">{t("inventory.refSubtitle")}</p>
          </div>
          <button
            type="button"
            className="secondary-button table-action-button"
            onClick={onClose}
          >
            {t("common.close")}
          </button>
        </div>

        <div className="inv-ref-stack">
          <ReferenceTable
            title={t("inventory.refPlanningTitle")}
            subtitle={t("inventory.refPlanningSubtitle")}
            rows={t("inventory.refPlanningRows")}
          />
          <ReferenceTable
            title={t("inventory.refPositionTitle")}
            subtitle={t("inventory.refPositionSubtitle")}
            rows={t("inventory.refPositionRows")}
          />
          <ReferenceTable
            title={t("inventory.refContextTitle")}
            subtitle={t("inventory.refContextSubtitle")}
            rows={t("inventory.refContextRows")}
          />
        </div>
      </div>
    </div>
  );
}

function ProductStockRow({ row, health, movement }) {
  const { t } = useLanguage();
  const unit = row.unit || "";
  const available = getAvailable(row);
  const reorder = getReorderLevel(row);
  const demand = getDailyDemand(row);
  const buy = getBuyQuantity(row);
  const days = row.days_until_stockout;
  const options = getSupplierOptions(row);
  const best = options[0] || null;
  const hasPoint = reorder > 0;
  const belowPoint = hasPoint && available <= reorder;
  const daysText =
    days === null || days === undefined
      ? t("inventory.card.noDemandDays")
      : t("inventory.card.daysLeft", { days: formatUnits(days) });
  const demandText =
    demand > 0 ? formatUnits(Math.round(demand * 100) / 100) : "—";
  const supplierNote = best
    ? options.length > 1
      ? t("inventory.card.moreSuppliers", { count: options.length - 1 })
      : t("inventory.card.onlySupplier")
    : null;

  return (
    <article className={`inv-card inv-card-${health}`}>
      <div className="inv-row-grid">
        <section className="inv-row-section inv-row-product">
          <p className="inv-row-section-label">{t("inventory.colProduct")}</p>
          <div className="inv-card-name">
            <strong>{row.product_name || "—"}</strong>
            <span>
              {(row.sku || "—") + " · " + (row.category || t("inventory.uncategorized"))}
            </span>
          </div>
          <div className="inv-row-badges">
            <HealthBadge health={health} />
            <MovementBadge movement={movement} />
          </div>
        </section>

        <section className="inv-row-section inv-row-stock">
          <p className="inv-row-section-label">{t("inventory.sectionStock")}</p>
          <div className="inv-row-metric">
            <span>{t("inventory.card.onHand")}</span>
            <strong>{t("inventory.unitsValue", { qty: formatUnits(available), unit })}</strong>
          </div>
          <div className="inv-row-metric">
            <span>{t("inventory.card.reorderPoint")}</span>
            <strong>{t("inventory.unitsValue", { qty: formatUnits(reorder), unit })}</strong>
          </div>
          <div className="inv-row-metric">
            <span>{t("inventory.card.suggestedBuy")}</span>
            {buy > 0 ? (
              <strong>{t("inventory.unitsValue", { qty: formatUnits(buy), unit })}</strong>
            ) : (
              <em className="inv-row-value-muted">{t("inventory.card.noBuy")}</em>
            )}
          </div>
          <p className={`inv-row-note ${hasPoint ? (belowPoint ? "is-low" : "is-ok") : ""}`}>
            {hasPoint
              ? belowPoint
                ? t("inventory.card.belowPoint")
                : t("inventory.card.abovePoint")
              : t("inventory.card.noPoint")}
          </p>
          <p className="inv-row-note">
            {t("inventory.card.demandPerDay")}: {demandText} · {daysText}
          </p>
        </section>

        <section className="inv-row-section inv-row-supplier">
          <p className="inv-row-section-label">{t("inventory.sectionSupplier")}</p>
          <div className="inv-row-metric">
            <span>{t("inventory.card.reorderFrom")}</span>
            {best ? (
              <strong>{best.supplier_name}</strong>
            ) : (
              <em className="inv-row-value-muted">{t("inventory.card.noSupplier")}</em>
            )}
          </div>
          <div className="inv-row-metric">
            <span>{t("inventory.card.lastCost")}</span>
            {best ? (
              <strong>
                {t("inventory.card.pricePerUnit", {
                  amount: fmt(best.last_cost),
                  unit: unit || "unit",
                })}
              </strong>
            ) : (
              <em className="inv-row-value-muted">—</em>
            )}
          </div>
          <div className="inv-row-metric">
            <span>{t("inventory.card.stockValue")}</span>
            <strong>{fmt(getStockValue(row))}</strong>
          </div>
          {supplierNote ? <p className="inv-row-note">{supplierNote}</p> : null}
        </section>
      </div>
    </article>
  );
}

const HEALTH_KEYS = ["low", "watch", "healthy", "dead"];
const MOVEMENT_KEYS = ["fast", "slow", "dead"];
const DAYS_OPTIONS = ["7", "14", "30"];

function toggleInSet(setter, value) {
  setter((current) => {
    const next = new Set(current);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    return next;
  });
}

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
      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("inventory.eyebrow")}</p>
            <h3>{t("inventory.title")}</h3>
            <p className="inv-subtitle">{t("inventory.subtitle")}</p>
          </div>
          <button
            type="button"
            className="secondary-button table-action-button"
            onClick={() => setReferenceOpen(true)}
          >
            {t("inventory.formulaReference")}
          </button>
        </div>

        <div className="dashboard-summary-grid">
          <article className="dashboard-kpi-card neutral">
            <p>{t("inventory.kpiValue")}</p>
            <strong>{fmt(summary.inventoryValue)}</strong>
            <span>{t("inventory.kpiValueUnit", { count: stockReport.length })}</span>
          </article>
          <article className="dashboard-kpi-card danger">
            <p>{t("inventory.kpiAttention")}</p>
            <strong>{formatUnits(summary.attention)}</strong>
            <span>{t("inventory.kpiAttentionHelper")}</span>
          </article>
          <article className="dashboard-kpi-card warning">
            <p>{t("inventory.kpiApproaching")}</p>
            <strong>{formatUnits(summary.approaching)}</strong>
            <span>{t("inventory.kpiApproachingHelper")}</span>
          </article>
          <article className="dashboard-kpi-card neutral">
            <p>{t("inventory.kpiDead")}</p>
            <strong>{formatUnits(summary.deadCount)}</strong>
            <span>{fmt(summary.deadValue)} · {t("inventory.kpiDeadHelper")}</span>
          </article>
        </div>

        <p className="inv-insight-line">
          {t("inventory.insightLine", {
            fast: movementCounts.fast,
            slow: movementCounts.slow,
            dead: movementCounts.dead,
          })}
        </p>
      </section>

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
              <ProductStockRow
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
