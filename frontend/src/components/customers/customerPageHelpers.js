import { countFilledValues } from "./customerUtils";

/**
 * Performs local query searching and profile criteria filtering on the customers array.
 */
export function filterCustomersHelper({
  customers,
  normalizedSearch,
  profileFilter,
  isServerPaginated,
}) {
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
}
