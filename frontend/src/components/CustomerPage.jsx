import { useEffect, useMemo, useState } from "react";

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
    billingNoteDate: "Reference the librarian approval code in every billing note.",
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
    billingNoteDate: "Split billing note by enrollment campaign when requested.",
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
    billingNoteDate: "Include project code and recipient name.",
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
    billingNoteDate: "Billing note must match event approval memo date.",
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
    billingNoteDate: `${customer.billingNoteDate ?? ""}`,
  };
}

function getSelectedValue(list, index) {
  return list?.[index] || "-";
}

function countFilledValues(list) {
  return (list || []).filter((value) => `${value ?? ""}`.trim()).length;
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

function CustomerPage({
  customers = defaultCustomers,
  onSaveCustomer,
  onDeleteCustomer,
}) {
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [draftCustomer, setDraftCustomer] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [profileFilter, setProfileFilter] = useState("all");
  const [showAllRows, setShowAllRows] = useState(false);

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
  const activeFilterCount = profileFilter === "all" ? 0 : 1;
  const compactRows = 5;
  const filteredCustomers = useMemo(
    () =>
      customers.filter((customer) => {
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
      }),
    [normalizedSearch, profileFilter, customers]
  );
  const shouldShowViewAll = filteredCustomers.length > compactRows;
  const isCompact = shouldShowViewAll && !showAllRows;

  function resetFilters() {
    setSearchTerm("");
    setProfileFilter("all");
    setFilterOpen(false);
  }

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

  async function handleSaveCustomer() {
    if (!draftCustomer) {
      return;
    }

    const nextCustomer = normalizeCustomer(draftCustomer);
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
            <p className="eyebrow">Customers</p>
            <h3>Find Customers</h3>
          </div>
        </div>

        <div className="supplier-directory-toolbar">
          <label className="stock-search supplier-search">
            <span className="stock-search-icon">S</span>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search customer, taxpayer ID, location, email, or tel"
            />
          </label>
          <div className="stock-report-summary supplier-search-meta">
            <span>{filteredCustomers.length} of {customers.length} customers shown</span>
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
                <span className="history-filter-title">Customer Profile</span>
                <select
                  value={profileFilter}
                  onChange={(event) => setProfileFilter(event.target.value)}
                >
                  <option value="all">All customers</option>
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
            <h3>Customers</h3>
          </div>
          <div className="transaction-table-actions">
            <button className="primary-button" type="button" onClick={handleCreateCustomer}>
              New Customer
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

        {filteredCustomers.length === 0 ? (
          <p className="empty-copy">No customers match the current search.</p>
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
                    <th>Customer</th>
                    <th>Contact</th>
                    <th>Location</th>
                    <th>Profile</th>
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
                            <strong>{customer.companyName || "Unnamed Customer"}</strong>
                            <span>
                              {customer.taxpayerId ? `Tax ID ${customer.taxpayerId}` : "Tax ID not set"}
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
                            <span>{customer.remark || customer.billingNoteDate || "No internal note"}</span>
                          </div>
                        </td>
                        <td>
                          <button
                            className="table-action-button"
                            type="button"
                            onClick={() => openCustomerEditor(customer)}
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
              {filteredCustomers.map((customer, index) => (
                <article className="mobile-record-card" key={`mobile-customer-${customer.id}`}>
                  <div className="mobile-record-header">
                    <div className="mobile-record-title">
                      <span className="mobile-record-index">{index + 1}</span>
                      <div className="cell-stack">
                        <strong>{customer.companyName || "Unnamed Customer"}</strong>
                        <span>
                          {customer.taxpayerId ? `Tax ID ${customer.taxpayerId}` : "Tax ID not set"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mobile-record-grid">
                    <div>
                      <span>Email</span>
                      <strong>{getSelectedValue(customer.emails, customer.selectedEmailIndex)}</strong>
                    </div>
                    <div>
                      <span>Phone</span>
                      <strong>{getSelectedValue(customer.tels, customer.selectedTelIndex)}</strong>
                    </div>
                    <div>
                      <span>Location</span>
                      <strong>{getSelectedValue(customer.locations, customer.selectedLocationIndex)}</strong>
                    </div>
                    <div>
                      <span>Branch</span>
                      <strong>{getSelectedValue(customer.branches, customer.selectedBranchIndex)}</strong>
                    </div>
                  </div>

                  <button
                    className="secondary-button table-action-button mobile-record-button"
                    type="button"
                    onClick={() => openCustomerEditor(customer)}
                  >
                    View
                  </button>
                </article>
              ))}
            </div>
          </div>
        )}
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
              <div className="contact-editor-layout">
                <section className="contact-editor-section">
                  <div className="contact-editor-section-heading">
                    <div>
                      <p className="eyebrow">Company</p>
                      <h4>Customer Identity</h4>
                    </div>
                    <span>Account profile</span>
                  </div>

                  <div className="contact-editor-grid">
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

                    <div className="full-width">
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

                    <div className="full-width">
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
                    </div>
                  </div>
                </section>

                <section className="contact-editor-section">
                  <div className="contact-editor-section-heading">
                    <div>
                      <p className="eyebrow">Delivery & Billing</p>
                      <h4>Shipping Address and Notes</h4>
                    </div>
                    <span>Fulfillment</span>
                  </div>

                  <div className="contact-editor-grid">
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

                    <label>
                      Remark
                      <textarea
                        rows="4"
                        value={draftCustomer.remark}
                        onChange={(event) => updateTextField("remark", event.target.value)}
                        placeholder="Internal note about this customer"
                      />
                    </label>

                    <label>
                      Billing Note Date
                      <textarea
                        rows="4"
                        value={draftCustomer.billingNoteDate}
                        onChange={(event) => updateTextField("billingNoteDate", event.target.value)}
                        placeholder="Billing note date or billing instruction text"
                      />
                    </label>
                  </div>
                </section>
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
