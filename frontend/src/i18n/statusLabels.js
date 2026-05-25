import { formatStatusLabel } from "../purchaseStatus";

export function getStatusLabel(t, status) {
  const key = `common.statusLabels.${status}`;
  const label = t(key);

  return label === key ? formatStatusLabel(status) : label;
}
