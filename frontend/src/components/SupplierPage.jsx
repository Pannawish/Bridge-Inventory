import { useEffect, useMemo, useState } from "react";
import { FilterPresets, ActiveFilterChips } from "./FilterControls";
import { useLanguage } from "../i18n/LanguageContext";
import SupplierDirectorySection from "./suppliers/SupplierDirectorySection";
import SupplierEditorModal from "./suppliers/SupplierEditorModal";
import {
  SUPPLIER_OPTION_INDEX_KEYS,
  SUPPLIER_PROFILE_OPTIONS,
  SUPPLIER_REQUIRED_OPTION_KEYS,
  clampIndex,
  countFilledValues,
  createSupplier,
  getContactListKeyForIndex,
  getDefaultSuppliers,
  getFirstInvalidSupplierOptionIndex,
  getSupplierFormErrors,
  getSupplierOptionError,
  getSupplierTextFieldError,
  hasFormErrors,
  normalizeSupplier,
} from "./suppliers/supplierUtils";

export { getDefaultSuppliers } from "./suppliers/supplierUtils";

function SupplierPage({
  suppliers = getDefaultSuppliers(),
  allSuppliers = suppliers,
  pagination = null,
  onPageRequest,
  onSaveSupplier,
  onDeleteSupplier,
}) {
  const { t } = useLanguage();
  const [selectedSupplierId, setSelectedSupplierId] = useState(null);
  const [draftSupplier, setDraftSupplier] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [profileFilter, setProfileFilter] = useState("all");
  const [showAllRows, setShowAllRows] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    if (typeof document === "undefined" || !draftSupplier) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [draftSupplier]);

  useEffect(() => {
    if (selectedSupplierId && !suppliers.some((supplier) => supplier.id === selectedSupplierId)) {
      setSelectedSupplierId(null);
    }
  }, [selectedSupplierId, suppliers]);

  const isServerPaginated = Boolean(pagination && onPageRequest);
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const activeFilterCount = profileFilter === "all" ? 0 : 1;
  const compactRows = 5;
  const filteredSuppliers = useMemo(() => {
    if (isServerPaginated) {
      return suppliers;
    }

    return suppliers.filter((supplier) => {
      const matchesSearch =
        !normalizedSearch ||
        supplier.companyName.toLowerCase().includes(normalizedSearch) ||
        supplier.procurementName.toLowerCase().includes(normalizedSearch) ||
        supplier.procurementTel.toLowerCase().includes(normalizedSearch) ||
        supplier.taxpayerId.toLowerCase().includes(normalizedSearch) ||
        supplier.locations.some((item) => item.toLowerCase().includes(normalizedSearch)) ||
        supplier.emails.some((item) => item.toLowerCase().includes(normalizedSearch)) ||
        supplier.tels.some((item) => item.toLowerCase().includes(normalizedSearch));

      if (!matchesSearch) {
        return false;
      }

      if (profileFilter === "missing-tax-id") {
        return !supplier.taxpayerId.trim();
      }
      if (profileFilter === "has-email") {
        return countFilledValues(supplier.emails) > 0;
      }
      if (profileFilter === "has-phone") {
        return countFilledValues(supplier.tels) > 0;
      }
      if (profileFilter === "has-note") {
        return Boolean(supplier.remark.trim() || supplier.billingNoteDate.trim());
      }

      return true;
    });
  }, [isServerPaginated, normalizedSearch, profileFilter, suppliers]);
  const shouldShowViewAll = !isServerPaginated && filteredSuppliers.length > compactRows;
  const isCompact = shouldShowViewAll && !showAllRows;
  const totalSupplierCount = pagination?.count ?? suppliers.length;

  function getPageRequestParams(page = 1) {
    return {
      page,
      search: searchTerm,
      profileFilter: profileFilter === "all" ? "" : profileFilter,
    };
  }

  useEffect(() => {
    if (!isServerPaginated) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      onPageRequest(getPageRequestParams(1));
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [isServerPaginated, onPageRequest, profileFilter, searchTerm]);

  function resetFilters() {
    setSearchTerm("");
    setProfileFilter("all");
    setFilterOpen(false);
  }

  const quickPresets = SUPPLIER_PROFILE_OPTIONS.map((option) => ({
    label: t(option.labelKey),
    active: profileFilter === option.value,
    onClick: () =>
      setProfileFilter((current) => (current === option.value ? "all" : option.value)),
  }));
  const activeChips = [
    profileFilter !== "all" && {
      key: "profile",
      label: t("supplier.profileChip", {
        label:
          t(SUPPLIER_PROFILE_OPTIONS.find((option) => option.value === profileFilter)?.labelKey || "") ||
          profileFilter,
      }),
      onRemove: () => setProfileFilter("all"),
    },
  ].filter(Boolean);

  function openSupplierEditor(supplier) {
    setSelectedSupplierId(supplier.id);
    setDraftSupplier(normalizeSupplier(supplier));
    setFormErrors({});
  }

  function closeSupplierEditor() {
    setDraftSupplier(null);
    setFormErrors({});
  }

  function updateDraftSupplier(updater) {
    setDraftSupplier((currentSupplier) =>
      currentSupplier ? normalizeSupplier(updater(currentSupplier)) : currentSupplier
    );
  }

  function updateTextField(key, value) {
    updateDraftSupplier((supplier) => ({ ...supplier, [key]: value }));
    setFormErrors((currentErrors) => ({
      ...currentErrors,
      [key]: getSupplierTextFieldError(key, value, t),
    }));
  }

  function updateOptionIndex(indexKey, nextIndex) {
    updateDraftSupplier((supplier) => ({ ...supplier, [indexKey]: nextIndex }));

    const listKey = getContactListKeyForIndex(indexKey);
    if (listKey && draftSupplier) {
      setFormErrors((currentErrors) => ({
        ...currentErrors,
        [listKey]: getSupplierOptionError(listKey, draftSupplier[listKey]?.[nextIndex] || "", t),
      }));
    }
  }

  function updateOptionValue(listKey, indexKey, nextValue) {
    updateDraftSupplier((supplier) => {
      const nextOptions = [...supplier[listKey]];
      nextOptions[supplier[indexKey]] = nextValue;
      return { ...supplier, [listKey]: nextOptions };
    });

    if (SUPPLIER_REQUIRED_OPTION_KEYS[listKey]) {
      setFormErrors((currentErrors) => ({
        ...currentErrors,
        [listKey]: getSupplierOptionError(listKey, nextValue, t),
      }));
    }
  }

  function addOption(listKey, indexKey) {
    if (SUPPLIER_REQUIRED_OPTION_KEYS[listKey] && draftSupplier) {
      const currentValue = draftSupplier[listKey]?.[draftSupplier[indexKey]] || "";
      const error = getSupplierOptionError(listKey, currentValue, t);

      if (error) {
        setFormErrors((currentErrors) => ({
          ...currentErrors,
          [listKey]: error,
        }));
        return;
      }
    }

    updateDraftSupplier((supplier) => {
      const nextOptions = [...supplier[listKey], ""];
      return {
        ...supplier,
        [listKey]: nextOptions,
        [indexKey]: nextOptions.length - 1,
      };
    });
  }

  function deleteOption(listKey, indexKey) {
    updateDraftSupplier((supplier) => {
      const currentIndex = supplier[indexKey];
      const currentOptions = supplier[listKey];

      if (currentOptions.length <= 1) {
        return {
          ...supplier,
          [listKey]: [""],
          [indexKey]: 0,
        };
      }

      const nextOptions = currentOptions.filter((_, index) => index !== currentIndex);
      return {
        ...supplier,
        [listKey]: nextOptions,
        [indexKey]: clampIndex(nextOptions, currentIndex),
      };
    });

    if (SUPPLIER_REQUIRED_OPTION_KEYS[listKey]) {
      setFormErrors((currentErrors) => ({
        ...currentErrors,
        [listKey]: "",
      }));
    }
  }

  function handleCreateSupplier() {
    setFormErrors({});
    setDraftSupplier(createSupplier());
  }

  async function handleSaveSupplier() {
    if (!draftSupplier) {
      return;
    }

    const nextSupplier = normalizeSupplier(draftSupplier);
    const nextFormErrors = getSupplierFormErrors(nextSupplier, t);

    if (hasFormErrors(nextFormErrors)) {
      const nextIndexes = Object.entries(SUPPLIER_OPTION_INDEX_KEYS).reduce(
        (indexes, [listKey, indexKey]) => {
          const invalidIndex = getFirstInvalidSupplierOptionIndex(nextSupplier, listKey, t);
          return invalidIndex >= 0 ? { ...indexes, [indexKey]: invalidIndex } : indexes;
        },
        {}
      );

      setDraftSupplier({ ...nextSupplier, ...nextIndexes });
      setFormErrors(nextFormErrors);
      return;
    }

    const savedSupplier = await onSaveSupplier?.(nextSupplier);

    if (savedSupplier === false) {
      return;
    }

    setSelectedSupplierId((savedSupplier || nextSupplier).id);
    setDraftSupplier(null);
  }

  async function handleDeleteSupplier() {
    if (!draftSupplier) {
      return;
    }

    const exists = allSuppliers.some((supplier) => supplier.id === draftSupplier.id);

    if (!exists) {
      setDraftSupplier(null);
      return;
    }

    const confirmed = window.confirm(
      t("supplier.deleteConfirm", {
        name: draftSupplier.companyName || t("supplier.unnamedSupplier"),
      })
    );

    if (!confirmed) {
      return;
    }

    const deleted = await onDeleteSupplier?.(draftSupplier);

    if (deleted === false) {
      return;
    }

    setSelectedSupplierId((currentId) =>
      currentId === draftSupplier.id ? null : currentId
    );
    setDraftSupplier(null);
  }

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
          <button className="secondary-button" type="button" onClick={resetFilters}>
            {t("common.resetFilter")}
          </button>
        </div>

        <FilterPresets presets={quickPresets} />
        <ActiveFilterChips chips={activeChips} onClearAll={resetFilters} />

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
