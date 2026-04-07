import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "inventory-management-customers";

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
    billingNoteDate: "Invoice note issued every Friday after delivery confirmation.",
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
    billingNoteDate: "Billing note should mention event name and delivery date.",
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
    billingNoteDate: `${customer.billingNoteDate ?? ""}`,
  };
}

function loadCustomers() {
  if (typeof window === "undefined") {
    return defaultCustomers;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return defaultCustomers;
    }

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed) || parsed.length === 0) {
      return defaultCustomers;
    }

    return parsed.map(normalizeCustomer);
  } catch {
    return defaultCustomers;
  }
}

function getSelectedValue(list, index) {
  return list?.[index] || "-";
}

function CustomerOptionField({
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

function CustomerPage() {
  const [customers, setCustomers] = useState(() => loadCustomers());
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [draftCustomer, setDraftCustomer] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(customers.map((customer) => normalizeCustomer(customer)))
    );
  }, [customers]);

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

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredCustomers = useMemo(
    () =>
      customers.filter((customer) => {
        if (!normalizedSearch) {
          return true;
        }

        return (
          customer.companyName.toLowerCase().includes(normalizedSearch) ||
          customer.locations.some((item) => item.toLowerCase().includes(normalizedSearch)) ||
          customer.emails.some((item) => item.toLowerCase().includes(normalizedSearch)) ||
          customer.tels.some((item) => item.toLowerCase().includes(normalizedSearch))
        );
      }),
    [normalizedSearch, customers]
  );

  function openCustomerEditor(customer) {
    setSelectedCustomerId(customer.id);
    setDraftCustomer(normalizeCustomer(customer));
  }

  function closeCustomerEditor() {
    setDraftCustomer(null);
  }

  function updateDraftCustomer(updater) {
    setDraftCustomer((currentCustomer) =>
      currentCustomer ? normalizeCustomer(updater(currentCustomer)) : currentCustomer
    );
  }

  function updateTextField(key, value) {
    updateDraftCustomer((customer) => ({ ...customer, [key]: value }));
  }

  function updateOptionIndex(indexKey, nextIndex) {
    updateDraftCustomer((customer) => ({ ...customer, [indexKey]: nextIndex }));
  }

  function updateOptionValue(listKey, indexKey, nextValue) {
    updateDraftCustomer((customer) => {
      const nextOptions = [...customer[listKey]];
      nextOptions[customer[indexKey]] = nextValue;
      return { ...customer, [listKey]: nextOptions };
    });
  }

  function addOption(listKey, indexKey) {
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
  }

  function handleCreateCustomer() {
    setDraftCustomer(
      createCustomer({
        companyName: `New Customer ${customers.length + 1}`,
      })
    );
  }

  function handleSaveCustomer() {
    if (!draftCustomer) {
      return;
    }

    const nextCustomer = normalizeCustomer(draftCustomer);
    const exists = customers.some((customer) => customer.id === nextCustomer.id);

    setCustomers((currentCustomers) =>
      exists
        ? currentCustomers.map((customer) =>
            customer.id === nextCustomer.id ? nextCustomer : customer
          )
        : [nextCustomer, ...currentCustomers]
    );
    setSelectedCustomerId(nextCustomer.id);
    setDraftCustomer(null);
  }

  function handleDeleteCustomer() {
    if (!draftCustomer) {
      return;
    }

    const exists = customers.some((customer) => customer.id === draftCustomer.id);

    if (!exists) {
      setDraftCustomer(null);
      return;
    }

    const confirmed = window.confirm(
      `Delete customer ${draftCustomer.companyName || "this customer"}?`
    );

    if (!confirmed) {
      return;
    }

    setCustomers((currentCustomers) =>
      currentCustomers.filter((customer) => customer.id !== draftCustomer.id)
    );
    setSelectedCustomerId((currentId) =>
      currentId === draftCustomer.id ? null : currentId
    );
    setDraftCustomer(null);
  }

  const summary = {
    totalCustomers: customers.length,
    totalLocations: customers.reduce(
      (sum, customer) => sum + customer.locations.filter((item) => item.trim()).length,
      0
    ),
    totalEmails: customers.reduce(
      (sum, customer) => sum + customer.emails.filter((item) => item.trim()).length,
      0
    ),
    totalPhones: customers.reduce(
      (sum, customer) => sum + customer.tels.filter((item) => item.trim()).length,
      0
    ),
  };

  return (
    <div className="stack-layout">
      <section className="inventory-summary-grid">
        <article className="inventory-summary-card">
          <span>Total customers</span>
          <strong>{summary.totalCustomers}</strong>
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
              <p className="eyebrow">Customers</p>
              <h3>Customer Directory</h3>
            </div>
            <button className="primary-button" type="button" onClick={handleCreateCustomer}>
              New Customer
            </button>
          </div>

          <p className="inventory-note">
            Store customer details in the frontend for now. Changes are saved when you press the
            save button in the customer popup.
          </p>

          <div className="supplier-directory-toolbar">
            <label className="stock-search supplier-search">
              <span className="stock-search-icon">S</span>
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search customer, location, email, or tel"
              />
            </label>
            <div className="stock-report-summary supplier-search-meta">
              <span>{filteredCustomers.length} customers shown</span>
            </div>
          </div>

          <div className="supplier-list">
            {filteredCustomers.length === 0 ? (
              <p className="empty-copy">No customers match the current search.</p>
            ) : (
              filteredCustomers.map((customer) => {
                const isActive = customer.id === selectedCustomerId;

                return (
                  <button
                    key={customer.id}
                    type="button"
                    className={isActive ? "supplier-list-item active" : "supplier-list-item"}
                    onClick={() => openCustomerEditor(customer)}
                  >
                    <div className="supplier-list-top">
                      <strong>{customer.companyName || "Unnamed Customer"}</strong>
                      <span className="status-badge status-ordered">Saved</span>
                    </div>
                    <span>
                      {getSelectedValue(customer.locations, customer.selectedLocationIndex)}
                    </span>
                    <span>{getSelectedValue(customer.emails, customer.selectedEmailIndex)}</span>
                    <span>{getSelectedValue(customer.tels, customer.selectedTelIndex)}</span>
                  </button>
                );
              })
            )}
          </div>
        </section>
      </div>

      {draftCustomer ? (
        <div className="modal-backdrop">
          <div
            className="detail-modal supplier-modal section-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-modal-title"
          >
            <div className="section-heading supplier-modal-header">
              <div>
                <p className="eyebrow">Customer Details</p>
                <h3 id="customer-modal-title">
                  {draftCustomer.companyName || "New Customer"}
                </h3>
              </div>
              <button
                className="icon-button subtle"
                type="button"
                aria-label="Close customer details"
                onClick={closeCustomerEditor}
              >
                X
              </button>
            </div>

            <form
              className="form-layout"
              onSubmit={(event) => {
                event.preventDefault();
                handleSaveCustomer();
              }}
            >
              <div className="form-grid">
                <label>
                  Customer Company Name
                  <input
                    autoFocus
                    value={draftCustomer.companyName}
                    onChange={(event) => updateTextField("companyName", event.target.value)}
                    placeholder="Customer company name"
                  />
                </label>

                <label>
                  Customer Taxpayer Identification Number
                  <input
                    value={draftCustomer.taxpayerId}
                    onChange={(event) => updateTextField("taxpayerId", event.target.value)}
                    placeholder="Taxpayer identification number"
                  />
                </label>

                <CustomerOptionField
                  label="Customer Company Location"
                  options={draftCustomer.locations}
                  selectedIndex={draftCustomer.selectedLocationIndex}
                  placeholder="Add or edit a company location"
                  onSelect={(nextIndex) => updateOptionIndex("selectedLocationIndex", nextIndex)}
                  onChange={(nextValue) =>
                    updateOptionValue("locations", "selectedLocationIndex", nextValue)
                  }
                  onAdd={() => addOption("locations", "selectedLocationIndex")}
                  onDelete={() => deleteOption("locations", "selectedLocationIndex")}
                />

                <CustomerOptionField
                  label="Customer Email"
                  options={draftCustomer.emails}
                  selectedIndex={draftCustomer.selectedEmailIndex}
                  placeholder="Add or edit an email"
                  type="email"
                  onSelect={(nextIndex) => updateOptionIndex("selectedEmailIndex", nextIndex)}
                  onChange={(nextValue) =>
                    updateOptionValue("emails", "selectedEmailIndex", nextValue)
                  }
                  onAdd={() => addOption("emails", "selectedEmailIndex")}
                  onDelete={() => deleteOption("emails", "selectedEmailIndex")}
                />

                <CustomerOptionField
                  label="Customer Tel"
                  options={draftCustomer.tels}
                  selectedIndex={draftCustomer.selectedTelIndex}
                  placeholder="Add or edit a telephone number"
                  onSelect={(nextIndex) => updateOptionIndex("selectedTelIndex", nextIndex)}
                  onChange={(nextValue) =>
                    updateOptionValue("tels", "selectedTelIndex", nextValue)
                  }
                  onAdd={() => addOption("tels", "selectedTelIndex")}
                  onDelete={() => deleteOption("tels", "selectedTelIndex")}
                />

                <CustomerOptionField
                  label="Customer Branch"
                  options={draftCustomer.branches}
                  selectedIndex={draftCustomer.selectedBranchIndex}
                  placeholder="Add or edit a branch"
                  onSelect={(nextIndex) => updateOptionIndex("selectedBranchIndex", nextIndex)}
                  onChange={(nextValue) =>
                    updateOptionValue("branches", "selectedBranchIndex", nextValue)
                  }
                  onAdd={() => addOption("branches", "selectedBranchIndex")}
                  onDelete={() => deleteOption("branches", "selectedBranchIndex")}
                />

                <div className="full-width">
                  <CustomerOptionField
                    label="Shipping Address"
                    options={draftCustomer.shippingAddresses}
                    selectedIndex={draftCustomer.selectedShippingAddressIndex}
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
                    value={draftCustomer.remark}
                    onChange={(event) => updateTextField("remark", event.target.value)}
                    placeholder="Internal note about this customer"
                  />
                </label>

                <label className="full-width">
                  Billing Note Date
                  <textarea
                    rows="4"
                    value={draftCustomer.billingNoteDate}
                    onChange={(event) => updateTextField("billingNoteDate", event.target.value)}
                    placeholder="Billing note date or billing instruction text"
                  />
                </label>
              </div>

              <div className="supplier-modal-actions">
                <button className="danger-button" type="button" onClick={handleDeleteCustomer}>
                  Delete Customer
                </button>
                <button className="secondary-button" type="button" onClick={closeCustomerEditor}>
                  Cancel
                </button>
                <button className="primary-button" type="submit">
                  Save Customer
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
