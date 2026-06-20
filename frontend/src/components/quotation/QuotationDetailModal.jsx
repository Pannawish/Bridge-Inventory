import DocumentRefChip from "../DocumentRefChip";
import { printTransactionDocument } from "../documentRefs/printTransactionDocument";
import { formatDate, formatMoney as fmt } from "../../format";
import { useLanguage } from "../../i18n/LanguageContext";
import { getStatusLabel } from "../../i18n/statusLabels";
import {
  computeAmount,
  computeVatSummary,
  findProductForItem,
  formatOptionalMoney,
  formatQuantityWithUnit,
  getQuotationBaseSalePrice,
  getQuotationItemBaseQuantity,
  getQuotationItemBaseUnit,
  getQuotationState,
  isVatEnabled,
  normalizeDiscounts,
} from "./quotationUtils";

function QuotationDetailModal({
  quotation,
  products = [],
  stockCoverage,
  onClose,
  onEdit,
  onDelete,
  onStartPurchase,
  onStartSale,
  onOpenDocRef,
}) {
  const { t } = useLanguage();

  if (!quotation) {
    return null;
  }

  const quotationState = getQuotationState(quotation);
  const itemTotal = (quotation.items || []).reduce(
    (sum, item) => sum + computeAmount(item, "sale_price"),
    0
  );
  const vatSummary = computeVatSummary(itemTotal, quotation.vat_mode);
  const showVat = isVatEnabled(quotation.vat_mode);

  // Flatten every on-the-way PO line across the quote's products so they can be
  // shown in one "incoming stock" table below the items.
  const incomingRows = (stockCoverage?.lines || []).flatMap((line, index) => {
    const lineItem = (quotation.items || [])[index];
    return (line.incomingPOs || []).map((po) => ({
      ...po,
      productName: lineItem?.product_name || "—",
    }));
  });

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="detail-modal transaction-detail-modal section-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quotation-detail-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("quotation.detailEyebrow")}</p>
            <h3 id="quotation-detail-title">{quotation.reference_no}</h3>
          </div>
          <div className="transaction-detail-actions">
            <button className="edit-button table-action-button" type="button" onClick={onEdit}>
              {t("quotation.editButton")}
            </button>
            <button
              className="secondary-button table-action-button"
              type="button"
              onClick={() =>
                printTransactionDocument({
                  docType: "quotation",
                  doc: quotation,
                  referenceNo: quotation.reference_no,
                  t,
                })
              }
            >
              {t("common.print")}
            </button>
            <button
              className="table-action-button"
              type="button"
              disabled={stockCoverage.allSufficient}
              title={
                stockCoverage.allSufficient
                  ? t("quotationDetail.purchaseDisabledCovered")
                  : ""
              }
              onClick={onStartPurchase}
            >
              {t("quotation.purchaseActionButton")}
            </button>
            <button className="table-action-button" type="button" onClick={onStartSale}>
              {t("quotation.saleActionButton")}
            </button>
            <button
              className="secondary-button table-action-button"
              type="button"
              onClick={onClose}
            >
              {t("quotation.closeButton")}
            </button>
          </div>
        </div>

        <div className="detail-grid">
          <div>
            <p className="detail-label">{t("quotation.detailCustomer")}</p>
            <strong>{quotation.customer_name || "—"}</strong>
          </div>
          <div>
            <p className="detail-label">{t("quotation.detailQuotationDate")}</p>
            <strong>{formatDate(quotation.quotation_date)}</strong>
          </div>
          <div>
            <p className="detail-label">{t("quotation.detailValidUntil")}</p>
            <strong>{formatDate(quotation.valid_until_date)}</strong>
          </div>
          <div>
            <p className="detail-label">{t("quotation.detailStatus")}</p>
            <strong>
              <span className={`quotation-state-pill ${quotationState.toLowerCase()}`}>
                {quotationState === "Valid"
                  ? t("quotation.stateValid")
                  : t("quotation.stateExpired")}
              </span>
            </strong>
          </div>
          <div>
            <p className="detail-label">{t("quotation.detailNote")}</p>
            <strong>{quotation.note || "—"}</strong>
          </div>
          <div>
            <p className="detail-label">{t("quotation.detailShippingDate")}</p>
            <strong>{quotation.shipping_date ? formatDate(quotation.shipping_date) : "—"}</strong>
          </div>
          <div>
            <p className="detail-label">{t("quotation.detailPaymentTerm")}</p>
            <strong>
              {quotation.payment_term_type === "cash"
                ? t("quotation.paymentTermDebit")
                : quotation.payment_term_type === "credit"
                  ? `${t("quotation.paymentTermCredit")}${quotation.payment_term_days ? ` — ${quotation.payment_term_days}` : ""}`
                  : "—"}
            </strong>
          </div>
          <div>
            <p className="detail-label">{t("quotation.detailPurchaseOrdersCreated")}</p>
            {(quotation.derived_purchase_links || []).length > 0 ? (
              <div className="doc-ref-chips">
                {quotation.derived_purchase_links.map((link) => (
                  <DocumentRefChip
                    key={link.id}
                    label={link.reference_no || link.id}
                    docType="purchase"
                    onClick={() =>
                      onOpenDocRef("purchase", link.id, link.reference_no || link.id)
                    }
                  />
                ))}
              </div>
            ) : (
              <strong>—</strong>
            )}
            <p className="detail-label" style={{ marginTop: "10px" }}>
              {t("quotation.detailSalesCreated")}
            </p>
            {(quotation.derived_sale_links || []).length > 0 ? (
              <div className="doc-ref-chips">
                {quotation.derived_sale_links.map((link) => (
                  <DocumentRefChip
                    key={link.id}
                    label={link.reference_no || link.id}
                    docType="sale"
                    onClick={() => onOpenDocRef("sale", link.id, link.reference_no || link.id)}
                  />
                ))}
              </div>
            ) : (
              <strong>—</strong>
            )}
          </div>
        </div>

        <div className="detail-items">
          <p className="detail-label">{t("quotation.detailItemsLabel")}</p>
          <div className="table-scroll quotation-detail-scroll">
            <table className="quotation-detail-table">
              <thead>
                <tr>
                  <th className="table-index-cell">#</th>
                  <th>{t("quotation.detailColProduct")}</th>
                  <th>{t("quotation.detailColSKU")}</th>
                  <th>{t("quotation.detailColQty")}</th>
                  <th>{t("quotationDetail.baseQtyColumn")}</th>
                  <th>{t("quotationDetail.stockColumn")}</th>
                  <th>{t("quotation.detailColSalePrice")}</th>
                  <th>{t("quotationDetail.baseSalePriceColumn")}</th>
                  <th>{t("quotationDetail.baseSalePriceAfterDiscountColumn")}</th>
                  <th>{t("quotation.detailColSuppliers")}</th>
                  <th>{t("quotation.detailColDiscounts")}</th>
                  <th>{t("quotation.detailColSaleAmount")}</th>
                </tr>
              </thead>
              <tbody>
                {(quotation.items || []).map((item, index) => {
                  const lineStockCoverage = stockCoverage.lines[index] || {
                    status: "unknown",
                    metaKey: "quotationDetail.stockUnknownMeta",
                    metaValues: {},
                  };
                  const product = findProductForItem(item, products);
                  const baseUnit = getQuotationItemBaseUnit(item, product);
                  const baseQuantity = getQuotationItemBaseQuantity(item, product);
                  const baseSalePrice = getQuotationBaseSalePrice(item, product);
                  const baseSalePriceAfterDiscount = getQuotationBaseSalePrice(
                    item,
                    product,
                    true
                  );
                  const discounts = normalizeDiscounts(item);
                  const activeDiscounts = discounts.filter((discount) => Number(discount) > 0);
                  const discountLabel = activeDiscounts.length
                    ? activeDiscounts.map((discount) => `${Number(discount)}%`).join("|")
                    : "—";
                  const supplierOptionList = Array.isArray(item.supplier_options)
                    ? item.supplier_options
                    : [];

                  return (
                    <tr key={item.line_id || index}>
                      <td className="table-index-cell">{index + 1}</td>
                      <td>{item.product_name || "—"}</td>
                      <td>{item.sku || "—"}</td>
                      <td>{formatQuantityWithUnit(item.quantity, item.unit)}</td>
                      <td>{formatQuantityWithUnit(baseQuantity, baseUnit)}</td>
                      <td>
                        <div className="quotation-detail-stock">
                          <span
                            className={`status-badge health-badge ${
                              lineStockCoverage.status === "covered"
                                ? "positive"
                                : lineStockCoverage.status === "incoming"
                                  ? "info"
                                  : lineStockCoverage.status === "short"
                                    ? "warning"
                                    : "danger"
                            }`}
                          >
                            {lineStockCoverage.status === "covered"
                              ? t("quotationDetail.stockCovered")
                              : lineStockCoverage.status === "incoming"
                                ? t("quotationDetail.stockOnTheWay")
                                : lineStockCoverage.status === "short"
                                  ? t("quotationDetail.stockShort")
                                  : t("quotationDetail.stockUnknown")}
                          </span>
                          <span className="quotation-detail-stock-meta">
                            {t(lineStockCoverage.metaKey, lineStockCoverage.metaValues)}
                          </span>
                        </div>
                      </td>
                      <td>
                        {item.sale_price !== "" && item.sale_price != null
                          ? fmt(item.sale_price)
                          : "—"}
                      </td>
                      <td>{formatOptionalMoney(baseSalePrice)}</td>
                      <td>{formatOptionalMoney(baseSalePriceAfterDiscount)}</td>
                      <td>
                        {supplierOptionList.length ? (
                          <div className="quotation-supplier-summary">
                            {supplierOptionList.map((option) => (
                              <span
                                key={option.id || option.option_id || option.supplier_name}
                                className="quotation-supplier-chip"
                              >
                                {option.supplier_name || "—"}: {fmt(option.cost_price)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <div className="tx-discount-breakdown">
                          <span className="tx-discount-breakdown-row">
                            <span className="tx-discount-type">
                              {t("quotation.detailDiscountTypeItem")}
                            </span>
                            <span className="tx-discount-label">{discountLabel}</span>
                          </span>
                        </div>
                      </td>
                      <td>{fmt(computeAmount(item, "sale_price"))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {incomingRows.length > 0 ? (
          <div className="detail-items">
            <p className="detail-label">{t("quotationDetail.incomingTitle")}</p>
            <div className="table-scroll quotation-detail-scroll">
              <table className="quotation-detail-table">
                <thead>
                  <tr>
                    <th className="table-index-cell">#</th>
                    <th>{t("quotation.detailColProduct")}</th>
                    <th>{t("quotationDetail.incomingColPO")}</th>
                    <th>{t("quotationDetail.incomingColStatus")}</th>
                    <th>{t("quotationDetail.incomingColArrival")}</th>
                    <th>{t("quotationDetail.incomingColQty")}</th>
                  </tr>
                </thead>
                <tbody>
                  {incomingRows.map((row, rowIndex) => (
                    <tr key={`${row.id}-${rowIndex}`}>
                      <td className="table-index-cell">{rowIndex + 1}</td>
                      <td>{row.productName}</td>
                      <td>
                        <DocumentRefChip
                          label={row.reference_no}
                          docType="purchase"
                          onClick={() => onOpenDocRef("purchase", row.id, row.reference_no)}
                        />
                      </td>
                      <td>
                        <span className={`status-badge status-${row.status}`}>
                          {getStatusLabel(t, row.status)}
                        </span>
                      </td>
                      <td>
                        {row.expected_delivery_date
                          ? formatDate(row.expected_delivery_date)
                          : "—"}
                      </td>
                      <td>{formatQuantityWithUnit(row.quantity, row.unit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        <div className="tx-sales-summary">
          {showVat ? (
            <>
              <div className="tx-summary-row">
                <span>{t("quotation.subtotal")}</span>
                <span>{fmt(vatSummary.total)}</span>
              </div>
              <div className="tx-summary-row">
                <span>{t("quotation.vat")}</span>
                <span>{fmt(vatSummary.vat)}</span>
              </div>
            </>
          ) : null}
          <div className="tx-summary-row tx-summary-grand">
            <strong>{t("quotation.grandTotal")}</strong>
            <strong>{fmt(vatSummary.grandTotal)}</strong>
          </div>
        </div>

        <div className="transaction-detail-footer">
          <button className="danger-button" type="button" onClick={onDelete}>
            {t("quotation.deleteButton")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default QuotationDetailModal;
