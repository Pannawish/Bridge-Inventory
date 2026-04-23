import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "inventory-management-suppliers";

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
    billingNoteDate: "Billing note received every Friday after supplier delivery confirmation.",
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
    billingNoteDate: "Billing note should include PO reference and expected delivery date.",
  }),
];

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
    billingNoteDate: `${supplier.billingNoteDate ?? ""}`,
  };
}

function loadSuppliers() {
  if (typeof window === "undefined") {
    return defaultSuppliers;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return defaultSuppliers;
    }

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed) || parsed.length === 0) {
      return defaultSuppliers;
    }

    return parsed.map(normalizeSupplier);
  } catch {
    return defaultSuppliers;
  }
}

function getSelectedValue(list, index) {
  return list?.[index] || "-";
}

function SupplierOptionField({
  label,
  options,
  selectedIndex,
  placeholder,
  type = "text",
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
    </div>
  );
}

function SupplierPage() {
  const [suppliers, setSuppliers] = useState(() => loadSuppliers());
  const [selectedSupplierId, setSelectedSupplierId] = useState(null);
  const [draftSupplier, setDraftSupplier] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(suppliers.map((supplier) => normalizeSupplier(supplier)))
    );
  }, [suppliers]);

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

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredSuppliers = useMemo(
    () =>
      suppliers.filter((supplier) => {
        if (!normalizedSearch) {
          return true;
        }

        return (
          supplier.companyName.toLowerCase().includes(normalizedSearch) ||
          supplier.taxpayerId.toLowerCase().includes(normalizedSearch) ||
          supplier.locations.some((item) => item.toLowerCase().includes(normalizedSearch)) ||
          supplier.emails.some((item) => item.toLowerCase().includes(normalizedSearch)) ||
          supplier.tels.some((item) => item.toLowerCase().includes(normalizedSearch))
        );
      }),
    [normalizedSearch, suppliers]
  );

  function openSupplierEditor(supplier) {
    setSelectedSupplierId(supplier.id);
    setDraftSupplier(normalizeSupplier(supplier));
  }

  function closeSupplierEditor() {
    setDraftSupplier(null);
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
  }

  function updateOptionValue(listKey, indexKey, nextValue) {
    updateDraftSupplier((supplier) => {
      const nextOptions = [...supplier[listKey]];
      nextOptions[supplier[indexKey]] = nextValue;
      return { ...supplier, [listKey]: nextOptions };
    });
  }

  function addOption(listKey, indexKey) {
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
  }

  function handleCreateSupplier() {
    setDraftSupplier(
      createSupplier({
        companyName: `New Supplier ${suppliers.length + 1}`,
      })
    );
  }

  function handleSaveSupplier() {
    if (!draftSupplier) {
      return;
    }

    const nextSupplier = normalizeSupplier(draftSupplier);
    const exists = suppliers.some((supplier) => supplier.id === nextSupplier.id);

    setSuppliers((currentSuppliers) =>
      exists
        ? currentSuppliers.map((supplier) =>
            supplier.id === nextSupplier.id ? nextSupplier : supplier
          )
        : [nextSupplier, ...currentSuppliers]
    );
    setSelectedSupplierId(nextSupplier.id);
    setDraftSupplier(null);
  }

  function handleDeleteSupplier() {
    if (!draftSupplier) {
      return;
    }

    const exists = suppliers.some((supplier) => supplier.id === draftSupplier.id);

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

    setSuppliers((currentSuppliers) =>
      currentSuppliers.filter((supplier) => supplier.id !== draftSupplier.id)
    );
    setSelectedSupplierId((currentId) =>
      currentId === draftSupplier.id ? null : currentId
    );
    setDraftSupplier(null);
  }

  const summary = {
    totalSuppliers: suppliers.length,
    totalLocations: suppliers.reduce(
      (sum, supplier) => sum + supplier.locations.filter((item) => item.trim()).length,
      0
    ),
    totalEmails: suppliers.reduce(
      (sum, supplier) => sum + supplier.emails.filter((item) => item.trim()).length,
      0
    ),
    totalPhones: suppliers.reduce(
      (sum, supplier) => sum + supplier.tels.filter((item) => item.trim()).length,
      0
    ),
  };

  return (
    <div className="stack-layout">
      <section className="inventory-summary-grid">
        <article className="inventory-summary-card">
          <span>Total suppliers</span>
          <strong>{summary.totalSuppliers}</strong>
        </article>
        <article className="inventory-summary-card">
          <span>Saved locations</span>
          <strong>{summary.totalLocations}</strong>
        </article>
        <article className="inventory-summary-card">
          <span>Saved emails</span>
          <strong>{summary.totalEmails}</strong>
        </article>
        <article className="inventory-summary-card">
          <span>Saved telephone numbers</span>
          <strong>{summary.totalPhones}</strong>
        </article>
      </section>

      <div className="supplier-layout">
        <section className="section-card supplier-directory-card">
          <div className="section-heading supplier-directory-heading">
            <div>
              <p className="eyebrow">Suppliers</p>
              <h3>Supplier List</h3>
            </div>
            <button className="primary-button" type="button" onClick={handleCreateSupplier}>
              New Supplier
            </button>
          </div>

          <p className="inventory-note">
            Store supplier details in the frontend for now. Changes are saved when you press the
            save button in the supplier popup.
          </p>

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
              <span>{filteredSuppliers.length} suppliers shown</span>
            </div>
          </div>

          <div className="supplier-directory-table" role="table" aria-label="Supplier list">
            {filteredSuppliers.length === 0 ? (
              <p className="empty-copy">No suppliers match the current search.</p>
            ) : (
              <>
                <div className="supplier-directory-head" role="row">
                  <span className="supplier-directory-column supplier-directory-index" role="columnheader">
                    #
                  </span>
                  <span className="supplier-directory-column" role="columnheader">
                    Supplier Company Name
                  </span>
                  <span className="supplier-directory-column" role="columnheader">
                    Supplier Taxpayer Identification Number
                  </span>
                  <span className="supplier-directory-column" role="columnheader">
                    Supplier Email
                  </span>
                  <span className="supplier-directory-column" role="columnheader">
                    Supplier Tel
                  </span>
                </div>

                <div className="supplier-directory-body" role="rowgroup">
                  {filteredSuppliers.map((supplier, index) => {
                    const isActive = supplier.id === selectedSupplierId;

                    return (
                      <button
                        key={supplier.id}
                        type="button"
                        className={
                          isActive
                            ? "supplier-directory-row active"
                            : "supplier-directory-row"
                        }
                        onClick={() => openSupplierEditor(supplier)}
                        role="row"
                      >
                        <span className="supplier-directory-cell supplier-directory-index" role="cell">
                          <span className="supplier-directory-cell-label">#</span>
                          <strong className="supplier-directory-cell-value">{index + 1}</strong>
                        </span>

                        <span className="supplier-directory-cell" role="cell">
                          <span className="supplier-directory-cell-label">
                            Supplier Company Name
                          </span>
                          <strong className="supplier-directory-cell-value">
                            {supplier.companyName || "Unnamed Supplier"}
                          </strong>
                        </span>

                        <span className="supplier-directory-cell" role="cell">
                          <span className="supplier-directory-cell-label">
                            Supplier Taxpayer Identification Number
                          </span>
                          <span className="supplier-directory-cell-value">
                            {supplier.taxpayerId || "—"}
                          </span>
                        </span>

                        <span className="supplier-directory-cell" role="cell">
                          <span className="supplier-directory-cell-label">Supplier Email</span>
                          <span className="supplier-directory-cell-value">
                            {getSelectedValue(supplier.emails, supplier.selectedEmailIndex)}
                          </span>
                        </span>

                        <span className="supplier-directory-cell" role="cell">
                          <span className="supplier-directory-cell-label">Supplier Tel</span>
                          <span className="supplier-directory-cell-value">
                            {getSelectedValue(supplier.tels, supplier.selectedTelIndex)}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      {draftSupplier ? (
        <div className="modal-backdrop">
          <div
            className="detail-modal supplier-modal section-card"
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
              onSubmit={(event) => {
                event.preventDefault();
                handleSaveSupplier();
              }}
            >
              <div className="form-grid">
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
                  onSelect={(nextIndex) => updateOptionIndex("selectedEmailIndex", nextIndex)}
                  onChange={(nextValue) =>
                    updateOptionValue("emails", "selectedEmailIndex", nextValue)
                  }
                  onAdd={() => addOption("emails", "selectedEmailIndex")}
                  onDelete={() => deleteOption("emails", "selectedEmailIndex")}
                />

                <SupplierOptionField
                  label="Supplier Tel"
                  options={draftSupplier.tels}
                  selectedIndex={draftSupplier.selectedTelIndex}
                  placeholder="Add or edit a telephone number"
                  onSelect={(nextIndex) => updateOptionIndex("selectedTelIndex", nextIndex)}
                  onChange={(nextValue) =>
                    updateOptionValue("tels", "selectedTelIndex", nextValue)
                  }
                  onAdd={() => addOption("tels", "selectedTelIndex")}
                  onDelete={() => deleteOption("tels", "selectedTelIndex")}
                />

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

                <label className="full-width">
                  Remark
                  <textarea
                    rows="4"
                    value={draftSupplier.remark}
                    onChange={(event) => updateTextField("remark", event.target.value)}
                    placeholder="Internal note about this supplier"
                  />
                </label>

                <label className="full-width">
                  Billing Note Date
                  <textarea
                    rows="4"
                    value={draftSupplier.billingNoteDate}
                    onChange={(event) => updateTextField("billingNoteDate", event.target.value)}
                    placeholder="Billing note date or billing instruction text"
                  />
                </label>
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
