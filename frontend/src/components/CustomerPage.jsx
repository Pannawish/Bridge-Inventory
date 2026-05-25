import { useEffect, useMemo, useState } from "react";
import PaginationControls from "./PaginationControls";
import { FilterPresets, ActiveFilterChips } from "./FilterControls";
import {
  getContactFieldError,
  getRequiredFieldError,
  getRequiredListError,
} from "./contactValidation";
import { useLanguage } from "../i18n/LanguageContext";

const CUSTOMER_PROFILE_OPTIONS = [
  { value: "missing-tax-id", labelKey: "customer.missingTaxId" },
  { value: "has-email", labelKey: "customer.hasEmail" },
  { value: "has-phone", labelKey: "customer.hasPhone" },
  { value: "has-note", labelKey: "customer.hasNote" },
];

function createCustomer(overrides = {}) {
  return {
    id: `customer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    companyName: "",
    locations: [""],
    selectedLocationIndex: 0,
    emails: [""],
    selectedEmailIndex: 0,
    tels: [""],
    selectedTelIndex: 0,
    taxpayerId: "",
    branches: [""],
    selectedBranchIndex: 0,
    shippingAddresses: [""],
    selectedShippingAddressIndex: 0,
    remark: "",
    termType: "",
    billingNoteDate: "",
    ...overrides,
  };
}

const defaultCustomers = [
  createCustomer({
    id: "customer-1",
    companyName: "Faculty of Engineering",
    locations: ["Main Campus", "Innovation Building"],
    selectedLocationIndex: 0,
    emails: ["procurement@eng.example.ac.th", "store@eng.example.ac.th"],
    selectedEmailIndex: 0,
    tels: ["02-111-2200", "089-111-2200"],
    selectedTelIndex: 0,
    taxpayerId: "0994000151234",
    branches: ["Main Office", "Warehouse Desk"],
    selectedBranchIndex: 0,
    shippingAddresses: [
      "99 Phaya Thai Road, Pathum Wan, Bangkok 10330",
      "21 Rama I Road, Pathum Wan, Bangkok 10330",
    ],
    selectedShippingAddressIndex: 0,
    remark: "Regular bulk customer for notebooks and pens.",
    termType: "credit",
    billingNoteDate: "30 days",
  }),
  createCustomer({
    id: "customer-2",
    companyName: "Student Council",
    locations: ["Student Union Office", "Event Storage Room"],
    selectedLocationIndex: 0,
    emails: ["admin@studentcouncil.example.ac.th"],
    selectedEmailIndex: 0,
    tels: ["02-555-7788"],
    selectedTelIndex: 0,
    taxpayerId: "0107546004451",
    branches: ["Council Office"],
    selectedBranchIndex: 0,
    shippingAddresses: ["15 University Avenue, Bangkok 10330"],
    selectedShippingAddressIndex: 0,
    remark: "Often requests event supplies on short notice.",
    termType: "debit",
    billingNoteDate: "",
  }),
  createCustomer({
    id: "customer-3",
    companyName: "Library Office",
    locations: ["Main Library", "Archive Room"],
    selectedLocationIndex: 0,
    emails: ["library.office@example.ac.th", "supplies.library@example.ac.th"],
    selectedEmailIndex: 1,
    tels: ["02-333-1010"],
    selectedTelIndex: 0,
    taxpayerId: "0107547001250",
    branches: ["Main Branch"],
    selectedBranchIndex: 0,
    shippingAddresses: ["1 University Library Road, Bangkok 10330"],
    selectedShippingAddressIndex: 0,
    remark: "Commonly orders file folders, markers, and shelf labels.",
    termType: "credit",
    billingNoteDate: "60 days",
  }),
  createCustomer({
    id: "customer-4",
    companyName: "Admissions Office",
    locations: ["Registrar Building"],
    selectedLocationIndex: 0,
    emails: ["admissions.procurement@example.ac.th"],
    selectedEmailIndex: 0,
    tels: ["02-444-7878", "081-444-7878"],
    selectedTelIndex: 0,
    taxpayerId: "0107548008892",
    branches: ["Admissions Desk"],
    selectedBranchIndex: 0,
    shippingAddresses: ["88 University Avenue, Pathum Wan, Bangkok 10330"],
    selectedShippingAddressIndex: 0,
    remark: "Needs organized document packs before semester enrollment season.",
    termType: "debit",
    billingNoteDate: "",
  }),
  createCustomer({
    id: "customer-5",
    companyName: "Architecture Studio",
    locations: ["Design Lab", "Model Workshop"],
    selectedLocationIndex: 0,
    emails: ["studio-orders@example.ac.th"],
    selectedEmailIndex: 0,
    tels: ["02-555-9821"],
    selectedTelIndex: 0,
    taxpayerId: "0107549007714",
    branches: ["Creative Unit"],
    selectedBranchIndex: 0,
    shippingAddresses: ["27 Studio Lane, Bangkok 10330"],
    selectedShippingAddressIndex: 0,
    remark: "Often buys markers, binders, and presentation supplies in mixed units.",
    termType: "credit",
    billingNoteDate: "30 days",
  }),
  createCustomer({
    id: "customer-6",
    companyName: "Alumni Relations",
    locations: ["Advancement Office"],
    selectedLocationIndex: 0,
    emails: ["alumni.relations@example.ac.th", "events.alumni@example.ac.th"],
    selectedEmailIndex: 0,
    tels: ["02-777-3311"],
    selectedTelIndex: 0,
    taxpayerId: "0107550004416",
    branches: ["Main Office"],
    selectedBranchIndex: 0,
    shippingAddresses: ["12 Advancement Building, Bangkok 10330"],
    selectedShippingAddressIndex: 0,
    remark: "Event-driven orders that often change close to delivery.",
    termType: "credit",
    billingNoteDate: "60 days",
  }),
];

export function getDefaultCustomers() {
  return defaultCustomers.map((customer) => normalizeCustomer(customer));
}

function clampIndex(list, index) {
  if (!list.length) {
    return 0;
  }

  return Math.max(0, Math.min(index || 0, list.length - 1));
}

function coerceList(value) {
  if (!Array.isArray(value) || value.length === 0) {
    return [""];
  }

  return value.map((entry) => `${entry ?? ""}`);
}

function normalizeCustomer(customer) {
  const locations = coerceList(customer.locations);
  const emails = coerceList(customer.emails);
  const tels = coerceList(customer.tels);
  const branches = coerceList(customer.branches);
  const shippingAddresses = coerceList(customer.shippingAddresses);

  return {
    id: customer.id || createCustomer().id,
    companyName: `${customer.companyName ?? ""}`,
    locations,
    selectedLocationIndex: clampIndex(locations, customer.selectedLocationIndex),
    emails,
    selectedEmailIndex: clampIndex(emails, customer.selectedEmailIndex),
    tels,
    selectedTelIndex: clampIndex(tels, customer.selectedTelIndex),
    taxpayerId: `${customer.taxpayerId ?? ""}`,
    branches,
    selectedBranchIndex: clampIndex(branches, customer.selectedBranchIndex),
    shippingAddresses,
    selectedShippingAddressIndex: clampIndex(
      shippingAddresses,
      customer.selectedShippingAddressIndex
    ),
    remark: `${customer.remark ?? ""}`,
    termType: customer.termType ?? "",
    billingNoteDate: `${customer.billingNoteDate ?? ""}`,
  };
}

function getSelectedValue(list, index) {
  return list?.[index] || "-";
}

function countFilledValues(list) {
  return (list || []).filter((value) => `${value ?? ""}`.trim()).length;
}

function getContactListKeyForIndex(indexKey) {
  if (indexKey === "selectedBranchIndex") {
    return "branches";
  }

  if (indexKey === "selectedLocationIndex") {
    return "locations";
  }

  if (indexKey === "selectedEmailIndex") {
    return "emails";
  }

  if (indexKey === "selectedTelIndex") {
    return "tels";
  }

  if (indexKey === "selectedShippingAddressIndex") {
    return "shippingAddresses";
  }

  return "";
}

const CUSTOMER_REQUIRED_FIELD_KEYS = {
  companyName: "customer.companyNameLabel",
  taxpayerId: "customer.taxpayerLabel",
  termType: "customer.paymentTermLabel",
  billingNoteDate: "customer.creditTermLabel",
};

const CUSTOMER_REQUIRED_OPTION_KEYS = {
  branches: "customer.branchLabel",
  locations: "customer.locationLabel",
  emails: "customer.emailLabel",
  tels: "customer.telLabel",
  shippingAddresses: "customer.shippingLabel",
};

const CUSTOMER_OPTION_INDEX_KEYS = {
  branches: "selectedBranchIndex",
  locations: "selectedLocationIndex",
  emails: "selectedEmailIndex",
  tels: "selectedTelIndex",
  shippingAddresses: "selectedShippingAddressIndex",
};

function getCustomerOptionError(listKey, value, t) {
  return (
    getRequiredFieldError(t(CUSTOMER_REQUIRED_OPTION_KEYS[listKey]), value) ||
    getContactFieldError(listKey, value)
  );
}

function getFirstInvalidCustomerOptionIndex(customer, listKey, t) {
  return (customer[listKey] || []).findIndex((value) => getCustomerOptionError(listKey, value, t));
}

function getCustomerFormErrors(customer, t) {
  return {
    companyName: getRequiredFieldError(t(CUSTOMER_REQUIRED_FIELD_KEYS.companyName), customer.companyName),
    taxpayerId: getRequiredFieldError(t(CUSTOMER_REQUIRED_FIELD_KEYS.taxpayerId), customer.taxpayerId),
    branches:
      getRequiredListError(t(CUSTOMER_REQUIRED_OPTION_KEYS.branches), customer.branches) ||
      (customer.branches || []).map((value) => getCustomerOptionError("branches", value, t)).find(Boolean) ||
      "",
    locations:
      getRequiredListError(t(CUSTOMER_REQUIRED_OPTION_KEYS.locations), customer.locations) ||
      (customer.locations || []).map((value) => getCustomerOptionError("locations", value, t)).find(Boolean) ||
      "",
    emails:
      getRequiredListError(t(CUSTOMER_REQUIRED_OPTION_KEYS.emails), customer.emails) ||
      (customer.emails || []).map((value) => getCustomerOptionError("emails", value, t)).find(Boolean) ||
      "",
    tels:
      getRequiredListError(t(CUSTOMER_REQUIRED_OPTION_KEYS.tels), customer.tels) ||
      (customer.tels || []).map((value) => getCustomerOptionError("tels", value, t)).find(Boolean) ||
      "",
    shippingAddresses:
      getRequiredListError(t(CUSTOMER_REQUIRED_OPTION_KEYS.shippingAddresses), customer.shippingAddresses) ||
      (customer.shippingAddresses || [])
        .map((value) => getCustomerOptionError("shippingAddresses", value, t))
        .find(Boolean) ||
      "",
    termType: getRequiredFieldError(t(CUSTOMER_REQUIRED_FIELD_KEYS.termType), customer.termType),
    billingNoteDate:
      customer.termType === "credit"
        ? getRequiredFieldError(t(CUSTOMER_REQUIRED_FIELD_KEYS.billingNoteDate), customer.billingNoteDate)
        : "",
  };
}

function hasFormErrors(errors) {
  return Object.values(errors).some(Boolean);
}

function CustomerOptionField({
  label,
  options,
  selectedIndex,
  placeholder,
  type = "text",
  error = "",
  required = false,
  onSelect,
  onChange,
  onAdd,
  onDelete,
}) {
  const { t } = useLanguage();
  return (
    <div className="supplier-option-field">
      <label>
        <span className={required ? "required-label" : undefined}>{label}</span>
        <select
          value={selectedIndex}
          required={required}
          onChange={(event) => onSelect(Number(event.target.value))}
        >
          {options.map((option, index) => (
            <option key={`${label}-${index}`} value={index}>
              {option?.trim() || `${label} ${index + 1}`}
            </option>
          ))}
        </select>
      </label>

      <div className="supplier-option-edit-row">
        <input
          type={type}
          required={required}
          value={options[selectedIndex] || ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-invalid={error ? "true" : undefined}
        />
        <div className="supplier-option-edit-actions">
          <button className="secondary-button" type="button" onClick={onAdd}>
            {t("common.add")}
          </button>
          <button className="danger-button" type="button" onClick={onDelete}>
            {t("common.delete")}
          </button>
        </div>
      </div>
      {error ? <span className="field-error-text">{error}</span> : null}
    </div>
  );
}

function CustomerPage({
  customers = defaultCustomers,
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
  const shouldShowViewAll =
    !isServerPaginated && filteredCustomers.length > compactRows;
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
      setProfileFilter((current) =>
        current === option.value ? "all" : option.value
      ),
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
      t("customer.deleteConfirm", { name: draftCustomer.companyName || t("customer.unnamedCustomer") })
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
                ? t("customer.pageCountServer", { count: filteredCustomers.length, total: totalCustomerCount })
                : t("customer.pageCountLocal", { count: filteredCustomers.length, total: customers.length })}
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

      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("customer.historyEyebrow")}</p>
            <h3>{t("customer.historyTitle")}</h3>
          </div>
          <div className="transaction-table-actions">
            <button className="primary-button" type="button" onClick={handleCreateCustomer}>
              {t("customer.newCustomer")}
            </button>
            {shouldShowViewAll ? (
              <button
                className="secondary-button"
                type="button"
                onClick={() => setShowAllRows((currentValue) => !currentValue)}
              >
                {showAllRows ? t("common.showRecent") : t("common.viewMore")}
              </button>
            ) : null}
          </div>
        </div>

        {filteredCustomers.length === 0 ? (
          <p className="empty-copy">{t("customer.noMatch")}</p>
        ) : (
          <div
            className={
              isCompact
                ? "transaction-table-window partner-table-window compact-history"
                : "transaction-table-window partner-table-window"
            }
          >
            <div className="table-scroll desktop-table">
              <table className="transaction-history-table">
                <colgroup>
                  <col className="history-col-index" />
                  <col className="partner-col-name" />
                  <col className="partner-col-contact" />
                  <col className="partner-col-location" />
                  <col className="partner-col-profile" />
                  <col className="history-col-action" />
                </colgroup>
                <thead>
                  <tr>
                    <th className="table-index-cell">#</th>
                    <th>{t("customer.colCustomer")}</th>
                    <th>{t("customer.colContact")}</th>
                    <th>{t("customer.colLocation")}</th>
                    <th>{t("customer.colProfile")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((customer, index) => {
                    const isActive = customer.id === selectedCustomerId;

                    return (
                      <tr
                        key={customer.id}
                        className={isActive ? "partner-table-row active" : "partner-table-row"}
                      >
                        <td className="table-index-cell">{index + 1}</td>
                        <td>
                          <div className="transaction-reference-cell">
                            <strong>{customer.companyName || t("customer.unnamedCustomer")}</strong>
                            <span>
                              {customer.taxpayerId ? t("customer.taxIdLabel", { id: customer.taxpayerId }) : t("customer.taxIdNotSet")}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="cell-stack">
                            <strong>
                              {getSelectedValue(customer.emails, customer.selectedEmailIndex)}
                            </strong>
                            <span>{getSelectedValue(customer.tels, customer.selectedTelIndex)}</span>
                          </div>
                        </td>
                        <td>
                          <div className="cell-stack">
                            <strong>
                              {getSelectedValue(customer.locations, customer.selectedLocationIndex)}
                            </strong>
                            <span>
                              {getSelectedValue(
                                customer.shippingAddresses,
                                customer.selectedShippingAddressIndex
                              )}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="cell-stack">
                            <strong>
                              {getSelectedValue(customer.branches, customer.selectedBranchIndex)}
                            </strong>
                            <span>{customer.remark || customer.billingNoteDate || t("customer.noInternalNote")}</span>
                          </div>
                        </td>
                        <td>
                          <button
                            className="table-action-button"
                            type="button"
                            onClick={() => openCustomerEditor(customer)}
                          >
                            {t("common.view")}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mobile-record-list">
              {filteredCustomers.map((customer, index) => (
                <article className="mobile-record-card" key={`mobile-customer-${customer.id}`}>
                  <div className="mobile-record-header">
                    <div className="mobile-record-title">
                      <span className="mobile-record-index">{index + 1}</span>
                      <div className="cell-stack">
                        <strong>{customer.companyName || t("customer.unnamedCustomer")}</strong>
                        <span>
                          {customer.taxpayerId ? t("customer.taxIdLabel", { id: customer.taxpayerId }) : t("customer.taxIdNotSet")}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mobile-record-grid">
                    <div>
                      <span>{t("customer.colEmail")}</span>
                      <strong>{getSelectedValue(customer.emails, customer.selectedEmailIndex)}</strong>
                    </div>
                    <div>
                      <span>{t("customer.colPhone")}</span>
                      <strong>{getSelectedValue(customer.tels, customer.selectedTelIndex)}</strong>
                    </div>
                    <div>
                      <span>{t("customer.colLocation")}</span>
                      <strong>{getSelectedValue(customer.locations, customer.selectedLocationIndex)}</strong>
                    </div>
                    <div>
                      <span>{t("customer.colBranch")}</span>
                      <strong>{getSelectedValue(customer.branches, customer.selectedBranchIndex)}</strong>
                    </div>
                  </div>

                  <button
                    className="secondary-button table-action-button mobile-record-button"
                    type="button"
                    onClick={() => openCustomerEditor(customer)}
                  >
                    {t("common.view")}
                  </button>
                </article>
              ))}
            </div>
          </div>
        )}
        <PaginationControls
          pagination={pagination}
          itemLabel={t("customer.historyTitle")}
          onPageChange={(page) => onPageRequest?.(getPageRequestParams(page))}
        />
      </section>

      {draftCustomer ? (
        <div className="modal-backdrop">
          <div
            className="detail-modal supplier-modal contact-editor-modal section-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-modal-title"
          >
            <div className="section-heading supplier-modal-header">
              <div>
                <p className="eyebrow">{t("customer.detailsEyebrow")}</p>
                <h3 id="customer-modal-title">
                  {draftCustomer.companyName || t("customer.newCustomer")}
                </h3>
              </div>
              <button
                className="icon-button subtle"
                type="button"
                aria-label={t("customer.closeLabel")}
                onClick={closeCustomerEditor}
              >
                X
              </button>
            </div>

            <form
              className="form-layout"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                handleSaveCustomer();
              }}
            >
              <div className="contact-editor-layout">
                <section className="contact-editor-section">
                  <div className="contact-editor-section-heading">
                    <div>
                      <p className="eyebrow">{t("customer.identityEyebrow")}</p>
                      <h4>{t("customer.identityTitle")}</h4>
                    </div>
                    <span>{t("customer.identityDescription")}</span>
                  </div>

                  <div className="contact-editor-grid">
                    <label>
                      <span className="required-label">{t("customer.companyNameLabel")}</span>
                      <input
                        autoFocus
                        required
                        value={draftCustomer.companyName}
                        onChange={(event) => updateTextField("companyName", event.target.value)}
                        placeholder={t("customer.companyNamePlaceholder")}
                        aria-invalid={formErrors.companyName ? "true" : undefined}
                      />
                      {formErrors.companyName ? (
                        <span className="field-error-text">{formErrors.companyName}</span>
                      ) : null}
                    </label>

                    <label>
                      <span className="required-label">{t("customer.taxpayerLabel")}</span>
                      <input
                        required
                        value={draftCustomer.taxpayerId}
                        onChange={(event) => updateTextField("taxpayerId", event.target.value)}
                        placeholder={t("customer.taxpayerPlaceholder")}
                        aria-invalid={formErrors.taxpayerId ? "true" : undefined}
                      />
                      {formErrors.taxpayerId ? (
                        <span className="field-error-text">{formErrors.taxpayerId}</span>
                      ) : null}
                    </label>

                    <div className="full-width">
                      <CustomerOptionField
                        label={t("customer.branchLabel")}
                        options={draftCustomer.branches}
                        selectedIndex={draftCustomer.selectedBranchIndex}
                        placeholder={t("customer.branchPlaceholder")}
                        required
                        error={formErrors.branches}
                        onSelect={(nextIndex) => updateOptionIndex("selectedBranchIndex", nextIndex)}
                        onChange={(nextValue) =>
                          updateOptionValue("branches", "selectedBranchIndex", nextValue)
                        }
                        onAdd={() => addOption("branches", "selectedBranchIndex")}
                        onDelete={() => deleteOption("branches", "selectedBranchIndex")}
                      />
                    </div>
                  </div>
                </section>

                <section className="contact-editor-section">
                  <div className="contact-editor-section-heading">
                    <div>
                      <p className="eyebrow">{t("customer.contactEyebrow")}</p>
                      <h4>{t("customer.contactTitle")}</h4>
                    </div>
                    <span>{t("customer.contactDescription")}</span>
                  </div>

                  <div className="contact-editor-grid">
                    <CustomerOptionField
                      label={t("customer.locationLabel")}
                      options={draftCustomer.locations}
                      selectedIndex={draftCustomer.selectedLocationIndex}
                      placeholder={t("customer.locationPlaceholder")}
                      required
                      error={formErrors.locations}
                      onSelect={(nextIndex) => updateOptionIndex("selectedLocationIndex", nextIndex)}
                      onChange={(nextValue) =>
                        updateOptionValue("locations", "selectedLocationIndex", nextValue)
                      }
                      onAdd={() => addOption("locations", "selectedLocationIndex")}
                      onDelete={() => deleteOption("locations", "selectedLocationIndex")}
                    />

                    <CustomerOptionField
                      label={t("customer.emailLabel")}
                      options={draftCustomer.emails}
                      selectedIndex={draftCustomer.selectedEmailIndex}
                      placeholder={t("customer.emailPlaceholder")}
                      type="email"
                      required
                      error={formErrors.emails}
                      onSelect={(nextIndex) => updateOptionIndex("selectedEmailIndex", nextIndex)}
                      onChange={(nextValue) =>
                        updateOptionValue("emails", "selectedEmailIndex", nextValue)
                      }
                      onAdd={() => addOption("emails", "selectedEmailIndex")}
                      onDelete={() => deleteOption("emails", "selectedEmailIndex")}
                    />

                    <div className="full-width">
                      <CustomerOptionField
                        label={t("customer.telLabel")}
                        options={draftCustomer.tels}
                        selectedIndex={draftCustomer.selectedTelIndex}
                        placeholder={t("customer.telPlaceholder")}
                        type="tel"
                        required
                        error={formErrors.tels}
                        onSelect={(nextIndex) => updateOptionIndex("selectedTelIndex", nextIndex)}
                        onChange={(nextValue) =>
                          updateOptionValue("tels", "selectedTelIndex", nextValue)
                        }
                        onAdd={() => addOption("tels", "selectedTelIndex")}
                        onDelete={() => deleteOption("tels", "selectedTelIndex")}
                      />
                    </div>
                  </div>
                </section>

                <section className="contact-editor-section">
                  <div className="contact-editor-section-heading">
                    <div>
                      <p className="eyebrow">{t("customer.deliveryEyebrow")}</p>
                      <h4>{t("customer.deliveryTitle")}</h4>
                    </div>
                    <span>{t("customer.deliveryDescription")}</span>
                  </div>

                  <div className="contact-editor-grid">
                    <div className="full-width">
                      <CustomerOptionField
                        label={t("customer.shippingLabel")}
                        options={draftCustomer.shippingAddresses}
                        selectedIndex={draftCustomer.selectedShippingAddressIndex}
                        placeholder={t("customer.shippingPlaceholder")}
                        required
                        error={formErrors.shippingAddresses}
                        onSelect={(nextIndex) =>
                          updateOptionIndex("selectedShippingAddressIndex", nextIndex)
                        }
                        onChange={(nextValue) =>
                          updateOptionValue(
                            "shippingAddresses",
                            "selectedShippingAddressIndex",
                            nextValue
                          )
                        }
                        onAdd={() =>
                          addOption("shippingAddresses", "selectedShippingAddressIndex")
                        }
                        onDelete={() =>
                          deleteOption("shippingAddresses", "selectedShippingAddressIndex")
                        }
                      />
                    </div>

                    <label>
                      {t("customer.remarkLabel")}
                      <textarea
                        rows="4"
                        value={draftCustomer.remark}
                        onChange={(event) => updateTextField("remark", event.target.value)}
                        placeholder={t("customer.remarkPlaceholder")}
                      />
                    </label>

                    <label>
                      <span className="required-label">{t("customer.paymentTermLabel")}</span>
                      <select
                        required
                        value={draftCustomer.termType}
                        onChange={(event) => {
                          const next = event.target.value;
                          updateDraftCustomer((c) => ({
                            ...c,
                            termType: next,
                            billingNoteDate: next === "debit" ? "" : c.billingNoteDate,
                          }));
                          setFormErrors((currentErrors) => ({
                            ...currentErrors,
                            termType: getRequiredFieldError(
                              t(CUSTOMER_REQUIRED_FIELD_KEYS.termType),
                              next
                            ),
                            billingNoteDate:
                              next === "credit"
                                ? getRequiredFieldError(
                                    t(CUSTOMER_REQUIRED_FIELD_KEYS.billingNoteDate),
                                    draftCustomer.billingNoteDate
                                  )
                                : "",
                          }));
                        }}
                        aria-invalid={formErrors.termType ? "true" : undefined}
                      >
                        <option value="">{t("customer.selectPaymentTerm")}</option>
                        <option value="debit">{t("customer.termDebit")}</option>
                        <option value="credit">{t("customer.termCredit")}</option>
                      </select>
                      {formErrors.termType ? (
                        <span className="field-error-text">{formErrors.termType}</span>
                      ) : null}
                    </label>

                    {draftCustomer.termType === "credit" && (
                      <label>
                        <span className="required-label">{t("customer.creditTermLabel")}</span>
                        <select
                          required
                          value={draftCustomer.billingNoteDate}
                          onChange={(event) => updateTextField("billingNoteDate", event.target.value)}
                          aria-invalid={formErrors.billingNoteDate ? "true" : undefined}
                        >
                          <option value="">{t("customer.selectCreditTerm")}</option>
                          <option value="30 days">{t("customer.days30")}</option>
                          <option value="60 days">{t("customer.days60")}</option>
                          <option value="90 days">{t("customer.days90")}</option>
                        </select>
                        {formErrors.billingNoteDate ? (
                          <span className="field-error-text">{formErrors.billingNoteDate}</span>
                        ) : null}
                      </label>
                    )}
                  </div>
                </section>
              </div>

              <div className="supplier-modal-actions">
                <button className="danger-button" type="button" onClick={handleDeleteCustomer}>
                  {t("customer.deleteButton")}
                </button>
                <button className="secondary-button" type="button" onClick={closeCustomerEditor}>
                  {t("common.cancel")}
                </button>
                <button className="primary-button" type="submit">
                  {t("customer.saveButton")}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default CustomerPage;
