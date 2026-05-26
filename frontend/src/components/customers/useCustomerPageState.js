import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import {
  CUSTOMER_OPTION_INDEX_KEYS,
  CUSTOMER_PROFILE_OPTIONS,
  CUSTOMER_REQUIRED_FIELD_KEYS,
  CUSTOMER_REQUIRED_OPTION_KEYS,
  clampIndex,
  createCustomer,
  getContactListKeyForIndex,
  getCustomerFormErrors,
  getCustomerOptionError,
  getDefaultCustomers,
  getFirstInvalidCustomerOptionIndex,
  hasFormErrors,
  normalizeCustomer,
} from "./customerUtils";
import { getRequiredFieldError } from "../contactValidation";
import { filterCustomersHelper } from "./customerPageHelpers";

export function useCustomerPageState({
  customers = getDefaultCustomers(),
  allCustomers = customers,
  pagination = null,
  onPageRequest,
  onSaveCustomer,
  onDeleteCustomer,
}) {
  const { t } = useLanguage();
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [draftCustomer, setDraftCustomer] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [profileFilter, setProfileFilter] = useState("all");
  const [showAllRows, setShowAllRows] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  // Body scroll locking when editor modal is active
  useEffect(() => {
    if (typeof document === "undefined" || !draftCustomer) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [draftCustomer]);

  // Selected customer resetting on changes
  useEffect(() => {
    if (selectedCustomerId && !customers.some((customer) => customer.id === selectedCustomerId)) {
      setSelectedCustomerId(null);
    }
  }, [selectedCustomerId, customers]);

  const isServerPaginated = Boolean(pagination && onPageRequest);
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const activeFilterCount = profileFilter === "all" ? 0 : 1;
  const compactRows = 5;

  const filteredCustomers = useMemo(
    () =>
      filterCustomersHelper({
        customers,
        normalizedSearch,
        profileFilter,
        isServerPaginated,
      }),
    [customers, normalizedSearch, profileFilter, isServerPaginated]
  );

  const shouldShowViewAll = !isServerPaginated && filteredCustomers.length > compactRows;
  const isCompact = shouldShowViewAll && !showAllRows;
  const totalCustomerCount = pagination?.count ?? customers.length;

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
      CUSTOMER_PROFILE_OPTIONS.map((option) => ({
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
          label: t("customer.profileChip", {
            label:
              t(CUSTOMER_PROFILE_OPTIONS.find((option) => option.value === profileFilter)?.labelKey || "") ||
              profileFilter,
          }),
          onRemove: () => setProfileFilter("all"),
        },
      ].filter(Boolean),
    [t, profileFilter]
  );

  function openCustomerEditor(customer) {
    setSelectedCustomerId(customer.id);
    setDraftCustomer(normalizeCustomer(customer));
    setFormErrors({});
  }

  function closeCustomerEditor() {
    setDraftCustomer(null);
    setFormErrors({});
  }

  function updateDraftCustomer(updater) {
    setDraftCustomer((currentCustomer) =>
      currentCustomer ? normalizeCustomer(updater(currentCustomer)) : currentCustomer
    );
  }

  function updateTextField(key, value) {
    updateDraftCustomer((customer) => ({ ...customer, [key]: value }));
    setFormErrors((currentErrors) => ({
      ...currentErrors,
      [key]:
        key === "remark"
          ? ""
          : getRequiredFieldError(t(CUSTOMER_REQUIRED_FIELD_KEYS[key]), value),
    }));
  }

  function updateOptionIndex(indexKey, nextIndex) {
    updateDraftCustomer((customer) => ({ ...customer, [indexKey]: nextIndex }));

    const listKey = getContactListKeyForIndex(indexKey);
    if (listKey && draftCustomer) {
      setFormErrors((currentErrors) => ({
        ...currentErrors,
        [listKey]: getCustomerOptionError(listKey, draftCustomer[listKey]?.[nextIndex] || "", t),
      }));
    }
  }

  function updateOptionValue(listKey, indexKey, nextValue) {
    updateDraftCustomer((customer) => {
      const nextOptions = [...customer[listKey]];
      nextOptions[customer[indexKey]] = nextValue;
      return { ...customer, [listKey]: nextOptions };
    });

    if (CUSTOMER_REQUIRED_OPTION_KEYS[listKey]) {
      setFormErrors((currentErrors) => ({
        ...currentErrors,
        [listKey]: getCustomerOptionError(listKey, nextValue, t),
      }));
    }
  }

  function addOption(listKey, indexKey) {
    if (CUSTOMER_REQUIRED_OPTION_KEYS[listKey] && draftCustomer) {
      const currentValue = draftCustomer[listKey]?.[draftCustomer[indexKey]] || "";
      const error = getCustomerOptionError(listKey, currentValue, t);

      if (error) {
        setFormErrors((currentErrors) => ({
          ...currentErrors,
          [listKey]: error,
        }));
        return;
      }
    }

    updateDraftCustomer((customer) => {
      const nextOptions = [...customer[listKey], ""];
      return {
        ...customer,
        [listKey]: nextOptions,
        [indexKey]: nextOptions.length - 1,
      };
    });
  }

  function deleteOption(listKey, indexKey) {
    updateDraftCustomer((customer) => {
      const currentIndex = customer[indexKey];
      const currentOptions = customer[listKey];

      if (currentOptions.length <= 1) {
        return {
          ...customer,
          [listKey]: [""],
          [indexKey]: 0,
        };
      }

      const nextOptions = currentOptions.filter((_, index) => index !== currentIndex);
      return {
        ...customer,
        [listKey]: nextOptions,
        [indexKey]: clampIndex(nextOptions, currentIndex),
      };
    });

    if (CUSTOMER_REQUIRED_OPTION_KEYS[listKey]) {
      setFormErrors((currentErrors) => ({
        ...currentErrors,
        [listKey]: "",
      }));
    }
  }

  function handleCreateCustomer() {
    setFormErrors({});
    setDraftCustomer(createCustomer());
  }

  async function handleSaveCustomer() {
    if (!draftCustomer) {
      return;
    }

    const nextCustomer = normalizeCustomer(draftCustomer);
    const nextFormErrors = getCustomerFormErrors(nextCustomer, t);

    if (hasFormErrors(nextFormErrors)) {
      const nextIndexes = Object.entries(CUSTOMER_OPTION_INDEX_KEYS).reduce(
        (indexes, [listKey, indexKey]) => {
          const invalidIndex = getFirstInvalidCustomerOptionIndex(nextCustomer, listKey, t);
          return invalidIndex >= 0 ? { ...indexes, [indexKey]: invalidIndex } : indexes;
        },
        {}
      );

      setDraftCustomer({ ...nextCustomer, ...nextIndexes });
      setFormErrors(nextFormErrors);
      return;
    }

    const savedCustomer = await onSaveCustomer?.(nextCustomer);

    if (savedCustomer === false) {
      return;
    }

    setSelectedCustomerId((savedCustomer || nextCustomer).id);
    setDraftCustomer(null);
  }

  async function handleDeleteCustomer() {
    if (!draftCustomer) {
      return;
    }

    const exists = allCustomers.some((customer) => customer.id === draftCustomer.id);

    if (!exists) {
      setDraftCustomer(null);
      return;
    }

    const confirmed = window.confirm(
      t("customer.deleteConfirm", {
        name: draftCustomer.companyName || t("customer.unnamedCustomer"),
      })
    );

    if (!confirmed) {
      return;
    }

    const deleted = await onDeleteCustomer?.(draftCustomer);

    if (deleted === false) {
      return;
    }

    setSelectedCustomerId((currentId) =>
      currentId === draftCustomer.id ? null : currentId
    );
    setDraftCustomer(null);
  }

  return {
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
  };
}
