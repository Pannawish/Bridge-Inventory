function allocationRowId() {
  return `sale-allocation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createEmptyAllocationRow(initialValues = {}) {
  return {
    row_id: initialValues.row_id || allocationRowId(),
    purchase_item_id: initialValues.purchase_item_id || "",
    quantity: initialValues.quantity ?? "",
  };
}

export function createInitialAllocationState(item = {}) {
  const sourceAllocations = Array.isArray(item.allocations) ? item.allocations : [];
  return {
    allocation_mode: sourceAllocations.length ? "manual" : "auto",
    allocations: sourceAllocations.map((allocation) =>
      createEmptyAllocationRow({
        purchase_item_id: allocation.purchase_item_id || allocation.purchaseItemId || "",
        quantity: allocation.quantity ?? "",
      })
    ),
  };
}

export function getAllocationQuantityTotal(allocations = []) {
  return allocations.reduce((sum, allocation) => {
    const quantity = Number(allocation.quantity) || 0;
    return sum + quantity;
  }, 0);
}

export function allocationsMatchItemQuantity(item) {
  const requiredQuantity = Number(item.quantity) || 0;
  const allocatedQuantity = getAllocationQuantityTotal(item.allocations);
  return Math.abs(allocatedQuantity - requiredQuantity) < 0.0001;
}

export function buildManualAllocationPayload(item, conversionFactor) {
  if (item.allocation_mode !== "manual") {
    return undefined;
  }

  return (item.allocations || [])
    .filter(
      (allocation) =>
        allocation.purchase_item_id && (Number(allocation.quantity) || 0) > 0
    )
    .map((allocation) => ({
      purchase_item_id: allocation.purchase_item_id,
      base_quantity: String((Number(allocation.quantity) || 0) * conversionFactor),
    }));
}
