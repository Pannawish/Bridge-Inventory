// React component for quotation workflow: quotation conversion flow.

import SalesForm from "../SalesForm";
import QuotationConvertSelect from "../QuotationConvertSelect";
import { useLanguage } from "../../i18n/LanguageContext";

function QuotationConversionFlow({
  conversion,
  products = [],
  customers = [],
  suppliers = [],
  purchases = [],
  sales = [],
  enableSaleStockValidation = true,
  onBack,
  onContinue,
  onSubmitSale,
}) {
  const { t } = useLanguage();

  if (!conversion) {
    return null;
  }

  if (conversion.step === "sale-form") {
    return (
      <div className="stack-layout">
        <section className="section-card quotation-link-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{t("quotation.quotationLinkEyebrow")}</p>
              <h3>{t("quotation.quotationLinkTitle", { ref: conversion.quotation.reference_no })}</h3>
            </div>
            <button className="secondary-button" type="button" onClick={onBack}>
              {t("quotation.quotationLinkBack")}
            </button>
          </div>
        </section>
        <SalesForm
          key={`sale-from-${conversion.quotation.id}`}
          products={products}
          customers={customers}
          suppliers={suppliers}
          purchases={purchases}
          sales={sales}
          enableStockValidation={enableSaleStockValidation}
          prefill={conversion.salePrefill}
          onSubmit={onSubmitSale}
          onCancel={onBack}
        />
      </div>
    );
  }

  return (
    <div className="stack-layout">
      <QuotationConvertSelect
        key={`convert-${conversion.type}-${conversion.quotation.id}`}
        quotation={conversion.quotation}
        type={conversion.type}
        initialSelectedItemKeys={conversion.initialSelectedItemKeys}
        stockCoverageLines={conversion.stockCoverageLines}
        onBack={onBack}
        onContinue={onContinue}
      />
    </div>
  );
}

export default QuotationConversionFlow;
