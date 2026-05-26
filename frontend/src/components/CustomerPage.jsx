import { useEffect, useMemo, useState } from "react";
import { FilterPresets, ActiveFilterChips } from "./FilterControls";
import { useLanguage } from "../i18n/LanguageContext";
import CustomerDirectorySection from "./customers/CustomerDirectorySection";
import CustomerEditorModal from "./customers/CustomerEditorModal";
import {
  CUSTOMER_OPTION_INDEX_KEYS,
  CUSTOMER_PROFILE_OPTIONS,
  CUSTOMER_REQUIRED_FIELD_KEYS,
  CUSTOMER_REQUIRED_OPTION_KEYS,
  clampIndex,
  countFilledValues,
  createCustomer,
  getContactListKeyForIndex,
  getCustomerFormErrors,
  getCustomerOptionError,
  getDefaultCustomers,
  getFirstInvalidCustomerOptionIndex,
  hasFormErrors,
  normalizeCustomer,
} from "./customers/customerUtils";
import { getRequiredFieldError } from "./contactValidation";

export { getDefaultCustomers } from "./customers/customerUtils";

function CustomerPage({
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

  useEffect(() => {
    if (selectedCustomerId && !customers.some((customer) => customer.id === selectedCustomerId)) {
      setSelectedCustomerId(null);
    }
  }, [selectedCustomerId, customers]);

  const isServerPaginated = Boolean(pagination && onPageRequest);
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const activeFilterCount = profileFilter === "all" ? 0 : 1;
  const compactRows = 5;
  const filteredCustomers = useMemo(() => {
    if (isServerPaginated) {
      return customers;
    }

    return customers.filter((customer) => {
      const matchesSearch =
        !normalizedSearch ||
        customer.companyName.toLowerCase().includes(normalizedSearch) ||
        customer.taxpayerId.toLowerCase().includes(normalizedSearch) ||
        customer.locations.some((item) => item.toLowerCase().includes(normalizedSearch)) ||
        customer.emails.some((item) => item.toLowerCase().includes(normalizedSearch)) ||
        customer.tels.some((item) => item.toLowerCase().includes(normalizedSearch));

      if (!matchesSearch) {
        return false;
      }

      if (profileFilter === "missing-tax-id") {
        return !customer.taxpayerId.trim();
      }
      if (profileFilter === "has-email") {
        return countFilledValues(customer.emails) > 0;
      }
      if (profileFilter === "has-phone") {
        return countFilledValues(customer.tels) > 0;
      }
      if (profileFilter === "has-note") {
        return Boolean(customer.remark.trim() || customer.billingNoteDate.trim());
      }

      return true;
    });
  }, [customers, isServerPaginated, normalizedSearch, profileFilter]);
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

  const quickPresets = CUSTOMER_PROFILE_OPTIONS.map((option) => ({
    label: t(option.labelKey),
    active: profileFilter === option.value,
    onClick: () =>
      setProfileFilter((current) => (current === option.value ? "all" : option.value)),
  }));
  const activeChips = [
    profileFilter !== "all" && {
      key: "profile",
      label: t("customer.profileChip", {
        label:
          t(CUSTOMER_PROFILE_OPTIONS.find((option) => option.value === profileFilter)?.labelKey || "") ||
          profileFilter,
      }),
      onRemove: () => setProfileFilter("all"),
    },
  ].filter(Boolean);

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

  return (
    <div className="stack-layout">
      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("customer.eyebrow")}</p>
            <h3>{t("customer.findTitle")}</h3>
          </div>
        </div>

        <div className="supplier-directory-toolbar">
          <label className="stock-search supplier-search">
            <span className="stock-search-icon">S</span>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={t("customer.searchPlaceholder")}
            />
          </label>
          <div className="stock-report-summary supplier-search-meta">
            <span>
              {isServerPaginated
                ? t("customer.pageCountServer", {
                    count: filteredCustomers.length,
                    total: totalCustomerCount,
                  })
                : t("customer.pageCountLocal", {
                    count: filteredCustomers.length,
                    total: customers.length,
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
                <span className="history-filter-title">{t("customer.profileFilter")}</span>
                <select
                  value={profileFilter}
                  onChange={(event) => setProfileFilter(event.target.value)}
                >
                  <option value="all">{t("customer.allCustomers")}</option>
                  {CUSTOMER_PROFILE_OPTIONS.map((option) => (
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
    </div>
  );
}

export default CustomerPage;
