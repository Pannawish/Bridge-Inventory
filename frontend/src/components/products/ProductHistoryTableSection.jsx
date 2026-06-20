import PaginationControls from "../PaginationControls";
import DocumentRefChip from "../DocumentRefChip";
import { getPurchaseItemDisplayStatus } from "../../purchaseStatus";
import { getStoredSaleItemStatus } from "../../saleStatus";
import { getItemQuantityDetails } from "../../unitConversion";
import { formatDate } from "../../format";
import { useLanguage } from "../../i18n/LanguageContext";
import { getStatusLabel } from "../../i18n/statusLabels";
import {
  computeItemAmount,
  formatCurrency,
  renderBillDiscount,
  renderDiscounts,
} from "./productUtils";
import {
  computePurchaseBaseUnitCostAfterDiscount,
  computePurchaseBaseUnitCostBeforeDiscount,
  formatOptionalCurrency,
} from "./productEditorHelpers";

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

function ProductHistoryTableSection({
  type,
  viewingProduct,
  historyRows,
  pagination,
  onPageChange,
  onOpenTransactionDetail,
  onOpenDocRef,
}) {
  const { t } = useLanguage();
  const isPurchase = type === "purchase";

  return (
    <div className="product-detail-section">
      <p className="detail-label">
        {isPurchase ? t("products.purchaseHistoryEyebrow") : t("products.salesHistoryEyebrow")}
      </p>
      {historyRows.length === 0 ? (
        <p className="empty-copy">
          {isPurchase ? t("products.noPurchaseHistory") : t("products.noSalesHistory")}
        </p>
      ) : (
        <div>
          <div className="transaction-table-window product-history-table-window">
            <div className="table-scroll desktop-table">
              {isPurchase ? (
                <table className="transaction-history-table transaction-history-table-purchase product-history-transaction-table">
                  <colgroup>
                    <col className="product-history-col-index" />
                    <col className="product-history-col-reference" />
                    <col className="product-history-col-party" />
                    <col className="product-history-col-date" />
                    <col className="product-history-col-qty" />
                    <col className="product-history-col-qty" />
                    <col className="product-history-col-unit" />
                    <col className="product-history-col-base-cost" />
                    <col className="product-history-col-discount" />
                    <col className="product-history-col-base-cost" />
                    <col className="product-history-col-amount" />
                    <col className="product-history-col-status" />
                    <col className="product-history-col-action" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="table-index-cell">#</th>
                      <th>{t("products.purchaseColRef")}</th>
                      <th>{t("products.purchaseColSupplier")}</th>
                      <th>{t("products.purchaseColDate")}</th>
                      <th>{t("products.purchaseColQty")}</th>
                      <th>{t("products.purchaseColBaseQty")}</th>
                      <th className="product-history-num">{t("products.purchaseColUnitCost")}</th>
                      <th className="product-history-num">
                        <span className="compact-column-heading">
                          <span>{t("products.purchaseColBaseCostBefore")}</span>
                        </span>
                      </th>
                      <th className="product-history-mid">{t("products.purchaseColDiscounts")}</th>
                      <th className="product-history-num">
                        <span className="compact-column-heading">
                          <span>{t("products.purchaseColBaseCostAfter")}</span>
                        </span>
                      </th>
                      <th className="product-history-num">{t("products.purchaseColAmount")}</th>
                      <th>{t("products.purchaseColStatus")}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {historyRows.map(({ purchase, item }, itemIndex) => {
                      const quantityDetails = getItemQuantityDetails(item, viewingProduct, "purchase");
                      const rowNumber =
                        (pagination.page - 1) * pagination.page_size +
                        itemIndex +
                        1;
                      const displayStatus = getPurchaseItemDisplayStatus(item, purchase.status);

                      return (
                        <tr key={`${purchase.id}-${item.id}`}>
                          <td className="table-index-cell">{rowNumber}</td>
                          <td>
                            {purchase.id != null && onOpenDocRef ? (
                              <DocumentRefChip
                                label={purchase.reference_no}
                                docType="purchase"
                                onClick={() =>
                                  onOpenDocRef({
                                    docType: "purchase",
                                    docId: purchase.id,
                                    referenceNo: purchase.reference_no,
                                  })
                                }
                              />
                            ) : (
                              purchase.reference_no
                            )}
                          </td>
                          <td>{purchase.supplier_name}</td>
                          <td>{formatDate(purchase.transaction_date)}</td>
                          <td>{quantityDetails.enteredLabel}</td>
                          <td>{quantityDetails.baseLabel}</td>
                          <td className="product-history-num">
                            {item.unit_cost !== undefined && item.unit_cost !== null
                              ? formatCurrency(item.unit_cost)
                              : "—"}
                          </td>
                          <td className="product-history-num">{formatOptionalCurrency(computePurchaseBaseUnitCostBeforeDiscount(item))}</td>
                          <td className="product-history-mid">
                            <DiscountBreakdown item={item} transaction={purchase} />
                          </td>
                          <td className="product-history-num">{formatOptionalCurrency(computePurchaseBaseUnitCostAfterDiscount(item, purchase))}</td>
                          <td className="product-history-num">{formatCurrency(computeItemAmount(item, purchase))}</td>
                          <td>
                            <span className={`status-badge status-${displayStatus}`}>
                              {getStatusLabel(t, displayStatus)}
                            </span>
                          </td>
                          <td>
                            <button
                              className="table-action-button"
                              type="button"
                              onClick={() => onOpenTransactionDetail("purchase", purchase)}
                            >
                              {t("products.detailsButton")}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <table className="transaction-history-table transaction-history-table-sale product-history-transaction-table">
                  <colgroup>
                    <col className="product-history-col-index" />
                    <col className="product-history-col-reference" />
                    <col className="product-history-col-party" />
                    <col className="product-history-col-date" />
                    <col className="product-history-col-qty" />
                    <col className="product-history-col-qty" />
                    <col className="product-history-col-unit" />
                    <col className="product-history-col-empty" />
                    <col className="product-history-col-discount" />
                    <col className="product-history-col-empty" />
                    <col className="product-history-col-amount" />
                    <col className="product-history-col-status" />
                    <col className="product-history-col-action" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="table-index-cell">#</th>
                      <th>{t("products.saleColRef")}</th>
                      <th>{t("products.saleColCustomer")}</th>
                      <th>{t("products.saleColDate")}</th>
                      <th>{t("products.saleColQty")}</th>
                      <th>{t("products.saleColBaseQty")}</th>
                      <th className="product-history-num">{t("products.saleColUnitPrice")}</th>
                      <th />
                      <th className="product-history-mid">{t("products.saleColDiscounts")}</th>
                      <th />
                      <th className="product-history-num">{t("products.saleColAmount")}</th>
                      <th>{t("products.saleColStatus")}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {historyRows.map(({ sale, item }, itemIndex) => {
                      const quantityDetails = getItemQuantityDetails(item, viewingProduct, "sale");
                      const displayStatus = getStoredSaleItemStatus(item, sale.status);
                      const rowNumber =
                        (pagination.page - 1) * pagination.page_size + itemIndex + 1;

                      return (
                        <tr key={`${sale.id}-${item.id}`}>
                          <td className="table-index-cell">{rowNumber}</td>
                          <td>
                            {sale.id != null && onOpenDocRef ? (
                              <DocumentRefChip
                                label={sale.reference_no}
                                docType="sale"
                                onClick={() =>
                                  onOpenDocRef({
                                    docType: "sale",
                                    docId: sale.id,
                                    referenceNo: sale.reference_no,
                                  })
                                }
                              />
                            ) : (
                              sale.reference_no
                            )}
                          </td>
                          <td>{sale.customer_name}</td>
                          <td>{formatDate(sale.transaction_date)}</td>
                          <td>{quantityDetails.enteredLabel}</td>
                          <td>{quantityDetails.baseLabel}</td>
                          <td className="product-history-num">
                            {item.unit_price !== undefined && item.unit_price !== null
                              ? formatCurrency(item.unit_price)
                              : "—"}
                          </td>
                          <td />
                          <td className="product-history-mid">
                            <DiscountBreakdown item={item} transaction={sale} />
                          </td>
                          <td />
                          <td className="product-history-num">{formatCurrency(computeItemAmount(item, sale))}</td>
                          <td>
                            <span className={`status-badge status-${displayStatus}`}>
                              {getStatusLabel(t, displayStatus)}
                            </span>
                          </td>
                          <td>
                            <button
                              className="table-action-button"
                              type="button"
                              onClick={() => onOpenTransactionDetail("sale", sale)}
                            >
                              {t("products.detailsButton")}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
          <PaginationControls
            pagination={pagination}
            onPageChange={onPageChange}
            itemLabel={
              isPurchase
                ? t("products.purchasePaginationLabel")
                : t("products.salesPaginationLabel")
            }
          />
        </div>
      )}
    </div>
  );
}

export default ProductHistoryTableSection;
