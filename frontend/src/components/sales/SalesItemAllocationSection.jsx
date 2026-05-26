import { formatMoney as fmt } from "../../format";
import { useLanguage } from "../../i18n/LanguageContext";
import {
  allocationsMatchItemQuantity,
  getAllocationQuantityTotal,
} from "./salesAllocationUtils";

function formatQuantity(value) {
  const numericValue = Number(value) || 0;
  if (Number.isInteger(numericValue)) {
    return `${numericValue}`;
  }

  return numericValue.toFixed(3).replace(/\.?0+$/, "");
}

function SalesItemAllocationSection({
  item,
  stockLayers = [],
  conversionFactor = 1,
  unit = "pcs",
  onChangeMode,
  onAddAllocation,
  onRemoveAllocation,
  onUpdateAllocation,
}) {
  const { t } = useLanguage();
  const allocatedQuantity = getAllocationQuantityTotal(item.allocations);
  const quantityMatches = allocationsMatchItemQuantity(item);

  return (
    <div className="sales-allocation-section">
      <label className="purchase-item-field sales-allocation-mode">
        <span>{t("salesForm.stockSourceLabel")}</span>
        <select
          value={item.allocation_mode || "auto"}
          onChange={(event) => onChangeMode(event.target.value)}
        >
          <option value="auto">{t("salesForm.stockSourceAuto")}</option>
          <option value="manual">{t("salesForm.stockSourceManual")}</option>
        </select>
      </label>

      {item.allocation_mode === "manual" ? (
        <div className="sales-allocation-editor">
          {(item.allocations || []).map((allocation) => (
            <div key={allocation.row_id} className="sales-allocation-row">
              <select
                value={allocation.purchase_item_id}
                onChange={(event) =>
                  onUpdateAllocation(allocation.row_id, "purchase_item_id", event.target.value)
                }
              >
                <option value="">{t("salesForm.stockSourceSelectPlaceholder")}</option>
                {stockLayers.map((layer) => {
                  const availableQuantity = (Number(layer.available_quantity) || 0) / conversionFactor;

                  return (
                    <option key={layer.purchase_item_id} value={layer.purchase_item_id}>
                      {t("salesForm.stockSourceOption", {
                        supplier: layer.supplier_name || t("common.unknown"),
                        reference: layer.purchase_reference_no || layer.purchase_item_id,
                        quantity: formatQuantity(availableQuantity),
                        unit,
                        cost: fmt(layer.base_unit_cost * conversionFactor),
                      })}
                    </option>
                  );
                })}
              </select>

              <label className="sales-allocation-qty">
                <span>{t("salesForm.stockSourceQtyLabel", { unit })}</span>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={allocation.quantity}
                  onChange={(event) =>
                    onUpdateAllocation(allocation.row_id, "quantity", event.target.value)
                  }
                  placeholder="0"
                />
              </label>

              <button
                className="secondary-button sales-allocation-remove"
                type="button"
                onClick={() => onRemoveAllocation(allocation.row_id)}
                disabled={(item.allocations || []).length === 1}
              >
                {t("salesForm.stockSourceRemoveSplit")}
              </button>
            </div>
          ))}

          <div className="sales-allocation-actions">
            <button className="secondary-button" type="button" onClick={onAddAllocation}>
              {t("salesForm.stockSourceAddSplit")}
            </button>
            <span
              className={
                quantityMatches
                  ? "field-helper-text sales-allocation-summary"
                  : "field-helper-text sales-allocation-summary is-warning"
              }
            >
              {t("salesForm.stockSourceAllocatedSummary", {
                allocated: formatQuantity(allocatedQuantity),
                required: formatQuantity(item.quantity),
                unit,
              })}
            </span>
          </div>

          {!quantityMatches ? (
            <span className="field-error-text">
              {t("salesForm.stockSourceMismatch", {
                required: formatQuantity(item.quantity),
                unit,
              })}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default SalesItemAllocationSection;
