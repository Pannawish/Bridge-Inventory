import {
  editablePurchaseItemStatuses,
  formatPurchaseLeadTime,
  getPurchaseItemDisplayStatus,
  getPurchaseItemStatusCounts,
  getStoredPurchaseItemStatus,
} from "../../purchaseStatus";
import {
  editableSaleItemStatuses,
  getSaleItemStatusCounts,
  getStoredSaleItemStatus,
} from "../../saleStatus";
import { getItemQuantityDetails } from "../../unitConversion";
import { useLanguage } from "../../i18n/LanguageContext";
import { getStatusLabel } from "../../i18n/statusLabels";
import {
  computeItemAmount,
  computePurchaseBaseUnitCostAfterDiscount,
  computePurchaseBaseUnitCostBeforeDiscount,
  findProductForItem,
  formatCurrency,
  formatOptionalCurrency,
  getItemStatusOptions,
  renderBillDiscount,
  renderDiscounts,
} from "./transactionTableUtils";

function DiscountBreakdown({ item, transaction }) {
  const { t } = useLanguage();

  return (
    <div className="tx-discount-breakdown">
      <span className="tx-discount-breakdown-row">
        <span className="tx-discount-type">{t("transactionTable.discountItem")}</span>
        <span className="tx-discount-label">{renderDiscounts(item)}</span>
      </span>
      <span className="tx-discount-breakdown-row">
        <span className="tx-discount-type">{t("transactionTable.discountBill")}</span>
        <span className="tx-discount-label">{renderBillDiscount(transaction)}</span>
      </span>
    </div>
  );
}

function ItemStatusSummary({ selectedRow, type }) {
  const { t } = useLanguage();

  if (type === "purchase") {
    const counts = getPurchaseItemStatusCounts(selectedRow.items || [], selectedRow.status);

    return (
      <div
        className="item-receiving-summary"
        aria-label={t("transactionTable.itemReceivingStatus")}
      >
        <span className="item-receiving-title">
          {t("transactionTable.itemReceivingStatus")}
        </span>
        {["pending", "delayed", "received", "cancelled"].map((status) => (
          <span key={status} className={`status-badge item-status-badge status-${status}`}>
            {counts[status]} {getStatusLabel(t, status)}
          </span>
        ))}
      </div>
    );
  }

  const counts = getSaleItemStatusCounts(selectedRow.items || [], selectedRow.status);

  return (
    <div className="item-receiving-summary" aria-label={t("transactionTable.itemSalesStatus")}>
      <span className="item-receiving-title">{t("transactionTable.itemSalesStatus")}</span>
      {["pending", "packed", "shipped", "delivered", "cancelled", "returned"].map((status) => (
        <span key={status} className={`status-badge item-status-badge status-${status}`}>
          {counts[status]} {getStatusLabel(t, status)}
        </span>
      ))}
    </div>
  );
}

