import {
  getContactFieldError,
  getRequiredFieldError,
  getRequiredListError,
} from "../contactValidation";

export const CUSTOMER_PROFILE_OPTIONS = [
  { value: "missing-tax-id", labelKey: "customer.missingTaxId" },
  { value: "has-email", labelKey: "customer.hasEmail" },
  { value: "has-phone", labelKey: "customer.hasPhone" },
  { value: "has-note", labelKey: "customer.hasNote" },
];

export function createCustomer(overrides = {}) {
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
    termType: "cash",
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
    termType: "cash",
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

export function clampIndex(list, index) {
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

export function normalizeCustomer(customer) {
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

export function getSelectedValue(list, index) {
  return list?.[index] || "-";
}

export function countFilledValues(list) {
  return (list || []).filter((value) => `${value ?? ""}`.trim()).length;
}

export function getContactListKeyForIndex(indexKey) {
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

export const CUSTOMER_REQUIRED_FIELD_KEYS = {
  companyName: "customer.companyNameLabel",
  taxpayerId: "customer.taxpayerLabel",
  termType: "customer.paymentTermLabel",
  billingNoteDate: "customer.creditTermLabel",
};

export const CUSTOMER_REQUIRED_OPTION_KEYS = {
  branches: "customer.branchLabel",
  locations: "customer.locationLabel",
  emails: "customer.emailLabel",
  tels: "customer.telLabel",
  shippingAddresses: "customer.shippingLabel",
};

export const CUSTOMER_OPTION_INDEX_KEYS = {
  branches: "selectedBranchIndex",
  locations: "selectedLocationIndex",
  emails: "selectedEmailIndex",
  tels: "selectedTelIndex",
  shippingAddresses: "selectedShippingAddressIndex",
};

export function getCustomerOptionError(listKey, value, t) {
  return (
    getRequiredFieldError(t(CUSTOMER_REQUIRED_OPTION_KEYS[listKey]), value) ||
    getContactFieldError(listKey, value)
  );
}

export function getFirstInvalidCustomerOptionIndex(customer, listKey, t) {
  return (customer[listKey] || []).findIndex((value) => getCustomerOptionError(listKey, value, t));
}

export function getCustomerFormErrors(customer, t) {
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

export function hasFormErrors(errors) {
  return Object.values(errors).some(Boolean);
}
