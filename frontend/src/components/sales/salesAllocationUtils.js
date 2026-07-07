// Helper utilities for sales workflow behavior.

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

export function buildAutoFifoPreview(stockLayers = [], requiredQuantity = 0, conversionFactor = 1) {
  let remainingQuantity = Number(requiredQuantity) || 0;
  const normalizedConversionFactor = Number(conversionFactor) || 1;
  const previewRows = [];

  stockLayers.forEach((layer) => {
    if (remainingQuantity <= 0) {
      return;
    }

    const availableQuantity = (Number(layer.available_quantity) || 0) / normalizedConversionFactor;
    if (availableQuantity <= 0) {
      return;
    }

    const quantity = Math.min(remainingQuantity, availableQuantity);
    previewRows.push({
      purchase_item_id: layer.purchase_item_id,
      purchase_reference_no: layer.purchase_reference_no || layer.purchase_item_id,
      supplier_name: layer.supplier_name || "",
      quantity,
      unit_cost: (Number(layer.base_unit_cost) || 0) * normalizedConversionFactor,
    });
    remainingQuantity -= quantity;
  });

  return {
    rows: previewRows,
    allocatedQuantity: previewRows.reduce((sum, row) => sum + row.quantity, 0),
    remainingQuantity: Math.max(0, remainingQuantity),
  };
}

export function getComputedAllocationSnapshot(item, stockLayers = [], conversionFactor = 1) {
  const normalizedConversionFactor = Number(conversionFactor) || 1;

  if (item.allocation_mode === "manual") {
    const rowsById = Object.fromEntries(
      stockLayers.map((layer) => [layer.purchase_item_id, layer])
    );
    const rows = (item.allocations || [])
      .filter(
        (allocation) =>
          allocation.purchase_item_id && (Number(allocation.quantity) || 0) > 0
      )
      .map((allocation) => {
        const layer = rowsById[allocation.purchase_item_id];
        if (!layer) {
          return null;
        }

        return {
          supplier_name: layer.supplier_name || "",
          quantity: Number(allocation.quantity) || 0,
          unit_cost: (Number(layer.base_unit_cost) || 0) * normalizedConversionFactor,
        };
      })
      .filter(Boolean);

    return buildComputedSnapshotFromRows(rows);
  }

  return buildComputedSnapshotFromRows(
    buildAutoFifoPreview(stockLayers, item.quantity, normalizedConversionFactor).rows
  );
}

function buildComputedSnapshotFromRows(rows = []) {
  let totalQuantity = 0;
  let totalCost = 0;
  const supplierNames = new Set();

  rows.forEach((row) => {
    const quantity = Number(row.quantity) || 0;
    const unitCost = Number(row.unit_cost) || 0;
    if (quantity <= 0 || unitCost < 0) {
      return;
    }

    totalQuantity += quantity;
    totalCost += quantity * unitCost;
    if (row.supplier_name) {
      supplierNames.add(row.supplier_name);
    }
  });

  if (totalQuantity <= 0) {
    return {
      supplier_name: "",
      unit_cost: "",
    };
  }

  return {
    supplier_name: supplierNames.size === 1 ? [...supplierNames][0] : "",
    unit_cost: (totalCost / totalQuantity).toFixed(2),
  };
}
