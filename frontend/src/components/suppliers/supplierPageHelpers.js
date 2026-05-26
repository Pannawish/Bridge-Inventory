import { countFilledValues } from "./supplierUtils";

/**
 * Performs local query searching and profile criteria filtering on the suppliers array.
 */
export function filterSuppliersHelper({
  suppliers,
  normalizedSearch,
  profileFilter,
  isServerPaginated,
}) {
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
}
