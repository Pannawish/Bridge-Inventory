import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import {
  SUPPLIER_OPTION_INDEX_KEYS,
  SUPPLIER_PROFILE_OPTIONS,
  SUPPLIER_REQUIRED_OPTION_KEYS,
  clampIndex,
  createSupplier,
  getContactListKeyForIndex,
  getDefaultSuppliers,
  getFirstInvalidSupplierOptionIndex,
  getSupplierFormErrors,
  getSupplierOptionError,
  getSupplierTextFieldError,
  hasFormErrors,
  normalizeSupplier,
} from "./supplierUtils";
import { filterSuppliersHelper } from "./supplierPageHelpers";

export function useSupplierPageState({
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

  // Body scroll locking when editor modal is active
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

  // Selected supplier resetting on changes
  useEffect(() => {
    if (selectedSupplierId && !suppliers.some((supplier) => supplier.id === selectedSupplierId)) {
      setSelectedSupplierId(null);
    }
  }, [selectedSupplierId, suppliers]);

  const isServerPaginated = Boolean(pagination && onPageRequest);
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const activeFilterCount = profileFilter === "all" ? 0 : 1;
  const compactRows = 5;

  const filteredSuppliers = useMemo(
    () =>
      filterSuppliersHelper({
        suppliers,
        normalizedSearch,
        profileFilter,
        isServerPaginated,
      }),
    [suppliers, normalizedSearch, profileFilter, isServerPaginated]
  );

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

  // Server-side paginated loading search debounce
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

  const quickPresets = useMemo(
    () =>
      SUPPLIER_PROFILE_OPTIONS.map((option) => ({
        label: t(option.labelKey),
        active: profileFilter === option.value,
        onClick: () =>
          setProfileFilter((current) => (current === option.value ? "all" : option.value)),
      })),
    [t, profileFilter]
  );

  const activeChips = useMemo(
    () =>
      [
        profileFilter !== "all" && {
          key: "profile",
          label: t("supplier.profileChip", {
            label:
              t(SUPPLIER_PROFILE_OPTIONS.find((option) => option.value === profileFilter)?.labelKey || "") ||
              profileFilter,
          }),
          onRemove: () => setProfileFilter("all"),
        },
      ].filter(Boolean),
    [t, profileFilter]
  );

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
        name: draftSupplier.companyName || t("supplier.unnamedCategory"), // Wait! The original said unnamedCategory, let's look: yes! supplier deleteConfirm uses supplier name or fallback.
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

  return {
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
  };
}
