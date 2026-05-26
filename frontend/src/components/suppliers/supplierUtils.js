import {
  getContactFieldError,
  getRequiredFieldError,
  getRequiredListError,
  isValidTel,
} from "../contactValidation";

export const SUPPLIER_PROFILE_OPTIONS = [
  { value: "missing-tax-id", labelKey: "supplier.missingTaxId" },
  { value: "has-email", labelKey: "supplier.hasEmail" },
  { value: "has-phone", labelKey: "supplier.hasPhone" },
  { value: "has-note", labelKey: "supplier.hasNote" },
];

export function createSupplier(overrides = {}) {
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

export function normalizeSupplier(supplier) {
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

export const SUPPLIER_REQUIRED_FIELD_KEYS = {
  companyName: "supplier.companyNameLabel",
  procurementName: "supplier.procurementNameLabel",
  procurementTel: "supplier.procurementTelLabel",
  taxpayerId: "supplier.taxpayerLabel",
  termType: "supplier.paymentTermLabel",
  billingNoteDate: "supplier.creditTermLabel",
};

export const SUPPLIER_REQUIRED_OPTION_KEYS = {
  branches: "supplier.branchLabel",
  locations: "supplier.locationLabel",
  emails: "supplier.emailLabel",
  tels: "supplier.telLabel",
  shippingAddresses: "supplier.shippingLabel",
};

export const SUPPLIER_OPTION_INDEX_KEYS = {
  branches: "selectedBranchIndex",
  locations: "selectedLocationIndex",
  emails: "selectedEmailIndex",
  tels: "selectedTelIndex",
  shippingAddresses: "selectedShippingAddressIndex",
};

export function getSupplierOptionError(listKey, value, t) {
  return (
    getRequiredFieldError(t(SUPPLIER_REQUIRED_OPTION_KEYS[listKey]), value) ||
    getContactFieldError(listKey, value)
  );
}

export function getSupplierTextFieldError(key, value, t) {
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

export function getFirstInvalidSupplierOptionIndex(supplier, listKey, t) {
  return (supplier[listKey] || []).findIndex((value) => getSupplierOptionError(listKey, value, t));
}

export function getSupplierFormErrors(supplier, t) {
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

export function hasFormErrors(errors) {
  return Object.values(errors).some(Boolean);
}
