// Section component for product management forms or detail views.

import React, { useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { getProductBaseUnit } from "../../unitConversion";
import { formatDate } from "../../format";
import DocumentRefChip from "../DocumentRefChip";
import { formatCurrency, formatStockQuantity } from "./productUtils";

function ProductStockSourcesSection({
  viewingProduct,
  stockLayers = [],
  loading = false,
  error = "",
  onOpenDocRef,
}) {
  const { t } = useLanguage();
  const [sectionCollapsed, setSectionCollapsed] = useState(false);
  const [expandedSuppliers, setExpandedSuppliers] = useState({});

  if (!viewingProduct) {
    return null;
  }

  // Group layers by supplier_id
  const groupsMap = {};
  stockLayers.forEach((layer) => {
    const key = layer.supplier_id || "unknown";
    if (!groupsMap[key]) {
      groupsMap[key] = {
        supplierId: layer.supplier_id,
        supplierName: layer.supplier_name || t("common.unknown"),
        layers: [],
        totalQuantity: 0,
        totalCostValue: 0,
        oldestDate: null,
      };
    }
    const group = groupsMap[key];
    group.layers.push(layer);
    group.totalQuantity += layer.available_quantity;
    group.totalCostValue += layer.available_quantity * layer.base_unit_cost;

    const layerDate = layer.received_date || layer.transaction_date;
    if (layerDate) {
      if (!group.oldestDate || new Date(layerDate) < new Date(group.oldestDate)) {
        group.oldestDate = layerDate;
      }
    }
  });

  // Sort batches FIFO per supplier (received date / transaction date ascending)
  Object.values(groupsMap).forEach((group) => {
    group.layers.sort((a, b) => {
      const dateA = a.received_date || a.transaction_date || "";
      const dateB = b.received_date || b.transaction_date || "";
      return dateA.localeCompare(dateB);
    });
  });

  // Convert map to list and sort by total quantity descending
  const groupedSuppliers = Object.values(groupsMap)
    .map((group) => ({
      ...group,
      weightedAvgCost: group.totalQuantity > 0 ? group.totalCostValue / group.totalQuantity : 0,
      batchCount: group.layers.length,
    }))
    .sort((a, b) => b.totalQuantity - a.totalQuantity);

  const toggleSupplier = (supplierId) => {
    setExpandedSuppliers((prev) => ({
      ...prev,
      [supplierId]: !prev[supplierId],
    }));
  };

  const totalUnitsSum = stockLayers.reduce((sum, layer) => sum + layer.available_quantity, 0);
  const totalBatchesSum = stockLayers.length;
  const supplierCount = groupedSuppliers.length;
  const baseUnit = getProductBaseUnit(viewingProduct);

  const summaryText = t("products.stockSourcesSummary", {
    supplierCount,
    totalUnits: totalUnitsSum,
    unit: baseUnit,
    batchCount: totalBatchesSum,
  });

  return (
    <div className="product-detail-section stock-sources-section">
      <div 
        className="stock-sources-header detail-label" 
        onClick={() => setSectionCollapsed(!sectionCollapsed)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            setSectionCollapsed(!sectionCollapsed);
          }
        }}
      >
        <div className="stock-sources-header-left">
          <span>{t("products.stockSourcesTitle")}</span>
          <span className="stock-sources-summary-badge">
            {summaryText}
          </span>
        </div>
        <button type="button" className="stock-sources-toggle-btn">
          {sectionCollapsed ? "▼" : "▲"}
        </button>
      </div>

      {!sectionCollapsed && (
        <div className="stock-sources-content">
          {loading && (
            <div className="notice-banner stock-sources-notice">{t("common.loading")}</div>
          )}
          {error && (
            <div className="error-banner stock-sources-notice">{error}</div>
          )}

          {!loading && !error && stockLayers.length === 0 && (
            <p className="empty-copy stock-sources-empty">{t("products.noStockSources")}</p>
          )}

          {!loading && !error && stockLayers.length > 0 && (
            <div className="transaction-table-window stock-sources-table-window">
              <table className="transaction-history-table stock-sources-table">
                <thead>
                  <tr>
                    <th style={{ width: "40px" }} />
                    <th>{t("products.supplierColumn")}</th>
                    <th style={{ textAlign: "right" }}>{t("products.availableStockColumn")}</th>
                    <th style={{ textAlign: "right" }}>{t("products.weightedAvgCostColumn")}</th>
                    <th style={{ textAlign: "center" }}>{t("products.batchesColumn")}</th>
                    <th>{t("products.oldestBatchColumn")}</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedSuppliers.map((supplier) => {
                    const sId = supplier.supplierId || "unknown";
                    const isExpanded = !!expandedSuppliers[sId];

                    return (
                      <React.Fragment key={sId}>
                        <tr 
                          className={`supplier-summary-row ${isExpanded ? "row-expanded" : ""}`}
                          onClick={() => toggleSupplier(sId)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              toggleSupplier(sId);
                            }
                          }}
                        >
                          <td style={{ textAlign: "center", cursor: "pointer" }} className="expand-cell">
                            {isExpanded ? "▼" : "▶"}
                          </td>
                          <td className="supplier-name-cell">
                            <strong>{supplier.supplierName}</strong>
                          </td>
                          <td style={{ textAlign: "right" }} className="number-cell">
                            {formatStockQuantity(supplier.totalQuantity, viewingProduct)}
                          </td>
                          <td style={{ textAlign: "right" }} className="number-cell">
                            {formatCurrency(supplier.weightedAvgCost)}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <span className="batch-count-badge">
                              {supplier.batchCount}
                            </span>
                          </td>
                          <td>
                            {supplier.oldestDate ? formatDate(supplier.oldestDate) : "—"}
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="supplier-details-row">
                            <td />
                            <td colSpan={5} className="supplier-details-container">
                              <div className="supplier-layers-subtable-wrapper">
                                <table className="supplier-layers-subtable">
                                  <thead>
                                    <tr>
                                      <th>{t("products.batchRefColumn")}</th>
                                      <th>{t("products.receivedDateColumn")}</th>
                                      <th style={{ textAlign: "right" }}>{t("products.availableStockColumn")}</th>
                                      <th style={{ textAlign: "right" }}>{t("products.costPerUnitColumn")}</th>
                                      <th style={{ textAlign: "right" }}>{t("products.totalValueColumn")}</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {supplier.layers.map((layer) => (
                                      <tr key={layer.purchase_item_id}>
                                        <td>
                                          {layer.purchase_id != null &&
                                          layer.purchase_reference_no &&
                                          onOpenDocRef ? (
                                            <DocumentRefChip
                                              label={layer.purchase_reference_no}
                                              docType="purchase"
                                              onClick={() =>
                                                onOpenDocRef({
                                                  docType: "purchase",
                                                  docId: layer.purchase_id,
                                                  referenceNo: layer.purchase_reference_no,
                                                })
                                              }
                                            />
                                          ) : (
                                            <span className="batch-po-ref">
                                              {layer.purchase_reference_no || "—"}
                                            </span>
                                          )}
                                        </td>
                                        <td>
                                          {layer.received_date ? formatDate(layer.received_date) : formatDate(layer.transaction_date)}
                                        </td>
                                        <td style={{ textAlign: "right" }}>
                                          {formatStockQuantity(layer.available_quantity, viewingProduct)}
                                        </td>
                                        <td style={{ textAlign: "right" }}>
                                          {formatCurrency(layer.base_unit_cost)}
                                        </td>
                                        <td style={{ textAlign: "right" }} className="layer-total-val">
                                          {formatCurrency(layer.available_quantity * layer.base_unit_cost)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ProductStockSourcesSection;