function SaleItemsTable({
  selectedRow,
  products,
  onSaleItemStatusChange,
  onSaleItemDateChange,
}) {
  const { t } = useLanguage();

  return (
    <table className="detail-item-table detail-item-table-sale">
      <thead>
        <tr>
          <th className="table-index-cell">#</th>
          <th>{t("transactionTable.colProduct")}</th>
          <th>{t("transactionTable.colItemStatus")}</th>
          <th>{t("transactionTable.colShippedDate")}</th>
          <th>{t("transactionTable.colDeliveredDate")}</th>
          <th>{t("transactionTable.colQty")}</th>
          <th>{t("transactionTable.colBaseQty")}</th>
          <th>{t("transactionTable.colUnitPrice")}</th>
          <th>{t("transactionTable.supplierLabel")}</th>
          <th>{t("transactionTable.colUnitCost")}</th>
          <th>{t("transactionTable.colDiscounts")}</th>
          <th>{t("transactionTable.colAmount")}</th>
          <th>{t("transactionTable.colMargin")}</th>
        </tr>
      </thead>
      <tbody>
        {(selectedRow.items || []).map((item, itemIndex) => {
          const amount = computeItemAmount(item, selectedRow);
          const itemStatus = getStoredSaleItemStatus(item, selectedRow.status);
          const itemStatusOptions = getItemStatusOptions(
            editableSaleItemStatuses,
            itemStatus
          );
          const quantityDetails = getItemQuantityDetails(
            item,
            findProductForItem(products, item),
            "sale"
          );

          return (
            <tr key={item.id || `${item.sku}-${itemIndex}`}>
              <td className="table-index-cell">{itemIndex + 1}</td>
              <td>{item.product_name}</td>
              <td>
                <div className="purchase-item-status-control">
                  <select
                    className={`status-select item-status-select status-${itemStatus}`}
                    value={itemStatus}
                    onChange={(event) => onSaleItemStatusChange(itemIndex, event.target.value)}
                    aria-label={t("transactionTable.changeSalesStatusAria", {
                      product: item.product_name,
                    })}
                  >
                    {itemStatusOptions.map((status) => (
                      <option key={status} value={status}>
                        {getStatusLabel(t, status)}
                      </option>
                    ))}
                  </select>
                </div>
              </td>
              <td>
                <input
                  className="received-date-input"
                  type="date"
                  value={item.shipped_date || ""}
                  onChange={(event) =>
                    onSaleItemDateChange(itemIndex, "shipped_date", event.target.value)
                  }
                  disabled={!["shipped", "delivered"].includes(itemStatus)}
                />
              </td>
              <td>
                <input
                  className="received-date-input"
                  type="date"
                  value={item.delivered_date || ""}
                  onChange={(event) =>
                    onSaleItemDateChange(itemIndex, "delivered_date", event.target.value)
                  }
                  disabled={itemStatus !== "delivered"}
                />
              </td>
              <td>{quantityDetails.enteredLabel}</td>
              <td>{quantityDetails.baseLabel}</td>
              <td>{item.unit_price ? formatCurrency(item.unit_price) : "—"}</td>
              <td>{item.supplier_name || "—"}</td>
              <td>{Number(item.unit_cost) > 0 ? formatCurrency(item.unit_cost) : "—"}</td>
              <td>
                <DiscountBreakdown item={item} transaction={selectedRow} />
              </td>
              <td>{formatCurrency(amount)}</td>
              <td>
                {(() => {
                  const lineCost = Number(item.unit_cost || 0) * Number(item.quantity || 0);
                  return lineCost > 0 ? formatCurrency(amount - lineCost) : "—";
                })()}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function PurchaseItemsTable({
  selectedRow,
  products,
  onPurchaseItemStatusChange,
  onPurchaseItemReceivedDateChange,
  onMarkPurchaseItemReceived,
}) {
  const { t } = useLanguage();

  return (
    <table className="detail-item-table detail-item-table-purchase">
      <thead>
        <tr>
          <th className="table-index-cell">#</th>
          <th>{t("transactionTable.colProduct")}</th>
          <th>{t("transactionTable.colSKU")}</th>
          <th>{t("transactionTable.colExpectedDelivery")}</th>
          <th>{t("transactionTable.colLeadTime")}</th>
          <th>{t("transactionTable.colItemStatus")}</th>
          <th>{t("transactionTable.colReceivedDate")}</th>
          <th>{t("transactionTable.colQty")}</th>
          <th>{t("transactionTable.colBaseQty")}</th>
          <th>{t("transactionTable.colUnitCost")}</th>
          <th>
            <span className="compact-column-heading">
              <span>{t("transactionTable.colBaseCost")}</span>
              <span>{t("transactionTable.beforeDisc")}</span>
            </span>
          </th>
          <th>
            <span className="compact-column-heading">
              <span>{t("transactionTable.colBaseCost")}</span>
              <span>{t("transactionTable.afterDisc")}</span>
            </span>
          </th>
          <th>{t("transactionTable.colDiscounts")}</th>
          <th>{t("transactionTable.colAmount")}</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {(selectedRow.items || []).map((item, itemIndex) => {
          const amount = computeItemAmount(item, selectedRow);
          const displayStatus = getPurchaseItemDisplayStatus(item, selectedRow.status);
          const storedStatus = getStoredPurchaseItemStatus(item, selectedRow.status);
          const itemStatusOptions = getItemStatusOptions(
            editablePurchaseItemStatuses,
            storedStatus
          );
          const canMarkReceived =
            !["draft", "cancelled"].includes(selectedRow.status) &&
            !["cancelled", "received"].includes(storedStatus);
          const quantityDetails = getItemQuantityDetails(
            item,
            findProductForItem(products, item),
            "purchase"
          );
          const isCancelled = storedStatus === "cancelled";

          return (
            <tr
              key={item.id || `${item.sku}-${itemIndex}`}
              className={isCancelled ? "detail-item-cancelled" : undefined}
            >
              <td className="table-index-cell">{itemIndex + 1}</td>
              <td>{item.product_name}</td>
              <td>{item.sku || "—"}</td>
              <td>{formatDate(item.expected_delivery_date)}</td>
              <td>{formatPurchaseLeadTime(item, selectedRow)}</td>
              <td>
                <div className="purchase-item-status-control">
                  <select
                    className={`status-select item-status-select status-${displayStatus}`}
                    value={storedStatus}
                    onChange={(event) => onPurchaseItemStatusChange(itemIndex, event.target.value)}
                    disabled={selectedRow.status === "draft"}
                    aria-label={t("transactionTable.changeReceivingStatusAria", {
                      product: item.product_name,
                    })}
                  >
                    {itemStatusOptions.map((status) => (
                      <option key={status} value={status}>
                        {getStatusLabel(t, status)}
                      </option>
                    ))}
                  </select>
                  {displayStatus === "delayed" ? (
                    <span className="status-badge item-status-badge status-delayed">
                      {t("transactionTable.delayed")}
                    </span>
                  ) : null}
                </div>
              </td>
              <td>
                <input
                  className="received-date-input"
                  type="date"
                  value={item.received_date || ""}
                  onChange={(event) =>
                    onPurchaseItemReceivedDateChange(itemIndex, event.target.value)
                  }
                  disabled={storedStatus !== "received"}
                />
              </td>
              <td>{quantityDetails.enteredLabel}</td>
              <td>{quantityDetails.baseLabel}</td>
              <td>{item.unit_cost ? formatCurrency(item.unit_cost) : "—"}</td>
              <td>{formatOptionalCurrency(computePurchaseBaseUnitCostBeforeDiscount(item))}</td>
              <td>
                {formatOptionalCurrency(computePurchaseBaseUnitCostAfterDiscount(item, selectedRow))}
              </td>
              <td>
                <DiscountBreakdown item={item} transaction={selectedRow} />
              </td>
              <td className={isCancelled ? "detail-item-amount-cancelled" : undefined}>
                {formatCurrency(amount)}
              </td>
              <td>
                <button
                  className="secondary-button table-action-button mark-received-button"
                  type="button"
                  onClick={() => onMarkPurchaseItemReceived(itemIndex)}
                  disabled={!canMarkReceived}
                >
                  {t("transactionTable.markReceived")}
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function TransactionDetailItemsSection(props) {
  const { selectedRow, type } = props;
  const { t } = useLanguage();

  return (
    <div className="detail-items">
      <p className="detail-label">{t("transactionTable.colItems")}</p>
      <ItemStatusSummary selectedRow={selectedRow} type={type} />
      <div className="table-scroll">
        {type === "sale" ? <SaleItemsTable {...props} /> : <PurchaseItemsTable {...props} />}
      </div>
    </div>
  );
}

export default TransactionDetailItemsSection;
