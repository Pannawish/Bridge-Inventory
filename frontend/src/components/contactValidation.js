// Utility module for shared component: contact validation.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TEL_ALLOWED_PATTERN = /^[+()\d.\-\s]+$/;
const TEL_MIN_DIGITS = 7;
const TEL_MAX_DIGITS = 20;

export function isValidEmail(value) {
  const email = `${value ?? ""}`.trim();
  return !email || EMAIL_PATTERN.test(email);
}

export function isValidTel(value) {
  const tel = `${value ?? ""}`.trim();
  const digits = tel.replace(/\D/g, "");

  return (
    !tel ||
    (TEL_ALLOWED_PATTERN.test(tel) &&
      digits.length >= TEL_MIN_DIGITS &&
      digits.length <= TEL_MAX_DIGITS)
  );
}

export function getContactFieldError(field, value) {
  if (field === "emails" && !isValidEmail(value)) {
    return "Enter a valid email address.";
  }

  if (field === "tels" && !isValidTel(value)) {
    return "Enter a valid telephone number.";
  }

  return "";
}

export function getRequiredFieldError(label, value) {
  return `${value ?? ""}`.trim() ? "" : `${label} is required.`;
}

export function getRequiredListError(label, values) {
  return (values || []).some((value) => !`${value ?? ""}`.trim())
    ? `${label} is required.`
    : "";
}

export function getContactListErrors(record) {
  return {
    emails:
      (record.emails || [])
        .map((email) => getContactFieldError("emails", email))
        .find(Boolean) || "",
    tels:
      (record.tels || [])
        .map((tel) => getContactFieldError("tels", tel))
        .find(Boolean) || "",
  };
}

export function getFirstInvalidContactIndex(record, field) {
  return (record[field] || []).findIndex((value) => getContactFieldError(field, value));
}

export function hasContactErrors(errors) {
  return Boolean(errors.emails || errors.tels);
}
