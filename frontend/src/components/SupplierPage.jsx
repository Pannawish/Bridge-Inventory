import { useEffect, useMemo, useState } from "react";
import PaginationControls from "./PaginationControls";
import {
  getContactFieldError,
  getFirstInvalidContactIndex,
  getContactListErrors,
  hasContactErrors,
} from "./contactValidation";

function createSupplier(overrides = {}) {
  return {
    id: `supplier-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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

const defaultSuppliers = [
  createSupplier({
    id: "supplier-1",
    companyName: "Bangkok Office Supply",
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
  if (indexKey === "selectedEmailIndex") {
    return "emails";
  }

  if (indexKey === "selectedTelIndex") {
    return "tels";
  }

  return "";
}

function SupplierOptionField({
  label,
  options,
  selectedIndex,
  placeholder,
  type = "text",
  error = "",
  onSelect,
  onChange,
  onAdd,
  onDelete,
}) {
  return (
    <div className="supplier-option-field">
      <label>
        {label}
        <select value={selectedIndex} onChange={(event) => onSelect(Number(event.target.value))}>
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
          value={options[selectedIndex] || ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-invalid={error ? "true" : undefined}
        />
        <div className="supplier-option-edit-actions">
          <button className="secondary-button" type="button" onClick={onAdd}>
            Add
          </button>
          <button className="danger-button" type="button" onClick={onDelete}>
            Delete
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
  const [selectedSupplierId, setSelectedSupplierId] = useState(null);
  const [draftSupplier, setDraftSupplier] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [profileFilter, setProfileFilter] = useState("all");
  const [showAllRows, setShowAllRows] = useState(false);
  const [contactErrors, setContactErrors] = useState({ emails: "", tels: "" });

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

  function openSupplierEditor(supplier) {
    setSelectedSupplierId(supplier.id);
    setDraftSupplier(normalizeSupplier(supplier));
    setContactErrors({ emails: "", tels: "" });
  }

  function closeSupplierEditor() {
    setDraftSupplier(null);
    setContactErrors({ emails: "", tels: "" });
  }

  function updateDraftSupplier(updater) {
    setDraftSupplier((currentSupplier) =>
      currentSupplier ? normalizeSupplier(updater(currentSupplier)) : currentSupplier
    );
  }

  function updateTextField(key, value) {
    updateDraftSupplier((supplier) => ({ ...supplier, [key]: value }));
  }

  function updateOptionIndex(indexKey, nextIndex) {
    updateDraftSupplier((supplier) => ({ ...supplier, [indexKey]: nextIndex }));

    const listKey = getContactListKeyForIndex(indexKey);
    if (listKey && draftSupplier) {
      setContactErrors((currentErrors) => ({
        ...currentErrors,
        [listKey]: getContactFieldError(listKey, draftSupplier[listKey]?.[nextIndex] || ""),
      }));
    }
  }

  function updateOptionValue(listKey, indexKey, nextValue) {
    updateDraftSupplier((supplier) => {
      const nextOptions = [...supplier[listKey]];
      nextOptions[supplier[indexKey]] = nextValue;
      return { ...supplier, [listKey]: nextOptions };
    });

    if (listKey === "emails" || listKey === "tels") {
      setContactErrors((currentErrors) => ({
        ...currentErrors,
        [listKey]: getContactFieldError(listKey, nextValue),
      }));
    }
  }

  function addOption(listKey, indexKey) {
    if ((listKey === "emails" || listKey === "tels") && draftSupplier) {
      const currentValue = draftSupplier[listKey]?.[draftSupplier[indexKey]] || "";
      const error = getContactFieldError(listKey, currentValue);

      if (error) {
        setContactErrors((currentErrors) => ({
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

    if (listKey === "emails" || listKey === "tels") {
      setContactErrors((currentErrors) => ({
        ...currentErrors,
        [listKey]: "",
      }));
    }
  }

  function handleCreateSupplier() {
    setContactErrors({ emails: "", tels: "" });
    setDraftSupplier(
      createSupplier({
        companyName: `New Supplier ${allSuppliers.length + 1}`,
      })
    );
  }

  async function handleSaveSupplier() {
    if (!draftSupplier) {
      return;
    }

    const nextSupplier = normalizeSupplier(draftSupplier);
    const nextContactErrors = getContactListErrors(nextSupplier);

    if (hasContactErrors(nextContactErrors)) {
      const invalidEmailIndex = getFirstInvalidContactIndex(nextSupplier, "emails");
      const invalidTelIndex = getFirstInvalidContactIndex(nextSupplier, "tels");

      setDraftSupplier({
        ...nextSupplier,
        selectedEmailIndex:
          invalidEmailIndex >= 0 ? invalidEmailIndex : nextSupplier.selectedEmailIndex,
        selectedTelIndex:
          invalidTelIndex >= 0 ? invalidTelIndex : nextSupplier.selectedTelIndex,
      });
      setContactErrors(nextContactErrors);
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
      `Delete supplier ${draftSupplier.companyName || "this supplier"}?`
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
            <p className="eyebrow">Suppliers</p>
            <h3>Find Suppliers</h3>
          </div>
        </div>

        <div className="supplier-directory-toolbar">
          <label className="stock-search supplier-search">
            <span className="stock-search-icon">S</span>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search supplier, taxpayer ID, location, email, or tel"
            />
          </label>
          <div className="stock-report-summary supplier-search-meta">
            <span>
              {isServerPaginated
                ? `${filteredSuppliers.length} on this page of ${totalSupplierCount} suppliers`
                : `${filteredSuppliers.length} of ${suppliers.length} suppliers shown`}
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
            Filter
            {activeFilterCount ? <span>{activeFilterCount}</span> : null}
          </button>
          <button className="secondary-button" type="button" onClick={resetFilters}>
            Reset Filter
          </button>
        </div>

        {filterOpen ? (
          <div className="history-filter-panel">
            <div className="history-filter-grid">
              <label className="history-filter-field">
                <span className="history-filter-title">Supplier Profile</span>
                <select
                  value={profileFilter}
                  onChange={(event) => setProfileFilter(event.target.value)}
                >
                  <option value="all">All suppliers</option>
                  <option value="missing-tax-id">Missing tax ID</option>
                  <option value="has-email">Has email</option>
                  <option value="has-phone">Has phone</option>
                  <option value="has-note">Has internal note</option>
                </select>
              </label>
            </div>
          </div>
        ) : null}
      </section>

      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">History</p>
            <h3>Suppliers</h3>
          </div>
          <div className="transaction-table-actions">
            <button className="primary-button" type="button" onClick={handleCreateSupplier}>
              New Supplier
            </button>
            {shouldShowViewAll ? (
              <button
                className="secondary-button"
                type="button"
                onClick={() => setShowAllRows((currentValue) => !currentValue)}
              >
                {showAllRows ? "Show Recent" : "View More"}
              </button>
            ) : null}
          </div>
        </div>

        {filteredSuppliers.length === 0 ? (
          <p className="empty-copy">No suppliers match the current search.</p>
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
                    <th>Supplier</th>
                    <th>Contact</th>
                    <th>Location</th>
                    <th>Profile</th>
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
                            <strong>{supplier.companyName || "Unnamed Supplier"}</strong>
                            <span>
                              {supplier.taxpayerId ? `Tax ID ${supplier.taxpayerId}` : "Tax ID not set"}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="cell-stack">
                            <strong>
                              {getSelectedValue(supplier.emails, supplier.selectedEmailIndex)}
                            </strong>
                            <span>{getSelectedValue(supplier.tels, supplier.selectedTelIndex)}</span>
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
                            <span>{supplier.remark || supplier.billingNoteDate || "No internal note"}</span>
                          </div>
                        </td>
                        <td>
                          <button
                            className="table-action-button"
                            type="button"
                            onClick={() => openSupplierEditor(supplier)}
                          >
                            View
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
                        <strong>{supplier.companyName || "Unnamed Supplier"}</strong>
                        <span>
                          {supplier.taxpayerId ? `Tax ID ${supplier.taxpayerId}` : "Tax ID not set"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mobile-record-grid">
                    <div>
                      <span>Email</span>
                      <strong>{getSelectedValue(supplier.emails, supplier.selectedEmailIndex)}</strong>
                    </div>
                    <div>
                      <span>Phone</span>
                      <strong>{getSelectedValue(supplier.tels, supplier.selectedTelIndex)}</strong>
                    </div>
                    <div>
                      <span>Location</span>
                      <strong>{getSelectedValue(supplier.locations, supplier.selectedLocationIndex)}</strong>
                    </div>
                    <div>
                      <span>Branch</span>
                      <strong>{getSelectedValue(supplier.branches, supplier.selectedBranchIndex)}</strong>
                    </div>
                  </div>

                  <button
                    className="secondary-button table-action-button mobile-record-button"
                    type="button"
                    onClick={() => openSupplierEditor(supplier)}
                  >
                    View
                  </button>
                </article>
              ))}
            </div>
          </div>
        )}
        <PaginationControls
          pagination={pagination}
          itemLabel="suppliers"
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
                <p className="eyebrow">Supplier Details</p>
                <h3 id="supplier-modal-title">
                  {draftSupplier.companyName || "New Supplier"}
                </h3>
              </div>
              <button
                className="icon-button subtle"
                type="button"
                aria-label="Close supplier details"
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
              <div className="contact-editor-layout">
                <section className="contact-editor-section">
                  <div className="contact-editor-section-heading">
                    <div>
                      <p className="eyebrow">Company</p>
                      <h4>Supplier Identity</h4>
                    </div>
                    <span>Required profile</span>
                  </div>

                  <div className="contact-editor-grid">
                    <label>
                      Supplier Company Name
                      <input
                        autoFocus
                        value={draftSupplier.companyName}
                        onChange={(event) => updateTextField("companyName", event.target.value)}
                        placeholder="Supplier company name"
                      />
                    </label>

                    <label>
                      Supplier Taxpayer Identification Number
                      <input
                        value={draftSupplier.taxpayerId}
                        onChange={(event) => updateTextField("taxpayerId", event.target.value)}
                        placeholder="Taxpayer identification number"
                      />
                    </label>

                    <div className="full-width">
                      <SupplierOptionField
                        label="Supplier Branch"
                        options={draftSupplier.branches}
                        selectedIndex={draftSupplier.selectedBranchIndex}
                        placeholder="Add or edit a branch"
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
                      <p className="eyebrow">Contact</p>
                      <h4>Location, Email, and Telephone</h4>
                    </div>
                    <span>Communication</span>
                  </div>

                  <div className="contact-editor-grid">
                    <SupplierOptionField
                      label="Supplier Company Location"
                      options={draftSupplier.locations}
                      selectedIndex={draftSupplier.selectedLocationIndex}
                      placeholder="Add or edit a company location"
                      onSelect={(nextIndex) => updateOptionIndex("selectedLocationIndex", nextIndex)}
                      onChange={(nextValue) =>
                        updateOptionValue("locations", "selectedLocationIndex", nextValue)
                      }
                      onAdd={() => addOption("locations", "selectedLocationIndex")}
                      onDelete={() => deleteOption("locations", "selectedLocationIndex")}
                    />

                    <SupplierOptionField
                      label="Supplier Email"
                      options={draftSupplier.emails}
                      selectedIndex={draftSupplier.selectedEmailIndex}
                      placeholder="Add or edit an email"
                      type="email"
                      error={contactErrors.emails}
                      onSelect={(nextIndex) => updateOptionIndex("selectedEmailIndex", nextIndex)}
                      onChange={(nextValue) =>
                        updateOptionValue("emails", "selectedEmailIndex", nextValue)
                      }
                      onAdd={() => addOption("emails", "selectedEmailIndex")}
                      onDelete={() => deleteOption("emails", "selectedEmailIndex")}
                    />

                    <div className="full-width">
                      <SupplierOptionField
                        label="Supplier Tel"
                        options={draftSupplier.tels}
                        selectedIndex={draftSupplier.selectedTelIndex}
                        placeholder="Add or edit a telephone number"
                        type="tel"
                        error={contactErrors.tels}
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
                      <p className="eyebrow">Delivery & Billing</p>
                      <h4>Shipping Address and Notes</h4>
                    </div>
                    <span>Operations</span>
                  </div>

                  <div className="contact-editor-grid">
                    <div className="full-width">
                      <SupplierOptionField
                        label="Shipping Address"
                        options={draftSupplier.shippingAddresses}
                        selectedIndex={draftSupplier.selectedShippingAddressIndex}
                        placeholder="Add or edit a shipping address"
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
                      Remark
                      <textarea
                        rows="4"
                        value={draftSupplier.remark}
                        onChange={(event) => updateTextField("remark", event.target.value)}
                        placeholder="Internal note about this supplier"
                      />
                    </label>

                    <label>
                      Payment Term
                      <select
                        value={draftSupplier.termType}
                        onChange={(event) => {
                          const next = event.target.value;
                          updateDraftSupplier((s) => ({
                            ...s,
                            termType: next,
                            billingNoteDate: next === "debit" ? "" : s.billingNoteDate,
                          }));
                        }}
                      >
                        <option value="">— Select payment term —</option>
                        <option value="debit">Debit</option>
                        <option value="credit">Credit</option>
                      </select>
                    </label>

                    {draftSupplier.termType === "credit" && (
                      <label>
                        Credit Term
                        <select
                          value={draftSupplier.billingNoteDate}
                          onChange={(event) => updateTextField("billingNoteDate", event.target.value)}
                        >
                          <option value="">— Select credit term —</option>
                          <option value="30 days">30 days</option>
                          <option value="60 days">60 days</option>
                          <option value="90 days">90 days</option>
                        </select>
                      </label>
                    )}
                  </div>
                </section>
              </div>

              <div className="supplier-modal-actions">
                <button className="danger-button" type="button" onClick={handleDeleteSupplier}>
                  Delete Supplier
                </button>
                <button className="secondary-button" type="button" onClick={closeSupplierEditor}>
                  Cancel
                </button>
                <button className="primary-button" type="submit">
                  Save Supplier
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
