// React hook for shared application hook state and actions.

import { usePurchaseActions } from "./usePurchaseActions";
import { useSalesActions } from "./useSalesActions";

export function useAppTransactionActions(params) {
  const purchaseActions = usePurchaseActions(params);
  const salesActions = useSalesActions(params);

  return {
    ...purchaseActions,
    ...salesActions,
  };
}
