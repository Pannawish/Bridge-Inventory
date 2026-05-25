import { useEffect, useMemo, useState } from "react";
import PaginationControls from "./PaginationControls";
import { FilterPresets, ActiveFilterChips } from "./FilterControls";
import {
  getContactFieldError,
  getRequiredFieldError,
  getRequiredListError,
  isValidTel,
} from "./contactValidation";
import { useLanguage } from "../i18n/LanguageContext";

const SUPPLIER_PROFILE_OPTIONS = [
  { value: "missing-tax-id", labelKey: "supplier.missingTaxId" },
  { value: "has-email", labelKey: "supplier.hasEmail" },
  { value: "has-phone", labelKey: "supplier.hasPhone" },
  { value: "has-note", labelKey: "supplier.hasNote" },
];

function createSupplier(overrides = {}) {
  return {
    id: `supplier-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    companyName: "",
    procurementName: "",
    procurementTel: "",
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

const defaultSuppliers = [
  createSupplier({
    id: "supplier-1",
    companyName: "Bangkok Office Supply",
    procurementName: "Nattapong Srisai",
    procurementTel: "02-123-4567",
    locations: ["Bangkok HQ", "Lat Krabang Branch", "Nonthaburi Warehouse"],
    selectedLocationIndex: 0,
    emails: ["sales@bangkokoffice.co.th", "support@bangkokoffice.co.th"],
    selectedEmailIndex: 0,
    tels: ["02-123-4567", "081-234-5678"],
    selectedTelIndex: 0,
    taxpayerId: "0105559032145",
    branches: ["Head Office", "Branch 01"],
    selectedBranchIndex: 0,
    shippingAddresses: [
      "89/12 Ratchadaphisek Road, Din Daeng, Bangkok 10400",
      "12 Motorway Road, Lat Krabang, Bangkok 10520",
    ],
    selectedShippingAddressIndex: 0,
    remark: "Primary supplier for stationery and semester opening stock.",
    termType: "credit",
    billingNoteDate: "30 days",
  }),
  createSupplier({
    id: "supplier-2",
    companyName: "Learning Tools Co.",
    procurementName: "Mayuree Tan",
    procurementTel: "035-555-220",
    locations: ["Pathum Thani Office", "Ayutthaya Fulfillment Center"],
    selectedLocationIndex: 0,
    emails: ["contact@learningtools.co.th"],
    selectedEmailIndex: 0,
    tels: ["035-555-220"],
    selectedTelIndex: 0,
    taxpayerId: "0135562009981",
    branches: ["Branch 02"],
    selectedBranchIndex: 0,
    shippingAddresses: ["144 Rangsit-Nakhon Nayok Road, Thanyaburi, Pathum Thani 12110"],
    selectedShippingAddressIndex: 0,
    remark: "Handles whiteboard tools and teaching accessories.",
    termType: "credit",
    billingNoteDate: "60 days",
  }),
  createSupplier({
    id: "supplier-3",
    companyName: "Eco Paper Mart",
    procurementName: "Krit Phanich",
    procurementTel: "02-745-1188",
    locations: ["Samut Prakan Depot", "Bang Na Sales Office"],
    selectedLocationIndex: 1,
    emails: ["orders@ecopapermart.co.th", "accounts@ecopapermart.co.th"],
    selectedEmailIndex: 0,
    tels: ["02-745-1188", "085-222-4411"],
    selectedTelIndex: 0,
    taxpayerId: "0115564007782",
    branches: ["Head Office", "Warehouse 02"],
    selectedBranchIndex: 1,
    shippingAddresses: [
      "55 Debaratna Road, Bang Na, Bangkok 10260",
      "88/4 Phraeksa Mai, Mueang Samut Prakan 10280",
    ],
    selectedShippingAddressIndex: 1,
    remark: "Best source for bulk paper goods and notebook cartons.",
    termType: "debit",
    billingNoteDate: "",
  }),
  createSupplier({
    id: "supplier-4",
    companyName: "Metro Storage & Filing",
    procurementName: "Siriporn W.",
    procurementTel: "086-678-9900",
    locations: ["Rama III Showroom", "Min Buri Warehouse"],
    selectedLocationIndex: 0,
    emails: ["sales@metrostorage.example", "dispatch@metrostorage.example"],
    selectedEmailIndex: 0,
    tels: ["02-678-9900", "086-678-9900"],
    selectedTelIndex: 1,
    taxpayerId: "0105561012459",
    branches: ["Head Office"],
    selectedBranchIndex: 0,
    shippingAddresses: ["401 Rama III Road, Yannawa, Bangkok 10120"],
    selectedShippingAddressIndex: 0,
    remark: "Used for binders, file folders, and archive accessories.",
    termType: "credit",
    billingNoteDate: "30 days",
  }),
  createSupplier({
    id: "supplier-5",
    companyName: "Classroom Essentials Ltd.",
    procurementName: "Anan Chaiyaporn",
    procurementTel: "053-220-441",
    locations: ["Chiang Mai Office", "Lampang Cross-dock"],
    selectedLocationIndex: 0,
    emails: ["support@classroomessentials.co.th"],
    selectedEmailIndex: 0,
    tels: ["053-220-441"],
    selectedTelIndex: 0,
    taxpayerId: "0505565001137",
    branches: ["Northern Branch"],
    selectedBranchIndex: 0,
    shippingAddresses: ["199 Huay Kaew Road, Mueang Chiang Mai 50200"],
    selectedShippingAddressIndex: 0,
    remark: "Backup supplier for classroom consumables and urgent replenishment.",
    termType: "debit",
    billingNoteDate: "",
  }),
];

export function getDefaultSuppliers() {
  return defaultSuppliers.map((supplier) => normalizeSupplier(supplier));
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

function normalizeSupplier(supplier) {
  const locations = coerceList(supplier.locations);
  const emails = coerceList(supplier.emails);
  const tels = coerceList(supplier.tels);
  const branches = coerceList(supplier.branches);
  const shippingAddresses = coerceList(supplier.shippingAddresses);

  return {
    id: supplier.id || createSupplier().id,
    companyName: `${supplier.companyName ?? ""}`,
    procurementName: `${supplier.procurementName ?? ""}`,
    procurementTel: `${supplier.procurementTel ?? ""}`,
    locations,
    selectedLocationIndex: clampIndex(locations, supplier.selectedLocationIndex),
    emails,
    selectedEmailIndex: clampIndex(emails, supplier.selectedEmailIndex),
    tels,
    selectedTelIndex: clampIndex(tels, supplier.selectedTelIndex),
    taxpayerId: `${supplier.taxpayerId ?? ""}`,
    branches,
    selectedBranchIndex: clampIndex(branches, supplier.selectedBranchIndex),
    shippingAddresses,
    selectedShippingAddressIndex: clampIndex(
      shippingAddresses,
      supplier.selectedShippingAddressIndex
    ),
    remark: `${supplier.remark ?? ""}`,
    termType: supplier.termType ?? "",
    billingNoteDate: `${supplier.billingNoteDate ?? ""}`,
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

const SUPPLIER_REQUIRED_FIELD_KEYS = {
  companyName: "supplier.companyNameLabel",
  procurementName: "supplier.procurementNameLabel",
  procurementTel: "supplier.procurementTelLabel",
  taxpayerId: "supplier.taxpayerLabel",
  termType: "supplier.paymentTermLabel",
  billingNoteDate: "supplier.creditTermLabel",
};

const SUPPLIER_REQUIRED_OPTION_KEYS = {
  branches: "supplier.branchLabel",
  locations: "supplier.locationLabel",
  emails: "supplier.emailLabel",
  tels: "supplier.telLabel",
  shippingAddresses: "supplier.shippingLabel",
};

const SUPPLIER_OPTION_INDEX_KEYS = {
  branches: "selectedBranchIndex",
  locations: "selectedLocationIndex",
  emails: "selectedEmailIndex",
  tels: "selectedTelIndex",
  shippingAddresses: "selectedShippingAddressIndex",
};

function getSupplierOptionError(listKey, value, t) {
  return (
    getRequiredFieldError(t(SUPPLIER_REQUIRED_OPTION_KEYS[listKey]), value) ||
    getContactFieldError(listKey, value)
  );
}

function getSupplierTextFieldError(key, value, t) {
  if (key === "remark") {
    return "";
  }

  const requiredError = getRequiredFieldError(t(SUPPLIER_REQUIRED_FIELD_KEYS[key]), value);

  if (requiredError) {
    return requiredError;
  }

  if (key === "procurementTel" && !isValidTel(value)) {
    return "Enter a valid telephone number.";
  }

  return "";
}

function getFirstInvalidSupplierOptionIndex(supplier, listKey, t) {
  return (supplier[listKey] || []).findIndex((value) => getSupplierOptionError(listKey, value, t));
}

function getSupplierFormErrors(supplier, t) {
  return {
    companyName: getRequiredFieldError(t(SUPPLIER_REQUIRED_FIELD_KEYS.companyName), supplier.companyName),
    procurementName: getRequiredFieldError(
      t(SUPPLIER_REQUIRED_FIELD_KEYS.procurementName),
      supplier.procurementName
    ),
    procurementTel: getSupplierTextFieldError("procurementTel", supplier.procurementTel, t),
    taxpayerId: getRequiredFieldError(t(SUPPLIER_REQUIRED_FIELD_KEYS.taxpayerId), supplier.taxpayerId),
    branches:
      getRequiredListError(t(SUPPLIER_REQUIRED_OPTION_KEYS.branches), supplier.branches) ||
      (supplier.branches || []).map((value) => getSupplierOptionError("branches", value, t)).find(Boolean) ||
      "",
    locations:
      getRequiredListError(t(SUPPLIER_REQUIRED_OPTION_KEYS.locations), supplier.locations) ||
      (supplier.locations || []).map((value) => getSupplierOptionError("locations", value, t)).find(Boolean) ||
      "",
    emails:
      getRequiredListError(t(SUPPLIER_REQUIRED_OPTION_KEYS.emails), supplier.emails) ||
      (supplier.emails || []).map((value) => getSupplierOptionError("emails", value, t)).find(Boolean) ||
      "",
    tels:
      getRequiredListError(t(SUPPLIER_REQUIRED_OPTION_KEYS.tels), supplier.tels) ||
      (supplier.tels || []).map((value) => getSupplierOptionError("tels", value, t)).find(Boolean) ||
      "",
    shippingAddresses:
      getRequiredListError(t(SUPPLIER_REQUIRED_OPTION_KEYS.shippingAddresses), supplier.shippingAddresses) ||
      (supplier.shippingAddresses || [])
        .map((value) => getSupplierOptionError("shippingAddresses", value, t))
        .find(Boolean) ||
      "",
    termType: getRequiredFieldError(t(SUPPLIER_REQUIRED_FIELD_KEYS.termType), supplier.termType),
    billingNoteDate:
      supplier.termType === "credit"
        ? getRequiredFieldError(t(SUPPLIER_REQUIRED_FIELD_KEYS.billingNoteDate), supplier.billingNoteDate)
        : "",
  };
}

function hasFormErrors(errors) {
  return Object.values(errors).some(Boolean);
}

function SupplierOptionField({
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

function SupplierPage({
  suppliers = defaultSuppliers,
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
  const shouldShowViewAll =
    !isServerPaginated && filteredSuppliers.length > compactRows;
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
      setProfileFilter((current) =>
        current === option.value ? "all" : option.value
      ),
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
      t("supplier.deleteConfirm", { name: draftSupplier.companyName || t("supplier.unnamedSupplier") })
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
                ? t("supplier.pageCountServer", { count: filteredSuppliers.length, total: totalSupplierCount })
                : t("supplier.pageCountLocal", { count: filteredSuppliers.length, total: suppliers.length })}
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

      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("supplier.historyEyebrow")}</p>
            <h3>{t("supplier.historyTitle")}</h3>
          </div>
          <div className="transaction-table-actions">
            <button className="primary-button" type="button" onClick={handleCreateSupplier}>
              {t("supplier.newSupplier")}
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

        {filteredSuppliers.length === 0 ? (
          <p className="empty-copy">{t("supplier.noMatch")}</p>
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
                    <th>{t("supplier.colSupplier")}</th>
                    <th>{t("supplier.colContact")}</th>
                    <th>{t("supplier.colLocation")}</th>
                    <th>{t("supplier.colProfile")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filteredSuppliers.map((supplier, index) => {
                    const isActive = supplier.id === selectedSupplierId;

                    return (
                      <tr
                        key={supplier.id}
                        className={isActive ? "partner-table-row active" : "partner-table-row"}
                      >
                        <td className="table-index-cell">{index + 1}</td>
                        <td>
                          <div className="transaction-reference-cell">
                            <strong>{supplier.companyName || t("supplier.unnamedSupplier")}</strong>
                            <span>
                              {supplier.taxpayerId ? t("supplier.taxIdLabel", { id: supplier.taxpayerId }) : t("supplier.taxIdNotSet")}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="cell-stack">
                            <strong>{supplier.procurementName || "-"}</strong>
                            <span>{supplier.procurementTel || "-"}</span>
                          </div>
                        </td>
                        <td>
                          <div className="cell-stack">
                            <strong>
                              {getSelectedValue(supplier.locations, supplier.selectedLocationIndex)}
                            </strong>
                            <span>
                              {getSelectedValue(
                                supplier.shippingAddresses,
                                supplier.selectedShippingAddressIndex
                              )}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="cell-stack">
                            <strong>
                              {getSelectedValue(supplier.branches, supplier.selectedBranchIndex)}
                            </strong>
                            <span>{supplier.remark || supplier.billingNoteDate || t("supplier.noInternalNote")}</span>
                          </div>
                        </td>
                        <td>
                          <button
                            className="table-action-button"
                            type="button"
                            onClick={() => openSupplierEditor(supplier)}
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
              {filteredSuppliers.map((supplier, index) => (
                <article className="mobile-record-card" key={`mobile-supplier-${supplier.id}`}>
                  <div className="mobile-record-header">
                    <div className="mobile-record-title">
                      <span className="mobile-record-index">{index + 1}</span>
                      <div className="cell-stack">
                        <strong>{supplier.companyName || t("supplier.unnamedSupplier")}</strong>
                        <span>
                          {supplier.taxpayerId ? t("supplier.taxIdLabel", { id: supplier.taxpayerId }) : t("supplier.taxIdNotSet")}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mobile-record-grid">
                    <div>
                      <span>{t("supplier.colProcurementName")}</span>
                      <strong>{supplier.procurementName || "-"}</strong>
                    </div>
                    <div>
                      <span>{t("supplier.colProcurementTel")}</span>
                      <strong>{supplier.procurementTel || "-"}</strong>
                    </div>
                    <div>
                      <span>{t("supplier.colLocation")}</span>
                      <strong>{getSelectedValue(supplier.locations, supplier.selectedLocationIndex)}</strong>
                    </div>
                    <div>
                      <span>{t("supplier.colBranch")}</span>
                      <strong>{getSelectedValue(supplier.branches, supplier.selectedBranchIndex)}</strong>
                    </div>
                  </div>

                  <button
                    className="secondary-button table-action-button mobile-record-button"
                    type="button"
                    onClick={() => openSupplierEditor(supplier)}
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
          itemLabel={t("supplier.historyTitle")}
          onPageChange={(page) => onPageRequest?.(getPageRequestParams(page))}
        />
      </section>

      {draftSupplier ? (
        <div className="modal-backdrop">
          <div
            className="detail-modal supplier-modal contact-editor-modal section-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="supplier-modal-title"
          >
            <div className="section-heading supplier-modal-header">
              <div>
                <p className="eyebrow">{t("supplier.detailsEyebrow")}</p>
                <h3 id="supplier-modal-title">
                  {draftSupplier.companyName || t("supplier.newSupplier")}
                </h3>
              </div>
              <button
                className="icon-button subtle"
                type="button"
                aria-label={t("supplier.closeLabel")}
                onClick={closeSupplierEditor}
              >
                X
              </button>
            </div>

            <form
              className="form-layout"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                handleSaveSupplier();
              }}
            >
              <div className="contact-editor-layout supplier-contact-editor-layout">
                <section className="contact-editor-section">
                  <div className="contact-editor-section-heading">
                    <div>
                      <p className="eyebrow">{t("supplier.identityEyebrow")}</p>
                      <h4>{t("supplier.identityTitle")}</h4>
                    </div>
                    <span>{t("supplier.identityDescription")}</span>
                  </div>

                  <div className="contact-editor-grid">
                    <label>
                      <span className="required-label">{t("supplier.companyNameLabel")}</span>
                      <input
                        autoFocus
                        required
                        value={draftSupplier.companyName}
                        onChange={(event) => updateTextField("companyName", event.target.value)}
                        placeholder={t("supplier.companyNamePlaceholder")}
                        aria-invalid={formErrors.companyName ? "true" : undefined}
                      />
                      {formErrors.companyName ? (
                        <span className="field-error-text">{formErrors.companyName}</span>
                      ) : null}
                    </label>

                    <label>
                      <span className="required-label">{t("supplier.taxpayerLabel")}</span>
                      <input
                        required
                        value={draftSupplier.taxpayerId}
                        onChange={(event) => updateTextField("taxpayerId", event.target.value)}
                        placeholder={t("supplier.taxpayerPlaceholder")}
                        aria-invalid={formErrors.taxpayerId ? "true" : undefined}
                      />
                      {formErrors.taxpayerId ? (
                        <span className="field-error-text">{formErrors.taxpayerId}</span>
                      ) : null}
                    </label>

                    <div className="full-width">
                      <SupplierOptionField
                        label={t("supplier.branchLabel")}
                        options={draftSupplier.branches}
                        selectedIndex={draftSupplier.selectedBranchIndex}
                        placeholder={t("supplier.branchPlaceholder")}
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
                      <p className="eyebrow">{t("supplier.procurementEyebrow")}</p>
                      <h4>{t("supplier.procurementTitle")}</h4>
                    </div>
                    <span>{t("supplier.procurementDescription")}</span>
                  </div>

                  <div className="contact-editor-grid">
                    <label>
                      <span className="required-label">{t("supplier.procurementNameLabel")}</span>
                      <input
                        required
                        value={draftSupplier.procurementName}
                        onChange={(event) =>
                          updateTextField("procurementName", event.target.value)
                        }
                        placeholder={t("supplier.procurementNamePlaceholder")}
                        aria-invalid={formErrors.procurementName ? "true" : undefined}
                      />
                      {formErrors.procurementName ? (
                        <span className="field-error-text">{formErrors.procurementName}</span>
                      ) : null}
                    </label>

                    <label>
                      <span className="required-label">{t("supplier.procurementTelLabel")}</span>
                      <input
                        required
                        type="tel"
                        value={draftSupplier.procurementTel}
                        onChange={(event) =>
                          updateTextField("procurementTel", event.target.value)
                        }
                        placeholder={t("supplier.procurementTelPlaceholder")}
                        aria-invalid={formErrors.procurementTel ? "true" : undefined}
                      />
                      {formErrors.procurementTel ? (
                        <span className="field-error-text">{formErrors.procurementTel}</span>
                      ) : null}
                    </label>
                  </div>
                </section>

                <section className="contact-editor-section">
                  <div className="contact-editor-section-heading">
                    <div>
                      <p className="eyebrow">{t("supplier.contactEyebrow")}</p>
                      <h4>{t("supplier.contactTitle")}</h4>
                    </div>
                    <span>{t("supplier.contactDescription")}</span>
                  </div>

                  <div className="contact-editor-grid">
                    <SupplierOptionField
                      label={t("supplier.locationLabel")}
                      options={draftSupplier.locations}
                      selectedIndex={draftSupplier.selectedLocationIndex}
                      placeholder={t("supplier.locationPlaceholder")}
                      required
                      error={formErrors.locations}
                      onSelect={(nextIndex) => updateOptionIndex("selectedLocationIndex", nextIndex)}
                      onChange={(nextValue) =>
                        updateOptionValue("locations", "selectedLocationIndex", nextValue)
                      }
                      onAdd={() => addOption("locations", "selectedLocationIndex")}
                      onDelete={() => deleteOption("locations", "selectedLocationIndex")}
                    />

                    <SupplierOptionField
                      label={t("supplier.emailLabel")}
                      options={draftSupplier.emails}
                      selectedIndex={draftSupplier.selectedEmailIndex}
                      placeholder={t("supplier.emailPlaceholder")}
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
                      <SupplierOptionField
                        label={t("supplier.telLabel")}
                        options={draftSupplier.tels}
                        selectedIndex={draftSupplier.selectedTelIndex}
                        placeholder={t("supplier.telPlaceholder")}
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
                      <p className="eyebrow">{t("supplier.deliveryEyebrow")}</p>
                      <h4>{t("supplier.deliveryTitle")}</h4>
                    </div>
                    <span>{t("supplier.deliveryDescription")}</span>
                  </div>

                  <div className="contact-editor-grid">
                    <div className="full-width">
                      <SupplierOptionField
                        label={t("supplier.shippingLabel")}
                        options={draftSupplier.shippingAddresses}
                        selectedIndex={draftSupplier.selectedShippingAddressIndex}
                        placeholder={t("supplier.shippingPlaceholder")}
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
                      {t("supplier.remarkLabel")}
                      <textarea
                        rows="4"
                        value={draftSupplier.remark}
                        onChange={(event) => updateTextField("remark", event.target.value)}
                        placeholder={t("supplier.remarkPlaceholder")}
                      />
                    </label>

                    <label>
                      <span className="required-label">{t("supplier.paymentTermLabel")}</span>
                      <select
                        required
                        value={draftSupplier.termType}
                        onChange={(event) => {
                          const next = event.target.value;
                          updateDraftSupplier((s) => ({
                            ...s,
                            termType: next,
                            billingNoteDate: next === "debit" ? "" : s.billingNoteDate,
                          }));
                          setFormErrors((currentErrors) => ({
                            ...currentErrors,
                            termType: getRequiredFieldError(
                              t(SUPPLIER_REQUIRED_FIELD_KEYS.termType),
                              next
                            ),
                            billingNoteDate:
                              next === "credit"
                                ? getRequiredFieldError(
                                    t(SUPPLIER_REQUIRED_FIELD_KEYS.billingNoteDate),
                                    draftSupplier.billingNoteDate
                                  )
                                : "",
                          }));
                        }}
                        aria-invalid={formErrors.termType ? "true" : undefined}
                      >
                        <option value="">{t("supplier.selectPaymentTerm")}</option>
                        <option value="debit">{t("supplier.termDebit")}</option>
                        <option value="credit">{t("supplier.termCredit")}</option>
                      </select>
                      {formErrors.termType ? (
                        <span className="field-error-text">{formErrors.termType}</span>
                      ) : null}
                    </label>

                    {draftSupplier.termType === "credit" && (
                      <label>
                        <span className="required-label">{t("supplier.creditTermLabel")}</span>
                        <select
                          required
                          value={draftSupplier.billingNoteDate}
                          onChange={(event) => updateTextField("billingNoteDate", event.target.value)}
                          aria-invalid={formErrors.billingNoteDate ? "true" : undefined}
                        >
                          <option value="">{t("supplier.selectCreditTerm")}</option>
                          <option value="30 days">{t("supplier.days30")}</option>
                          <option value="60 days">{t("supplier.days60")}</option>
                          <option value="90 days">{t("supplier.days90")}</option>
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
                <button className="danger-button" type="button" onClick={handleDeleteSupplier}>
                  {t("supplier.deleteButton")}
                </button>
                <button className="secondary-button" type="button" onClick={closeSupplierEditor}>
                  {t("common.cancel")}
                </button>
                <button className="primary-button" type="submit">
                  {t("supplier.saveButton")}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default SupplierPage;
